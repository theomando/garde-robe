// Données utilisateur : état, validation, opérations, export et import. Module pur, sans DOM.
// État : { vetements: [vêtement…], reglages: { mst, teintActif, tolerance, favoris }, tenuesTypes: [[type…]…] }.
// Le même document JSON sert à l'export et au stockage local : { format, version, dateExport, …état }.

import { TYPES, BAS, TOLERANCE_DEFAUT, TOLERANCE_MIN, TOLERANCE_MAX } from './constantes.js';
import { estHexValide } from './couleur.js';

export const FORMAT_DONNEES = 'garde-robe-chromatique';
export const VERSION_DONNEES = 1;
export const ORIGINES = ['scan', 'manuel'];

const CLES_DOCUMENT = ['format', 'version', 'dateExport', 'vetements', 'reglages', 'tenuesTypes'];
const CLES_VETEMENT = ['id', 'type', 'hex', 'origine', 'idCouleurCatalogue', 'dateAjout'];
const CLES_REGLAGES = ['mst', 'teintActif', 'tolerance', 'favoris'];
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function estObjet(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function estTexteNonVide(x) {
  return typeof x === 'string' && x.trim() !== '';
}

export function estDateIso(x) {
  return typeof x === 'string' && MOTIF_DATE.test(x) && !Number.isNaN(Date.parse(x));
}

export function etatInitial() {
  return {
    vetements: [],
    reglages: { mst: null, teintActif: false, tolerance: TOLERANCE_DEFAUT, favoris: [] },
    tenuesTypes: [],
  };
}

export function premierLancement(etat) {
  return etat.reglages.mst === null;
}

// Tenue canonique : types uniques dans l'ordre de TYPES. Lève une erreur si la tenue est invalide.
export function normaliserTenue(types) {
  if (!Array.isArray(types) || types.length === 0) throw new Error('tenue vide');
  for (const type of types) if (!TYPES.includes(type)) throw new Error(`type « ${type} » inconnu`);
  if (new Set(types).size !== types.length) throw new Error('type en double dans la tenue');
  if (BAS.every((bas) => types.includes(bas))) throw new Error('pantalon et short ensemble');
  return TYPES.filter((type) => types.includes(type));
}

function champsInconnus(objet, connues, ou, erreurs) {
  for (const cle of Object.keys(objet)) {
    if (!connues.includes(cle)) erreurs.push(`${ou} : champ inconnu « ${cle} »`);
  }
}

// Valide un état et le renvoie normalisé (hex en minuscules, tenues dans l'ordre de TYPES).
// Renvoie { erreurs, etat } ; etat vaut null dès qu'il y a une erreur.
export function validerEtat({ vetements, reglages, tenuesTypes }) {
  const erreurs = [];

  if (!Array.isArray(vetements)) erreurs.push('« vetements » doit être une liste');
  else {
    const ids = new Set();
    vetements.forEach((v, i) => {
      const ou = `vêtement ${i + 1}`;
      if (!estObjet(v)) { erreurs.push(`${ou} : un objet est attendu`); return; }
      champsInconnus(v, CLES_VETEMENT, ou, erreurs);
      if (!estTexteNonVide(v.id)) erreurs.push(`${ou} : identifiant manquant`);
      else if (ids.has(v.id)) erreurs.push(`${ou} : identifiant « ${v.id} » en double`);
      else ids.add(v.id);
      if (!TYPES.includes(v.type)) erreurs.push(`${ou} : type « ${v.type} » inconnu`);
      if (!estHexValide(v.hex)) erreurs.push(`${ou} : couleur « ${v.hex} » invalide (#rrggbb attendu)`);
      if (!ORIGINES.includes(v.origine)) erreurs.push(`${ou} : origine « ${v.origine} » inconnue (scan ou manuel)`);
      if (v.idCouleurCatalogue !== undefined && !estTexteNonVide(v.idCouleurCatalogue)) {
        erreurs.push(`${ou} : idCouleurCatalogue doit être un texte non vide ou absent`);
      }
      if (!estDateIso(v.dateAjout)) erreurs.push(`${ou} : date d'ajout « ${v.dateAjout} » invalide`);
    });
  }

  if (!estObjet(reglages)) erreurs.push('« reglages » doit être un objet');
  else {
    champsInconnus(reglages, CLES_REGLAGES, 'réglages', erreurs);
    if (!(Number.isInteger(reglages.mst) && reglages.mst >= 1 && reglages.mst <= 10)) {
      erreurs.push('réglages : « mst » doit être un entier de 1 à 10');
    }
    if (typeof reglages.teintActif !== 'boolean') erreurs.push('réglages : « teintActif » doit valoir true ou false');
    if (!(Number.isFinite(reglages.tolerance) && reglages.tolerance >= TOLERANCE_MIN && reglages.tolerance <= TOLERANCE_MAX)) {
      erreurs.push(`réglages : « tolerance » doit être un nombre de ${TOLERANCE_MIN} à ${TOLERANCE_MAX}`);
    }
    if (!Array.isArray(reglages.favoris) || !reglages.favoris.every(estTexteNonVide)) {
      erreurs.push('réglages : « favoris » doit être une liste d\'identifiants de couleurs');
    } else if (new Set(reglages.favoris).size !== reglages.favoris.length) {
      erreurs.push('réglages : favori en double');
    }
  }

  const tenues = [];
  if (!Array.isArray(tenuesTypes)) erreurs.push('« tenuesTypes » doit être une liste');
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
      })),
      reglages: { mst: reglages.mst, teintActif: reglages.teintActif, tolerance: reglages.tolerance, favoris: [...reglages.favoris] },
      tenuesTypes: tenues,
    },
  };
}

