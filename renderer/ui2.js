'use strict';
/* Prism Launcher Deluxe — расширенный интерфейс: игра, логи, краши, серверы, друзья, профиль, обновления модов,
   страница мода, наборы, обложки, группы, бэкапы, экспорт, звуки, тема, палитра команд. */
S.running = {}; S.servers = []; S.srvStatus = {}; S.kits = []; S.modsExtraHtml = ''; S.friendsData = null; S.project = null;

// ================= звуки =================
let actx;
function sfx(kind) {
  if (S.cfg.sounds === false) return;
  try {
    actx = actx || new AudioContext();
    const t = actx.currentTime;
    const tone = (f, st, dur, type = 'sine', vol = .05, slide) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + st); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + st + dur);
      g.gain.setValueAtTime(0, t + st); g.gain.linearRampToValueAtTime(vol, t + st + .01); g.gain.exponentialRampToValueAtTime(.0001, t + st + dur);
      o.connect(g).connect(actx.destination); o.start(t + st); o.stop(t + st + dur + .03);
    };
    if (kind === 'click') tone(1700, 0, .045, 'sine', .02, 1100);
    else if (kind === 'ok') { tone(880, 0, .14, 'sine', .035); tone(1320, .07, .18, 'sine', .03); }
    else if (kind === 'error') tone(240, 0, .22, 'triangle', .045, 150);
    else if (kind === 'launch') { tone(160, 0, .6, 'sine', .06, 880); tone(320, .06, .5, 'triangle', .02, 1500); tone(1760, .45, .25, 'sine', .02); }
    else if (kind === 'open') tone(620, 0, .09, 'sine', .02, 940);
  } catch { }
}
document.addEventListener('pointerdown', (e) => { if (e.target.closest('button, [role=button], .bg-tile')) sfx('click'); }, true);

// ================= таймеры =================
function fmtDur(ms) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
setInterval(() => { for (const el of $$('[data-timer]')) el.textContent = fmtDur(Date.now() - Number(el.dataset.timer)); }, 1000);

// ================= статус игры =================
api.on('game', async (d) => {
  const i = instById(d.id); const name = i ? i.name : d.id;
  if (d.state === 'running') {
    S.running[d.id] = { start: d.start }; delete S.launching[d.id];
    toast(`«${name}» запущен`); rerenderMain();
  } else if (d.state === 'stopped') {
    delete S.running[d.id];
    await loadInstances().catch(() => { }); rerenderMain();
    if (d.crashed && d.crash) showCrash(d.id, d.crash);
    else if (d.duration > 20) showSummary(name, d.duration);
  } else if (d.state === 'timeout') { delete S.launching[d.id]; rerenderMain(); }
});
function showSummary(name, sec) {
  const i = S.instances.find((x) => x.name === name);
  showSheet(`<div class="summary"><span class="icon-box" style="width:84px;height:84px;border-radius:26px;background:rgba(var(--accent-rgb),.9)">${svg('heart', 40, 1.8)}</span>
    <h2>Отличная сессия!</h2><p class="muted" style="margin:0;font-size:15px">«${esc(name)}»</p>
    <div class="row" style="gap:12px;justify-content:center;flex-wrap:wrap"><span class="stat"><b>${esc(fmtPlayed(sec))}</b><small>эта сессия</small></span>${i ? `<span class="stat"><b>${esc(fmtPlayed(i.played))}</b><small>всего наиграно</small></span>` : ''}</div>
    <div class="actions" style="justify-content:center"><button class="btn primary spring" data-act="sheet:cancel">Готово</button></div></div>`);
}

