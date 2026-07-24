/* ===========================================================
   RADAR DE OFERTAS — app.js
   Vanilla JS, sem dependências. Persistência em localStorage,
   isolada no objeto Store (troca p/ Supabase depois sem reescrever).
   =========================================================== */
'use strict';

const KEY = 'radar_ofertas_v1';
const STATUSES = ['Monitorando', 'Escalando', 'Instável', 'Caindo', 'Morta'];

/* ---------- estado ---------- */
const state = {
  offers: [],
  seeded: false,
  filters: { search: '', nicho: '', status: '', sort: 'momentum' },
};

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nf = new Intl.NumberFormat('pt-BR');
const fmt = (n) => nf.format(n);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'o' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function fmtSigned(n) { if (n == null) return '—'; return (n > 0 ? '+' : '') + fmt(n); }
function fmtPct(p) { if (p == null || !isFinite(p)) return '—'; return (p > 0 ? '+' : '') + Math.round(p) + '%'; }
function parseCount(v) { if (v == null) return null; const s = String(v).replace(/[^\d]/g, ''); return s === '' ? null : parseInt(s, 10); }

/* datas (ISO local YYYY-MM-DD) */
function isoOf(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${da}`; }
function todayISO() { return isoOf(new Date()); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDaysISO(iso, delta) { const d = parseISO(iso); d.setDate(d.getDate() + delta); return isoOf(d); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function daysAgo(iso) { return daysBetween(iso, todayISO()); }
function isoBR(s) { const [, m, d] = s.split('-'); return `${d}/${m}`; }
function isoBRFull(s) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function humanAgo(iso) { const d = daysAgo(iso); if (d <= 0) return 'hoje'; if (d === 1) return 'ontem'; return `há ${d} dias`; }

/* ---------- ícones (SVG inline) ---------- */
const ICONS = {
  dots: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
  pulse: '<path d="M3 12h4l2.5 7 4-14 2.5 7H21"/>',
  down: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
  up: '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M5 3h14"/>',
  beaker: '<path d="M9 3h6"/><path d="M10 3v6l-5.2 9.2A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.8-2.8L14 9V3"/><path d="M6.5 15h11"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  edit: '<path d="M12 20h8"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  flame: '<path d="M12 3c.5 3 3.5 4.2 3.5 7.5A3.5 3.5 0 0 1 12 14a3.5 3.5 0 0 1-3.5-3.5C8.5 9 9 8.5 9 8.5S8.7 12 12 12"/><path d="M12 14c3.5 0 6 2.4 6 5a6 6 0 0 1-12 0c0-1.6 1-3 2-3.5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  arrowUp: '<path d="M12 19V6M6 12l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v13M6 12l6 6 6-6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 19h16"/><path d="M7 15l4-5 3 3 4-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>',
  radar: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 8a4 4 0 1 0 4 4"/><path d="M12 12 20.5 6"/>',
  note: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  tag: '<path d="M3 12V5.5A2.5 2.5 0 0 1 5.5 3H12l9 9-8.5 8.5a1.5 1.5 0 0 1-2.1 0L3 13.2A2 2 0 0 1 3 12Z"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>',
};
function svgWrap(inner) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }
function ic(name) { return `<span class="ic" data-ic="${name}">${svgWrap(ICONS[name] || '')}</span>`; }
function injectIcons(root = document) { $$('[data-ic]', root).forEach((el) => { if (!el.firstChild) el.innerHTML = svgWrap(ICONS[el.getAttribute('data-ic')] || ''); }); }

/* ---------- Store (localStorage) ---------- */
const Store = {
  load() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, seeded: state.seeded, offers: state.offers })); } catch (e) { toast('Não consegui salvar (armazenamento cheio?)', 'bad'); } },
};
function persist() { Store.save(); }
function touched() { if (state.seeded) { state.seeded = false; syncSeedBanner(); } }

/* ---------- análise ---------- */
function snapsOf(o) { return (o.snaps || []).slice().sort((a, b) => a.data.localeCompare(b.data)); }
function latest(o) { const s = snapsOf(o); return s.length ? s[s.length - 1] : null; }
function daysMonitoring(o) { const s = snapsOf(o); return s.length ? daysBetween(s[0].data, todayISO()) + 1 : 0; }

function computeTrend(snaps) {
  if (!snaps || snaps.length < 2) return { dir: 'new', abs: null, pct: null };
  const a = snaps[snaps.length - 2].contagem, b = snaps[snaps.length - 1].contagem;
  const abs = b - a;
  const pct = a === 0 ? (b > 0 ? 100 : 0) : (abs / a) * 100;
  let dir = 'flat';
  if (abs > 0 && (pct >= 8 || (a < 20 && abs >= 2))) dir = 'up';
  else if (abs < 0 && (pct <= -8 || (a < 20 && abs <= -2))) dir = 'down';
  return { dir, abs, pct };
}
function momScore(o) { const t = computeTrend(snapsOf(o)); return t.pct == null ? -1e9 : t.pct; }

function stats(o) {
  const s = snapsOf(o); const n = s.length;
  if (n === 0) return { n: 0 };
  const first = s[0], last = s[n - 1];
  const varAbs = last.contagem - first.contagem;
  const varPct = first.contagem === 0 ? (last.contagem > 0 ? 100 : 0) : (varAbs / first.contagem) * 100;
  const daySpan = Math.max(1, daysBetween(first.data, last.data));
  const mediaDia = varAbs / daySpan;
  let pico = s[0]; s.forEach((x) => { if (x.contagem > pico.contagem) pico = x; });
  return { n, first, last, atual: last.contagem, varAbs, varPct, mediaDia, pico, dias: daysMonitoring(o), registros: n };
}

/* ---------- SVG: sparkline ---------- */
function trendColor(dir) { return dir === 'up' ? 'var(--good)' : dir === 'down' ? 'var(--bad)' : dir === 'new' ? 'var(--gold)' : 'var(--text-2)'; }
function sparkline(snaps, dir) {
  const W = 300, H = 48, pad = 4;
  const pts = snaps.slice(-14);
  const color = trendColor(dir);
  if (pts.length === 0) return `<svg class="spark" viewBox="0 0 ${W} ${H}"></svg>`;
  const vals = pts.map((s) => s.contagem);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1, n = pts.length;
  const X = (i) => pad + (n > 1 ? i / (n - 1) : 0.5) * (W - 2 * pad);
  const Y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad - 2);
  if (n === 1) return `<svg class="spark" viewBox="0 0 ${W} ${H}"><circle cx="${X(0)}" cy="${Y(vals[0]).toFixed(1)}" r="3.4" fill="${color}"/></svg>`;
  const line = pts.map((s, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(s.contagem).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(n - 1).toFixed(1)} ${H - pad} L ${X(0).toFixed(1)} ${H - pad} Z`;
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".24"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(n - 1).toFixed(1)}" cy="${Y(vals[n - 1]).toFixed(1)}" r="2.8" fill="${color}"/>
  </svg>`;
}

/* ---------- SVG: gráfico de detalhe ---------- */
function buildChart(snaps) {
  const W = 680, H = 240, padL = 44, padR = 18, padT = 18, padB = 30;
  const n = snaps.length, vals = snaps.map((s) => s.contagem);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min = Math.max(0, min - 1); max += 1; }
  const spanV = max - min; max += spanV * 0.12; min = Math.max(0, min - spanV * 0.12);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const X = (i) => padL + (n > 1 ? i / (n - 1) : 0.5) * plotW;
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;
  let grid = '';
  for (let t = 0; t <= 4; t++) { const val = min + (max - min) * t / 4, yy = Y(val); grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--hair)"/><text x="${padL - 8}" y="${(yy + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${fmt(Math.round(val))}</text>`; }
  let xlab = '';
  const idxs = n <= 1 ? [0] : n <= 3 ? snaps.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  idxs.forEach((i) => { xlab += `<text x="${X(i).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--muted)">${isoBR(snaps[i].data)}</text>`; });
  const geom = { xs: snaps.map((_, i) => X(i)), ys: vals.map(Y), snaps, W, H };
  if (n === 1) return { svg: `<svg viewBox="0 0 ${W} ${H}">${grid}${xlab}<circle cx="${X(0)}" cy="${Y(vals[0]).toFixed(1)}" r="4.5" fill="var(--gold-bright)"/></svg>`, geom };
  const line = snaps.map((s, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(s.contagem).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(n - 1).toFixed(1)} ${H - padB} L ${X(0).toFixed(1)} ${H - padB} Z`;
  const dots = snaps.map((s, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.contagem).toFixed(1)}" r="2.6" fill="var(--gold-bright)"/>`).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".26"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xlab}
    <path d="${area}" fill="url(#cg)"/>
    <path d="${line}" fill="none" stroke="var(--gold-bright)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <line class="cross" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--gold-border-strong)" opacity="0"/>
    <circle class="cross-dot" r="4.5" fill="var(--gold-bright)" opacity="0"/>
  </svg>`;
  return { svg, geom };
}
function wireChart(wrap, geom) {
  const svg = wrap.querySelector('svg'); if (!svg || !geom.snaps.length) return;
  const cross = svg.querySelector('.cross'), cdot = svg.querySelector('.cross-dot'), tip = wrap.querySelector('.chart-tip');
  function move(e) {
    const rect = svg.getBoundingClientRect(), wrapRect = wrap.getBoundingClientRect();
    const px = (e.touches ? e.touches[0].clientX : e.clientX);
    const vx = (px - rect.left) / rect.width * geom.W;
    let bi = 0, bd = Infinity; geom.xs.forEach((x, i) => { const d = Math.abs(x - vx); if (d < bd) { bd = d; bi = i; } });
    const gx = geom.xs[bi], gy = geom.ys[bi], s = geom.snaps[bi];
    if (cross) { cross.setAttribute('x1', gx); cross.setAttribute('x2', gx); cross.setAttribute('opacity', '1'); }
    if (cdot) { cdot.setAttribute('cx', gx); cdot.setAttribute('cy', gy); cdot.setAttribute('opacity', '1'); }
    if (tip) {
      tip.style.left = ((rect.left - wrapRect.left) + gx / geom.W * rect.width) + 'px';
      tip.style.top = ((rect.top - wrapRect.top) + gy / geom.H * rect.height) + 'px';
      tip.style.opacity = '1';
      const prev = bi > 0 ? geom.snaps[bi - 1].contagem : null;
      const d = prev == null ? null : s.contagem - prev;
      tip.innerHTML = `<div class="t-date">${isoBRFull(s.data)}</div><div class="t-val num">${fmt(s.contagem)} <small>${d == null ? '1º registro' : fmtSigned(d)}</small></div>`;
    }
  }
  function leave() { if (cross) cross.setAttribute('opacity', '0'); if (cdot) cdot.setAttribute('opacity', '0'); if (tip) tip.style.opacity = '0'; }
  svg.addEventListener('mousemove', move); svg.addEventListener('mouseleave', leave);
  svg.addEventListener('touchstart', move, { passive: true }); svg.addEventListener('touchmove', move, { passive: true });
}

/* ---------- render ---------- */
function uniqueNichos() { return [...new Set(state.offers.map((o) => o.nicho).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')); }

function renderAll() { renderKPIs(); renderHighlight(); renderNichoFilter(); renderGrid(); }

function renderKPIs() {
  const os = state.offers;
  const trends = os.map((o) => computeTrend(snapsOf(o)));
  const escalando = trends.filter((t) => t.dir === 'up').length;
  const caindo = trends.filter((t) => t.dir === 'down').length;
  const hoje = os.filter((o) => { const l = latest(o); return l && l.data === todayISO(); }).length;
  const nichos = uniqueNichos().length;
  const tiles = [
    { cls: 'gold', ic: 'radar', label: 'Ofertas monitoradas', value: os.length, sub: nichos ? `${nichos} ${nichos === 1 ? 'nicho' : 'nichos'}` : 'nenhum nicho ainda' },
    { cls: 'good', ic: 'arrowUp', label: 'Escalando', value: escalando, sub: 'em alta no último registro' },
    { cls: 'bad', ic: 'arrowDown', label: 'Caindo', value: caindo, sub: 'em queda no último registro' },
    { cls: 'gold', ic: 'calendar', label: 'Registros hoje', value: `${hoje}/${os.length}`, sub: hoje < os.length ? `${os.length - hoje} pendente(s)` : 'tudo registrado ✓' },
  ];
  $('#kpis').innerHTML = tiles.map((t) => `<div class="kpi ${t.cls}"><div class="kpi-label">${ic(t.ic)} ${t.label}</div><div class="kpi-value num">${t.value}</div><div class="kpi-sub">${t.sub}</div></div>`).join('');
}

function renderHighlight() {
  let best = null;
  state.offers.forEach((o) => { const t = computeTrend(snapsOf(o)); if (t.dir === 'up' && (best === null || t.pct > best.pct)) best = { o, t }; });
  const el = $('#highlight');
  if (!best) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<button class="highlight" data-id="${best.o.id}" data-action="detail">${ic('flame')} Maior alta agora: <b>${esc(best.o.nome)}</b> <span class="up num">${fmtPct(best.t.pct)}</span> · ${fmtSigned(best.t.abs)} anúncios</button>`;
}

