// Service worker : met l'app en cache pour qu'elle marche hors ligne après la première visite.
// Cache versionné : VERSION suit VERSION_APP (js/constantes.js, vérifié par les tests) ; changer de version change
// ce fichier, ce qui déclenche l'installation de la nouvelle version en arrière-plan. Elle attend ensuite que
// l'utilisateur touche « Recharger » (bandeau de js/mise-a-jour.js) pour prendre la main.
// Jamais en cache : data/papier-tigre.json (jamais publié), tests/ et outils/.
// Le nom du cache est préfixé : l'origine theomando.github.io est partagée avec les autres sites du compte.

const VERSION = '0.9.0';
const PREFIXE = 'garde-robe-';
const CACHE = `${PREFIXE}${VERSION}`;

// Chemins relatifs à sw.js (site servi sous /garde-robe/). La liste est comparée aux dossiers par les tests.
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/avatar.js',
  'js/catalogue.js',
  'js/constantes.js',
  'js/couleur.js',
  'js/donnees.js',
  'js/etalonnage.js',
  'js/icones.js',
  'js/mesure.js',
  'js/mise-a-jour.js',
  'js/moteur.js',
  'js/papier-tigre.js',
  'js/scan.js',
  'js/statistiques.js',
  'js/stockage.js',
  'js/ui.js',
  'js/ecrans/etalonnage.js',
  'js/ecrans/garde-robe.js',
  'js/ecrans/manques.js',
  'js/ecrans/premier-lancement.js',
  'js/ecrans/reglages.js',
  'js/ecrans/scan.js',
  'js/ecrans/selecteur-catalogue.js',
  'js/ecrans/tenue.js',
  'data/wada.json',
  'data/LICENSE-wada.md',
  'icones/icone-180.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-1024.png',
];

// { cache: 'reload' } : on contourne le cache HTTP (10 min sur GitHub Pages) pour ne pas figer d'anciens fichiers.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FICHIERS.map((fichier) => new Request(fichier, { cache: 'reload' })))));
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith(PREFIXE) && nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evenement) => {
  if (evenement.data === 'activer') self.skipWaiting();
});

// Cache d'abord, réseau ensuite. Pour une page, les paramètres (?espace=, ?ecran=) ne changent pas le fichier.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;
  evenement.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(requete, { ignoreSearch: requete.mode === 'navigate' });
    return enCache ?? fetch(requete);
  })());
});
