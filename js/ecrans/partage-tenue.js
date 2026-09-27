// Bouton « Partager » d'une tenue (onglet Tenue et Mes tenues) : image de la tenue, puis partage d'iOS.
// Si iOS refuse (le geste est trop ancien une fois l'image prête), une feuille montre l'image avec un second
// bouton « Partager » : l'image est alors prête et le partage part tout de suite.

import { el, annoncer, ouvrirDialogue } from '../ui.js';
import { LIBELLES_TYPES, MST } from '../constantes.js';
import { imageTenue, partagerFichier } from '../partage.js';
import { piecesAvatar, referenceCombinaison } from '../tenues.js';
import { nomCouleurVetement } from './garde-robe.js';

function lignes(app, tenue) {
  return tenue.pieces.map((piece) => {
    const type = LIBELLES_TYPES[piece.type];
    if (piece.manque) {
      const cible = tenue.combinaison.couleurs.find((c) => c.id === piece.couleurId);
      return { hex: piece.hex, joker: !cible, type, manque: true, texte: cible ? `il te manque ${cible.nom}` : 'il te manque un noir ou un blanc' };
    }
    const vetement = app.etat.vetements.find((v) => v.id === piece.vetementId);
    const nom = vetement ? nomCouleurVetement(vetement, app.catalogue) : piece.hex;
    return { hex: piece.hex, rayures: piece.hexSecondaires ? [piece.hex, ...piece.hexSecondaires] : null, type, manque: false, texte: vetement?.marque ? `${nom} · ${vetement.marque}` : nom };
  });
}

function nomFichier(tenue) {
  const base = (tenue.nom ?? referenceCombinaison(tenue.combinaison)).normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `tenue-${base || 'garde-robe'}.png`;
}

// tenue : tenue gardée ou instantané d'une proposition (js/tenues.js).
export async function partagerTenue(app, actions, tenue) {
  const titre = tenue.nom ?? referenceCombinaison(tenue.combinaison);
  let blob;
  try {
    blob = await imageTenue({
      titre,
      sousTitre: tenue.nom ? referenceCombinaison(tenue.combinaison) : 'Ma tenue du jour',
      peau: MST[app.etat.reglages.mst - 1],
      pieces: piecesAvatar(tenue),
      couleurs: tenue.combinaison.couleurs,
      lignes: lignes(app, tenue),
    });
  } catch {
    annoncer('Image de la tenue impossible à créer.', 'erreur');
    return;
  }
  const fichier = new File([blob], nomFichier(tenue), { type: 'image/png' });
  const envoyer = () => partagerFichier(fichier, { titre, telecharger: (f) => actions.telecharger(f) });
  if (await envoyer() !== 'refuse') return;
  const adresse = URL.createObjectURL(blob);
  await ouvrirDialogue({
    titre: 'Partager la tenue',
    classe: 'feuille-partage',
    contenu: [
      el('img', { class: 'image-partage', src: adresse, alt: `Image de la tenue ${titre}` }),
      el('button', { type: 'button', class: 'bouton principal large', 'data-action': 'partager-image', onclick: () => { envoyer(); } }, 'Partager'),
      el('p', { class: 'pied-groupe' }, 'Tu peux aussi appuyer longuement sur l\'image pour l\'enregistrer.'),
    ],
    boutons: [{ libelle: 'Fermer', valeur: null }],
  });
  URL.revokeObjectURL(adresse);
}
