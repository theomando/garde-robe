// Écran Garde-robe : liste groupée par type, ajout (bouton « + » : mesure à la caméra ou choix dans le catalogue),
// modification, suppression.

import { el, pastille, ouvrirDialogue, confirmer, annoncer, nouvelIdentifiant, barreNavigation, boutonRond, ouvrirMenu, tuile } from '../ui.js';
import { icone } from '../icones.js';
import { TYPES, LIBELLES_TYPES } from '../constantes.js';
import { ajouterVetement, modifierVetement, supprimerVetement } from '../donnees.js';
import { labDepuisHex } from '../couleur.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';
import { ouvrirScan, remplirResultatVetement } from './scan.js';
import { correcteur } from './etalonnage.js';

// Mesure tout-en-un : caméra plein écran, puis feuille du résultat (ajustement, type, Enregistrer). La couleur
// mesurée est gardée par défaut (origine « scan ») ; un choix dans le catalogue la remplace (hex du catalogue,
// idCouleurCatalogue, origine toujours « scan »). Si la caméra est étalonnée pour la façon de mesurer utilisée,
// la mesure est corrigée (la brute reste affichée).
async function scanner(app, actions) {
  const corriger = correcteur(app);
  const etalonnee = Object.keys(app.etat.reglages.etalonnage ?? {}).length > 0;
  const choix = await ouvrirScan({
    corriger,
    astuce: etalonnee ? null : 'Astuce : étalonne la caméra une fois (Réglages, Étalonnage) pour des noirs et des blancs plus justes.',
    resultat: (mesure, feuille, controle) => {
      const corrigee = app.etat.reglages.etalonnage?.[mesure.mode] ? { ...mesure, rgb: corriger(mesure.rgb, mesure.mode), brut: mesure.rgb } : mesure;
      remplirResultatVetement(app, actions, corrigee, feuille, controle);
    },
  });
  if (!choix) return;
  const nouvelEtat = ajouterVetement(app.etat,
    { type: choix.type, hex: choix.hex, origine: 'scan', ...(choix.couleur ? { idCouleurCatalogue: choix.couleur.id } : {}) },
    { id: nouvelIdentifiant(), date: new Date() });
  if (actions.mettreAJour(nouvelEtat)) annoncer(`${LIBELLES_TYPES[choix.type]} ajouté : ${choix.couleur?.nom ?? choix.hex}`);
}

// Nom affiché : celui de la couleur du catalogue si le vêtement en porte encore le hex, sinon le hex.
export function nomCouleurVetement(vetement, catalogue) {
  const couleur = vetement.idCouleurCatalogue ? catalogue.couleurParId.get(vetement.idCouleurCatalogue) : null;
  if (couleur && couleur.hex === vetement.hex) return couleur.nom;
  return vetement.origine === 'scan' ? `Couleur mesurée ${vetement.hex}` : vetement.hex;
}