function renderNichoFilter() {
  const sel = $('#filterNicho'); const cur = state.filters.nicho;
  sel.innerHTML = `<option value="">Todos os nichos</option>` + uniqueNichos().map((n) => `<option value="${esc(n)}" ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

function getVisible() {
  const f = state.filters; let list = state.offers.slice();
  if (f.search) { const q = f.search.toLowerCase(); list = list.filter((o) => `${o.nome} ${o.anunciante} ${o.nicho}`.toLowerCase().includes(q)); }
  if (f.nicho) list = list.filter((o) => o.nicho === f.nicho);
  if (f.status) list = list.filter((o) => o.status === f.status);
  list.sort((a, b) => {
    switch (f.sort) {
      case 'count': return ((latest(b) || {}).contagem || 0) - ((latest(a) || {}).contagem || 0);
      case 'recent': return ((latest(b) || {}).data || '').localeCompare((latest(a) || {}).data || '');
      case 'name': return a.nome.localeCompare(b.nome, 'pt-BR');
      case 'days': return daysMonitoring(b) - daysMonitoring(a);
      default: return momScore(b) - momScore(a);
    }
  });
  return list;
}

function cardHTML(o) {
  const snaps = snapsOf(o), l = latest(o), t = computeTrend(snaps), dm = daysMonitoring(o);
  let chip = '';
  if (t.dir === 'up') chip = `<span class="chip up">${ic('arrowUp')} ${fmtSigned(t.abs)} · ${fmtPct(t.pct)}</span>`;
  else if (t.dir === 'down') chip = `<span class="chip down">${ic('arrowDown')} ${fmtSigned(t.abs)} · ${fmtPct(t.pct)}</span>`;
  else if (t.dir === 'flat') chip = `<span class="chip flat">estável</span>`;
  else if (snaps.length === 1) chip = `<span class="chip new">${ic('pulse')} 1º registro</span>`;
  const count = l ? `<span class="count num">${fmt(l.contagem)}</span><span class="count-unit">anúncios</span>` : `<span class="count-none">sem registros</span>`;
  const footLeft = l ? `<span class="${daysAgo(l.data) > 2 ? 'stale' : ''}">${dm} ${dm === 1 ? 'dia' : 'dias'} · ${humanAgo(l.data)}</span>` : `<span class="stale">aguardando 1º registro</span>`;
  const footRight = o.url ? `<a class="lib-link" href="${esc(o.url)}" target="_blank" rel="noopener">${ic('external')} Biblioteca</a>` : '';
  return `<article class="card" data-id="${o.id}" data-action="detail" tabindex="0" role="button" aria-label="${esc(o.nome)}">
    <div class="card-top">${o.nicho ? `<span class="tag">${esc(o.nicho)}</span>` : '<span></span>'}<span class="pill s-${esc(o.status)}">${esc(o.status)}</span></div>
    <div><div class="card-name">${esc(o.nome)}</div>${o.anunciante ? `<div class="card-adv">${ic('building')} ${esc(o.anunciante)}</div>` : ''}</div>
    <div class="count-row">${count}${chip}</div>
    <div class="spark-wrap">${sparkline(snaps, t.dir)}</div>
    <div class="card-foot">${footLeft}${footRight}</div>
  </article>`;
}

function renderGrid() {
  const grid = $('#grid');
  if (state.offers.length === 0) {
    grid.innerHTML = `<div class="empty">${ic('radar')}<h3>Nenhuma oferta no radar</h3><p>Cadastre a primeira oferta que você quer monitorar na Biblioteca de Anúncios — depois é só registrar a contagem a cada dia e acompanhar a tendência.</p><div class="empty-actions"><button class="btn btn-primary" data-menu="nova">${ic('plus')} Nova oferta</button><button class="btn btn-secondary" data-menu="exemplo">${ic('beaker')} Ver com dados de exemplo</button></div></div>`;
    return;
  }
  const list = getVisible();
  if (list.length === 0) { grid.innerHTML = `<div class="empty">${ic('search')}<h3>Nada encontrado</h3><p>Nenhuma oferta corresponde à busca ou aos filtros atuais.</p></div>`; return; }
  grid.innerHTML = list.map(cardHTML).join('');
  injectIcons(grid);
}

/* ---------- modais ---------- */
const modalRoot = $('#modalRoot');
function openModal(html, { wide = false } = {}) {
  modalRoot.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  modalRoot.classList.add('open'); modalRoot.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  injectIcons(modalRoot);
  return modalRoot.querySelector('.modal');
}
function closeModal() { modalRoot.classList.remove('open'); modalRoot.setAttribute('aria-hidden', 'true'); modalRoot.innerHTML = ''; document.body.style.overflow = ''; }

function confirmDialog({ title, msg, confirmLabel = 'Confirmar', danger = true, onConfirm }) {
  const html = `<div class="modal-head"><div class="mh-text"><div class="modal-title">${esc(title)}</div></div><button class="modal-close" data-close>${ic('close')}</button></div>
    <div class="modal-body"><p style="color:var(--text-2);font-size:14px;line-height:1.6">${msg}</p></div>
    <div class="modal-foot"><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${confirmLabel}</button></div>`;
  const m = openModal(html);
  m.querySelector('[data-ok]').addEventListener('click', onConfirm);
}

/* ----- form nova/editar oferta ----- */
function openOfferForm(id) {
  const o = id ? state.offers.find((x) => x.id === id) : null;
  const isEdit = !!o;
  const statusOpts = STATUSES.map((s) => `<option ${((o && o.status) || 'Monitorando') === s ? 'selected' : ''}>${s}</option>`).join('');
  const nichoOpts = uniqueNichos().map((n) => `<option value="${esc(n)}">`).join('');
  const html = `
    <div class="modal-head"><div class="mh-text"><div class="modal-title">${isEdit ? 'Editar oferta' : 'Nova oferta'}</div><div class="modal-sub">${isEdit ? 'Atualize os dados desta oferta.' : 'Cadastre uma oferta para monitorar na Biblioteca de Anúncios.'}</div></div><button class="modal-close" data-close>${ic('close')}</button></div>
    <form id="offerForm" class="modal-body">
      <datalist id="nichoList">${nichoOpts}</datalist>
      <div class="field"><label>Nome da oferta <span class="req">*</span></label><input class="input" name="nome" required autocomplete="off" value="${esc(o && o.nome)}" placeholder="Ex.: Chá Seca-Barriga 21 Dias"></div>
      <div class="field-row">
        <div class="field"><label>Nicho</label><input class="input" name="nicho" list="nichoList" autocomplete="off" value="${esc(o && o.nicho)}" placeholder="Emagrecimento"></div>
        <div class="field"><label>Anunciante / Página</label><input class="input" name="anunciante" autocomplete="off" value="${esc(o && o.anunciante)}" placeholder="Vida Leve Oficial"></div>
      </div>
      <div class="field"><label>Link da busca na Biblioteca de Anúncios</label><input class="input" name="url" type="url" autocomplete="off" value="${esc(o && o.url)}" placeholder="https://www.facebook.com/ads/library/?q=..."><div class="hint">Faça a busca na Biblioteca, copie a URL e cole aqui. O card vira atalho de 1 clique para reconferir a contagem.</div></div>
      <div class="field-row">
        <div class="field" style="max-width:120px"><label>País</label><input class="input" name="pais" autocomplete="off" value="${esc((o && o.pais) || 'BR')}" placeholder="BR"></div>
        <div class="field"><label>Status</label><div class="select-field"><select class="select" name="status">${statusOpts}</select>${ic('chevron')}</div></div>
      </div>
      ${isEdit ? '' : `<div class="field"><label>Contagem de hoje (opcional)</label><input class="input" name="contagem" inputmode="numeric" autocomplete="off" placeholder="Ex.: 42"><div class="hint">Se preencher, já cria o primeiro registro com a data de hoje.</div></div>`}
      <div class="field"><label>Observações</label><textarea class="textarea" name="obs" placeholder="Ângulos, criativos, preço, checkout…">${esc(o && o.obs)}</textarea></div>
    </form>
    <div class="modal-foot">${isEdit ? `<button class="btn btn-danger" data-del style="margin-right:auto">${ic('trash')} Excluir</button>` : ''}<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="offerForm">${ic('check')} ${isEdit ? 'Salvar' : 'Adicionar oferta'}</button></div>`;
  const m = openModal(html);
  const form = m.querySelector('#offerForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = { nome: (fd.get('nome') || '').trim(), nicho: (fd.get('nicho') || '').trim(), anunciante: (fd.get('anunciante') || '').trim(), url: (fd.get('url') || '').trim(), pais: ((fd.get('pais') || 'BR').trim() || 'BR'), status: fd.get('status') || 'Monitorando', obs: (fd.get('obs') || '').trim() };
    if (!data.nome) { form.querySelector('[name=nome]').focus(); return; }
    if (isEdit) { Object.assign(o, data); touched(); persist(); toast('Oferta atualizada', 'good'); }
    else {
      const no = { id: uid(), ...data, criadoEm: todayISO(), snaps: [] };
      const c = parseCount(fd.get('contagem')); if (c != null) no.snaps.push({ data: todayISO(), contagem: c, nota: '' });
      state.offers.push(no); touched(); persist(); toast('Oferta adicionada ao radar', 'good');
    }
    closeModal(); renderAll();
  });
  const del = m.querySelector('[data-del]');
  if (del) del.addEventListener('click', () => confirmDialog({ title: 'Excluir oferta?', msg: `Isso remove <b>${esc(o.nome)}</b> e todo o histórico de registros. Não dá para desfazer.`, confirmLabel: 'Excluir oferta', onConfirm: () => { state.offers = state.offers.filter((x) => x.id !== o.id); touched(); persist(); closeModal(); renderAll(); toast('Oferta excluída'); } }));
  setTimeout(() => form.querySelector('[name=nome]').focus(), 40);
}

/* ----- registro de hoje ----- */
function openDailyLog() {
  const offers = state.offers.filter((o) => o.status !== 'Morta');
  const today = todayISO();
  if (offers.length === 0) { openModal(`<div class="modal-head"><div class="mh-text"><div class="modal-title">Registro de hoje</div></div><button class="modal-close" data-close>${ic('close')}</button></div><div class="modal-body"><p style="color:var(--text-2)">Nenhuma oferta ativa para registrar. Cadastre uma oferta primeiro.</p></div><div class="modal-foot"><button class="btn btn-secondary" data-close>Fechar</button><button class="btn btn-primary" data-menu="nova">${ic('plus')} Nova oferta</button></div>`); return; }
  const rows = offers.map((o) => {
    const snaps = snapsOf(o);
    const todaySnap = snaps.find((s) => s.data === today);
    const prevSnap = [...snaps].reverse().find((s) => s.data !== today) || null;
    const prev = prevSnap ? prevSnap.contagem : '';
    return `<div class="log-row ${todaySnap ? 'done' : ''}" data-id="${o.id}">
      <div class="log-info"><div class="log-name">${esc(o.nome)}</div>
        <div class="log-prev">${ic('clock')} ${prevSnap ? `anterior: <b class="num">${fmt(prevSnap.contagem)}</b> · ${isoBR(prevSnap.data)}` : 'sem registro anterior'} <span class="log-delta flat" data-prev="${prev}"></span></div></div>
      ${o.url ? `<a class="log-open" href="${esc(o.url)}" target="_blank" rel="noopener" title="Abrir busca na Biblioteca">${ic('external')}</a>` : ''}
      <input class="log-input num" inputmode="numeric" autocomplete="off" placeholder="—" value="${todaySnap ? todaySnap.contagem : ''}" data-prev="${prev}">
    </div>`;
  }).join('');
  const html = `<div class="modal-head"><div class="mh-text"><div class="modal-title">Registro de hoje</div><div class="modal-sub">${isoBRFull(today)} · digite a contagem de anúncios de cada oferta</div></div><button class="modal-close" data-close>${ic('close')}</button></div>
    <div class="modal-body"><div class="log-list">${rows}</div></div>
    <div class="modal-foot"><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-save-log>${ic('check')} Salvar registros</button></div>`;
  const m = openModal(html);
  const upd = (inp) => {
    const row = inp.closest('.log-row'); const badge = row.querySelector('.log-delta');
    const prev = inp.dataset.prev === '' ? null : Number(inp.dataset.prev);
    const val = parseCount(inp.value);
    if (val == null || prev == null) { badge.textContent = ''; badge.className = 'log-delta flat'; return; }
    const d = val - prev; badge.textContent = `${fmtSigned(d)} · ${fmtPct(prev === 0 ? (val > 0 ? 100 : 0) : d / prev * 100)}`;
    badge.className = 'log-delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');
  };
  $$('.log-input', m).forEach((inp) => { upd(inp); inp.addEventListener('input', () => upd(inp)); });
  m.querySelector('[data-save-log]').addEventListener('click', () => {
    let count = 0;
    $$('.log-row', m).forEach((row) => {
      const o = state.offers.find((x) => x.id === row.dataset.id); if (!o) return;
      const c = parseCount(row.querySelector('.log-input').value); if (c == null) return;
      _upsertSnap(o, today, c); count++;
    });
    touched(); persist(); closeModal(); renderAll();
    toast(count ? `${count} registro(s) salvos` : 'Nada para salvar', count ? 'good' : null);
  });
  setTimeout(() => { const f = m.querySelector('.log-input'); if (f) f.focus(); }, 40);
}
function _upsertSnap(o, data, contagem, nota) {
  const ex = o.snaps.find((s) => s.data === data);
  if (ex) { ex.contagem = contagem; if (nota !== undefined) ex.nota = nota; }
  else o.snaps.push({ data, contagem, nota: nota || '' });
  o.snaps.sort((a, b) => a.data.localeCompare(b.data));
}

/* ----- detalhe da oferta ----- */
function openDetail(id) {
  const o = state.offers.find((x) => x.id === id); if (!o) return;
  const snaps = snapsOf(o), st = stats(o);
  const meta = [
    o.nicho ? `<span class="meta-chip">${ic('tag')} ${esc(o.nicho)}</span>` : '',
    o.anunciante ? `<span class="meta-chip">${ic('building')} ${esc(o.anunciante)}</span>` : '',
    o.pais ? `<span class="meta-chip">${ic('globe')} ${esc(o.pais)}</span>` : '',
    `<span class="meta-chip"><span class="pill s-${esc(o.status)}" style="padding:1px 8px">${esc(o.status)}</span></span>`,
    o.url ? `<span class="meta-chip">${ic('external')} <a href="${esc(o.url)}" target="_blank" rel="noopener">Abrir biblioteca</a></span>` : '',
  ].join('');

  let body;
  if (st.n === 0) {
    body = `<div class="detail-meta">${meta}</div>${o.obs ? `<p style="color:var(--text-2);font-size:13.5px;margin-bottom:18px">${esc(o.obs)}</p>` : ''}
      <div class="empty" style="padding:40px 20px">${ic('chart')}<h3>Sem registros ainda</h3><p>Adicione a primeira contagem de anúncios para começar a acompanhar a tendência.</p></div>
      ${addSnapHTML()}`;
  } else {
    const chart = buildChart(snaps);
    const statCard = (l, v, cls, sub) => `<div class="stat"><div class="stat-l">${l}</div><div class="stat-v ${cls || ''} num">${v}${sub ? ` <small>${sub}</small>` : ''}</div></div>`;
    const varCls = st.varAbs > 0 ? 'up' : st.varAbs < 0 ? 'down' : '';
    const medCls = st.mediaDia > 0 ? 'up' : st.mediaDia < 0 ? 'down' : '';
    const statsHTML = [
      statCard('Atual', fmt(st.atual), '', humanAgo(st.last.data)),
      statCard('Variação total', fmtSigned(st.varAbs), varCls, fmtPct(st.varPct)),
      statCard('Média/dia', (st.mediaDia > 0 ? '+' : '') + st.mediaDia.toFixed(1), medCls, '/dia'),
      statCard('Pico', fmt(st.pico.contagem), '', isoBR(st.pico.data)),
      statCard('Dias', st.dias, '', ''),
      statCard('Registros', st.registros, '', ''),
    ].join('');
    const rows = snaps.map((s, i) => ({ s, prev: i > 0 ? snaps[i - 1].contagem : null, i }))
      .reverse()
      .map(({ s, prev }) => {
        const d = prev == null ? null : s.contagem - prev;
        const dc = d == null ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
        return `<tr><td>${isoBRFull(s.data)}</td><td class="r num">${fmt(s.contagem)}</td><td class="r t-delta ${dc} num">${d == null ? '—' : fmtSigned(d)}</td><td class="note-cell">${esc(s.nota || '')}</td><td class="r"><div class="row-actions"><button class="icon-btn" data-edit-snap="${s.data}" title="Editar">${ic('edit')}</button><button class="icon-btn danger" data-del-snap="${s.data}" title="Excluir">${ic('trash')}</button></div></td></tr>`;
      }).join('');
    body = `<div class="detail-meta">${meta}</div>${o.obs ? `<p style="color:var(--text-2);font-size:13.5px;margin:-6px 0 16px;line-height:1.55">${esc(o.obs)}</p>` : ''}
      <div class="stats">${statsHTML}</div>
      <div class="chart-wrap">${chart.svg}<div class="chart-tip"></div></div>
      <div class="hist-head"><h4>Histórico</h4></div>
      <table class="table"><thead><tr><th>Data</th><th class="r">Anúncios</th><th class="r">Variação</th><th>Nota</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${addSnapHTML()}`;
    var geom = chart.geom;
  }

  const html = `<div class="modal-head"><div class="mh-text"><div class="modal-title">${esc(o.nome)}</div><div class="modal-sub">${st.n ? `monitorando há ${st.dias} ${st.dias === 1 ? 'dia' : 'dias'}` : 'nova oferta'}</div></div><button class="modal-close" data-close>${ic('close')}</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot detail-foot"><div>${o.url ? `<a class="btn btn-secondary" href="${esc(o.url)}" target="_blank" rel="noopener">${ic('external')} Biblioteca</a>` : ''}</div><div style="display:flex;gap:10px"><button class="btn btn-secondary" data-edit-offer>${ic('edit')} Editar oferta</button><button class="btn btn-primary" data-close>Fechar</button></div></div>`;
  const m = openModal(html, { wide: true });

  if (st.n) { const wrap = m.querySelector('.chart-wrap'); if (wrap) wireChart(wrap, geom); }
  // adicionar registro
  const addBtn = m.querySelector('[data-add-snap]');
  if (addBtn) addBtn.addEventListener('click', () => {
    const date = m.querySelector('.f-date input').value || todayISO();
    const c = parseCount(m.querySelector('.f-count input').value);
    const note = m.querySelector('.f-note input').value.trim();
    if (c == null) { toast('Informe a contagem', 'bad'); return; }
    _upsertSnap(o, date, c, note); touched(); persist(); renderAll(); openDetail(o.id); toast('Registro adicionado', 'good');
  });
  m.querySelector('[data-edit-offer]').addEventListener('click', () => openOfferForm(o.id));
  $$('[data-edit-snap]', m).forEach((b) => b.addEventListener('click', () => editSnapDialog(o, b.dataset.editSnap)));
  $$('[data-del-snap]', m).forEach((b) => b.addEventListener('click', () => confirmDialog({ title: 'Excluir registro?', msg: `Remover o registro de <b>${isoBRFull(b.dataset.delSnap)}</b>?`, confirmLabel: 'Excluir', onConfirm: () => { o.snaps = o.snaps.filter((s) => s.data !== b.dataset.delSnap); touched(); persist(); renderAll(); openDetail(o.id); toast('Registro excluído'); } })));
}
function addSnapHTML() {
  return `<div class="add-snap"><div class="field f-date"><label>Data</label><input class="input" type="date" value="${todayISO()}" max="${todayISO()}"></div><div class="field f-count"><label>Anúncios</label><input class="input num" inputmode="numeric" placeholder="Ex.: 42"></div><div class="field f-note"><label>Nota (opcional)</label><input class="input" placeholder="Novo criativo, mudou o preço…"></div><button class="btn btn-primary" data-add-snap>${ic('plus')} Adicionar</button></div>`;
}
function editSnapDialog(o, data) {
  const snap = o.snaps.find((s) => s.data === data); if (!snap) return;
  const html = `<div class="modal-head"><div class="mh-text"><div class="modal-title">Editar registro</div><div class="modal-sub">${isoBRFull(data)}</div></div><button class="modal-close" data-close>${ic('close')}</button></div>
    <div class="modal-body"><div class="field-row"><div class="field" style="max-width:140px"><label>Anúncios</label><input class="input num" id="esCount" inputmode="numeric" value="${snap.contagem}"></div><div class="field"><label>Nota</label><input class="input" id="esNote" value="${esc(snap.nota || '')}"></div></div></div>
    <div class="modal-foot"><button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${ic('check')} Salvar</button></div>`;
  const m = openModal(html);
  m.querySelector('[data-ok]').addEventListener('click', () => {
    const c = parseCount($('#esCount', m).value); if (c == null) { toast('Contagem inválida', 'bad'); return; }
    snap.contagem = c; snap.nota = $('#esNote', m).value.trim(); touched(); persist(); renderAll(); openDetail(o.id); toast('Registro atualizado');
  });
}

/* ---------- dados de exemplo ---------- */
function makeSnaps(counts) { const n = counts.length; return counts.map((c, i) => ({ data: addDaysISO(todayISO(), -(n - 1 - i)), contagem: c, nota: '' })); }
function exampleOffers() {
  const lib = (q) => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&q=${encodeURIComponent(q)}&search_type=keyword_unordered`;
  return [
    { id: uid(), nome: 'Chá Seca-Barriga 21 Dias', nicho: 'Emagrecimento', anunciante: 'Vida Leve Oficial', pais: 'BR', url: lib('chá seca barriga'), status: 'Escalando', obs: 'Ângulo do chá caseiro + VSL curta. Escalando forte esta semana.', criadoEm: addDaysISO(todayISO(), -9), snaps: makeSnaps([8, 12, 15, 14, 19, 24, 31, 38, 45, 52]) },
    { id: uid(), nome: 'Reconquista em 7 Passos', nicho: 'Relacionamento', anunciante: 'Amor Verdadeiro', pais: 'BR', url: lib('como reconquistar ex'), status: 'Caindo', obs: 'Parou de escalar, criativos saturando.', criadoEm: addDaysISO(todayISO(), -7), snaps: makeSnaps([60, 55, 48, 41, 33, 25, 18, 11]) },
    { id: uid(), nome: 'Método Renda Extra no PIX', nicho: 'Renda Extra', anunciante: 'Liberdade Financeira BR', pais: 'BR', url: lib('renda extra pix'), status: 'Instável', obs: 'Muito teste de criativo, oscila bastante dia a dia.', criadoEm: addDaysISO(todayISO(), -7), snaps: makeSnaps([10, 22, 14, 28, 18, 33, 20, 30]) },
    { id: uid(), nome: 'Protocolo Testosterona Natural', nicho: 'Saúde Masculina', anunciante: 'Homem Alfa', pais: 'BR', url: lib('testosterona natural'), status: 'Monitorando', obs: 'Player consolidado, contagem estável.', criadoEm: addDaysISO(todayISO(), -7), snaps: makeSnaps([14, 15, 14, 16, 15, 14, 17, 16]) },
    { id: uid(), nome: 'Manifestação em 5 Minutos', nicho: 'Espiritualidade', anunciante: 'Universo Conspira', pais: 'BR', url: lib('manifestação'), status: 'Escalando', obs: 'Oferta nova, começando a subir.', criadoEm: addDaysISO(todayISO(), -2), snaps: makeSnaps([5, 9, 16]) },
  ];
}
function loadExample() { state.offers = exampleOffers(); state.seeded = true; persist(); syncSeedBanner(); renderAll(); toast('Dados de exemplo carregados', 'good'); }
function clearAll() { state.offers = []; state.seeded = false; persist(); syncSeedBanner(); renderAll(); toast('Tudo limpo'); }
function syncSeedBanner() { $('#seedBanner').hidden = !state.seeded; }

/* ---------- export / import ---------- */
function exportJSON() {
  const data = { app: 'radar-de-ofertas', v: 1, exportadoEm: new Date().toISOString(), offers: state.offers };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `radar-ofertas-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('Backup exportado', 'good');
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const offers = Array.isArray(data) ? data : data.offers;
      if (!Array.isArray(offers)) throw new Error('formato');
      const clean = offers.map((o) => ({
        id: o.id || uid(), nome: String(o.nome || 'Sem nome'), nicho: o.nicho || '', anunciante: o.anunciante || '', pais: o.pais || 'BR',
        url: o.url || '', status: STATUSES.includes(o.status) ? o.status : 'Monitorando', obs: o.obs || '', criadoEm: o.criadoEm || todayISO(),
        snaps: Array.isArray(o.snaps) ? o.snaps.filter((s) => s && s.data && s.contagem != null).map((s) => ({ data: s.data, contagem: Number(s.contagem) || 0, nota: s.nota || '' })) : [],
      }));
      confirmDialog({
        title: 'Importar backup?', danger: false, confirmLabel: `Substituir por ${clean.length} oferta(s)`,
        msg: `Isso <b>substitui</b> os dados atuais por ${clean.length} oferta(s) do arquivo. Exporte um backup antes se quiser guardar o que está aqui.`,
        onConfirm: () => { state.offers = clean; state.seeded = false; persist(); syncSeedBanner(); closeModal(); renderAll(); toast('Backup importado', 'good'); },
      });
    } catch (e) { toast('Arquivo inválido', 'bad'); }
  };
  reader.readAsText(file);
}

