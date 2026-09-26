// Outils d'interface : construction d'éléments, pastilles, composants iOS 26 (barre de navigation, bouton rond en
// verre, interrupteur, menu, feuilles et alertes), annonces. Le texte passe toujours par textContent (jamais innerHTML
// avec des données).

import { icone } from './icones.js';

export function el(nom, attributs = {}, ...enfants) {
  const element = document.createElement(nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (cle === 'class') element.className = valeur;
    else if (cle === 'style' && typeof valeur === 'object') Object.assign(element.style, valeur);
    else if (cle.startsWith('on') && typeof valeur === 'function') element.addEventListener(cle.slice(2), valeur);
    else if (valeur === true) element.setAttribute(cle, '');
    else element.setAttribute(cle, String(valeur));
  }
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    element.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return element;
}

export function pastille(hex, { classe = '', titre } = {}) {
  return el('span', { class: `pastille ${classe}`.trim(), style: { backgroundColor: hex }, title: titre, 'aria-hidden': 'true' });
}

// Joker « noir ou blanc » : pastille coupée en diagonale (#000000 et #ffffff, bornes du codage sRGB ; voir app.css).
export function pastilleJoker({ classe = '', titre } = {}) {
  return pastille('#ffffff', { classe: `joker ${classe}`.trim(), titre });
}

export function estInstallee() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function nouvelIdentifiant() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const reduireAnimations = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// ---------- Composants ----------

// Bouton rond en verre, icône seule ; le libellé sert à VoiceOver.
export function boutonRond({ icone: nom, libelle, action, onclick, classe = '' }) {
  return el('button', { type: 'button', class: `bouton-rond ${classe}`.trim(), 'aria-label': libelle, title: libelle, 'data-action': action, onclick },
    icone(nom));
}

// Tuile icône + libellé (types de vêtements). attributs : data-*, aria-pressed, onclick…
export function tuile({ icone: nom, libelle, ...attributs }) {
  return el('button', { type: 'button', class: 'tuile-type', ...attributs }, icone(nom), el('span', {}, libelle));
}

// Barre de navigation d'iOS : barre collante (titre réduit qui apparaît au défilement, boutons en verre),
// puis grand titre. Renvoie deux éléments à placer en tête de l'écran.
export function barreNavigation({ titre, sousTitre = null, droite = [], gauche = [] }) {
  return [
    el('header', { class: 'barre-nav' },
      el('div', { class: 'gauche-barre' }, gauche),
      el('span', { class: 'titre-barre', 'aria-hidden': 'true' }, titre),
      el('div', { class: 'actions-barre' }, droite)),
    el('div', { class: 'entete-ecran' }, el('h1', {}, titre),
      sousTitre ? el('p', { class: 'sous-titre-ecran discret' }, sousTitre) : null),
  ];
}

// Interrupteur : <input type=checkbox switch> que Safari dessine à la façon d'iOS (avec vibration).
// Ailleurs, la classe interrupteur-maison le dessine en CSS.
const switchNatif = typeof HTMLInputElement !== 'undefined'
  && ('switch' in HTMLInputElement.prototype || globalThis.CSS?.supports?.('selector(::thumb)') === true);
export function interrupteur({ id, checked = false, onchange }) {
  return el('input', {
    type: 'checkbox', switch: true, role: 'switch', id, checked,
    class: switchNatif ? 'interrupteur' : 'interrupteur interrupteur-maison', onchange,
  });
}

// Menu d'actions qui s'ouvre près du bouton touché (popover à fermeture automatique).
// options : [{ libelle, icone, valeur, action? }]. Renvoie la valeur choisie, ou null.
export function ouvrirMenu(ancre, options) {
  return new Promise((resoudre) => {
    let fini = false;
    const menu = el('div', { class: 'menu', popover: 'auto', role: 'menu' });
    const fin = (valeur) => {
      if (fini) return;
      fini = true;
      try { if (menu.matches(':popover-open')) menu.hidePopover(); } catch { /* déjà fermé */ }
      menu.remove();
      resoudre(valeur);
    };
    menu.append(...options.map((o) => el('button', {
      type: 'button', class: 'menu-option', role: 'menuitem', 'data-action': o.action, onclick: () => fin(o.valeur),
    }, el('span', {}, o.libelle), o.icone ? icone(o.icone) : null)));
    menu.addEventListener('toggle', (evenement) => { if (evenement.newState === 'closed') fin(null); });
    const zone = ancre.getBoundingClientRect();
    Object.assign(menu.style, { top: `${Math.round(zone.bottom + 8)}px`, right: `${Math.round(window.innerWidth - zone.right)}px`, left: 'auto' });
    document.body.append(menu);
    if (typeof menu.showPopover === 'function') menu.showPopover();
    menu.querySelector('button')?.focus({ preventScroll: true });
  });
}

// ---------- Feuilles et alertes ----------

