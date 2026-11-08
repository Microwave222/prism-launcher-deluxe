'use strict';
window.addEventListener('error', (e) => { console.error('JS error: ' + e.message + ' @' + e.filename + ':' + e.lineno); });
window.addEventListener('unhandledrejection', (e) => { console.error('Promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
console.log('app.js loaded, api=' + typeof window.api);
/* Prism Launcher Deluxe — интерфейс */
// window.api — мост из preload.js (глобальная переменная api)
const call = (...a) => api.call(...a);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  compass: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  user: 'M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  gear: 'M4 6h9M19 6h1M16 4a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM4 12h3M13 12h7M10 10a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM4 18h11M17 16a2 2 0 1 1 0 4a2 2 0 1 1 0-4z',
  play: 'M8 5.5v13l11-6.5z',
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  search: 'M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14zM20 20l-3.5-3.5',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  box: 'M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  globe: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  users: 'M9 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM2 20c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .7 3.3 2.4 4 5',
  terminal: 'M4 5h16v14H4zM8 10l3 2-3 2M13 15h4',
  stop: 'M7 6h10v12H7z',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  update: 'M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  sun: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  play2: 'M8 5.5v13l11-6.5z'
};
const svg = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
const svgFill = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

const LOADERS = [['vanilla', 'Vanilla'], ['fabric', 'Fabric'], ['quilt', 'Quilt'], ['forge', 'Forge'], ['neoforge', 'NeoForge']];
const LOADER_NAME = Object.fromEntries(LOADERS);
const LOADER_COLOR = { vanilla: '#9be7a8', fabric: '#f3d9a4', quilt: '#c9a5ff', forge: '#8fb7ff', neoforge: '#ffb27a' };
const TYPES = [['mod', 'Моды'], ['modpack', 'Модпаки'], ['resourcepack', 'Ресурспаки'], ['shader', 'Шейдеры']];
const NAV = [['home', 'Главная', 'home'], ['instances', 'Экземпляры', 'grid'], ['browse', 'Обзор', 'compass'], ['friends', 'Друзья', 'users'], ['accounts', 'Профиль', 'user'], ['settings', 'Настройки', 'gear']];
const SWATCHES = [['#5AC8FA', 'Голубой'], ['#0A84FF', 'Синий'], ['#BF5AF2', 'Фиолетовый'], ['#FF6482', 'Розовый'], ['#FFB340', 'Янтарный'], ['#63E6BE', 'Мятный']];

const S = {
  page: 'home', cfg: {}, prism: {}, instances: [], accounts: [], inst: null, tab: 'mod',
  content: [], contentFilter: '', worlds: [], shots: [], instFilter: '',
  browse: { source: 'modrinth', type: 'mod', query: '', sort: 'relevance', target: '', hits: [], total: 0, offset: 0, loading: false, error: '' },
  installing: {}, installed: {}, launching: {}, mcVersions: null, tasks: {}
};

// ---------- утилиты ----------
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function tint(s) { const hues = ['#5AC8FA', '#9BE7A8', '#FFB340', '#BF9BFF', '#FF9AA8', '#7FE0D3', '#FFE38A', '#A9C4FF']; return hues[hash(s) % hues.length]; }
function iconBox(src, name, size = 56, radius) {
  const r = radius != null ? radius : Math.round(size * .3);
  const letter = esc(((name || '?').trim()[0] || '?').toUpperCase());
  return `<span class="icon-box" style="position:relative;width:${size}px;height:${size}px;border-radius:${r}px;font-size:${Math.round(size * .4)}px;background:${tint(name)}">${letter}${src ? `<img src="${esc(src)}" alt="" loading="lazy" style="position:absolute;inset:0">` : ''}</span>`;
}
function fmtNum(n) { if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' млн'; if (n >= 1e3) return Math.round(n / 1e3) + ' тыс'; return String(n); }
function fmtPlayed(sec) { if (!sec) return 'ещё не играли'; const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h} ч ${m} мин` : `${m} мин`; }
function fmtAgo(ms) {
  if (!ms) return 'никогда';
  const d = (Date.now() - ms) / 1000;
  if (d < 90) return 'только что'; if (d < 3600) return Math.round(d / 60) + ' мин назад'; if (d < 86400) return Math.round(d / 3600) + ' ч назад';
  if (d < 86400 * 30) return Math.round(d / 86400) + ' дн назад';
  return new Date(ms).toLocaleDateString('ru-RU');
}
function fmtSize(b) { if (b > 1048576) return (b / 1048576).toFixed(1).replace('.', ',') + ' МБ'; return Math.max(1, Math.round(b / 1024)) + ' КБ'; }
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(', '); }
function verText(i) { return i.mc ? (i.mc + (i.loader !== 'vanilla' ? ' · ' + LOADER_NAME[i.loader] : '')) : 'версия не указана'; }
function instById(id) { return S.instances.find((i) => i.id === id); }
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; }
function accountName() { const a = S.accounts.find((x) => x.name === S.cfg.account) || S.accounts.find((x) => x.active) || S.accounts[0]; return a ? a.name : ''; }
function avatar(a, size = 64) { return a && a.uuid ? `https://mc-heads.net/avatar/${encodeURIComponent(a.uuid)}/${size}` : ''; }

// ---------- уведомления ----------
function toast(text, error) {
  sfx(error ? 'error' : 'ok');
  const el = document.createElement('div');
  el.className = 'toast glass' + (error ? ' error' : '');
  el.innerHTML = `<span class="ic">${svg(error ? 'x' : 'check', 15, 2.8)}</span><span>${esc(text)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, error ? 5200 : 2800);
}
async function attempt(fn, okText) {
  try { const r = await fn(); if (okText) toast(okText); return r; } catch (e) { toast(e.message || String(e), true); return undefined; }
}

// ---------- задачи (прогресс загрузок) ----------
api.on('progress', (d) => {
  if (!d || !d.task) return;
  let el = $(`#tasks [data-task="${CSS.escape(d.task)}"]`);
  if (!el && d.finished) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'task glass'; el.dataset.task = d.task;
    el.innerHTML = '<div class="t"><span class="tt"></span><span class="tc dim"></span></div><div class="bar"><i></i></div>';
    $('#tasks').appendChild(el);
  }
  if (d.text) $('.tt', el).textContent = d.text;
  const total = d.total || 0, done = d.done || 0;
  $('.tc', el).textContent = total > 1 ? `${done} / ${total}` : '';
  $('.bar i', el).style.width = (total ? Math.min(100, Math.round(done / total * 100)) : 8) + '%';
  if (d.finished) { $('.bar i', el).style.width = '100%'; setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, 1200); }
});
api.on('toast', (d) => toast(d.text, d.error));