/* ---------- toast ---------- */
let toastT;
function toast(msg, kind) {
  const el = $('#toast');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.innerHTML = `${ic(kind === 'good' ? 'check' : kind === 'bad' ? 'close' : 'pulse')} <span>${esc(msg)}</span>`;
  el.hidden = false; requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 240); }, 2400);
}

/* ---------- menu de dados ---------- */
function toggleMenu(force) {
  const menu = $('#dataMenu'), btn = $('#btnExemplo');
  const open = force != null ? force : menu.hidden;
  menu.hidden = !open; btn.classList.toggle('on', open); btn.setAttribute('aria-expanded', String(open));
}
function handleMenuAction(action) {
  switch (action) {
    case 'nova': openOfferForm(); break;
    case 'log-hoje': openDailyLog(); break;
    case 'export': exportJSON(); break;
    case 'import': $('#importFile').click(); break;
    case 'exemplo':
      if (state.offers.length && !state.seeded) confirmDialog({ title: 'Carregar dados de exemplo?', danger: false, confirmLabel: 'Carregar exemplo', msg: 'Isso <b>substitui</b> as ofertas atuais pelas de exemplo. Exporte um backup antes se precisar.', onConfirm: () => { closeModal(); loadExample(); } });
      else loadExample();
      break;
    case 'limpar':
      if (!state.offers.length) { toast('Nada para limpar'); break; }
      confirmDialog({ title: 'Limpar tudo?', confirmLabel: 'Limpar tudo', msg: 'Isso apaga <b>todas as ofertas e registros</b>. Não dá para desfazer. Considere exportar um backup antes.', onConfirm: () => { closeModal(); clearAll(); } });
      break;
  }
}

