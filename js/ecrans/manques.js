// Section « Ce qui te manque » (en bas de l'onglet Mes tenues, demande de Théo, 2026-09-26) : ce qui manque dans les
// tenues aimées (♡, poids fort) et dans la première proposition de chaque tenue demandée (poids moyen), avec la
// garde-robe et les réglages actuels (js/statistiques.js ; CLAUDE.md, section « Favoris et statistiques »).

import { el, pastille, pastilleJoker, confirmer, annoncer } from '../ui.js';
import { TYPES, LIBELLES_TYPES, ETALONNAGE_CIBLE_NOIR, POIDS_MANQUE_AIMEE, POIDS_MANQUE_PREMIERE } from '../constantes.js';
import { retirerTenueType } from '../donnees.js';
import { manquesFrequents } from '../statistiques.js';
import { icone } from '../icones.js';
import { boutonEnvie } from './wishlist.js';

// Délai avant le calcul, pour que Safari affiche d'abord « Calcul des manques… » (le calcul bloque la page).
const DELAI_AVANT_CALCUL_MS = 30;

// Dépliant « Tenues prises en compte » : reste ouvert d'un rendu à l'autre (retraits successifs).
let tenuesDepliees = false;

// Le calcul relance le moteur pour chaque tenue type et chaque tenue aimée. Il reste valable tant que garde-robe,
// réglages, tenues types, tenues gardées et catalogue sont les mêmes objets : l'état n'est jamais modifié en place,
// chaque changement le remplace.
function resultatEnMemoire(app) {
  const memoire = app.manques;
  const { vetements, reglages, tenuesTypes, tenuesGardees } = app.etat;
  const valable = memoire && memoire.vetements === vetements && memoire.reglages === reglages
    && memoire.tenuesTypes === tenuesTypes && memoire.tenuesGardees === tenuesGardees && memoire.catalogue === app.catalogue;
  return valable ? memoire.resultat : null;
}

