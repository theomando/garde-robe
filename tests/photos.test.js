// Tests des photos de vêtements : magasin IndexedDB (base de test isolée) et vignettes JPEG.
// Le temps virtuel d'Edge sans fenêtre n'attend ni IndexedDB ni le décodage d'image : avecTempsReel.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { avecTempsReel } from './aides.js';
import { photoUnie } from './aides.js';
import { ouvrirPhotos, vignetteDepuisFichier } from '../js/photos.js';

const reel = (promesse, message) => avecTempsReel(promesse, message);

test('photos : écrire, relire, supprimer, tout remplacer (base de test isolée)', async () => {
  const magasin = ouvrirPhotos('tests-photos');
  await reel(magasin.remplacerTout(new Map()), 'vidage');
  await reel(magasin.ecrire('v1', 'data:image/jpeg;base64,AAAA'), 'écriture');
  await reel(magasin.ecrire('v2', 'data:image/jpeg;base64,BBBB'), 'écriture');
  egalProfond([...(await reel(magasin.toutes(), 'lecture'))].sort(), [['v1', 'data:image/jpeg;base64,AAAA'], ['v2', 'data:image/jpeg;base64,BBBB']]);
  await reel(magasin.supprimer('v1'), 'suppression');
  egalProfond([...(await reel(magasin.toutes(), 'lecture'))], [['v2', 'data:image/jpeg;base64,BBBB']]);
  await reel(magasin.remplacerTout(new Map([['v3', 'data:image/jpeg;base64,CCCC']])), 'remplacement');
  egalProfond([...(await reel(magasin.toutes(), 'lecture'))], [['v3', 'data:image/jpeg;base64,CCCC']], 'remplacement total');
  await reel(magasin.remplacerTout(new Map()), 'nettoyage');
});

test('photos : vignette JPEG carrée, recadrée, jamais agrandie', async () => {
  const fichier = new File([await photoUnie('#a07e56', 200, 120)], 'photo.png', { type: 'image/png' });
  const vignette = await reel(vignetteDepuisFichier(fichier, { cote: 100 }), 'vignette');
  vrai(vignette.startsWith('data:image/jpeg;base64,'), 'JPEG');
  const image = new Image();
  image.src = vignette;
  await reel(image.decode(), 'décodage');
  egal(`${image.naturalWidth}×${image.naturalHeight}`, '100×100', 'carrée, au côté demandé');
  const petite = await reel(vignetteDepuisFichier(fichier, { cote: 500 }), 'vignette');
  const image2 = new Image();
  image2.src = petite;
  await reel(image2.decode(), 'décodage');
  egal(image2.naturalWidth, 120, 'pas d\'agrandissement : côté = plus petit côté de la photo');
});