/* ---------- wiring ---------- */
function wireGlobal() {
  $('#btnNova').addEventListener('click', () => openOfferForm());
  $('#btnLogHoje').addEventListener('click', () => openDailyLog());
  $('#btnExemplo').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
  $('#btnLimparExemplo').addEventListener('click', () => confirmDialog({ title: 'Começar do zero?', confirmLabel: 'Limpar exemplo', msg: 'Remove os dados de exemplo para você cadastrar suas próprias ofertas.', onConfirm: () => { closeModal(); clearAll(); } }));

  $('#dataMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-menu]'); if (b) { toggleMenu(false); handleMenuAction(b.dataset.menu); } });
  document.addEventListener('click', () => toggleMenu(false));

  // filtros
  $('#search').addEventListener('input', (e) => { state.filters.search = e.target.value; renderGrid(); });
  $('#filterNicho').addEventListener('change', (e) => { state.filters.nicho = e.target.value; renderGrid(); });
  $('#filterStatus').addEventListener('change', (e) => { state.filters.status = e.target.value; renderGrid(); });
  $('#sort').addEventListener('change', (e) => { state.filters.sort = e.target.value; renderGrid(); });

  // grid + destaque (delegação)
  const openFromEl = (el) => { const t = el.closest('[data-action="detail"]'); if (t) openDetail(t.dataset.id); };
  $('#grid').addEventListener('click', (e) => { if (e.target.closest('a')) return; const m = e.target.closest('[data-menu]'); if (m) { handleMenuAction(m.dataset.menu); return; } openFromEl(e.target); });
  $('#grid').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); openDetail(e.target.dataset.id); } });
  $('#highlight').addEventListener('click', (e) => openFromEl(e.target));

  // modais: fechar
  modalRoot.addEventListener('click', (e) => { if (e.target === modalRoot) return closeModal(); if (e.target.closest('[data-close]')) return closeModal(); const mm = e.target.closest('[data-menu]'); if (mm) { closeModal(); handleMenuAction(mm.dataset.menu); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (modalRoot.classList.contains('open')) closeModal(); toggleMenu(false); } });

  // import
  $('#importFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importJSON(f); e.target.value = ''; });
}

/* ---------- init ---------- */
function init() {
  injectIcons(document);
  const stored = Store.load();
  if (stored && Array.isArray(stored.offers)) { state.offers = stored.offers; state.seeded = !!stored.seeded; }
  else { state.offers = exampleOffers(); state.seeded = true; persist(); }
  syncSeedBanner();
  wireGlobal();
  renderAll();
}
init();
