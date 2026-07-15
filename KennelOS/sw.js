// sw.js — app-shell cache so KennelOS installs as a PWA and keeps working
// offline after the first load, per CLAUDE.md. Registered from app.js with a
// scope of this file's own directory (the KennelOS root), so it covers /pages/
// too. Bump CACHE_NAME whenever the precache list changes to roll caches over.
const CACHE_NAME = 'kennelos-shell-v1';

const PRECACHE_URLS = [
  './',
  'index.html',
  'app.js',
  'nav.js',
  'manifest.json',
  'assets/app.css',
  'assets/eventForm.js',
  'assets/importView.js',
  'assets/kennelSetupUI.js',
  'assets/listView.js',
  'assets/pedigree.js',
  'assets/puppyForm.js',
  'assets/reportView.js',
  'assets/sampleDataUI.js',
  'assets/timeline.js',
  'assets/ui.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'data/appReset.js',
  'data/contactRepo.js',
  'data/csvImport.js',
  'data/db.js',
  'data/dogRepo.js',
  'data/eventRepo.js',
  'data/importExport.js',
  'data/kennelRepo.js',
  'data/kennelSetup.js',
  'data/litterRepo.js',
  'data/pairingRepo.js',
  'data/referenceRegistry.js',
  'data/repoBase.js',
  'data/sampleData.js',
  'data/settings.js',
  'data/vocab.js',
  'pages/active-breeding.html',
  'pages/active-breeding.js',
  'pages/contact-import.html',
  'pages/contact-import.js',
  'pages/contact.html',
  'pages/contact.js',
  'pages/contacts.html',
  'pages/contacts.js',
  'pages/dog-import.html',
  'pages/dog-import.js',
  'pages/dog.html',
  'pages/dog.js',
  'pages/dogs.html',
  'pages/dogs.js',
  'pages/import-export.html',
  'pages/import-export.js',
  'pages/kennels.html',
  'pages/kennels.js',
  'pages/litter-import.html',
  'pages/litter-import.js',
  'pages/litter.html',
  'pages/litter.js',
  'pages/litters.html',
  'pages/litters.js',
  'pages/pairing-import.html',
  'pages/pairing-import.js',
  'pages/pairing.html',
  'pages/pairing.js',
  'pages/pairings.html',
  'pages/pairings.js',
  'pages/pedigree.html',
  'pages/pedigree.js',
  'pages/roster.html',
  'pages/roster.js',
  'vendor/dexie.min.mjs',
  'vendor/papaparse.min.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET requests, with runtime caching of anything
// not already in the precache list; falls through to the network untouched
// for everything else (cross-origin, non-GET).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