// Document JSON de l'état (export et stockage). indentation = 2 pour un fichier lisible.
export function exporterEtat(etat, date = new Date(), indentation = 0) {
  return JSON.stringify({ format: FORMAT_DONNEES, version: VERSION_DONNEES, dateExport: date.toISOString(), ...etat }, null, indentation);
}

// Lit un document exporté. Renvoie { erreurs, etat } ; etat vaut null si le document est refusé.
export function lireExport(texte) {
  let doc;
  try {
    doc = JSON.parse(String(texte).replace(/^\uFEFF/, ''));
  } catch (erreur) {
    return { erreurs: [`JSON invalide : ${erreur.message}`], etat: null };
  }
  if (!estObjet(doc)) return { erreurs: ['ce fichier n\'est pas un export de Garde-robe chromatique'], etat: null };
  if (doc.format !== FORMAT_DONNEES) return { erreurs: ['ce fichier n\'est pas un export de Garde-robe chromatique'], etat: null };
  const erreurs = [];
  if (Number.isInteger(doc.version) && doc.version > VERSION_DONNEES) {
    erreurs.push(`version ${doc.version} plus récente que cette app (version ${VERSION_DONNEES}) : mets l'app à jour`);
  } else if (doc.version !== VERSION_DONNEES) {
    erreurs.push(`« version » doit valoir ${VERSION_DONNEES}`);
  }
  champsInconnus(doc, CLES_DOCUMENT, 'document', erreurs);
  if (!estDateIso(doc.dateExport)) erreurs.push('« dateExport » invalide');
  const resultat = validerEtat(doc);
  erreurs.push(...resultat.erreurs);
  return { erreurs, etat: erreurs.length > 0 ? null : resultat.etat };
}

// ---- Opérations : chacune renvoie un nouvel état (l'état reçu n'est jamais modifié). ----

function verifierVetement({ type, hex, origine, idCouleurCatalogue }) {
  if (!TYPES.includes(type)) throw new Error(`type « ${type} » inconnu`);
  if (!estHexValide(hex)) throw new Error(`couleur « ${hex} » invalide`);
  if (!ORIGINES.includes(origine)) throw new Error(`origine « ${origine} » inconnue`);
  if (idCouleurCatalogue !== undefined && !estTexteNonVide(idCouleurCatalogue)) throw new Error('idCouleurCatalogue invalide');
}

export function ajouterVetement(etat, { type, hex, origine, idCouleurCatalogue }, { id, date }) {
  verifierVetement({ type, hex, origine, idCouleurCatalogue });
  if (!estTexteNonVide(id) || etat.vetements.some((v) => v.id === id)) throw new Error('identifiant de vêtement invalide');
  const vetement = {
    id, type, hex: hex.toLowerCase(), origine,
    ...(idCouleurCatalogue !== undefined ? { idCouleurCatalogue } : {}),
    dateAjout: date.toISOString(),
  };
  return { ...etat, vetements: [...etat.vetements, vetement] };
}

// modifications : { type?, hex?, idCouleurCatalogue? (null pour l'effacer) }. L'origine ne change pas.
export function modifierVetement(etat, id, modifications) {
  const ancien = etat.vetements.find((v) => v.id === id);
  if (!ancien) throw new Error(`vêtement ${id} introuvable`);
  const nouveau = { ...ancien };
  if (modifications.type !== undefined) nouveau.type = modifications.type;
  if (modifications.hex !== undefined) nouveau.hex = modifications.hex;
  if (modifications.idCouleurCatalogue === null) delete nouveau.idCouleurCatalogue;
  else if (modifications.idCouleurCatalogue !== undefined) nouveau.idCouleurCatalogue = modifications.idCouleurCatalogue;
  verifierVetement(nouveau);
  nouveau.hex = nouveau.hex.toLowerCase();
  return { ...etat, vetements: etat.vetements.map((v) => (v.id === id ? nouveau : v)) };
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
  if (!(Number.isFinite(reglages.tolerance) && reglages.tolerance >= TOLERANCE_MIN && reglages.tolerance <= TOLERANCE_MAX)) {
    throw new Error('tolérance hors bornes');
  }
  return { ...etat, reglages };
}

// Ajoute la tenue (forme canonique) si elle n'est pas déjà enregistrée.
export function enregistrerTenueType(etat, types) {
  const canonique = normaliserTenue(types);
  const cle = canonique.join(',');
  if (etat.tenuesTypes.some((t) => t.join(',') === cle)) return etat;
  return { ...etat, tenuesTypes: [...etat.tenuesTypes, canonique] };
}
