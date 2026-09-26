import { test, vrai, egal, egalProfond, proche, leve } from './mini-test.js';
import { PAIRES_SHARMA } from './donnees/ciede2000.js';
import { MST_LAB } from './donnees/mst-lab.js';
import { MST } from '../js/constantes.js';
import {
  estHexValide, hexVersRgb, rgbVersHex, labDepuisHex, labDepuisRgb,
  chroma, estNoir, estBlanc, deltaE00, oklabDepuisXyz, oklchDepuisHex,
} from '../js/couleur.js';

// Valeurs de contrôle publiées par Björn Ottosson (« A perceptual color space for image processing », 2020,
// tableau des paires XYZ et OKLab d'exemple), arrondies à 3 décimales.
test('OKLab : paires XYZ → OKLab de référence d\'Ottosson, à 3 décimales', () => {
  const paires = [
    [[0.950, 1.000, 1.089], [1.000, 0.000, 0.000]],
    [[1.000, 0.000, 0.000], [0.450, 1.236, -0.019]],
    [[0.000, 1.000, 0.000], [0.922, -0.671, 0.263]],
    [[0.000, 0.000, 1.000], [0.153, -1.415, -0.449]],
  ];
  for (const [xyz, [L, a, b]] of paires) {
    const ok = oklabDepuisXyz(xyz);
    proche(ok.L, L, 6e-4, `L de ${xyz}`);
    proche(ok.a, a, 6e-4, `a de ${xyz}`);
    proche(ok.b, b, 6e-4, `b de ${xyz}`);
  }
});

