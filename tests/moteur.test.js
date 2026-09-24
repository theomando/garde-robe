// Tests du moteur. Les couleurs des fixtures sont des données de test synthétiques (bornes du codage sRGB,
// teintes MST de constantes.js), pas des couleurs de catalogue réelles.
import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import { TYPES, MST } from '../js/constantes.js';
import { labDepuisHex, deltaE00, estNoir, estBlanc } from '../js/couleur.js';
import { fusionnerCatalogues } from '../js/catalogue.js';
import { piecesVisibles, proposer, selectionner, comparerPropositions, creerCacheEcarts } from '../js/moteur.js';

const ROUGE = '#ff0000', ROUGE_PROCHE = '#f00000', BLEU = '#0000ff', VERT = '#00ff00', JAUNE = '#ffff00';
const NOIR = '#000000', BLANC = '#ffffff', MST4 = MST[3], MST5 = MST[4];

const id = (hex) => `c${hex.slice(1)}`;

function catalogueDe(combos) {
  const couleurs = [];
  const vues = new Set();
  const combinaisons = combos.map((c, n) => {
    const { hex, roles } = Array.isArray(c) ? { hex: c } : c;
    for (const h of hex) {
      if (!vues.has(h)) {
        vues.add(h);
        couleurs.push({ id: id(h), nom: h, hex: h, source: 'wada', lab: labDepuisHex(h) });
      }
    }
    return { id: `k${n + 1}`, source: 'wada', ref: `n° ${n + 1}`, couleurs: hex.map(id), ...(roles ? { roles } : {}) };
  });
  return fusionnerCatalogues({ couleurs, combinaisons });
}

let compteur = 0;
function vet(type, hex) {
  compteur++;
  return { id: `v${compteur}`, type, hex, origine: 'manuel', dateAjout: new Date(Date.UTC(2026, 0, 1) + compteur * 1000).toISOString() };
}

const reglages = (x = {}) => ({ mst: 5, teintActif: false, tolerance: 10, favoris: [], ...x });
const lancer = (types, vetements, combos, r = {}) => proposer({ types, vetements, catalogue: catalogueDe(combos), reglages: reglages(r) });
const trouver = (resultat, k) => resultat.retenues.find((p) => p.combinaison.id === k);
const piece = (proposition, type) => proposition.pieces.find((p) => p.type === type);
const manques = (proposition) => proposition.manques.map((m) => `${m.type}:${m.couleurId ?? 'joker'}`);

test('occultation : le pull masque le t-shirt, ordre des TYPES, tenues invalides refusées', () => {
  egalProfond(piecesVisibles(['pull', 't-shirt', 'pantalon', 'ceinture', 'chaussures']), ['chaussures', 'pantalon', 'ceinture', 'pull']);
  egalProfond(piecesVisibles(['chemise', 't-shirt']), ['t-shirt', 'chemise'], 'la chemise ne masque rien');
  egalProfond(piecesVisibles(['manteau', 'veste', 'chemise', 'pull', 't-shirt']), ['chemise', 'pull', 'veste', 'manteau']);
  vrai(leve(() => piecesVisibles(['pantalon', 'short'])).message.includes('tenue invalide'));
  vrai(leve(() => piecesVisibles(['robe'])).message.includes('type inconnu'));
});