// ---------- оверлей: окна и меню ----------
function showSheet(html, onClose) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="sheet glass" role="dialog" aria-modal="true">${html}</div>`;
  ov.classList.add('show');
  ov.onclick = (e) => { if (e.target === ov) closeSheet(); };
  S.sheetClose = onClose;
  setTimeout(() => { const f = $('.sheet input, .sheet select', ov); if (f) f.focus(); }, 80);
  afterRender();
}
function updateSheet(html) { const sh = $('#overlay .sheet'); if (sh) { sh.innerHTML = html; afterRender(); } }
function closeSheet() { const ov = $('#overlay'); ov.classList.remove('show'); ov.innerHTML = ''; S.create = null; const f = S.sheetClose; S.sheetClose = null; if (f) f(); }
function promptSheet(title, label, value, okText) {
  return new Promise((res) => {
    let done = false;
    showSheet(`<h2>${esc(title)}</h2><label class="lbl">${esc(label)}<input class="input" id="promptVal" value="${esc(value || '')}"></label>
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Отмена</button><button class="btn primary spring" data-act="sheet:ok">${esc(okText || 'Готово')}</button></div>`,
      () => { if (!done) res(null); });
    S.sheetOk = () => { done = true; const v = $('#promptVal').value.trim(); closeSheet(); res(v || null); };
  });
}
function confirmSheet(title, text, okText, danger) {
  return new Promise((res) => {
    let done = false;
    showSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin:0;font-size:15px;line-height:1.5">${esc(text)}</p>
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Отмена</button><button class="btn ${danger ? 'danger' : 'primary'} spring" data-act="sheet:ok">${esc(okText)}</button></div>`,
      () => { if (!done) res(false); });
    S.sheetOk = () => { done = true; closeSheet(); res(true); };
  });
}
function showMenu(anchor, items) {
  closeMenu();
  const r = anchor.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'menu glass'; m.id = 'menu';
  m.innerHTML = items.map((it, i) => `<button data-mi="${i}" class="${it.red ? 'red' : ''}">${svg(it.icon, 17)}<span>${esc(it.label)}</span></button>`).join('');
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 10 > window.innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
  m.style.transformOrigin = 'top right';
  m.onclick = (e) => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = items[+b.dataset.mi]; closeMenu(); it.run(); };
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}
function closeMenu() { const m = $('#menu'); if (m) m.remove(); }

// ---------- данные ----------
async function loadInstances() {
  const r = await call('instances:list');
  S.prism = r.prism; S.instances = r.instances;
}
async function loadAccounts() { S.accounts = await call('accounts:list').catch(() => []); }
async function refresh(noAnim) { await attempt(async () => { await loadInstances(); await loadAccounts(); }); render(noAnim); }

// ---------- оформление ----------
const BACKGROUNDS = [['liquid', 'Жидкость'], ['aurora', 'Северное сияние'], ['nebula', 'Космос'], ['waves', 'Волны'], ['silk', 'Шёлк'], ['mesh', 'Градиент'], ['bokeh', 'Боке'], ['solar', 'Солнечная система'], ['multiverse', 'Мультивселенная'], ['blackhole', 'Чёрная дыра'], ['matrix', 'Матрица'], ['underwater', 'Подводный мир'], ['pixel', 'Пиксельный мир'], ['blobs', 'Облака'], ['image', 'Своя картинка']];
function applyTheme() {
  const c = S.cfg, root = document.documentElement.style;
  root.setProperty('--accent', c.accent || '#5AC8FA');
  root.setProperty('--accent-rgb', hexRgb(c.accent || '#5AC8FA'));
  root.setProperty('--ga', String((c.glassOpacity != null ? c.glassOpacity : 46) / 100));
  root.setProperty('--blur', (c.glassBlur != null ? c.glassBlur : 30) + 'px');
  document.body.classList.toggle('reduce', c.animations === false);
  applyBg();
}
let bgKey = '';
async function applyBg() {
  const c = S.cfg, bg = $('#bg');
  const mode = c.background === 'aurora-css' ? 'blobs' : (c.background || 'liquid');
  const key = [mode, c.accent, c.bgSpeed, c.animations, c.backgroundImage, c.bgQuality].join('|');
  if (key === bgKey) return;
  bgKey = key;
  const old = $('img', bg); if (old) old.remove();
  const shader = window.BG && window.BG.names.includes(mode);
  if (window.BG) window.BG.set(shader ? mode : '', { accent: c.accent, speed: c.bgSpeed || 1, still: c.animations === false, quality: c.bgQuality || 'auto' });
  $$('.blob', bg).forEach((b) => (b.style.display = mode === 'blobs' ? '' : 'none'));
  $('.shade', bg).style.opacity = shader ? '.35' : '1';
  if (mode === 'image' && c.backgroundImage) {
    const url = await call('file:url', c.backgroundImage).catch(() => '');
    if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; bg.insertBefore(img, $('.shade', bg)); }
  } else if (mode === 'image' || (!shader && mode !== 'blobs')) {
    $$('.blob', bg).forEach((b) => (b.style.display = ''));
  }
}
const THUMB_VER = 'v4';
function bgThumbKey(name) { return 'thumb:' + THUMB_VER + ':' + name + ':' + S.cfg.accent; }
function bgThumb(name) { try { return localStorage.getItem(bgThumbKey(name)) || ''; } catch { return ''; } }
function fillThumbs() {
  const imgs = $$('.bg-tile img[data-thumb]').filter((i) => !i.getAttribute('src'));
  const next = () => {
    const img = imgs.shift(); if (!img || !img.isConnected || !window.BG) return;
    const url = window.BG.snapshot(img.dataset.thumb, 176, 110, S.cfg.accent);
    if (url) { img.src = url; try { localStorage.setItem(bgThumbKey(img.dataset.thumb), url); } catch { } }
    setTimeout(() => (window.requestIdleCallback || setTimeout)(next, { timeout: 2000 }), 120);
  };
  setTimeout(next, 400);
}
async function setCfg(patch) { S.cfg = await call('config:set', patch); applyTheme(); }

// ---------- отрисовка ----------
function render(noAnim) {
  const navPage = { instance: 'instances', project: 'browse', skineditor: 'accounts' }[S.page] || S.page;
  $('#nav').innerHTML = '<div class="ind"></div>' + NAV.map(([id, label, ic]) =>
    `<button class="spring ${navPage === id ? 'on' : ''}" data-act="go" data-page="${id}" aria-label="${label}" ${navPage === id ? 'aria-current="page"' : ''}>${svg(ic, 24, 1.9)}<span class="tip">${label}</span></button>`).join('');
  const idx = NAV.findIndex((n) => n[0] === navPage);
  $('#nav .ind').style.transform = `translateY(${idx * 64}px)`;
  const acc = S.accounts.find((x) => x.name === accountName());
  $('#accBtn').innerHTML = acc && acc.uuid ? `<img src="${esc(avatar(acc, 64))}" alt="">` : esc((accountName() || '+')[0].toUpperCase());
  const html = (PAGES[S.page] || PAGES.home)();
  $('#main').innerHTML = `<div class="${noAnim ? '' : 'page'}">${html}</div>`;
  if (!noAnim) $('#main').scrollTop = 0;
  afterRender();
}
function afterRender() {
  for (const g of $$('.seg, .tabs')) {
    const on = $('button.on', g), ind = $('.seg-ind, .tab-ind', g);
    if (on && ind) { ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; }
  }
  for (const r of $$('input[type=range]')) setRangeFill(r);
  if ($('.bg-tile img[data-thumb]:not([src])')) fillThumbs();
}
function setRangeFill(r) { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); }
function rerenderMain() { const y = $('#main').scrollTop; render(true); $('#main').scrollTop = y; }

function prismWarning() {
  if (S.prism && S.prism.exe) return '';
  return `<div class="warn glass" style="margin-bottom:20px"><span class="ic">${svg('warn', 22)}</span>
    <div class="grow"><div style="font-weight:700;font-size:15px">Prism Launcher не найден</div><div class="muted" style="margin-top:3px">Через Prism идут вход в аккаунт и запуск игры. Установите его или укажите путь к prismlauncher.exe.</div></div>
    <button class="btn glass light spring" data-act="url" data-url="https://prismlauncher.org/download/">Скачать Prism</button>
    <button class="btn primary spring" data-act="pick:prism">Указать путь</button></div>`;
}

