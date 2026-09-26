// Onglet Mes tenues (demande de Théo, 2026-09-26) : inventaire des tenues gardées (♡ dans l'onglet Tenue), avec
// l'avatar habillé de chacune ; toucher une tenue ouvre son détail (nom facultatif, vêtements à porter, partage,
// retrait). En bas, la section « Ce qui te manque » (manques fréquents).

import { el, pastille, pastilleJoker, ouvrirDialogue, confirmer, annoncer, barreNavigation } from '../ui.js';
import { icone } from '../icones.js';
import { LIBELLES_TYPES, MST, NOM_TENUE_MAX } from '../constantes.js';
import { retirerTenueGardee, renommerTenueGardee } from '../donnees.js';
import { dessinerAvatar } from '../avatar.js';
import { piecesAvatar, referenceCombinaison } from '../tenues.js';
import { nomCouleurVetement } from './garde-robe.js';
import { sectionManques } from './manques.js';
import { visuelVetement } from './fiche-vetement.js';

const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function avatar(app, tenue, classe = '') {
  const svg = dessinerAvatar({
    peau: MST[app.etat.reglages.mst - 1], pieces: piecesAvatar(tenue),
    description: `Avatar : ${tenue.pieces.map((p) => LIBELLES_TYPES[p.type].toLowerCase()).join(', ')}`,
  });
  if (classe) svg.classList.add(classe);
  return svg;
}

function bandes(tenue) {
  return el('span', { class: 'bandes', 'aria-hidden': 'true' }, tenue.combinaison.couleurs.map((c) => el('span', {
    class: `bande${c.role === 'soutien' ? ' soutien' : ''}`, style: { backgroundColor: c.hex }, title: c.nom,
  })));
}

const nbManques = (tenue) => tenue.pieces.filter((p) => p.manque).length;

// Ligne « À porter » : vêtement (photo ou pastille, nom, marque), ou manque, ou vêtement supprimé depuis.
function lignePiece(app, tenue, piece) {
  const libelle = el('strong', {}, `${LIBELLES_TYPES[piece.type]} : `);
  if (piece.manque) {
    const cible = tenue.combinaison.couleurs.find((c) => c.id === piece.couleurId);
    return el('div', { class: 'ligne piece-tenue manque', 'data-type': piece.type },
      cible ? pastille(piece.hex, { classe: 'moyenne' }) : pastilleJoker({ classe: 'moyenne' }),
      el('span', { class: 'texte-ligne' }, el('span', { class: 'avertissement' }, '⚠ '), libelle,
        cible ? `il te manque ${cible.nom}` : 'il te manque un noir ou un blanc'));
  }
  const vetement = app.etat.vetements.find((v) => v.id === piece.vetementId);
  return el('div', { class: 'ligne piece-tenue', 'data-type': piece.type },
    vetement ? visuelVetement(app, vetement) : pastille(piece.hex, { classe: 'moyenne' }),
    el('span', { class: 'texte-ligne' }, libelle,
      vetement ? nomCouleurVetement(vetement, app.catalogue) : `vêtement supprimé de la garde-robe (${piece.hex})`,
      vetement?.marque ? el('small', {}, vetement.marque) : null));
}

