/**
 * ===========================================================
 * RADAR DE OFERTAS — backend (Google Apps Script)
 * -----------------------------------------------------------
 * Guarda os dados numa planilha do Google (criada automaticamente
 * na primeira vez, dentro do seu Drive). Sem custo.
 *
 * COMO PUBLICAR (uma vez):
 *   1. Abra https://script.google.com  ›  Novo projeto
 *   2. Apague o conteúdo e cole TODO este arquivo
 *   3. (opcional) troque o TOKEN abaixo por uma senha sua — e
 *      avise, para eu colocar a mesma no app
 *   4. Implantar › Nova implantação › engrenagem › "App da Web"
 *        - Descrição: Radar de Ofertas
 *        - Executar como: Eu (sua conta)
 *        - Quem tem acesso: Qualquer pessoa
 *   5. Implantar › Autorizar acesso (é a SUA conta que autoriza)
 *   6. Copie a "URL do app da Web" (termina em /exec) e me mande
 *
 * Depois disso eu ligo o app nessa URL e tudo passa a ficar salvo
 * na nuvem, sincronizando entre o Vercel, o GitHub Pages e o seu PC.
 * ===========================================================
 */

// Senha simples que o app envia junto (proteção leve — não é
// segurança forte, pois fica visível no código do site). Deixe
// igual à constante SYNC_TOKEN do app.js.
var TOKEN = 'radar-c0ffee-42';

var OFFER_COLS = ['id', 'nome', 'nicho', 'anunciante', 'pais', 'url', 'pv', 'status', 'obs', 'criadoEm'];
var SNAP_COLS  = ['offerId', 'data', 'contagem', 'nota'];

/* ----------------- HTTP ----------------- */
function doGet(e) {
  if (!authed_(e, null)) return json_({ ok: false, error: 'unauthorized' });
  try { return json_({ ok: true, data: readAll_() }); }
  catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!authed_(e, body)) return json_({ ok: false, error: 'unauthorized' });
    var payload = body.data || body;
    if (!payload || !Array.isArray(payload.offers)) return json_({ ok: false, error: 'bad payload' });
    payload.updatedAt = payload.updatedAt || Date.now();
    writeAll_(payload);
    return json_({ ok: true, updatedAt: payload.updatedAt });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function authed_(e, body) {
  if (TOKEN === '') return true;
  var t = (e && e.parameter && e.parameter.token) || (body && body.token);
  return t === TOKEN;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ----------------- Planilha ----------------- */
function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('Radar de Ofertas — Dados'); props.setProperty('SS_ID', ss.getId()); }
  ensureSheet_(ss, 'offers', OFFER_COLS.concat(['json']));
  ensureSheet_(ss, 'snapshots', SNAP_COLS);
  ensureSheet_(ss, 'meta', ['key', 'value']);
  return ss;
}
function ensureSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, header.length).setValues([header]);
  return sh;
}

function readAll_() {
  var ss = ss_();
  var offers = offerRows_(ss.getSheetByName('offers'));
  var snaps  = rows_(ss.getSheetByName('snapshots'), SNAP_COLS);
  var meta   = meta_(ss.getSheetByName('meta'));
  var byId = {};
  offers.forEach(function (o) { o.snaps = []; byId[o.id] = o; });
  snaps.forEach(function (s) {
    var o = byId[s.offerId];
    if (o) o.snaps.push({ data: String(s.data), contagem: Number(s.contagem) || 0, nota: s.nota || '' });
  });
  return { offers: offers, updatedAt: Number(meta.updatedAt) || 0, seeded: meta.seeded === 'true' };
}
// A coluna "json" carrega a oferta completa (à prova de novos campos); as
// outras colunas ficam só para leitura humana na planilha.
function offerRows_(sh) {
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0], idx = {}; head.forEach(function (h, i) { idx[h] = i; });
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (String(row[idx['id']] || '') === '') continue;
    var o = null;
    if (idx['json'] != null && row[idx['json']]) { try { o = JSON.parse(row[idx['json']]); } catch (e) { o = null; } }
    if (!o) { o = {}; OFFER_COLS.forEach(function (c) { o[c] = idx[c] != null ? row[idx[c]] : ''; }); }
    delete o.snaps;
    out.push(o);
  }
  return out;
}
function writeAll_(data) {
  var ss = ss_();
  var offers = data.offers || [];
  grid_(ss.getSheetByName('offers'), OFFER_COLS.concat(['json']), offers.map(function (o) {
    var noSnaps = {}; for (var k in o) { if (k !== 'snaps') noSnaps[k] = o[k]; }
    return OFFER_COLS.map(function (c) { return o[c] != null ? o[c] : ''; }).concat([JSON.stringify(noSnaps)]);
  }));
  var snapRows = [];
  offers.forEach(function (o) {
    (o.snaps || []).forEach(function (s) { snapRows.push([o.id, s.data, Number(s.contagem) || 0, s.nota || '']); });
  });
  grid_(ss.getSheetByName('snapshots'), SNAP_COLS, snapRows);
  grid_(ss.getSheetByName('meta'), ['key', 'value'], [
    ['updatedAt', String(data.updatedAt || Date.now())],
    ['seeded', String(!!data.seeded)],
  ]);
}

function rows_(sh, cols) {
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0], idx = {};
  head.forEach(function (h, i) { idx[h] = i; });
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (String(row[idx[cols[0]]]) === '') continue;
    var o = {};
    cols.forEach(function (c) { o[c] = idx[c] != null ? row[idx[c]] : ''; });
    out.push(o);
  }
  return out;
}
function meta_(sh) {
  var vals = sh.getDataRange().getValues(), m = {};
  for (var r = 1; r < vals.length; r++) if (vals[r][0] !== '') m[vals[r][0]] = String(vals[r][1]);
  return m;
}
function grid_(sh, header, rows) {
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
}
