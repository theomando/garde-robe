// Tests des photos de vêtements : magasin IndexedDB (base de test isolée) et vignettes JPEG.
// Le temps virtuel d'Edge sans fenêtre n'attend ni IndexedDB ni le décodage d'image : avecTempsReel.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { avecTempsReel } from './aides.js';
import { photoUnie } from './aides.js';
import { ouvrirPhotos, photoDepuisFichier } from '../js/photos.js';

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

test('photos : JPEG réduit sur le grand côté (1080 px par défaut), sans recadrage, jamais agrandi', async () => {
  const fichier = new File([await photoUnie('#a07e56', 200, 120)], 'photo.png', { type: 'image/png' });
  const dimensions = async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await reel(image.decode(), 'décodage');
    return `${image.naturalWidth}×${image.naturalHeight}`;
  };
  const reduite = await reel(photoDepuisFichier(fichier, { cote: 100 }), 'photo');
  vrai(reduite.startsWith('data:image/jpeg;base64,'), 'JPEG');
  egal(await dimensions(reduite), '100×60', 'grand côté ramené à 100, proportions gardées');
  egal(await dimensions(await reel(photoDepuisFichier(fichier), 'photo')), '200×120', 'pas d\'agrandissement (1080 par défaut)');
});
