// Écran Garde-robe : liste par type, ajout (scan à la caméra ou choix dans le catalogue), modification, suppression.

import { el, pastille, ouvrirDialogue, confirmer, annoncer, nouvelIdentifiant } from '../ui.js';
import { TYPES, LIBELLES_TYPES } from '../constantes.js';
import { ajouterVetement, modifierVetement, supprimerVetement } from '../donnees.js';
import { labDepuisHex } from '../couleur.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';
import { ouvrirScan, choisirApresMesure } from './scan.js';

// Scan : mesure, puis type et « Ajuster ». La couleur mesurée est gardée par défaut (origine « scan ») ;
// « Ajuster » la remplace par celle du catalogue (hex du catalogue, idCouleurCatalogue, origine toujours « scan »).
async function scanner(app, actions) {
  for (;;) {
    const mesure = await ouvrirScan();
    if (!mesure) return;
    const choix = await choisirApresMesure(app, actions, mesure);
    if (choix === 'recommencer') continue;
    if (!choix) return;
    const nouvelEtat = ajouterVetement(app.etat,
      { type: choix.type, hex: choix.hex, origine: 'scan', ...(choix.couleur ? { idCouleurCatalogue: choix.couleur.id } : {}) },
      { id: nouvelIdentifiant(), date: new Date() });
    if (actions.mettreAJour(nouvelEtat)) annoncer(`${LIBELLES_TYPES[choix.type]} ajouté : ${choix.couleur?.nom ?? choix.hex}`);
    return;
  }
}

// Nom affiché : celui de la couleur du catalogue si le vêtement en porte encore le hex, sinon le hex.
export function nomCouleurVetement(vetement, catalogue) {
  const couleur = vetement.idCouleurCatalogue ? catalogue.couleurParId.get(vetement.idCouleurCatalogue) : null;
  if (couleur && couleur.hex === vetement.hex) return couleur.nom;
  return vetement.origine === 'scan' ? `Couleur mesurée ${vetement.hex}` : vetement.hex;
}

async function ajouter(app, actions) {
  const type = await ouvrirDialogue({
    titre: 'Quel type de vêtement ?',
    contenu: [el('div', { class: 'grille-types' },
      TYPES.map((t) => el('button', { type: 'button', class: 'bouton secondaire', 'data-choix': t }, LIBELLES_TYPES[t])))],
    boutons: [{ libelle: 'Annuler', valeur: null }],
  });
  if (!type) return;
  const couleur = await ouvrirSelecteur({
    catalogue: app.catalogue, titre: `${LIBELLES_TYPES[type]} : choisis la couleur`, ...actions.favorisPourSelecteur(),
  });
  if (!couleur) return;
  const nouvelEtat = ajouterVetement(app.etat,
    { type, hex: couleur.hex, origine: 'manuel', idCouleurCatalogue: couleur.id },
    { id: nouvelIdentifiant(), date: new Date() });
  if (actions.mettreAJour(nouvelEtat)) annoncer(`${LIBELLES_TYPES[type]} ajouté : ${couleur.nom}`);
}