function instCard(i) {
  const launching = S.launching[i.id];
  const run = S.running && S.running[i.id];
  return `<div class="inst glass ${i.cover ? 'has-cover' : ''} ${run ? 'is-running' : ''}" role="button" tabindex="0" data-act="open" data-id="${esc(i.id)}">
    ${i.cover ? `<div class="cover" style="background-image:url('${esc(i.cover)}')"></div>` : ''}
    ${run ? `<span class="run-badge"><i></i>В игре · <span data-timer="${run.start}"></span></span>` : i.pinned ? `<span class="pin-badge">${svg('pin', 13, 2.4)}</span>` : ''}
    <div class="top">${iconBox(i.icon, i.name, 58)}
      <div class="row quick">
        <button class="btn small icon glass light spring" data-act="instmenu" data-id="${esc(i.id)}" aria-label="Действия">${svg('more', 18, 3)}</button>
        <button class="btn small icon ${run ? 'danger' : 'primary'} spring ${launching ? 'launching' : ''}" data-act="play" data-id="${esc(i.id)}" aria-label="${run ? 'Остановить' : 'Играть'}">${launching ? '<span class="spinner"></span>' : svgFill(run ? 'stop' : 'play', 16)}</button>
      </div></div>
    <div><div class="name">${esc(i.name)}</div><div class="meta" style="margin-top:4px">${esc(verText(i))}</div></div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <span class="chip"><span class="dot" style="background:${LOADER_COLOR[i.loader] || '#ccc'}"></span>${esc(LOADER_NAME[i.loader] || i.loader)}</span>
      ${i.modCount ? `<span class="chip">${i.modCount} модов</span>` : ''}
      <span class="chip">${esc(fmtAgo(i.lastLaunch))}</span>
    </div></div>`;
}

