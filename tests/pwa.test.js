// Tests de la PWA : manifeste, icônes, liens de index.html, liste du service worker, puis un vrai service worker
// (installation, précache, réponses depuis le cache, nettoyage des anciens caches). Le service worker et ses
// caches sont retirés à la fin, pour ne pas servir d'anciens fichiers au lancement suivant.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { VERSION_APP } from '../js/constantes.js';
import { attendreReel, avecTempsReel } from './aides.js';

const racine = new URL('../', import.meta.url);
const adresse = (chemin) => new URL(chemin, racine).href;

async function lire(chemin) {
  const reponse = await fetch(adresse(chemin), { cache: 'no-store' });
  if (!reponse.ok) throw new Error(`${chemin} : HTTP ${reponse.status}`);
  return reponse;
}

// Signature PNG (8 octets), puis bloc IHDR : largeur et hauteur en octets 16 à 23 (grand-boutiste).
async function png(chemin) {
  const reponse = await lire(chemin);
  const octets = new DataView(await reponse.arrayBuffer());
  return {
    signature: [137, 80, 78, 71, 13, 10, 26, 10].every((o, i) => octets.getUint8(i) === o),
    largeur: octets.getUint32(16),
    hauteur: octets.getUint32(20),
    type: reponse.headers.get('content-type'),
  };
}

async function listeSw() {
  const source = await (await lire('sw.js')).text();
  const version = source.match(/const VERSION = '([^']+)';/)?.[1];
  const bloc = source.match(/const FICHIERS = \[([\s\S]*?)\];/)?.[1] ?? '';
  return { version, fichiers: [...bloc.matchAll(/'([^']+)'/g)].map((m) => m[1]) };
}

// Fichiers d'un dossier, d'après la page de liste du serveur local (outils/serveur.py, http.server).
async function fichiersDuDossier(dossier) {
  const page = new DOMParser().parseFromString(await (await lire(dossier)).text(), 'text/html');
  return [...page.querySelectorAll('a')].map((a) => decodeURIComponent(a.getAttribute('href')))
    .filter((nom) => !nom.endsWith('/')).map((nom) => `${dossier}${nom}`);
}

test('pwa : manifeste (autonome, chemins relatifs, français) et icônes 192, 512 et 1024 à la bonne taille', async () => {
  const reponse = await lire('manifest.webmanifest');
  vrai(reponse.headers.get('content-type').startsWith('application/manifest+json'), 'type du manifeste');
  const manifeste = await reponse.json();
  egal(manifeste.display, 'standalone');
  egal(manifeste.start_url, './');
  egal(manifeste.scope, './');
  egal(manifeste.lang, 'fr');
  vrai(manifeste.name && manifeste.short_name && manifeste.short_name.length <= 12, 'nom et nom court (écran d\'accueil)');
  egalProfond(manifeste.icons.map((i) => i.sizes), ['192x192', '512x512', '1024x1024']);
  for (const icone of manifeste.icons) {
    egal(icone.purpose, 'any');
    egal(icone.type, 'image/png');
    vrai(!icone.src.startsWith('/'), `chemin relatif : ${icone.src}`);
    const image = await png(icone.src);
    vrai(image.signature, `PNG : ${icone.src}`);
    egal(`${image.largeur}x${image.hauteur}`, icone.sizes, icone.src);
  }
});

test('pwa : index.html relie le manifeste, l\'icône 180 × 180 (apple-touch-icon) et porte le bandeau caché', async () => {
  const page = new DOMParser().parseFromString(await (await lire('index.html')).text(), 'text/html');
  egal(page.querySelector('link[rel="manifest"]').getAttribute('href'), 'manifest.webmanifest');
  const icone = page.querySelector('link[rel="apple-touch-icon"]').getAttribute('href');
  const image = await png(icone);
  vrai(image.signature && image.largeur === 180 && image.hauteur === 180, `apple-touch-icon 180 × 180 (${image.largeur} × ${image.hauteur})`);
  for (const lien of page.querySelectorAll('[href], [src]')) {
    const valeur = lien.getAttribute('href') ?? lien.getAttribute('src');
    vrai(!valeur.startsWith('/'), `chemin relatif : ${valeur}`);
  }
  vrai(page.getElementById('nouvelle-version').hidden, 'bandeau « Nouvelle version » caché au départ');
});