test('OKLCh : blanc à L = 1 et C ≈ 0 ; un bleu roi d\'imprimé garde une teinte de bleu, contrairement à CIELAB', () => {
  const blanc = oklchDepuisHex('#ffffff');
  proche(blanc.L, 1, 1e-3);
  proche(blanc.C, 0, 1e-3);
  vrai(oklchDepuisHex('#2e3192').h < 280, 'bleu roi (C100 M100) : teinte des bleus en OKLCh');
  const lab = labDepuisHex('#2e3192');
  vrai((Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360 > 289, 'en CIELAB, sa teinte est celle des violets (raison du choix d\'OKLab)');
  const violet = oklchDepuisHex('#8000ff').h;
  vrai(violet > 280 && violet < 345, `violet : ${violet}`);
});

const lab = (L, a, b) => ({ L, a, b });

test('ΔE00 : les 34 paires de Sharma, Wu et Dalal (2005) à 1e-4 près', () => {
  egal(PAIRES_SHARMA.length, 34, 'nombre de paires');
  const echecs = [];
  let ecartMax = 0;
  PAIRES_SHARMA.forEach(([L1, a1, b1, L2, a2, b2, attendu], i) => {
    const obtenu = deltaE00(lab(L1, a1, b1), lab(L2, a2, b2));
    const ecart = Math.abs(obtenu - attendu);
    ecartMax = Math.max(ecartMax, ecart);
    if (!(ecart <= 1e-4)) echecs.push(`paire ${i + 1} : ${obtenu} au lieu de ${attendu}`);
  });
  vrai(echecs.length === 0, echecs.join(' ; '));
  return `écart max ${ecartMax.toExponential(2)}`;
});

test('ΔE00 : symétrique et nul entre une couleur et elle-même', () => {
  for (const [L1, a1, b1, L2, a2, b2] of PAIRES_SHARMA) {
    const x = lab(L1, a1, b1);
    const y = lab(L2, a2, b2);
    proche(deltaE00(x, y), deltaE00(y, x), 1e-12, 'symétrie');
    egal(deltaE00(x, x), 0, 'identité');
  }
});

test('Lab : #ffffff donne (100, 0, 0) et #000000 donne (0, 0, 0)', () => {
  const blanc = labDepuisHex('#ffffff');
  proche(blanc.L, 100, 1e-9, 'L* du blanc');
  proche(blanc.a, 0, 1e-9, 'a* du blanc');
  proche(blanc.b, 0, 1e-9, 'b* du blanc');
  const noir = labDepuisHex('#000000');
  proche(noir.L, 0, 1e-9, 'L* du noir');
  proche(noir.a, 0, 1e-9, 'a* du noir');
  proche(noir.b, 0, 1e-9, 'b* du noir');
});

test('Lab : les 256 gris ont a* = b* = 0 et un L* strictement croissant', () => {
  let precedent = -Infinity;
  for (let v = 0; v <= 255; v++) {
    const gris = labDepuisRgb([v, v, v]);
    proche(gris.a, 0, 1e-9, `a* du gris ${v}`);
    proche(gris.b, 0, 1e-9, `b* du gris ${v}`);
    vrai(gris.L > precedent, `L* du gris ${v} non croissant`);
    precedent = gris.L;
  }
});

test('Lab : gris sombres (1 à 10) sur les segments linéaires de l\'IEC 61966-2-1 et de la CIE', () => {
  // Pour v ≤ 10, la composante vaut (v/255)/12,92 (IEC 61966-2-1) et Y reste sous (6/29)³,
  // donc L* = κ·Y avec κ = 24389/27 (CIE 15:2004), sans passer par les puissances.
  for (let v = 1; v <= 10; v++) {
    proche(labDepuisRgb([v, v, v]).L, (24389 / 27) * (v / 255) / 12.92, 1e-9, `L* du gris ${v}`);
  }
});

test('Lab : les 10 teintes MST concordent avec les Lab publiés par skintone.google', () => {
  egal(MST_LAB.length, 10);
  let ecartMax = 0;
  MST_LAB.forEach(({ mst, hex, L, a, b }) => {
    egal(hex, MST[mst - 1], `hex MST ${mst} de constantes.js`);
    const obtenu = labDepuisHex(hex);
    proche(obtenu.L, L, 0.01, `L* MST ${mst}`);
    proche(obtenu.a, a, 0.01, `a* MST ${mst}`);
    proche(obtenu.b, b, 0.01, `b* MST ${mst}`);
    ecartMax = Math.max(ecartMax, Math.abs(obtenu.L - L), Math.abs(obtenu.a - a), Math.abs(obtenu.b - b));
  });
  return `écart max ${ecartMax.toFixed(4)}`;
});

test('hex : validation', () => {
  for (const valide of ['#000000', '#ffffff', '#a07e56', '#ABCDEF']) vrai(estHexValide(valide), valide);
  for (const invalide of ['#12345', '123456', '#1234567', '#gggggg', '', null, undefined, 123456, '#12 456']) {
    vrai(!estHexValide(invalide), String(invalide));
    leve(() => hexVersRgb(invalide), `hexVersRgb(${invalide}) doit lever une erreur`);
  }
});

test('hex : conversion aller-retour avec rgb', () => {
  egalProfond(hexVersRgb('#a07e56'), [160, 126, 86]);
  egalProfond(hexVersRgb('#ABCDEF'), [171, 205, 239]);
  egal(rgbVersHex([160, 126, 86]), '#a07e56');
  for (let v = 0; v <= 255; v++) {
    const hex = rgbVersHex([v, 255 - v, (v * 7) % 256]);
    egalProfond(hexVersRgb(hex), [v, 255 - v, (v * 7) % 256]);
  }
  for (const invalide of [[256, 0, 0], [-1, 0, 0], [1.5, 0, 0], [0, 0], '#000000', null]) {
    leve(() => rgbVersHex(invalide), `rgbVersHex(${JSON.stringify(invalide)}) doit lever une erreur`);
  }
});

test('jokers : seuils noir (L* ≤ 20, C* ≤ 8) et blanc (L* ≥ 90, C* ≤ 8), bornes incluses', () => {
  vrai(estNoir(lab(20, 8, 0)), 'noir à la borne');
  vrai(!estNoir(lab(20.000001, 0, 0)), 'L* au-dessus du seuil noir');
  vrai(!estNoir(lab(10, 8.000001, 0)), 'C* au-dessus du seuil noir');
  vrai(estBlanc(lab(90, 0, 8)), 'blanc à la borne');
  vrai(!estBlanc(lab(89.999999, 0, 0)), 'L* sous le seuil blanc');
  vrai(!estBlanc(lab(95, 0, 8.000001)), 'C* au-dessus du seuil blanc');
  vrai(estNoir(labDepuisHex('#000000')) && !estBlanc(labDepuisHex('#000000')), '#000000');
  vrai(estBlanc(labDepuisHex('#ffffff')) && !estNoir(labDepuisHex('#ffffff')), '#ffffff');
  vrai(!estNoir(labDepuisHex('#ff0000')) && !estBlanc(labDepuisHex('#ff0000')), '#ff0000');
  proche(chroma(lab(50, 3, 4)), 5, 1e-12, 'chroma');
});
