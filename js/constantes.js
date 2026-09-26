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
export const VERSION_APP = '0.13.0'; // à reporter dans sw.js (VERSION), vérifié par les tests

// Couches du haut, du corps vers l'extérieur (avatar). Chemise, veste et manteau sont portés ouverts.
export const COUCHES = ['t-shirt', 'pull', 'chemise', 'veste', 'manteau'];

// Occultation : type masqué → types qui le masquent. Une pièce masquée sort du calcul et du rendu.
export const OCCULTATIONS = { 't-shirt': ['pull'] };

// Moteur de propositions (CLAUDE.md, section Moteur).
export const MANQUES_MAX = 2;
export const PROPOSITIONS_MAX = 20;
// Coût d'une pièce en joker = facteur × tolérance : le joker reste un repli derrière une couleur couverte.
export const COUT_JOKER_EN_TOLERANCES = 1;
// Manques fréquents (CLAUDE.md, section Favoris et statistiques) : nombre de lignes affichées.
export const MANQUES_FREQUENTS_MAX = 10;

// Données version 2 (demandes de Théo, 2026-09-26) : marque et photo des vêtements, tenues gardées, sauvegarde.
export const MARQUE_MAX = 40; // caractères
export const NOM_TENUE_MAX = 60; // caractères
export const PHOTO_COTE = 320; // vignette carrée, en pixels (recadrée au centre)
export const PHOTO_QUALITE = 0.8; // JPEG : environ 20 à 35 Ko par vignette
export const PHOTO_TAILLE_MAX = 400000; // longueur maximale d'une photo (data URL) acceptée à l'import
export const RAPPEL_SAUVEGARDE_JOURS = 30; // rappel si la dernière sauvegarde est plus ancienne (et que des données ont changé)
export const RAPPEL_PREMIER_JOURS = 7; // jamais sauvegardé : rappel une fois le premier vêtement vieux de 7 jours
export const RAPPEL_REPORT_JOURS = 7; // « Plus tard » : rappel repoussé d'une semaine

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
export const SCAN_PART_VALIDE_MIN = 0.5; // sous cette part de pixels valides : « reflet trop fort »
export const SCAN_DELAI_BALANCE_MS = 1500; // attente sous la torche avant de verrouiller la balance des blancs
export const SCAN_DELAI_SANS_IMAGE_MS = 5000; // sans image de la caméra passé ce délai : repli photo proposé
export const SCAN_APERCU_MS = 300; // rafraîchissement de la couleur affichée en direct
// Mesure stable (demande de Théo, 2026-09-26) : « Mesurer » combine plusieurs images (médiane par canal).
export const SCAN_IMAGES_PAR_MESURE = 10; // images combinées par mesure
export const SCAN_INTERVALLE_IMAGES_MS = 100; // entre deux images : la mesure dure environ une seconde
export const SCAN_STABLE_FENETRE = 4; // mesures en direct comparées pour l'indicateur « stable » (≈ 1,2 s)
export const SCAN_STABLE_DELTA_E = 2; // écart ΔE00 maximal entre elles pour afficher « stable » ; à calibrer

// Étalonnage de la caméra (demande de Théo, 2026-09-26) : un vêtement blanc et un noir scannés une fois,
// puis correction par deux points canal par canal. Un étalonnage par façon de mesurer (l'exposition diffère).
export const MODES_SCAN = ['torche', 'sans-torche', 'photo'];
export const LIBELLES_MODES_SCAN = { torche: 'Avec la torche', 'sans-torche': 'Sans torche', photo: 'Par photo' };
// Cibles : couleurs « Black » et « White » du catalogue Wada (data/wada.json), pour qu'un vêtement noir
// ou blanc étalonné retombe exactement sur une couleur du catalogue (et sur les jokers).
export const ETALONNAGE_CIBLE_NOIR = '#111314';
export const ETALONNAGE_CIBLE_BLANC = '#ffffff';
// Écart minimal (sur 255) entre le blanc et le noir mesurés, canal par canal. À calibrer.
export const ETALONNAGE_ECART_MIN = 30;

// Jokers : noir si L* ≤ NOIR_L_MAX, blanc si L* ≥ BLANC_L_MIN, et C*ab ≤ NEUTRE_C_MAX. À calibrer.
export const NOIR_L_MAX = 20;
export const BLANC_L_MIN = 90;
export const NEUTRE_C_MAX = 8;