// Dialogue modal. forme 'feuille' (monte du bas : poignée, ✕ à gauche, action principale à droite, glisser vers
// le bas pour fermer) ou 'alerte' (au centre, texte à gauche, boutons en capsule).
// boutons : [{ libelle, valeur, style: 'principal' | 'danger' | 'secondaire' }] ; valeur null : fermeture.
// Un élément du contenu portant data-choix ferme aussi le dialogue et renvoie sa valeur.
// Renvoie une promesse résolue avec la valeur choisie, ou null si le dialogue est fermé autrement.
export function ouvrirDialogue({ titre, contenu = [], boutons = [{ libelle: 'Fermer', valeur: null }], classe = '', forme = 'feuille' }) {
  return new Promise((resoudre) => {
    let terminer = null;
    const bouton = (b, classes = '') => el('button', {
      type: 'button', class: `bouton ${b.style ?? 'secondaire'} ${classes}`.trim(), 'data-valeur': b.valeur ?? '',
      onclick: () => terminer(b.valeur ?? null),
    }, b.libelle);
    // Le titre reçoit le focus à l'ouverture : ni cadre sur un bouton, ni clavier iOS ouvert d'office.
    const titreElement = el('h2', { id: 'titre-dialogue', tabindex: '-1', autofocus: true }, titre);
    let dialogue;
    if (forme === 'alerte') {
      dialogue = el('dialog', { class: `dialogue alerte ${classe}`.trim(), 'aria-labelledby': 'titre-dialogue' },
        titreElement,
        el('div', { class: 'dialogue-contenu' }, contenu),
        el('div', { class: 'dialogue-boutons' }, boutons.map((b) => bouton(b))));
    } else {
      const fermeture = boutons.find((b) => b.valeur === null || b.valeur === undefined);
      const [principal, ...autres] = boutons.filter((b) => b !== fermeture);
      dialogue = el('dialog', { class: `dialogue feuille ${classe}`.trim(), 'aria-labelledby': 'titre-dialogue' },
        el('div', { class: 'feuille-entete' },
          el('div', { class: 'poignee', 'aria-hidden': 'true', style: { gridColumn: '1 / -1' } }),
          el('div', { class: 'gauche' }, boutonRond({
            icone: 'fermer', libelle: fermeture?.libelle ?? 'Fermer', action: 'fermer-feuille', onclick: () => terminer(null),
          })),
          titreElement,
          el('div', { class: 'droite' }, principal ? bouton({ style: 'principal', ...principal }, 'petit') : null)),
        el('div', { class: 'dialogue-contenu' }, contenu),
        autres.length > 0 ? el('div', { class: 'dialogue-boutons' }, autres.map((b) => bouton(b))) : null);
      dialogue.querySelector('[data-action="fermer-feuille"]').dataset.valeur = '';
    }
    terminer = terminaison(dialogue, resoudre);
    dialogue.addEventListener('click', (evenement) => {
      const cible = evenement.target.closest('[data-choix]');
      if (cible && dialogue.contains(cible)) terminer(cible.dataset.choix);
    });
    if (forme !== 'alerte') glisserPourFermer(dialogue, dialogue.querySelector('.feuille-entete'), () => terminer(null));
    document.body.append(dialogue);
    armerDialogue(dialogue);
    dialogue.showModal();
  });
}

// Balayer une feuille vers le bas depuis son en-tête la ferme (au-delà de 110 px ou d'un geste rapide).
export function glisserPourFermer(dialogue, poignee, fermer) {
  if (!poignee) return;
  let depart = null;
  let dernier = 0;
  let instant = 0;
  poignee.addEventListener('pointerdown', (evenement) => {
    if (evenement.target.closest('button, input, select')) return;
    depart = evenement.clientY;
    dernier = depart;
    instant = performance.now();
    try { poignee.setPointerCapture(evenement.pointerId); } catch { /* pointeur déjà relâché */ }
    dialogue.style.transition = 'none';
  });
  poignee.addEventListener('pointermove', (evenement) => {
    if (depart === null) return;
    const ecart = Math.max(0, evenement.clientY - depart);
    dialogue.style.transform = `translateY(${ecart}px)`;
    dernier = evenement.clientY;
  });
  const relacher = () => {
    if (depart === null) return;
    const ecart = dernier - depart;
    const vitesse = ecart / Math.max(1, performance.now() - instant);
    depart = null;
    dialogue.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.25, 1)';
    if (ecart > 110 || (ecart > 30 && vitesse > 0.6)) fermer();
    else dialogue.style.transform = '';
  };
  poignee.addEventListener('pointerup', relacher);
  poignee.addEventListener('pointercancel', relacher);
}

// Anti double tape : un dialogue s'ouvre sous le doigt, le second toucher d'un double tape ne doit rien
// y choisir. Les clics sont ignorés pendant DELAI_ARMEMENT ms, puis data-pret est posé (utile aux tests).
const DELAI_ARMEMENT = 400;
const minuteriesArmement = new WeakMap();
export function armerDialogue(dialogue) {
  dialogue.addEventListener('click', (evenement) => {
    if (!('pret' in dialogue.dataset)) {
      evenement.stopPropagation();
      evenement.preventDefault();
    }
  }, true);
  rearmerDialogue(dialogue);
}