async function ouvrirTenue(app, actions, tenue) {
  const champNom = el('input', {
    type: 'text', class: 'champ-ligne-texte', id: 'nom-tenue', maxlength: NOM_TENUE_MAX, placeholder: 'Facultatif',
    autocomplete: 'off', value: tenue.nom ?? '', 'data-action': 'nom-tenue',
    // Enregistré dès que le champ perd le focus (comme les réglages d'iOS).
    onchange: (e) => {
      try {
        actions.mettreAJour(renommerTenueGardee(app.etat, tenue.id, e.target.value), { sansRendu: true });
      } catch (erreur) {
        annoncer(erreur.message, 'erreur');
      }
    },
  });
  const reponse = await ouvrirDialogue({
    titre: tenue.nom ?? referenceCombinaison(tenue.combinaison),
    classe: 'detail-tenue',
    contenu: [
      el('div', { class: 'apercu-tenue' }, avatar(app, tenue, 'avatar-grand'),
        el('div', { class: 'legende' },
          el('strong', {}, referenceCombinaison(tenue.combinaison)), bandes(tenue),
          el('span', { class: 'discret' }, `Gardée le ${dateCourte(tenue.date)}`),
          nbManques(tenue) > 0 ? el('span', { class: 'discret' }, `⚠ ${nbManques(tenue)} pièce${nbManques(tenue) > 1 ? 's' : ''} te manque${nbManques(tenue) > 1 ? 'nt' : ''}`) : null)),
      el('div', { class: 'groupe' },
        el('label', { class: 'ligne', for: 'nom-tenue' }, el('span', { class: 'texte-ligne' }, 'Nom'), champNom)),
      el('h3', { class: 'titre-groupe' }, 'À porter'),
      el('div', { class: 'groupe liste-pieces-tenue' }, tenue.pieces.map((piece) => lignePiece(app, tenue, piece))),
      tenue.peau ? el('p', { class: 'pied-groupe' }, `Peau : porte ${tenue.peau.nom}.`) : null,
      el('div', { class: 'groupe' },
        el('button', { type: 'button', class: 'ligne ligne-action danger', 'data-choix': 'retirer', 'data-action': 'retirer-tenue-gardee' },
          icone('poubelle'), el('span', { class: 'texte-ligne' }, 'Retirer de mes tenues'))),
    ],
    boutons: [{ libelle: 'Fermer', valeur: null }],
  });
  if (reponse === 'retirer') {
    const nom = tenue.nom ?? referenceCombinaison(tenue.combinaison);
    if (await confirmer('Retirer cette tenue ?', `« ${nom} » ne sera plus dans Mes tenues. Tes vêtements ne changent pas.`, 'Retirer')) {
      if (actions.mettreAJour(retirerTenueGardee(app.etat, tenue.id))) annoncer('Tenue retirée');
      return;
    }
  }
  actions.rafraichir(); // nom éventuellement modifié
}

function carteTenue(app, actions, tenue) {
  const n = nbManques(tenue);
  return el('li', {},
    el('button', {
      type: 'button', class: 'carte-tenue', 'data-tenue-gardee': tenue.id,
      'aria-label': `${tenue.nom ?? referenceCombinaison(tenue.combinaison)}, gardée le ${dateCourte(tenue.date)}`,
      onclick: () => ouvrirTenue(app, actions, tenue),
    },
    el('span', { class: 'cadre-avatar' }, avatar(app, tenue, 'avatar-mini'), n > 0 ? el('span', { class: 'badge-manque' }, `⚠ ${n}`) : null),
    bandes(tenue),
    el('span', { class: 'nom-tenue' }, tenue.nom ?? referenceCombinaison(tenue.combinaison)),
    el('span', { class: 'date-tenue' }, tenue.nom ? `${referenceCombinaison(tenue.combinaison)} · ${dateCourte(tenue.date)}` : dateCourte(tenue.date))));
}

export function rendreMesTenues(conteneur, app, actions) {
  const gardees = app.etat.tenuesGardees;
  const n = gardees.length;
  const contenu = barreNavigation({ titre: 'Mes tenues', sousTitre: n > 0 ? `${n} tenue${n > 1 ? 's' : ''} gardée${n > 1 ? 's' : ''}` : null });
  contenu.push(n === 0
    ? el('p', { class: 'vide', 'data-info': 'sans-tenue-gardee' },
      'Aucune tenue gardée pour l\'instant. Dans l\'onglet Tenue, touche ♡ Garder sur une proposition pour la retrouver ici.')
    : el('ul', { class: 'grille-tenues' }, gardees.map((tenue) => carteTenue(app, actions, tenue))));
  contenu.push(...sectionManques(app, actions));
  conteneur.replaceChildren(...contenu);
}
