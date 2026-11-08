// Prism Launcher Deluxe — главный процесс.
// Экземпляры хранятся в обычной папке Prism Launcher, запуск и вход в аккаунт делает сам Prism (через его CLI).
'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const zlib = require('zlib');

// Минимальный читатель zip (без сторонних библиотек): stored + deflate.
class AdmZip {
  constructor(buf) {
    this.buf = buf;
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Повреждённый архив');
    const count = buf.readUInt16LE(eocd + 10);
    let off = buf.readUInt32LE(eocd + 16);
    this.entries = [];
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(off) !== 0x02014b50) break;
      const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
      const nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
      const local = buf.readUInt32LE(off + 42);
      const entryName = buf.slice(off + 46, off + 46 + nlen).toString('utf8').replace(/\\/g, '/');
      const self = this;
      this.entries.push({
        entryName, isDirectory: entryName.endsWith('/'),
        getData() {
          const ln = buf.readUInt16LE(local + 26), lx = buf.readUInt16LE(local + 28);
          const start = local + 30 + ln + lx;
          const data = self.buf.slice(start, start + csize);
          if (method === 0) return data;
          if (method === 8) return zlib.inflateRawSync(data);
          throw new Error('Неподдерживаемое сжатие в архиве: ' + entryName);
        }
      });
      off += 46 + nlen + xlen + clen;
    }
  }
  getEntries() { return this.entries; }
  getEntry(name) { return this.entries.find((e) => e.entryName === name) || null; }
}

const MODRINTH = process.env.DELUXE_MODRINTH || 'https://api.modrinth.com/v2';
const META = process.env.DELUXE_META || 'https://meta.prismlauncher.org/v1';
const CURSE = process.env.DELUXE_CURSE || 'https://api.curseforge.com/v1';
const UA = 'PrismLauncherDeluxe/1.0.0';

const FOLDERS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };
const CF_CLASS = { mod: 6, resourcepack: 12, shader: 6552, modpack: 4471 };
const CF_CLASS_TO_TYPE = { 6: 'mod', 12: 'resourcepack', 6552: 'shader' };
const CF_LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const LOADER_UID = {
  fabric: 'net.fabricmc.fabric-loader', quilt: 'org.quiltmc.quilt-loader',
  forge: 'net.minecraftforge', neoforge: 'net.neoforged'
};
const UID_LOADER = Object.fromEntries(Object.entries(LOADER_UID).map(([k, v]) => [v, k]));

let win;

// ---------- журнал отладки ----------
function logFiles() {
  const out = [];
  try { out.push(path.join(app.getPath('userData'), 'debug-log.txt')); } catch { }
  try { const d = path.join(app.getPath('downloads'), 'Voltforge', 'PrismLauncherDeluxe'); if (fs.existsSync(d)) out.push(path.join(d, 'debug-log.txt')); } catch { }
  return out;
}
function log(...a) {
  const line = new Date().toISOString() + ' ' + a.map((x) => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n';
  for (const f of logFiles()) { try { fs.appendFileSync(f, line); } catch { } }
}
process.on('uncaughtException', (e) => log('uncaught', e));
process.on('unhandledRejection', (e) => log('unhandledRejection', e));

// ---------- конфиг ----------
const cfgPath = () => path.join(app.getPath('userData'), 'deluxe-config.json');
const DEFAULT_CFG = {
  prismExe: '', prismData: '', curseKey: '', accent: '#5AC8FA', bgQuality: 'auto', pauseInactive: true, background: 'liquid', backgroundImage: '', bgSpeed: 1, glassOpacity: 46, glassBlur: 30,
  animations: true, closeOnLaunch: false, trayOnClose: false, autoBackup: false, backupKeep: 5, sounds: true, theme: 'dark', discordId: '', updateRepo: '', friends: [], pinned: [], extraServers: [], sortBy: 'recent', defaultRam: 4096, account: '', lastInstance: ''
};
function loadCfg() {
  try { return { ...DEFAULT_CFG, ...JSON.parse(fs.readFileSync(cfgPath(), 'utf8')) }; } catch { return { ...DEFAULT_CFG }; }
}
function saveCfg(c) {
  fs.mkdirSync(path.dirname(cfgPath()), { recursive: true });
  fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2));
}
let cfg;

// ---------- поиск Prism ----------
function exists(p) { try { return !!p && fs.existsSync(p); } catch { return false; } }
function detectPrism() {
  const env = process.env;
  const exeCandidates = [
    cfg.prismExe,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'PrismLauncher', 'prismlauncher.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'PrismLauncher', 'prismlauncher.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'PrismLauncher', 'prismlauncher.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'prismlauncher.exe'),
    '/usr/bin/prismlauncher', '/usr/local/bin/prismlauncher', '/Applications/Prism Launcher.app/Contents/MacOS/prismlauncher'
  ].filter(Boolean);
  const exe = exeCandidates.find(exists) || '';
  const dataCandidates = [
    cfg.prismData,
    env.DELUXE_PRISM_DATA,
    exe && exists(path.join(path.dirname(exe), 'portable.txt')) ? path.dirname(exe) : '',
    env.APPDATA && path.join(env.APPDATA, 'PrismLauncher'),
    path.join(os.homedir(), '.local', 'share', 'PrismLauncher'),
    path.join(os.homedir(), 'Library', 'Application Support', 'PrismLauncher')
  ].filter(Boolean);
  const data = dataCandidates.find(exists) || dataCandidates.find(Boolean) || '';
  let instances = path.join(data, 'instances');
  try {
    const pcfg = fs.readFileSync(path.join(data, 'prismlauncher.cfg'), 'utf8');
    const m = pcfg.match(/^InstanceDir=(.*)$/m);
    if (m && m[1].trim()) instances = path.isAbsolute(m[1].trim()) ? m[1].trim() : path.join(data, m[1].trim());
  } catch { }
  let icons = path.join(data, 'icons');
  return { exe, data, instances, icons };
}