const PAGES = {
  home() {
    const last = instById(S.cfg.lastInstance) || S.instances[0];
    const name = accountName();
    let hero = '';
    if (last) {
      const l = S.launching[last.id];
      hero = `<div class="hero glass"><div class="glow"></div>${iconBox(last.icon, last.name, 112, 30)}
        <div class="grow"><div class="dim" style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Продолжить игру</div>
        <h2 style="margin-top:6px">${esc(last.name)}</h2>
        <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px"><span class="chip"><span class="dot" style="background:${LOADER_COLOR[last.loader]}"></span>${esc(verText(last))}</span>
        <span class="chip">Наиграно: ${esc(fmtPlayed(last.played))}</span>${last.modCount ? `<span class="chip">${last.modCount} модов</span>` : ''}</div></div>
        ${playBtn(last)}</div>`;
    } else {
      hero = `<div class="hero glass"><div class="glow"></div><span class="icon-box" style="width:112px;height:112px;border-radius:30px;background:rgba(var(--accent-rgb),.9)">${svg('box', 52, 1.6)}</span>
        <div class="grow"><h2>Создайте первый экземпляр</h2><p class="muted" style="font-size:15px;margin:8px 0 0">Выберите версию Minecraft и загрузчик модов или установите готовый модпак.</p></div>
        <button class="play-btn" data-act="create"><span class="shine"></span>${svg('plus', 22, 2.6)}<span>Создать</span></button></div>`;
    }
    const recent = S.instances.filter((i) => !last || i.id !== last.id).slice(0, 6);
    return `${prismWarning()}<div class="page-head"><div><h1>${greeting()}${name ? ', ' + esc(name) : ''}</h1><p>${S.instances.length ? `${S.instances.length} ${plural(S.instances.length, 'экземпляр', 'экземпляра', 'экземпляров')} в Prism` : 'Добро пожаловать в Prism Launcher Deluxe'}</p></div></div>
      ${hero}
      <div class="section-title">Быстрые действия</div>
      <div class="grid stagger">
        ${quick('plus', 'Новый экземпляр', 'Любая версия и загрузчик', 'create')}
        ${quick('box', 'Найти модпак', 'Modrinth и CurseForge', 'go', 'browse', 'modpack')}
        ${quick('compass', 'Моды', 'Поиск и установка', 'go', 'browse', 'mod')}
        ${quick('file', 'Импорт', '.mrpack или .zip CurseForge', 'import')}
      </div>
      ${recent.length ? `<div class="section-title">Недавние</div><div class="grid stagger">${recent.map(instCard).join('')}</div>` : ''}`;
  },

  instances() {
    const f = S.instFilter.toLowerCase();
    const list = S.instances.filter((i) => !f || i.name.toLowerCase().includes(f) || (i.mc || '').includes(f) || (i.loader || '').includes(f));
    return `${prismWarning()}<div class="page-head"><div><h1>Экземпляры</h1><p>Общие с Prism Launcher: всё, что вы создаёте здесь, видно и там.</p></div>
      <div class="row"><label class="field glass" style="width:260px">${svg('search', 18)}<input data-input="instFilter" placeholder="Поиск" value="${esc(S.instFilter)}" aria-label="Поиск экземпляров"></label>
      <button class="btn glass light spring" data-act="import">${svg('file', 18)}Импорт</button>
      <button class="btn primary spring" data-act="create">${svg('plus', 18, 2.6)}Создать</button></div></div>
      <div class="grid stagger">${list.map(instCard).join('')}
      <button class="new-card spring" data-act="create">${svg('plus', 30, 2)}<span>Новый экземпляр</span></button></div>`;
  },

  instance() {
    const i = instById(S.inst);
    if (!i) { S.page = 'instances'; return PAGES.instances(); }
    const l = S.launching[i.id];
    const tabs = [['mod', 'Моды'], ['resourcepack', 'Ресурспаки'], ['shader', 'Шейдеры'], ['worlds', 'Миры'], ['servers', 'Серверы'], ['shots', 'Скриншоты'], ['settings', 'Настройки']];
    return `<div class="row" style="margin:14px 0 18px"><button class="btn small glass light spring" data-act="go" data-page="instances">${svg('back', 16, 2.4)}Экземпляры</button></div>
      <div class="hero glass"><div class="glow"></div>${iconBox(i.icon, i.name, 96, 28)}
        <div class="grow"><h2>${esc(i.name)}</h2>
        <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px"><span class="chip"><span class="dot" style="background:${LOADER_COLOR[i.loader]}"></span>${esc(verText(i))}${i.loaderVersion ? ' ' + esc(i.loaderVersion) : ''}</span>
        <span class="chip">Наиграно: ${esc(fmtPlayed(i.played))}</span><span class="chip">Запуск: ${esc(fmtAgo(i.lastLaunch))}</span>${i.pack ? `<span class="chip">Модпак: ${esc(i.pack)}</span>` : ''}</div></div>
        <div class="row"><button class="btn icon glass light spring" data-act="logs" data-id="${esc(i.id)}" aria-label="Логи игры" title="Логи игры">${svg('terminal', 19)}</button><button class="btn icon glass light spring" data-act="folder" data-id="${esc(i.id)}" aria-label="Открыть папку">${svg('folder', 19)}</button>
        <button class="btn icon glass light spring" data-act="instmenu" data-id="${esc(i.id)}" aria-label="Действия">${svg('more', 19, 3)}</button>
        ${playBtn(i)}</div></div>
      <div class="tabs glass" style="margin:22px 0 18px"><span class="tab-ind"></span>${tabs.map(([k, t]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${t}</button>`).join('')}</div>
      <div id="tabBody">${tabBody(i)}</div>`;
  },

  browse() {
    const B = S.browse;
    const target = instById(B.target);
    const isPack = B.type === 'modpack';
    const hint = isPack ? 'Модпак установится как новый экземпляр' : target ? `Установка в «${target.name}» · ${verText(target)}` : 'Выберите экземпляр, чтобы фильтровать по версии и устанавливать';
    return `<div class="page-head"><div><h1>Обзор</h1><p>${esc(hint)}</p></div>
      <div class="seg glass"><span class="seg-ind"></span>
        <button class="${B.source === 'modrinth' ? 'on' : ''}" data-act="bsource" data-v="modrinth">Modrinth</button>
        <button class="${B.source === 'curseforge' ? 'on' : ''}" data-act="bsource" data-v="curseforge">CurseForge</button></div></div>
      <div class="row" style="flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div class="seg glass"><span class="seg-ind"></span>${TYPES.map(([k, t]) => `<button class="${B.type === k ? 'on' : ''}" data-act="btype" data-v="${k}">${t}</button>`).join('')}</div>
        <label class="field glass grow" style="min-width:240px">${svg('search', 18)}<input id="bq" data-input="bquery" placeholder="Поиск на ${B.source === 'modrinth' ? 'Modrinth' : 'CurseForge'}" value="${esc(B.query)}" aria-label="Поиск"></label>
        ${isPack ? '' : `<select class="input glass" style="width:230px;height:46px;border-radius:99px" data-change="btarget" aria-label="Экземпляр"><option value="">Без экземпляра</option>${S.instances.map((i) => `<option value="${esc(i.id)}" ${B.target === i.id ? 'selected' : ''}>${esc(i.name)} · ${esc(verText(i))}</option>`).join('')}</select>`}
        <select class="input glass" style="width:170px;height:46px;border-radius:99px" data-change="bsort" aria-label="Сортировка"><option value="relevance" ${B.sort === 'relevance' ? 'selected' : ''}>По релевантности</option><option value="downloads" ${B.sort === 'downloads' ? 'selected' : ''}>По загрузкам</option></select>
      </div>
      <div id="results">${resultsHtml()}</div>`;
  },

  accounts() {
    const cur = accountName();
    return `${prismWarning()}<div class="page-head"><div><h1>Аккаунты</h1><p>Вход через Microsoft выполняет Prism Launcher. Здесь можно выбрать, каким аккаунтом запускать игру.</p></div>
      <button class="btn primary spring" data-act="prism:accounts">${svg('plus', 18, 2.6)}Добавить в Prism</button></div>
      ${S.accounts.length ? `<div class="grid wide stagger">${S.accounts.map((a) => `<div class="panel glass" style="flex-direction:row;align-items:center">
        <span class="icon-box" style="width:64px;height:64px;border-radius:18px;background:${tint(a.name)};font-size:26px">${esc(a.name[0] || '?')}${a.uuid ? `<span style="position:absolute;inset:0;display:block"><img src="${esc(avatar(a, 64))}" alt=""></span>` : ''}</span>
        <div class="grow"><div style="font-size:18px;font-weight:700">${esc(a.name)}</div><div class="muted" style="margin-top:3px">${a.type === 'MSA' ? 'Microsoft' : esc(a.type)}${a.active ? ' · по умолчанию в Prism' : ''}</div></div>
        ${cur === a.name ? `<span class="chip" style="background:rgba(var(--accent-rgb),.25)">${svg('check', 14, 3)}Для запуска</span>` : `<button class="btn small glass light spring" data-act="useacc" data-name="${esc(a.name)}">Использовать</button>`}
        </div>`).join('')}</div>`
        : `<div class="list glass"><div class="empty">${svg('user', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Аккаунтов пока нет</div><div style="margin-top:6px">Нажмите «Добавить в Prism», войдите через Microsoft и вернитесь сюда.</div></div></div>`}`;
  },

  settings() {
    const c = S.cfg, P = S.prism || {};
    const ramGb = (c.defaultRam || 4096) / 1024;
    return `<div class="page-head"><div><h1>Настройки</h1><p>Prism Launcher Deluxe 1.0</p></div></div>
      <div class="cols stagger">
      <div class="panel glass"><h3>Prism Launcher</h3>
        <label class="lbl">Программа prismlauncher.exe<div class="row"><input class="input" data-change="cfg:prismExe" value="${esc(c.prismExe || '')}" placeholder="${esc(P.exe || 'Не найдена')}"><button class="btn glass light spring" data-act="pick:prism">Обзор</button></div></label>
        <label class="lbl">Папка данных Prism<div class="row"><input class="input" data-change="cfg:prismData" value="${esc(c.prismData || '')}" placeholder="${esc(P.data || '')}"><button class="btn glass light spring" data-act="pick:data">Обзор</button></div></label>
        <div class="set-row"><div><div class="t">Состояние</div><div class="s">${P.exe ? 'Prism найден' : 'Prism не найден'} · экземпляры: ${esc(P.instances || '—')}</div></div><button class="btn small glass light spring" data-act="refresh">${svg('refresh', 15, 2.4)}Обновить</button></div>
      </div>
      <div class="panel glass"><h3>Игра</h3>
        <div class="set-row"><div class="t">Память для новых экземпляров</div><span class="chip" id="ramChip">${ramGb} ГБ</span></div>
        <input type="range" min="2" max="32" step="1" value="${ramGb}" data-input="defaultRam" data-change="defaultRamSave" aria-label="Память, ГБ">
        <div class="sep"></div>
        ${switchRow('Сворачивать лаунчер при запуске', 'Освобождает ресурсы для игры', 'closeOnLaunch', c.closeOnLaunch)}
      </div>
      <div class="panel glass"><h3>CurseForge</h3>
        <div class="muted" style="line-height:1.5">Для поиска на CurseForge нужен бесплатный API-ключ. Получите его на console.curseforge.com и вставьте сюда.</div>
        <div class="row"><input class="input" type="password" data-change="cfg:curseKey" value="${esc(c.curseKey || '')}" placeholder="API-ключ" aria-label="API-ключ CurseForge"><button class="btn glass light spring" data-act="url" data-url="https://console.curseforge.com/">Получить</button></div>
      </div>
      <div class="panel glass"><h3>Оформление</h3>
        <div class="set-row"><div class="t">Цвет акцента</div><div class="row">${SWATCHES.map(([h, n]) => `<button class="swatch ${String(c.accent).toLowerCase() === h.toLowerCase() ? 'on' : ''}" style="background:${h}" data-act="accent" data-v="${h}" aria-label="${n}"></button>`).join('')}</div></div>
        <div class="t" style="font-size:15px;font-weight:600">Фон</div>
        <div class="bg-grid">${BACKGROUNDS.map(([k, n]) => `<button class="bg-tile ${(c.background || 'liquid') === k ? 'on' : ''}" data-act="bgmode" data-v="${k}" aria-label="${n}">${k === 'blobs' ? '<i class="css-prev"></i>' : k === 'image' ? `<i class="css-prev" style="filter:blur(14px) grayscale(.4)"></i>` : `<img ${bgThumb(k) ? `src="${bgThumb(k)}"` : ''} data-thumb="${k}" alt="">`}<span>${n}</span></button>`).join('')}</div>
        ${c.background === 'image' ? `<div class="row"><input class="input" readonly value="${esc(c.backgroundImage || '')}" placeholder="Картинка не выбрана"><button class="btn glass light spring" data-act="pick:bg">Выбрать</button></div>` : ''}
        <div class="set-row"><div><div class="t">Качество фона</div><div class="s">«Авто» само снижает разрешение, если компьютер не тянет</div></div><div class="seg glass light"><span class="seg-ind"></span>${[['eco', 'Эконом'], ['auto', 'Авто'], ['high', 'Высокое']].map(([k, n]) => `<button class="${(c.bgQuality || 'auto') === k ? 'on' : ''}" data-act="bgq" data-v="${k}">${n}</button>`).join('')}</div></div>
        ${switchRow('Пауза в фоне', 'Останавливать анимации, когда окно лаунчера неактивно (например, во время игры)', 'pauseInactive', c.pauseInactive !== false)}
        ${slider('Скорость фона', 'bgSpeed', Math.round((c.bgSpeed || 1) * 100), 20, 300, 10, '%')}
        <div class="sep"></div>
        ${slider('Прозрачность стекла', 'glassOpacity', 100 - (c.glassOpacity != null ? c.glassOpacity : 46), 5, 90, 1, '%')}
        ${slider('Размытие стекла', 'glassBlur', c.glassBlur != null ? c.glassBlur : 30, 0, 60, 1, ' px')}
        ${switchRow('Анимации', 'Пружинящие переходы, блики и плавающий фон', 'animations', c.animations !== false)}
      </div>
      </div>`;
  }
};
function playBtn(i) {
  const l = S.launching[i.id], run = S.running && S.running[i.id];
  if (run) return `<button class="play-btn stop" data-act="play" data-id="${esc(i.id)}"><span class="shine"></span>${svgFill('stop', 20)}<span>Остановить<small data-timer="${run.start}"></small></span></button>`;
  return `<button class="play-btn ${l ? 'launching' : ''}" data-act="play" data-id="${esc(i.id)}"><span class="shine"></span>${l ? '<span class="spinner"></span>' : svgFill('play', 22)}<span>${l ? 'Запуск…' : 'Играть'}</span></button>`;
}
function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
function quick(icon, title, sub, act, page, type) {
  return `<button class="inst glass" data-act="${act}" ${page ? `data-page="${page}"` : ''} ${type ? `data-type="${type}"` : ''} style="flex-direction:row;align-items:center">
    <span class="icon-box" style="width:50px;height:50px;border-radius:16px;background:rgba(var(--accent-rgb),.9)">${svg(icon, 24, 2)}</span>
    <span class="grow"><span class="name" style="display:block;font-size:15px">${title}</span><span class="meta">${sub}</span></span></button>`;
}
function slider(t, key, val, min, max, step, unit) {
  return `<div class="set-row"><div class="t">${t}</div><span class="chip" id="sv_${key}">${val}${unit}</span></div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-input="live:${key}" data-unit="${unit}" aria-label="${t}">`;
}
function switchRow(t, s, key, on) {
  return `<div class="set-row"><div><div class="t">${t}</div><div class="s">${s}</div></div><button class="switch ${on ? 'on' : ''}" data-act="cfgtoggle" data-key="${key}" aria-pressed="${on}" aria-label="${t}"></button></div>`;
}

// ---------- вкладки экземпляра ----------
function tabBody(i) {
  if (['mod', 'resourcepack', 'shader'].includes(S.tab)) {
    const f = S.contentFilter.toLowerCase();
    const list = S.content.filter((c) => !f || c.title.toLowerCase().includes(f) || c.file.toLowerCase().includes(f));
    const what = { mod: 'моды', resourcepack: 'ресурспаки', shader: 'шейдеры' }[S.tab];
    const on = S.content.filter((c) => c.enabled).length;
    return `<div class="row" style="flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <label class="field glass grow" style="min-width:220px">${svg('search', 18)}<input data-input="contentFilter" placeholder="Фильтр" value="${esc(S.contentFilter)}" aria-label="Фильтр"></label>
      <span class="chip" style="height:34px">${on} из ${S.content.length} включено</span>
      <button class="btn glass light spring" data-act="cfolder">${svg('folder', 18)}Папка</button>
      <button class="btn glass light spring" data-act="addfiles">${svg('file', 18)}Из файла</button>
      <button class="btn primary spring" data-act="addcontent">${svg('download', 18, 2.4)}Скачать ${what}</button></div>
      ${S.tab === 'mod' ? '<div id="modsExtra"></div>' : ''}
      <div class="list glass">${list.length ? `<div class="stagger">${list.map(contentRow).join('')}</div>` : `<div class="empty">${svg('box', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">${S.content.length ? 'Ничего не найдено' : 'Здесь пока пусто'}</div><div style="margin-top:6px">Нажмите «Скачать ${what}», чтобы найти их на Modrinth или CurseForge.</div></div>`}</div>`;
  }
  if (S.tab === 'worlds') {
    return `<div class="row" style="margin-bottom:14px;justify-content:flex-end"><button class="btn glass light spring" data-act="sfolder" data-sub="saves">${svg('folder', 18)}Папка миров</button></div>
      <div class="list glass">${S.worlds.length ? `<div class="stagger">${S.worlds.map((w) => `<div class="item">${iconBox(w.icon, w.name, 48, 12)}<div class="grow"><div class="t">${esc(w.name)}</div><div class="s">Изменён ${esc(fmtAgo(w.modified))}</div></div></div>`).join('')}</div>` : `<div class="empty">${svg('globe', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Миров пока нет</div></div>`}</div>`;
  }
  if (S.tab === 'shots') {
    return `<div class="row" style="margin-bottom:14px;justify-content:flex-end"><button class="btn glass light spring" data-act="sfolder" data-sub="screenshots">${svg('folder', 18)}Папка скриншотов</button></div>
      ${S.shots.length ? `<div class="shots stagger">${S.shots.map((s) => `<button data-act="viewshot" data-url="${esc(s.url)}" aria-label="${esc(s.name)}"><img src="${esc(s.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : `<div class="list glass"><div class="empty">${svg('image', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Скриншотов пока нет</div><div style="margin-top:6px">В игре нажмите F2.</div></div></div>`}`;
  }
  // настройки экземпляра
  const ramGb = Math.round((i.ram || S.cfg.defaultRam || 4096) / 1024);
  return `<div class="cols stagger">
    <div class="panel glass"><h3>Основное</h3>
      <label class="lbl">Название<div class="row"><input class="input" id="instName" value="${esc(i.name)}"><button class="btn glass light spring" data-act="saveName">Сохранить</button></div></label>
      <div class="set-row"><div><div class="t">Версия</div><div class="s">${esc(verText(i))}${i.loaderVersion ? ' ' + esc(i.loaderVersion) : ''}</div></div><button class="btn small glass light spring" data-act="editVersion">Изменить</button></div>
      <label class="lbl">Заметки<textarea class="input" id="instNotes" placeholder="Что-нибудь о сборке">${esc(i.notes)}</textarea></label>
      <div class="row" style="justify-content:flex-end"><button class="btn small glass light spring" data-act="saveNotes">Сохранить заметки</button></div>
    </div>
    <div class="panel glass"><h3>Производительность</h3>
      <div class="set-row"><div class="t">Память</div><span class="chip" id="iramChip">${ramGb} ГБ</span></div>
      <input type="range" min="2" max="32" step="1" value="${ramGb}" data-input="instRam" data-change="instRamSave" aria-label="Память, ГБ">
      <div class="s muted">Для больших сборок (200+ модов) ставьте 8–12 ГБ.</div>
      <div class="sep"></div>
      <div class="set-row"><div><div class="t">Тонкие настройки</div><div class="s">Java, аргументы JVM, окно — в Prism</div></div><button class="btn small glass light spring" data-act="prism:open">Открыть Prism</button></div>
      <div class="set-row"><div><div class="t" style="color:#ff8a91">Удалить экземпляр</div><div class="s">Папка уйдёт в корзину</div></div><button class="btn small danger spring" data-act="delinst" data-id="${esc(i.id)}">Удалить</button></div>
    </div></div>`;
}
function contentRow(c) {
  return `<div class="item ${c.enabled ? '' : 'off'}">${iconBox(c.icon, c.title, 44, 12)}
    <div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${esc(c.base)} · ${esc(fmtSize(c.size))}${c.source ? ' · ' + (c.source === 'modrinth' ? 'Modrinth' : 'CurseForge') : ''}</div></div>
    <button class="btn small icon glass light spring" data-act="cdel" data-file="${esc(c.file)}" aria-label="Удалить ${esc(c.title)}">${svg('trash', 16)}</button>
    <button class="switch ${c.enabled ? 'on' : ''}" data-act="ctoggle" data-file="${esc(c.file)}" aria-pressed="${c.enabled}" aria-label="${c.enabled ? 'Отключить' : 'Включить'} ${esc(c.title)}"></button></div>`;
}
async function loadTab(noRender) {
  const i = instById(S.inst); if (!i) return;
  if (['mod', 'resourcepack', 'shader'].includes(S.tab)) S.content = await call('content:list', i.id, S.tab).catch(() => []);
  else if (S.tab === 'worlds') S.worlds = await call('instances:worlds', i.id).catch(() => []);
  else if (S.tab === 'shots') S.shots = await call('instances:screenshots', i.id).catch(() => []);
  if (!noRender) { const b = $('#tabBody'); if (b) { b.innerHTML = tabBody(i); afterRender(); } }
}

