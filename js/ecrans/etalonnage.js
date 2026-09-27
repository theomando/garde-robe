// Étalonnage de la caméra (Réglages) : un vêtement entièrement blanc, puis un entièrement noir, mesurés dans les
// conditions habituelles. Un étalonnage par façon de mesurer (torche, sans torche, photo), choisie dans les Réglages
// et imposée pendant les deux mesures (demande de Théo, 2026-09-27 : on ne pouvait en faire qu'un, la torche se
// rallumant à chaque mesure). Les mesures suivantes faites de la même façon sont corrigées.

import { el, ouvrirDialogue, afficherErreurs, annoncer, confirmer } from '../ui.js';
import { LIBELLES_MODES_SCAN } from '../constantes.js';
import { enregistrerEtalonnage, supprimerEtalonnage } from '../donnees.js';
import { verifierMesuresEtalonnage, appliquerEtalonnage } from '../etalonnage.js';
import { ouvrirScan } from './scan.js';

// Correction à appliquer à une mesure brute selon la façon dont elle a été faite (null si pas d'étalonnage).
export function correcteur(app) {
  return (rgb, mode) => {
    const mesures = app.etat.reglages.etalonnage?.[mode];
    return mesures ? appliquerEtalonnage(rgb, mesures) : rgb;
  };
}

// Ce qui se passe pendant les deux mesures, selon la façon de mesurer.
const DEROULEMENT = {
  torche: 'La torche reste allumée pendant les deux mesures.',
  'sans-torche': 'La torche reste éteinte : mesure à la lumière de la pièce où tu mesures d\'habitude.',
  photo: 'Le déclencheur ouvre l\'appareil photo de l\'iPhone : prends chaque vêtement en photo, avec ou sans flash comme d\'habitude.',
};
const VISER = {
  blanc: { camera: 'Vise le vêtement entièrement blanc, à 10 à 20 cm.', photo: 'Touche le déclencheur et prends en photo le vêtement entièrement blanc.' },
  noir: { camera: 'Même chose avec le vêtement entièrement noir.', photo: 'Même chose : prends en photo le vêtement entièrement noir.' },
};

// mode : 'torche', 'sans-torche' ou 'photo' (ligne touchée dans les Réglages).
export async function etalonner(app, actions, mode) {
  const facon = LIBELLES_MODES_SCAN[mode].toLowerCase(); // « avec la torche », « sans torche », « par photo »
  const deja = Boolean(app.etat.reglages.etalonnage?.[mode]);
  const depart = await ouvrirDialogue({
    titre: `Étalonner : ${facon}`,
    contenu: [
      el('p', {}, 'Il te faut un vêtement entièrement blanc et un entièrement noir, sans motif.'),
      el('ol', {},
        el('li', {}, 'Mesure le vêtement blanc, puis le vêtement noir.'),
        el('li', {}, DEROULEMENT[mode]),
        el('li', {}, 'Même distance et même pièce que pour tes mesures habituelles.')),
      el('p', { class: 'discret' }, `Ensuite, chaque mesure faite ${facon} sera corrigée : ton noir retombera sur le noir du catalogue, ton blanc sur le blanc${mode === 'torche' ? ', et la dominante bleue de la torche sera retirée' : ''}. Les autres façons de mesurer ont leur propre étalonnage.`),
      deja ? el('div', { class: 'groupe' },
        el('button', { type: 'button', class: 'ligne ligne-action danger', 'data-choix': 'supprimer', 'data-action': 'supprimer-etalonnage' }, 'Supprimer cet étalonnage')) : null,
    ],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle: deja ? 'Refaire' : 'Commencer', valeur: 'commencer', style: 'principal' }],
  });
  if (depart === 'supprimer') {
    if (!(await confirmer(`Supprimer l'étalonnage ${facon} ?`, `Les prochaines mesures faites ${facon} ne seront plus corrigées. Tes vêtements déjà enregistrés ne changent pas.`, 'Supprimer'))) return;
    if (actions.mettreAJour(supprimerEtalonnage(app.etat, mode))) annoncer(`Étalonnage supprimé (${facon}).`);
    return;
  }
  if (depart !== 'commencer') return;

  const viser = (couleur) => VISER[couleur][mode === 'photo' ? 'photo' : 'camera'];
  const blanc = await ouvrirScan({ titre: 'Étalonnage : vêtement blanc', consigne: viser('blanc'), mode });
  if (!blanc) return;
  const noir = await ouvrirScan({ titre: 'Étalonnage : vêtement noir', consigne: viser('noir'), mode });
  if (!noir) return;

  // La torche peut s'éteindre seule (surchauffe) : les deux mesures doivent être de la façon choisie.
  if (blanc.mode !== mode || noir.mode !== mode) {
    await afficherErreurs('Étalonnage non enregistré', 'Les deux mesures doivent être faites de la façon choisie :', [
      `attendu : ${facon} ; vêtement blanc : ${LIBELLES_MODES_SCAN[blanc.mode].toLowerCase()} ; vêtement noir : ${LIBELLES_MODES_SCAN[noir.mode].toLowerCase()}. Recommence l'étalonnage.`,
    ]);
    return;
  }
  const probleme = verifierMesuresEtalonnage(blanc.rgb, noir.rgb);
  if (probleme) {
    await afficherErreurs('Étalonnage non enregistré', 'Les mesures ne permettent pas d\'étalonner :', [probleme]);
    return;
  }
  const nouvelEtat = enregistrerEtalonnage(app.etat, mode, { blanc: blanc.rgb, noir: noir.rgb }, new Date());
  if (actions.mettreAJour(nouvelEtat)) annoncer(`Caméra étalonnée (${facon}).`);
}