// ---------- ini ----------
function parseIni(text) {
  const out = {}; let sec = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const s = line.match(/^\[(.+)\]$/);
    if (s) { sec = s[1]; continue; }
    const i = line.indexOf('=');
    if (i < 0) continue;
    if (sec && sec !== 'General') continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}
function unescapeIni(v) { return (v || '').replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'); }
function escapeIni(v) { return String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n'); }
async function updateIni(file, values) {
  let text = '';
  try { text = await fsp.readFile(file, 'utf8'); } catch { text = '[General]\n'; }
  const lines = text.split(/\r?\n/);
  if (!lines.some((l) => l.trim() === '[General]')) lines.unshift('[General]');
  const todo = { ...values };
  let sec = '';
  let generalEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const s = t.match(/^\[(.+)\]$/);
    if (s) { if (sec === 'General' && generalEnd < 0) generalEnd = i; sec = s[1]; continue; }
    if (sec !== 'General') continue;
    const k = t.split('=')[0];
    if (k in todo) { lines[i] = k + '=' + escapeIni(todo[k]); delete todo[k]; }
  }
  if (generalEnd < 0) generalEnd = lines.length;
  while (generalEnd > 0 && lines[generalEnd - 1].trim() === '') generalEnd--;
  const add = Object.entries(todo).map(([k, v]) => k + '=' + escapeIni(v));
  lines.splice(generalEnd, 0, ...add);
  await fsp.writeFile(file, lines.join('\n'));
}

// ---------- сеть ----------
async function http(url, opts = {}) {
  const headers = { 'User-Agent': UA, ...(opts.headers || {}) };
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { ...opts, headers });
      if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + url.replace(/\?.*/, ''));
      return r;
    } catch (e) { last = e; if (String(e.message).startsWith('HTTP 4')) break; await sleep(600 * (attempt + 1)); }
  }
  throw last;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, opts) { return (await http(url, opts)).json(); }
function cfHeaders() {
  if (!cfg.curseKey) throw new Error('Нужен API-ключ CurseForge — добавьте его в Настройках');
  return { 'x-api-key': cfg.curseKey, Accept: 'application/json', 'Content-Type': 'application/json' };
}
async function cf(pathq, body) {
  return getJson(CURSE + pathq, body ? { method: 'POST', headers: cfHeaders(), body: JSON.stringify(body) } : { headers: cfHeaders() });
}

function progress(task, data) { if (win && !win.isDestroyed()) win.webContents.send('progress', { task, ...data }); }

async function download(url, dest, sha1) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const r = await http(url);
  const tmp = dest + '.part';
  const hash = crypto.createHash('sha1');
  const out = fs.createWriteStream(tmp);
  let size = 0;
  try {
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value); size += value.length;
      if (!out.write(value)) await new Promise((res) => out.once('drain', res));
    }
    await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
  } catch (e) { out.destroy(); await fsp.unlink(tmp).catch(() => { }); throw e; }
  if (sha1 && hash.digest('hex').toLowerCase() !== sha1.toLowerCase()) { await fsp.unlink(tmp).catch(() => { }); throw new Error('Контрольная сумма не совпала: ' + path.basename(dest)); }
  await fsp.rename(tmp, dest);
  return size;
}
async function pool(items, n, fn) {
  let i = 0; const errs = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { await fn(items[k], k); } catch (e) { errs.push(e); } }
  }));
  if (errs.length) throw errs[0];
}

// ---------- экземпляры ----------
function mcDir(instDir) {
  const a = path.join(instDir, 'minecraft'), b = path.join(instDir, '.minecraft');
  if (exists(b) && !exists(a)) return b;
  return a;
}
function safePath(base, ...parts) {
  const p = path.resolve(base, ...parts);
  if (!p.startsWith(path.resolve(base) + path.sep) && p !== path.resolve(base)) throw new Error('Недопустимый путь');
  return p;
}
function instDir(id) { const P = detectPrism(); return safePath(P.instances, id); }

function iconFor(P, key) {
  if (!key || key === 'default') return '';
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg', '']) {
    const f = path.join(P.icons, key + ext);
    if (exists(f) && fs.statSync(f).isFile()) return 'file:///' + f.replace(/\\/g, '/');
  }
  return '';
}