test('cas limite : garde-robe vide, rien au-delà de 2 pièces visibles', () => {
  const combos = [[ROUGE, BLEU], [ROUGE, BLEU, MST5], [ROUGE, BLEU, VERT, MST5]];
  for (const teintActif of [false, true]) {
    const r = lancer(['chaussures', 'pantalon', 't-shirt'], [], combos, { teintActif });
    egal(r.retenues.length, 0, `3 pièces, teint ${teintActif}`);
    egal(r.gardeRobeVide, true);
  }
  const deux = lancer(['pantalon', 't-shirt'], [], combos);
  egalProfond(deux.retenues.map((p) => p.combinaison.id), ['k1']);
  egalProfond(manques(deux.retenues[0]), [`pantalon:${id(ROUGE)}`, `t-shirt:${id(BLEU)}`]);
  egal(deux.retenues[0].ecartMoyen, Infinity, 'moyenne « — »');
  const avecPeau = lancer(['pantalon', 't-shirt'], [], combos, { teintActif: true, mst: 5 });
  egalProfond(avecPeau.retenues.map((p) => p.combinaison.id), ['k2', 'k1'], 'k2 : la peau porte MST 5 ; k3 écartée');
  egalProfond(avecPeau.retenues[0].peau, { couleurId: id(MST5), ecart: 0 });
  egal(avecPeau.retenues[0].nbManques, 2);
});

test('cas limite : tenue chaussures, pantalon, ceinture, t-shirt, pull — t-shirt exclu du calcul', () => {
  const garde = [vet('chaussures', NOIR), vet('pantalon', BLEU), vet('ceinture', NOIR), vet('pull', ROUGE), vet('pull', NOIR), vet('t-shirt', VERT)];
  const r = lancer(['chaussures', 'pantalon', 'ceinture', 't-shirt', 'pull'], garde, [[VERT, BLEU], [ROUGE, BLEU]]);
  egalProfond(r.visibles, ['chaussures', 'pantalon', 'ceinture', 'pull']);
  const x = trouver(r, 'k1');
  egal(x.nbManques, 1, 'le t-shirt vert ne compte pas');
  egalProfond(manques(x), [`chaussures:${id(VERT)}`]);
  egal(piece(x, 'pantalon').couleurId, id(BLEU));
  vrai(piece(x, 'ceinture').joker && piece(x, 'pull').joker, 'ceinture et pull en joker');
  egal(piece(x, 'pull').vetement.hex, NOIR);
  egal(x.pieces.some((p) => p.type === 't-shirt'), false);
  const y = trouver(r, 'k2');
  egal(y.nbManques, 0);
  egal(piece(y, 'pull').couleurId, id(ROUGE));
  egal(y.somme, 20, 'deux jokers au coût de la tolérance');
  egal(y.ecartMoyen, 5);
});

test('cas limite : combinaison de 4 couleurs sur 2 pièces écartée, teint actif ou non', () => {
  const garde = [vet('pantalon', ROUGE), vet('t-shirt', BLEU)];
  const combos = [[ROUGE, BLEU, VERT, MST5], [ROUGE, BLEU, MST5]];
  egal(trouver(lancer(['pantalon', 't-shirt'], garde, combos), 'k1'), undefined);
  const r = lancer(['pantalon', 't-shirt'], garde, combos, { teintActif: true, mst: 5 });
  egal(trouver(r, 'k1'), undefined, '4 > 2 pièces + peau');
  const controle = trouver(r, 'k2');
  egal(controle.nbManques, 0);
  egalProfond(controle.peau, { couleurId: id(MST5), ecart: 0 });
});

test('cas limite : harmonie 3 dominantes + 3 soutiens sur 4 pièces, évaluée et non écartée', () => {
  const garde = [vet('chaussures', ROUGE), vet('pantalon', BLEU), vet('t-shirt', VERT), vet('veste', JAUNE), vet('veste', NOIR)];
  const harmonie = { hex: [ROUGE, BLEU, VERT, JAUNE, '#00ffff', '#ff00ff'], roles: ['dominante', 'dominante', 'dominante', 'soutien', 'soutien', 'soutien'] };
  const sansRoles = [ROUGE, BLEU, VERT, JAUNE, '#00ffff', '#ff00ff'];
  const r = lancer(['chaussures', 'pantalon', 't-shirt', 'veste'], garde, [harmonie, sansRoles]);
  const p = trouver(r, 'k1');
  vrai(p !== undefined, 'harmonie retenue');
  egal(p.nbManques, 0);
  egal(piece(p, 'veste').couleurId, id(JAUNE), 'le soutien couvert passe devant le joker');
  egal(trouver(r, 'k2'), undefined, 'sans rôles, 6 couleurs obligatoires sur 4 pièces : écartée');
  const soutienNonPorte = trouver(lancer(['chaussures', 'pantalon', 't-shirt'], garde, [harmonie]), 'k1');
  egal(soutienNonPorte.nbManques, 0, 'aucun soutien porté : pas de manque');
});

