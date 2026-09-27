// Écran Garde-robe : liste groupée par type, ajout (bouton « + » : mesure à la caméra ou choix dans le catalogue),
// modification (type, couleur, marque, photo, pause), suppression.
// Pause (demande de Théo, 2026-09-27) : un vêtement en pause (lavage, prêt…) reste dans la liste, grisé, mais
// n'entre plus dans les propositions ; interrupteur dans la fiche, ou bouton « Pause » en balayant la ligne.

import { el, pastille, ouvrirDialogue, confirmer, annoncer, nouvelIdentifiant, barreNavigation, boutonRond, ouvrirMenu, tuile, interrupteur } from '../ui.js';
import { icone } from '../icones.js';
import { TYPES, LIBELLES_TYPES } from '../constantes.js';
import { ajouterVetement, modifierVetement, supprimerVetement, rappelSauvegardeDu, couleursDuVetement } from '../donnees.js';
import { labDepuisHex, rgbVersHex } from '../couleur.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';
import { ouvrirScan, remplirResultatVetement } from './scan.js';
import { correcteur } from './etalonnage.js';
import { epinglerVetement } from './tenue.js';
import { champMarque, choisirPhoto, proposerPhoto, visuelVetement } from './fiche-vetement.js';
import { boutonWishlist } from './wishlist.js';

// Mesure tout-en-un : caméra plein écran, puis feuille du résultat (ajustement, type, Enregistrer). La couleur
// mesurée est gardée par défaut (origine « scan ») ; un choix dans le catalogue la remplace (hex du catalogue,
// idCouleurCatalogue, origine toujours « scan »). Si la caméra est étalonnée pour la façon de mesurer utilisée,
// la mesure est corrigée (la brute reste affichée). Vêtement multicolore : « Autre couleur » mesure les couleurs
// suivantes (couleursSecondaires), corrigées de la même façon.
async function scanner(app, actions) {
  const corriger = correcteur(app);
  const etalonnee = Object.keys(app.etat.reglages.etalonnage ?? {}).length > 0;
  const corrigerMesure = (mesure) => (app.etat.reglages.etalonnage?.[mesure.mode] ? { ...mesure, rgb: corriger(mesure.rgb, mesure.mode), brut: mesure.rgb } : mesure);
  const choix = await ouvrirScan({
    corriger,
    astuce: etalonnee ? null : 'Astuce : étalonne la caméra une fois (Réglages, Étalonnage) pour des noirs et des blancs plus justes.',
    resultat: (mesure, feuille, controle) => {
      remplirResultatVetement(app, actions, corrigerMesure(mesure), feuille, controle, { corrigerMesure });
    },
  });
  if (!choix) return;
  const id = nouvelIdentifiant();
  const [principale, ...secondaires] = choix.couleurs;
  let nouvelEtat;
  try {
    nouvelEtat = ajouterVetement(app.etat, {
      type: choix.type, hex: principale.hex, origine: 'scan', ...(principale.couleur ? { idCouleurCatalogue: principale.couleur.id } : {}),
      marque: choix.marque, photo: Boolean(choix.photo),
      ...(secondaires.length ? { couleursSecondaires: secondaires.map((c) => ({ hex: c.hex, ...(c.couleur ? { idCouleurCatalogue: c.couleur.id } : {}) })) } : {}),
    }, { id, date: new Date() });
  } catch (erreur) {
    annoncer(erreur.message, 'erreur');
    return;
  }
  if (choix.photo) actions.enregistrerPhoto(id, choix.photo); // en mémoire tout de suite : la liste l'affiche
  const noms = choix.couleurs.map((c) => c.couleur?.nom ?? c.hex).join(' / ');
  if (actions.mettreAJour(nouvelEtat)) annoncer(`Ajouté à ta garde-robe : ${LIBELLES_TYPES[choix.type]}, ${noms}`);
  else if (choix.photo) actions.supprimerPhoto(id);
}