async function readInstance(P, id, groupsMap) {
  const dir = path.join(P.instances, id);
  const ini = parseIni(await fsp.readFile(path.join(dir, 'instance.cfg'), 'utf8'));
  let mc = '', loader = 'vanilla', loaderVersion = '';
  try {
    const pack = JSON.parse(await fsp.readFile(path.join(dir, 'mmc-pack.json'), 'utf8'));
    for (const c of pack.components || []) {
      if (c.uid === 'net.minecraft') mc = c.version || c.cachedVersion || '';
      if (UID_LOADER[c.uid]) { loader = UID_LOADER[c.uid]; loaderVersion = c.version || c.cachedVersion || ''; }
    }
  } catch { }
  let modCount = 0;
  try { modCount = (await fsp.readdir(path.join(mcDir(dir), 'mods'))).filter((f) => /\.jar(\.disabled)?$/i.test(f)).length; } catch { }
  return {
    id, name: unescapeIni(ini.name) || id, mc, loader, loaderVersion, modCount,
    icon: iconFor(P, ini.iconKey), iconKey: ini.iconKey || '',
    lastLaunch: Number(ini.lastLaunchTime || 0), played: Number(ini.totalTimePlayed || 0),
    ram: Number(ini.MaxMemAlloc || 0), ramOverride: ini.OverrideMemory === 'true',
    notes: unescapeIni(ini.notes || ''), pack: ini.ManagedPackName || '', group: (groupsMap && groupsMap[id]) || '',
    cover: coverFor(dir), pinned: (cfg.pinned || []).includes(id)
  };
}
function coverFor(dir) {
  for (const e of ['.png', '.jpg', '.jpeg', '.webp']) {
    const f = path.join(dir, '.deluxe-cover' + e);
    if (exists(f)) { let t = 0; try { t = fs.statSync(f).mtimeMs; } catch { } return 'file:///' + f.replace(/\\/g, '/') + '?v=' + Math.round(t); }
  }
  return '';
}
async function readGroups(P) {
  const map = {};
  try {
    const j = JSON.parse(await fsp.readFile(path.join(P.instances, 'instgroups.json'), 'utf8'));
    for (const [g, v] of Object.entries(j.groups || {})) for (const id of v.instances || []) map[id] = g;
  } catch { }
  return map;
}

async function listInstances() {
  const P = detectPrism();
  let names = [];
  try { names = await fsp.readdir(P.instances); } catch { return { prism: P, instances: [] }; }
  const valid = names.filter((n) => !n.startsWith('.') && !n.startsWith('_') && exists(path.join(P.instances, n, 'instance.cfg')));
  const groups = await readGroups(P);
  const out = (await Promise.all(valid.map((n) => readInstance(P, n, groups).catch(() => null)))).filter(Boolean);
  out.sort((a, b) => (b.lastLaunch - a.lastLaunch) || a.name.localeCompare(b.name));
  return { prism: P, instances: out };
}

function folderName(P, name) {
  let base = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/[. ]+$/, '').trim() || 'Instance';
  let n = base, i = 1;
  while (exists(path.join(P.instances, n))) n = base + ' (' + (++i) + ')';
  return n;
}

function components(mc, loader, loaderVersion) {
  const comps = [{ uid: 'net.minecraft', version: mc, important: true }];
  if (loader === 'fabric' || loader === 'quilt') comps.push({ uid: 'net.fabricmc.intermediary', version: mc, dependencyOnly: true });
  if (loader && loader !== 'vanilla') comps.push({ uid: LOADER_UID[loader], version: loaderVersion });
  return { components: comps, formatVersion: 1 };
}

async function createInstance({ name, mc, loader, loaderVersion, ram, iconKey, notes, managed }) {
  const P = detectPrism();
  if (!P.data) throw new Error('Не найдена папка Prism Launcher — укажите её в Настройках');
  if (!mc) throw new Error('Выберите версию Minecraft');
  if (loader && loader !== 'vanilla' && !loaderVersion) throw new Error('Нет версии загрузчика для ' + mc);
  await fsp.mkdir(P.instances, { recursive: true });
  const id = folderName(P, name || ('Minecraft ' + mc));
  const dir = path.join(P.instances, id);
  await fsp.mkdir(path.join(dir, 'minecraft'), { recursive: true });
  const ini = {
    ConfigVersion: '1.3', InstanceType: 'OneSix', name: name || id, iconKey: iconKey || 'default',
    OverrideMemory: 'true', MaxMemAlloc: String(ram || cfg.defaultRam || 4096), MinMemAlloc: '512', notes: notes || ''
  };
  if (managed) Object.assign(ini, managed);
  await fsp.writeFile(path.join(dir, 'instance.cfg'),
    '[General]\n' + Object.entries(ini).map(([k, v]) => k + '=' + escapeIni(v)).join('\n') + '\n');
  await fsp.writeFile(path.join(dir, 'mmc-pack.json'), JSON.stringify(components(mc, loader, loaderVersion), null, 4));
  return id;
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d); else if (e.isFile()) await fsp.copyFile(s, d);
  }
}