test('cas limite : teint actif, la peau couvre et la proposition passe devant à manques égaux', () => {
  const garde = [vet('pantalon', ROUGE), vet('t-shirt', MST5), vet('t-shirt', BLEU)];
  const r = lancer(['pantalon', 't-shirt'], garde, [[ROUGE, BLEU], [MST5, ROUGE]],
    { teintActif: true, mst: 4, favoris: [id(ROUGE), id(BLEU)] });
  egalProfond(r.retenues.map((p) => p.combinaison.id), ['k2', 'k1'], 'peau utilisée avant 2 favoris');
  const a = r.retenues[0];
  const e = deltaE00(labDepuisHex(MST4), labDepuisHex(MST5));
  vrai(e <= 10, `ΔE00(MST 4, MST 5) = ${e}`);
  egal(a.peauUtilisee, true);
  egalProfond(a.peau, { couleurId: id(MST5), ecart: e });
  egal(a.nbManques, 0);
  egal(a.somme, Math.round(e * 1e6) / 1e6);
  egal(a.nbTermes, 3);
  egal(r.retenues[1].peauUtilisee, false);
  egal(r.retenues[1].nbFavoris, 2);
});

test('cas limite : seul pantalon noir, joker sans manque quand les autres pièces suffisent', () => {
  const combo = [[ROUGE, BLEU]];
  const a = lancer(['chaussures', 'pantalon', 't-shirt'], [vet('chaussures', BLEU), vet('pantalon', NOIR), vet('t-shirt', ROUGE)], combo).retenues[0];
  egal(a.nbManques, 0);
  vrai(piece(a, 'pantalon').joker && !piece(a, 'pantalon').manque);
  egal(piece(a, 'pantalon').vetement.hex, NOIR);
  const b = lancer(['pantalon', 't-shirt'], [vet('pantalon', NOIR), vet('t-shirt', ROUGE)], combo).retenues[0];
  egalProfond(manques(b), [`pantalon:${id(BLEU)}`], 'contre-exemple : 2 couleurs pour 2 pièces');
  const c = lancer(['pantalon', 't-shirt'], [vet('pantalon', NOIR), vet('t-shirt', ROUGE)], [[ROUGE, MST5]], { teintActif: true, mst: 5 }).retenues[0];
  egal(c.nbManques, 0);
  vrai(piece(c, 'pantalon').joker, 'la peau porte MST 5, le pantalon reste en joker');
});

test('cas limite : pièce en manque non nécessaire notée joker, vêtement couvrant préféré au joker', () => {
  const r = lancer(['chaussures', 'pantalon', 't-shirt'], [vet('pantalon', BLEU), vet('t-shirt', ROUGE_PROCHE), vet('t-shirt', NOIR)], [[ROUGE, BLEU]]);
  const p = r.retenues[0];
  egalProfond(manques(p), ['chaussures:joker']);
  egal(piece(p, 't-shirt').couleurId, id(ROUGE));
  egal(piece(p, 't-shirt').vetement.hex, ROUGE_PROCHE);
  const avecPeau = lancer(['chaussures', 't-shirt'], [vet('t-shirt', ROUGE)], [[ROUGE, MST5]], { teintActif: true, mst: 5 }).retenues[0];
  egalProfond(manques(avecPeau), ['chaussures:joker']);
  egal(avecPeau.peau.couleurId, id(MST5));
});

