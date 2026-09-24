// Colorimétrie : hex → sRGB → XYZ (D65) → CIELAB → ΔE00 (CIEDE2000).
// Module pur, sans DOM. Un Lab est un objet { L, a, b }.

import { NOIR_L_MAX, BLANC_L_MIN, NEUTRE_C_MAX } from './constantes.js';

const MOTIF_HEX = /^#[0-9a-fA-F]{6}$/;

export function estHexValide(hex) {
  return typeof hex === 'string' && MOTIF_HEX.test(hex);
}

export function hexVersRgb(hex) {
  if (!estHexValide(hex)) throw new TypeError(`hex invalide : ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbVersHex(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every((c) => Number.isInteger(c) && c >= 0 && c <= 255)) {
    throw new TypeError(`rgb invalide : ${JSON.stringify(rgb)}`);
  }
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// sRGB, IEC 61966-2-1:1999 : décodage de la composante (0 à 255) vers la valeur linéaire (0 à 1).
function lineaire(c8) {
  const v = c8 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

// Matrice sRGB linéaire → XYZ (D65) de la norme IEC 61966-2-1, à 4 décimales
// (reprise dans l'article Wikipédia « sRGB », consulté le 2026-09-24).
const M = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505],
];

// Blanc de référence = M × (1, 1, 1), calculé dans le même ordre que xyzDepuisRgb :
// #ffffff donne ainsi exactement X/Xn = Y/Yn = Z/Zn = 1, donc L* = 100 et a* = b* = 0.
const BLANC = M.map(([x, y, z]) => x * 1 + y * 1 + z * 1);

export function xyzDepuisRgb([r8, g8, b8]) {
  const r = lineaire(r8);
  const g = lineaire(g8);
  const b = lineaire(b8);
  return M.map(([x, y, z]) => x * r + y * g + z * b);
}

// Fonction f de la CIE (CIE 15:2004) : seuil (6/29)³, partie linéaire t / (3 (6/29)²) + 4/29.
const SEUIL_F = (6 / 29) ** 3;
const PENTE_F = 1 / (3 * (6 / 29) ** 2);
function f(t) {
  return t > SEUIL_F ? Math.cbrt(t) : t * PENTE_F + 4 / 29;
}

export function labDepuisRgb(rgb) {
  const [X, Y, Z] = xyzDepuisRgb(rgb);
  const fx = f(X / BLANC[0]);
  const fy = f(Y / BLANC[1]);
  const fz = f(Z / BLANC[2]);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labDepuisHex(hex) {
  return labDepuisRgb(hexVersRgb(hex));
}

export function chroma({ a, b }) {
  return Math.sqrt(a * a + b * b);
}

export function estNoir(lab) {
  return lab.L <= NOIR_L_MAX && chroma(lab) <= NEUTRE_C_MAX;
}

export function estBlanc(lab) {
  return lab.L >= BLANC_L_MIN && chroma(lab) <= NEUTRE_C_MAX;
}

// CIEDE2000 avec kL = kC = kH = 1, d'après les notes d'implémentation de
// Sharma, Wu et Dalal (2005), Color Research and Application 30(1), p. 21-30.
const RAD = Math.PI / 180;
const PUISSANCE_25_7 = 25 ** 7;

// x⁷ par multiplications (plus rapide que ** dans la boucle de précalcul du moteur).
function puissance7(x) {
  const x2 = x * x;
  const x3 = x2 * x;
  return x3 * x3 * x;
}

function teinte(ap, b) {
  if (ap === 0 && b === 0) return 0;
  const h = Math.atan2(b, ap) / RAD;
  return h < 0 ? h + 360 : h;
}

export function deltaE00(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cm7 = puissance7((C1 + C2) / 2);
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + PUISSANCE_25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const h1p = teinte(a1p, b1);
  const h2p = teinte(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const produitC = C1p * C2p;
  let dhp = 0;
  if (produitC !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(produitC) * Math.sin((dhp / 2) * RAD);

  const Lmp = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let hmp;
  if (produitC === 0) hmp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hmp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hmp = (h1p + h2p + 360) / 2;
  else hmp = (h1p + h2p - 360) / 2;

  const T = 1
    - 0.17 * Math.cos((hmp - 30) * RAD)
    + 0.24 * Math.cos(2 * hmp * RAD)
    + 0.32 * Math.cos((3 * hmp + 6) * RAD)
    - 0.20 * Math.cos((4 * hmp - 63) * RAD);
  const u = (hmp - 275) / 25;
  const dTheta = 30 * Math.exp(-(u * u));
  const Cmp7 = puissance7(Cmp);
  const RC = 2 * Math.sqrt(Cmp7 / (Cmp7 + PUISSANCE_25_7));
  const ecartL2 = (Lmp - 50) * (Lmp - 50);
  const SL = 1 + (0.015 * ecartL2) / Math.sqrt(20 + ecartL2);
  const SC = 1 + 0.045 * Cmp;
  const SH = 1 + 0.015 * Cmp * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;

  const tL = dLp / SL;
  const tC = dCp / SC;
  const tH = dHp / SH;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}