// ---------- мета-данные версий ----------
const metaCache = {};
async function meta(uid) {
  if (metaCache[uid] && Date.now() - metaCache[uid].t < 30 * 60e3) return metaCache[uid].v;
  const v = await getJson(META + '/' + uid + '/index.json');
  metaCache[uid] = { t: Date.now(), v };
  return v;
}
async function minecraftVersions() {
  const idx = await meta('net.minecraft');
  return (idx.versions || []).map((v) => ({ version: v.version, type: v.type || 'release', time: v.releaseTime || '' }))
    .sort((a, b) => (b.time || '').localeCompare(a.time || ''));
}
async function loaderVersions(loader, mc) {
  if (!loader || loader === 'vanilla') return [];
  const idx = await meta(LOADER_UID[loader]);
  let list = idx.versions || [];
  if (loader === 'forge' || loader === 'neoforge') {
    list = list.filter((v) => (v.requires || []).some((r) => r.uid === 'net.minecraft' && (!r.equals || r.equals === mc)));
  }
  list = list.slice().sort((a, b) => (b.releaseTime || '').localeCompare(a.releaseTime || ''));
  return list.map((v) => ({ version: v.version, recommended: !!v.recommended, stable: !/beta|alpha|rc|pre/i.test(v.version) }));
}

// ---------- контент экземпляра ----------
const INDEX = '.deluxe-index.json';
async function readIndex(dir) { try { return JSON.parse(await fsp.readFile(path.join(dir, INDEX), 'utf8')); } catch { return {}; } }
async function writeIndex(dir, idx) { await fsp.mkdir(dir, { recursive: true }); await fsp.writeFile(path.join(dir, INDEX), JSON.stringify(idx, null, 1)); }

