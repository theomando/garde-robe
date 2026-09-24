// Outils d'interface : construction d'éléments, pastilles, dialogues, annonces.
// Le texte passe toujours par textContent (jamais innerHTML avec des données).

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

export function estInstallee() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function nouvelIdentifiant() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Dialogue modal. boutons : [{ libelle, valeur, style: 'principal' | 'danger' | 'secondaire' }].
// Un élément du contenu portant data-choix ferme aussi le dialogue et renvoie sa valeur.
// Renvoie une promesse résolue avec la valeur choisie, ou null si le dialogue est fermé autrement.
export function ouvrirDialogue({ titre, contenu = [], boutons = [{ libelle: 'Fermer', valeur: null }], classe = '' }) {
  return new Promise((resoudre) => {
    let terminer = null;
    const dialogue = el('dialog', { class: `dialogue ${classe}`.trim(), 'aria-labelledby': 'titre-dialogue' },
      // Le titre reçoit le focus à l'ouverture : ni cadre sur un bouton, ni clavier iOS ouvert d'office.
      el('h2', { id: 'titre-dialogue', tabindex: '-1', autofocus: true }, titre),
      el('div', { class: 'dialogue-contenu' }, contenu),
      el('div', { class: 'dialogue-boutons' }, boutons.map((b) => el('button', {
        type: 'button',
        class: `bouton ${b.style ?? 'secondaire'}`,
        'data-valeur': b.valeur ?? '',
        onclick: () => terminer(b.valeur ?? null),
      }, b.libelle))));
    terminer = terminaison(dialogue, resoudre);
    dialogue.addEventListener('click', (evenement) => {
      const cible = evenement.target.closest('[data-choix]');
      if (cible && dialogue.contains(cible)) terminer(cible.dataset.choix);
    });
    document.body.append(dialogue);
    dialogue.showModal();
  });
}

// Termine un dialogue une seule fois : fermeture, retrait du document, résolution de la promesse.
// On n'attend pas l'événement close (différé, parfois retardé par le navigateur) ; il ne sert qu'à Échap.
export function terminaison(dialogue, resoudre) {
  let fini = false;
  const terminer = (valeur) => {
    if (fini) return;
    fini = true;
    if (dialogue.open) dialogue.close();
    dialogue.remove();
    resoudre(valeur);
  };
  dialogue.addEventListener('close', () => terminer(null));
  return terminer;
}

export function confirmer(titre, message, libelle, style = 'danger') {
  return ouvrirDialogue({
    titre,
    contenu: [el('p', {}, message)],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle, valeur: 'oui', style }],
  }).then((v) => v === 'oui');
}

export function afficherErreurs(titre, introduction, erreurs) {
  const affichees = erreurs.slice(0, 12);
  return ouvrirDialogue({
    titre,
    contenu: [
      el('p', {}, introduction),
      el('ul', { class: 'liste-erreurs' }, affichees.map((e) => el('li', {}, e))),
      erreurs.length > affichees.length ? el('p', {}, `… et ${erreurs.length - affichees.length} autre(s).`) : null,
    ],
  });
}

let minuterie = null;
export function annoncer(message, genre = 'info') {
  const zone = document.getElementById('annonces');
  if (!zone) return;
  zone.replaceChildren(el('p', { class: `annonce ${genre}` }, message));
  clearTimeout(minuterie);
  minuterie = setTimeout(() => zone.replaceChildren(), genre === 'erreur' ? 8000 : 4000);
}

// Sélection d'un fichier par l'utilisateur. accept vide = aucun filtre (repli iOS si le fichier apparaît grisé).
export function choisirFichier(accept) {
  return new Promise((resoudre) => {
    const champ = el('input', { type: 'file', accept: accept || null, hidden: true, 'data-choix-fichier': accept || 'tous' });
    champ.addEventListener('change', async () => {
      const fichier = champ.files?.[0];
      champ.remove();
      resoudre(fichier ? await fichier.text() : null);
    });
    champ.addEventListener('cancel', () => { champ.remove(); resoudre(null); });
    document.body.append(champ);
    champ.click();
  });
}