// Nom d'une couleur : celui du catalogue si le vêtement en porte encore le hex, sinon le hex (« Couleur mesurée »
// pour la couleur principale d'un vêtement mesuré).
function nomCouleur({ hex, idCouleurCatalogue }, catalogue, mesuree = false) {
  const couleur = idCouleurCatalogue ? catalogue.couleurParId.get(idCouleurCatalogue) : null;
  if (couleur && couleur.hex === hex) return couleur.nom;
  return mesuree ? `Couleur mesurée ${hex}` : hex;
}

// Nom affiché d'un vêtement : ses couleurs, la principale d'abord (« Peacock Blue / White »).
export function nomCouleurVetement(vetement, catalogue) {
  return couleursDuVetement(vetement).map((c, i) => nomCouleur(c, catalogue, i === 0 && vetement.origine === 'scan')).join(' / ');
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
  const photo = await proposerPhoto();
  const id = nouvelIdentifiant();
  const nouvelEtat = ajouterVetement(app.etat,
    { type, hex: couleur.hex, origine: 'manuel', idCouleurCatalogue: couleur.id, photo: Boolean(photo) },
    { id, date: new Date() });
  if (photo) actions.enregistrerPhoto(id, photo);
  if (actions.mettreAJour(nouvelEtat)) annoncer(`Ajouté à ta garde-robe : ${LIBELLES_TYPES[type]}, ${couleur.nom}`);
  else if (photo) actions.supprimerPhoto(id);
}

// « + » : menu près du bouton, comme dans les apps d'iOS 26.
async function menuAjout(app, actions, ancre) {
  const choix = await ouvrirMenu(ancre, [
    { libelle: 'Mesurer avec la caméra', icone: 'camera', valeur: 'scanner', action: 'scanner' },
    { libelle: 'Choisir dans le catalogue', icone: 'mosaique', valeur: 'catalogue', action: 'ajouter-vetement' },
  ]);
  if (choix === 'scanner') scanner(app, actions);
  else if (choix === 'catalogue') ajouter(app, actions);
}

// Une couleur de vêtement, par la caméra ou sur la carte des couleurs (menu près du bouton touché).
// Renvoie { hex, idCouleurCatalogue? } ou null.
export async function choisirUneCouleur(app, actions, ancre, reference) {
  const moyen = await ouvrirMenu(ancre, [
    { libelle: 'Mesurer avec la caméra', icone: 'camera', valeur: 'camera', action: 'couleur-camera' },
    { libelle: 'Choisir sur la carte', icone: 'mosaique', valeur: 'carte', action: 'couleur-carte' },
  ]);
  if (moyen === 'camera') {
    const mesure = await ouvrirScan({ corriger: correcteur(app), titre: 'Mesurer la couleur' });
    if (!mesure) return null;
    const rgb = app.etat.reglages.etalonnage?.[mesure.mode] ? correcteur(app)(mesure.rgb, mesure.mode) : mesure.rgb;
    return { hex: rgbVersHex(rgb) };
  }
  if (moyen === 'carte') {
    const couleur = await ouvrirSelecteur({ catalogue: app.catalogue, titre: 'Choisir la couleur', reference, ...actions.favorisPourSelecteur() });
    return couleur ? { hex: couleur.hex, idCouleurCatalogue: couleur.id } : null;
  }
  return null;
}

