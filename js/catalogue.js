// Catalogue fusionné : couleurs et combinaisons de Wada et de Papier Tigre.
// Module pur, sans DOM : le chargement des fichiers se fait ailleurs.
// Couleur : { id, nom, hex, source, lab } (lab calculé par l'app, jamais lu dans un fichier).
// Combinaison : { id, source, ref, nom?, couleurs: [id…], roles?: ['dominante' | 'soutien'…] }.

import { rgbVersHex, labDepuisHex, deltaE00 } from './couleur.js';

// Wada : colors.json de github.com/mattdesl/dictionary-of-colour-combinations (licence MIT).
// Les combinaisons se reconstruisent en regroupant les couleurs par numéro du champ combinations ;
// l'ordre des couleurs est celui du fichier (l'ordre du livre n'est pas disponible).
export function construireWada(donnees) {
  if (!Array.isArray(donnees)) throw new Error('wada.json : un tableau de couleurs est attendu');
  const couleurs = [];
  const membres = new Map();
  donnees.forEach((entree, i) => {
    const ou = `wada.json, couleur ${i + 1}`;
    if (typeof entree?.name !== 'string' || entree.name.trim() === '') throw new Error(`${ou} : nom manquant`);
    let hex;
    try {
      hex = rgbVersHex(entree.rgb);
    } catch {
      throw new Error(`${ou} (${entree.name}) : rgb invalide`);
    }
    if (typeof entree.hex !== 'string' || entree.hex.toLowerCase() !== hex) {
      throw new Error(`${ou} (${entree.name}) : hex ${entree.hex} différent de rgb (${hex})`);
    }
    const numeros = entree.combinations;
    if (!Array.isArray(numeros) || numeros.length === 0 || !numeros.every((n) => Number.isInteger(n) && n >= 1)) {
      throw new Error(`${ou} (${entree.name}) : numéros de combinaison invalides`);
    }
    const id = `wada-${i + 1}`;
    couleurs.push({ id, nom: entree.name, hex, source: 'wada', lab: labDepuisHex(hex) });
    for (const n of numeros) {
      if (!membres.has(n)) membres.set(n, []);
      const liste = membres.get(n);
      if (liste.includes(id)) throw new Error(`${ou} (${entree.name}) : combinaison ${n} répétée`);
      liste.push(id);
    }
  });
  const combinaisons = [...membres.keys()].sort((x, y) => x - y).map((n) => {
    const ids = membres.get(n);
    if (ids.length < 2 || ids.length > 4) {
      throw new Error(`wada.json : la combinaison ${n} a ${ids.length} couleur(s), 2 à 4 attendues`);
    }
    return { id: `wada-n${n}`, source: 'wada', ref: `n° ${n}`, couleurs: ids };
  });
  return { couleurs, combinaisons };
}

// Réunit des parties { couleurs, combinaisons } (Wada, puis Papier Tigre s'il est importé).
// L'ordre obtenu est « l'ordre du catalogue » utilisé pour les départages.
export function fusionnerCatalogues(...parties) {
  const couleurs = [];
  const combinaisons = [];
  const couleurParId = new Map();
  const combinaisonParId = new Map();
  for (const partie of parties) {
    if (!partie) continue;
    for (const couleur of partie.couleurs) {
      if (couleurParId.has(couleur.id)) throw new Error(`catalogue : couleur ${couleur.id} en double`);
      couleurParId.set(couleur.id, couleur);
      couleurs.push(couleur);
    }
  }
  for (const partie of parties) {
    if (!partie) continue;
    for (const combinaison of partie.combinaisons) {
      if (combinaisonParId.has(combinaison.id)) throw new Error(`catalogue : combinaison ${combinaison.id} en double`);
      for (const id of combinaison.couleurs) {
        if (!couleurParId.has(id)) throw new Error(`catalogue : la combinaison ${combinaison.id} cite une couleur inconnue (${id})`);
      }
      combinaisonParId.set(combinaison.id, combinaison);
      combinaisons.push(combinaison);
    }
  }
  return { couleurs, combinaisons, couleurParId, combinaisonParId };
}

// Couleurs du catalogue triées par ΔE00 croissant depuis un Lab (dépliant « Ajuster »).
// À écart égal, l'ordre du catalogue départage. nombre = Infinity pour tout le catalogue.
export function plusProches(lab, catalogue, nombre = 12) {
  return catalogue.couleurs
    .map((couleur, rang) => ({ couleur, ecart: deltaE00(lab, couleur.lab), rang }))
    .sort((x, y) => x.ecart - y.ecart || x.rang - y.rang)
    .slice(0, nombre)
    .map(({ couleur, ecart }) => ({ couleur, ecart }));
}
