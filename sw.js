/* Radar de Ofertas — service worker
   Carregamento instantâneo/offline do app, sem nunca cachear a API de
   sincronização (Google Apps Script). Suba o VERSION a cada mudança de shell. */
const VERSION = 'radar-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js',
  './favicon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'radar-fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // Deixa passar direto tudo que é cross-origin dinâmico — inclui a API de
  // sincronização (script.google.com / script.googleusercontent.com).
  if (!sameOrigin && !isFont) return;

  // Fontes (imutáveis): cache-first.
  if (isFont) {
    e.respondWith(caches.open('radar-fonts').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  // App shell (mesma origem): stale-while-revalidate — responde do cache na
  // hora e atualiza em segundo plano; a próxima carga já pega a versão nova.
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
