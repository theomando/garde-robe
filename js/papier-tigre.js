// Catalogue Papier Tigre (Color Inspiration, volumes 1 à 3), saisi à la main depuis les livres.
// Validation du fichier et conversion vers le schéma du catalogue fusionné. Module pur, sans DOM.
// Format (CLAUDE.md) : { "format": "papier-tigre", "version": 1, "harmonies": [ { "volume", "page",
// "nom", "pays"?, "dominantes": [[r, v, b]…], "soutiens"?: [[r, v, b]…], "cmjn"?: { dominantes, soutiens } } ] }

import { rgbVersHex, labDepuisHex } from './couleur.js';

export const FORMAT_PAPIER_TIGRE = 'papier-tigre';
export const VERSION_PAPIER_TIGRE = 1;

const CLES_RACINE = ['format', 'version', 'harmonies'];
const CLES_HARMONIE = ['volume', 'page', 'nom', 'pays', 'dominantes', 'soutiens', 'cmjn'];
const CLES_CMJN = ['dominantes', 'soutiens'];

function estObjet(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function estEntierEntre(x, min, max) {
  return Number.isInteger(x) && x >= min && x <= max;
}

function estTexteNonVide(x) {
  return typeof x === 'string' && x.trim() !== '';
}

function estQuadrupletCmjn(x) {
  return Array.isArray(x) && x.length === 4 && x.every((c) => estEntierEntre(c, 0, 100));
}

function estTripletRvb(x) {
  return Array.isArray(x) && x.length === 3 && x.every((c) => estEntierEntre(c, 0, 255));
}

function suggestion(cle, connues) {
  const proche = connues.find((k) => k === `${cle}s` || `${k}s` === cle || k === cle.toLowerCase());
  return proche ? ` (vouliez-vous dire « ${proche} » ?)` : '';
}

function localiser(h, i) {
  const details = [];
  if (Number.isInteger(h?.volume)) details.push(`vol. ${h.volume}`);
  if (Number.isInteger(h?.page)) details.push(`p. ${h.page}`);
  if (estTexteNonVide(h?.nom)) details.push(h.nom.trim());
  return `harmonie ${i + 1}${details.length ? ` (${details.join(', ')})` : ''}`;
}

function listeCouleurs(h) {
  const dominantes = Array.isArray(h.dominantes) ? h.dominantes : [];
  const soutiens = Array.isArray(h.soutiens) ? h.soutiens : [];
  return [
    ...dominantes.map((rvb, k) => ({ rvb, libelle: `dominante ${k + 1}` })),
    ...soutiens.map((rvb, k) => ({ rvb, libelle: `soutien ${k + 1}` })),
  ];
}

// Renvoie { erreurs, avertissements } (listes de phrases en français). Aucune erreur = fichier utilisable.
export function validerPapierTigre(donnees) {
  const erreurs = [];
  const avertissements = [];
  if (!estObjet(donnees)) {
    erreurs.push('le fichier doit contenir un objet { "format": "papier-tigre", "version": 1, "harmonies": [ … ] }');
    return { erreurs, avertissements };
  }
  for (const cle of Object.keys(donnees)) {
    if (!CLES_RACINE.includes(cle)) erreurs.push(`champ inconnu à la racine : « ${cle} »${suggestion(cle, CLES_RACINE)}`);
  }
  if (donnees.format !== FORMAT_PAPIER_TIGRE) erreurs.push('« format » doit valoir "papier-tigre"');
  if (Number.isInteger(donnees.version) && donnees.version > VERSION_PAPIER_TIGRE) {
    erreurs.push(`version ${donnees.version} non prise en charge (cette app lit la version ${VERSION_PAPIER_TIGRE})`);
  } else if (donnees.version !== VERSION_PAPIER_TIGRE) {
    erreurs.push(`« version » doit valoir ${VERSION_PAPIER_TIGRE}`);
  }
  if (!Array.isArray(donnees.harmonies)) {
    erreurs.push('« harmonies » doit être une liste');
    return { erreurs, avertissements };
  }
  if (donnees.harmonies.length === 0) avertissements.push('aucune harmonie dans le fichier');

  const vues = new Map();
  donnees.harmonies.forEach((h, i) => {
    const ou = localiser(h, i);
    if (!estObjet(h)) {
      erreurs.push(`${ou} : un objet { "volume", "page", "nom", "dominantes", … } est attendu`);
      return;
    }
    for (const cle of Object.keys(h)) {
      if (!CLES_HARMONIE.includes(cle)) erreurs.push(`${ou} : champ inconnu « ${cle} »${suggestion(cle, CLES_HARMONIE)}`);
    }
    if (!estEntierEntre(h.volume, 1, 3)) erreurs.push(`${ou} : « volume » doit être un entier de 1 à 3`);
    if (!(Number.isInteger(h.page) && h.page >= 1)) erreurs.push(`${ou} : « page » doit être un entier supérieur ou égal à 1`);
    if (!estTexteNonVide(h.nom)) erreurs.push(`${ou} : « nom » manquant ou vide`);
    if (h.pays !== undefined && !estTexteNonVide(h.pays)) erreurs.push(`${ou} : « pays » doit être un texte non vide (ou absent)`);

    const dominantesOk = Array.isArray(h.dominantes) && h.dominantes.length >= 1 && h.dominantes.length <= 3;
    const soutiensOk = h.soutiens === undefined || (Array.isArray(h.soutiens) && h.soutiens.length <= 3);
    if (!dominantesOk) erreurs.push(`${ou} : « dominantes » doit être une liste de 1 à 3 couleurs`);
    if (!soutiensOk) erreurs.push(`${ou} : « soutiens » doit être une liste de 0 à 3 couleurs`);
    const couleurs = listeCouleurs(h);
    // Au plus 6 découle des bornes 3 + 3 : seul le minimum reste à contrôler.
    if (dominantesOk && soutiensOk && couleurs.length < 2) {
      erreurs.push(`${ou} : ${couleurs.length} couleur(s) au total, 2 à 6 attendues`);
    }
    for (const { rvb, libelle } of couleurs) {
      if (!estTripletRvb(rvb)) {
        erreurs.push(`${ou} : ${libelle} : ${JSON.stringify(rvb)} n'est pas un RVB valide (3 entiers de 0 à 255)`);
      }
    }
    const premiere = new Map();
    for (const { rvb, libelle } of couleurs) {
      if (!estTripletRvb(rvb)) continue;
      const cle = rvb.join(',');
      if (premiere.has(cle)) avertissements.push(`${ou} : ${premiere.get(cle)} et ${libelle} ont le même RVB [${cle}]`);
      else premiere.set(cle, libelle);
    }

    if (h.cmjn !== undefined) {
      if (!estObjet(h.cmjn)) {
        erreurs.push(`${ou} : « cmjn » doit être un objet { "dominantes": […], "soutiens": […] }`);
      } else {
        for (const cle of Object.keys(h.cmjn)) {
          if (!CLES_CMJN.includes(cle)) erreurs.push(`${ou} : champ inconnu dans « cmjn » : « ${cle} »${suggestion(cle, CLES_CMJN)}`);
        }
        for (const partie of CLES_CMJN) {
          const rvb = partie === 'dominantes' ? h.dominantes : (h.soutiens ?? []);
          const cmjn = h.cmjn[partie] ?? [];
          if (!Array.isArray(cmjn) || !Array.isArray(rvb) || cmjn.length !== rvb.length) {
            erreurs.push(`${ou} : « cmjn.${partie} » doit avoir autant d'éléments que « ${partie} »`);
            continue;
          }
          cmjn.forEach((q, k) => {
            if (!estQuadrupletCmjn(q)) {
              erreurs.push(`${ou} : cmjn de ${partie === 'dominantes' ? 'la dominante' : 'le soutien'} ${k + 1} : ${JSON.stringify(q)} n'est pas valide (4 entiers de 0 à 100)`);
            }
          });
        }
      }
    }

    if (estEntierEntre(h.volume, 1, 3) && Number.isInteger(h.page) && h.page >= 1) {
      const cle = `${h.volume}-${h.page}`;
      if (vues.has(cle)) erreurs.push(`${ou} : même volume et même page que l'harmonie ${vues.get(cle) + 1}`);
      else vues.set(cle, i);
    }
  });
  return { erreurs, avertissements };
}

// Convertit un fichier valide vers { couleurs, combinaisons } du catalogue fusionné.
// Harmonies triées par volume puis page ; identifiants stables d'un import à l'autre.
export function convertirPapierTigre(donnees) {
  const { erreurs } = validerPapierTigre(donnees);
  if (erreurs.length > 0) throw new Error(`fichier Papier Tigre invalide : ${erreurs[0]}`);
  const couleurs = [];
  const combinaisons = [];
  const harmonies = [...donnees.harmonies].sort((x, y) => x.volume - y.volume || x.page - y.page);
  for (const h of harmonies) {
    const base = `papier-tigre-v${h.volume}-p${h.page}`;
    const nom = h.nom.trim();
    const ids = [];
    const roles = [];
    const ajouter = (rvb, role, rang) => {
      const id = `${base}-${role === 'dominante' ? 'd' : 's'}${rang}`;
      const hex = rgbVersHex(rvb);
      couleurs.push({ id, nom: `${nom}, ${role} ${rang}`, hex, source: 'papier-tigre', lab: labDepuisHex(hex) });
      ids.push(id);
      roles.push(role);
    };
    h.dominantes.forEach((rvb, k) => ajouter(rvb, 'dominante', k + 1));
    (h.soutiens ?? []).forEach((rvb, k) => ajouter(rvb, 'soutien', k + 1));
    combinaisons.push({
      id: base,
      source: 'papier-tigre',
      ref: `vol. ${h.volume}, p. ${h.page}`,
      nom: h.pays === undefined ? nom : `${nom} (${h.pays.trim()})`,
      couleurs: ids,
      roles,
    });
  }
  return { couleurs, combinaisons };
}

// Lit le texte d'un fichier : { erreurs, avertissements, donnees, catalogue } ; catalogue vaut null si invalide.
export function lirePapierTigre(texte) {
  let donnees;
  try {
    donnees = JSON.parse(String(texte).replace(/^\uFEFF/, '')); // BOM éventuel (Bloc-notes)
  } catch (erreur) {
    return { erreurs: [`JSON invalide : ${erreur.message}`], avertissements: [], donnees: null, catalogue: null };
  }
  const { erreurs, avertissements } = validerPapierTigre(donnees);
  return { erreurs, avertissements, donnees, catalogue: erreurs.length > 0 ? null : convertirPapierTigre(donnees) };
}
