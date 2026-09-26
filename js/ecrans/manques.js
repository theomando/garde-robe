// Section « Ce qui te manque » (en bas de l'onglet Mes tenues, demande de Théo, 2026-09-26) : les couleurs qui manquent le plus souvent dans les propositions des tenues types
// déjà demandées, avec la garde-robe et les réglages actuels (CLAUDE.md, section « Favoris et statistiques »).

import { el, pastille, pastilleJoker, confirmer, annoncer } from '../ui.js';
import { TYPES, LIBELLES_TYPES } from '../constantes.js';
import { retirerTenueType } from '../donnees.js';
import { manquesFrequents } from '../statistiques.js';
import { icone } from '../icones.js';

// Délai avant le calcul, pour que Safari affiche d'abord « Calcul des manques… » (le calcul bloque la page).
const DELAI_AVANT_CALCUL_MS = 30;

// Dépliant « Tenues prises en compte » : reste ouvert d'un rendu à l'autre (retraits successifs).
let tenuesDepliees = false;

// Le calcul relance le moteur pour chaque tenue type. Il reste valable tant que garde-robe, réglages, tenues
// types et catalogue sont les mêmes objets : l'état n'est jamais modifié en place, chaque changement le remplace.
function resultatEnMemoire(app) {
  const memoire = app.manques;
  const { vetements, reglages, tenuesTypes } = app.etat;
  const valable = memoire && memoire.vetements === vetements && memoire.reglages === reglages
    && memoire.tenuesTypes === tenuesTypes && memoire.catalogue === app.catalogue;
  return valable ? memoire.resultat : null;
}

function calculer(app) {
  const { vetements, reglages, tenuesTypes } = app.etat;
  const resultat = manquesFrequents({ tenuesTypes, vetements, catalogue: app.catalogue, reglages, cache: app.cacheEcarts });
  app.cacheEcarts = resultat.cache;
  app.manques = { vetements, reglages, tenuesTypes, catalogue: app.catalogue, resultat };
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const libelleTenue = (types) => TYPES.filter((t) => types.includes(t)).map((t) => LIBELLES_TYPES[t].toLowerCase()).join(', ');

// Écran qui porte la section (le calcul différé ne redessine que si l'on y est encore).
const ECRAN = 'mes-tenues';

// Éléments de la section, à placer dans l'écran.
export function sectionManques(app, actions) {
  const entete = [el('h2', { class: 'titre-section', id: 'ce-qui-te-manque' }, icone('sac'), 'Ce qui te manque')];
  const { tenuesTypes } = app.etat;

  if (tenuesTypes.length === 0) {
    return [...entete,
      el('p', { class: 'vide', 'data-info': 'sans-tenue' },
        'Aucune tenue demandée pour l\'instant. Dans l\'onglet Tenue, choisis des pièces et touche « Proposer » : les couleurs qui te manquent le plus souvent apparaîtront ici.'),
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

  const { manques, nbPropositions, nbTenues } = resultat;
  const intro = el('p', { class: 'discret', 'data-info': 'bilan' },
    `Nombre de propositions où la couleur manque, sur ${pluriel(nbPropositions, 'proposition')} pour `,
    nbTenues === 1 ? 'ta tenue type' : `tes ${nbTenues} tenues types`, ' (garde-robe et réglages actuels).');

  let corps;
  if (nbPropositions === 0) {
    corps = el('p', { class: 'vide', 'data-info': 'sans-proposition' },
      'Aucune proposition retenue pour tes tenues (plus de 2 manques partout). Ajoute des vêtements ou augmente la tolérance (Réglages).');
  } else if (manques.length === 0) {
    corps = el('p', { class: 'vide', 'data-info': 'rien-ne-manque' }, 'Rien ne manque : ta garde-robe couvre toutes les propositions de tes tenues.');
  } else {
    corps = el('ol', { class: 'groupe liste-manques' }, manques.map((manque, i) => {
      const couleur = manque.couleurId ? app.catalogue.couleurParId.get(manque.couleurId) : null;
      return el('li', {
        class: 'ligne manque-frequent', 'data-type': manque.type, 'data-couleur': manque.couleurId ?? 'joker', 'data-nombre': manque.nombre,
      },
      el('span', { class: 'rang' }, String(i + 1)),
      couleur ? pastille(couleur.hex, { classe: 'moyenne' }) : pastilleJoker({ classe: 'moyenne' }),
      el('span', { class: 'infos' },
        el('span', { class: 'nom' }, couleur ? couleur.nom : 'Noir ou blanc'),
        el('span', { class: 'discret detail' }, icone(manque.type), LIBELLES_TYPES[manque.type])),
      el('span', { class: 'nombre' }, el('strong', {}, String(manque.nombre)),
        el('span', { class: 'discret' }, manque.nombre > 1 ? 'propositions' : 'proposition')));
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
