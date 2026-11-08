'use strict';
/* Prism Launcher Deluxe — редактор скина: рисование по развёртке 64×64, инструменты, слои, 3D-превью, библиотека. */
const SK_REGIONS = [
  // [название, u, v, w, h, d, слой]
  ['Голова', 0, 0, 8, 8, 8, 'base'], ['Шляпа', 32, 0, 8, 8, 8, 'ov'],
  ['Тело', 16, 16, 8, 12, 4, 'base'], ['Куртка', 16, 32, 8, 12, 4, 'ov'],
  ['Правая рука', 40, 16, 4, 12, 4, 'base'], ['Правый рукав', 40, 32, 4, 12, 4, 'ov'],
  ['Левая рука', 32, 48, 4, 12, 4, 'base'], ['Левый рукав', 48, 48, 4, 12, 4, 'ov'],
  ['Правая нога', 0, 16, 4, 12, 4, 'base'], ['Правая штанина', 0, 32, 4, 12, 4, 'ov'],
  ['Левая нога', 16, 48, 4, 12, 4, 'base'], ['Левая штанина', 0, 48, 4, 12, 4, 'ov']
];
const SK_FACE_NAMES = ['верх', 'низ', 'правый бок', 'перед', 'левый бок', 'спина'];
function skFaces(slim) {
  const out = [];
  for (const [name, u, v, w0, h, d, layer] of SK_REGIONS) {
    const w = slim && /рук|рукав/.test(name) ? 3 : w0;
    const f = [[u + d, v, w, d], [u + d + w, v, w, d], [u, v + d, d, h], [u + d, v + d, w, h], [u + d + w, v + d, d, h], [u + d + w + d, v + d, w, h]];
    f.forEach(([x, y, fw, fh], k) => out.push({ name, face: SK_FACE_NAMES[k], layer, x, y, w: fw, h: fh }));
  }
  return out;
}
const SK_PALETTE = ['#f9d6b5', '#e8b48f', '#c68863', '#8d5a3b', '#5a3825', '#2b1a12', '#f5e1a4', '#d9a441', '#9c5a24', '#1c1c1c', '#ffffff', '#9aa0a6', '#4a4f57', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00897b', '#1e88e5', '#3949ab', '#8e24aa', '#d81b60', '#6d4c41', '#3a7bd5'];

S.skin = null;
function skInit() {
  if (S.skin) return;
  S.skin = { data: new Uint8ClampedArray(64 * 64 * 4), tool: 'pencil', color: '#3a7bd5', size: 1, layer: 'all', grid: true, regions: true, slim: false, mirror: false, zoom: 8, undo: [], redo: [], name: 'Мой скин', id: null, recent: [], lib: null, rot: -25 };
  skTemplate();
}
// ---------- пиксели ----------
function skGet(x, y) { const i = (y * 64 + x) * 4, d = S.skin.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
function skSet(x, y, c) { if (x < 0 || y < 0 || x > 63 || y > 63) return; const i = (y * 64 + x) * 4, d = S.skin.data; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; }
function hexToRgba(h, a = 255) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16), a]; }
function rgbaToHex(c) { return '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join(''); }
function skFaceAt(x, y) { return skFaces(S.skin.slim).find((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) || null; }
function skAllowed(x, y) { const f = skFaceAt(x, y); if (!f) return false; return S.skin.layer === 'all' || (S.skin.layer === 'base' ? f.layer === 'base' : f.layer === 'ov'); }
function skSnapshot() { const s = S.skin; s.undo.push(new Uint8ClampedArray(s.data)); if (s.undo.length > 60) s.undo.shift(); s.redo = []; }
function skUndo() { const s = S.skin; if (!s.undo.length) return; s.redo.push(new Uint8ClampedArray(s.data)); s.data = s.undo.pop(); skDraw(); skPreview(true); }
function skRedo() { const s = S.skin; if (!s.redo.length) return; s.undo.push(new Uint8ClampedArray(s.data)); s.data = s.redo.pop(); skDraw(); skPreview(true); }

// ---------- шаблон по умолчанию (свой, нарисован процедурно) ----------
function skTemplate() {
  const s = S.skin; s.data = new Uint8ClampedArray(64 * 64 * 4);
  const fill = (x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = hexToRgba(col); const n = ((x + i) * 7 + (y + j) * 13) % 5 - 2; skSet(x + i, y + j, [c[0] + n * 3, c[1] + n * 3, c[2] + n * 3, 255]); } };
  const box = (u, v, w, h, d, col) => { fill(u + d, v, w * 2, d, col); fill(u, v + d, d * 2 + w * 2, h, col); };
  const skin = '#e8b48f', hair = '#5a3825', shirt = '#3a7bd5', pants = '#3949ab', shoe = '#4a4f57';
  box(0, 0, 8, 8, 8, skin); fill(8, 0, 8, 8, hair); fill(0, 8, 32, 2, hair); fill(24, 8, 8, 8, hair); fill(0, 10, 8, 3, hair); fill(16, 10, 8, 3, hair);
  fill(9, 12, 2, 1, '#ffffff'); fill(13, 12, 2, 1, '#ffffff'); fill(10, 12, 1, 1, '#2b4c9c'); fill(13, 12, 1, 1, '#2b4c9c'); fill(11, 14, 2, 1, '#8d5a3b');
  box(16, 16, 8, 12, 4, shirt); fill(20, 20, 8, 1, '#2c63b8');
  box(40, 16, 4, 12, 4, skin); fill(40, 20, 16, 4, shirt); box(32, 48, 4, 12, 4, skin); fill(32, 52, 16, 4, shirt);
  box(0, 16, 4, 12, 4, pants); fill(0, 29, 16, 3, shoe); box(16, 48, 4, 12, 4, pants); fill(16, 61, 16, 3, shoe);
  s.name = 'Новый скин'; s.id = null; s.slim = false; s.undo = []; s.redo = [];
}
async function skLoadData(dataUrl, opts = {}) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не удалось открыть картинку')); i.src = dataUrl; });
  if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) throw new Error('Скин должен быть 64×64 или 64×32 пикселя');
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  if (img.height === 32) { g.drawImage(c, 0, 16, 16, 16, 16, 48, 16, 16); g.drawImage(c, 40, 16, 16, 16, 32, 48, 16, 16); }
  skSnapshot();
  S.skin.data = new Uint8ClampedArray(g.getImageData(0, 0, 64, 64).data);
  if (opts.slim != null) S.skin.slim = !!opts.slim;
  if (opts.name) S.skin.name = opts.name;
  S.skin.id = opts.id || null;
}
function skDataUrl() { const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(S.skin.data), 64, 64), 0, 0); return c.toDataURL('image/png'); }

