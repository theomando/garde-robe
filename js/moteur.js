// Moteur de propositions : pour une tenue (liste de types), évalue chaque combinaison du catalogue.
// Module pur, sans DOM. Règles : CLAUDE.md, section « Moteur de propositions ».
//
// Pour une combinaison, chaque pièce visible reçoit une couleur de la combinaison ou le joker ;
// la peau (teint actif) peut porter une couleur à ΔE00 ≤ tolérance. Chaque couleur obligatoire
// (dominante, ou toutes les couleurs sans rôles) doit être portée. On minimise, dans l'ordre :
// manques, peau non utilisée, manques affectés à une couleur plutôt qu'au joker, somme des coûts.
//
// Vêtements multicolores (demande de Théo, 2026-09-27) : un vêtement couvre une couleur par n'importe laquelle de
// ses couleurs (la plus proche) ; il n'est joker que si toutes ses couleurs sont noires ou blanches. Bonus au tri :
// une proposition passe devant (après les favoris) quand les vêtements multicolores portés ont toutes leurs couleurs
// dans la combinaison, ou noires ou blanches.
//
// Algorithme : programmation dynamique exacte sur l'ensemble des couleurs obligatoires déjà portées
// (au plus 2⁶ états), une passe par pièce puis la peau. Les quatre critères sont empaquetés dans un
// entier exact (< 2⁵³) : ((manques × 2 + peauNonUtilisée) × 32 + manquesColorés) × 2³² + somme en micro-ΔE.

import {
  TYPES, conflitTypes, MST, OCCULTATIONS, MANQUES_MAX, PROPOSITIONS_MAX, COUT_JOKER_EN_TOLERANCES,
} from './constantes.js';
import { labDepuisHex, deltaE00, estNoir, estBlanc } from './couleur.js';

const BASE_SOMME = 2 ** 32;
const BASE_MANQUES_COLORES = 32;

function cle(manques, peauNonUtilisee, manquesColores, sommeMicro) {
  return ((manques * 2 + peauNonUtilisee) * BASE_MANQUES_COLORES + manquesColores) * BASE_SOMME + sommeMicro;
}

function decoder(total) {
  const haut = Math.floor(total / BASE_SOMME);
  const reste = Math.floor(haut / BASE_MANQUES_COLORES);
  return {
    sommeMicro: total - haut * BASE_SOMME,
    manquesColores: haut % BASE_MANQUES_COLORES,
    peauNonUtilisee: reste % 2,
    manques: Math.floor(reste / 2),
  };
}

const micro = (ecart) => Math.round(ecart * 1e6);

// Types visibles dans l'ordre de TYPES, après occultation. Lève une erreur pour une tenue invalide.
export function piecesVisibles(types) {
  for (const type of types) if (!TYPES.includes(type)) throw new Error(`type inconnu : ${type}`);
  const presents = new Set(types);
  const conflit = conflitTypes(types);
  if (conflit) throw new Error(`tenue invalide : ${conflit.join(' et ')} ensemble`);
  return TYPES.filter((type) => presents.has(type) && !(OCCULTATIONS[type] ?? []).some((m) => presents.has(m)));
}

// Cache des ΔE00 entre un hex (vêtement ou teint) et chaque couleur citée par une combinaison (les couleurs
// XKCD, qui ne servent qu'à nommer, n'entrent pas dans le calcul). À garder d'un appel à l'autre tant que le
// catalogue ne change pas.
export function creerCacheEcarts(catalogue) {
  const citees = new Set(catalogue.combinaisons.flatMap((combinaison) => combinaison.couleurs));
  const couleurs = catalogue.couleurs.filter((c) => citees.has(c.id));
  return { catalogue, couleurs, index: new Map(couleurs.map((c, i) => [c.id, i])), lignes: new Map() };
}

function ligneEcarts(cache, hex) {
  const cleHex = hex.toLowerCase();
  let ligne = cache.lignes.get(cleHex);
  if (!ligne) {
    const lab = labDepuisHex(cleHex);
    const { couleurs } = cache;
    ligne = new Float64Array(couleurs.length);
    for (let i = 0; i < couleurs.length; i++) ligne[i] = deltaE00(lab, couleurs[i].lab);
    cache.lignes.set(cleHex, ligne);
  }
  return ligne;
}

