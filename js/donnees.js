// Données utilisateur : état, validation, opérations, export et import. Module pur, sans DOM.
// État : { vetements: [vêtement…], reglages: { mst, teintActif, tolerance, favoris, … }, tenuesTypes: [[type…]…],
//          tenuesGardees: [tenue gardée…] }.
// Le même document JSON sert à l'export et au stockage local : { format, version, dateExport, …état } ; l'export
// ajoute les photos des vêtements (photos: { id: data URL }), gardées à part sur l'appareil (js/photos.js).
// Version 2 (2026-09-26) : marque et photo des vêtements, tenues gardées (« Mes tenues »), dates de sauvegarde.
// Un document de version 1 reste lisible (sans ces champs).

import {
  TYPES, BAS, TOLERANCE_DEFAUT, TOLERANCE_MIN, TOLERANCE_MAX, TOLERANCE_PAS, MODES_SCAN,
  MARQUE_MAX, NOM_TENUE_MAX, PHOTO_TAILLE_MAX, RAPPEL_SAUVEGARDE_JOURS, RAPPEL_PREMIER_JOURS, RAPPEL_REPORT_JOURS,
} from './constantes.js';
import { estHexValide } from './couleur.js';
import { verifierMesuresEtalonnage } from './etalonnage.js';

export const FORMAT_DONNEES = 'garde-robe-chromatique';
export const VERSION_DONNEES = 2;
export const ORIGINES = ['scan', 'manuel'];

const CLES_DOCUMENT = {
  1: ['format', 'version', 'dateExport', 'vetements', 'reglages', 'tenuesTypes'],
  2: ['format', 'version', 'dateExport', 'vetements', 'reglages', 'tenuesTypes', 'tenuesGardees', 'photos'],
};
const CLES_VETEMENT = {
  1: ['id', 'type', 'hex', 'origine', 'idCouleurCatalogue', 'dateAjout'],
  2: ['id', 'type', 'hex', 'origine', 'idCouleurCatalogue', 'dateAjout', 'marque', 'photo'],
};
const CLES_REGLAGES = {
  1: ['mst', 'teintActif', 'tolerance', 'favoris', 'etalonnage'],
  2: ['mst', 'teintActif', 'tolerance', 'favoris', 'etalonnage', 'derniereSauvegarde', 'rappelSauvegarde'],
};
const CLES_ETALONNAGE = ['blanc', 'noir', 'date'];
const CLES_TENUE_GARDEE = ['id', 'nom', 'date', 'types', 'combinaison', 'pieces', 'peau'];
const CLES_COMBINAISON_GARDEE = ['id', 'source', 'ref', 'nom', 'couleurs'];
const CLES_COULEUR_GARDEE = ['id', 'nom', 'hex', 'role'];
const CLES_PIECE_GARDEE = ['type', 'hex', 'manque', 'joker', 'couleurId', 'vetementId'];
const SOURCES = ['wada', 'papier-tigre'];
const ROLES = ['dominante', 'soutien'];
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const MOTIF_PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const JOUR_MS = 24 * 60 * 60 * 1000;