// ---------- отрисовка холста ----------
let skCv, skCtx, skDown = null, skPrevT = 0, skHover = null;
function skDraw() {
  const cv = $('#skCanvas'); if (!cv) return;
  const s = S.skin, z = s.zoom, g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = (x + y) % 2 ? '#2a3042' : '#232838'; g.fillRect(x * z, y * z, z, z); }
  const faces = skFaces(s.slim);
  for (const f of faces) { g.fillStyle = f.layer === 'ov' ? 'rgba(160,120,255,.07)' : 'rgba(90,200,250,.07)'; g.fillRect(f.x * z, f.y * z, f.w * z, f.h * z); }
  const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64; tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s.data), 64, 64), 0, 0);
  g.drawImage(tmp, 0, 0, 64 * z, 64 * z);
  if (s.layer !== 'all') for (const f of faces) if ((s.layer === 'base') !== (f.layer === 'base')) { g.fillStyle = 'rgba(8,10,18,.72)'; g.fillRect(f.x * z, f.y * z, f.w * z, f.h * z); }
  if (s.grid && z >= 6) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 64; i++) { g.moveTo(i * z + .5, 0); g.lineTo(i * z + .5, 64 * z); g.moveTo(0, i * z + .5); g.lineTo(64 * z, i * z + .5); } g.stroke(); }
  if (s.regions) { g.lineWidth = 1.5; for (const f of faces) { g.strokeStyle = f.layer === 'ov' ? 'rgba(191,155,255,.55)' : 'rgba(90,200,250,.55)'; g.strokeRect(f.x * z + .75, f.y * z + .75, f.w * z - 1.5, f.h * z - 1.5); } }
  if (skHover) { g.strokeStyle = '#fff'; g.lineWidth = 2; const sz = s.size; g.strokeRect((skHover.x - Math.floor((sz - 1) / 2)) * z + 1, (skHover.y - Math.floor((sz - 1) / 2)) * z + 1, sz * z - 2, sz * z - 2); }
}
function skPreview(now) {
  const t = Date.now();
  if (!now && t - skPrevT < 90) { clearTimeout(skPreview.tm); skPreview.tm = setTimeout(() => skPreview(true), 100); return; }
  skPrevT = t;
  const el = $('#skPrev'); if (el) el.style.setProperty('--skin', `url('${skDataUrl()}')`);
}
function skMirrorPoint(x, y) { const f = skFaceAt(x, y); if (!f) return null; return [f.x + (f.w - 1) - (x - f.x), y]; }
function skPaintAt(x, y, shift) {
  const s = S.skin, r = Math.floor((s.size - 1) / 2);
  const pts = [];
  for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) { pts.push([x - r + i, y - r + j]); }
  if (s.mirror) for (const p of pts.slice()) { const m = skMirrorPoint(p[0], p[1]); if (m) pts.push(m); }
  for (const [px, py] of pts) {
    if (!skAllowed(px, py)) continue;
    if (s.tool === 'pencil') skSet(px, py, hexToRgba(s.color));
    else if (s.tool === 'eraser') skSet(px, py, [0, 0, 0, 0]);
    else if (s.tool === 'shade') { const c = skGet(px, py); if (!c[3]) continue; const k = shift ? 1.12 : .88; skSet(px, py, [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k), c[3]]); }
    else if (s.tool === 'noise') { const c = hexToRgba(s.color); const n = (Math.random() - .5) * 34; skSet(px, py, [c[0] + n, c[1] + n, c[2] + n, 255]); }
  }
}
function skFill(x, y) {
  if (!skAllowed(x, y)) return;
  const target = skGet(x, y).join(','), col = hexToRgba(S.skin.color);
  if (target === col.join(',')) return;
  const face = skFaceAt(x, y);
  const st = [[x, y]], seen = new Set();
  while (st.length) {
    const [cx, cy] = st.pop(); const k = cx + ',' + cy;
    if (seen.has(k) || cx < face.x || cy < face.y || cx >= face.x + face.w || cy >= face.y + face.h) continue;
    seen.add(k);
    if (skGet(cx, cy).join(',') !== target) continue;
    skSet(cx, cy, col);
    st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}
function skPos(e) { const r = e.target.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / r.width * 64), y: Math.floor((e.clientY - r.top) / r.height * 64) }; }
function skPushRecent(c) { const r = S.skin.recent.filter((x) => x !== c); r.unshift(c); S.skin.recent = r.slice(0, 10); }
function skBind() {
  const cv = $('#skCanvas'); if (!cv) return;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    const p = skPos(e), s = S.skin;
    if (e.button === 2 || s.tool === 'picker' || e.altKey) { const c = skGet(p.x, p.y); if (c[3]) { s.color = rgbaToHex(c); skPushRecent(s.color); skSyncColor(); } return; }
    skSnapshot();
    if (s.tool === 'fill') { skFill(p.x, p.y); skPushRecent(s.color); skDraw(); skPreview(true); skSyncColor(); return; }
    cv.setPointerCapture(e.pointerId);
    skDown = p; skPaintAt(p.x, p.y, e.shiftKey); skDraw(); skPreview();
  });
  cv.addEventListener('pointermove', (e) => {
    const p = skPos(e);
    skHover = p; skShowInfo(p);
    if (skDown) {
      // линия между точками, чтобы не было пропусков
      let x0 = skDown.x, y0 = skDown.y; const dx = Math.abs(p.x - x0), dy = -Math.abs(p.y - y0), sx = x0 < p.x ? 1 : -1, sy = y0 < p.y ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 200; n++) { skPaintAt(x0, y0, e.shiftKey); if (x0 === p.x && y0 === p.y) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      skDown = p; skPreview();
    }
    skDraw();
  });
  const up = () => { if (skDown) { skDown = null; if (['pencil', 'noise'].includes(S.skin.tool)) { skPushRecent(S.skin.color); skSyncColor(); } skPreview(true); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { skHover = null; skDraw(); skShowInfo(null); });
  cv.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); S.skin.zoom = Math.max(5, Math.min(14, S.skin.zoom + (e.deltaY < 0 ? 1 : -1))); skResize(); }, { passive: false });
  skResize();
}
function skResize() { const cv = $('#skCanvas'); if (!cv) return; const z = S.skin.zoom; cv.width = 64 * z; cv.height = 64 * z; cv.style.width = 64 * z + 'px'; cv.style.height = 64 * z + 'px'; const zc = $('#skZoom'); if (zc) zc.textContent = Math.round(z / 8 * 100) + '%'; skDraw(); }
function skShowInfo(p) {
  const el = $('#skInfo'); if (!el) return;
  if (!p) { el.textContent = 'Наведите на развёртку · ПКМ или Alt — пипетка · Ctrl+колесо — масштаб'; return; }
  const f = skFaceAt(p.x, p.y);
  el.textContent = f ? `${f.name} · ${f.face}${f.layer === 'ov' ? ' (2-й слой)' : ''} · ${p.x}, ${p.y}` : `Пустая область · ${p.x}, ${p.y}`;
}
function skSyncColor() {
  const s = S.skin;
  const inp = $('#skColor'); if (inp) inp.value = s.color;
  const hx = $('#skHex'); if (hx && document.activeElement !== hx) hx.value = s.color.toUpperCase();
  const sw = $('#skSwatch'); if (sw) sw.style.background = s.color;
  const rc = $('#skRecent'); if (rc) rc.innerHTML = s.recent.map((c) => `<button class="sk-col" style="background:${c}" data-act="skCol" data-c="${c}" aria-label="${c}"></button>`).join('');
}