// Le plus ancien d'abord (dateAjout ISO 8601, puis id) : départage entre vêtements à écart égal.
function parAnciennete(a, b) {
  if (a.dateAjout !== b.dateAjout) return a.dateAjout < b.dateAjout ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

// Couleurs d'un vêtement (hex), la principale d'abord.
const couleursHex = (vetement) => [vetement.hex, ...(vetement.couleursSecondaires ?? []).map((c) => c.hex)];

function estNeutre(hex) {
  const lab = labDepuisHex(hex);
  return estNoir(lab) || estBlanc(lab);
}

// Pour chaque pièce visible : meilleur écart et vêtement retenu par couleur du catalogue, joker éventuel.
// Pièce épinglée (« partir d'un vêtement », demande de Théo, 2026-09-26) : seul le vêtement choisi compte.
function preparerPieces(visibles, vetements, cache, epingles) {
  const n = cache.couleurs.length;
  return visibles.map((type) => {
    const epingle = epingles[type] ? vetements.find((v) => v.id === epingles[type] && v.type === type) : null;
    const siens = epingle ? [epingle] : vetements.filter((v) => v.type === type).sort(parAnciennete);
    const meilleur = new Float64Array(n).fill(Infinity);
    const retenu = new Array(n).fill(null);
    for (const vetement of siens) {
      for (const hex of couleursHex(vetement)) {
        const ligne = ligneEcarts(cache, hex);
        for (let i = 0; i < n; i++) {
          if (ligne[i] < meilleur[i]) {
            meilleur[i] = ligne[i];
            retenu[i] = vetement;
          }
        }
      }
    }
    // Joker : vêtement entièrement noir ou blanc ; noir avant blanc (couleur principale), puis le plus ancien.
    const neutres = siens.filter((v) => couleursHex(v).every(estNeutre));
    const joker = neutres.find((v) => estNoir(labDepuisHex(v.hex))) ?? neutres[0] ?? null;
    return { type, meilleur, retenu, joker, epingle: Boolean(epingle) };
  });
}

function evaluer(combinaison, rang, pieces, peau, tolerance, index, favoris) {
  const ids = combinaison.couleurs;
  const k = ids.length;
  const indices = ids.map((id) => index.get(id));
  const obligatoire = ids.map((_, j) => !combinaison.roles || combinaison.roles[j] === 'dominante');
  const bits = [];
  let nbObligatoires = 0;
  for (let j = 0; j < k; j++) bits.push(obligatoire[j] ? 1 << nbObligatoires++ : 0);

  // Règle d'écartement de la spec. La programmation dynamique aboutirait au même rejet (aucune
  // affectation ne couvre tout) ; ce précontrôle évite seulement le calcul.
  const peauPeutCouvrir = peau !== null && indices.some((c, j) => obligatoire[j] && peau[c] <= tolerance);
  if (nbObligatoires > pieces.length + (peauPeutCouvrir ? 1 : 0)) return null;

  // Options de chaque porteur, dans l'ordre : couleurs de la combinaison, puis joker (ou « aucune » pour la peau).
  const coutJoker = micro(tolerance * COUT_JOKER_EN_TOLERANCES);
  // Pièce épinglée : jamais de manque (le vêtement choisi est porté) ; sans option, la combinaison est écartée.
  const porteurs = pieces.map((piece) => {
    const options = [];
    for (let j = 0; j < k; j++) {
      const ecart = piece.meilleur[indices[j]];
      if (ecart <= tolerance) options.push({ j, bit: bits[j], cle: micro(ecart), terme: true, manque: false, ecart, vetement: piece.retenu[indices[j]] });
      else if (!piece.epingle) options.push({ j, bit: bits[j], cle: cle(1, 0, 1, 0), terme: false, manque: true, ecart: null, vetement: null });
    }
    if (piece.joker) {
      options.push({ j: -1, bit: 0, cle: coutJoker, terme: true, manque: false, ecart: tolerance * COUT_JOKER_EN_TOLERANCES, vetement: piece.joker });
    } else if (!piece.epingle) {
      options.push({ j: -1, bit: 0, cle: cle(1, 0, 0, 0), terme: false, manque: true, ecart: null, vetement: null });
    }
    return options;
  });
  if (peau !== null) {
    const options = [];
    for (let j = 0; j < k; j++) {
      const ecart = peau[indices[j]];
      if (ecart <= tolerance) options.push({ j, bit: bits[j], cle: micro(ecart), terme: true, manque: false, ecart });
    }
    options.push({ j: -1, bit: 0, cle: cle(0, 1, 0, 0), terme: false, manque: false, ecart: null });
    porteurs.push(options);
  }

  // Programmation dynamique à rebours : meilleur[i][x] = coût minimal des porteurs i… sachant x déjà porté.
  const n = porteurs.length;
  const etats = 1 << nbObligatoires;
  const plein = etats - 1;
  const meilleur = [];
  for (let i = 0; i <= n; i++) meilleur.push(new Float64Array(etats).fill(Infinity));
  meilleur[n][plein] = 0;
  for (let i = n - 1; i >= 0; i--) {
    const suivant = meilleur[i + 1];
    const courant = meilleur[i];
    const options = porteurs[i];
    for (let x = 0; x < etats; x++) {
      let min = Infinity;
      for (const o of options) {
        const v = o.cle + suivant[x | o.bit];
        if (v < min) min = v;
      }
      courant[x] = min;
    }
  }
  const total = meilleur[0][0];
  if (total === Infinity) return null;
  const { manques, peauNonUtilisee, sommeMicro } = decoder(total);
  if (manques > MANQUES_MAX) return null;

  // Reconstruction : à chaque porteur, la première option (dans l'ordre) qui garde l'optimum.
  const choix = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const o = porteurs[i].find((opt) => opt.cle + meilleur[i + 1][x | opt.bit] === meilleur[i][x]);
    choix.push(o);
    x |= o.bit;
  }

  const piecesRetenues = pieces.map((piece, i) => {
    const o = choix[i];
    return {
      type: piece.type,
      couleurId: o.j >= 0 ? ids[o.j] : null,
      joker: o.j < 0,
      manque: o.manque,
      vetement: o.vetement,
      ecart: o.ecart,
    };
  });
  const choixPeau = peau !== null ? choix[n - 1] : null;
  const nbTermes = choix.filter((o) => o.terme).length;
  return {
    combinaison,
    rang,
    pieces: piecesRetenues,
    peau: choixPeau && choixPeau.j >= 0 ? { couleurId: ids[choixPeau.j], ecart: choixPeau.ecart } : null,
    peauUtilisee: peau !== null && peauNonUtilisee === 0,
    manques: piecesRetenues.filter((p) => p.manque).map((p) => ({ type: p.type, couleurId: p.couleurId })),
    nbManques: manques,
    somme: sommeMicro / 1e6,
    nbTermes,
    ecartMoyen: nbTermes > 0 ? sommeMicro / 1e6 / nbTermes : Infinity,
    nbFavoris: new Set(ids.filter((id) => favoris.has(id))).size,
  };
}

