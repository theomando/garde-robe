// Étalonnage de la caméra (Réglages) : un vêtement entièrement blanc, puis un entièrement noir, scannés une fois
// dans les conditions habituelles. Les scans suivants faits de la même façon (torche, sans torche, photo) sont corrigés.

import { el, ouvrirDialogue, afficherErreurs, annoncer } from '../ui.js';
import { LIBELLES_MODES_SCAN } from '../constantes.js';
import { enregistrerEtalonnage } from '../donnees.js';
import { verifierMesuresEtalonnage, appliquerEtalonnage } from '../etalonnage.js';
import { ouvrirScan } from './scan.js';

const NB = String.fromCharCode(0xa0); // espace insécable dans les guillemets français

// Correction à appliquer à une mesure brute selon la façon dont elle a été faite (null si pas d'étalonnage).
export function correcteur(app) {
  return (rgb, mode) => {
    const mesures = app.etat.reglages.etalonnage?.[mode];
    return mesures ? appliquerEtalonnage(rgb, mesures) : rgb;
  };
}

export async function etalonner(app, actions) {
  const depart = await ouvrirDialogue({
    titre: 'Étalonner la caméra',
    contenu: [
      el('p', {}, 'À faire une seule fois. Il te faut un vêtement entièrement blanc et un entièrement noir, sans motif.'),
      el('ol', {},
        el('li', {}, 'Scanne le vêtement blanc, puis le vêtement noir.'),
        el('li', {}, 'Fais-le comme tes scans habituels : même façon de mesurer (torche allumée, ou photo), même distance, même pièce.')),
      el('p', { class: 'discret' }, 'Ensuite, chaque scan fait de la même façon sera corrigé : ton noir retombera sur le noir du catalogue, ton blanc sur le blanc, et la dominante de la torche sera retirée.'),
    ],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle: 'Commencer', valeur: 'commencer', style: 'principal' }],
  });
  if (depart !== 'commencer') return;

  const blanc = await ouvrirScan({
    titre: 'Étalonnage : vêtement blanc',
    consigne: `Place le vêtement entièrement blanc dans le carré, comme pour un scan habituel, puis touche «${NB}Mesurer${NB}».`,
  });
  if (!blanc) return;
  const noir = await ouvrirScan({
    titre: 'Étalonnage : vêtement noir',
    consigne: `Même chose avec le vêtement entièrement noir, dans les mêmes conditions, puis touche «${NB}Mesurer${NB}».`,
  });
  if (!noir) return;

  if (blanc.mode !== noir.mode) {
    await afficherErreurs('Étalonnage non enregistré', 'Les deux mesures doivent être faites de la même façon :', [
      `vêtement blanc : ${LIBELLES_MODES_SCAN[blanc.mode].toLowerCase()} ; vêtement noir : ${LIBELLES_MODES_SCAN[noir.mode].toLowerCase()}. Recommence l'étalonnage.`,
    ]);
    return;
  }
  const probleme = verifierMesuresEtalonnage(blanc.rgb, noir.rgb);
  if (probleme) {
    await afficherErreurs('Étalonnage non enregistré', 'Les mesures ne permettent pas d\'étalonner :', [probleme]);
    return;
  }
  const nouvelEtat = enregistrerEtalonnage(app.etat, blanc.mode, { blanc: blanc.rgb, noir: noir.rgb }, new Date());
  if (actions.mettreAJour(nouvelEtat)) annoncer(`Caméra étalonnée (${LIBELLES_MODES_SCAN[blanc.mode].toLowerCase()}).`);
}