async function modifier(app, actions, vetement) {
  let nouvelleCouleur = null;
  const choixType = el('select', { class: 'champ', id: 'type-vetement', 'data-action': 'type-vetement' },
    TYPES.map((t) => el('option', { value: t, selected: t === vetement.type }, LIBELLES_TYPES[t])));
  const apercu = el('div', { class: 'apercu-couleur' });
  const afficherApercu = () => apercu.replaceChildren(
    pastille(nouvelleCouleur?.hex ?? vetement.hex, { classe: 'moyenne' }),
    el('span', {}, nouvelleCouleur ? nouvelleCouleur.nom : nomCouleurVetement(vetement, app.catalogue)));
  afficherApercu();
  const changer = el('button', {
    type: 'button', class: 'bouton secondaire', 'data-action': 'changer-couleur',
    onclick: async () => {
      const couleur = await ouvrirSelecteur({
        catalogue: app.catalogue, titre: 'Nouvelle couleur', reference: labDepuisHex(nouvelleCouleur?.hex ?? vetement.hex),
        ...actions.favorisPourSelecteur(),
      });
      if (couleur) { nouvelleCouleur = couleur; afficherApercu(); }
    },
  }, 'Changer la couleur');
  const reponse = await ouvrirDialogue({
    titre: 'Modifier le vêtement',
    contenu: [
      el('label', { class: 'etiquette', for: 'type-vetement' }, 'Type'), choixType, apercu, changer,
      el('button', { type: 'button', class: 'bouton lien danger', 'data-choix': 'supprimer', 'data-action': 'supprimer' }, 'Supprimer ce vêtement'),
    ],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle: 'Enregistrer', valeur: 'ok', style: 'principal' }],
  });
  if (reponse === 'supprimer') { await supprimer(app, actions, vetement); return; }
  if (reponse !== 'ok') return;
  const modifications = { type: choixType.value };
  if (nouvelleCouleur) Object.assign(modifications, { hex: nouvelleCouleur.hex, idCouleurCatalogue: nouvelleCouleur.id });
  if (actions.mettreAJour(modifierVetement(app.etat, vetement.id, modifications))) annoncer('Vêtement modifié');
}

async function supprimer(app, actions, vetement) {
  const message = `${LIBELLES_TYPES[vetement.type]} « ${nomCouleurVetement(vetement, app.catalogue)} » sera retiré de ta garde-robe.`;
  if (!(await confirmer('Supprimer ce vêtement ?', message, 'Supprimer'))) return;
  if (actions.mettreAJour(supprimerVetement(app.etat, vetement.id))) annoncer('Vêtement supprimé');
}

// Toucher la ligne ouvre la modification (la suppression s'y trouve aussi).
function ligne(app, actions, vetement) {
  const nom = nomCouleurVetement(vetement, app.catalogue);
  return el('li', { class: 'vetement' },
    el('button', {
      type: 'button', class: 'ligne-vetement', 'data-vetement': vetement.id, 'data-action': 'modifier',
      'aria-label': `Modifier : ${LIBELLES_TYPES[vetement.type]}, ${nom}`,
      onclick: () => modifier(app, actions, vetement),
    },
    pastille(vetement.hex, { classe: 'moyenne' }),
    el('span', { class: 'infos' },
      el('span', { class: 'nom' }, nom),
      el('span', { class: 'detail discret' }, vetement.origine === 'scan' ? 'mesurée à la caméra' : 'choisie dans le catalogue')),
    el('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')));
}

export function rendreGardeRobe(conteneur, app, actions) {
  const { vetements } = app.etat;
  const contenu = [
    el('div', { class: 'entete-ecran' },
      el('h1', {}, 'Garde-robe'),
      el('span', { class: 'discret' }, `${vetements.length} vêtement${vetements.length > 1 ? 's' : ''}`)),
    el('div', { class: 'rangee-ajout' },
      el('button', { type: 'button', class: 'bouton principal', 'data-action': 'scanner', onclick: () => scanner(app, actions) },
        'Scanner un vêtement'),
      el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'ajouter-vetement', onclick: () => ajouter(app, actions) },
        'Choisir dans le catalogue')),
  ];
  if (vetements.length === 0) {
    contenu.push(el('p', { class: 'vide' }, 'Ta garde-robe est vide. Ajoute tes vêtements pour obtenir des propositions de tenues.'));
  }
  for (const type of TYPES) {
    const siens = vetements.filter((v) => v.type === type);
    if (siens.length === 0) continue;
    contenu.push(el('section', { class: 'groupe-type', 'data-type': type },
      el('h2', {}, `${LIBELLES_TYPES[type]} (${siens.length})`),
      el('ul', { class: 'liste-vetements' }, siens.map((v) => ligne(app, actions, v)))));
  }
  conteneur.replaceChildren(...contenu);
}
