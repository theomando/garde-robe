import { test, vrai, egal, egalProfond } from './mini-test.js';
import { carreCentral, medianeSansReflets, combinerMesures, viseeStable } from '../js/mesure.js';
import { labDepuisHex } from '../js/couleur.js';

test('mesure stable : médiane par canal des images, une image aberrante écartée', () => {
  const images = [[100, 50, 20], [102, 52, 22], [101, 51, 21], [240, 10, 200], [99, 49, 19]].map((rgb) => ({ rgb }));
  // Rouges triés 99, 100, 101, 102, 240 → 101 ; verts 10, 49, 50, 51, 52 → 50 ; bleus 19, 20, 21, 22, 200 → 21.
  egalProfond(combinerMesures(images), { rgb: [101, 50, 21], images: 5, total: 5 });
  egalProfond(combinerMesures([{ rgb: [10, 10, 10] }, { rgb: [20, 30, 40] }]).rgb, [10, 10, 10], 'médiane basse pour un nombre pair');
});

test('mesure stable : images en échec ignorées, erreur si moins de la moitié réussit', () => {
  const ok = { rgb: [40, 50, 60] };
  egalProfond(combinerMesures([ok, { erreur: 'reflet' }, ok, ok]), { rgb: [40, 50, 60], images: 3, total: 4 });
  egalProfond(combinerMesures([ok, { erreur: 'reflet' }, { erreur: 'vide' }, { erreur: 'reflet' }]), { erreur: 'reflet', images: 1, total: 4 });
  egalProfond(combinerMesures([{ erreur: 'vide' }, { erreur: 'vide' }]), { erreur: 'vide', images: 0, total: 2 });
  egal(combinerMesures([]).erreur, 'vide');
});

test('mesure stable : indicateur « stable » quand les dernières mesures ne bougent plus', () => {
  const lab = (hex) => labDepuisHex(hex);
  egal(viseeStable([lab('#a07e56')]), false, 'une seule mesure ne suffit pas');
  vrai(viseeStable([lab('#a07e56'), lab('#a17e56'), lab('#a07f57'), lab('#a07e56')]), 'écarts infimes : stable');
  egal(viseeStable([lab('#a07e56'), lab('#806040'), lab('#a07e56')]), false, 'une mesure éloignée : pas stable');
});

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
