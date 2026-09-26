// Étalonnage de la caméra : correction par deux points (noir, blanc), canal par canal, en sRGB linéaire.
// Module pur, sans DOM.
//
// L'exposition automatique de l'iPhone et la lumière froide de la torche déforment la mesure (un noir sort gris
// ou bleuté). Une fois un vêtement blanc et un noir mesurés dans les mêmes conditions, chaque canal est recalé
// linéairement : la mesure du noir devient la cible noire, celle du blanc la cible blanche (couleurs « Black »
// et « White » du catalogue Wada). Le calcul se fait en valeurs linéaires (lumière), pas en valeurs encodées.

import { ETALONNAGE_CIBLE_NOIR, ETALONNAGE_CIBLE_BLANC, ETALONNAGE_ECART_MIN } from './constantes.js';
import { hexVersRgb, lineaireDepuisOctet, octetDepuisLineaire } from './couleur.js';

export function estTripletRvb(x) {
  return Array.isArray(x) && x.length === 3 && x.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
}

// Contrôle d'un couple de mesures : renvoie un message d'erreur, ou null si l'étalonnage est utilisable.
export function verifierMesuresEtalonnage(blanc, noir) {
  if (!estTripletRvb(blanc) || !estTripletRvb(noir)) return 'mesures du blanc et du noir invalides (3 entiers de 0 à 255 attendus)';
  if (blanc.some((v, c) => v - noir[c] < ETALONNAGE_ECART_MIN)) {
    return 'le blanc et le noir mesurés sont trop proches : vérifie que les vêtements sont bien blanc et noir, et que l\'éclairage est le même';
  }
  return null;
}

// Applique l'étalonnage { blanc, noir } (mesures brutes) à une mesure brute [r, g, b] ; renvoie [r, g, b] corrigé.
export function appliquerEtalonnage(rgb, { blanc, noir }) {
  const cibleNoir = hexVersRgb(ETALONNAGE_CIBLE_NOIR);
  const cibleBlanc = hexVersRgb(ETALONNAGE_CIBLE_BLANC);
  return rgb.map((valeur, c) => {
    const k = lineaireDepuisOctet(noir[c]);
    const w = lineaireDepuisOctet(blanc[c]);
    const kCible = lineaireDepuisOctet(cibleNoir[c]);
    const wCible = lineaireDepuisOctet(cibleBlanc[c]);
    const t = (lineaireDepuisOctet(valeur) - k) / (w - k);
    return octetDepuisLineaire(kCible + t * (wCible - kCible));
  });
}