async function modifier(app, actions, vetement) {
  // Couleurs (la principale d'abord, jusqu'à 3) : modifiées seulement à l'enregistrement de la fiche.
  const couleurs = couleursDuVetement(vetement).map((c) => ({ ...c }));
  let couleursModifiees = false;
  const blocCouleurs = el('div', { class: 'groupe groupe-couleurs' });
  const nomDe = (c, i) => {
    const catalogue = c.idCouleurCatalogue ? app.catalogue.couleurParId.get(c.idCouleurCatalogue) : null;
    if (catalogue && catalogue.hex === c.hex) return catalogue.nom;
    return i === 0 && vetement.origine === 'scan' ? `Couleur mesurée ${c.hex}` : c.hex;
  };
  function afficherCouleurs() {
    blocCouleurs.replaceChildren(...couleurs.map((c, i) => el('div', { class: 'ligne ligne-couleur', 'data-index': i },
      pastille(c.hex, { classe: 'moyenne' }),
      el('span', { class: 'texte-ligne' }, nomDe(c, i), el('small', {}, i === 0 ? 'Couleur principale' : `Couleur ${i + 1}`)),
      el('button', {
        type: 'button', class: 'bouton petit', 'data-action': 'changer-couleur', 'data-index': i,
        onclick: async (e) => {
          const nouvelle = await choisirUneCouleur(app, actions, e.currentTarget, labDepuisHex(c.hex));
          if (nouvelle) { couleurs[i] = nouvelle; couleursModifiees = true; afficherCouleurs(); }
        },
      }, 'Changer'),
      i > 0 ? el('button', {
        type: 'button', class: 'retirer-couleur', 'data-action': 'retirer-couleur', 'data-index': i, 'aria-label': `Retirer la couleur ${i + 1}`,
        onclick: () => { couleurs.splice(i, 1); couleursModifiees = true; afficherCouleurs(); },
      }, icone('fermer')) : null)),
    ...(couleurs.length < 3 ? [el('button', {
      type: 'button', class: 'ligne ligne-action', 'data-action': 'ajouter-couleur',
      onclick: async (e) => {
        const nouvelle = await choisirUneCouleur(app, actions, e.currentTarget, labDepuisHex(couleurs[0].hex));
        if (nouvelle) { couleurs.push(nouvelle); couleursModifiees = true; afficherCouleurs(); }
      },
    }, icone('plus'), el('span', { class: 'texte-ligne' }, 'Ajouter une couleur (rayures, bicolore…)'))] : []));
  }
  afficherCouleurs();
  // Photo : modifiée seulement à l'enregistrement de la fiche.
  let photo = vetement.photo ? actions.photo(vetement.id) : null;
  let photoChangee = false;
  const lignePhoto = el('div', { class: 'ligne ligne-photo' });
  function afficherPhoto() {
    // replaceChildren écrirait « null » en texte : le bouton facultatif passe par un tableau filtré.
    lignePhoto.replaceChildren(...[
      photo ? el('img', { class: 'vignette-fiche', src: photo, alt: 'Photo du vêtement' }) : el('span', { class: 'vignette-fiche sans-photo' }, icone('camera')),
      el('span', { class: 'texte-ligne' }, photo ? 'Photo' : 'Aucune photo'),
      el('button', {
        type: 'button', class: 'bouton petit', 'data-action': 'photo-vetement',
        onclick: async () => {
          const choisie = await choisirPhoto();
          if (choisie) { photo = choisie; photoChangee = true; afficherPhoto(); }
        },
      }, photo ? 'Changer' : 'Ajouter'),
      photo ? el('button', {
        type: 'button', class: 'bouton petit danger', 'data-action': 'retirer-photo',
        onclick: () => { photo = null; photoChangee = true; afficherPhoto(); },
      }, 'Retirer') : null,
    ].filter(Boolean));
  }
  afficherPhoto();
  const [champ, suggestions] = champMarque(app, vetement.marque ?? '', { id: 'marque-vetement' });
  const choixType = el('select', { class: 'champ-ligne', id: 'type-vetement', 'data-action': 'type-vetement' },
    TYPES.map((t) => el('option', { value: t, selected: t === vetement.type }, LIBELLES_TYPES[t])));
  const enPause = interrupteur({ id: 'pause-vetement', checked: Boolean(vetement.enPause) });
  const reponse = await ouvrirDialogue({
    titre: 'Modifier le vêtement',
    contenu: [
      el('div', { class: 'groupe' }, lignePhoto),
      el('div', { class: 'groupe' },
        el('label', { class: 'ligne', for: 'marque-vetement' }, el('span', {}, 'Marque'), champ, suggestions),
        el('label', { class: 'ligne', for: 'type-vetement' }, el('span', { class: 'texte-ligne' }, 'Type'), choixType)),
      el('div', { class: 'groupe' },
        el('label', { class: 'ligne ligne-interrupteur', for: 'pause-vetement' }, el('span', { class: 'texte-ligne' }, 'En pause'), enPause)),
      el('p', { class: 'pied-groupe' }, 'Au lavage, prêté… : un vêtement en pause n\'apparaît plus dans les propositions de tenues.'),
      el('h3', { class: 'titre-groupe' }, 'Couleurs'),
      blocCouleurs,
      el('div', { class: 'groupe' },
        el('button', { type: 'button', class: 'ligne ligne-action', 'data-choix': 'composer', 'data-action': 'composer-tenue' },
          icone('epingle'), el('span', { class: 'texte-ligne' }, 'Composer une tenue avec ce vêtement'))),
      el('div', { class: 'groupe' },
        el('button', { type: 'button', class: 'ligne ligne-action danger', 'data-choix': 'supprimer', 'data-action': 'supprimer' }, 'Supprimer ce vêtement')),
    ],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle: 'Enregistrer', valeur: 'ok', style: 'principal' }],
  });
  if (reponse === 'supprimer') { await supprimer(app, actions, vetement); return; }
  if (reponse === 'composer') {
    // Un vêtement en pause n'entre pas dans les propositions : on le reprend d'abord (après accord s'il l'est encore).
    if (vetement.enPause) {
      if (enPause.checked && !(await confirmer('Reprendre ce vêtement ?', 'Il est en pause : pour composer une tenue avec lui, il revient dans les propositions.', 'Reprendre', 'principal'))) return;
      if (!actions.mettreAJour(modifierVetement(app.etat, vetement.id, { enPause: false }))) return;
    }
    epinglerVetement(app, vetement);
    actions.naviguer('tenue');
    return;
  }
  if (reponse !== 'ok') return;
  const modifications = { type: choixType.value, marque: champ.value };
  if (enPause.checked !== Boolean(vetement.enPause)) modifications.enPause = enPause.checked;
  if (couleursModifiees) {
    const [principale, ...secondaires] = couleurs;
    Object.assign(modifications, { hex: principale.hex, idCouleurCatalogue: principale.idCouleurCatalogue ?? null, couleursSecondaires: secondaires });
  }
  if (photoChangee) modifications.photo = photo !== null;
  let nouvelEtat;
  try {
    nouvelEtat = modifierVetement(app.etat, vetement.id, modifications);
  } catch (erreur) {
    annoncer(erreur.message, 'erreur');
    return;
  }
  if (photoChangee && photo) actions.enregistrerPhoto(vetement.id, photo);
  if (actions.mettreAJour(nouvelEtat)) {
    if (photoChangee && !photo) actions.supprimerPhoto(vetement.id);
    annoncer('Vêtement modifié');
  }
}

