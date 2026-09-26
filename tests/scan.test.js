// Pilote de la caméra testé avec des doublures (aucune caméra réelle), et mesure d'une photo synthétique.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { creerCamera, ErreurCamera, mesurerPhoto } from '../js/scan.js';
import { photoSynthetique, avecTempsReel } from './aides.js';

function pisteFactice({ capacites = {}, rejet = false, sansCapacites = false } = {}) {
  const piste = {
    arrets: 0,
    contraintes: [],
    ecouteurs: {},
    applyConstraints: async (c) => {
      piste.contraintes.push(JSON.parse(JSON.stringify(c)));
      if (rejet) throw new DOMException('refusé', 'OverconstrainedError');
    },
    stop() { piste.arrets++; },
    addEventListener(nom, fn) { piste.ecouteurs[nom] = fn; },
  };
  if (!sansCapacites) piste.getCapabilities = () => capacites;
  return piste;
}

function mediaFactice(piste, erreur = null) {
  return {
    demandes: [],
    async getUserMedia(contraintes) {
      this.demandes.push(contraintes);
      if (erreur) throw erreur;
      return { getVideoTracks: () => [piste], getTracks: () => [piste] };
    },
  };
}

function documentFactice() {
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  return doc;
}

function minuterieFactice() {
  const taches = [];
  return {
    taches,
    planifier: (ms, fn) => { taches.push({ ms, fn, annulee: false }); return taches.length; },
    annuler: (id) => { taches[id - 1].annulee = true; },
  };
}

function camera(piste, options = {}) {
  const minuterie = minuterieFactice();
  const pertes = [];
  const media = options.media ?? mediaFactice(piste, options.erreur);
  const doc = documentFactice();
  const cam = creerCamera({
    mediaDevices: media, documentCible: doc, planifier: minuterie.planifier, annuler: minuterie.annuler,
    surPerte: (raison) => pertes.push(raison),
  });
  return { cam, media, doc, minuterie, pertes };
}

async function rejet(promesse) {
  try { await promesse; } catch (erreur) { return erreur; }
  throw new Error('une erreur était attendue');
}

test('scan : sans mediaDevices, caméra « indisponible »', async () => {
  // null et non undefined : undefined déclencherait la valeur par défaut (la vraie caméra du navigateur).
  const erreur = await rejet(creerCamera({ mediaDevices: null, documentCible: documentFactice() }).demarrer());
  vrai(erreur instanceof ErreurCamera);
  egal(erreur.code, 'indisponible');
});

test('scan : refus, absence et autre erreur de getUserMedia distingués', async () => {
  const cas = [['NotAllowedError', 'refus'], ['NotFoundError', 'indisponible'], ['NotReadableError', 'indisponible'], ['TypeError', 'erreur']];
  for (const [nom, code] of cas) {
    const { cam } = camera(pisteFactice(), { erreur: new DOMException('x', nom) });
    egal((await rejet(cam.demarrer())).code, code, nom);
  }
});

test('scan : caméra arrière demandée, sans micro', async () => {
  const { cam, media } = camera(pisteFactice());
  await cam.demarrer();
  egalProfond(media.demandes[0], { video: { facingMode: { ideal: 'environment' } }, audio: false });
});

test('scan : sans capacité torch (ou sans getCapabilities), torche indisponible et rien d\'appliqué', async () => {
  for (const piste of [pisteFactice({ capacites: {} }), pisteFactice({ sansCapacites: true })]) {
    const { cam } = camera(piste);
    const info = await cam.demarrer();
    egal(info.torcheDisponible, false);
    egal(await cam.reglerTorche(true), false);
    egal(piste.contraintes.length, 0);
  }
});

test('scan : torche allumée, état tenu par l\'app, balance des blancs verrouillée après le délai', async () => {
  const piste = pisteFactice({ capacites: { torch: true, whiteBalanceMode: ['manual', 'single-shot', 'continuous'] } });
  const { cam, minuterie } = camera(piste);
  const info = await cam.demarrer();
  vrai(info.torcheDisponible && info.balanceVerrouillable);
  egal(await cam.reglerTorche(true), true);
  egalProfond(piste.contraintes[0], { advanced: [{ torch: true }] });
  egal(minuterie.taches.length, 1);
  egal(minuterie.taches[0].ms, 1500);
  await minuterie.taches[0].fn();
  egalProfond(piste.contraintes[1], { advanced: [{ torch: true, whiteBalanceMode: 'manual' }] }, 'torche redemandée avec la balance');
  egalProfond(cam.etat(), { torche: true, balance: 'manual', arretee: false });
  egal(await cam.reglerTorche(false), false);
  egalProfond(piste.contraintes[2], { advanced: [{ torch: false, whiteBalanceMode: 'continuous' }] }, 'balance libérée sans torche');
});

test('scan : torche éteinte avant le délai, verrouillage annulé', async () => {
  const piste = pisteFactice({ capacites: { torch: true, whiteBalanceMode: ['manual', 'continuous'] } });
  const { cam, minuterie } = camera(piste);
  await cam.demarrer();
  await cam.reglerTorche(true);
  await cam.reglerTorche(false);
  vrai(minuterie.taches[0].annulee, 'minuterie annulée');
});

test('scan : applyConstraints refusé, torche considérée éteinte', async () => {
  const piste = pisteFactice({ capacites: { torch: true }, rejet: true });
  const { cam } = camera(piste);
  await cam.demarrer();
  egal(await cam.reglerTorche(true), false);
  egal(cam.etat().torche, false);
});

test('scan : arrêt unique des pistes, aussi quand l\'app passe en arrière-plan', async () => {
  const piste = pisteFactice({ capacites: { torch: true } });
  const { cam, doc, pertes } = camera(piste);
  await cam.demarrer();
  await cam.reglerTorche(true);
  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
  egal(piste.arrets, 1);
  egalProfond(pertes, ['arriere-plan']);
  egal(cam.etat().torche, false, 'torche éteinte avec la piste');
  cam.arreter();
  egal(piste.arrets, 1, 'pas de second stop()');
});

test('scan : fin de piste signalée, et annulation pendant l\'ouverture de la caméra', async () => {
  const piste = pisteFactice();
  const { cam, pertes } = camera(piste);
  await cam.demarrer();
  piste.ecouteurs.ended();
  egalProfond(pertes, ['fin']);
  egal(piste.arrets, 1);

  const lente = pisteFactice();
  let liberer;
  const media = { getUserMedia: () => new Promise((r) => { liberer = () => r({ getVideoTracks: () => [lente], getTracks: () => [lente] }); }) };
  const { cam: cam2 } = camera(lente, { media });
  const ouverture = cam2.demarrer();
  cam2.arreter();
  liberer();
  egal((await rejet(ouverture)).code, 'erreur');
  egal(lente.arrets, 1, 'flux arrivé après l\'annulation : arrêté');
});

test('scan : photo mesurée sur son carré central, vignette avec le carré tracé', async () => {
  const { mesure, apercu } = await avecTempsReel(mesurerPhoto(await photoSynthetique()), 'décodage de la photo');
  egalProfond(mesure, { rgb: [160, 126, 86], valides: 100, total: 100 });
  egal(apercu.width, 200);
  egal(apercu.height, 100);
  const grande = await avecTempsReel(mesurerPhoto(await photoSynthetique(600, 400), { tailleApercu: 240 }), 'décodage');
  egal(grande.apercu.width, 240, 'vignette réduite');
});
