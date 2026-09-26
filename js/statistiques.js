// Manques fréquents : pour chaque tenue type enregistrée, propositions retenues par le moteur (toutes les
// combinaisons non écartées, sans filtre ni coupe) avec la garde-robe et les réglages courants ; chaque manque
// compte une proposition pour son couple (couleur, type). Module pur, sans DOM.
// Règles : CLAUDE.md, section « Favoris et statistiques ».

import { TYPES, MANQUES_FREQUENTS_MAX } from './constantes.js';
import { proposer, creerCacheEcarts } from './moteur.js';

// Entrée : { tenuesTypes, vetements, catalogue, reglages, cache?, max? }.
// Sortie : { manques: [{ couleurId (null pour le joker), type, nombre }] (au plus max, triés),
//            nbDistincts (couples avant la coupe), nbPropositions, nbTenues, cache }.
// Tri : nombre décroissant, puis ordre du catalogue (joker en dernier), puis ordre des TYPES.
export function manquesFrequents({ tenuesTypes, vetements, catalogue, reglages, cache, max = MANQUES_FREQUENTS_MAX }) {
  let cacheCourant = cache && cache.catalogue === catalogue ? cache : creerCacheEcarts(catalogue);
  const comptes = new Map();
  let nbPropositions = 0;
  for (const types of tenuesTypes) {
    const resultat = proposer({ types, vetements, catalogue, reglages, cache: cacheCourant });
    cacheCourant = resultat.cache;
    nbPropositions += resultat.retenues.length;
    // Une tenue n'a qu'une pièce par type : une proposition compte au plus une fois par couple.
    for (const proposition of resultat.retenues) {
      for (const { type, couleurId } of proposition.manques) {
        const cle = `${type} ${couleurId ?? ''}`;
        const entree = comptes.get(cle);
        if (entree) entree.nombre++;
        else comptes.set(cle, { couleurId, type, nombre: 1 });
      }
    }
  }
  const rangCouleur = (id) => (id === null ? Infinity : cacheCourant.index.get(id));
  const manques = [...comptes.values()].sort((a, b) => b.nombre - a.nombre
    || rangCouleur(a.couleurId) - rangCouleur(b.couleurId)
    || TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
  return {
    manques: manques.slice(0, max),
    nbDistincts: manques.length,
    nbPropositions,
    nbTenues: tenuesTypes.length,
    cache: cacheCourant,
  };
}