async function listContent(id, type) {
  const dir = path.join(mcDir(instDir(id)), FOLDERS[type]);
  let files = [];
  try { files = await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const idx = await readIndex(dir);
  const out = [];
  for (const f of files) {
    if (f.name === INDEX || f.name.endsWith('.part')) continue;
    const enabled = !f.name.endsWith('.disabled');
    const base = enabled ? f.name : f.name.slice(0, -9);
    if (type === 'mod' && !/\.jar$/i.test(base)) continue;
    const info = idx[base] || {};
    let size = 0; try { size = (await fsp.stat(path.join(dir, f.name))).size; } catch { }
    out.push({ file: f.name, base, enabled, size, dir: f.isDirectory(), title: info.title || prettyName(base), icon: info.icon || '', source: info.source || '', projectId: info.projectId || '' });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}
function prettyName(f) {
  return f.replace(/\.(jar|zip)$/i, '').replace(/[-_+](mc)?\d[\w.\-+]*$/i, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() || f;
}

// ---------- поиск ----------
async function search({ source, type, query, mc, loader, offset = 0, sort = 'relevance' }) {
  if (source === 'curseforge') {
    const q = new URLSearchParams({ gameId: '432', classId: String(CF_CLASS[type]), searchFilter: query || '', sortField: sort === 'downloads' ? '6' : '2', sortOrder: 'desc', pageSize: '24', index: String(offset) });
    if (mc && type !== 'modpack') q.set('gameVersion', mc);
    if (type === 'mod' && loader && CF_LOADER[loader]) q.set('modLoaderType', String(CF_LOADER[loader]));
    const r = await cf('/mods/search?' + q);
    return {
      total: r.pagination ? r.pagination.totalCount : 0,
      hits: (r.data || []).map((m) => ({
        source, id: String(m.id), slug: m.slug, title: m.name, desc: m.summary, author: (m.authors && m.authors[0] && m.authors[0].name) || '',
        icon: (m.logo && (m.logo.thumbnailUrl || m.logo.url)) || '', downloads: m.downloadCount || 0,
        url: (m.links && m.links.websiteUrl) || ''
      }))
    };
  }
  const facets = [['project_type:' + type]];
  if (mc && type !== 'modpack') facets.push(['versions:' + mc]);
  if (type === 'mod' && loader && loader !== 'vanilla') facets.push(['categories:' + loader]);
  const q = new URLSearchParams({ query: query || '', limit: '24', offset: String(offset), index: sort === 'downloads' ? 'downloads' : 'relevance', facets: JSON.stringify(facets) });
  const r = await getJson(MODRINTH + '/search?' + q);
  return {
    total: r.total_hits || 0,
    hits: (r.hits || []).map((h) => ({
      source: 'modrinth', id: h.project_id, slug: h.slug, title: h.title, desc: h.description, author: h.author,
      icon: h.icon_url || '', downloads: h.downloads || 0, url: 'https://modrinth.com/' + (h.project_type || type) + '/' + h.slug
    }))
  };
}

// ---------- установка контента ----------
async function modrinthPick(projectId, type, mc, loader) {
  const q = new URLSearchParams();
  if (mc) q.set('game_versions', JSON.stringify([mc]));
  if (type === 'mod' && loader && loader !== 'vanilla') q.set('loaders', JSON.stringify([loader]));
  const vs = await getJson(MODRINTH + '/project/' + encodeURIComponent(projectId) + '/version?' + q);
  if (!vs.length) return null;
  const rel = vs.find((v) => v.version_type === 'release') || vs[0];
  return rel;
}
async function cfPick(modId, mc, loader, type) {
  const q = new URLSearchParams({ pageSize: '50' });
  if (mc) q.set('gameVersion', mc);
  if (type === 'mod' && loader && CF_LOADER[loader]) q.set('modLoaderType', String(CF_LOADER[loader]));
  const r = await cf('/mods/' + modId + '/files?' + q);
  const files = (r.data || []).filter((f) => f.isAvailable !== false).sort((a, b) => (b.fileDate || '').localeCompare(a.fileDate || ''));
  return files.find((f) => f.releaseType === 1) || files[0] || null;
}

async function installContent({ source, type, projectId, instanceId, title, icon }) {
  const inst = await readInstance(detectPrism(), instanceId);
  const dir = path.join(mcDir(instDir(instanceId)), FOLDERS[type]);
  await fsp.mkdir(dir, { recursive: true });
  const idx = await readIndex(dir);
  const have = new Set(Object.values(idx).map((v) => v.source + ':' + v.projectId));
  const queue = [{ projectId: String(projectId), title, icon }];
  const done = [];
  const task = 'install:' + source + ':' + projectId;
  while (queue.length) {
    const item = queue.shift();
    const key = source + ':' + item.projectId;
    if (have.has(key)) continue;
    have.add(key);
    progress(task, { text: 'Загрузка: ' + (item.title || item.projectId), done: done.length, total: done.length + queue.length + 1 });
    if (source === 'modrinth') {
      const v = await modrinthPick(item.projectId, type, inst.mc, inst.loader);
      if (!v) { if (done.length === 0) throw new Error('Нет версии для ' + inst.mc + (type === 'mod' ? ' / ' + inst.loader : '')); continue; }
      const file = v.files.find((f) => f.primary) || v.files[0];
      let meta = { title: item.title, icon: item.icon };
      if (!meta.title) { try { const p = await getJson(MODRINTH + '/project/' + item.projectId); meta = { title: p.title, icon: p.icon_url }; } catch { } }
      await removeOldVersions(dir, idx, key);
      await download(file.url, path.join(dir, file.filename), file.hashes && file.hashes.sha1);
      idx[file.filename] = { source, projectId: item.projectId, versionId: v.id, title: meta.title || prettyName(file.filename), icon: meta.icon || '' };
      done.push(meta.title || file.filename);
      for (const d of v.dependencies || []) {
        if (d.dependency_type !== 'required') continue;
        let pid = d.project_id;
        if (!pid && d.version_id) { try { pid = (await getJson(MODRINTH + '/version/' + d.version_id)).project_id; } catch { } }
        if (pid && !have.has('modrinth:' + pid)) queue.push({ projectId: pid });
      }
    } else {
      const f = await cfPick(item.projectId, inst.mc, inst.loader, type);
      if (!f) { if (done.length === 0) throw new Error('Нет файла для ' + inst.mc + (type === 'mod' ? ' / ' + inst.loader : '')); continue; }
      if (!f.downloadUrl) throw new Error('Автор «' + (item.title || item.projectId) + '» запретил скачивание через сторонние лаунчеры — скачайте его с сайта CurseForge');
      let meta = { title: item.title, icon: item.icon };
      if (!meta.title) { try { const p = (await cf('/mods/' + item.projectId)).data; meta = { title: p.name, icon: p.logo && p.logo.thumbnailUrl }; } catch { } }
      const sha1 = (f.hashes || []).find((h) => h.algo === 1);
      await removeOldVersions(dir, idx, key);
      await download(f.downloadUrl, path.join(dir, f.fileName), sha1 && sha1.value);
      idx[f.fileName] = { source, projectId: item.projectId, versionId: String(f.id), title: meta.title || prettyName(f.fileName), icon: meta.icon || '' };
      done.push(meta.title || f.fileName);
      for (const d of f.dependencies || []) if (d.relationType === 3 && !have.has('curseforge:' + d.modId)) queue.push({ projectId: String(d.modId) });
    }
    await writeIndex(dir, idx);
  }
  progress(task, { text: 'Готово', done: done.length, total: done.length, finished: true });
  return done;
}
async function removeOldVersions(dir, idx, key) {
  for (const [file, v] of Object.entries(idx)) {
    if (v.source + ':' + v.projectId !== key) continue;
    for (const f of [file, file + '.disabled']) { try { await fsp.unlink(path.join(dir, f)); } catch { } }
    delete idx[file];
  }
}

// ---------- модпаки ----------
async function installMrpack(zipBuf, opts = {}) {
  const zip = new AdmZip(zipBuf);
  const indexEntry = zip.getEntry('modrinth.index.json');
  if (!indexEntry) throw new Error('В архиве нет modrinth.index.json');
  const index = JSON.parse(indexEntry.getData().toString('utf8'));
  const deps = index.dependencies || {};
  const mc = deps.minecraft;
  let loader = 'vanilla', lv = '';
  for (const [k, l] of [['neoforge', 'neoforge'], ['forge', 'forge'], ['fabric-loader', 'fabric'], ['quilt-loader', 'quilt']]) if (deps[k]) { loader = l; lv = deps[k]; }
  const name = opts.name || index.name || 'Modpack';
  const id = await createInstance({
    name, mc, loader, loaderVersion: lv, iconKey: opts.iconKey, notes: index.summary || '',
    managed: { ManagedPack: 'true', ManagedPackType: 'modrinth', ManagedPackID: opts.projectId || '', ManagedPackName: name, ManagedPackVersionID: opts.versionId || '', ManagedPackVersionName: index.versionId || '' }
  });
  const root = mcDir(instDir(id));
  const files = (index.files || []).filter((f) => !f.env || f.env.client !== 'unsupported');
  const task = 'pack:' + id;
  let n = 0;
  await pool(files, 6, async (f) => {
    const dest = safePath(root, f.path);
    await download(f.downloads[0], dest, f.hashes && f.hashes.sha1);
    progress(task, { text: 'Модпак «' + name + '»: файлы', done: ++n, total: files.length });
  });
  for (const e of zip.getEntries()) {
    for (const pre of ['overrides/', 'client-overrides/']) {
      if (!e.entryName.startsWith(pre) || e.isDirectory) continue;
      const dest = safePath(root, e.entryName.slice(pre.length));
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, e.getData());
    }
  }
  progress(task, { text: 'Модпак «' + name + '» установлен', done: files.length, total: files.length, finished: true });
  return id;
}

async function installCursePack(zipBuf, opts = {}) {
  const zip = new AdmZip(zipBuf);
  const me = zip.getEntry('manifest.json');
  if (!me) throw new Error('В архиве нет manifest.json');
  const man = JSON.parse(me.getData().toString('utf8'));
  const mc = man.minecraft && man.minecraft.version;
  const ml = ((man.minecraft && man.minecraft.modLoaders) || []).find((l) => l.primary) || (man.minecraft.modLoaders || [])[0];
  let loader = 'vanilla', lv = '';
  if (ml) { const m = ml.id.match(/^(neoforge|forge|fabric|quilt)-(.+)$/); if (m) { loader = m[1]; lv = m[2]; } }
  if (loader === 'neoforge' && mc === '1.20.1') lv = lv.replace(/^1\.20\.1-/, '');
  const name = opts.name || man.name || 'Modpack';
  const id = await createInstance({
    name, mc, loader, loaderVersion: lv, iconKey: opts.iconKey,
    managed: { ManagedPack: 'true', ManagedPackType: 'flame', ManagedPackID: opts.projectId || '', ManagedPackName: name, ManagedPackVersionID: opts.versionId || '', ManagedPackVersionName: man.version || '' }
  });
  const root = mcDir(instDir(id));
  const want = (man.files || []).filter((f) => f.required !== false);
  const task = 'pack:' + id;
  const infos = [];
  for (let i = 0; i < want.length; i += 100) {
    const chunk = want.slice(i, i + 100);
    const r = await cf('/mods/files', { fileIds: chunk.map((f) => f.fileID) });
    infos.push(...(r.data || []));
  }
  const modIds = [...new Set(infos.map((f) => f.modId))];
  const classes = {};
  for (let i = 0; i < modIds.length; i += 100) {
    const r = await cf('/mods', { modIds: modIds.slice(i, i + 100) });
    for (const m of r.data || []) classes[m.id] = m.classId;
  }
  const blocked = [];
  let n = 0;
  await pool(infos, 6, async (f) => {
    const type = CF_CLASS_TO_TYPE[classes[f.modId]] || 'mod';
    if (!f.downloadUrl) { blocked.push(f.fileName); return; }
    const sha1 = (f.hashes || []).find((h) => h.algo === 1);
    await download(f.downloadUrl, path.join(root, FOLDERS[type], f.fileName), sha1 && sha1.value);
    progress(task, { text: 'Модпак «' + name + '»: файлы', done: ++n, total: infos.length });
  });
  const ov = (man.overrides || 'overrides') + '/';
  for (const e of zip.getEntries()) {
    if (!e.entryName.startsWith(ov) || e.isDirectory) continue;
    const dest = safePath(root, e.entryName.slice(ov.length));
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, e.getData());
  }
  progress(task, { text: 'Модпак «' + name + '» установлен', done: infos.length, total: infos.length, finished: true });
  return { id, blocked };
}

async function saveIcon(url, key) {
  if (!url) return 'default';
  try {
    const P = detectPrism();
    await fsp.mkdir(P.icons, { recursive: true });
    const r = await http(url);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = /\.png($|\?)/i.test(url) ? '.png' : /\.webp($|\?)/i.test(url) ? '.webp' : /\.gif($|\?)/i.test(url) ? '.gif' : '.png';
    await fsp.writeFile(path.join(P.icons, key + ext), buf);
    return key;
  } catch { return 'default'; }
}

async function installModpack({ source, projectId, title, icon }) {
  const key = 'deluxe_' + String(projectId).replace(/[^a-zA-Z0-9]/g, '');
  progress('pack:new', { text: 'Модпак «' + title + '»: получаю данные', done: 0, total: 1 });
  if (source === 'modrinth') {
    const vs = await getJson(MODRINTH + '/project/' + encodeURIComponent(projectId) + '/version');
    const v = vs.find((x) => x.version_type === 'release') || vs[0];
    if (!v) throw new Error('У модпака нет версий');
    const file = v.files.find((f) => f.primary) || v.files[0];
    const buf = Buffer.from(await (await http(file.url)).arrayBuffer());
    const iconKey = await saveIcon(icon, key);
    progress('pack:new', { finished: true });
    return installMrpack(buf, { name: title, projectId, versionId: v.id, iconKey });
  }
  const f = await cfPick(projectId, '', '', 'modpack');
  if (!f) throw new Error('У модпака нет файлов');
  if (!f.downloadUrl) throw new Error('Автор запретил скачивание модпака через сторонние лаунчеры');
  const buf = Buffer.from(await (await http(f.downloadUrl)).arrayBuffer());
  const iconKey = await saveIcon(icon, key);
  progress('pack:new', { finished: true });
  const r = await installCursePack(buf, { name: title, projectId, versionId: String(f.id), iconKey });
  return r.id;
}

// ---------- аккаунты ----------
async function listAccounts() {
  const P = detectPrism();
  try {
    const j = JSON.parse(await fsp.readFile(path.join(P.data, 'accounts.json'), 'utf8'));
    return (j.accounts || []).map((a) => ({
      name: (a.profile && a.profile.name) || a.ygg && a.ygg.extra && a.ygg.extra.userName || 'Аккаунт',
      uuid: (a.profile && a.profile.id) || '', type: a.type || 'MSA', active: !!a.active
    }));
  } catch { return []; }
}

// ---------- запуск ----------
function runPrism(args) {
  const P = detectPrism();
  if (!P.exe) throw new Error('Не найден prismlauncher.exe — установите Prism Launcher или укажите путь в Настройках');
  const allArgs = [...args];
  if (cfg.prismData && !exists(path.join(path.dirname(P.exe), 'portable.txt'))) allArgs.unshift('--dir', P.data);
  const child = spawn(P.exe, allArgs, { detached: true, stdio: 'ignore', cwd: path.dirname(P.exe) });
  child.on('error', (e) => { if (win) win.webContents.send('toast', { text: 'Prism не запустился: ' + e.message, error: true }); });
  child.unref();
}

// ---------- IPC ----------
function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...args) => {
    const t = Date.now();
    try { const value = await fn(...args); if (Date.now() - t > 1500) log('ipc slow', name, (Date.now() - t) + 'ms'); return { ok: true, value }; }
    catch (e) { log('ipc', name, 'ERROR', e); return { ok: false, error: e.message || String(e) }; }
  });
}