test('cas limite : tolérance exactement égale au ΔE00 (≤ inclusif)', () => {
  const d = deltaE00(labDepuisHex(ROUGE_PROCHE), labDepuisHex(ROUGE));
  const garde = [vet('pantalon', BLEU), vet('t-shirt', ROUGE_PROCHE)];
  egal(lancer(['pantalon', 't-shirt'], garde, [[ROUGE, BLEU]], { tolerance: d }).retenues[0].nbManques, 0);
  const juste = lancer(['pantalon', 't-shirt'], garde, [[ROUGE, BLEU]], { tolerance: d - 1e-6 }).retenues[0];
  egalProfond(manques(juste), [`t-shirt:${id(ROUGE)}`]);
});

test('cas limite : tolérance exactement égale au ΔE00 du teint (≤ inclusif pour la peau)', () => {
  const e = deltaE00(labDepuisHex(MST4), labDepuisHex(MST5));
  const garde = [vet('t-shirt', ROUGE)];
  const pile = lancer(['t-shirt'], garde, [[MST5, ROUGE]], { teintActif: true, mst: 4, tolerance: e }).retenues[0];
  egal(pile.peau.couleurId, id(MST5));
  egal(lancer(['t-shirt'], garde, [[MST5, ROUGE]], { teintActif: true, mst: 4, tolerance: e - 1e-6 }).retenues.length, 0);
});

test('cas limite : une seule pièce, retenue seulement si la peau porte une couleur', () => {
  const garde = [vet('t-shirt', ROUGE)];
  const oui = lancer(['t-shirt'], garde, [[MST5, ROUGE]], { teintActif: true, mst: 5 });
  egal(oui.retenues.length, 1);
  egal(oui.retenues[0].nbManques, 0);
  egal(lancer(['t-shirt'], garde, [[MST5, ROUGE]]).retenues.length, 0);
});

test('cas limite : plus de 2 manques, combinaison écartée', () => {
  const garde = [vet('pantalon', ROUGE), vet('t-shirt', ROUGE), vet('pull', ROUGE)];
  egal(lancer(['pantalon', 't-shirt', 'pull'], garde, [[VERT, BLEU, MST5]]).retenues.length, 0);
});

test('cas limite : joker noir et blanc, le noir est dessiné, le plus ancien à écart égal', () => {
  const noirAncien = vet('t-shirt', NOIR);
  const garde = [vet('chaussures', BLEU), vet('pantalon', ROUGE), vet('t-shirt', BLANC), noirAncien, vet('t-shirt', NOIR)];
  garde[2].dateAjout = '2025-01-01T00:00:00.000Z';
  const p = lancer(['chaussures', 'pantalon', 't-shirt'], garde, [[ROUGE, BLEU]]).retenues[0];
  egal(p.nbManques, 0);
  egal(piece(p, 't-shirt').vetement, noirAncien, 'noir avant blanc, même plus récent que le blanc');
  const deuxRouges = [vet('pantalon', BLEU), vet('t-shirt', ROUGE), vet('t-shirt', ROUGE)];
  deuxRouges[2].dateAjout = '2020-01-01T00:00:00.000Z';
  const q = lancer(['pantalon', 't-shirt'], deuxRouges, [[ROUGE, BLEU]]).retenues[0];
  egal(piece(q, 't-shirt').vetement, deuxRouges[2], 'le plus ancien à écart égal');
});

test('coût du joker : une couleur couverte passe devant le joker', () => {
  const garde = [vet('chaussures', NOIR), vet('pantalon', BLEU), vet('t-shirt', JAUNE), vet('veste', BLEU), vet('veste', NOIR)];
  const p = lancer(['chaussures', 'pantalon', 't-shirt', 'veste'], garde, [[BLEU, JAUNE]]).retenues[0];
  egal(piece(p, 'veste').vetement.hex, BLEU);
  egal(piece(p, 'chaussures').joker, true);
});

