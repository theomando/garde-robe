// Manques fréquents (demande de Théo, 2026-09-27 : « se baser sur les manques de deux choses : les likes des
// combinaisons (grand impact), et la première combinaison proposée (souvent la plus pertinente), impact moyen »).
// - Tenues aimées (♡ Garder, Mes tenues) : les manques de leur combinaison, recalculés avec la garde-robe et les
//   réglages actuels, poids POIDS_MANQUE_AIMEE. Combinaison absente du catalogue (Papier Tigre retiré) ou écartée
//   aujourd'hui : les manques figés de la tenue gardée (couleurs encore au catalogue).
// - Tenues types (tenues demandées) : les manques de la première proposition du moteur, poids POIDS_MANQUE_PREMIERE.
// Score d'un couple (couleur, type) : somme des poids. Module pur, sans DOM.
// Règles : CLAUDE.md, section « Favoris et statistiques ».

import { TYPES, MANQUES_FREQUENTS_MAX, POIDS_MANQUE_AIMEE, POIDS_MANQUE_PREMIERE } from './constantes.js';
import { proposer, creerCacheEcarts } from './moteur.js';

// Entrée : { tenuesTypes, tenuesGardees, vetements, catalogue, reglages, cache?, max? }.
// Sortie : { manques: [{ couleurId (null pour le joker), type, score, aimees, premieres }] (au plus max, triés),
//            nbDistincts (couples avant la coupe), nbAimees, nbTenues, nbPremieres (tenues types avec une
//            proposition), cache }.
// Tri : score décroissant, puis tenues aimées décroissantes, puis ordre du catalogue (joker en dernier), puis TYPES.
export function manquesFrequents({ tenuesTypes, tenuesGardees = [], vetements, catalogue, reglages, cache, max = MANQUES_FREQUENTS_MAX }) {
  let cacheCourant = cache && cache.catalogue === catalogue ? cache : creerCacheEcarts(catalogue);
  const comptes = new Map();
  const noter = ({ type, couleurId }, poids, champ) => {
    const cle = `${type} ${couleurId ?? ''}`;
    let entree = comptes.get(cle);
    if (!entree) {
      entree = { couleurId: couleurId ?? null, type, score: 0, aimees: 0, premieres: 0 };
      comptes.set(cle, entree);
    }
    entree.score += poids;
    entree[champ]++;
  };

  for (const tenue of tenuesGardees) {
    for (const manque of manquesDeLaTenue(tenue, { vetements, catalogue, reglages })) noter(manque, POIDS_MANQUE_AIMEE, 'aimees');
  }
  let nbPremieres = 0;
  for (const types of tenuesTypes) {
    const resultat = proposer({ types, vetements, catalogue, reglages, cache: cacheCourant });
    cacheCourant = resultat.cache;
    const [premiere] = resultat.retenues;
    if (!premiere) continue;
    nbPremieres++;
    for (const manque of premiere.manques) noter(manque, POIDS_MANQUE_PREMIERE, 'premieres');
  }

  const rang = new Map(catalogue.couleurs.map((c, i) => [c.id, i]));
  const rangCouleur = (id) => (id === null ? Infinity : rang.get(id));
  const manques = [...comptes.values()].sort((a, b) => b.score - a.score
    || b.aimees - a.aimees
    || rangCouleur(a.couleurId) - rangCouleur(b.couleurId)
    || TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
  return {
    manques: manques.slice(0, max),
    nbDistincts: manques.length,
    nbAimees: tenuesGardees.length,
    nbTenues: tenuesTypes.length,
    nbPremieres,
    cache: cacheCourant,
  };
}

// Manques d'une tenue gardée avec la garde-robe actuelle : sa combinaison seule est évaluée (catalogue réduit à elle,
// calcul immédiat) pour ses types. Sinon, ses manques figés dont la couleur est encore au catalogue.
function manquesDeLaTenue(tenue, { vetements, catalogue, reglages }) {
  const combinaison = catalogue.combinaisonParId?.get(tenue.combinaison.id);
  if (combinaison) {
    const seule = { ...catalogue, combinaisons: [combinaison] };
    const [proposition] = proposer({ types: tenue.types, vetements, catalogue: seule, reglages }).retenues;
    if (proposition) return proposition.manques;
  }
  return tenue.pieces
    .filter((p) => p.manque && (!p.couleurId || catalogue.couleurParId.has(p.couleurId)))
    .map((p) => ({ type: p.type, couleurId: p.couleurId ?? null }));
}