async function supprimer(app, actions, vetement) {
  const message = `${LIBELLES_TYPES[vetement.type]} « ${nomCouleurVetement(vetement, app.catalogue)} » sera retiré de ta garde-robe.`;
  if (!(await confirmer('Supprimer ce vêtement ?', message, 'Supprimer'))) return;
  if (actions.mettreAJour(supprimerVetement(app.etat, vetement.id))) {
    actions.supprimerPhoto(vetement.id);
    annoncer('Vêtement supprimé');
  }
}

// Balayer une ligne vers la gauche découvre « Pause » (ou « Reprendre ») et « Supprimer », comme dans Mail. Une seule
// ligne ouverte à la fois ; toucher une ligne ouverte la referme. Pause et suppression restent aussi dans la fenêtre
// de modification (VoiceOver).
const LARGEUR_ACTION = 160; // px découverts par le balayage (deux boutons de 80 px)
const SEUIL_BALAYAGE = 10; // px avant de décider entre balayage horizontal et défilement vertical
let ligneOuverte = null;

function fermerLigne(li) {
  if (!li) return;
  li.classList.remove('ouverte');
  li.querySelector('.ligne-vetement').style.transform = '';
  if (ligneOuverte === li) ligneOuverte = null;
}

function balayerPourActions(li, ligneBouton) {
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
  const li = el('li', { class: vetement.enPause ? 'vetement en-pause' : 'vetement' });
  const ligneBouton = el('button', {
    type: 'button', class: 'ligne-vetement', 'data-vetement': vetement.id, 'data-action': 'modifier',
    'aria-label': `Modifier : ${LIBELLES_TYPES[vetement.type]}, ${nom}${vetement.enPause ? ', en pause' : ''}`,
    onclick: () => {
      if ('balaye' in li.dataset) { delete li.dataset.balaye; return; }
      if (li.classList.contains('ouverte')) { fermerLigne(li); return; }
      if (ligneOuverte) { fermerLigne(ligneOuverte); return; }
      modifier(app, actions, vetement);
    },
  },
  visuelVetement(app, vetement),
  el('span', { class: 'infos' },
    el('span', { class: 'nom' }, nom),
    el('span', { class: 'detail discret' },
      vetement.enPause ? el('span', { class: 'mention-pause', 'data-info': 'en-pause' }, 'En pause · ') : null,
      vetement.marque ? el('span', { class: 'marque' }, `${vetement.marque} · `) : null,
      vetement.origine === 'scan' ? 'Mesurée à la caméra' : 'Choisie dans le catalogue')),
  icone('chevron-droite', { classe: 'chevron' }));
  const action = el('button', {
    type: 'button', class: 'action-supprimer', 'data-action': 'supprimer-balayage', tabindex: '-1', 'aria-hidden': 'true',
    onclick: async () => {
      await supprimer(app, actions, vetement);
      fermerLigne(li);
    },
  }, icone('poubelle'), el('span', {}, 'Supprimer'));
  const pause = el('button', {
    type: 'button', class: 'action-pause', 'data-action': 'pause-balayage', tabindex: '-1', 'aria-hidden': 'true',
    onclick: () => {
      fermerLigne(li);
      if (actions.mettreAJour(modifierVetement(app.etat, vetement.id, { enPause: !vetement.enPause }))) {
        annoncer(vetement.enPause ? 'Vêtement repris' : 'Vêtement en pause');
      }
    },
  }, icone(vetement.enPause ? 'reprendre' : 'pause'), el('span', {}, vetement.enPause ? 'Reprendre' : 'Pause'));
  balayerPourActions(li, ligneBouton);
  li.append(pause, action, ligneBouton);
  return li;
}