// Tri : manques croissants, peau utilisée d'abord, favoris décroissants, vêtements multicolores « en harmonie »
// décroissants, ΔE00 moyen croissant, ordre du catalogue.
export function comparerPropositions(a, b) {
  return a.nbManques - b.nbManques
    || Number(b.peauUtilisee) - Number(a.peauUtilisee)
    || b.nbFavoris - a.nbFavoris
    || (b.nbHarmonieux ?? 0) - (a.nbHarmonieux ?? 0)
    || (a.ecartMoyen < b.ecartMoyen ? -1 : a.ecartMoyen > b.ecartMoyen ? 1 : 0)
    || a.rang - b.rang;
}

// Entrée : { types, vetements, catalogue, reglages: { mst, teintActif, tolerance, favoris }, cache?, epingles? }.
// epingles : { type: id du vêtement à porter } ; une épingle vers un vêtement absent (ou d'un autre type) est ignorée.
// Sortie : { visibles, retenues (toutes les combinaisons non écartées, triées), gardeRobeVide, cache }.
export function proposer({ types, vetements, catalogue, reglages, cache, epingles = {} }) {
  const visibles = piecesVisibles(types);
  const cacheValide = cache && cache.catalogue === catalogue ? cache : creerCacheEcarts(catalogue);
  const pieces = preparerPieces(visibles, vetements, cacheValide, epingles);
  const peau = reglages.teintActif ? ligneEcarts(cacheValide, MST[reglages.mst - 1]) : null;
  const favoris = new Set(reglages.favoris ?? []);
  const retenues = [];
  // Bonus multicolore : chaque couleur du vêtement porté est dans la combinaison (à la tolérance près) ou neutre.
  const neutre = new Map();
  const enHarmonie = (vetement, indices) => couleursHex(vetement).every((hex) => {
    if (!neutre.has(hex)) neutre.set(hex, estNeutre(hex));
    if (neutre.get(hex)) return true;
    const ligne = ligneEcarts(cacheValide, hex);
    return indices.some((c) => ligne[c] <= reglages.tolerance);
  });
  catalogue.combinaisons.forEach((combinaison, rang) => {
    const proposition = evaluer(combinaison, rang, pieces, peau, reglages.tolerance, cacheValide.index, favoris);
    if (!proposition) return;
    const indices = combinaison.couleurs.map((id) => cacheValide.index.get(id));
    proposition.nbHarmonieux = proposition.pieces
      .filter((p) => p.vetement?.couleursSecondaires?.length > 0 && enHarmonie(p.vetement, indices)).length;
    retenues.push(proposition);
  });
  retenues.sort(comparerPropositions);
  return { visibles, retenues, gardeRobeVide: vetements.length === 0, cache: cacheValide };
}

// Propositions affichées : filtre « avec mes favoris » (au moins une couleur favorite), puis coupe.
export function selectionner(retenues, { avecFavoris = false, max = PROPOSITIONS_MAX } = {}) {
  return (avecFavoris ? retenues.filter((p) => p.nbFavoris > 0) : retenues).slice(0, max);
}
