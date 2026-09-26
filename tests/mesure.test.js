import { test, egal, egalProfond } from './mini-test.js';
import { carreCentral, medianeSansReflets } from '../js/mesure.js';

// Pixels RGBA synthétiques : [[r, g, b], nombre]…
function pixels(...groupes) {
  const liste = [];
  for (const [[r, g, b], n] of groupes) for (let i = 0; i < n; i++) liste.push(r, g, b, 255);
  return new Uint8ClampedArray(liste);
}

test('mesure : carré central de 10 % du plus petit côté, centré', () => {
  egalProfond(carreCentral(640, 480), { x: 296, y: 216, cote: 48 });
  egalProfond(carreCentral(480, 640), { x: 216, y: 296, cote: 48 });
  egalProfond(carreCentral(3024, 4032), { x: 1361, y: 1865, cote: 302 });
  egalProfond(carreCentral(3027, 4032), { x: 1362, y: 1864, cote: 303 }, '302,7 arrondi à 303');
  egalProfond(carreCentral(5, 5), { x: 2, y: 2, cote: 1 }, 'au moins un pixel');
});

test('mesure : couleur uniforme retrouvée exactement', () => {
  egalProfond(medianeSansReflets(pixels([[160, 126, 86], 100])), { rgb: [160, 126, 86], valides: 100, total: 100 });
});

test('mesure : médiane par canal, insensible aux pixels minoritaires', () => {
  const r = medianeSansReflets(pixels([[100, 50, 20], 60], [[10, 200, 240], 40]));
  egalProfond(r.rgb, [100, 50, 20]);
});

test('mesure : médiane basse pour un nombre pair de pixels', () => {
  egalProfond(medianeSansReflets(pixels([[10, 10, 10], 1], [[20, 30, 40], 1])).rgb, [10, 10, 10]);
});

test('mesure : pixels saturés exclus (un canal ≥ 250), 249 conservé', () => {
  const r = medianeSansReflets(pixels([[250, 10, 10], 40], [[40, 50, 60], 60]));
  egalProfond(r, { rgb: [40, 50, 60], valides: 60, total: 100 });
  for (const sature of [[10, 250, 10], [10, 10, 250]]) {
    egalProfond(medianeSansReflets(pixels([sature, 40], [[40, 50, 60], 60])), { rgb: [40, 50, 60], valides: 60, total: 100 }, `saturé ${sature}`);
  }
  egal(medianeSansReflets(pixels([[249, 10, 10], 1])).valides, 1);
});

test('mesure : moins de la moitié de pixels valides, reflet signalé', () => {
  egalProfond(medianeSansReflets(pixels([[255, 255, 255], 70], [[40, 50, 60], 30])), { erreur: 'reflet', valides: 30, total: 100 });
  egalProfond(medianeSansReflets(pixels([[255, 255, 255], 50], [[40, 50, 60], 50])).rgb, [40, 50, 60], 'exactement la moitié : accepté');
  egal(medianeSansReflets(new Uint8ClampedArray(0)).erreur, 'vide');
});