function calculer(app) {
  const { vetements, reglages, tenuesTypes, tenuesGardees } = app.etat;
  const resultat = manquesFrequents({ tenuesTypes, tenuesGardees, vetements, catalogue: app.catalogue, reglages, cache: app.cacheEcarts });
  app.cacheEcarts = resultat.cache;
  app.manques = { vetements, reglages, tenuesTypes, tenuesGardees, catalogue: app.catalogue, resultat };
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const libelleTenue = (types) => TYPES.filter((t) => types.includes(t)).map((t) => LIBELLES_TYPES[t].toLowerCase()).join(', ');

// Envie de la wishlist pour un manque : sa couleur ; « noir ou blanc » (joker) : le noir du catalogue, avec une note.
export function envieDuManque(app, { type, couleurId }) {
  if (couleurId) {
    const couleur = app.catalogue.couleurParId.get(couleurId);
    return { type, hex: couleur.hex, idCouleurCatalogue: couleur.id };
  }
  const noir = app.catalogue.couleurs.find((c) => c.hex === ETALONNAGE_CIBLE_NOIR);
  return { type, hex: ETALONNAGE_CIBLE_NOIR, ...(noir ? { idCouleurCatalogue: noir.id } : {}), note: 'ou blanc' };
}

// Écran qui porte la section (le calcul différé ne redessine que si l'on y est encore).
const ECRAN = 'mes-tenues';

// Éléments de la section, à placer dans l'écran.
export function sectionManques(app, actions) {
  const entete = [el('h2', { class: 'titre-section', id: 'ce-qui-te-manque' }, icone('achats'), 'Ce qui te manque')];
  const { tenuesTypes, tenuesGardees } = app.etat;

  if (tenuesTypes.length === 0 && tenuesGardees.length === 0) {
    return [...entete,
      el('p', { class: 'vide', 'data-info': 'sans-tenue' },
        'Aucune tenue pour l\'instant. Dans l\'onglet Tenue, choisis des pièces et touche « Proposer », puis ♡ Garder celles que tu aimes : ce qui te manque pour elles apparaîtra ici.'),
      el('button', { type: 'button', class: 'bouton large', 'data-action': 'aller-tenue', onclick: () => actions.naviguer('tenue') }, 'Aller à la tenue du jour')];
  }

  const resultat = resultatEnMemoire(app);
  if (!resultat) {
    setTimeout(() => {
      if (app.ecran !== ECRAN || resultatEnMemoire(app)) return;
      calculer(app);
      actions.rafraichir();
    }, DELAI_AVANT_CALCUL_MS);
    return [...entete, el('p', { class: 'vide', role: 'status', 'data-info': 'calcul' }, 'Calcul des manques…')];
  }

  const { manques, nbAimees, nbFavorites, nbTenues, nbPremieres } = resultat;
  const bases = [
    nbAimees > 0 ? `tes ${pluriel(nbAimees, 'tenue aimée')} (♡, poids ${POIDS_MANQUE_AIMEE})` : null,
    nbFavorites > 0 ? `tes ${pluriel(nbFavorites, 'combinaison favorite')} (★, poids ${POIDS_MANQUE_AIMEE})` : null,
    nbTenues > 0 ? `la première proposition de ${nbTenues === 1 ? 'ta tenue demandée' : `tes ${nbTenues} tenues demandées`} (poids ${POIDS_MANQUE_PREMIERE})` : null,
  ].filter(Boolean);
  const intro = el('p', { class: 'discret', 'data-info': 'bilan' }, `D'après ${bases.join(' et ')}, avec ta garde-robe actuelle.`);

  let corps;
  if (nbAimees === 0 && nbFavorites === 0 && nbPremieres === 0) {
    corps = el('p', { class: 'vide', 'data-info': 'sans-proposition' },
      'Aucune proposition retenue pour tes tenues (plus de 2 manques partout). Ajoute des vêtements ou augmente la tolérance (Réglages).');
  } else if (manques.length === 0) {
    corps = el('p', { class: 'vide', 'data-info': 'rien-ne-manque' }, 'Rien ne manque : tes tenues aimées et tes premières propositions sont complètes.');
  } else {
    corps = el('ol', { class: 'groupe liste-manques' }, manques.map((manque, i) => {
      const couleur = manque.couleurId ? app.catalogue.couleurParId.get(manque.couleurId) : null;
      return el('li', {
        class: 'ligne manque-frequent', 'data-type': manque.type, 'data-couleur': manque.couleurId ?? 'joker', 'data-score': manque.score,
      },
      el('span', { class: 'rang' }, String(i + 1)),
      couleur ? pastille(couleur.hex, { classe: 'moyenne' }) : pastilleJoker({ classe: 'moyenne' }),
      el('span', { class: 'infos' },
        el('span', { class: 'nom' }, couleur ? couleur.nom : 'Noir ou blanc'),
        el('span', { class: 'discret detail' }, icone(manque.type), LIBELLES_TYPES[manque.type])),
      // D'où vient le manque : tenues aimées (♡) et premières propositions (1ʳᵉ).
      el('span', { class: 'nombre' },
        manque.aimees > 0 ? el('span', { class: 'poids-manque', 'aria-label': `dans ${pluriel(manque.aimees, 'tenue aimée')}` }, `♡ ${manque.aimees}`) : null,
        manque.favorites > 0 ? el('span', { class: 'poids-manque', 'aria-label': `dans ${pluriel(manque.favorites, 'combinaison favorite')}` }, `★ ${manque.favorites}`) : null,
        manque.premieres > 0 ? el('span', { class: 'poids-manque', 'aria-label': `dans ${pluriel(manque.premieres, 'première proposition')}` }, `1ʳᵉ ${manque.premieres}`) : null),
      boutonEnvie(app, actions, envieDuManque(app, manque), `${LIBELLES_TYPES[manque.type]}, ${couleur ? couleur.nom : 'noir ou blanc'}`));
    }));
  }

  async function retirer(types) {
    const ok = await confirmer('Retirer cette tenue ?',
      `« ${libelleTenue(types)} » ne comptera plus dans les manques fréquents. Elle reviendra si tu la redemandes dans l'onglet Tenue.`,
      'Retirer');
    if (ok && actions.mettreAJour(retirerTenueType(app.etat, types))) annoncer('Tenue retirée');
  }

  return [...entete, intro, corps,
    el('details', {
      class: 'depliant carte tenues-comptees', open: tenuesDepliees,
      ontoggle: (evenement) => { tenuesDepliees = evenement.target.open; },
    },
    el('summary', {}, `Tenues prises en compte (${nbTenues})`),
    el('ul', {}, tenuesTypes.map((types) => el('li', {},
      el('span', {}, libelleTenue(types)),
      el('button', {
        type: 'button', class: 'bouton petit danger', 'data-action': 'retirer-tenue', 'data-tenue': types.join(','),
        'aria-label': `Retirer la tenue ${libelleTenue(types)}`, onclick: () => retirer(types),
      }, 'Retirer')))))];
}