async function ajouter(app, actions) {
  const type = await ouvrirDialogue({
    titre: 'Quel vêtement ?',
    contenu: [el('div', { class: 'grille-types' },
      TYPES.map((t) => tuile({ icone: t, libelle: LIBELLES_TYPES[t], 'data-choix': t })))],
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

// « + » : menu près du bouton, comme dans les apps d'iOS 26.
async function menuAjout(app, actions, ancre) {
  const choix = await ouvrirMenu(ancre, [
    { libelle: 'Mesurer avec la caméra', icone: 'camera', valeur: 'scanner', action: 'scanner' },
    { libelle: 'Choisir dans le catalogue', icone: 'mosaique', valeur: 'catalogue', action: 'ajouter-vetement' },
  ]);
  if (choix === 'scanner') scanner(app, actions);
  else if (choix === 'catalogue') ajouter(app, actions);
}

async function modifier(app, actions, vetement) {
  let nouvelleCouleur = null;
  const choixType = el('select', { class: 'champ-ligne', id: 'type-vetement', 'data-action': 'type-vetement' },
    TYPES.map((t) => el('option', { value: t, selected: t === vetement.type }, LIBELLES_TYPES[t])));
  const apercu = el('div', { class: 'apercu-couleur texte-ligne' });
  const afficherApercu = () => apercu.replaceChildren(
    pastille(nouvelleCouleur?.hex ?? vetement.hex, { classe: 'moyenne' }),
    el('span', {}, nouvelleCouleur ? nouvelleCouleur.nom : nomCouleurVetement(vetement, app.catalogue)));
  afficherApercu();
  const changer = el('button', {
    type: 'button', class: 'bouton petit', 'data-action': 'changer-couleur',
    onclick: async () => {
      const couleur = await ouvrirSelecteur({
        catalogue: app.catalogue, titre: 'Nouvelle couleur', reference: labDepuisHex(nouvelleCouleur?.hex ?? vetement.hex),
        ...actions.favorisPourSelecteur(),
      });
      if (couleur) { nouvelleCouleur = couleur; afficherApercu(); }
    },
  }, 'Changer');
  const reponse = await ouvrirDialogue({
    titre: 'Modifier le vêtement',
    contenu: [
      el('div', { class: 'groupe' },
        el('label', { class: 'ligne', for: 'type-vetement' }, el('span', { class: 'texte-ligne' }, 'Type'), choixType),
        el('div', { class: 'ligne' }, apercu, changer)),
      el('div', { class: 'groupe' },
        el('button', { type: 'button', class: 'ligne ligne-action danger', 'data-choix': 'supprimer', 'data-action': 'supprimer' }, 'Supprimer ce vêtement')),
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
  const message = `${LIBELLES_TYPES[vetement.type]} « ${nomCouleurVetement(vetement, app.catalogue)} » sera retiré de ta garde-robe.`;
  if (!(await confirmer('Supprimer ce vêtement ?', message, 'Supprimer'))) return;
  if (actions.mettreAJour(supprimerVetement(app.etat, vetement.id))) annoncer('Vêtement supprimé');
}

// Balayer une ligne vers la gauche découvre « Supprimer », comme dans Mail. Une seule ligne ouverte à la fois ;
// toucher une ligne ouverte la referme. La suppression reste aussi dans la fenêtre de modification (VoiceOver).
const LARGEUR_ACTION = 92; // px découverts par le balayage
const SEUIL_BALAYAGE = 10; // px avant de décider entre balayage horizontal et défilement vertical
let ligneOuverte = null;

function fermerLigne(li) {
  if (!li) return;
  li.classList.remove('ouverte');
  li.querySelector('.ligne-vetement').style.transform = '';
  if (ligneOuverte === li) ligneOuverte = null;
}

function balayerPourSupprimer(li, ligneBouton) {
  let depart = null;
  let geste = null; // null (indécis), 'balayage' ou 'defilement'
  let decalage = 0;
  ligneBouton.addEventListener('pointerdown', (e) => {
    depart = { x: e.clientX, y: e.clientY, base: li.classList.contains('ouverte') ? -LARGEUR_ACTION : 0 };
    geste = null;
  });
  ligneBouton.addEventListener('pointermove', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    if (geste === null) {
      if (Math.abs(dx) > SEUIL_BALAYAGE && Math.abs(dx) > Math.abs(dy)) {
        geste = 'balayage';
        if (ligneOuverte && ligneOuverte !== li) fermerLigne(ligneOuverte);
        try { ligneBouton.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
        li.classList.add('glisse');
      } else if (Math.abs(dy) > SEUIL_BALAYAGE) {
        geste = 'defilement';
      }
    }
    if (geste !== 'balayage') return;
    decalage = Math.min(0, Math.max(-LARGEUR_ACTION * 1.3, depart.base + dx));
    ligneBouton.style.transform = `translateX(${decalage}px)`;
  });
  const relacher = () => {
    if (geste === 'balayage') {
      li.classList.remove('glisse');
      // Le clic qui suit le geste ne doit pas ouvrir la modification (s'il ne vient pas, la marque s'efface seule).
      li.dataset.balaye = '';
      setTimeout(() => { delete li.dataset.balaye; }, 350);
      if (decalage < -LARGEUR_ACTION / 2) {
        li.classList.add('ouverte');
        ligneBouton.style.transform = `translateX(${-LARGEUR_ACTION}px)`;
        ligneOuverte = li;
      } else {
        fermerLigne(li);
      }
    }
    depart = null;
    geste = null;
  };
  ligneBouton.addEventListener('pointerup', relacher);
  ligneBouton.addEventListener('pointercancel', relacher);
}

// Toucher la ligne ouvre la modification (la suppression s'y trouve aussi).
function ligne(app, actions, vetement) {
  const nom = nomCouleurVetement(vetement, app.catalogue);
  const li = el('li', { class: 'vetement' });
  const ligneBouton = el('button', {
    type: 'button', class: 'ligne-vetement', 'data-vetement': vetement.id, 'data-action': 'modifier',
    'aria-label': `Modifier : ${LIBELLES_TYPES[vetement.type]}, ${nom}`,
    onclick: () => {
      if ('balaye' in li.dataset) { delete li.dataset.balaye; return; }
      if (li.classList.contains('ouverte')) { fermerLigne(li); return; }
      if (ligneOuverte) { fermerLigne(ligneOuverte); return; }
      modifier(app, actions, vetement);
    },
  },
  pastille(vetement.hex, { classe: 'moyenne' }),
  el('span', { class: 'infos' },
    el('span', { class: 'nom' }, nom),
    el('span', { class: 'detail discret' }, vetement.origine === 'scan' ? 'Mesurée à la caméra' : 'Choisie dans le catalogue')),
  icone('chevron-droite', { classe: 'chevron' }));
  const action = el('button', {
    type: 'button', class: 'action-supprimer', 'data-action': 'supprimer-balayage', tabindex: '-1', 'aria-hidden': 'true',
    onclick: async () => {
      await supprimer(app, actions, vetement);
      fermerLigne(li);
    },
  }, icone('poubelle'), el('span', {}, 'Supprimer'));
  balayerPourSupprimer(li, ligneBouton);
  li.append(action, ligneBouton);
  return li;
}

function carteAction({ icone: nom, titre, detail, action, onclick }) {
  return el('button', { type: 'button', class: 'carte-action', 'data-action': action, onclick },
    icone(nom), el('span', {}, el('strong', {}, titre), el('span', { class: 'discret' }, ` ${detail}`)));
}

export function rendreGardeRobe(conteneur, app, actions) {
  const { vetements } = app.etat;
  const n = vetements.length;
  const contenu = barreNavigation({
    titre: 'Garde-robe',
    sousTitre: n > 0 ? `${n} vêtement${n > 1 ? 's' : ''}` : null,
    droite: [boutonRond({ icone: 'plus', libelle: 'Ajouter un vêtement', action: 'ajouter', onclick: (e) => menuAjout(app, actions, e.currentTarget) })],
  });
  if (n === 0) {
    contenu.push(
      el('p', { class: 'vide' }, 'Ta garde-robe est vide. Ajoute tes vêtements pour obtenir des propositions de tenues.'),
      el('div', { class: 'cartes-actions' },
        carteAction({ icone: 'camera', titre: 'Mesurer un vêtement', detail: 'avec la caméra', action: 'scanner', onclick: () => scanner(app, actions) }),
        carteAction({ icone: 'mosaique', titre: 'Choisir une couleur', detail: 'dans le catalogue', action: 'ajouter-vetement', onclick: () => ajouter(app, actions) })));
  }
  for (const type of TYPES) {
    const siens = vetements.filter((v) => v.type === type);
    if (siens.length === 0) continue;
    contenu.push(el('section', { class: 'groupe-type', 'data-type': type },
      el('h2', { class: 'titre-section' }, icone(type), LIBELLES_TYPES[type], el('span', { class: 'compte-section' }, String(siens.length))),
      el('ul', { class: 'groupe liste-vetements' }, siens.map((v) => ligne(app, actions, v)))));
  }
  conteneur.replaceChildren(...contenu);
}