test('tri, filtre « avec mes favoris » et coupe', () => {
  const garde = [vet('pantalon', ROUGE), vet('t-shirt', BLEU), vet('t-shirt', VERT)];
  const r = lancer(['pantalon', 't-shirt'], garde, [[ROUGE, BLEU], [ROUGE, VERT], [ROUGE, JAUNE], [BLEU, VERT]], { favoris: [id(VERT)] });
  egalProfond(r.retenues.map((p) => p.combinaison.id), ['k2', 'k1', 'k4', 'k3']);
  egalProfond(selectionner(r.retenues, { avecFavoris: true }).map((p) => p.combinaison.id), ['k2', 'k4']);
  egalProfond(selectionner(r.retenues, { max: 1 }).map((p) => p.combinaison.id), ['k2']);
  const base = { nbManques: 0, peauUtilisee: false, nbFavoris: 0, ecartMoyen: 3, rang: 5 };
  vrai(comparerPropositions({ ...base, ecartMoyen: 2 }, base) < 0, 'moyenne plus faible devant');
  vrai(comparerPropositions(base, { ...base, ecartMoyen: Infinity }) < 0, 'moyenne « — » derrière');
  egal(comparerPropositions({ ...base, ecartMoyen: Infinity }, { ...base, ecartMoyen: Infinity, rang: 6 }), -1, 'rang départage');
});

test('cache : réutilisé pour le même catalogue, remplacé sinon, résultats identiques', () => {
  const catalogue = catalogueDe([[ROUGE, BLEU]]);
  const entree = { types: ['pantalon', 't-shirt'], vetements: [vet('pantalon', ROUGE), vet('t-shirt', BLEU)], catalogue, reglages: reglages() };
  const premier = proposer(entree);
  const second = proposer({ ...entree, cache: premier.cache });
  egal(second.cache, premier.cache);
  egalProfond(second.retenues.map((p) => p.somme), premier.retenues.map((p) => p.somme));
  const autre = proposer({ ...entree, cache: creerCacheEcarts(catalogueDe([[VERT, BLEU]])) });
  vrai(autre.cache.catalogue === catalogue, 'cache d\'un autre catalogue remplacé');
});

// ---- Oracle : énumération exhaustive, écrite indépendamment de la programmation dynamique ----

function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plusPetit(a, b) {
  for (let t = 0; t < a.length; t++) if (a[t] !== b[t]) return a[t] < b[t];
  return false;
}

const PALETTE = [ROUGE, ROUGE_PROCHE, BLEU, VERT, JAUNE, NOIR, BLANC, '#808080', MST5, MST4, '#123456', '#f3e7db', '#0a0a0a'];

function oracle({ types, vetements, combinaison, catalogue, r }) {
  const visibles = piecesVisibles(types);
  const tol = r.tolerance;
  const couleurs = combinaison.couleurs.map((c) => catalogue.couleurParId.get(c));
  const k = couleurs.length;
  const obligatoire = couleurs.map((_, j) => !combinaison.roles || combinaison.roles[j] === 'dominante');
  const infos = visibles.map((type) => {
    const siens = vetements.filter((v) => v.type === type);
    const d = couleurs.map((c) => Math.min(Infinity, ...siens.map((v) => deltaE00(labDepuisHex(v.hex), c.lab))));
    const joker = siens.some((v) => estNoir(labDepuisHex(v.hex)) || estBlanc(labDepuisHex(v.hex)));
    return { d, joker };
  });
  const e = r.teintActif ? couleurs.map((c) => deltaE00(labDepuisHex(MST[r.mst - 1]), c.lab)) : null;
  const m = visibles.length;
  let meilleur = null;
  const choix = new Array(m).fill(0);
  const optionsPeau = r.teintActif ? [...couleurs.map((_, j) => j).filter((j) => e[j] <= tol), -1] : [-1];
  const recurser = (i) => {
    if (i < m) {
      for (let o = 0; o <= k; o++) { choix[i] = o; recurser(i + 1); }
      return;
    }
    for (const peau of optionsPeau) {
      const porte = new Set();
      let M = 0, Q = 0, S = 0;
      choix.forEach((o, p) => {
        if (o < k) {
          porte.add(o);
          if (infos[p].d[o] <= tol) S += Math.round(infos[p].d[o] * 1e6);
          else { M++; Q++; }
        } else if (infos[p].joker) S += Math.round(tol * 1e6);
        else M++;
      });
      if (peau >= 0) { porte.add(peau); S += Math.round(e[peau] * 1e6); }
      if (!obligatoire.every((ob, j) => !ob || porte.has(j))) continue;
      const U = r.teintActif && peau < 0 ? 1 : 0;
      const vecteur = [M, U, Q, S];
      // Strictement meilleur seulement : à égalité, la première affectation énumérée (ordre lexicographique) reste.
      if (meilleur === null || plusPetit(vecteur, meilleur.vecteur)) meilleur = { vecteur, choix: [...choix], peau };
    }
  };
  recurser(0);
  if (meilleur === null || meilleur.vecteur[0] > 2) return null;
  return meilleur;
}