// À appeler quand le contenu d'un dialogue change d'étape : de nouveaux boutons apparaissent sous le doigt.
export function rearmerDialogue(dialogue) {
  delete dialogue.dataset.pret;
  clearTimeout(minuteriesArmement.get(dialogue));
  minuteriesArmement.set(dialogue, setTimeout(() => { dialogue.dataset.pret = ''; }, DELAI_ARMEMENT));
}

// Termine un dialogue une seule fois : la promesse est résolue tout de suite ; le dialogue joue son animation
// de sortie (200 ms) puis est fermé et retiré. On n'attend pas l'événement close (différé, parfois retardé par le
// navigateur) ; il ne sert qu'à Échap.
const DUREE_SORTIE = 200;
export function terminaison(dialogue, resoudre) {
  let fini = false;
  const retirer = () => {
    if (dialogue.open) dialogue.close();
    dialogue.remove();
  };
  const terminer = (valeur) => {
    if (fini) return;
    fini = true;
    delete dialogue.dataset.pret; // un dialogue qui se ferme n'est plus « prêt » (utile aux tests)
    clearTimeout(minuteriesArmement.get(dialogue));
    resoudre(valeur);
    if (!dialogue.open || reduireAnimations()) { retirer(); return; }
    dialogue.inert = true;
    dialogue.classList.add('sortie');
    setTimeout(retirer, DUREE_SORTIE);
  };
  dialogue.addEventListener('close', () => terminer(null));
  return terminer;
}

export function confirmer(titre, message, libelle, style = 'danger') {
  return ouvrirDialogue({
    titre,
    forme: 'alerte',
    contenu: [el('p', {}, message)],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle, valeur: 'oui', style: style === 'danger' ? 'principal danger' : style }],
  }).then((v) => v === 'oui');
}

export function afficherErreurs(titre, introduction, erreurs) {
  const affichees = erreurs.slice(0, 12);
  return ouvrirDialogue({
    titre,
    forme: 'alerte',
    contenu: [
      el('p', {}, introduction),
      el('ul', { class: 'liste-erreurs' }, affichees.map((e) => el('li', {}, e))),
      erreurs.length > affichees.length ? el('p', {}, `… et ${erreurs.length - affichees.length} autre(s).`) : null,
    ],
    boutons: [{ libelle: 'OK', valeur: null, style: 'principal' }],
  });
}

// ---------- Annonces ----------

// La zone d'annonces est un popover : il passe dans la couche supérieure, au-dessus des dialogues modaux
// (sinon un message émis pendant un dialogue resterait caché dessous). Masquer puis réafficher le remonte.
let minuterie = null;
function montrer(zone, visible) {
  if (typeof zone.showPopover !== 'function') return;
  try {
    if (zone.matches(':popover-open')) zone.hidePopover();
    if (visible) zone.showPopover();
  } catch { /* popover non pris en charge : la zone reste en position fixe */ }
}

export function annoncer(message, genre = 'info') {
  const zone = document.getElementById('annonces');
  if (!zone) return;
  zone.replaceChildren(el('p', { class: `annonce ${genre}` }, message));
  montrer(zone, true);
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { zone.replaceChildren(); montrer(zone, false); }, genre === 'erreur' ? 8000 : 4000);
}

// ---------- Fichiers ----------

// Photo prise avec l'appareil photo (repli du scan) : renvoie un File ou null. capture ouvre directement
// l'appareil photo arrière sur iOS ; à appeler pendant le geste de l'utilisateur.
export function choisirImage() {
  return new Promise((resoudre) => {
    const champ = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, 'data-choix-fichier': 'image' });
    champ.addEventListener('change', () => {
      const fichier = champ.files?.[0] ?? null;
      champ.remove();
      resoudre(fichier);
    });
    champ.addEventListener('cancel', () => { champ.remove(); resoudre(null); });
    document.body.append(champ);
    champ.click();
  });
}

// Sélection d'un fichier par l'utilisateur. accept vide = aucun filtre (repli iOS si le fichier apparaît grisé).
export function choisirFichier(accept) {
  return new Promise((resoudre) => {
    const champ = el('input', { type: 'file', accept: accept || null, hidden: true, 'data-choix-fichier': accept || 'tous' });
    champ.addEventListener('change', async () => {
      const fichier = champ.files?.[0];
      champ.remove();
      try {
        resoudre(fichier ? await fichier.text() : null);
      } catch (erreur) {
        // Par exemple un fichier iCloud Drive non téléchargé (NotReadableError).
        annoncer(`Lecture du fichier impossible (${erreur.name ?? 'erreur'}).`, 'erreur');
        resoudre(null);
      }
    });
    champ.addEventListener('cancel', () => { champ.remove(); resoudre(null); });
    document.body.append(champ);
    champ.click();
  });
}