// ---------- обзор ----------
function resultsHtml() {
  const B = S.browse;
  if (B.error) return `<div class="list glass"><div class="empty">${svg('warn', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">${esc(B.error)}</div>${B.source === 'curseforge' && /ключ/.test(B.error) ? '<button class="btn primary spring" style="margin-top:16px" data-act="go" data-page="settings">Открыть настройки</button>' : ''}</div></div>`;
  if (B.loading && !B.hits.length) return `<div class="grid wide">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
  if (!B.hits.length) return `<div class="list glass"><div class="empty">${svg('search', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Ничего не найдено</div></div></div>`;
  return `<div class="grid wide stagger">${B.hits.map(resultCard).join('')}</div>
    ${B.hits.length < B.total ? `<div class="row" style="justify-content:center;margin-top:22px"><button class="btn glass light spring" data-act="more">${B.loading ? '<span class="spinner"></span>' : ''}Показать ещё</button></div>` : ''}`;
}
function resultCard(h) {
  const key = h.source + ':' + h.id;
  const st = S.installing[key] ? 'busy' : S.installed[key] ? 'done' : '';
  const isPack = S.browse.type === 'modpack';
  const btn = st === 'busy' ? `<button class="btn small glass light" disabled><span class="spinner"></span>Установка</button>`
    : st === 'done' ? `<button class="btn small glass light" disabled>${svg('check', 15, 3)}Установлено</button>`
      : `<button class="btn small primary spring" data-act="install" data-key="${esc(key)}">${svg('download', 15, 2.4)}${isPack ? 'Установить' : 'Скачать'}</button>`;
  return `<div class="result glass">${iconBox(h.icon, h.title, 64, 18)}
    <div class="grow"><div class="t">${esc(h.title)}</div><div class="d">${esc(h.desc)}</div>
    <div class="row" style="margin-top:10px;justify-content:space-between"><span class="s">${h.author ? esc(h.author) + ' · ' : ''}${fmtNum(h.downloads)} загрузок</span>
    <span class="row" style="gap:6px">${h.url ? `<button class="btn small icon glass light spring" data-act="url" data-url="${esc(h.url)}" aria-label="Открыть страницу">${svg('link', 15)}</button>` : ''}${btn}</span></div></div></div>`;
}
let searchSeq = 0;
async function doSearch(append) {
  const B = S.browse;
  const t = instById(B.target);
  const seq = ++searchSeq;
  B.loading = true; B.error = '';
  if (!append) { B.offset = 0; B.hits = []; }
  updateResults();
  try {
    const r = await call('search', { source: B.source, type: B.type, query: B.query, sort: B.sort, offset: B.offset, mc: B.type !== 'modpack' && t ? t.mc : '', loader: B.type !== 'modpack' && t ? t.loader : '' });
    if (seq !== searchSeq) return;
    B.hits = append ? B.hits.concat(r.hits) : r.hits; B.total = r.total; B.offset = B.hits.length;
  } catch (e) { if (seq === searchSeq) B.error = e.message; }
  if (seq !== searchSeq) return;
  B.loading = false;
  updateResults(append);
}
function updateResults(append) {
  const el = $('#results'); if (!el) return;
  el.innerHTML = resultsHtml();
  if (append) $$('.stagger > *', el).forEach((c) => (c.style.animation = 'none'));
}

// ---------- создание / версия ----------
async function openCreate(edit) {
  const i = edit ? instById(S.inst) : null;
  S.create = { edit: !!edit, name: i ? i.name : '', mc: i ? i.mc : '', loader: i ? i.loader : 'vanilla', lv: i ? i.loaderVersion : '', snapshots: false, loaders: [], loadingLoaders: false, ram: (S.cfg.defaultRam || 4096) / 1024, error: '' };
  showSheet(createHtml());
  if (!S.mcVersions) {
    try { S.mcVersions = await call('meta:minecraft'); } catch (e) { S.create && (S.create.error = 'Не удалось получить список версий: ' + e.message); }
  }
  if (!S.create) return;
  if (!S.create.mc && S.mcVersions) S.create.mc = (S.mcVersions.find((v) => v.type === 'release') || S.mcVersions[0] || {}).version || '';
  updateSheet(createHtml());
  await loadLoaders(true);
}
async function loadLoaders(keepLv) {
  const C = S.create; if (!C) return;
  C.loaders = [];
  if (C.loader === 'vanilla') { C.lv = ''; updateSheet(createHtml()); return; }
  C.loadingLoaders = true; updateSheet(createHtml());
  try {
    const list = await call('meta:loader', C.loader, C.mc);
    if (S.create !== C) return;
    C.loaders = list;
    if (!(keepLv && list.some((v) => v.version === C.lv))) C.lv = (list.find((v) => v.recommended) || list.find((v) => v.stable) || list[0] || {}).version || '';
  } catch (e) { C.error = e.message; }
  C.loadingLoaders = false;
  updateSheet(createHtml());
}
function createHtml() {
  const C = S.create;
  const vers = (S.mcVersions || []).filter((v) => C.snapshots || v.type === 'release');
  const lvOpts = C.loaders.slice(0, 200).map((v) => `<option value="${esc(v.version)}" ${v.version === C.lv ? 'selected' : ''}>${esc(v.version)}${v.recommended ? ' ★' : ''}</option>`).join('');
  return `<h2>${C.edit ? 'Версия экземпляра' : 'Новый экземпляр'}</h2>
    ${C.edit ? '' : `<label class="lbl">Название<input class="input" data-input="c:name" value="${esc(C.name)}" placeholder="${esc(C.mc ? 'Minecraft ' + C.mc : 'Мой мир')}"></label>`}
    <div class="row" style="align-items:flex-end;gap:14px">
      <label class="lbl grow">Версия Minecraft<select class="input" data-change="c:mc">${S.mcVersions ? vers.map((v) => `<option value="${esc(v.version)}" ${v.version === C.mc ? 'selected' : ''}>${esc(v.version)}${v.type !== 'release' ? ' (' + esc(v.type) + ')' : ''}</option>`).join('') : '<option>Загрузка…</option>'}</select></label>
      <div class="set-row" style="height:44px;gap:10px"><span class="muted" style="font-size:13px;font-weight:600">Снапшоты</span><button class="switch ${C.snapshots ? 'on' : ''}" data-act="c:snap" aria-pressed="${C.snapshots}" aria-label="Показывать снапшоты"></button></div>
    </div>
    <div class="lbl">Загрузчик модов<div class="seg glass light" style="width:max-content"><span class="seg-ind"></span>${LOADERS.map(([k, t]) => `<button class="${C.loader === k ? 'on' : ''}" data-act="c:loader" data-v="${k}">${t}</button>`).join('')}</div></div>
    ${C.loader !== 'vanilla' ? `<label class="lbl">Версия ${LOADER_NAME[C.loader]}${C.loadingLoaders ? '<div class="row muted" style="height:44px"><span class="spinner"></span>Загрузка списка…</div>' : C.loaders.length ? `<select class="input" data-change="c:lv">${lvOpts}</select>` : `<div class="muted" style="height:44px;display:flex;align-items:center">Для ${esc(C.mc)} нет версий ${LOADER_NAME[C.loader]}</div>`}</label>` : ''}
    ${C.edit ? '' : `<div class="lbl"><div class="set-row"><span>Память</span><span class="chip" id="cramChip">${C.ram} ГБ</span></div><input type="range" min="2" max="32" step="1" value="${C.ram}" data-input="c:ram" aria-label="Память, ГБ"></div>`}
    ${C.error ? `<div class="warn glass light" style="padding:12px 14px"><span class="ic" style="width:32px;height:32px;border-radius:10px">${svg('warn', 16)}</span><span>${esc(C.error)}</span></div>` : ''}
    <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Отмена</button>
    <button class="btn primary spring" data-act="c:go" ${!C.mc || C.loadingLoaders || (C.loader !== 'vanilla' && !C.lv) ? 'disabled' : ''}>${C.edit ? 'Сохранить' : svg('plus', 18, 2.6) + 'Создать'}</button></div>`;
}

// ---------- действия ----------
const ACT = {
  'win:min': () => call('win:min'), 'win:max': () => call('win:max'), 'win:close': () => call('win:close'),
  go: (d) => {
    S.page = d.page;
    if (d.page === 'browse') {
      if (d.type) S.browse.type = d.type;
      if (!S.browse.target && S.cfg.lastInstance && instById(S.cfg.lastInstance)) S.browse.target = S.cfg.lastInstance;
      render(); doSearch();
      return;
    }
    if (d.page === 'accounts') loadAccounts().then(() => S.page === 'accounts' && rerenderMain());
    render();
  },
  open: async (d) => { S.inst = d.id; S.page = 'instance'; S.tab = 'mod'; S.contentFilter = ''; S.content = []; render(); await loadTab(); },
  tab: async (d) => { S.tab = d.tab; S.contentFilter = ''; $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === d.tab)); afterRender(); await loadTab(true); const b = $('#tabBody'); if (b) { b.innerHTML = `<div class="page">${tabBody(instById(S.inst))}</div>`; afterRender(); } },
  play: async (d) => {
    const i = instById(d.id); if (!i || S.launching[i.id]) return;
    if (S.running && S.running[i.id]) { if (await confirmSheet('Остановить игру?', `«${i.name}» будет закрыт принудительно. Несохранённый прогресс за последние секунды может потеряться.`, 'Остановить', true)) await attempt(() => call('game:stop', i.id), 'Игра остановлена'); return; }
    sfx('launch');
    S.launching[i.id] = true; rerenderMain();
    const ok = await attempt(() => call('instances:launch', i.id), `Запускаю «${i.name}» через Prism`);
    S.cfg.lastInstance = i.id;
    setTimeout(() => { if (S.launching[i.id]) { delete S.launching[i.id]; rerenderMain(); } }, ok ? 25000 : 300);
    setTimeout(() => refresh(true), 15000);
  },
  instmenu: (d, el) => {
    const i = instById(d.id); if (!i) return;
    showMenu(el, [
      { icon: 'play', label: 'Играть', run: () => ACT.play(d) },
      { icon: 'folder', label: 'Открыть папку', run: () => call('instances:folder', i.id) },
      { icon: 'edit', label: 'Переименовать', run: async () => { const n = await promptSheet('Переименовать', 'Новое название', i.name, 'Сохранить'); if (n) { await attempt(() => call('instances:rename', i.id, n), 'Переименовано'); refresh(true); } } },
      { icon: 'copy', label: 'Копировать', run: async () => { const n = await promptSheet('Копия экземпляра', 'Название копии', i.name + ' (копия)', 'Копировать'); if (n) { await attempt(() => call('instances:copy', i.id, n), 'Копия создана'); refresh(true); } } },
      { icon: 'trash', label: 'Удалить', red: true, run: () => ACT.delinst(d) }
    ]);
  },
  delinst: async (d) => {
    const i = instById(d.id); if (!i) return;
    if (!(await confirmSheet('Удалить экземпляр?', `«${i.name}» со всеми мирами и модами будет перемещён в корзину.`, 'Удалить', true))) return;
    await attempt(() => call('instances:delete', i.id), 'Экземпляр перемещён в корзину');
    if (S.page === 'instance') S.page = 'instances';
    refresh();
  },
  folder: (d) => call('instances:folder', d.id),
  sfolder: (d) => call('instances:folder', S.inst, d.sub),
  cfolder: () => call('instances:folder', S.inst, { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' }[S.tab]),
  create: () => openCreate(false),
  editVersion: () => openCreate(true),
  import: async () => {
    const id = await attempt(() => call('modpack:import'));
    if (id) { toast('Модпак импортирован'); await refresh(true); }
  },
  'sheet:cancel': () => closeSheet(),
  'sheet:ok': () => S.sheetOk && S.sheetOk(),
  'c:snap': () => { S.create.snapshots = !S.create.snapshots; updateSheet(createHtml()); },
  'c:loader': (d) => { S.create.loader = d.v; S.create.error = ''; loadLoaders(); },
  'c:go': async () => {
    const C = S.create;
    if (C.edit) {
      await attempt(() => call('instances:version', S.inst, { mc: C.mc, loader: C.loader, loaderVersion: C.lv }), 'Версия изменена');
      closeSheet(); refresh(true); return;
    }
    const name = C.name.trim() || ('Minecraft ' + C.mc + (C.loader !== 'vanilla' ? ' ' + LOADER_NAME[C.loader] : ''));
    const id = await attempt(() => call('instances:create', { name, mc: C.mc, loader: C.loader, loaderVersion: C.lv, ram: C.ram * 1024 }));
    if (!id) return;
    closeSheet(); toast(`Экземпляр «${name}» создан`);
    await refresh(true);
    ACT.open({ id });
  },
  saveName: async () => { const v = $('#instName').value.trim(); if (!v) return; await attempt(() => call('instances:rename', S.inst, v), 'Название сохранено'); refresh(true); },
  saveNotes: async () => { await attempt(() => call('instances:notes', S.inst, $('#instNotes').value), 'Заметки сохранены'); refresh(true); },
  ctoggle: async (d, el) => {
    el.classList.toggle('on'); el.closest('.item').classList.toggle('off');
    await attempt(() => call('content:toggle', S.inst, S.tab, d.file));
    await loadTab(true); const b = $('#tabBody'); if (b) { const y = $('#main').scrollTop; b.innerHTML = tabBody(instById(S.inst)); $$('.stagger > *', b).forEach((c) => (c.style.animation = 'none')); afterRender(); $('#main').scrollTop = y; }
  },
  cdel: async (d) => {
    const c = S.content.find((x) => x.file === d.file);
    if (!(await confirmSheet('Удалить?', `«${c ? c.title : d.file}» будет перемещён в корзину.`, 'Удалить', true))) return;
    await attempt(() => call('content:delete', S.inst, S.tab, d.file), 'Удалено');
    loadTab();
  },
  addfiles: async () => { const n = await attempt(() => call('content:addFiles', S.inst, S.tab)); if (n) { toast(`Добавлено файлов: ${n}`); loadTab(); } },
  addcontent: () => { S.browse.target = S.inst; S.browse.type = S.tab; S.page = 'browse'; render(); doSearch(); },
  viewshot: (d) => {
    const v = document.createElement('div'); v.className = 'viewer';
    v.innerHTML = `<img src="${esc(d.url)}" alt="">`;
    v.onclick = () => v.remove();
    document.body.appendChild(v);
  },
  bsource: (d) => { S.browse.source = d.v; rerenderMain(); doSearch(); },
  btype: (d) => { S.browse.type = d.v; rerenderMain(); doSearch(); },
  more: () => doSearch(true),
  install: async (d) => {
    const B = S.browse;
    const h = B.hits.find((x) => x.source + ':' + x.id === d.key); if (!h) return;
    const key = d.key;
    if (B.type !== 'modpack' && !B.target) { toast('Сначала выберите экземпляр справа от поиска', true); return; }
    S.installing[key] = true; updateResults(true);
    if (B.type === 'modpack') {
      const id = await attempt(() => call('modpack:install', { source: h.source, projectId: h.id, title: h.title, icon: h.icon }));
      delete S.installing[key];
      if (id) { S.installed[key] = true; toast(`Модпак «${h.title}» установлен`); await loadInstances(); }
    } else {
      const done = await attempt(() => call('content:install', { source: h.source, type: B.type, projectId: h.id, instanceId: B.target, title: h.title, icon: h.icon }));
      delete S.installing[key];
      if (done && !done.length) { S.installed[key] = true; toast(`«${h.title}» уже установлен`); }
      else if (done) { S.installed[key] = true; toast(done.length > 1 ? `Установлено: ${h.title} и ещё ${done.length - 1} (зависимости)` : `Установлено: ${h.title}`); }
    }
    updateResults(true);
  },
  url: (d) => call('open:url', d.url),
  useacc: async (d) => { await setCfg({ account: d.name }); toast(`Игра будет запускаться аккаунтом ${d.name}`); rerenderMain(); render(true); },
  'prism:accounts': async () => { await attempt(() => call('prism:open'), 'Открываю Prism: «Аккаунты» → «Добавить Microsoft»'); setTimeout(() => loadAccounts().then(() => S.page === 'accounts' && rerenderMain()), 20000); },
  'prism:open': () => attempt(() => call('prism:open')),
  'pick:prism': async () => { const p = await call('dialog:file', [{ name: 'Prism Launcher', extensions: ['exe', '*'] }]); if (p) { await setCfg({ prismExe: p }); toast('Путь к Prism сохранён'); refresh(true); } },
  'pick:data': async () => { const p = await call('dialog:folder'); if (p) { await setCfg({ prismData: p }); toast('Папка данных сохранена'); refresh(true); } },
  'pick:bg': async () => { const p = await call('dialog:file', [{ name: 'Картинки', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]); if (p) { await setCfg({ backgroundImage: p, background: 'image' }); rerenderMain(); } },
  accent: async (d) => { await setCfg({ accent: d.v }); rerenderMain(); },
  bgq: async (d) => { await setCfg({ bgQuality: d.v }); rerenderMain(); },
  bgmode: async (d) => { await setCfg({ background: d.v }); rerenderMain(); },
  cfgtoggle: async (d, el) => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); el.setAttribute('aria-pressed', v); await setCfg({ [d.key]: v }); },
  refresh: () => refresh(true).then(() => toast('Обновлено'))
};

// ---------- события ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('.btn, .play-btn');
  if (b && S.cfg.animations !== false) {
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const rp = document.createElement('span'); rp.className = 'ripple';
    rp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden'; b.appendChild(rp); setTimeout(() => rp.remove(), 700);
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = ACT[el.dataset.act];
  if (!act) return;
  if (el.closest('.inst') && el !== el.closest('.inst')) e.stopPropagation();
  e.preventDefault();
  act(el.dataset, el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('.viewer')) $('.viewer').remove(); else if ($('#menu')) closeMenu(); else if ($('#overlay.show')) closeSheet(); }
  if (e.key === 'Enter') {
    if ($('#overlay.show') && S.sheetOk && document.activeElement && document.activeElement.id === 'promptVal') S.sheetOk();
    const card = document.activeElement && document.activeElement.closest('.inst[data-act]');
    if (card && document.activeElement === card) ACT[card.dataset.act](card.dataset, card, e);
  }
});
let bTimer, liveTimer;
document.addEventListener('input', (e) => {
  const el = e.target, k = el.dataset.input; if (!k) return;
  if (el.type === 'range') setRangeFill(el);
  if (k === 'instFilter') { S.instFilter = el.value; const f = el.value.toLowerCase(); { $$('#main .inst[data-id]').forEach((c) => { const i = instById(c.dataset.id); c.style.display = !f || (i && (i.name.toLowerCase().includes(f) || (i.mc || '').includes(f) || i.loader.includes(f))) ? '' : 'none'; }); } }
  else if (k === 'contentFilter') { S.contentFilter = el.value; const list = $('#tabBody .list'); if (list) { const f = el.value.toLowerCase(); const vis = S.content.filter((c) => !f || c.title.toLowerCase().includes(f) || c.file.toLowerCase().includes(f)); list.innerHTML = vis.length ? vis.map(contentRow).join('') : '<div class="empty">Ничего не найдено</div>'; } }
  else if (k === 'bquery') { S.browse.query = el.value; clearTimeout(bTimer); bTimer = setTimeout(() => doSearch(), 380); }
  else if (k.startsWith('live:')) {
    const key = k.slice(5), v = +el.value;
    $('#sv_' + key).textContent = v + el.dataset.unit;
    const patch = key === 'glassOpacity' ? { glassOpacity: 100 - v } : key === 'bgSpeed' ? { bgSpeed: v / 100 } : { [key]: v };
    Object.assign(S.cfg, patch);
    applyTheme();
    clearTimeout(liveTimer); liveTimer = setTimeout(() => call('config:set', patch), 300);
  }
  else if (k === 'defaultRam') { $('#ramChip').textContent = el.value + ' ГБ'; }
  else if (k === 'instRam') { $('#iramChip').textContent = el.value + ' ГБ'; }
  else if (k === 'c:name') { S.create.name = el.value; }
  else if (k === 'c:ram') { S.create.ram = +el.value; $('#cramChip').textContent = el.value + ' ГБ'; }
});
document.addEventListener('change', async (e) => {
  const el = e.target, k = el.dataset.change; if (!k) return;
  if (k.startsWith('cfg:')) { await setCfg({ [k.slice(4)]: el.value.trim() }); toast('Сохранено'); if (k !== 'cfg:curseKey') refresh(true); return; }
  if (k === 'btarget') { S.browse.target = el.value; S.installed = {}; rerenderMain(); doSearch(); }
  else if (k === 'bsort') { S.browse.sort = el.value; doSearch(); }
  else if (k === 'defaultRamSave') { await setCfg({ defaultRam: +el.value * 1024 }); }
  else if (k === 'instRamSave') { await attempt(() => call('instances:ram', S.inst, +el.value * 1024), 'Память: ' + el.value + ' ГБ'); loadInstances(); }
  else if (k === 'c:mc') { S.create.mc = el.value; S.create.error = ''; loadLoaders(true); }
  else if (k === 'c:lv') { S.create.lv = el.value; }
});
api.on('win:state', () => { });
let winActive = true;
api.on('win:focus', (active) => {
  winActive = active;
  document.body.classList.toggle('inactive', !active);
  if (window.BG) window.BG.pause(!active && S.cfg.pauseInactive !== false);
});

document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest('.icon-box, #accBtn')) t.remove(); }, true);

// ---------- старт ----------
function sfx() { }
window.addEventListener('DOMContentLoaded', async () => {
  if (/Mac/.test(navigator.platform)) document.body.classList.add('mac');
  try { S.cfg = await call('config:get'); } catch (e) { console.error('config:get ' + e.message); S.cfg = {}; }
  try { applyTheme(); } catch (e) { console.error('theme ' + e.stack); }
  try { await loadInstances(); } catch (e) { console.error('instances ' + e.stack); toast(e.message, true); }
  try { await loadAccounts(); } catch (e) { console.error('accounts ' + e.stack); }
  try { render(); } catch (e) { console.error('render ' + e.stack); toast('Ошибка интерфейса: ' + e.message, true); }
  console.log('startup done, instances=' + S.instances.length);
  setInterval(() => { if (winActive && !document.hidden && !$('#overlay.show') && ['home', 'instances'].includes(S.page)) loadInstances().then(() => rerenderMain()).catch(() => { }); }, 60000);
});
