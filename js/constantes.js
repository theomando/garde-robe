// Constantes de l'app. Les valeurs marquées « à calibrer » n'ont pas de source :
// ce sont des points de départ, à ajuster à l'usage.

// Types de vêtements. L'ordre sert au départage dans le moteur et à l'affichage.
export const TYPES = [
  'chaussures', 'pantalon', 'short', 'ceinture', 't-shirt', 'chemise',
  'pull', 'veste', 'manteau', 'chapeau', 'bijoux',
];
export const BAS = ['pantalon', 'short'];
export const LIBELLES_TYPES = {
  chaussures: 'Chaussures', pantalon: 'Pantalon', short: 'Short', ceinture: 'Ceinture', 't-shirt': 'T-shirt',
  chemise: 'Chemise', pull: 'Pull', veste: 'Veste', manteau: 'Manteau', chapeau: 'Chapeau', bijoux: 'Bijoux',
};

// Version affichée dans les réglages (numéro de l'étape du plan tant que l'app est en construction).
export const VERSION_APP = '0.5.2';

// Couches du haut, du corps vers l'extérieur (avatar). Chemise, veste et manteau sont portés ouverts.
export const COUCHES = ['t-shirt', 'pull', 'chemise', 'veste', 'manteau'];

// Occultation : type masqué → types qui le masquent. Une pièce masquée sort du calcul et du rendu.
export const OCCULTATIONS = { 't-shirt': ['pull'] };

// Moteur de propositions (CLAUDE.md, section Moteur).
export const MANQUES_MAX = 2;
export const PROPOSITIONS_MAX = 20;
// Coût d'une pièce en joker = facteur × tolérance : le joker reste un repli derrière une couleur couverte.
export const COUT_JOKER_EN_TOLERANCES = 1;

// Monk Skin Tone Scale, MST 1 à 10 (indice 0 à 9).
// Monk, Ellis. « Monk Skin Tone Scale », 2019. https://skintone.google (licence CC BY 4.0).
// Vérifié le 2026-09-23 sur skintone.google/get-started et dans les fichiers officiels « MST Swatches.zip ».
export const MST = [
  '#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96',
  '#a07e56', '#825c43', '#604134', '#3a312a', '#292420',
];

// Couverture : un vêtement couvre une couleur si ΔE00 ≤ tolérance. À calibrer.
export const TOLERANCE_DEFAUT = 10;
export const TOLERANCE_MIN = 1;
export const TOLERANCE_MAX = 30;
export const TOLERANCE_PAS = 0.5;

// Scan (CLAUDE.md, section Scan de couleur). Valeurs de départ, à calibrer sur l'iPhone.
export const SCAN_FRACTION_CARRE = 0.1; // côté du carré mesuré, en fraction du plus petit côté de l'image
export const SCAN_SEUIL_SATURE = 250; // pixel exclu (reflet) si l'un de ses canaux atteint ce seuil
export const SCAN_PART_VALIDE_MIN = 0.5; // sous cette part de pixels valides : « reflet trop fort »
export const SCAN_DELAI_BALANCE_MS = 1500; // attente sous la torche avant de verrouiller la balance des blancs
export const SCAN_DELAI_SANS_IMAGE_MS = 5000; // sans image de la caméra passé ce délai : repli photo proposé
export const SCAN_APERCU_MS = 300; // rafraîchissement de la couleur affichée en direct

// Jokers : noir si L* ≤ NOIR_L_MAX, blanc si L* ≥ BLANC_L_MIN, et C*ab ≤ NEUTRE_C_MAX. À calibrer.
export const NOIR_L_MAX = 20;
export const BLANC_L_MIN = 90;
export const NEUTRE_C_MAX = 8;