// Rappel de sauvegarde (demande de Théo, 2026-09-26) : les données ne sont que sur ce téléphone.
function encartSauvegarde(app, actions) {
  const { derniereSauvegarde } = app.etat.reglages;
  const jours = derniereSauvegarde ? Math.floor((Date.now() - Date.parse(derniereSauvegarde)) / 86400000) : null;
  return el('div', { class: 'encart-sauvegarde', 'data-info': 'rappel-sauvegarde', role: 'status' },
    icone('partager'),
    el('div', { class: 'texte-sauvegarde' },
      el('strong', {}, 'Pense à sauvegarder tes données'),
      el('p', {}, jours === null
        ? 'Tes vêtements et tes tenues ne sont que sur ce téléphone : exporte-les pour ne pas les perdre.'
        : `Dernière sauvegarde il y a ${jours} jours. Depuis, tu as ajouté des vêtements ou des tenues.`),
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton principal petit', 'data-action': 'rappel-exporter', onclick: () => actions.exporterDonnees() }, 'Exporter'),
        el('button', { type: 'button', class: 'bouton petit', 'data-action': 'rappel-plus-tard', onclick: () => actions.reporterRappelSauvegarde() }, 'Plus tard'))));
}

function carteAction({ icone: nom, titre, detail, action, onclick }) {
  return el('button', { type: 'button', class: 'carte-action', 'data-action': action, onclick },
    icone(nom), el('span', {}, el('strong', {}, titre), el('span', { class: 'discret' }, ` ${detail}`)));
}

export function rendreGardeRobe(conteneur, app, actions) {
  const { vetements } = app.etat;
  const n = vetements.length;
  const enPause = vetements.filter((v) => v.enPause).length;
  const contenu = barreNavigation({
    titre: 'Garde-robe',
    sousTitre: n > 0 ? `${n} vêtement${n > 1 ? 's' : ''}${enPause > 0 ? `, dont ${enPause} en pause` : ''}` : null,
    droite: [
      boutonWishlist(app, actions),
      boutonRond({ icone: 'plus', libelle: 'Ajouter un vêtement', action: 'ajouter', onclick: (e) => menuAjout(app, actions, e.currentTarget) }),
    ],
  });
  if (rappelSauvegardeDu(app.etat, new Date())) contenu.push(encartSauvegarde(app, actions));
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