// ================= логи =================
let logTimer = null;
function openLogs(id) {
  const i = instById(id);
  S.logs = { id, size: -1, lines: [], rest: '', filter: '', level: 'all' };
  showSheet(`<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px"><h2>Логи · ${esc(i ? i.name : id)}</h2>
    <div class="row" style="gap:8px"><button class="btn small glass light spring" data-act="logsFolder">${svg('folder', 15)}Папка</button><button class="btn small primary spring" data-act="crashCheck" data-id="${esc(id)}">${svg('warn', 15, 2.4)}Почему крашнулось?</button></div></div>
    <div class="row" style="gap:10px;flex-wrap:wrap"><label class="field glass light grow" style="height:40px">${svg('search', 16)}<input id="logQ" placeholder="Фильтр по тексту" aria-label="Фильтр"></label>
    <div class="seg glass light"><span class="seg-ind"></span><button class="on" data-act="loglvl" data-v="all">Все</button><button data-act="loglvl" data-v="warn">Предупреждения</button><button data-act="loglvl" data-v="error">Ошибки</button></div></div>
    <pre id="logBox" class="logbox" tabindex="0"><span class="dim">Загрузка…</span></pre>`, () => { clearInterval(logTimer); S.logs = null; });
  $('#overlay .sheet').classList.add('wide');
  $('#logQ').addEventListener('input', (e) => { S.logs.filter = e.target.value.toLowerCase(); renderLogs(true); });
  pullLogs(); clearInterval(logTimer); logTimer = setInterval(pullLogs, 1000);
}
async function pullLogs() {
  const L = S.logs; if (!L) return;
  let r; try { r = await call('logs:read', L.id, L.size); } catch { return; }
  if (!S.logs) return;
  if (r.missing) { $('#logBox').innerHTML = '<span class="dim">Лог появится после первого запуска игры.</span>'; return; }
  if (r.reset) { L.lines = []; L.rest = ''; }
  L.size = r.size;
  if (!r.text && !r.reset) return;
  const parts = (L.rest + r.text).split(/\r?\n/);
  L.rest = parts.pop();
  L.lines.push(...parts);
  if (L.lines.length > 6000) L.lines.splice(0, L.lines.length - 6000);
  renderLogs();
}
function renderLogs(force) {
  const L = S.logs, box = $('#logBox'); if (!L || !box) return;
  const nearBottom = force || box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const isErr = (l) => /\b(ERROR|FATAL|SEVERE)\b|Exception|Caused by:|^\s+at /.test(l);
  const isWarn = (l) => /\bWARN(ING)?\b/.test(l);
  let lines = L.lines;
  if (L.level === 'error') lines = lines.filter(isErr); else if (L.level === 'warn') lines = lines.filter((l) => isErr(l) || isWarn(l));
  if (L.filter) lines = lines.filter((l) => l.toLowerCase().includes(L.filter));
  lines = lines.slice(-2500);
  box.innerHTML = lines.length ? lines.map((l) => `<span class="${isErr(l) ? 'le' : isWarn(l) ? 'lw' : ''}">${esc(l)}</span>`).join('\n') : '<span class="dim">Нет строк</span>';
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

// ================= разбор крашей =================
function showCrash(id, c) {
  const i = instById(id);
  S.crash = { id, c };
  showSheet(`<div class="row" style="gap:16px"><span class="icon-box" style="width:64px;height:64px;border-radius:20px;background:linear-gradient(180deg,#ff7a82,#ff4d58);color:#fff">${svg('warn', 30, 2)}</span>
    <div class="grow"><h2>${esc(c.title || 'Игра вылетела')}</h2><div class="muted" style="margin-top:4px">«${esc(i ? i.name : id)}»</div></div></div>
    ${c.details && c.details.length ? `<div class="crash-box">${c.details.map((d) => `<div>${esc(d)}</div>`).join('')}</div>` : ''}
    ${c.missing && c.missing.length ? `<div><div class="section-title" style="margin:6px 0 10px">Не хватает модов</div>${c.missing.map((m) => `<div class="item"><div class="grow"><div class="t">${esc(m.mod)}</div><div class="s">нужен для ${esc(m.by)} · версия ${esc(m.need)}${m.have && !/MISSING|нет/.test(m.have) ? ' · установлена ' + esc(m.have) : ''}</div></div><button class="btn small primary spring" data-act="findMod" data-q="${esc(m.mod)}" data-id="${esc(id)}">${svg('search', 14, 2.4)}Найти</button></div>`).join('')}</div>` : ''}
    ${c.suspects && c.suspects.length ? `<div><div class="section-title" style="margin:6px 0 10px">Подозреваемые моды</div>${c.suspects.map((m, k) => `<div class="item"><div class="grow"><div class="t">${esc(m)}</div>${c.suspectFiles && c.suspectFiles[k] ? `<div class="s">${esc(c.suspectFiles[k])}</div>` : ''}</div>${c.suspectFiles && c.suspectFiles[k] ? `<button class="btn small glass light spring" data-act="disableMod" data-file="${esc(c.suspectFiles[k])}" data-id="${esc(id)}">Отключить</button>` : ''}</div>`).join('')}</div>` : ''}
    ${c.fixes && c.fixes.length ? `<div class="fixes">${c.fixes.map((f) => `<button class="fix spring" data-act="crashFix" data-v="${esc(f.act)}" data-id="${esc(id)}">${svg('check', 16, 2.6)}<span>${esc(f.label)}</span></button>`).join('')}</div>` : ''}
    <div class="actions">${c.file ? `<button class="btn glass light spring" data-act="crashFile" data-file="${esc(c.file)}">${svg('file', 16)}Полный отчёт</button>` : ''}<button class="btn glass light spring" data-act="logs" data-id="${esc(id)}">${svg('terminal', 16)}Логи</button><button class="btn primary spring" data-act="sheet:cancel">Понятно</button></div>`);
}

// ================= вкладки экземпляра =================
const _tabBody = tabBody;
tabBody = function (i) {
  if (S.tab === 'servers') return serversTab(i);
  if (S.tab === 'worlds') return worldsTab(i);
  if (S.tab === 'shots') return shotsTab(i);
  let html = _tabBody(i);
  if (S.tab === 'mod') html = html.replace('<div id="modsExtra"></div>', `<div id="modsExtra">${S.modsExtraHtml || kitsHtml(i)}</div>`);
  if (S.tab === 'settings') html = html.replace('<div class="cols stagger">', `<div class="cols stagger">${instLookPanel(i)}`);
  return html;
};
const _loadTab = loadTab;
loadTab = async function (noRender) {
  await _loadTab(noRender);
  if (S.tab === 'mod') { S.modsExtraHtml = ''; setTimeout(fillModsExtra, 0); }
  if (S.tab === 'servers') { S.servers = await call('servers:list', S.inst).catch(() => []); if (!noRender) { const b = $('#tabBody'); if (b) b.innerHTML = serversTab(instById(S.inst)); } setTimeout(pingServers, 0); }
};

function serversTab(i) {
  return `<div class="row" style="margin-bottom:14px;justify-content:space-between;flex-wrap:wrap;gap:10px"><span class="muted">Серверы из списка мультиплеера этого экземпляра. «Играть» запускает игру сразу на сервере.</span>
    <div class="row"><button class="btn glass light spring" data-act="pingAll">${svg('refresh', 16, 2.4)}Обновить</button><button class="btn primary spring" data-act="addServer">${svg('plus', 16, 2.6)}Добавить сервер</button></div></div>
    <div class="list glass">${S.servers.length ? `<div class="stagger">${S.servers.map((s) => serverRow(s)).join('')}</div>` : `<div class="empty">${svg('server', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Серверов пока нет</div><div style="margin-top:6px">Добавьте адрес сервера — он появится и в игре.</div></div>`}</div>`;
}
function serverRow(s) {
  const st = S.srvStatus[s.ip];
  const fav = (st && st.favicon) || (s.icon ? 'data:image/png;base64,' + s.icon : '');
  const chip = !st ? '<span class="chip"><span class="spinner" style="width:12px;height:12px;border-width:2px"></span>Проверка</span>'
    : st.online ? `<span class="chip"><span class="dot" style="background:var(--ok)"></span>${st.players}/${st.max} · ${st.ping} мс</span>` : '<span class="chip"><span class="dot" style="background:var(--danger)"></span>Не в сети</span>';
  return `<div class="item" data-srv="${esc(s.ip)}">${iconBox(fav, s.name, 48, 12)}
    <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.ip)}${st && st.online && st.motd ? ' · ' + esc(st.motd.slice(0, 90)) : ''}${st && st.online && st.version ? ' · ' + esc(st.version) : ''}</div></div>
    ${chip}<button class="btn small icon glass light spring" data-act="delServer" data-ip="${esc(s.ip)}" aria-label="Удалить ${esc(s.name)}">${svg('trash', 15)}</button>
    <button class="btn small primary spring" data-act="joinServer" data-ip="${esc(s.ip)}">${svgFill('play', 13)}Играть</button></div>`;
}
async function pingServers() {
  const list = S.servers.slice();
  await Promise.all(list.map(async (s) => {
    S.srvStatus[s.ip] = await call('servers:ping', s.ip).catch(() => ({ online: false }));
    const row = $(`[data-srv="${CSS.escape(s.ip)}"]`);
    if (row) { const t = document.createElement('div'); t.innerHTML = serverRow(s); row.replaceWith(t.firstElementChild); }
  }));
}

function worldsTab(i) {
  return `<div class="row" style="margin-bottom:14px;justify-content:space-between;flex-wrap:wrap;gap:10px"><span class="muted">${S.cfg.autoBackup ? 'Автобэкап перед запуском включён' : 'Совет: включите автобэкап миров в настройках'}</span><button class="btn glass light spring" data-act="sfolder" data-sub="saves">${svg('folder', 18)}Папка миров</button></div>
    <div class="list glass">${S.worlds.length ? `<div class="stagger">${S.worlds.map((w) => `<div class="item">${iconBox(w.icon, w.name, 48, 12)}<div class="grow"><div class="t">${esc(w.name)}</div><div class="s">Изменён ${esc(fmtAgo(w.modified))}</div></div>
      <button class="btn small glass light spring" data-act="wBackups" data-w="${esc(w.name)}">${svg('archive', 15)}Бэкапы</button>
      <button class="btn small primary spring" data-act="wBackup" data-w="${esc(w.name)}">${svg('download', 15, 2.4)}Бэкап</button>
      <button class="btn small icon glass light spring" data-act="wFolder" data-w="${esc(w.name)}" aria-label="Папка мира">${svg('folder', 15)}</button>
      <button class="btn small icon glass light spring" data-act="wDelete" data-w="${esc(w.name)}" aria-label="Удалить мир">${svg('trash', 15)}</button></div>`).join('')}</div>` : `<div class="empty">${svg('globe', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Миров пока нет</div></div>`}</div>`;
}
function shotsTab(i) {
  return `<div class="row" style="margin-bottom:14px;justify-content:space-between"><span class="muted">Наведите на скриншот, чтобы сделать его обложкой экземпляра.</span><button class="btn glass light spring" data-act="sfolder" data-sub="screenshots">${svg('folder', 18)}Папка скриншотов</button></div>
    ${S.shots.length ? `<div class="shots stagger">${S.shots.map((s) => `<div class="shot"><button data-act="viewshot" data-url="${esc(s.url)}" aria-label="${esc(s.name)}"><img src="${esc(s.url)}" alt="" loading="lazy"></button><button class="btn small glass strong spring shot-cover" data-act="coverShot" data-url="${esc(s.url)}">${svg('image', 14)}Обложка</button></div>`).join('')}</div>` : `<div class="list glass"><div class="empty">${svg('image', 44, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Скриншотов пока нет</div><div style="margin-top:6px">В игре нажмите F2.</div></div></div>`}`;
}
function instLookPanel(i) {
  const groups = [...new Set(S.instances.map((x) => x.group).filter(Boolean))];
  return `<div class="panel glass"><h3>Оформление и организация</h3>
    <div class="set-row"><div class="row" style="gap:14px">${iconBox(i.icon, i.name, 56)}<div><div class="t">Иконка</div><div class="s">PNG или JPG, лучше квадратная</div></div></div><button class="btn small glass light spring" data-act="setIcon">Сменить</button></div>
    <div class="set-row"><div class="row" style="gap:14px"><span class="cover-prev" style="${i.cover ? `background-image:url('${esc(i.cover)}')` : ''}"></span><div><div class="t">Обложка</div><div class="s">Фон карточки экземпляра</div></div></div><div class="row">${i.cover ? `<button class="btn small icon glass light spring" data-act="clearCover" aria-label="Убрать обложку">${svg('x', 14, 2.4)}</button>` : ''}<button class="btn small glass light spring" data-act="setCover">Выбрать</button></div></div>
    <label class="lbl">Группа<div class="row"><input class="input" id="grpName" list="grpList" value="${esc(i.group)}" placeholder="Без группы"><datalist id="grpList">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist><button class="btn glass light spring" data-act="saveGroup">Сохранить</button></div></label>
    <div class="set-row"><div><div class="t">Экспорт в .mrpack</div><div class="s">Поделиться сборкой с друзьями</div></div><button class="btn small glass light spring" data-act="export" data-id="${esc(i.id)}">${svg('share', 15)}Экспорт</button></div>
  </div>`;
}

// ================= моды: наборы, обновления, здоровье =================
function kitsHtml(i) {
  if (!i || i.loader === 'vanilla') return '';
  if (!S.kits.length) { call('kits:list').then((k) => { S.kits = k; const el = $('#kitRow'); if (el) el.outerHTML = kitsHtml(instById(S.inst)); }).catch(() => { }); return '<div id="kitRow"></div>'; }
  return `<div id="kitRow" class="kits">${S.kits.map((k) => `<button class="kit glass spring" data-act="kit" data-kit="${k.id}"><span class="icon-box" style="width:40px;height:40px;border-radius:13px;background:rgba(var(--accent-rgb),.9)">${svg(k.icon, 20, 2)}</span><span class="grow"><b>${esc(k.title)}</b><small>${esc(k.desc)}</small></span>${svg('plus', 16, 2.6)}</button>`).join('')}</div>`;
}
async function fillModsExtra() {
  const el = $('#modsExtra'); const i = instById(S.inst); if (!el || !i) return;
  el.innerHTML = kitsHtml(i) + `<div class="scan glass"><span class="spinner"></span><span>Проверяю обновления и совместимость модов…</span></div>`;
  let r, rb;
  try { [r, rb] = await Promise.all([call('mods:scan', i.id), call('mods:rollbackInfo', i.id).catch(() => null)]); }
  catch (e) { S.modsExtraHtml = kitsHtml(i) + `<div class="scan glass">${svg('warn', 18)}<span>Не удалось проверить моды: ${esc(e.message)}</span></div>`; if ($('#modsExtra')) $('#modsExtra').innerHTML = S.modsExtraHtml; return; }
  S.scan = r;
  let h = kitsHtml(i);
  const issues = r.missing.length + r.conflicts.length + r.wrongLoader.length + r.dupes.length;
  if (r.updates.length) h += `<div class="panel glass upd"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px"><div class="row" style="gap:12px"><span class="icon-box" style="width:42px;height:42px;border-radius:14px;background:rgba(var(--accent-rgb),.9)">${svg('download', 20, 2.4)}</span><div><div class="t" style="font-size:16px;font-weight:700">Доступны обновления: ${r.updates.length}</div><div class="s muted">Старые версии сохранятся — можно откатить</div></div></div><button class="btn primary spring" data-act="updAll">${svg('refresh', 16, 2.4)}Обновить все</button></div>
    <div class="upd-list">${r.updates.map((u) => `<div class="upd-item">${iconBox(u.icon, u.title, 28, 8)}<span class="grow">${esc(u.title)}</span><span class="dim">${esc(String(u.from).slice(0, 24))} → <b style="color:var(--text)">${esc(String(u.to).slice(0, 24))}</b></span></div>`).join('')}</div></div>`;
  if (issues) {
    h += `<div class="panel glass warnp"><div class="row" style="gap:12px"><span class="icon-box" style="width:42px;height:42px;border-radius:14px;background:rgba(255,180,64,.95)">${svg('warn', 20, 2.2)}</span><div class="t" style="font-size:16px;font-weight:700">Найдены проблемы: ${issues}</div></div>
      ${r.missing.map((m) => `<div class="item">${iconBox(m.icon, m.title || m.projectId, 36, 10)}<div class="grow"><div class="t">Не хватает: ${esc(m.title || m.projectId)}</div><div class="s">Нужен для: ${esc(m.by.join(', '))}</div></div><button class="btn small primary spring" data-act="installDep" data-pid="${esc(m.projectId)}" data-title="${esc(m.title || '')}">${svg('download', 14, 2.4)}Установить</button></div>`).join('')}
      ${r.conflicts.map((c) => `<div class="item"><div class="grow"><div class="t">Несовместимы: ${esc(c.a)} и ${esc(c.b)}</div><div class="s">Оставьте только один из них</div></div><button class="btn small glass light spring" data-act="disableMod" data-file="${esc(c.fileB)}" data-id="${esc(i.id)}">Отключить ${esc(c.b)}</button></div>`).join('')}
      ${r.wrongLoader.map((w) => `<div class="item"><div class="grow"><div class="t">${esc(w.title)} — для другого загрузчика</div><div class="s">Мод для ${esc(w.loaders.join(', '))}, а экземпляр на ${esc(LOADER_NAME[i.loader])}</div></div><button class="btn small glass light spring" data-act="disableMod" data-file="${esc(w.file)}" data-id="${esc(i.id)}">Отключить</button></div>`).join('')}
      ${r.dupes.map((d) => `<div class="item"><div class="grow"><div class="t">Дубликат мода</div><div class="s">${esc(d[0])} и ${esc(d[1])}</div></div><button class="btn small glass light spring" data-act="disableMod" data-file="${esc(d[1])}" data-id="${esc(i.id)}">Отключить второй</button></div>`).join('')}</div>`;
  }
  if (!r.updates.length && !issues) h += `<div class="scan glass ok">${svg('check', 18, 2.6)}<span>Всё актуально и совместимо · опознано ${r.identified} из ${r.total} модов</span>${rb ? `<button class="btn small glass light spring" data-act="rollback" data-stamp="${esc(rb.stamp)}" style="margin-left:auto">Откатить обновление (${rb.count})</button>` : ''}</div>`;
  else if (rb) h += `<div class="row" style="justify-content:flex-end;margin:-6px 0 14px"><button class="btn small glass light spring" data-act="rollback" data-stamp="${esc(rb.stamp)}">Откатить последнее обновление (${rb.count})</button></div>`;
  S.modsExtraHtml = h;
  const e2 = $('#modsExtra'); if (e2 && S.tab === 'mod' && S.inst === i.id) e2.innerHTML = h;
  if (r.identified) { S.content = await call('content:list', i.id, 'mod').catch(() => S.content); const list = $('#tabBody .list'); if (list && !S.contentFilter) list.innerHTML = `<div>${S.content.map(contentRow).join('')}</div>`; }
}

// ================= страница проекта (мода) =================
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'A', 'IMG', 'CODE', 'PRE', 'BLOCKQUOTE', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'DETAILS', 'SUMMARY', 'SPAN', 'DIV', 'CENTER', 'SUP', 'SUB', 'KBD', 'MARK', 'SMALL']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'VIDEO', 'AUDIO', 'SVG', 'MATH']);
  const walkN = (n) => {
    for (const c of [...n.children]) {
      if (DROP.has(c.tagName)) { c.remove(); continue; }
      walkN(c);
      if (!OK.has(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      const href = c.getAttribute('href'), src = c.getAttribute('src'), w = c.getAttribute('width'), alt = c.getAttribute('alt');
      for (const a of [...c.attributes]) c.removeAttribute(a.name);
      if (c.tagName === 'A' && href && /^https:\/\//.test(href)) { c.setAttribute('data-act', 'url'); c.setAttribute('data-url', href); c.setAttribute('href', '#'); }
      if (c.tagName === 'IMG') { if (src && /^https:\/\//.test(src)) { c.setAttribute('src', src); c.setAttribute('loading', 'lazy'); if (w && /^\d+$/.test(w)) c.setAttribute('width', w); if (alt) c.setAttribute('alt', alt); } else c.remove(); }
    }
  };
  const root = doc.getElementById('r'); walkN(root);
  return root.innerHTML;
}
function mdToHtml(md) {
  const blocks = []; let s = String(md || '').replace(/\r/g, '');
  s = s.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, c) => { blocks.push('<pre><code>' + esc(c) + '</code></pre>'); return '\u0000' + (blocks.length - 1) + '\u0000'; });
  const inline = (t) => t.replace(/`([^`]+)`/g, (_, c) => '<code>' + esc(c) + '</code>')
    .replace(/!\[([^\]]*)\]\((https:[^)\s]+)[^)]*\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\((https:[^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/~~([^~]+)~~/g, '<s>$1</s>');
  const out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (list) { out.push(`<${list.t}>` + list.items.map((x) => '<li>' + inline(x) + '</li>').join('') + `</${list.t}>`); list = null; } };
  for (const line of s.split('\n')) {
    let m;
    if (/^\u0000\d+\u0000$/.test(line.trim())) { flush(); out.push(line.trim()); }
    else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { if (para.length) { const l = list; list = null; flush(); list = l; } if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); }
    else if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flush(); out.push('<hr>'); }
    else if (/^\s*>\s?/.test(line)) { flush(); out.push('<blockquote>' + inline(line.replace(/^\s*>\s?/, '')) + '</blockquote>'); }
    else if (!line.trim()) flush();
    else if (/^\s*<(div|p|center|img|h\d|ul|ol|table|details|summary|br|hr|blockquote|pre)\b/i.test(line)) { flush(); out.push(inline(line)); }
    else { if (list) flush(); para.push(line); }
  }
  flush();
  return out.join('\n').replace(/\u0000(\d+)\u0000/g, (_, n) => blocks[n]);
}
async function openProject(source, id, from) {
  S.project = { source, id, loading: true, tab: 'desc', from: from || S.page, data: null };
  S.page = 'project'; render();
  try { S.project.data = await call('project:get', source, id); } catch (e) { S.project.error = e.message; }
  S.project.loading = false;
  if (S.page === 'project') render(true);
}
PAGES.project = function () {
  const P = S.project; if (!P) return '';
  const back = `<div class="row" style="margin:14px 0 18px"><button class="btn small glass light spring" data-act="projBack">${svg('back', 16, 2.4)}Назад</button></div>`;
  if (P.loading) return back + '<div class="skeleton" style="height:180px"></div><div class="skeleton" style="height:340px;margin-top:18px"></div>';
  if (P.error) return back + `<div class="list glass"><div class="empty">${svg('warn', 44, 1.6)}<div>${esc(P.error)}</div></div></div>`;
  const d = P.data, B = S.browse, target = instById(B.target), isPack = B.type === 'modpack' || d.type === 'modpack';
  const key = d.source + ':' + d.id;
  const st = S.installing[key] ? 'busy' : S.installed[key] ? 'done' : '';
  const body = d.bodyHtml ? sanitizeHtml(d.bodyHtml) : sanitizeHtml(mdToHtml(d.body));
  const tabs = [['desc', 'Описание'], ['gallery', 'Галерея' + (d.gallery.length ? ' ' + d.gallery.length : '')], ['versions', 'Версии']];
  const okVer = (v) => !target || isPack || ((!target.mc || !v.game.length || v.game.includes(target.mc)) && (B.type !== 'mod' || !v.loaders.length || v.loaders.map((x) => x.toLowerCase()).includes(target.loader)));
  return back + `<div class="hero glass"><div class="glow"></div>${iconBox(d.icon, d.title, 96, 26)}
    <div class="grow"><h2>${esc(d.title)}</h2><div class="muted" style="margin-top:6px;font-size:15px">${esc(d.desc || '')}</div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${d.author ? `<span class="chip">${svg('user', 13)}${esc(d.author)}</span>` : ''}<span class="chip">${svg('download', 13, 2.4)}${fmtNum(d.downloads || 0)}</span>${(d.categories || []).slice(0, 4).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
    <div class="row">${d.url ? `<button class="btn icon glass light spring" data-act="url" data-url="${esc(d.url)}" aria-label="Открыть на сайте">${svg('link', 18)}</button>` : ''}
    ${st === 'busy' ? '<button class="play-btn" disabled><span class="spinner"></span><span>Установка</span></button>' : st === 'done' ? `<button class="play-btn" disabled>${svg('check', 20, 3)}<span>Установлено</span></button>` : `<button class="play-btn" data-act="projInstall"><span class="shine"></span>${svg('download', 20, 2.6)}<span>${isPack ? 'Установить модпак' : target ? 'В «' + esc(target.name.slice(0, 18)) + '»' : 'Скачать'}</span></button>`}</div></div>
    <div class="tabs glass" style="margin:22px 0 18px"><span class="tab-ind"></span>${tabs.map(([k, t]) => `<button class="${P.tab === k ? 'on' : ''}" data-act="projTab" data-tab="${k}">${t}</button>`).join('')}</div>
    <div class="page">${P.tab === 'desc' ? `<div class="panel glass md">${body || '<span class="muted">Описания нет</span>'}</div>`
      : P.tab === 'gallery' ? (d.gallery.length ? `<div class="shots stagger">${d.gallery.map((g) => `<button data-act="viewshot" data-url="${esc(g.url)}" aria-label="${esc(g.title || 'Изображение')}"><img src="${esc(g.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : '<div class="list glass"><div class="empty">Картинок нет</div></div>')
        : `<div class="list glass"><div class="stagger">${d.versions.map((v) => `<div class="item ${okVer(v) ? '' : 'off'}"><div class="grow"><div class="t">${esc(v.name || v.number)}</div><div class="s">${esc((v.game || []).slice(0, 6).join(', '))}${v.loaders && v.loaders.length ? ' · ' + esc(v.loaders.join(', ')) : ''} · ${esc(new Date(v.date).toLocaleDateString('ru-RU'))}${v.type !== 'release' ? ' · ' + esc(v.type) : ''}</div></div>${!isPack && target ? `<button class="btn small ${okVer(v) ? 'primary' : 'glass light'} spring" data-act="projVer" data-v="${esc(v.id)}">${svg('download', 14, 2.4)}Установить</button>` : ''}</div>`).join('')}</div></div>`}</div>`;
};
// карточка результата поиска — кликабельная
resultCard = function (h) {
  const key = h.source + ':' + h.id;
  const st = S.installing[key] ? 'busy' : S.installed[key] ? 'done' : '';
  const isPack = S.browse.type === 'modpack';
  const btn = st === 'busy' ? `<button class="btn small glass light" disabled><span class="spinner"></span>Установка</button>`
    : st === 'done' ? `<button class="btn small glass light" disabled>${svg('check', 15, 3)}Установлено</button>`
      : `<button class="btn small primary spring" data-act="install" data-key="${esc(key)}">${svg('download', 15, 2.4)}${isPack ? 'Установить' : 'Скачать'}</button>`;
  return `<div class="result glass" role="button" tabindex="0" data-act="openProj" data-src="${esc(h.source)}" data-pid="${esc(h.id)}">${iconBox(h.icon, h.title, 64, 18)}
    <div class="grow"><div class="t">${esc(h.title)}</div><div class="d">${esc(h.desc)}</div>
    <div class="row" style="margin-top:10px;justify-content:space-between"><span class="s">${h.author ? esc(h.author) + ' · ' : ''}${fmtNum(h.downloads)} загрузок</span>
    <span class="row" style="gap:6px">${btn}</span></div></div></div>`;
};

// ================= экземпляры: сортировка, закреплённые, группы =================
PAGES.instances = function () {
  const f = S.instFilter.toLowerCase();
  const sort = S.cfg.sortBy || 'recent';
  let list = S.instances.filter((i) => !f || i.name.toLowerCase().includes(f) || (i.mc || '').includes(f) || (i.loader || '').includes(f));
  list = list.slice().sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'played' ? (a, b) => b.played - a.played : (a, b) => (b.lastLaunch - a.lastLaunch) || a.name.localeCompare(b.name));
  const pinned = list.filter((i) => i.pinned);
  const groups = {};
  for (const i of list) if (!i.pinned) (groups[i.group || ''] = groups[i.group || ''] || []).push(i);
  const names = Object.keys(groups).filter(Boolean).sort();
  const section = (title, arr, extra = '') => arr.length || extra ? `${title ? `<div class="section-title">${title}</div>` : ''}<div class="grid stagger">${arr.map(instCard).join('')}${extra}</div>` : '';
  return `${prismWarning()}<div class="page-head"><div><h1>Экземпляры</h1><p>Общие с Prism Launcher: всё, что вы создаёте здесь, видно и там.</p></div>
    <div class="row" style="flex-wrap:wrap"><label class="field glass" style="width:230px">${svg('search', 18)}<input data-input="instFilter" placeholder="Поиск" value="${esc(S.instFilter)}" aria-label="Поиск экземпляров"></label>
    <select class="input glass" style="width:190px;height:46px;border-radius:99px" data-change="sortBy" aria-label="Сортировка"><option value="recent" ${sort === 'recent' ? 'selected' : ''}>Недавние</option><option value="name" ${sort === 'name' ? 'selected' : ''}>По названию</option><option value="played" ${sort === 'played' ? 'selected' : ''}>По времени игры</option></select>
    <button class="btn glass light spring" data-act="import">${svg('file', 18)}Импорт</button>
    <button class="btn primary spring" data-act="create">${svg('plus', 18, 2.6)}Создать</button></div></div>
    ${section(pinned.length ? svg('pin', 12, 2.4) + ' Закреплённые' : '', pinned)}
    ${names.map((g) => section(esc(g), groups[g])).join('')}
    ${section(names.length || pinned.length ? 'Остальные' : '', groups[''] || [], `<button class="new-card spring" data-act="create">${svg('plus', 30, 2)}<span>Новый экземпляр</span></button>`)}`;
};
const _instmenu = ACT.instmenu;
ACT.instmenu = (d, el) => {
  const i = instById(d.id); if (!i) return;
  const run = S.running[i.id];
  showMenu(el, [
    { icon: run ? 'stop' : 'play', label: run ? 'Остановить' : 'Играть', run: () => ACT.play(d) },
    { icon: 'pin', label: i.pinned ? 'Открепить' : 'Закрепить', run: async () => { await call('instances:pin', i.id); await refresh(true); } },
    { icon: 'terminal', label: 'Логи', run: () => openLogs(i.id) },
    { icon: 'folder', label: 'Открыть папку', run: () => call('instances:folder', i.id) },
    { icon: 'edit', label: 'Переименовать', run: async () => { const n = await promptSheet('Переименовать', 'Новое название', i.name, 'Сохранить'); if (n) { await attempt(() => call('instances:rename', i.id, n), 'Переименовано'); refresh(true); } } },
    { icon: 'grid', label: 'В группу…', run: async () => { const g = await promptSheet('Группа', 'Название группы (пусто — без группы)', i.group, 'Сохранить'); await attempt(() => call('groups:set', i.id, g || ''), g ? 'Перемещено в «' + g + '»' : 'Убрано из группы'); refresh(true); } },
    { icon: 'copy', label: 'Копировать', run: async () => { const n = await promptSheet('Копия экземпляра', 'Название копии', i.name + ' (копия)', 'Копировать'); if (n) { await attempt(() => call('instances:copy', i.id, n), 'Копия создана'); refresh(true); } } },
    { icon: 'share', label: 'Экспорт .mrpack', run: () => ACT.export({ id: i.id }) },
    { icon: 'trash', label: 'Удалить', red: true, run: () => ACT.delinst(d) }
  ]);
};

// ================= друзья =================
let friendsTimer = null;
PAGES.friends = function () {
  const D = S.friendsData;
  const list = D ? D.friends : (S.cfg.friends || []).map((f) => ({ ...f, online: null }));
  const card = (f) => `<div class="friend glass ${f.online ? 'on' : ''}">
    <span class="fav"><img src="https://mc-heads.net/avatar/${encodeURIComponent(f.uuid || f.name)}/80" alt=""><i class="${f.online ? 'online' : f.online === null ? 'unk' : ''}"></i></span>
    <div class="grow"><div class="t" style="font-size:17px;font-weight:700">${esc(f.name)}</div>
    <div class="s">${f.online === null ? '<span class="spinner" style="width:11px;height:11px;border-width:2px"></span> проверяю…' : f.online ? `<b style="color:var(--ok)">Онлайн</b> на ${esc(f.server)}` : f.lastSeen ? `Был(а) на ${esc(f.lastSeen.server)} ${esc(fmtAgo(f.lastSeen.t))}` : 'Не найден на ваших серверах'}</div></div>
    ${f.online ? `<button class="btn small primary spring" data-act="joinFriend" data-ip="${esc(f.ip)}">${svgFill('play', 13)}Зайти</button>` : ''}
    <button class="btn small icon glass light spring" data-act="delFriend" data-name="${esc(f.name)}" aria-label="Удалить ${esc(f.name)}">${svg('x', 14, 2.4)}</button></div>`;
  const online = list.filter((f) => f.online);
  return `<div class="page-head"><div><h1>Друзья</h1><p>${D ? `Онлайн: ${online.length} из ${list.length} · проверено серверов: ${D.checked} из ${D.total}` : 'Добавьте друзей по нику Minecraft'}</p></div>
    <div class="row"><label class="field glass" style="width:250px">${svg('user', 18)}<input id="friendName" placeholder="Ник друга" aria-label="Ник друга"></label><button class="btn primary spring" data-act="addFriend">${svg('plus', 18, 2.6)}Добавить</button><button class="btn icon glass light spring" data-act="friendsRefresh" aria-label="Обновить">${svg('refresh', 18, 2.4)}</button></div></div>
    ${list.length ? `<div class="grid wide stagger">${list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(card).join('')}</div>` : `<div class="list glass"><div class="empty">${svg('users', 48, 1.6)}<div style="font-size:16px;font-weight:600;color:var(--text)">Друзей пока нет</div><div style="margin-top:6px">Введите ник сверху — лаунчер найдёт игрока и будет следить, на каком из ваших серверов он играет.</div></div></div>`}
    <div class="cols" style="margin-top:22px"><div class="panel glass"><h3>Как это работает</h3><div class="muted" style="line-height:1.55">В Java-версии Minecraft нет общего списка друзей, поэтому лаунчер опрашивает серверы из ваших экземпляров (и добавленные ниже) и ищет ник друга среди игроков. Крупные серверы скрывают список игроков — там статус не виден.${D && D.hidden.length ? `<br><br>Скрывают игроков: ${esc(D.hidden.slice(0, 6).join(', '))}` : ''}</div></div>
    <div class="panel glass"><h3>Дополнительные серверы</h3>${(S.cfg.extraServers || []).map((s) => `<div class="set-row"><div><div class="t">${esc(s.name)}</div><div class="s">${esc(s.ip)}</div></div><button class="btn small icon glass light spring" data-act="delExtraSrv" data-ip="${esc(s.ip)}" aria-label="Убрать">${svg('x', 14, 2.4)}</button></div>`).join('') || '<div class="muted">Нет — используются серверы из экземпляров</div>'}
    <div class="row"><input class="input" id="extraSrv" placeholder="адрес сервера, например play.example.ru"><button class="btn glass light spring" data-act="addExtraSrv">Добавить</button></div></div></div>`;
};
async function loadFriends() {
  try { S.friendsData = await call('friends:status'); } catch (e) { toast(e.message, true); }
  if (S.page === 'friends') rerenderMain();
}

// ================= профиль и 3D-скин =================
function skin3d(uuid, name, o = {}) {
  const url = o.url || `https://mc-heads.net/skin/${encodeURIComponent(uuid || name || 'MHF_Steve')}`;
  const k = o.k || 7, aw = o.slim ? 3 : 4;
  const box = (cls, u, v, w, h, d, ox, oy, limb) => {
    const W = w * k, H = h * k, D = d * k;
    const face = (fw, fh, fu, fv, tr) => `<i style="width:${fw * k}px;height:${fh * k}px;left:${(W - fw * k) / 2}px;top:${(H - fh * k) / 2}px;background-size:${64 * k}px ${64 * k}px;background-position:-${fu * k}px -${fv * k}px;transform:${tr}"></i>`;
    return `<div class="cube ${cls}" style="width:${W}px;height:${H}px;transform:translate3d(${ox * k}px,${oy * k}px,0);transform-origin:${W / 2}px ${limb ? 0 : H / 2}px">
      ${face(w, h, u + d, v + d, `translateZ(${D / 2}px)`)}${face(w, h, u + d + w + d, v + d, `rotateY(180deg) translateZ(${D / 2}px)`)}
      ${face(d, h, u, v + d, `rotateY(-90deg) translateZ(${W / 2}px)`)}${face(d, h, u + d + w, v + d, `rotateY(90deg) translateZ(${W / 2}px)`)}
      ${face(w, d, u + d, v, `rotateX(90deg) translateZ(${H / 2}px)`)}${face(w, d, u + d + w, v, `rotateX(-90deg) translateZ(${H / 2}px)`)}</div>`;
  };
  const ov = o.overlay !== false;
  return `<div class="skin3d ${o.cls || ''}" ${o.id ? `id="${o.id}"` : 'id="skin3d"'} style="--skin:url('${url}')${o.size ? `;width:${o.size[0]}px;height:${o.size[1]}px` : ''}"><div class="model" style="width:${16 * k}px;height:${32 * k}px">
    ${box('head', 0, 0, 8, 8, 8, 4, 0)}${ov ? box('hat ov', 32, 0, 8, 8, 8, 4, 0) : ''}
    ${box('body', 16, 16, 8, 12, 4, 4, 8)}${ov ? box('body ov', 16, 32, 8, 12, 4, 4, 8) : ''}
    ${box('arm r', 40, 16, aw, 12, 4, 4 - aw, 8, 1)}${ov ? box('arm r ov', 40, 32, aw, 12, 4, 4 - aw, 8, 1) : ''}
    ${box('arm l', 32, 48, aw, 12, 4, 12, 8, 1)}${ov ? box('arm l ov', 48, 48, aw, 12, 4, 12, 8, 1) : ''}
    ${box('leg r', 0, 16, 4, 12, 4, 4, 20, 1)}${ov ? box('leg r ov', 0, 32, 4, 12, 4, 4, 20, 1) : ''}
    ${box('leg l', 16, 48, 4, 12, 4, 8, 20, 1)}${ov ? box('leg l ov', 0, 48, 4, 12, 4, 8, 20, 1) : ''}
  </div><div class="skin-shadow"></div></div>`;
}
PAGES.accounts = function () {
  const cur = accountName();
  const a = S.accounts.find((x) => x.name === cur) || S.accounts[0];
  return `${prismWarning()}<div class="page-head"><div><h1>Профиль</h1><p>Вход через Microsoft выполняет Prism Launcher. Здесь — ваш скин и выбор аккаунта для запуска.</p></div>
    <button class="btn primary spring" data-act="prism:accounts">${svg('plus', 18, 2.6)}Добавить в Prism</button></div>
    <div class="cols"><div class="panel glass profile">${skin3d(a && a.uuid, a && a.name)}
      <div style="text-align:center"><div style="font-size:26px;font-weight:800">${esc(a ? a.name : 'Нет аккаунта')}</div><div class="muted" style="margin-top:4px">Перетащите модель, чтобы повернуть</div></div>
      <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn primary spring" data-act="skinEditor">${svg('edit', 16)}Редактор скина</button><button class="btn glass light spring" data-act="url" data-url="https://www.minecraft.net/msaprofile/mygames/editskin">${svg('share', 16)}Загрузить на minecraft.net</button><button class="btn glass light spring" data-act="url" data-url="https://namemc.com/profile/${esc(a ? a.name : '')}">${svg('link', 16)}NameMC</button></div></div>
    <div class="panel glass"><h3>Аккаунты</h3>${S.accounts.length ? S.accounts.map((x) => `<div class="set-row"><div class="row" style="gap:12px"><span class="icon-box" style="width:44px;height:44px;border-radius:12px;background:${tint(x.name)}">${esc(x.name[0] || '?')}${x.uuid ? `<img src="https://mc-heads.net/avatar/${encodeURIComponent(x.uuid)}/44" alt="" style="position:absolute;inset:0">` : ''}</span><div><div class="t">${esc(x.name)}</div><div class="s">${x.type === 'MSA' ? 'Microsoft' : esc(x.type)}${x.active ? ' · по умолчанию в Prism' : ''}</div></div></div>
      ${cur === x.name ? `<span class="chip" style="background:rgba(var(--accent-rgb),.25)">${svg('check', 13, 3)}Для запуска</span>` : `<button class="btn small glass light spring" data-act="useacc" data-name="${esc(x.name)}">Использовать</button>`}</div>`).join('') : '<div class="muted">Аккаунтов нет. Нажмите «Добавить в Prism», войдите через Microsoft и вернитесь сюда.</div>'}</div></div>`;
};
let skinDrag = null;
document.addEventListener('pointerdown', (e) => { const sk = e.target.closest('.skin3d'); if (!sk) return; skinDrag = { el: sk, x: e.clientX, y: e.clientY, rot: Number(sk.dataset.rot || -25), tilt: Number(sk.dataset.tilt || -8) }; sk.classList.add('drag'); });
document.addEventListener('pointermove', (e) => {
  if (!skinDrag) return; const sk = skinDrag.el; if (!sk.isConnected) { skinDrag = null; return; }
  const r = skinDrag.rot + (e.clientX - skinDrag.x) * .6, t = Math.max(-40, Math.min(40, skinDrag.tilt - (e.clientY - skinDrag.y) * .3));
  sk.dataset.rot = r; sk.dataset.tilt = t; $('.model', sk).style.transform = `rotateX(${t}deg) rotateY(${r}deg)`;
});
document.addEventListener('pointerup', () => { if (!skinDrag) return; skinDrag.el.classList.remove('drag'); skinDrag = null; });

// ================= настройки: дополнительные панели =================
const _settings = PAGES.settings;
PAGES.settings = function () {
  const c = S.cfg;
  const extra = `<div class="panel glass"><h3>Система</h3>
    <div class="set-row"><div class="t">Тема</div><div class="seg glass light"><span class="seg-ind"></span>${[['dark', 'Тёмная'], ['light', 'Светлая'], ['auto', 'Как в системе']].map(([k, n]) => `<button class="${(c.theme || 'dark') === k ? 'on' : ''}" data-act="theme" data-v="${k}">${n}</button>`).join('')}</div></div>
    ${switchRow('Звуки интерфейса', 'Мягкие щелчки, звук запуска и уведомлений', 'sounds', c.sounds !== false)}
    ${switchRow('Сворачивать в трей при закрытии', 'Лаунчер остаётся у часов: быстрый запуск последних экземпляров', 'trayOnClose', !!c.trayOnClose)}
    ${switchRow('Автобэкап миров', 'Перед каждым запуском сохранять копии изменённых миров', 'autoBackup', !!c.autoBackup)}
    <div class="sep"></div>
    <div class="set-row"><div><div class="t">Горячие клавиши</div><div class="s">Ctrl+K — поиск и команды · Ctrl+N — новый экземпляр · Ctrl+Enter — играть · Ctrl+L — логи · F5 — обновить</div></div>${svg('keyboard', 22, 1.8)}</div></div>
    <div class="panel glass"><h3>Discord и обновления</h3>
    <label class="lbl">Discord Application ID<div class="row"><input class="input" data-change="cfg:discordId" value="${esc(c.discordId || '')}" placeholder="Например 1234567890123456789"><button class="btn glass light spring" data-act="url" data-url="https://discord.com/developers/applications">Создать</button></div></label>
    <div class="s muted" style="line-height:1.5">Создайте приложение «Prism Launcher Deluxe» на discord.com/developers, скопируйте Application ID сюда — друзья в Discord увидят, во что вы играете. В разделе Rich Presence → Art Assets загрузите картинку с именем <b>logo</b>.</div>
    <div class="sep"></div>
    <label class="lbl">Источник обновлений (GitHub owner/repo)<div class="row"><input class="input" data-change="cfg:updateRepo" value="${esc(c.updateRepo || '')}" placeholder="Microwave222/prism-launcher-deluxe"><button class="btn glass light spring" data-act="checkUpdate">Проверить</button></div></label>
    <div class="s muted">Лаунчер сам скачает новую версию из релизов GitHub (файл app.zip) и перезапустится.</div></div>`;
  return _settings().replace(/<\/div>\s*$/, extra + '</div>');
};

// ================= тема =================
const _applyTheme = applyTheme;
applyTheme = function () {
  _applyTheme();
  const t = S.cfg.theme || 'dark';
  const light = t === 'light' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.body.classList.toggle('light', light);
};
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());

// ================= палитра команд (Ctrl+K) =================
function paletteItems() {
  const items = [];
  for (const [id, label, ic] of NAV) items.push({ ic, label: 'Открыть: ' + label, run: () => ACT.go({ page: id }) });
  for (const i of S.instances) {
    items.push({ ic: 'play', label: 'Играть: ' + i.name, hint: verText(i), run: () => ACT.play({ id: i.id }) });
    items.push({ ic: 'grid', label: 'Экземпляр: ' + i.name, hint: verText(i), run: () => ACT.open({ id: i.id }) });
  }
  items.push({ ic: 'plus', label: 'Создать экземпляр', run: () => ACT.create() });
  items.push({ ic: 'file', label: 'Импорт модпака', run: () => ACT.import() });
  items.push({ ic: 'box', label: 'Найти модпак', run: () => ACT.go({ page: 'browse', type: 'modpack' }) });
  items.push({ ic: 'compass', label: 'Найти моды', run: () => ACT.go({ page: 'browse', type: 'mod' }) });
  items.push({ ic: 'users', label: 'Добавить друга', run: () => { ACT.go({ page: 'friends' }); setTimeout(() => $('#friendName') && $('#friendName').focus(), 300); } });
  items.push({ ic: 'refresh', label: 'Обновить список', run: () => ACT.refresh() });
  return items;
}
function openPalette() {
  if ($('#palette')) return;
  const all = paletteItems();
  let sel = 0, shown = all;
  const ov = document.createElement('div'); ov.id = 'palette'; ov.className = 'palette-ov';
  ov.innerHTML = `<div class="palette glass strong"><label class="field" style="height:56px">${svg('search', 20)}<input id="palQ" placeholder="Экземпляр, раздел или действие…" aria-label="Поиск команд"><kbd>Esc</kbd></label><div class="pal-list" id="palList"></div></div>`;
  document.body.appendChild(ov);
  const draw = () => {
    $('#palList').innerHTML = shown.slice(0, 40).map((it, k) => `<button class="pal-item ${k === sel ? 'on' : ''}" data-k="${k}">${svg(it.ic, 17)}<span class="grow">${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('') || '<div class="empty" style="padding:24px">Ничего не найдено</div>';
    const on = $('#palList .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const close = () => ov.remove();
  const runSel = () => { const it = shown[sel]; close(); if (it) it.run(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); const b = e.target.closest('.pal-item'); if (b) { sel = +b.dataset.k; runSel(); } });
  const q = $('#palQ', ov);
  q.addEventListener('input', () => { const t = q.value.toLowerCase().trim(); shown = t ? all.filter((it) => (it.label + ' ' + (it.hint || '')).toLowerCase().includes(t)) : all; sel = 0; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { runSel(); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.stopPropagation(); }
  });
  draw(); q.focus(); sfx('open');
}
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  else if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); ACT.create(); }
  else if (ctrl && e.key === ',') { e.preventDefault(); ACT.go({ page: 'settings' }); }
  else if (ctrl && e.key === 'Enter') { const id = S.inst && S.page === 'instance' ? S.inst : S.cfg.lastInstance || (S.instances[0] && S.instances[0].id); if (id) { e.preventDefault(); ACT.play({ id }); } }
  else if (ctrl && e.key.toLowerCase() === 'l') { const id = S.page === 'instance' ? S.inst : S.cfg.lastInstance; if (id) { e.preventDefault(); openLogs(id); } }
  else if (e.key === 'F5' && !typing) { e.preventDefault(); ACT.refresh(); }
});

// ================= действия =================
Object.assign(ACT, {
  logs: (d) => { if ($('#overlay.show')) closeSheet(); openLogs(d.id || S.inst); },
  logsFolder: () => S.logs && call('logs:open', S.logs.id),
  loglvl: (d, el) => { S.logs.level = d.v; $$('.seg button', el.parentNode).forEach((b) => b.classList.toggle('on', b === el)); afterRender(); renderLogs(true); },
  crashCheck: async (d) => { const c = await attempt(() => call('crash:analyze', d.id)); if (!c) return; if (!c.crashed) { toast('Признаков краша в последнем логе не найдено'); return; } closeSheet(); showCrash(d.id, c); },
  crashFile: (d) => call('crash:open', d.file),
  crashFix: async (d) => {
    closeSheet();
    if (d.v === 'ram') { ACT.open({ id: d.id }).then(() => ACT.tab({ tab: 'settings' })); toast('Увеличьте память ползунком «Память»'); }
    else if (d.v === 'prism') ACT['prism:open']();
    else if (d.v === 'mods' || d.v === 'missing') { await ACT.open({ id: d.id }); }
  },
  findMod: (d) => { closeSheet(); S.browse.target = d.id; S.browse.type = 'mod'; S.browse.query = d.q; S.page = 'browse'; render(); doSearch(); },
  disableMod: async (d) => {
    await attempt(() => call('content:toggle', d.id, 'mod', d.file), 'Мод отключён');
    if (S.page === 'instance' && S.inst === d.id && S.tab === 'mod') loadTab();
    const b = $(`[data-act="disableMod"][data-file="${CSS.escape(d.file)}"]`); if (b) { b.disabled = true; b.textContent = 'Отключён'; }
  },
  addServer: async () => {
    showSheet(`<h2>Новый сервер</h2><label class="lbl">Название<input class="input" id="srvName" placeholder="Мой сервер"></label><label class="lbl">Адрес<input class="input" id="srvIp" placeholder="play.example.ru или 1.2.3.4:25565"></label>
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Отмена</button><button class="btn primary spring" data-act="addServerOk">Добавить</button></div>`);
  },
  addServerOk: async () => {
    const ip = $('#srvIp').value.trim(), name = $('#srvName').value.trim() || ip;
    if (!ip) return toast('Укажите адрес', true);
    const ok = await attempt(() => call('servers:add', S.inst, { name, ip }), 'Сервер добавлен');
    if (ok !== undefined) { closeSheet(); loadTab(); }
  },
  delServer: async (d) => { if (!(await confirmSheet('Удалить сервер?', d.ip, 'Удалить', true))) return; await attempt(() => call('servers:remove', S.inst, d.ip), 'Удалено'); loadTab(); },
  joinServer: (d) => launchTo(S.inst, d.ip),
  pingAll: () => { S.srvStatus = {}; const b = $('#tabBody'); if (b) b.innerHTML = serversTab(instById(S.inst)); pingServers(); },
  wBackup: async (d) => { await attempt(() => call('worlds:backup', S.inst, d.w), `Бэкап мира «${d.w}» сохранён`); },
  wBackups: async (d) => {
    const list = await attempt(() => call('worlds:backups', S.inst, d.w)); if (!list) return;
    showSheet(`<h2>Бэкапы «${esc(d.w)}»</h2>${list.length ? `<div class="list" style="padding:0">${list.map((b) => `<div class="item"><div class="grow"><div class="t">${esc(new Date(b.time).toLocaleString('ru-RU'))}</div><div class="s">${esc(fmtSize(b.size))}</div></div><button class="btn small primary spring" data-act="wRestore" data-w="${esc(d.w)}" data-f="${esc(b.file)}">Восстановить</button></div>`).join('')}</div>` : '<div class="muted">Бэкапов пока нет. Нажмите «Бэкап» у мира или включите автобэкап.</div>'}
      <div class="actions"><button class="btn glass light spring" data-act="sheet:cancel">Закрыть</button></div>`);
  },
  wRestore: async (d) => {
    closeSheet();
    if (!(await confirmSheet('Восстановить мир?', `Текущая версия «${d.w}» уйдёт в корзину и будет заменена бэкапом.`, 'Восстановить', true))) return;
    await attempt(() => call('worlds:restore', S.inst, d.w, d.f), 'Мир восстановлен'); loadTab();
  },
  wFolder: (d) => call('worlds:folder', S.inst, d.w),
  wDelete: async (d) => { if (!(await confirmSheet('Удалить мир?', `«${d.w}» будет перемещён в корзину.`, 'Удалить', true))) return; await attempt(() => call('worlds:delete', S.inst, d.w), 'Мир в корзине'); loadTab(); },
  coverShot: async (d) => { await attempt(() => call('instances:setCover', S.inst, decodeURI(d.url.replace(/^file:\/\/\//, ''))), 'Обложка установлена'); await loadInstances(); },
  setIcon: async () => { const p = await call('dialog:file', [{ name: 'Картинки', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]); if (!p) return; await attempt(() => call('instances:setIcon', S.inst, p), 'Иконка обновлена'); await refresh(true); },
  setCover: async () => { const p = await call('dialog:file', [{ name: 'Картинки', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]); if (!p) return; await attempt(() => call('instances:setCover', S.inst, p), 'Обложка установлена'); await refresh(true); },
  clearCover: async () => { await attempt(() => call('instances:setCover', S.inst, ''), 'Обложка убрана'); await refresh(true); },
  saveGroup: async () => { const g = $('#grpName').value.trim(); await attempt(() => call('groups:set', S.inst, g), g ? 'Группа: ' + g : 'Без группы'); await refresh(true); },
  export: async (d) => { const r = await attempt(() => call('instances:export', d.id || S.inst)); if (r) toast(`Экспортировано: ${r.linked} файлов по ссылкам, ${r.embedded} внутри архива`); },
  kit: async (d, el) => {
    el.disabled = true; el.classList.add('busy');
    const r = await attempt(() => call('kits:install', S.inst, d.kit));
    el.disabled = false; el.classList.remove('busy');
    if (r) { toast(`Установлено: ${r.installed.length}${r.skipped.length ? ` · нет версии: ${r.skipped.join(', ')}` : ''}`); loadTab(); }
  },
  updAll: async (d, el) => {
    if (!S.scan || !S.scan.updates.length) return;
    el.disabled = true; el.innerHTML = '<span class="spinner"></span>Обновляю…';
    const r = await attempt(() => call('mods:update', S.inst, S.scan.updates));
    if (r) toast(`Обновлено модов: ${r.length}`);
    loadTab();
  },
  rollback: async (d) => { if (!(await confirmSheet('Откатить обновление?', 'Вернуть моды к версиям до последнего обновления.', 'Откатить'))) return; const n = await attempt(() => call('mods:rollback', S.inst, d.stamp)); if (n) toast(`Возвращено модов: ${n}`); loadTab(); },
  installDep: async (d, el) => {
    el.disabled = true; el.innerHTML = '<span class="spinner"></span>';
    const r = await attempt(() => call('content:install', { source: 'modrinth', type: 'mod', projectId: d.pid, instanceId: S.inst, title: d.title }));
    if (r) toast(`Установлено: ${r.join(', ') || d.title}`);
    loadTab();
  },
  openProj: (d) => openProject(d.src, d.pid),
  projBack: () => { S.page = (S.project && S.project.from) || 'browse'; render(); if (S.page === 'browse') updateResults(true); },
  projTab: (d) => { S.project.tab = d.tab; rerenderMain(); },
  projInstall: async () => {
    const d = S.project.data, B = S.browse, key = d.source + ':' + d.id;
    const isPack = B.type === 'modpack' || d.type === 'modpack';
    if (!isPack && !B.target) { toast('Выберите экземпляр на странице «Обзор»', true); return; }
    S.installing[key] = true; rerenderMain();
    let ok;
    if (isPack) { ok = await attempt(() => call('modpack:install', { source: d.source, projectId: d.id, title: d.title, icon: d.icon })); if (ok) await loadInstances(); }
    else ok = await attempt(() => call('content:install', { source: d.source, type: B.type, projectId: d.id, instanceId: B.target, title: d.title, icon: d.icon }));
    delete S.installing[key]; if (ok) { S.installed[key] = true; toast(`«${d.title}» установлен`); }
    rerenderMain();
  },
  projVer: async (d) => {
    const P = S.project.data, B = S.browse;
    await attempt(() => call('content:installVersion', { source: P.source, type: B.type, versionId: d.v, projectId: P.id, instanceId: B.target, title: P.title, icon: P.icon }), 'Версия установлена');
  },
  addFriend: async () => {
    const n = $('#friendName').value.trim(); if (!n) return;
    const ok = await attempt(() => call('friends:add', n), `${n} добавлен в друзья`);
    if (ok !== undefined) { S.cfg = await call('config:get'); S.friendsData = null; rerenderMain(); loadFriends(); }
  },
  delFriend: async (d) => { await call('friends:remove', d.name); S.cfg = await call('config:get'); if (S.friendsData) S.friendsData.friends = S.friendsData.friends.filter((f) => f.name !== d.name); rerenderMain(); },
  friendsRefresh: () => { S.friendsData = null; rerenderMain(); loadFriends(); },
  joinFriend: (d) => { const id = S.cfg.lastInstance || (S.instances[0] && S.instances[0].id); if (!id) return toast('Сначала создайте экземпляр', true); launchTo(id, d.ip); },
  addExtraSrv: async () => { const ip = $('#extraSrv').value.trim(); if (!ip) return; await call('friends:addServer', { ip }); S.cfg = await call('config:get'); rerenderMain(); loadFriends(); },
  delExtraSrv: async (d) => { await call('friends:removeServer', d.ip); S.cfg = await call('config:get'); rerenderMain(); },
  theme: async (d) => { await setCfg({ theme: d.v }); rerenderMain(); },
  checkUpdate: async () => {
    const r = await attempt(() => call('update:check')); if (!r) return;
    if (!r.configured) return toast('Укажите репозиторий GitHub с релизами лаунчера');
    if (!r.newer) return toast(`У вас последняя версия (${r.version})`);
    if (await confirmSheet(`Доступна версия ${r.latest}`, (r.notes || '').slice(0, 400) || 'Установить обновление?', 'Обновить и перезапустить')) attempt(() => call('update:install', r.url));
  }
});
async function launchTo(id, ip) {
  const i = instById(id); if (!i) return;
  if (S.running[id]) return toast('Игра уже запущена — подключитесь к серверу из меню мультиплеера', true);
  S.launching[id] = true; sfx('launch'); rerenderMain();
  const ok = await attempt(() => call('instances:launch', id, { server: ip }), `Запускаю «${i.name}» и захожу на ${ip}`);
  setTimeout(() => { if (S.launching[id]) { delete S.launching[id]; rerenderMain(); } }, ok ? 25000 : 300);
}
const _go = ACT.go;
ACT.go = (d) => {
  clearInterval(friendsTimer);
  _go(d);
  if (d.page === 'friends') { loadFriends(); friendsTimer = setInterval(() => { if (S.page === 'friends' && !document.hidden) loadFriends(); }, 60000); }
};
const _li = loadInstances;
loadInstances = async function () { await _li(); call('tray:refresh').catch(() => { }); };
document.addEventListener('change', async (e) => {
  if (e.target.dataset.change === 'sortBy') { await setCfg({ sortBy: e.target.value }); rerenderMain(); }
});

// старт: текущие запущенные игры и проверка обновлений лаунчера
window.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    try {
      const r = await call('update:check');
      if (r.newer && !$('#overlay.show') && await confirmSheet(`Доступна новая версия ${r.latest}`, (r.notes || '').slice(0, 400) || 'Установить обновление лаунчера?', 'Обновить и перезапустить')) attempt(() => call('update:install', r.url));
    } catch { }
  }, 8000);
  try { for (const g of await call('game:running')) S.running[g.id] = { start: g.start }; if (Object.keys(S.running).length) rerenderMain(); } catch { }
});
