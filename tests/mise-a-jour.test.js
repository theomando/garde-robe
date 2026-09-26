// Tests de js/mise-a-jour.js avec des doubles du conteneur, de l'enregistrement et des workers
// (le vrai service worker est testé dans pwa.test.js).
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { installerServiceWorker, estDeveloppementLocal } from '../js/mise-a-jour.js';

function worker(etat = 'installing') {
  const w = new EventTarget();
  w.state = etat;
  w.messages = [];
  w.postMessage = (message) => w.messages.push(message);
  w.passer = (nouvelEtat) => { w.state = nouvelEtat; w.dispatchEvent(new Event('statechange')); };
  return w;
}

function enregistrement({ installing = null, waiting = null } = {}) {
  const e = new EventTarget();
  Object.assign(e, { installing, waiting, active: null, surUpdate: null });
  e.update = async () => { e.surUpdate?.(); return e; };
  return e;
}

function conteneur(enr, controller = null) {
  const c = new EventTarget();
  c.controller = controller;
  c.register = async (url) => { c.url = url; return enr; };
  return c;
}

// Nouvelle version trouvée : installing, puis installed (waiting renseigné avant l'événement, comme dans la spec).
function nouvelleVersion(enr) {
  const w = worker();
  enr.installing = w;
  enr.dispatchEvent(new Event('updatefound'));
  return () => { enr.installing = null; enr.waiting = w; w.passer('installed'); };
}

function espions() {
  const compte = { bandeau: 0, rechargement: 0 };
  return { compte, surNouvelleVersion: () => compte.bandeau++, recharger: () => compte.rechargement++ };
}

test('mise à jour : développement local reconnu, pas de service worker sans conteneur', async () => {
  for (const hote of ['localhost', '127.0.0.1', '[::1]']) egal(estDeveloppementLocal(hote), true, hote);
  egal(estDeveloppementLocal('theomando.github.io'), false);
  egal(await installerServiceWorker({ conteneur: undefined, surNouvelleVersion() {}, recharger() {} }), null);
});

test('mise à jour : première installation sans bandeau ni rechargement', async () => {
  const enr = enregistrement();
  const c = conteneur(enr, null);
  const { compte, ...rappels } = espions();
  await installerServiceWorker({ conteneur: c, ...rappels });
  egal(c.url, 'sw.js');
  nouvelleVersion(enr)();
  egal(compte.bandeau, 0, 'aucune page contrôlée : pas une mise à jour');
  c.controller = enr.waiting;
  c.dispatchEvent(new Event('controllerchange')); // clients.claim()
  egal(compte.rechargement, 0);
});

test('mise à jour : nouvelle version, bandeau, puis « Recharger » l\'active et recharge la page', async () => {
  const enr = enregistrement();
  const c = conteneur(enr, worker('activated'));
  const { compte, ...rappels } = espions();
  const miseAJour = await installerServiceWorker({ conteneur: c, ...rappels });
  egal(compte.bandeau, 0);
  const installer = nouvelleVersion(enr);
  egal(compte.bandeau, 0, 'pas avant la fin de l\'installation');
  installer();
  egal(compte.bandeau, 1, 'bandeau affiché');
  egal(compte.rechargement, 0, 'la page n\'est pas rechargée d\'office');
  const enAttente = enr.waiting;
  egal(miseAJour.activer(), true);
  egalProfond(enAttente.messages, ['activer']);
  c.dispatchEvent(new Event('controllerchange'));
  egal(compte.rechargement, 1, 'rechargement quand la nouvelle version prend la main');
});

test('mise à jour : version déjà en attente au lancement, bandeau immédiat ; activer sans attente ne fait rien', async () => {
  const enr = enregistrement({ waiting: worker('installed') });
  const { compte, ...rappels } = espions();
  await installerServiceWorker({ conteneur: conteneur(enr, worker('activated')), ...rappels });
  egal(compte.bandeau, 1);

  const vide = enregistrement();
  const c = conteneur(vide, worker('activated'));
  const autres = espions();
  const miseAJour = await installerServiceWorker({ conteneur: c, surNouvelleVersion: autres.surNouvelleVersion, recharger: autres.recharger });
  egal(miseAJour.activer(), false);
  c.dispatchEvent(new Event('controllerchange'));
  egal(autres.compte.rechargement, 0, 'aucun rechargement non demandé');
});

test('mise à jour : « Charger la dernière version » active la version trouvée, ou répond « déjà à jour »', async () => {
  const enr = enregistrement();
  const c = conteneur(enr, worker('activated'));
  const { compte, ...rappels } = espions();
  const miseAJour = await installerServiceWorker({ conteneur: c, ...rappels });
  egal(await miseAJour.chercher(), false, 'rien de nouveau');

  enr.surUpdate = () => {
    const installer = nouvelleVersion(enr);
    setTimeout(installer, 0);
  };
  egal(await miseAJour.chercher(), true, 'version trouvée puis activée');
  egalProfond(enr.waiting.messages, ['activer']);
  c.dispatchEvent(new Event('controllerchange'));
  egal(compte.rechargement, 1);

  const echec = enregistrement();
  echec.surUpdate = () => {
    const w = worker();
    echec.installing = w;
    setTimeout(() => { echec.installing = null; w.passer('redundant'); }, 0);
  };
  const autre = await installerServiceWorker({ conteneur: conteneur(echec, worker('activated')), ...espions() });
  egal(await autre.chercher(), false, 'installation ratée : rien à activer');
  vrai(true);
});