test('pwa : liste du service worker complète, version = VERSION_APP, rien d\'interdit, tout répond', async () => {
  const { version, fichiers } = await listeSw();
  egal(version, VERSION_APP, 'VERSION de sw.js = VERSION_APP (constantes.js)');
  egal(new Set(fichiers).size, fichiers.length, 'sans doublon');
  const attendus = [
    './', 'index.html', 'manifest.webmanifest', 'data/wada.json', 'data/LICENSE-wada.md',
    ...(await fichiersDuDossier('css/')), ...(await fichiersDuDossier('js/')), ...(await fichiersDuDossier('js/ecrans/')),
    ...(await fichiersDuDossier('icones/')),
  ];
  egalProfond([...fichiers].sort(), [...attendus].sort(), 'tous les fichiers de l\'app, et eux seuls');
  for (const fichier of fichiers) {
    vrai(!/papier-tigre\.json|^tests\/|^outils\/|^\//.test(fichier), `interdit dans le précache : ${fichier}`);
    await lire(fichier);
  }
});

// Le temps virtuel d'Edge sans fenêtre n'attend pas les promesses de caches et de serviceWorker : chaque appel
// passe par avecTempsReel (tests/aides.js).
test('pwa : vrai service worker, précache complet, réponses depuis le cache, anciens caches de l\'app seuls supprimés', async () => {
  vrai(navigator.serviceWorker, 'service worker disponible');
  const reel = (promesse, message) => avecTempsReel(promesse, message);
  const { fichiers } = await listeSw();
  const ancien = 'garde-robe-0.0.1';
  const autreSite = 'autre-site-1'; // l'origine github.io est partagée : ce cache n'est pas à nous
  await reel(caches.open(ancien), 'cache ancien');
  await reel(caches.open(autreSite), 'cache d\'un autre site');
  let enregistrement = null;
  try {
    enregistrement = await reel(navigator.serviceWorker.register(adresse('sw.js'), { scope: racine.href }), 'enregistrement');
    await attendreReel(() => enregistrement.active?.state === 'activated', 'installation et activation');
    const cache = await reel(caches.open(`garde-robe-${VERSION_APP}`), 'cache de la version');
    const enCache = (await reel(cache.keys(), 'contenu du cache')).map((requete) => requete.url).sort();
    egalProfond(enCache, fichiers.map(adresse).sort(), 'précache complet');
    egal(await reel(caches.has(ancien), 'ancien'), false, 'ancien cache de l\'app supprimé');
    egal(await reel(caches.has(autreSite), 'autre site'), true, 'cache d\'un autre site conservé');

    await attendreReel(() => navigator.serviceWorker.controller, 'page prise en main (clients.claim)');
    await reel(cache.put(adresse('__sonde-sw'), new Response('depuis le cache')), 'sonde en cache');
    const sonde = await reel(fetch(adresse('__sonde-sw')), 'sonde');
    egal(await reel(sonde.text(), 'texte de la sonde'), 'depuis le cache', 'réponse servie par le cache');
    const horsCache = await reel(fetch(adresse('tests/aides.js')), 'fichier hors cache');
    egal(horsCache.status, 200, 'fichier hors cache : réseau');
  } finally {
    const nettoyer = async () => {
      await enregistrement?.unregister();
      for (const nom of await caches.keys()) if (nom.startsWith('garde-robe-') || nom === autreSite) await caches.delete(nom);
    };
    await reel(nettoyer(), 'nettoyage');
  }
});