// ---------- страница ----------
const SK_TOOLS = [['pencil', 'Карандаш', 'P', 'M4 20h4L19 9l-4-4L4 16z'], ['eraser', 'Ластик', 'E', 'M16 4l5 5-10 10H6l-3-3zM9 20h12'], ['fill', 'Заливка', 'F', 'M5 11l7-7 7 7-7 7zM19 15c1 1.5 2 2.7 2 3.8a2 2 0 0 1-4 0c0-1.1 1-2.3 2-3.8z'], ['picker', 'Пипетка', 'I', 'M14 4l6 6-2 2-6-6zM12 8l-8 8v4h4l8-8'], ['shade', 'Тень (Shift — свет)', 'S', 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18'], ['noise', 'Шумная кисть', 'N', 'M5 5h.01M9 7h.01M7 11h.01M12 9h.01M15 6h.01M17 11h.01M11 14h.01M6 16h.01M15 15h.01M19 17h.01M10 19h.01']];
PAGES.skineditor = function () {
  skInit();
  const s = S.skin;
  return `<div class="row" style="margin:14px 0 14px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="row"><button class="btn small glass light spring" data-act="go" data-page="accounts">${svg('back', 16, 2.4)}Профиль</button>
      <input class="input sk-name" id="skName" value="${esc(s.name)}" aria-label="Название скина"></div>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn glass light spring" data-act="skOpen">${svg('folder', 16)}Открыть</button>
        <button class="btn glass light spring" data-act="skLibSave">${svg('heart', 16)}В библиотеку</button>
        <button class="btn glass light spring" data-act="skExport">${svg('download', 16, 2.4)}Сохранить PNG</button>
        <button class="btn primary spring" data-act="skUpload">${svg('share', 16, 2.4)}Надеть в игре</button></div></div>
    <div class="sk-layout">
      <div class="sk-tools glass">
        ${SK_TOOLS.map(([k, n, key, d]) => `<button class="sk-tool spring ${s.tool === k ? 'on' : ''}" data-act="skTool" data-v="${k}" title="${n} (${key})" aria-label="${n}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg></button>`).join('')}
        <div class="sep" style="width:36px"></div>
        ${[1, 2, 3].map((n) => `<button class="sk-tool spring ${s.size === n ? 'on' : ''}" data-act="skSize" data-v="${n}" title="Размер кисти ${n}" aria-label="Размер ${n}"><i style="width:${n * 4 + 2}px;height:${n * 4 + 2}px"></i></button>`).join('')}
        <div class="sep" style="width:36px"></div>
        <button class="sk-tool spring ${s.mirror ? 'on' : ''}" data-act="skMirror" title="Зеркальное рисование" aria-label="Зеркало"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg></button>
        <button class="sk-tool spring" data-act="skUndo" title="Отменить (Ctrl+Z)" aria-label="Отменить"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 7H4V2M4 7a9 9 0 1 1-1 7"/></svg></button>
        <button class="sk-tool spring" data-act="skRedo" title="Повторить (Ctrl+Y)" aria-label="Повторить"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 7h5V2M20 7a9 9 0 1 0 1 7"/></svg></button>
      </div>
      <div class="sk-center glass">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div class="seg glass light"><span class="seg-ind"></span>${[['all', 'Оба слоя'], ['base', 'Основной'], ['ov', 'Второй слой']].map(([k, n]) => `<button class="${s.layer === k ? 'on' : ''}" data-act="skLayer" data-v="${k}">${n}</button>`).join('')}</div>
          <div class="row" style="gap:6px"><button class="btn small glass light spring ${s.grid ? 'on-soft' : ''}" data-act="skGrid">Сетка</button><button class="btn small glass light spring ${s.regions ? 'on-soft' : ''}" data-act="skRegions">Части тела</button>
          <button class="btn small icon glass light spring" data-act="skZoom" data-v="-1" aria-label="Уменьшить">−</button><span class="chip" id="skZoom">100%</span><button class="btn small icon glass light spring" data-act="skZoom" data-v="1" aria-label="Увеличить">+</button></div></div>
        <div class="sk-canvas-wrap"><canvas id="skCanvas" width="512" height="512"></canvas></div>
        <div class="dim" id="skInfo" style="margin-top:10px;font-size:13px;text-align:center"></div>
      </div>
      <div class="sk-side">
        <div class="panel glass" style="align-items:center;padding:16px">
          ${skin3d('', '', { url: skDataUrl(), slim: s.slim, id: 'skPrev', k: 6, size: [240, 260], cls: s.layer === 'base' ? 'no-ov' : '' })}
          <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn small glass light spring ${s.slim ? 'on-soft' : ''}" data-act="skSlim">${s.slim ? 'Тонкие руки (Alex)' : 'Обычные руки (Steve)'}</button><button class="btn small glass light spring" data-act="skPose">Анимация</button></div>
        </div>
        <div class="panel glass" style="padding:16px;gap:12px">
          <div class="row" style="gap:10px"><label class="sk-swatch" id="skSwatch" style="background:${s.color}"><input type="color" id="skColor" value="${s.color}" aria-label="Цвет"></label><input class="input" id="skHex" value="${s.color.toUpperCase()}" maxlength="7" aria-label="HEX цвет" style="font-family:Consolas,monospace"></div>
          <div class="sk-pal">${SK_PALETTE.map((c) => `<button class="sk-col" style="background:${c}" data-act="skCol" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
          <div class="dim" style="font-size:12px">Недавние</div><div class="sk-pal" id="skRecent"></div>
        </div>
        <div class="panel glass" style="padding:16px;gap:10px"><div class="row" style="justify-content:space-between"><h3 style="font-size:15px">Быстрые действия</h3></div>
          <div class="sk-quick"><button class="btn small glass light spring" data-act="skMirrorLimbs">Правые → левые конечности</button><button class="btn small glass light spring" data-act="skClearOv">Очистить 2-й слой</button><button class="btn small glass light spring" data-act="skTemplate">Новый шаблон</button><button class="btn small glass light spring" data-act="skMine">Мой текущий скин</button></div></div>
      </div>
    </div>`;
};
const _afterRender = afterRender;
afterRender = function () {
  _afterRender();
  if (S.page === 'skineditor' && $('#skCanvas') && !$('#skCanvas').dataset.bound) {
    $('#skCanvas').dataset.bound = '1'; skBind(); skSyncColor(); skShowInfo(null);
    const prev = $('#skPrev'); if (prev && S.skin.rot != null) { prev.dataset.rot = S.skin.rot; prev.dataset.tilt = -8; }
    const nm = $('#skName'); if (nm) nm.addEventListener('input', () => { S.skin.name = nm.value; });
    $('#skColor').addEventListener('input', (e) => { S.skin.color = e.target.value; skSyncColor(); });
    $('#skHex').addEventListener('input', (e) => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { S.skin.color = (v[0] === '#' ? v : '#' + v).toLowerCase(); skSyncColor(); } });
  }
};
function skRerender() { const prev = $('#skPrev'); if (prev && prev.dataset.rot) S.skin.rot = Number(prev.dataset.rot); rerenderMain(); }

Object.assign(ACT, {
  skinEditor: async () => {
    skInit(); S.page = 'skineditor'; render();
    if (!S.skin.loadedMine) {
      S.skin.loadedMine = true;
      const a = S.accounts.find((x) => x.name === accountName()) || S.accounts[0];
      if (a) { try { const r = await call('skin:fetch', a.uuid, a.name); await skLoadData(r.data, { slim: r.slim, name: a.name }); S.skin.undo = []; if (S.page === 'skineditor') skRerender(); } catch (e) { console.warn(e); } }
    }
  },
  skTool: (d) => { S.skin.tool = d.v; skRerender(); },
  skSize: (d) => { S.skin.size = +d.v; skRerender(); },
  skMirror: () => { S.skin.mirror = !S.skin.mirror; skRerender(); toast(S.skin.mirror ? 'Зеркальное рисование включено' : 'Зеркало выключено'); },
  skUndo: () => skUndo(), skRedo: () => skRedo(),
  skLayer: (d) => { S.skin.layer = d.v; skRerender(); },
  skGrid: () => { S.skin.grid = !S.skin.grid; skRerender(); },
  skRegions: () => { S.skin.regions = !S.skin.regions; skRerender(); },
  skZoom: (d) => { S.skin.zoom = Math.max(5, Math.min(14, S.skin.zoom + Number(d.v))); skResize(); },
  skSlim: () => { S.skin.slim = !S.skin.slim; skRerender(); },
  skPose: () => { const p = $('#skPrev'); if (p) p.classList.toggle('still'); },
  skCol: (d) => { S.skin.color = d.c; if (S.skin.tool === 'eraser' || S.skin.tool === 'picker') S.skin.tool = 'pencil'; skSyncColor(); $$('.sk-tool[data-act="skTool"]').forEach((b) => b.classList.toggle('on', b.dataset.v === S.skin.tool)); },
  skTemplate: async () => { if (!(await confirmSheet('Новый шаблон?', 'Текущий рисунок заменится базовым шаблоном (можно отменить через Ctrl+Z).', 'Заменить'))) return; skSnapshot(); const u = S.skin.undo; skTemplate(); S.skin.undo = u; skRerender(); },
  skMine: async () => {
    const a = S.accounts.find((x) => x.name === accountName()) || S.accounts[0];
    if (!a) return toast('Аккаунт не найден — добавьте его в Prism', true);
    const r = await attempt(() => call('skin:fetch', a.uuid, a.name)); if (!r) return;
    await attempt(() => skLoadData(r.data, { slim: r.slim, name: a.name }), 'Загружен скин ' + a.name); skRerender();
  },
  skMirrorLimbs: () => {
    skSnapshot();
    const copy = (sx, sy, dx, dy, w, h, d) => {
      // переносим грани с зеркалированием по горизонтали, меняя местами боковые грани
      const W = w, faces = [[d, 0, W, d], [d + W, 0, W, d], [0, d, d, h], [d, d, W, h], [d + W, d, d, h], [d + W + d, d, W, h]];
      const map = [0, 1, 4, 3, 2, 5];
      faces.forEach((f, k) => { const t = faces[map[k]]; for (let j = 0; j < f[3]; j++) for (let i = 0; i < f[2]; i++) skSet(dx + t[0] + (t[2] - 1 - i), dy + t[1] + j, skGet(sx + f[0] + i, sy + f[1] + j)); });
    };
    const aw = S.skin.slim ? 3 : 4;
    copy(40, 16, 32, 48, aw, 12, 4); copy(40, 32, 48, 48, aw, 12, 4); copy(0, 16, 16, 48, 4, 12, 4); copy(0, 32, 0, 48, 4, 12, 4);
    skDraw(); skPreview(true); toast('Левые рука и нога стали зеркальной копией правых');
  },
  skClearOv: () => { skSnapshot(); for (const f of skFaces(S.skin.slim)) if (f.layer === 'ov') for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) skSet(f.x + i, f.y + j, [0, 0, 0, 0]); skDraw(); skPreview(true); },
  skOpen: async () => {
    const lib = await call('skin:lib:list').catch(() => []);
    const a = S.accounts.find((x) => x.name === accountName()) || S.accounts[0];
    showSheet(`<h2>Открыть скин</h2>
      <div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn glass light spring" data-act="skImport">${svg('file', 16)}Импорт PNG</button>${a ? `<button class="btn glass light spring" data-act="skMineSheet">${svg('user', 16)}Скин ${esc(a.name)}</button>` : ''}<button class="btn glass light spring" data-act="skTemplateSheet">${svg('plus', 16, 2.4)}Новый шаблон</button></div>
      <div class="section-title" style="margin:8px 0 0">Библиотека</div>
      ${lib.length ? `<div class="sk-lib">${lib.map((x) => `<div class="sk-lib-item"><button data-act="skLibLoad" data-id="${esc(x.id)}" aria-label="${esc(x.name)}"><canvas class="sk-head" data-src="${esc(x.data)}" width="64" height="64"></canvas><span>${esc(x.name)}</span></button><button class="btn small icon glass light spring" data-act="skLibDel" data-id="${esc(x.id)}" aria-label="Удалить ${esc(x.name)}">${svg('trash', 14)}</button></div>`).join('')}</div>` : '<div class="muted">Пока пусто — нажмите «В библиотеку», чтобы сохранить текущий скин.</div>'}
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Закрыть</button></div>`);
    S.skin.lib = lib;
    for (const c of $$('.sk-head')) { const img = new Image(); img.onload = () => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 8, 8, 8, 8, 0, 0, 64, 64); g.drawImage(img, 40, 8, 8, 8, 0, 0, 64, 64); }; img.src = c.dataset.src; }
  },
  skImport: async () => { const r = await attempt(() => call('skin:import')); if (!r) return; closeSheet(); await attempt(() => skLoadData(r.data, { name: r.name }), 'Скин открыт'); skRerender(); },
  skMineSheet: async () => { closeSheet(); await ACT.skMine(); },
  skTemplateSheet: () => { closeSheet(); skSnapshot(); const u = S.skin.undo; skTemplate(); S.skin.undo = u; skRerender(); },
  skLibLoad: async (d) => { const x = (S.skin.lib || []).find((y) => y.id === d.id); if (!x) return; closeSheet(); await attempt(() => skLoadData(x.data, { slim: x.slim, name: x.name, id: x.id }), 'Открыт «' + x.name + '»'); skRerender(); },
  skLibDel: async (d) => { await call('skin:lib:delete', d.id); closeSheet(); ACT.skOpen(); },
  skLibSave: async () => { const id = await attempt(() => call('skin:lib:save', skDataUrl(), S.skin.name, S.skin.slim, S.skin.id), 'Сохранено в библиотеку'); if (id) S.skin.id = id; },
  skExport: async () => { await attempt(() => call('skin:export', skDataUrl(), S.skin.name)); },
  skUpload: async () => {
    const f = await attempt(() => call('skin:export', skDataUrl(), S.skin.name)); if (!f) return;
    showSheet(`<h2>Надеть скин в игре</h2><p class="muted" style="margin:0;line-height:1.6;font-size:15px">Файл сохранён:<br><b style="color:var(--text);word-break:break-all">${esc(f)}</b><br><br>Сейчас откроется minecraft.net. Войдите, нажмите «Загрузить файл», выберите этот PNG и укажите модель <b style="color:var(--text)">${S.skin.slim ? 'Тонкая (Alex)' : 'Классическая (Steve)'}</b>. В Prism Launcher скин также можно сменить: «Аккаунты» → «Управление скинами».</p>
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Закрыть</button><button class="btn primary spring" data-act="url" data-url="https://www.minecraft.net/msaprofile/mygames/editskin">Открыть minecraft.net</button></div>`);
  }
});
document.addEventListener('keydown', (e) => {
  if (S.page !== 'skineditor' || $('#overlay.show') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? skRedo() : skUndo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); skRedo(); return; }
  if (ctrl) return;
  const tool = { p: 'pencil', e: 'eraser', f: 'fill', i: 'picker', s: 'shade', n: 'noise' }[k];
  if (tool) { S.skin.tool = tool; skRerender(); }
  if (k === 'g') ACT.skGrid();
  if (k === 'm') ACT.skMirror();
  if (['1', '2', '3'].includes(k)) ACT.skSize({ v: k });
});