handle('config:get', () => cfg);
handle('config:set', (patch) => {
  const discordChanged = 'discordId' in patch && patch.discordId !== cfg.discordId;
  cfg = { ...cfg, ...patch }; saveCfg(cfg);
  if (discordChanged && ctx.discordRefresh) ctx.discordRefresh();
  return cfg;
});
handle('prism:detect', () => detectPrism());
handle('prism:open', () => { runPrism([]); return true; });
handle('instances:list', () => listInstances());
handle('instances:create', (o) => createInstance(o));
async function launch(id, opts = {}) {
  if (ctx.autoBackup) { try { await ctx.autoBackup(id); } catch (e) { log('autobackup', e); } }
  const args = ['--launch', id];
  if (cfg.account) args.push('--profile', cfg.account);
  if (opts.server) args.push('--server', opts.server);
  runPrism(args);
  cfg.lastInstance = id; saveCfg(cfg);
  if (ctx.onLaunch) ctx.onLaunch(id);
  if (cfg.closeOnLaunch && win) setTimeout(() => win.minimize(), 800);
  return true;
}
handle('instances:launch', (id, opts) => launch(id, opts));
handle('instances:delete', async (id) => { await shell.trashItem(instDir(id)); return true; });
handle('instances:rename', async (id, name) => { await updateIni(path.join(instDir(id), 'instance.cfg'), { name }); return true; });
handle('instances:notes', async (id, notes) => { await updateIni(path.join(instDir(id), 'instance.cfg'), { notes }); return true; });
handle('instances:ram', async (id, mb) => { await updateIni(path.join(instDir(id), 'instance.cfg'), { OverrideMemory: 'true', MaxMemAlloc: String(mb) }); return true; });
handle('instances:copy', async (id, name) => {
  const P = detectPrism();
  const nid = folderName(P, name);
  await copyDir(instDir(id), path.join(P.instances, nid));
  await updateIni(path.join(P.instances, nid, 'instance.cfg'), { name, lastLaunchTime: '0', totalTimePlayed: '0' });
  return nid;
});
handle('instances:version', async (id, { mc, loader, loaderVersion }) => {
  await fsp.writeFile(path.join(instDir(id), 'mmc-pack.json'), JSON.stringify(components(mc, loader, loaderVersion), null, 4));
  return true;
});
handle('instances:folder', async (id, sub) => {
  let p = instDir(id);
  if (sub) { p = path.join(mcDir(p), sub); await fsp.mkdir(p, { recursive: true }); }
  await shell.openPath(p); return true;
});
handle('instances:worlds', async (id) => {
  const dir = path.join(mcDir(instDir(id)), 'saves');
  let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    const st = await fsp.stat(path.join(dir, e.name)).catch(() => null);
    const icon = path.join(dir, e.name, 'icon.png');
    out.push({ name: e.name, modified: st ? st.mtimeMs : 0, icon: exists(icon) ? 'file:///' + icon.replace(/\\/g, '/') : '' });
  }
  return out.sort((a, b) => b.modified - a.modified);
});
handle('instances:screenshots', async (id) => {
  const dir = path.join(mcDir(instDir(id)), 'screenshots');
  let ents = []; try { ents = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const n of ents) {
    if (!/\.(png|jpe?g)$/i.test(n)) continue;
    const st = await fsp.stat(path.join(dir, n)).catch(() => null);
    out.push({ name: n, modified: st ? st.mtimeMs : 0, url: 'file:///' + path.join(dir, n).replace(/\\/g, '/') });
  }
  return out.sort((a, b) => b.modified - a.modified).slice(0, 120);
});
handle('content:list', (id, type) => listContent(id, type));
handle('content:toggle', async (id, type, file) => {
  const dir = path.join(mcDir(instDir(id)), FOLDERS[type]);
  const to = file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled';
  await fsp.rename(safePath(dir, file), safePath(dir, to));
  return to;
});
handle('content:delete', async (id, type, file) => {
  const dir = path.join(mcDir(instDir(id)), FOLDERS[type]);
  await shell.trashItem(safePath(dir, file));
  const idx = await readIndex(dir);
  const base = file.replace(/\.disabled$/, '');
  if (idx[base]) { delete idx[base]; await writeIndex(dir, idx); }
  return true;
});
handle('content:install', (o) => installContent(o));
handle('content:addFiles', async (id, type) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: type === 'mod' ? 'Моды' : 'Архивы', extensions: type === 'mod' ? ['jar'] : ['zip'] }] });
  if (r.canceled) return 0;
  const dir = path.join(mcDir(instDir(id)), FOLDERS[type]);
  await fsp.mkdir(dir, { recursive: true });
  for (const f of r.filePaths) await fsp.copyFile(f, path.join(dir, path.basename(f)));
  return r.filePaths.length;
});
handle('meta:minecraft', () => minecraftVersions());
handle('meta:loader', (loader, mc) => loaderVersions(loader, mc));
handle('search', (o) => search(o));
handle('modpack:install', (o) => installModpack(o));
handle('modpack:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Модпак', extensions: ['mrpack', 'zip'] }] });
  if (r.canceled) return null;
  const buf = await fsp.readFile(r.filePaths[0]);
  const zip = new AdmZip(buf);
  const name = path.basename(r.filePaths[0]).replace(/\.(mrpack|zip)$/i, '');
  if (zip.getEntry('modrinth.index.json')) return installMrpack(buf, {});
  if (zip.getEntry('manifest.json')) return (await installCursePack(buf, {})).id;
  throw new Error('Не похоже на модпак: ' + name);
});
handle('accounts:list', () => listAccounts());
handle('dialog:file', async (filters) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  return r.canceled ? '' : r.filePaths[0];
});
handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? '' : r.filePaths[0];
});
handle('open:url', (u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); return true; });
handle('file:url', (p) => (p && exists(p) ? 'file:///' + p.replace(/\\/g, '/') : ''));
handle('win:min', () => win.minimize());
handle('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
handle('win:close', () => win.close());

const ctx = {
  handle, detectPrism, instDir, mcDir, readIndex, writeIndex, http, getJson, cf, download, installContent, FOLDERS, progress, log, runPrism,
  AdmZip, readInstance: (P, id) => readInstance(P, id), MODRINTH, CF_LOADER, updateIni, exists, safePath, app, shell, dialog, listInstances,
  getCfg: () => cfg, setCfg: (patch) => { cfg = { ...cfg, ...patch }; saveCfg(cfg); }, getWin: () => win, launch
};
require('./features')(ctx);

function createWindow() {
  const mac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1040, minHeight: 660, show: false,
    ...(mac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 } } : { frame: false }),
    backgroundColor: '#070a12', title: 'Prism Launcher Deluxe',
    icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true, spellcheck: false }
  });
  win.webContents.on('console-message', (_e, level, message, line, source) => { if (level >= 2) log('console', level, message, (source || '') + ':' + line); });
  win.webContents.on('preload-error', (_e, p, err) => log('preload-error', p, err));
  win.webContents.on('render-process-gone', (_e, d) => log('renderer gone', d));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log('fail-load', code, desc, url));
  log('start', process.versions.electron, __dirname);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => { if (cfg.trayOnClose && !ctx.quitting) { e.preventDefault(); win.hide(); win.webContents.send('win:focus', false); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  const focus = (v) => { if (!win.isDestroyed()) win.webContents.send('win:focus', v); };
  win.on('focus', () => focus(true));
  win.on('blur', () => focus(false));
  win.on('minimize', () => focus(false));
  win.on('restore', () => focus(true));
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
}

// аппаратное ускорение отрисовки
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  if (!gotLock) return;
  if (process.platform === 'darwin') {
    // на macOS без меню не работают ⌘C/⌘V/⌘Q
    const { Menu } = require('electron');
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  }
  for (const f of logFiles()) { try { fs.writeFileSync(f, ''); } catch { } }
  cfg = loadCfg();
  createWindow();
  setTimeout(() => ctx.buildTray && ctx.buildTray().catch((e) => log('tray', e)), 1500);
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { ctx.quitting = true; });

module.exports = { parseIni, updateIni, components };
