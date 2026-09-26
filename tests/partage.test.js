// Tests du partage d'une tenue : image PNG au bon format, et issue du partage (iOS, annulé, refusé, téléchargement).
import { test, vrai, egal } from './mini-test.js';
import { avecTempsReel } from './aides.js';
import { imageTenue, partagerFichier, LARGEUR_IMAGE, HAUTEUR_IMAGE } from '../js/partage.js';

// Largeur et hauteur d'un PNG : bloc IHDR, octets 16 à 23 (grand-boutiste).
async function dimensions(blob) {
  const octets = new DataView(await avecTempsReel(blob.arrayBuffer(), 'lecture du PNG'));
  return [octets.getUint32(16), octets.getUint32(20)];
}

test('partage : image PNG de la tenue (1080 × 1350), avec pièce manquante et joker', async () => {
  const blob = await avecTempsReel(imageTenue({
    titre: 'Réunion de lundi', sousTitre: 'Combinaison n° 12', peau: '#d7bd96',
    pieces: [{ type: 'pantalon', hex: '#1e0e3f', manque: false }, { type: 'pull', hex: '#ae5224', manque: true }],
    couleurs: [{ hex: '#1e0e3f' }, { hex: '#ae5224' }, { hex: '#fdd4bd', role: 'soutien' }],
    lignes: [
      { hex: '#1e0e3f', type: 'Pantalon', texte: 'Dull Violet Black · Uniqlo', manque: false },
      { hex: '#ae5224', type: 'Pull', texte: 'il te manque Burnt Sienna', manque: true },
      { hex: '#000000', joker: true, type: 'Chapeau', texte: 'il te manque un noir ou un blanc', manque: true },
    ],
  }), 'image de la tenue');
  egal(blob.type, 'image/png');
  vrai(blob.size > 10000, `image non vide (${blob.size} octets)`);
  egal((await dimensions(blob)).join('×'), `${LARGEUR_IMAGE}×${HAUTEUR_IMAGE}`);
});

test('partage : partage d\'iOS, annulé, refusé (geste trop ancien) ou téléchargement à défaut', async () => {
  const fichier = new File(['x'], 'tenue.png', { type: 'image/png' });
  const avant = { canShare: Object.getOwnPropertyDescriptor(navigator, 'canShare'), share: Object.getOwnPropertyDescriptor(navigator, 'share') };
  const simuler = (canShare, share) => {
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  };
  const telecharges = [];
  const options = { titre: 'Tenue', telecharger: (f) => telecharges.push(f) };
  const erreur = (name) => Object.assign(new Error(name), { name });
  try {
    simuler(() => true, async () => {});
    egal(await partagerFichier(fichier, options), 'partage');
    simuler(() => true, async () => { throw erreur('AbortError'); });
    egal(await partagerFichier(fichier, options), 'annule');
    simuler(() => true, async () => { throw erreur('NotAllowedError'); });
    egal(await partagerFichier(fichier, options), 'refuse');
    egal(telecharges.length, 0, 'rien de téléchargé jusqu\'ici');
    simuler(() => false, async () => {});
    egal(await partagerFichier(fichier, options), 'telechargement');
    egal(telecharges[0], fichier);
  } finally {
    for (const [cle, descripteur] of Object.entries(avant)) {
      if (descripteur) Object.defineProperty(navigator, cle, descripteur);
      else delete navigator[cle];
    }
  }
});