test('programmation dynamique identique à l\'énumération exhaustive sur 400 tenues aléatoires', () => {
  const alea = aleatoire(20260924);
  const tirer = (liste) => liste[Math.floor(alea() * liste.length)];
  let comparees = 0, retenues = 0;
  for (let n = 0; n < 400; n++) {
    const nbCouleurs = 2 + Math.floor(alea() * 3);
    const hex = [];
    while (hex.length < nbCouleurs) { const h = tirer(PALETTE); if (!hex.includes(h)) hex.push(h); }
    let roles;
    if (alea() < 0.5) {
      roles = hex.map(() => (alea() < 0.6 ? 'dominante' : 'soutien'));
      if (!roles.includes('dominante')) roles[0] = 'dominante';
    }
    const candidats = TYPES.filter((t) => t !== 'short');
    const types = [];
    const nbTypes = 1 + Math.floor(alea() * 5);
    while (types.length < nbTypes) { const t = tirer(candidats); if (!types.includes(t)) types.push(t); }
    const vetements = [];
    const nbVet = Math.floor(alea() * 9);
    for (let v = 0; v < nbVet; v++) vetements.push(vet(tirer(types), tirer(PALETTE)));
    const r = reglages({ tolerance: tirer([5, 10, 15]), teintActif: alea() < 0.5, mst: 1 + Math.floor(alea() * 10) });
    const catalogue = catalogueDe([{ hex, roles }]);
    const combinaison = catalogue.combinaisons[0];
    const attendu = oracle({ types, vetements, combinaison, catalogue, r });
    const obtenu = proposer({ types, vetements, catalogue, reglages: r }).retenues[0];
    const cas = `tenue ${n} (${types.join(', ')} ; ${hex.join(' ')})`;
    comparees++;
    if (attendu === null) { egal(obtenu, undefined, `${cas} : devrait être écartée`); continue; }
    retenues++;
    vrai(obtenu !== undefined, `${cas} : devrait être retenue`);
    const [M, U, , S] = attendu.vecteur;
    egal(obtenu.nbManques, M, `${cas} : manques`);
    egal(obtenu.peauUtilisee, r.teintActif && U === 0, `${cas} : peau`);
    egal(obtenu.somme, S / 1e6, `${cas} : somme`);
    obtenu.pieces.forEach((p, i) => {
      const o = attendu.choix[i];
      egal(p.joker ? nbCouleurs : combinaison.couleurs.indexOf(p.couleurId), o, `${cas} : pièce ${p.type}`);
    });
    egal(obtenu.peau ? combinaison.couleurs.indexOf(obtenu.peau.couleurId) : -1, attendu.peau, `${cas} : couleur de la peau`);
  }
  return `${comparees} tenues, dont ${retenues} retenues`;
});
