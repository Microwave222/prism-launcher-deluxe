// Prism Launcher Deluxe — расширенные функции: статус игры, логи, краши, серверы, друзья,
// обновления модов, конфликты, наборы, обложки, группы, бэкапы, экспорт, трей, Discord, автообновление.
'use strict';
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const net = require('net');
const dns = require('dns').promises;
const zlib = require('zlib');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const deflateRaw = promisify(zlib.deflateRaw);
const inflateRaw = promisify(zlib.inflateRaw);

module.exports = function features(ctx) {
  const { handle, detectPrism, instDir, mcDir, readIndex, writeIndex, http, getJson, cf, download, installContent, FOLDERS, progress, log, runPrism, AdmZip, readInstance, MODRINTH, CF_LOADER, updateIni, exists, safePath, app, shell, dialog } = ctx;
  const cfg = () => ctx.getCfg();
  const setCfg = (patch) => ctx.setCfg(patch);
  const send = (ch, d) => { const w = ctx.getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, d); };
  const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

  // ================= ZIP (запись) =================
  const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc32 = zlib.crc32 ? (b) => zlib.crc32(b) >>> 0 : (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  async function writeZip(dest, entries) { // entries: [{name, data?:Buffer, file?:path}]
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const tmp = dest + '.part';
    const fd = await fsp.open(tmp, 'w');
    const central = []; let off = 0;
    const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    try {
      for (const e of entries) {
        const data = e.data || await fsp.readFile(e.file);
        const comp = data.length > 64 ? await deflateRaw(data, { level: 6 }) : null;
        const method = comp && comp.length < data.length ? 8 : 0;
        const body = method ? comp : data;
        const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
        const crc = crc32(data); const now = e.mtime || new Date();
        const h = Buffer.alloc(30);
        h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(method, 8);
        h.writeUInt16LE(dosTime(now), 10); h.writeUInt16LE(dosDate(now), 12); h.writeUInt32LE(crc, 14);
        h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
        await fd.write(h); await fd.write(name); await fd.write(body);
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10);
        c.writeUInt16LE(dosTime(now), 12); c.writeUInt16LE(dosDate(now), 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20);
        c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
        central.push(Buffer.concat([c, name]));
        off += 30 + name.length + body.length;
      }
      const cd = Buffer.concat(central);
      const end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
      end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
      await fd.write(cd); await fd.write(end);
    } finally { await fd.close(); }
    await fsp.rename(tmp, dest);
  }
  async function walk(dir, base = dir, out = []) {
    let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, base, out);
      else if (e.isFile() && e.name !== 'session.lock') out.push({ file: p, name: path.relative(base, p) });
    }
    return out;
  }

  // ================= NBT (servers.dat) =================
  function readNbt(buf) {
    let o = 0;
    const str = () => { const n = buf.readUInt16BE(o); o += 2; const s = buf.slice(o, o + n).toString('utf8'); o += n; return s; };
    const payload = (t) => {
      switch (t) {
        case 1: return buf.readInt8(o++);
        case 2: { const v = buf.readInt16BE(o); o += 2; return v; }
        case 3: { const v = buf.readInt32BE(o); o += 4; return v; }
        case 4: { const v = buf.readBigInt64BE(o); o += 8; return v; }
        case 5: { const v = buf.readFloatBE(o); o += 4; return v; }
        case 6: { const v = buf.readDoubleBE(o); o += 8; return v; }
        case 7: { const n = buf.readInt32BE(o); o += 4; const v = buf.slice(o, o + n); o += n; return v; }
        case 8: return str();
        case 9: { const et = buf.readInt8(o++); const n = buf.readInt32BE(o); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return a; }
        case 10: { const obj = {}; for (;;) { const tt = buf.readInt8(o++); if (tt === 0) break; const k = str(); obj[k] = payload(tt); } return obj; }
        case 11: { const n = buf.readInt32BE(o); o += 4; const a = []; for (let i = 0; i < n; i++) { a.push(buf.readInt32BE(o)); o += 4; } return a; }
        case 12: { const n = buf.readInt32BE(o); o += 4; const a = []; for (let i = 0; i < n; i++) { a.push(buf.readBigInt64BE(o)); o += 8; } return a; }
        default: throw new Error('NBT: тег ' + t);
      }
    };
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    const t = buf.readInt8(o++); if (t !== 10) throw new Error('NBT: нет корня'); str();
    return payload(10);
  }
  function writeServersNbt(servers) {
    const parts = [];
    const b = (n) => { const x = Buffer.alloc(1); x.writeInt8(n); parts.push(x); };
    const s = (v) => { const d = Buffer.from(v, 'utf8'); const l = Buffer.alloc(2); l.writeUInt16BE(d.length); parts.push(l, d); };
    const i32 = (v) => { const x = Buffer.alloc(4); x.writeInt32BE(v); parts.push(x); };
    b(10); s('');
    b(9); s('servers'); b(10); i32(servers.length);
    for (const sv of servers) {
      b(8); s('name'); s(sv.name || 'Minecraft Server');
      b(8); s('ip'); s(sv.ip);
      if (sv.icon) { b(8); s('icon'); s(sv.icon); }
      if (sv.acceptTextures != null) { b(1); s('acceptTextures'); b(sv.acceptTextures); }
      if (sv.hidden != null) { b(1); s('hidden'); b(sv.hidden); }
      b(0);
    }
    b(0);
    return Buffer.concat(parts);
  }
  async function readServers(id) {
    try {
      const n = readNbt(await fsp.readFile(path.join(mcDir(instDir(id)), 'servers.dat')));
      return (n.servers || []).filter((x) => x && x.ip).map((x) => ({ name: x.name || x.ip, ip: x.ip, icon: x.icon || '', acceptTextures: x.acceptTextures, hidden: x.hidden }));
    } catch { return []; }
  }
  async function writeServers(id, list) {
    const f = path.join(mcDir(instDir(id)), 'servers.dat');
    await fsp.mkdir(path.dirname(f), { recursive: true });
    if (exists(f)) await fsp.copyFile(f, f + '_old').catch(() => { });
    await fsp.writeFile(f, writeServersNbt(list));
  }

  // ================= Server List Ping =================
  function varint(n) { const out = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); }
  function readVarint(buf, o) { let v = 0, s = 0, b; do { if (o >= buf.length) return null; b = buf[o++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return [v, o]; }
  function chatText(c) { if (c == null) return ''; if (typeof c === 'string') return c; let s = c.text || ''; if (c.extra) s += c.extra.map(chatText).join(''); return s; }
  async function resolveAddr(addr) {
    let [host, port] = String(addr).trim().split(':');
    port = Number(port) || 0;
    if (!port) {
      try { const r = await dns.resolveSrv('_minecraft._tcp.' + host); if (r && r[0]) return { host: r[0].name, port: r[0].port, shown: host }; } catch { }
      port = 25565;
    }
    return { host, port, shown: host };
  }
  async function ping(addr, timeout = 4500) {
    const { host, port } = await resolveAddr(addr);
    return new Promise((resolve) => {
      const t0 = Date.now(); let buf = Buffer.alloc(0); let done = false;
      const sock = net.connect({ host, port });
      const finish = (r) => { if (done) return; done = true; sock.destroy(); resolve(r); };
      sock.setTimeout(timeout, () => finish({ online: false, error: 'таймаут' }));
      sock.on('error', (e) => finish({ online: false, error: e.code || e.message }));
      sock.on('connect', () => {
        const h = Buffer.from(host, 'utf8');
        const pp = Buffer.alloc(2); pp.writeUInt16BE(port);
        const body = Buffer.concat([varint(0), varint(767), varint(h.length), h, pp, varint(1)]);
        sock.write(Buffer.concat([varint(body.length), body, varint(1), varint(0)]));
      });
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        const a = readVarint(buf, 0); if (!a) return;
        const [len, o1] = a; if (buf.length < o1 + len) return;
        try {
          const [, o2] = readVarint(buf, o1); const [sl, o3] = readVarint(buf, o2);
          const j = JSON.parse(buf.slice(o3, o3 + sl).toString('utf8'));
          finish({
            online: true, ping: Date.now() - t0, version: (j.version && j.version.name) || '',
            players: j.players ? j.players.online : 0, max: j.players ? j.players.max : 0,
            sample: ((j.players && j.players.sample) || []).map((p) => p.name).filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n)),
            motd: chatText(j.description).replace(/§./g, '').trim(), favicon: j.favicon || ''
          });
        } catch (e) { finish({ online: false, error: 'плохой ответ' }); }
      });
    });
  }

  // ================= Процессы игры =================
  const running = new Map(); // id -> {pid, start}
  const pending = new Map(); // id -> время запуска
  let pollTimer = null;
  function listJava() {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' or Name='java.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"],
        { windowsHide: true, timeout: 15000, maxBuffer: 16 << 20 }, (err, out) => {
          if (err || !out.trim()) return resolve([]);
          try { let j = JSON.parse(out); if (!Array.isArray(j)) j = [j]; resolve(j.map((p) => ({ pid: p.ProcessId, cmd: p.CommandLine || '' }))); } catch { resolve([]); }
        });
      } else {
        execFile('ps', ['-eo', 'pid=,args='], { maxBuffer: 16 << 20 }, (err, out) => {
          if (err) return resolve([]);
          resolve(out.split('\n').filter((l) => /java/.test(l)).map((l) => { const m = l.trim().match(/^(\d+)\s+(.*)$/); return m ? { pid: Number(m[1]), cmd: m[2] } : null; }).filter(Boolean));
        });
      }
    });
  }
  function matchInstance(cmd, P) {
    const c = cmd.replace(/\\/g, '/').toLowerCase();
    const base = P.instances.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') + '/';
    const i = c.indexOf(base);
    if (i < 0) return null;
    const rest = cmd.replace(/\\/g, '/').slice(i + base.length);
    return rest.split('/')[0] || null;
  }
  async function poll() {
    const P = detectPrism();
    const procs = await listJava();
    const seen = new Set();
    for (const p of procs) {
      const id = matchInstance(p.cmd, P);
      if (!id) continue;
      seen.add(id);
      if (!running.has(id)) {
        const start = pending.get(id) || Date.now();
        running.set(id, { pid: p.pid, start: Date.now() }); pending.delete(id);
        send('game', { id, state: 'running', start: Date.now(), pid: p.pid });
        discordActivity(id).catch(() => { });
        log('game started', id, p.pid, 'after', Date.now() - start, 'ms');
      }
    }
    for (const [id, r] of running) {
      if (seen.has(id)) continue;
      running.delete(id);
      const duration = Math.round((Date.now() - r.start) / 1000);
      let crash = null;
      try { crash = await analyzeCrash(id, r.start); } catch { }
      send('game', { id, state: 'stopped', duration, crashed: !!(crash && crash.crashed), crash });
      discordActivity(null).catch(() => { });
    }
    for (const [id, t] of pending) if (Date.now() - t > 180000) { pending.delete(id); send('game', { id, state: 'timeout' }); }
    schedule();
  }
  function schedule() {
    clearTimeout(pollTimer);
    const active = running.size || pending.size;
    pollTimer = setTimeout(() => poll().catch((e) => { log('poll', e); schedule(); }), active ? 4000 : 45000);
  }
  ctx.onLaunch = (id) => { pending.set(id, Date.now()); clearTimeout(pollTimer); pollTimer = setTimeout(() => poll().catch(() => schedule()), 3000); };
  setTimeout(() => poll().catch(() => schedule()), 2500);

  handle('game:running', () => [...running].map(([id, r]) => ({ id, start: r.start, pid: r.pid })));
  handle('game:stop', async (id) => {
    const r = running.get(id); if (!r) return false;
    if (process.platform === 'win32') await new Promise((res) => execFile('taskkill', ['/PID', String(r.pid), '/T', '/F'], { windowsHide: true }, () => res()));
    else { try { process.kill(r.pid, 'SIGTERM'); } catch { } }
    setTimeout(() => poll().catch(() => { }), 1500);
    return true;
  });

  // ================= Логи =================
  handle('logs:read', async (id, from = -1) => {
    const f = path.join(mcDir(instDir(id)), 'logs', 'latest.log');
    let st; try { st = await fsp.stat(f); } catch { return { text: '', size: 0, missing: true }; }
    let start = from < 0 || from > st.size ? Math.max(0, st.size - 512 * 1024) : from;
    if (st.size === start) return { text: '', size: st.size };
    const fd = await fsp.open(f, 'r');
    try {
      const len = Math.min(st.size - start, 2 * 1024 * 1024);
      const b = Buffer.alloc(len); await fd.read(b, 0, len, start);
      return { text: b.toString('utf8'), size: start + len, reset: from < 0 || from > st.size };
    } finally { await fd.close(); }
  });
  handle('logs:open', async (id) => { const p = path.join(mcDir(instDir(id)), 'logs'); await fsp.mkdir(p, { recursive: true }); return shell.openPath(p); });

  // ================= Разбор крашей =================
  async function newestIn(dir, after = 0) {
    let names = []; try { names = await fsp.readdir(dir); } catch { return null; }
    let best = null;
    for (const n of names) {
      const p = path.join(dir, n);
      const st = await fsp.stat(p).catch(() => null);
      if (!st || !st.isFile() || st.mtimeMs < after) continue;
      if (!best || st.mtimeMs > best.t) best = { p, t: st.mtimeMs };
    }
    return best;
  }
  async function analyzeCrash(id, since = 0) {
    const root = mcDir(instDir(id));
    const cr = await newestIn(path.join(root, 'crash-reports'), since ? since - 5000 : 0);
    let report = '';
    if (cr) report = (await fsp.readFile(cr.p, 'utf8').catch(() => '')).slice(0, 400000);
    let logText = '';
    try {
      const f = path.join(root, 'logs', 'latest.log');
      const st = await fsp.stat(f);
      if (!since || st.mtimeMs >= since - 5000) {
        const fd = await fsp.open(f, 'r'); const len = Math.min(st.size, 600 * 1024); const b = Buffer.alloc(len);
        await fd.read(b, 0, len, st.size - len); await fd.close(); logText = b.toString('utf8');
      }
    } catch { }
    const all = report + '\n' + logText;
    const crashed = !!report || /---- Minecraft Crash Report ----|Game crashed|Exception in thread "main"|Failed to start the minecraft server|LoadingFailedException|ModLoadingException|Incompatible mods found|Missing or unsupported mandatory dependencies/.test(logText);
    const res = { crashed, file: cr ? cr.p : '', title: '', details: [], suspects: [], fixes: [], missing: [] };
    if (!crashed && !since) { res.title = 'Признаков краша не найдено'; return res; }
    if (!crashed) return res;
    const d = report.match(/^Description: (.+)$/m); if (d) res.details.push(d[1].trim());
    const ex = all.match(/^((?:[a-z_$][\w$]*\.)+[\w$]*(?:Exception|Error)\b[^\r\n]{0,240})/m); if (ex) res.details.push(ex[1].trim());
    let m;
    const reMiss = /Mod ID: '([^']+)', Requested by: '([^']+)', Expected range: '([^']+)', Actual version: '([^']+)'/g;
    while ((m = reMiss.exec(all))) res.missing.push({ mod: m[1], by: m[2], need: m[3], have: m[4] });
    const reFab = /Mod '([^']+)' \(([^)]+)\) [^\s]+ requires (?:version ([^\s]+) (?:or later )?of|any version of|version [^\s]+ or later of) (?:mod )?'?([^'\s,]+(?: [^'\s,()]+)*)'?(?: \(([^)]+)\))?/g;
    while ((m = reFab.exec(all))) res.missing.push({ mod: m[5] || m[4], by: m[1], need: m[3] || 'любая', have: /which is missing|is missing/.test(all.slice(m.index, m.index + 400)) ? 'нет' : 'другая' });
    const susp = all.match(/Suspected Mods?:\s*([^\n]+(?:\n\t+[^\n]+)*)/);
    if (susp) for (const line of susp[1].split('\n')) { const s = line.replace(/^\s+/, '').replace(/,? ?Version:.*$/, '').trim(); if (s && !/^None$/i.test(s) && !/Unknown/.test(s)) res.suspects.push(s); }
    const mix = all.match(/Mixin apply (?:for mod|failed) ([\w\-]+)/) || all.match(/from mod ([\w\-]+)/);
    if (mix && !res.suspects.includes(mix[1])) res.suspects.push(mix[1]);
    if (/UnsupportedClassVersionError|compiled by a more recent version of the Java Runtime/.test(all)) { res.title = 'Не та версия Java'; res.fixes.push({ label: 'Откройте настройки экземпляра в Prism и включите автоматический выбор Java', act: 'prism' }); }
    else if (/OutOfMemoryError|Java heap space/.test(all)) { res.title = 'Игре не хватило памяти'; res.fixes.push({ label: 'Увеличьте память экземпляра до 8–12 ГБ', act: 'ram' }); }
    else if (res.missing.length) { res.title = 'Не хватает модов или нужны другие версии'; res.fixes.push({ label: 'Установите недостающие моды', act: 'missing' }); }
    else if (/Found duplicate mods|Duplicate mods? found|DuplicateModsFoundException/.test(all)) { res.title = 'Одинаковые моды установлены дважды'; res.fixes.push({ label: 'Удалите дубликаты во вкладке «Моды»', act: 'mods' }); }
    else if (/Incompatible mods found|incompatible with/.test(all)) { res.title = 'Несовместимые моды'; res.fixes.push({ label: 'Отключите один из конфликтующих модов', act: 'mods' }); }
    else if (res.suspects.length) { res.title = 'Краш вызвал мод'; res.fixes.push({ label: 'Отключите подозреваемый мод и запустите снова', act: 'mods' }); }
    else if (/GLFW error|OpenGL|Pixel format not accelerated|EXCEPTION_ACCESS_VIOLATION/.test(all)) { res.title = 'Проблема с видеодрайвером'; res.fixes.push({ label: 'Обновите драйвер видеокарты; уберите шейдеры', act: 'none' }); }
    else res.title = 'Игра вылетела';
    // сопоставляем подозреваемых с файлами модов
    try {
      const files = await fsp.readdir(path.join(root, 'mods'));
      res.suspectFiles = [];
      for (const s of res.suspects) {
        const idm = s.match(/\(([\w\-]+)\)/); const key = (idm ? idm[1] : s).toLowerCase().replace(/[^a-z0-9]/g, '');
        const f = files.find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key) && /\.jar$/i.test(x));
        if (f) res.suspectFiles.push(f);
      }
    } catch { }
    res.details = [...new Set(res.details)].slice(0, 4);
    res.suspects = [...new Set(res.suspects)].slice(0, 6);
    return res;
  }
  handle('crash:analyze', (id) => analyzeCrash(id, 0));
  handle('crash:open', (file) => shell.openPath(file));

  // ================= Серверы экземпляра =================
  handle('servers:list', (id) => readServers(id));
  handle('servers:add', async (id, s) => {
    if (!s || !s.ip) throw new Error('Укажите адрес сервера');
    const list = await readServers(id);
    if (list.some((x) => x.ip.toLowerCase() === s.ip.toLowerCase())) throw new Error('Этот сервер уже в списке');
    list.push({ name: s.name || s.ip, ip: s.ip.trim() });
    await writeServers(id, list); return true;
  });
  handle('servers:remove', async (id, ip) => { const list = (await readServers(id)).filter((x) => x.ip !== ip); await writeServers(id, list); return true; });
  handle('servers:ping', (ip) => ping(ip));

  // ================= Друзья =================
  handle('friends:list', () => cfg().friends || []);
  handle('friends:add', async (name) => {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_]{2,16}$/.test(name)) throw new Error('Ник Minecraft: 2–16 символов, латиница, цифры и _');
    const list = cfg().friends || [];
    if (list.some((f) => f.name.toLowerCase() === name.toLowerCase())) throw new Error('Этот друг уже добавлен');
    let uuid = '', real = name;
    try { const r = await getJson('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(name)); uuid = r.id; real = r.name; }
    catch (e) { if (/HTTP 404|HTTP 204/.test(e.message)) throw new Error('Игрок «' + name + '» не найден'); }
    setCfg({ friends: [...list, { name: real, uuid, added: Date.now() }] });
    return true;
  });
  handle('friends:remove', (name) => { setCfg({ friends: (cfg().friends || []).filter((f) => f.name !== name) }); return true; });
  handle('friends:status', async () => {
    const friends = cfg().friends || [];
    const P = detectPrism();
    const servers = new Map();
    for (const s of cfg().extraServers || []) servers.set(s.ip.toLowerCase(), s);
    try {
      for (const id of await fsp.readdir(P.instances)) {
        if (!exists(path.join(P.instances, id, 'instance.cfg'))) continue;
        for (const s of await readServers(id)) if (!servers.has(s.ip.toLowerCase())) servers.set(s.ip.toLowerCase(), s);
      }
    } catch { }
    const list = [...servers.values()].slice(0, 40);
    const results = [];
    let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => { while (i < list.length) { const s = list[i++]; results.push({ s, r: await ping(s.ip, 3500).catch(() => ({ online: false })) }); } }));
    const seen = { ...(cfg().friendSeen || {}) };
    const out = friends.map((f) => {
      const hit = results.find(({ r }) => r.online && r.sample.some((n) => n.toLowerCase() === f.name.toLowerCase()));
      if (hit) seen[f.name] = { t: Date.now(), server: hit.s.name || hit.s.ip };
      return { ...f, online: !!hit, server: hit ? hit.s.name || hit.s.ip : '', ip: hit ? hit.s.ip : '', lastSeen: seen[f.name] || null };
    });
    setCfg({ friendSeen: seen });
    return {
      friends: out, checked: results.filter(({ r }) => r.online).length, total: list.length,
      hidden: results.filter(({ r }) => r.online && r.players > 0 && !r.sample.length).map(({ s }) => s.name || s.ip)
    };
  });
  handle('friends:servers', () => cfg().extraServers || []);
  handle('friends:addServer', (s) => { const l = cfg().extraServers || []; if (!l.some((x) => x.ip === s.ip)) setCfg({ extraServers: [...l, { name: s.name || s.ip, ip: s.ip }] }); return true; });
  handle('friends:removeServer', (ip) => { setCfg({ extraServers: (cfg().extraServers || []).filter((x) => x.ip !== ip) }); return true; });

  // ================= Моды: обновления, конфликты, определение =================
  async function sha1File(p) { return crypto.createHash('sha1').update(await fsp.readFile(p)).digest('hex'); }
  async function modrinthPost(pathq, body) { return getJson(MODRINTH + pathq, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  const scanCache = new Map();
  async function scanMods(id) {
    const inst = await readInstance(detectPrism(), id);
    const dir = path.join(mcDir(instDir(id)), 'mods');
    let names = []; try { names = (await fsp.readdir(dir)).filter((f) => /\.jar(\.disabled)?$/i.test(f)); } catch { }
    const files = [];
    for (const n of names) files.push({ file: n, base: n.replace(/\.disabled$/, ''), enabled: !n.endsWith('.disabled'), sha1: await sha1File(path.join(dir, n)) });
    const key = id + '|' + inst.mc + inst.loader + '|' + files.map((f) => f.sha1).join(',');
    if (scanCache.has(key) && Date.now() - scanCache.get(key).t < 10 * 60e3) return scanCache.get(key).v;
    const hashes = files.map((f) => f.sha1);
    let cur = {}, latest = {};
    if (hashes.length) {
      cur = await modrinthPost('/version_files', { hashes, algorithm: 'sha1' }).catch(() => ({}));
      const lq = { hashes, algorithm: 'sha1' };
      if (inst.loader && inst.loader !== 'vanilla') lq.loaders = [inst.loader];
      if (inst.mc) lq.game_versions = [inst.mc];
      latest = await modrinthPost('/version_files/update', lq).catch(() => ({}));
    }
    const pids = [...new Set(Object.values(cur).map((v) => v.project_id))];
    const projects = {};
    for (let i = 0; i < pids.length; i += 100) {
      const arr = await getJson(MODRINTH + '/projects?ids=' + encodeURIComponent(JSON.stringify(pids.slice(i, i + 100)))).catch(() => []);
      for (const p of arr) projects[p.id] = p;
    }
    const idx = await readIndex(dir);
    let idxChanged = false;
    const updates = [], installed = new Map();
    for (const f of files) {
      const v = cur[f.sha1];
      if (!v) continue;
      const p = projects[v.project_id] || {};
      installed.set(v.project_id, { file: f.file, title: p.title || f.base, version: v, enabled: f.enabled });
      if (!idx[f.base]) { idx[f.base] = { source: 'modrinth', projectId: v.project_id, versionId: v.id, title: p.title || f.base, icon: p.icon_url || '' }; idxChanged = true; }
      const nv = latest[f.sha1];
      if (nv && nv.id !== v.id && new Date(nv.date_published) > new Date(v.date_published)) {
        const nf = nv.files.find((x) => x.primary) || nv.files[0];
        updates.push({ file: f.file, base: f.base, title: p.title || f.base, icon: p.icon_url || '', from: v.version_number, to: nv.version_number, url: nf.url, filename: nf.filename, sha1: nf.hashes.sha1, projectId: v.project_id, versionId: nv.id, enabled: f.enabled, source: 'modrinth' });
      }
    }
    // моды CurseForge из индекса
    for (const [base, info] of Object.entries(idx)) {
      if (info.source !== 'curseforge' || !cfg().curseKey) continue;
      const f = files.find((x) => x.base === base); if (!f) continue;
      try {
        const q = new URLSearchParams({ pageSize: '20' }); if (inst.mc) q.set('gameVersion', inst.mc); if (CF_LOADER[inst.loader]) q.set('modLoaderType', String(CF_LOADER[inst.loader]));
        const r = await cf('/mods/' + info.projectId + '/files?' + q);
        const best = (r.data || []).filter((x) => x.isAvailable !== false && x.downloadUrl).sort((a, b) => (b.fileDate || '').localeCompare(a.fileDate || ''))[0];
        if (best && String(best.id) !== String(info.versionId) && Number(best.id) > Number(info.versionId)) {
          const s1 = (best.hashes || []).find((h) => h.algo === 1);
          updates.push({ file: f.file, base, title: info.title, icon: info.icon, from: base, to: best.displayName || best.fileName, url: best.downloadUrl, filename: best.fileName, sha1: s1 && s1.value, projectId: info.projectId, versionId: String(best.id), enabled: f.enabled, source: 'curseforge' });
        }
      } catch { }
    }
    if (idxChanged) await writeIndex(dir, idx);
    // здоровье: недостающие зависимости, несовместимости, дубли, чужой загрузчик
    const missing = new Map(), conflicts = [], wrongLoader = [], dupes = [];
    const seenP = new Map();
    for (const f of files) { const v = cur[f.sha1]; if (!v) continue; if (seenP.has(v.project_id)) dupes.push([seenP.get(v.project_id), f.file]); else seenP.set(v.project_id, f.file); }
    for (const [pid, it] of installed) {
      if (!it.enabled) continue;
      const v = it.version;
      if (inst.loader && inst.loader !== 'vanilla' && v.loaders && v.loaders.length && !v.loaders.includes(inst.loader) && !(inst.loader === 'quilt' && v.loaders.includes('fabric'))) wrongLoader.push({ title: it.title, file: it.file, loaders: v.loaders });
      for (const d of v.dependencies || []) {
        if (!d.project_id) continue;
        const dep = installed.get(d.project_id);
        if (d.dependency_type === 'required' && (!dep || !dep.enabled)) {
          if (!missing.has(d.project_id)) missing.set(d.project_id, { projectId: d.project_id, by: [] });
          missing.get(d.project_id).by.push(it.title);
        }
        if (d.dependency_type === 'incompatible' && dep && dep.enabled) conflicts.push({ a: it.title, b: dep.title, fileB: dep.file });
      }
    }
    const mids = [...missing.keys()];
    if (mids.length) {
      const arr = await getJson(MODRINTH + '/projects?ids=' + encodeURIComponent(JSON.stringify(mids))).catch(() => []);
      for (const p of arr) if (missing.has(p.id)) Object.assign(missing.get(p.id), { title: p.title, icon: p.icon_url });
    }
    const v = { updates, missing: [...missing.values()], conflicts, wrongLoader, dupes, identified: installed.size, total: files.length };
    scanCache.set(key, { t: Date.now(), v });
    return v;
  }
  handle('mods:scan', (id) => scanMods(id));
  handle('mods:update', async (id, items) => {
    const dir = path.join(mcDir(instDir(id)), 'mods');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bdir = path.join(dir, '.deluxe-backup', stamp);
    await fsp.mkdir(bdir, { recursive: true });
    const idx = await readIndex(dir);
    const done = [];
    let n = 0;
    for (const it of items) {
      progress('update:' + id, { text: 'Обновление: ' + it.title, done: n, total: items.length });
      try {
        const dest = path.join(dir, it.filename + (it.enabled ? '' : '.disabled'));
        const tmpNew = path.join(bdir, '.new-' + it.filename);
        await download(it.url, tmpNew, it.sha1);
        await fsp.rename(path.join(dir, it.file), path.join(bdir, it.file));
        await fsp.rename(tmpNew, dest);
        const old = idx[it.base] || {}; delete idx[it.base];
        idx[it.filename] = { ...old, source: it.source, projectId: it.projectId, versionId: it.versionId, title: it.title, icon: it.icon || old.icon || '' };
        done.push({ title: it.title, from: it.file, to: path.basename(dest) });
      } catch (e) { log('update fail', it.title, e); }
      n++;
    }
    await writeIndex(dir, idx);
    await fsp.writeFile(path.join(bdir, 'batch.json'), JSON.stringify(done));
    progress('update:' + id, { text: 'Обновлено модов: ' + done.length, done: items.length, total: items.length, finished: true });
    scanCache.clear();
    return done;
  });
  handle('mods:rollbackInfo', async (id) => {
    const b = path.join(mcDir(instDir(id)), 'mods', '.deluxe-backup');
    let ds = []; try { ds = (await fsp.readdir(b)).sort().reverse(); } catch { return null; }
    for (const d of ds) { try { const batch = JSON.parse(await fsp.readFile(path.join(b, d, 'batch.json'), 'utf8')); if (batch.length) return { stamp: d, count: batch.length }; } catch { } }
    return null;
  });
  handle('mods:rollback', async (id, stamp) => {
    const dir = path.join(mcDir(instDir(id)), 'mods');
    const bdir = safePath(path.join(dir, '.deluxe-backup'), stamp);
    const batch = JSON.parse(await fsp.readFile(path.join(bdir, 'batch.json'), 'utf8'));
    for (const it of batch) {
      try { await fsp.unlink(path.join(dir, it.to)); } catch { }
      try { await fsp.rename(path.join(bdir, it.from), path.join(dir, it.from)); } catch { }
    }
    await fsp.writeFile(path.join(bdir, 'batch.json'), '[]');
    scanCache.clear();
    return batch.length;
  });

  // ================= Страница проекта =================
  handle('project:get', async (source, pid) => {
    if (source === 'curseforge') {
      const m = (await cf('/mods/' + pid)).data;
      let body = ''; try { body = (await cf('/mods/' + pid + '/description')).data || ''; } catch { }
      const files = ((await cf('/mods/' + pid + '/files?pageSize=50')).data || []).sort((a, b) => (b.fileDate || '').localeCompare(a.fileDate || ''));
      return {
        source, id: String(m.id), title: m.name, desc: m.summary, icon: m.logo && m.logo.thumbnailUrl, downloads: m.downloadCount, author: (m.authors || []).map((a) => a.name).join(', '),
        bodyHtml: body, gallery: (m.screenshots || []).map((s) => ({ url: s.url, title: s.title })), url: m.links && m.links.websiteUrl,
        categories: (m.categories || []).map((c) => c.name), updated: m.dateModified,
        versions: files.map((f) => ({ id: String(f.id), name: f.displayName || f.fileName, number: f.fileName, date: f.fileDate, loaders: (f.gameVersions || []).filter((g) => /forge|fabric|quilt/i.test(g)), game: (f.gameVersions || []).filter((g) => /^\d/.test(g)), type: ['', 'release', 'beta', 'alpha'][f.releaseType] || 'release', downloads: f.downloadCount }))
      };
    }
    const p = await getJson(MODRINTH + '/project/' + encodeURIComponent(pid));
    const vs = await getJson(MODRINTH + '/project/' + encodeURIComponent(pid) + '/version').catch(() => []);
    let team = ''; try { team = (await getJson(MODRINTH + '/project/' + encodeURIComponent(pid) + '/members')).map((m) => m.user.username).slice(0, 3).join(', '); } catch { }
    return {
      source, id: p.id, title: p.title, desc: p.description, icon: p.icon_url, downloads: p.downloads, author: team, body: p.body || '',
      gallery: (p.gallery || []).map((g) => ({ url: g.url, title: g.title })), url: 'https://modrinth.com/' + p.project_type + '/' + p.slug,
      categories: p.categories || [], updated: p.updated, type: p.project_type,
      versions: vs.slice(0, 80).map((v) => ({ id: v.id, name: v.name, number: v.version_number, date: v.date_published, loaders: v.loaders, game: v.game_versions, type: v.version_type, downloads: v.downloads }))
    };
  });
  handle('content:installVersion', async ({ source, type, versionId, projectId, instanceId, title, icon }) => {
    const dir = path.join(mcDir(instDir(instanceId)), FOLDERS[type]);
    await fsp.mkdir(dir, { recursive: true });
    const idx = await readIndex(dir);
    for (const [file, v] of Object.entries(idx)) if (v.source === source && String(v.projectId) === String(projectId)) { for (const f of [file, file + '.disabled']) await fsp.unlink(path.join(dir, f)).catch(() => { }); delete idx[file]; }
    let url, filename, sha1;
    if (source === 'modrinth') { const v = await getJson(MODRINTH + '/version/' + versionId); const f = v.files.find((x) => x.primary) || v.files[0]; url = f.url; filename = f.filename; sha1 = f.hashes.sha1; }
    else { const f = (await cf('/mods/' + projectId + '/files/' + versionId)).data; if (!f.downloadUrl) throw new Error('Автор запретил скачивание через сторонние лаунчеры'); url = f.downloadUrl; filename = f.fileName; const h = (f.hashes || []).find((x) => x.algo === 1); sha1 = h && h.value; }
    await download(url, path.join(dir, filename), sha1);
    idx[filename] = { source, projectId: String(projectId), versionId: String(versionId), title, icon: icon || '' };
    await writeIndex(dir, idx);
    return filename;
  });

  // ================= Наборы модов =================
  const KITS = [
    { id: 'optimize', title: 'Оптимизация', desc: 'Больше FPS и меньше памяти', icon: 'bolt', mods: { fabric: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'modernfix'], quilt: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'modernfix'], neoforge: ['sodium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast'], forge: ['embeddium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast'] } },
    { id: 'shaders', title: 'Шейдеры', desc: 'Iris или Oculus и красивый шейдерпак', icon: 'sun', mods: { fabric: ['sodium', 'iris'], quilt: ['sodium', 'iris'], neoforge: ['sodium', 'iris'], forge: ['embeddium', 'oculus'] }, shaders: ['complementary-reimagined'] },
    { id: 'maps', title: 'Карты', desc: 'Миникарта и карта мира', icon: 'map', mods: { all: ['xaeros-minimap', 'xaeros-world-map'] } },
    { id: 'qol', title: 'Удобство', desc: 'Рецепты, подсказки, сытость', icon: 'star', mods: { fabric: ['jei', 'jade', 'appleskin', 'mouse-tweaks', 'modmenu'], quilt: ['jei', 'jade', 'appleskin', 'mouse-tweaks', 'modmenu'], neoforge: ['jei', 'jade', 'appleskin', 'mouse-tweaks'], forge: ['jei', 'jade', 'appleskin', 'mouse-tweaks'] } }
  ];
  handle('kits:list', () => KITS.map(({ id, title, desc, icon }) => ({ id, title, desc, icon })));
  handle('kits:install', async (instanceId, kitId) => {
    const kit = KITS.find((k) => k.id === kitId); if (!kit) throw new Error('Нет такого набора');
    const inst = await readInstance(detectPrism(), instanceId);
    if (inst.loader === 'vanilla') throw new Error('Наборы модов нужны экземпляру с загрузчиком (Fabric, NeoForge…)');
    const slugs = [...(kit.mods.all || []), ...(kit.mods[inst.loader] || [])];
    const jobs = slugs.map((s) => ({ slug: s, type: 'mod' })).concat((kit.shaders || []).map((s) => ({ slug: s, type: 'shader' })));
    const installed = [], skipped = [];
    let n = 0;
    for (const j of jobs) {
      progress('kit:' + kitId, { text: 'Набор «' + kit.title + '»: ' + j.slug, done: n++, total: jobs.length });
      try {
        const p = await getJson(MODRINTH + '/project/' + j.slug);
        const r = await installContent({ source: 'modrinth', type: j.type, projectId: p.id, instanceId, title: p.title, icon: p.icon_url });
        installed.push(...r);
      } catch (e) { skipped.push(j.slug); }
    }
    progress('kit:' + kitId, { text: 'Набор «' + kit.title + '» установлен', done: jobs.length, total: jobs.length, finished: true });
    scanCache.clear();
    return { installed, skipped };
  });

  // ================= Иконки, обложки, группы, закрепление =================
  handle('instances:setIcon', async (id, file) => {
    const P = detectPrism();
    await fsp.mkdir(P.icons, { recursive: true });
    const key = 'deluxe_' + id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30) + '_' + Date.now().toString(36);
    const ext = (path.extname(file) || '.png').toLowerCase();
    await fsp.copyFile(file, path.join(P.icons, key + ext));
    await updateIni(path.join(instDir(id), 'instance.cfg'), { iconKey: key });
    return key;
  });
  handle('instances:setCover', async (id, file) => {
    const dir = instDir(id);
    for (const e of ['.png', '.jpg', '.jpeg', '.webp']) await fsp.unlink(path.join(dir, '.deluxe-cover' + e)).catch(() => { });
    if (!file) return '';
    const ext = (path.extname(file) || '.png').toLowerCase();
    await fsp.copyFile(file.replace(/^file:\/\/\//, ''), path.join(dir, '.deluxe-cover' + ext));
    return true;
  });
  handle('groups:set', async (id, group) => {
    const P = detectPrism();
    const f = path.join(P.instances, 'instgroups.json');
    let j = { formatVersion: '1', groups: {} };
    try { j = JSON.parse(await fsp.readFile(f, 'utf8')); j.groups = j.groups || {}; } catch { }
    for (const g of Object.values(j.groups)) g.instances = (g.instances || []).filter((x) => x !== id);
    if (group) { j.groups[group] = j.groups[group] || { hidden: false, instances: [] }; j.groups[group].instances.push(id); }
    for (const [k, g] of Object.entries(j.groups)) if (!g.instances.length) delete j.groups[k];
    await fsp.writeFile(f, JSON.stringify(j, null, 4));
    return true;
  });
  handle('instances:pin', (id) => { const p = new Set(cfg().pinned || []); if (p.has(id)) p.delete(id); else p.add(id); setCfg({ pinned: [...p] }); return [...p]; });

  // ================= Бэкапы миров =================
  const bkDir = (id, world) => path.join(instDir(id), '.deluxe-backups', world.replace(/[<>:"/\\|?*]/g, '_'));
  async function backupWorld(id, world) {
    const src = safePath(path.join(mcDir(instDir(id)), 'saves'), world);
    const files = await walk(src);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const dest = path.join(bkDir(id, world), stamp + '.zip');
    await writeZip(dest, files.map((f) => ({ name: f.name, file: f.file })));
    const keep = cfg().backupKeep || 5;
    const all = (await fsp.readdir(bkDir(id, world))).filter((x) => x.endsWith('.zip')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - keep))) await fsp.unlink(path.join(bkDir(id, world), old)).catch(() => { });
    return dest;
  }
  ctx.autoBackup = async (id) => {
    if (!cfg().autoBackup) return;
    const saves = path.join(mcDir(instDir(id)), 'saves');
    let worlds = []; try { worlds = (await fsp.readdir(saves, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return; }
    let n = 0;
    for (const w of worlds) {
      try {
        const lvl = await fsp.stat(path.join(saves, w, 'level.dat'));
        let last = 0; try { const b = (await fsp.readdir(bkDir(id, w))).filter((x) => x.endsWith('.zip')).sort().pop(); if (b) last = (await fsp.stat(path.join(bkDir(id, w), b))).mtimeMs; } catch { }
        if (lvl.mtimeMs <= last) continue;
        progress('backup:' + id, { text: 'Бэкап мира «' + w + '»', done: n, total: worlds.length });
        await backupWorld(id, w);
      } catch (e) { log('backup', w, e); }
      n++;
    }
    progress('backup:' + id, { finished: true });
  };
  handle('worlds:backup', async (id, world) => { progress('backup:' + world, { text: 'Бэкап мира «' + world + '»', done: 0, total: 1 }); const r = await backupWorld(id, world); progress('backup:' + world, { text: 'Бэкап готов', finished: true }); return r; });
  handle('worlds:backups', async (id, world) => {
    let l = []; try { l = (await fsp.readdir(bkDir(id, world))).filter((x) => x.endsWith('.zip')).sort().reverse(); } catch { return []; }
    const out = [];
    for (const n of l) { const st = await fsp.stat(path.join(bkDir(id, world), n)); out.push({ file: n, size: st.size, time: st.mtimeMs }); }
    return out;
  });
  handle('worlds:restore', async (id, world, file) => {
    const saves = path.join(mcDir(instDir(id)), 'saves');
    const target = safePath(saves, world);
    const zipPath = safePath(bkDir(id, world), file);
    if (exists(target)) await shell.trashItem(target);
    const zip = new AdmZip(await fsp.readFile(zipPath));
    for (const e of zip.getEntries()) {
      if (e.isDirectory) continue;
      const dest = safePath(target, e.entryName);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, e.getData());
    }
    return true;
  });
  handle('worlds:delete', async (id, world) => { await shell.trashItem(safePath(path.join(mcDir(instDir(id)), 'saves'), world)); return true; });
  handle('worlds:folder', async (id, world) => shell.openPath(safePath(path.join(mcDir(instDir(id)), 'saves'), world)));

  // ================= Экспорт в .mrpack =================
  handle('instances:export', async (id) => {
    const inst = await readInstance(detectPrism(), id);
    const r = await dialog.showSaveDialog(ctx.getWin(), { defaultPath: path.join(app.getPath('downloads'), inst.name.replace(/[<>:"/\\|?*]/g, '') + '.mrpack'), filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }] });
    if (r.canceled || !r.filePath) return null;
    const root = mcDir(instDir(id));
    progress('export:' + id, { text: 'Экспорт «' + inst.name + '»', done: 0, total: 3 });
    const entries = [], filesIdx = [];
    const items = [];
    for (const [folder, type] of [['mods', 'mod'], ['resourcepacks', 'rp'], ['shaderpacks', 'sp']]) {
      let ns = []; try { ns = await fsp.readdir(path.join(root, folder)); } catch { }
      for (const n of ns) { const p = path.join(root, folder, n); const st = await fsp.stat(p).catch(() => null); if (st && st.isFile() && !n.endsWith('.disabled') && n !== '.deluxe-index.json' && !n.endsWith('.part')) items.push({ folder, n, p, size: st.size }); }
    }
    const hashes = {};
    for (const it of items) { const b = await fsp.readFile(it.p); it.sha1 = crypto.createHash('sha1').update(b).digest('hex'); it.sha512 = crypto.createHash('sha512').update(b).digest('hex'); hashes[it.sha1] = it; }
    let known = {};
    try { if (items.length) known = await modrinthPost('/version_files', { hashes: Object.keys(hashes), algorithm: 'sha1' }); } catch { }
    progress('export:' + id, { text: 'Экспорт «' + inst.name + '»: файлы', done: 1, total: 3 });
    for (const it of items) {
      const v = known[it.sha1];
      const f = v && v.files.find((x) => x.hashes.sha1 === it.sha1);
      if (f) filesIdx.push({ path: it.folder + '/' + it.n, hashes: { sha1: it.sha1, sha512: it.sha512 }, env: { client: 'required', server: it.folder === 'mods' ? 'required' : 'unsupported' }, downloads: [f.url], fileSize: it.size });
      else entries.push({ name: 'overrides/' + it.folder + '/' + it.n, file: it.p });
    }
    for (const extra of ['config', 'kubejs', 'defaultconfigs', 'options.txt', 'servers.dat']) {
      const p = path.join(root, extra);
      if (!exists(p)) continue;
      const st = await fsp.stat(p);
      if (st.isFile()) entries.push({ name: 'overrides/' + extra, file: p });
      else for (const f of await walk(p)) entries.push({ name: 'overrides/' + extra + '/' + f.name.replace(/\\/g, '/'), file: f.file });
    }
    const depKey = { neoforge: 'neoforge', forge: 'forge', fabric: 'fabric-loader', quilt: 'quilt-loader' };
    const deps = { minecraft: inst.mc };
    if (depKey[inst.loader]) deps[depKey[inst.loader]] = inst.loaderVersion;
    const index = { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name: inst.name, summary: inst.notes || 'Экспортировано из Prism Launcher Deluxe', files: filesIdx, dependencies: deps };
    entries.unshift({ name: 'modrinth.index.json', data: Buffer.from(JSON.stringify(index, null, 2)) });
    progress('export:' + id, { text: 'Экспорт «' + inst.name + '»: архив', done: 2, total: 3 });
    await writeZip(r.filePath, entries);
    progress('export:' + id, { text: 'Сборка экспортирована', done: 3, total: 3, finished: true });
    shell.showItemInFolder(r.filePath);
    return { file: r.filePath, linked: filesIdx.length, embedded: entries.length - 1 };
  });

  // ================= Трей =================
  let tray = null;
  async function buildTray() {
    const { Tray, Menu, nativeImage } = require('electron');
    if (!tray) {
      tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 }));
      tray.setToolTip('Prism Launcher Deluxe');
      tray.on('click', () => { const w = ctx.getWin(); if (w) { w.show(); w.focus(); } });
    }
    let recent = [];
    try { recent = (await ctx.listInstances()).instances.slice(0, 6); } catch { }
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть лаунчер', click: () => { const w = ctx.getWin(); if (w) { w.show(); w.focus(); } } },
      { type: 'separator' },
      ...recent.map((i) => ({ label: '▶ ' + i.name, click: () => ctx.launch(i.id) })),
      { type: 'separator' },
      { label: 'Выход', click: () => { ctx.quitting = true; app.quit(); } }
    ]));
  }
  handle('tray:refresh', () => buildTray());
  ctx.buildTray = buildTray;

  // ================= Discord Rich Presence =================
  let rpc = null, rpcReady = false, rpcStart = Date.now();
  function rpcFrame(op, obj) { const d = Buffer.from(JSON.stringify(obj)); const h = Buffer.alloc(8); h.writeInt32LE(op, 0); h.writeInt32LE(d.length, 4); return Buffer.concat([h, d]); }
  function rpcConnect() {
    const id = cfg().discordId;
    if (!id || rpc) return;
    const tryN = (n) => {
      if (n > 9) return;
      const p = process.platform === 'win32' ? '\\\\?\\pipe\\discord-ipc-' + n : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', 'discord-ipc-' + n);
      const s = net.createConnection(p);
      s.once('error', () => { s.destroy(); tryN(n + 1); });
      s.once('connect', () => {
        rpc = s; s.write(rpcFrame(0, { v: 1, client_id: id }));
        s.on('data', () => { if (!rpcReady) { rpcReady = true; discordActivity(null).catch(() => { }); } });
        s.on('close', () => { rpc = null; rpcReady = false; });
        s.on('error', () => { });
      });
    };
    tryN(0);
  }
  async function discordActivity(instanceId) {
    if (!cfg().discordId) { if (rpc) { rpc.destroy(); rpc = null; } return; }
    if (!rpc) { rpcConnect(); return; }
    if (!rpcReady) return;
    let activity;
    if (instanceId) {
      const i = await readInstance(detectPrism(), instanceId);
      rpcStart = Date.now();
      activity = { details: 'Играет: ' + i.name, state: 'Minecraft ' + i.mc + (i.loader !== 'vanilla' ? ' · ' + i.loader : ''), timestamps: { start: Math.floor(rpcStart / 1000) }, assets: { large_image: 'logo', large_text: 'Prism Launcher Deluxe' } };
    } else activity = { details: 'В лаунчере', state: 'Выбирает, во что поиграть', assets: { large_image: 'logo', large_text: 'Prism Launcher Deluxe' } };
    rpc.write(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: crypto.randomUUID() }));
  }
  ctx.discordRefresh = () => { if (rpc) { rpc.destroy(); rpc = null; rpcReady = false; } rpcConnect(); };
  setTimeout(rpcConnect, 3000);
  handle('discord:refresh', () => { ctx.discordRefresh(); return true; });

  // ================= Автообновление лаунчера =================
  const cmpVer = (a, b) => { const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  handle('update:check', async () => {
    const repo = (cfg().updateRepo || 'Microwave222/prism-launcher-deluxe').trim();
    if (!repo) return { configured: false, version: app.getVersion() };
    const rel = await getJson('https://api.github.com/repos/' + repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
    const asset = (rel.assets || []).find((a) => /^app.*\.zip$/i.test(a.name));
    return { configured: true, version: app.getVersion(), latest: rel.tag_name, newer: cmpVer(rel.tag_name, app.getVersion()) > 0 && !!asset, notes: rel.body || '', url: asset && asset.browser_download_url };
  });
  handle('update:install', async (url) => {
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(url)) throw new Error('Недопустимый адрес обновления');
    const tmp = path.join(os.tmpdir(), 'deluxe-update.zip');
    progress('selfupdate', { text: 'Скачиваю обновление лаунчера', done: 0, total: 1 });
    await download(url, tmp);
    const zip = new AdmZip(await fsp.readFile(tmp));
    const target = __dirname;
    for (const e of zip.getEntries()) {
      if (e.isDirectory) continue;
      const name = e.entryName.replace(/^app\//, '');
      if (!/^(main\.js|preload\.js|features\.js|package\.json|renderer\/|assets\/)/.test(name)) continue;
      const dest = safePath(target, name);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, e.getData());
    }
    progress('selfupdate', { text: 'Обновление установлено', done: 1, total: 1, finished: true });
    setTimeout(() => { app.relaunch(); app.exit(0); }, 1200);
    return true;
  });

  // ================= Скины =================
  const skinDir = () => path.join(app.getPath('userData'), 'skins');
  const dataUrl = (buf) => 'data:image/png;base64,' + buf.toString('base64');
  handle('skin:fetch', async (uuid, name) => {
    // официальный профиль Mojang -> текстура скина; запасной вариант — mc-heads
    if (uuid) {
      try {
        const prof = await getJson('https://sessionserver.mojang.com/session/minecraft/profile/' + String(uuid).replace(/-/g, ''));
        const tex = JSON.parse(Buffer.from((prof.properties || []).find((p) => p.name === 'textures').value, 'base64').toString('utf8'));
        const sk = tex.textures && tex.textures.SKIN;
        if (sk && sk.url) {
          const buf = Buffer.from(await (await http(sk.url.replace(/^http:/, 'https:'))).arrayBuffer());
          return { data: dataUrl(buf), slim: !!(sk.metadata && sk.metadata.model === 'slim') };
        }
      } catch (e) { log('skin session', e.message); }
    }
    const buf = Buffer.from(await (await http('https://mc-heads.net/skin/' + encodeURIComponent(uuid || name))).arrayBuffer());
    return { data: dataUrl(buf), slim: false };
  });
  handle('skin:import', async () => {
    const r = await dialog.showOpenDialog(ctx.getWin(), { properties: ['openFile'], filters: [{ name: 'Скин PNG', extensions: ['png'] }] });
    if (r.canceled) return null;
    return { data: dataUrl(await fsp.readFile(r.filePaths[0])), name: path.basename(r.filePaths[0], '.png') };
  });
  const pngBuf = (d) => { const m = String(d).match(/^data:image\/png;base64,(.+)$/); if (!m) throw new Error('Неверное изображение'); return Buffer.from(m[1], 'base64'); };
  handle('skin:export', async (data, name) => {
    const r = await dialog.showSaveDialog(ctx.getWin(), { defaultPath: path.join(app.getPath('downloads'), (name || 'skin').replace(/[<>:"/\\|?*]/g, '') + '.png'), filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (r.canceled || !r.filePath) return null;
    await fsp.writeFile(r.filePath, pngBuf(data));
    shell.showItemInFolder(r.filePath);
    return r.filePath;
  });
  handle('skin:lib:list', async () => {
    let ns = []; try { ns = (await fsp.readdir(skinDir())).filter((n) => n.endsWith('.png')); } catch { return []; }
    const out = [];
    for (const n of ns) { const p = path.join(skinDir(), n); const st = await fsp.stat(p); let meta = {}; try { meta = JSON.parse(await fsp.readFile(p.replace(/\.png$/, '.json'), 'utf8')); } catch { } out.push({ id: n.replace(/\.png$/, ''), name: meta.name || n.replace(/\.png$/, ''), slim: !!meta.slim, time: st.mtimeMs, data: dataUrl(await fsp.readFile(p)) }); }
    return out.sort((a, b) => b.time - a.time);
  });
  handle('skin:lib:save', async (data, name, slim, id) => {
    await fsp.mkdir(skinDir(), { recursive: true });
    id = id && /^[\w-]+$/.test(id) ? id : 'skin_' + Date.now().toString(36);
    await fsp.writeFile(path.join(skinDir(), id + '.png'), pngBuf(data));
    await fsp.writeFile(path.join(skinDir(), id + '.json'), JSON.stringify({ name: name || 'Мой скин', slim: !!slim }));
    return id;
  });
  handle('skin:lib:delete', async (id) => { if (!/^[\w-]+$/.test(id)) return false; for (const e of ['.png', '.json']) await fsp.unlink(path.join(skinDir(), id + e)).catch(() => { }); return true; });

  ctx.ping = ping;
  ctx.readServers = readServers;
  ctx.writeZip = writeZip;
};