function estObjet(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function estTexteNonVide(x) {
  return typeof x === 'string' && x.trim() !== '';
}

// Texte libre facultatif (marque, nom de tenue) : non vide une fois nettoyé, au plus max caractères.
function estTexteLibre(x, max) {
  return typeof x === 'string' && x.trim() !== '' && x.trim() === x && x.length <= max;
}

// Nettoie un texte libre saisi : espaces de bord retirés ; vide → null ; trop long → erreur.
export function nettoyerTexteLibre(x, max, quoi) {
  if (x === null || x === undefined) return null;
  const texte = String(x).trim().replace(/\s+/g, ' ');
  if (texte === '') return null;
  if (texte.length > max) throw new Error(`${quoi} : ${max} caractères au plus`);
  return texte;
}

// Tolérance valide : de TOLERANCE_MIN à TOLERANCE_MAX, par pas de TOLERANCE_PAS (1, 1,5, 2… 30).
export function estToleranceValide(t) {
  return Number.isFinite(t) && t >= TOLERANCE_MIN && t <= TOLERANCE_MAX && Number.isInteger((t - TOLERANCE_MIN) / TOLERANCE_PAS);
}

export function estDateIso(x) {
  return typeof x === 'string' && MOTIF_DATE.test(x) && !Number.isNaN(Date.parse(x));
}

export function estPhotoValide(x) {
  return typeof x === 'string' && x.length <= PHOTO_TAILLE_MAX && MOTIF_PHOTO.test(x);
}

export function etatInitial() {
  return {
    vetements: [],
    reglages: { mst: null, teintActif: false, tolerance: TOLERANCE_DEFAUT, favoris: [] },
    tenuesTypes: [],
    tenuesGardees: [],
  };
}

export function premierLancement(etat) {
  return etat.reglages.mst === null;
}

function copierEtalonnage(etalonnage) {
  return Object.fromEntries(Object.entries(etalonnage).map(([mode, { blanc, noir, date }]) => [mode, { blanc: [...blanc], noir: [...noir], date }]));
}

// Tenue canonique : types uniques dans l'ordre de TYPES. Lève une erreur si la tenue est invalide.
export function normaliserTenue(types) {
  if (!Array.isArray(types) || types.length === 0) throw new Error('tenue vide');
  for (const type of types) if (!TYPES.includes(type)) throw new Error(`type « ${type} » inconnu`);
  if (new Set(types).size !== types.length) throw new Error('type en double dans la tenue');
  if (BAS.every((bas) => types.includes(bas))) throw new Error('pantalon et short ensemble');
  return TYPES.filter((type) => types.includes(type));
}

function champsInconnus(objet, connues, ou, erreurs) {
  for (const cle of Object.keys(objet)) {
    if (!connues.includes(cle)) erreurs.push(`${ou} : champ inconnu « ${cle} »`);
  }
}

// Couleur figée dans une tenue gardée : { id, nom, hex, role? }. Renvoie une copie normalisée.
function validerCouleurGardee(c, ou, erreurs, { role = false } = {}) {
  if (!estObjet(c)) { erreurs.push(`${ou} : un objet est attendu`); return null; }
  champsInconnus(c, role ? CLES_COULEUR_GARDEE : ['id', 'nom', 'hex'], ou, erreurs);
  if (!estTexteNonVide(c.id)) erreurs.push(`${ou} : identifiant manquant`);
  if (!estTexteNonVide(c.nom)) erreurs.push(`${ou} : nom manquant`);
  if (!estHexValide(c.hex)) erreurs.push(`${ou} : couleur « ${c.hex} » invalide`);
  if (c.role !== undefined && !ROLES.includes(c.role)) erreurs.push(`${ou} : rôle « ${c.role} » inconnu`);
  return { id: c.id, nom: c.nom, hex: String(c.hex).toLowerCase(), ...(c.role !== undefined ? { role: c.role } : {}) };
}

// Tenue gardée (« Mes tenues ») : instantané d'une proposition, lisible même si la garde-robe ou le catalogue change.
function validerTenueGardee(t, ou, erreurs) {
  if (!estObjet(t)) { erreurs.push(`${ou} : un objet est attendu`); return null; }
  champsInconnus(t, CLES_TENUE_GARDEE, ou, erreurs);
  if (!estTexteNonVide(t.id)) erreurs.push(`${ou} : identifiant manquant`);
  if (t.nom !== undefined && !estTexteLibre(t.nom, NOM_TENUE_MAX)) erreurs.push(`${ou} : nom invalide (${NOM_TENUE_MAX} caractères au plus)`);
  if (!estDateIso(t.date)) erreurs.push(`${ou} : date invalide`);
  let types = [];
  try { types = normaliserTenue(t.types); } catch (erreur) { erreurs.push(`${ou} : ${erreur.message}`); }
  let combinaison = null;
  if (!estObjet(t.combinaison)) erreurs.push(`${ou} : « combinaison » doit être un objet`);
  else {
    const c = t.combinaison;
    champsInconnus(c, CLES_COMBINAISON_GARDEE, `${ou}, combinaison`, erreurs);
    if (!estTexteNonVide(c.id)) erreurs.push(`${ou} : combinaison sans identifiant`);
    if (!SOURCES.includes(c.source)) erreurs.push(`${ou} : source « ${c.source} » inconnue`);
    if (!estTexteNonVide(c.ref)) erreurs.push(`${ou} : référence de combinaison manquante`);
    if (c.nom !== undefined && !estTexteNonVide(c.nom)) erreurs.push(`${ou} : nom de combinaison vide`);
    if (!Array.isArray(c.couleurs) || c.couleurs.length < 2 || c.couleurs.length > 6) erreurs.push(`${ou} : 2 à 6 couleurs de combinaison attendues`);
    combinaison = {
      id: c.id, source: c.source, ref: c.ref, ...(c.nom !== undefined ? { nom: c.nom } : {}),
      couleurs: (Array.isArray(c.couleurs) ? c.couleurs : []).map((x, j) => validerCouleurGardee(x, `${ou}, couleur ${j + 1}`, erreurs, { role: true })),
    };
  }
  let pieces = [];
  if (!Array.isArray(t.pieces) || t.pieces.length === 0) erreurs.push(`${ou} : au moins une pièce attendue`);
  else {
    pieces = t.pieces.map((p, j) => {
      const ouP = `${ou}, pièce ${j + 1}`;
      if (!estObjet(p)) { erreurs.push(`${ouP} : un objet est attendu`); return null; }
      champsInconnus(p, CLES_PIECE_GARDEE, ouP, erreurs);
      if (!TYPES.includes(p.type)) erreurs.push(`${ouP} : type « ${p.type} » inconnu`);
      if (!estHexValide(p.hex)) erreurs.push(`${ouP} : couleur « ${p.hex} » invalide`);
      if (typeof p.manque !== 'boolean' || typeof p.joker !== 'boolean') erreurs.push(`${ouP} : « manque » et « joker » doivent valoir true ou false`);
      if (p.couleurId !== undefined && !estTexteNonVide(p.couleurId)) erreurs.push(`${ouP} : couleurId invalide`);
      if (p.vetementId !== undefined && !estTexteNonVide(p.vetementId)) erreurs.push(`${ouP} : vetementId invalide`);
      return {
        type: p.type, hex: String(p.hex).toLowerCase(), manque: p.manque, joker: p.joker,
        ...(p.couleurId !== undefined ? { couleurId: p.couleurId } : {}), ...(p.vetementId !== undefined ? { vetementId: p.vetementId } : {}),
      };
    });
    if (new Set(t.pieces.map((p) => p?.type)).size !== t.pieces.length) erreurs.push(`${ou} : pièce en double`);
  }
  const peau = t.peau !== undefined ? validerCouleurGardee(t.peau, `${ou}, peau`, erreurs) : undefined;
  return {
    id: t.id, ...(t.nom !== undefined ? { nom: t.nom } : {}), date: t.date, types, combinaison, pieces,
    ...(peau !== undefined ? { peau } : {}),
  };
}

// Valide un état et le renvoie normalisé (hex en minuscules, tenues dans l'ordre de TYPES).
// version : champs admis (1 : sans marque, photo, tenues gardées ni dates de sauvegarde).
// Renvoie { erreurs, etat } ; etat vaut null dès qu'il y a une erreur.
export function validerEtat({ vetements, reglages, tenuesTypes, tenuesGardees = [] }, { version = VERSION_DONNEES } = {}) {
  const erreurs = [];

  if (!Array.isArray(vetements)) erreurs.push('« vetements » doit être une liste');
  else {
    const ids = new Set();
    vetements.forEach((v, i) => {
      const ou = `vêtement ${i + 1}`;
      if (!estObjet(v)) { erreurs.push(`${ou} : un objet est attendu`); return; }
      champsInconnus(v, CLES_VETEMENT[version], ou, erreurs);
      if (!estTexteNonVide(v.id)) erreurs.push(`${ou} : identifiant manquant`);
      else if (ids.has(v.id)) erreurs.push(`${ou} : identifiant « ${v.id} » en double`);
      else ids.add(v.id);
      if (!TYPES.includes(v.type)) erreurs.push(`${ou} : type « ${v.type} » inconnu`);
      if (!estHexValide(v.hex)) erreurs.push(`${ou} : couleur « ${v.hex} » invalide (#rrggbb attendu)`);
      if (!ORIGINES.includes(v.origine)) erreurs.push(`${ou} : origine « ${v.origine} » inconnue (scan ou manuel)`);
      if (v.idCouleurCatalogue !== undefined && !estTexteNonVide(v.idCouleurCatalogue)) {
        erreurs.push(`${ou} : idCouleurCatalogue doit être un texte non vide ou absent`);
      }
      if (!estDateIso(v.dateAjout)) erreurs.push(`${ou} : date d'ajout « ${v.dateAjout} » invalide`);
      if (v.marque !== undefined && !estTexteLibre(v.marque, MARQUE_MAX)) erreurs.push(`${ou} : marque invalide (${MARQUE_MAX} caractères au plus)`);
      if (v.photo !== undefined && v.photo !== true) erreurs.push(`${ou} : « photo » doit valoir true ou être absent`);
    });
  }

  if (!estObjet(reglages)) erreurs.push('« reglages » doit être un objet');
  else {
    champsInconnus(reglages, CLES_REGLAGES[version], 'réglages', erreurs);
    if (!(Number.isInteger(reglages.mst) && reglages.mst >= 1 && reglages.mst <= 10)) {
      erreurs.push('réglages : « mst » doit être un entier de 1 à 10');
    }
    if (typeof reglages.teintActif !== 'boolean') erreurs.push('réglages : « teintActif » doit valoir true ou false');
    if (!estToleranceValide(reglages.tolerance)) {
      erreurs.push(`réglages : « tolerance » doit être un nombre de ${TOLERANCE_MIN} à ${TOLERANCE_MAX}, par pas de ${String(TOLERANCE_PAS).replace('.', ',')}`);
    }
    if (!Array.isArray(reglages.favoris) || !reglages.favoris.every(estTexteNonVide)) {
      erreurs.push('réglages : « favoris » doit être une liste d\'identifiants de couleurs');
    } else if (new Set(reglages.favoris).size !== reglages.favoris.length) {
      erreurs.push('réglages : favori en double');
    }
    // Étalonnage facultatif : { torche?, sans-torche?, photo? : { blanc: [r, v, b], noir: [r, v, b], date } }.
    if (reglages.etalonnage !== undefined) {
      if (!estObjet(reglages.etalonnage)) erreurs.push('réglages : « etalonnage » doit être un objet');
      else {
        for (const [mode, mesures] of Object.entries(reglages.etalonnage)) {
          const ou = `réglages : étalonnage « ${mode} »`;
          if (!MODES_SCAN.includes(mode)) { erreurs.push(`${ou} : mode inconnu (${MODES_SCAN.join(', ')})`); continue; }
          if (!estObjet(mesures)) { erreurs.push(`${ou} : un objet est attendu`); continue; }
          champsInconnus(mesures, CLES_ETALONNAGE, ou, erreurs);
          const probleme = verifierMesuresEtalonnage(mesures.blanc, mesures.noir);
          if (probleme) erreurs.push(`${ou} : ${probleme}`);
          if (!estDateIso(mesures.date)) erreurs.push(`${ou} : date invalide`);
        }
      }
    }
    for (const cle of ['derniereSauvegarde', 'rappelSauvegarde']) {
      if (reglages[cle] !== undefined && !estDateIso(reglages[cle])) erreurs.push(`réglages : « ${cle} » invalide`);
    }
  }

  const tenues = [];
  if (!Array.isArray(tenuesTypes)) erreurs.push('« tenuesTypes » doit être une liste');
  else {
    const vues = new Set();
    tenuesTypes.forEach((tenue, i) => {
      try {
        const canonique = normaliserTenue(tenue);
        const cle = canonique.join(',');
        if (vues.has(cle)) erreurs.push(`tenue type ${i + 1} : en double`);
        vues.add(cle);
        tenues.push(canonique);
      } catch (erreur) {
        erreurs.push(`tenue type ${i + 1} : ${erreur.message}`);
      }
    });
  }

  const gardees = [];
  if (!Array.isArray(tenuesGardees)) erreurs.push('« tenuesGardees » doit être une liste');
  else {
    const ids = new Set();
    tenuesGardees.forEach((t, i) => {
      const ou = `tenue gardée ${i + 1}`;
      const copie = validerTenueGardee(t, ou, erreurs);
      if (copie && estTexteNonVide(copie.id)) {
        if (ids.has(copie.id)) erreurs.push(`${ou} : identifiant « ${copie.id} » en double`);
        ids.add(copie.id);
      }
      gardees.push(copie);
    });
  }

  if (erreurs.length > 0) return { erreurs, etat: null };
  return {
    erreurs,
    etat: {
      vetements: vetements.map((v) => ({
        id: v.id,
        type: v.type,
        hex: v.hex.toLowerCase(),
        origine: v.origine,
        ...(v.idCouleurCatalogue !== undefined ? { idCouleurCatalogue: v.idCouleurCatalogue } : {}),
        dateAjout: v.dateAjout,
        ...(v.marque !== undefined ? { marque: v.marque } : {}),
        ...(v.photo !== undefined ? { photo: true } : {}),
      })),
      reglages: {
        mst: reglages.mst, teintActif: reglages.teintActif, tolerance: reglages.tolerance, favoris: [...reglages.favoris],
        ...(reglages.etalonnage !== undefined ? { etalonnage: copierEtalonnage(reglages.etalonnage) } : {}),
        ...(reglages.derniereSauvegarde !== undefined ? { derniereSauvegarde: reglages.derniereSauvegarde } : {}),
        ...(reglages.rappelSauvegarde !== undefined ? { rappelSauvegarde: reglages.rappelSauvegarde } : {}),
      },
      tenuesTypes: tenues,
      tenuesGardees: gardees,
    },
  };
}

// Document JSON de l'état (export et stockage). indentation = 2 pour un fichier lisible.
// photos (export seulement) : Map id → data URL, ajoutée sous « photos ».
export function exporterEtat(etat, date = new Date(), indentation = 0, photos = null) {
  return JSON.stringify({
    format: FORMAT_DONNEES, version: VERSION_DONNEES, dateExport: date.toISOString(), ...etat,
    ...(photos ? { photos: Object.fromEntries(photos) } : {}),
  }, null, indentation);
}

// Lit un document exporté (version 1 ou 2). Renvoie { erreurs, etat, photos } ; etat vaut null si le document est
// refusé. photos : Map id → data URL si le document en contient (export), sinon null (stockage local). Quand le
// document porte des photos, l'indicateur « photo » des vêtements suit exactement les photos fournies.
export function lireExport(texte) {
  let doc;
  try {
    doc = JSON.parse(String(texte).replace(/^\uFEFF/, ''));
  } catch (erreur) {
    return { erreurs: [`JSON invalide : ${erreur.message}`], etat: null, photos: null };
  }
  const refus = (message) => ({ erreurs: [message], etat: null, photos: null });
  if (!estObjet(doc) || doc.format !== FORMAT_DONNEES) return refus('ce fichier n\'est pas un export de Garde-robe chromatique');
  if (Number.isInteger(doc.version) && doc.version > VERSION_DONNEES) {
    return refus(`version ${doc.version} plus récente que cette app (version ${VERSION_DONNEES}) : mets l'app à jour`);
  }
  if (!Object.hasOwn(CLES_DOCUMENT, doc.version)) return refus(`« version » doit valoir 1 ou ${VERSION_DONNEES}`);
  const erreurs = [];
  champsInconnus(doc, CLES_DOCUMENT[doc.version], 'document', erreurs);
  if (!estDateIso(doc.dateExport)) erreurs.push('« dateExport » invalide');
  const resultat = validerEtat(doc, { version: doc.version });
  erreurs.push(...resultat.erreurs);

  let photos = null;
  if (doc.photos !== undefined) {
    if (!estObjet(doc.photos)) erreurs.push('« photos » doit être un objet');
    else {
      const ids = new Set(Array.isArray(doc.vetements) ? doc.vetements.map((v) => v?.id) : []);
      photos = new Map();
      for (const [id, photo] of Object.entries(doc.photos)) {
        if (!ids.has(id)) erreurs.push(`photo « ${id} » : aucun vêtement ne porte cet identifiant`);
        else if (!estPhotoValide(photo)) erreurs.push(`photo du vêtement « ${id} » invalide (image JPEG ou PNG attendue)`);
        else photos.set(id, photo);
      }
    }
  }
  if (erreurs.length > 0) return { erreurs, etat: null, photos: null };
  const etat = photos === null ? resultat.etat : {
    ...resultat.etat,
    vetements: resultat.etat.vetements.map(({ photo, ...v }) => (photos.has(v.id) ? { ...v, photo: true } : v)),
  };
  return { erreurs, etat, photos };
}

// ---- Opérations : chacune renvoie un nouvel état (l'état reçu n'est jamais modifié). ----

function verifierVetement({ type, hex, origine, idCouleurCatalogue }) {
  if (!TYPES.includes(type)) throw new Error(`type « ${type} » inconnu`);
  if (!estHexValide(hex)) throw new Error(`couleur « ${hex} » invalide`);
  if (!ORIGINES.includes(origine)) throw new Error(`origine « ${origine} » inconnue`);
  if (idCouleurCatalogue !== undefined && !estTexteNonVide(idCouleurCatalogue)) throw new Error('idCouleurCatalogue invalide');
}

// marque : texte libre (nettoyé ; vide = pas de marque) ; photo : true si une photo est gardée (js/photos.js).
export function ajouterVetement(etat, { type, hex, origine, idCouleurCatalogue, marque, photo }, { id, date }) {
  verifierVetement({ type, hex, origine, idCouleurCatalogue });
  if (!estTexteNonVide(id) || etat.vetements.some((v) => v.id === id)) throw new Error('identifiant de vêtement invalide');
  const marqueNette = nettoyerTexteLibre(marque, MARQUE_MAX, 'marque');
  const vetement = {
    id, type, hex: hex.toLowerCase(), origine,
    ...(idCouleurCatalogue !== undefined ? { idCouleurCatalogue } : {}),
    dateAjout: date.toISOString(),
    ...(marqueNette !== null ? { marque: marqueNette } : {}),
    ...(photo ? { photo: true } : {}),
  };
  return { ...etat, vetements: [...etat.vetements, vetement] };
}

// modifications : { type?, hex?, idCouleurCatalogue? (null pour l'effacer), marque? (null ou vide pour l'effacer),
// photo? (true ou false) }. L'origine ne change pas.
export function modifierVetement(etat, id, modifications) {
  const ancien = etat.vetements.find((v) => v.id === id);
  if (!ancien) throw new Error(`vêtement ${id} introuvable`);
  const nouveau = { ...ancien };
  if (modifications.type !== undefined) nouveau.type = modifications.type;
  if (modifications.hex !== undefined) nouveau.hex = modifications.hex;
  if (modifications.idCouleurCatalogue === null) delete nouveau.idCouleurCatalogue;
  else if (modifications.idCouleurCatalogue !== undefined) nouveau.idCouleurCatalogue = modifications.idCouleurCatalogue;
  if (modifications.marque !== undefined) {
    const marque = nettoyerTexteLibre(modifications.marque, MARQUE_MAX, 'marque');
    if (marque === null) delete nouveau.marque;
    else nouveau.marque = marque;
  }
  if (modifications.photo === true) nouveau.photo = true;
  else if (modifications.photo === false) delete nouveau.photo;
  verifierVetement(nouveau);
  nouveau.hex = nouveau.hex.toLowerCase();
  return { ...etat, vetements: etat.vetements.map((v) => (v.id === id ? nouveau : v)) };
}

// Marques déjà saisies (suggestions), sans doublon ni différence de casse, dans l'ordre alphabétique français.
export function marquesConnues(etat) {
  const parCle = new Map();
  for (const v of etat.vetements) if (v.marque && !parCle.has(v.marque.toLowerCase())) parCle.set(v.marque.toLowerCase(), v.marque);
  return [...parCle.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function supprimerVetement(etat, id) {
  if (!etat.vetements.some((v) => v.id === id)) throw new Error(`vêtement ${id} introuvable`);
  return { ...etat, vetements: etat.vetements.filter((v) => v.id !== id) };
}

export function basculerFavori(etat, couleurId) {
  if (!estTexteNonVide(couleurId)) throw new Error('identifiant de couleur invalide');
  const favoris = etat.reglages.favoris.includes(couleurId)
    ? etat.reglages.favoris.filter((f) => f !== couleurId)
    : [...etat.reglages.favoris, couleurId];
  return { ...etat, reglages: { ...etat.reglages, favoris } };
}

// modifications : { mst?, teintActif?, tolerance? }.
export function modifierReglages(etat, modifications) {
  const reglages = { ...etat.reglages, ...modifications };
  if (!(Number.isInteger(reglages.mst) && reglages.mst >= 1 && reglages.mst <= 10)) throw new Error('teint MST invalide');
  if (typeof reglages.teintActif !== 'boolean') throw new Error('interrupteur du teint invalide');
  if (!estToleranceValide(reglages.tolerance)) throw new Error('tolérance hors bornes ou hors du pas');
  return { ...etat, reglages };
}

// Enregistre l'étalonnage d'un mode de mesure (mesures brutes du vêtement blanc et du vêtement noir).
export function enregistrerEtalonnage(etat, mode, { blanc, noir }, date) {
  if (!MODES_SCAN.includes(mode)) throw new Error(`mode de mesure « ${mode} » inconnu`);
  const probleme = verifierMesuresEtalonnage(blanc, noir);
  if (probleme) throw new Error(probleme);
  const etalonnage = { ...(etat.reglages.etalonnage ?? {}), [mode]: { blanc: [...blanc], noir: [...noir], date: date.toISOString() } };
  return { ...etat, reglages: { ...etat.reglages, etalonnage } };
}

export function supprimerEtalonnage(etat) {
  const { etalonnage, ...reglages } = etat.reglages;
  return { ...etat, reglages };
}

// Ajoute la tenue (forme canonique) si elle n'est pas déjà enregistrée.
export function enregistrerTenueType(etat, types) {
  const canonique = normaliserTenue(types);
  const cle = canonique.join(',');
  if (etat.tenuesTypes.some((t) => t.join(',') === cle)) return etat;
  return { ...etat, tenuesTypes: [...etat.tenuesTypes, canonique] };
}

// Retire une tenue type (elle ne compte plus dans les manques fréquents). Tenue absente : état inchangé.
export function retirerTenueType(etat, types) {
  const cle = normaliserTenue(types).join(',');
  if (!etat.tenuesTypes.some((t) => t.join(',') === cle)) return etat;
  return { ...etat, tenuesTypes: etat.tenuesTypes.filter((t) => t.join(',') !== cle) };
}

// ---- Mes tenues : tenues gardées (demande de Théo, 2026-09-26) ----

// tenue : instantané { types, combinaison, pieces, peau? } (voir js/tenues.js). Ajoutée en tête (la plus récente
// d'abord) ; une tenue identique (même signature) n'est pas gardée deux fois.
export function garderTenue(etat, tenue, { id, date }, signature = null) {
  if (!estTexteNonVide(id) || etat.tenuesGardees.some((t) => t.id === id)) throw new Error('identifiant de tenue invalide');
  const nouvelle = { id, date: date.toISOString(), ...tenue };
  const erreurs = [];
  const copie = validerTenueGardee(nouvelle, 'tenue', erreurs);
  if (erreurs.length > 0) throw new Error(erreurs[0]);
  if (signature && etat.tenuesGardees.some((t) => signature(t) === signature(copie))) return etat;
  return { ...etat, tenuesGardees: [copie, ...etat.tenuesGardees] };
}

export function retirerTenueGardee(etat, id) {
  if (!etat.tenuesGardees.some((t) => t.id === id)) throw new Error(`tenue ${id} introuvable`);
  return { ...etat, tenuesGardees: etat.tenuesGardees.filter((t) => t.id !== id) };
}

// Nom facultatif (NOM_TENUE_MAX caractères au plus) ; vide ou null : le nom est effacé.
export function renommerTenueGardee(etat, id, nom) {
  if (!etat.tenuesGardees.some((t) => t.id === id)) throw new Error(`tenue ${id} introuvable`);
  const net = nettoyerTexteLibre(nom, NOM_TENUE_MAX, 'nom de la tenue');
  return {
    ...etat,
    // Même ordre de champs qu'après validation : id, nom?, date, types, combinaison, pieces, peau?.
    tenuesGardees: etat.tenuesGardees.map((t) => {
      if (t.id !== id) return t;
      const { id: identifiant, nom: _ancien, ...reste } = t;
      return net === null ? { id: identifiant, ...reste } : { id: identifiant, nom: net, ...reste };
    }),
  };
}

// ---- Rappel de sauvegarde (demande de Théo, 2026-09-26) ----

export function noterSauvegarde(etat, date) {
  const { rappelSauvegarde, ...reglages } = etat.reglages;
  return { ...etat, reglages: { ...reglages, derniereSauvegarde: date.toISOString() } };
}

// « Plus tard » : pas de rappel avant RAPPEL_REPORT_JOURS jours.
export function reporterRappelSauvegarde(etat, date) {
  return { ...etat, reglages: { ...etat.reglages, rappelSauvegarde: new Date(date.getTime() + RAPPEL_REPORT_JOURS * JOUR_MS).toISOString() } };
}

// Rappel dû : jamais sauvegardé et un vêtement ajouté il y a plus de RAPPEL_PREMIER_JOURS jours ; ou dernière
// sauvegarde vieille de plus de RAPPEL_SAUVEGARDE_JOURS jours, avec un vêtement ou une tenue ajouté depuis.
// Jamais pendant un report (« Plus tard »).
export function rappelSauvegardeDu(etat, maintenant) {
  const { derniereSauvegarde, rappelSauvegarde } = etat.reglages;
  const t = maintenant.getTime();
  if (rappelSauvegarde && Date.parse(rappelSauvegarde) > t) return false;
  const dates = [...etat.vetements.map((v) => v.dateAjout), ...etat.tenuesGardees.map((g) => g.date)].map(Date.parse);
  if (dates.length === 0) return false;
  if (!derniereSauvegarde) return etat.vetements.some((v) => t - Date.parse(v.dateAjout) > RAPPEL_PREMIER_JOURS * JOUR_MS);
  const derniere = Date.parse(derniereSauvegarde);
  return t - derniere > RAPPEL_SAUVEGARDE_JOURS * JOUR_MS && dates.some((d) => d > derniere);
}
