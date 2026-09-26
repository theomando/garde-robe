// Aides partagées entre fichiers de test.

// Image PNG synthétique : fond #102030, centre 20 × 20 en #a07e56. Pour une image de 200 × 100,
// le carré mesuré (10 × 10 au centre) est entièrement dans la zone #a07e56.
export function photoSynthetique(largeur = 200, hauteur = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const contexte = canvas.getContext('2d');
  contexte.fillStyle = '#102030';
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.fillStyle = '#a07e56';
  contexte.fillRect(largeur / 2 - 10, hauteur / 2 - 10, 20, 20);
  return new Promise((resoudre) => canvas.toBlob(resoudre, 'image/png'));
}

// Dans Edge sans fenêtre en temps virtuel, les minuteries sautent dès que la page semble inactive :
// un décodage d'image ou l'ouverture d'une caméra (travail hors du fil principal) n'a pas le temps de finir.
// Une requête réseau en cours suspend le temps virtuel : on attend donc par petites requêtes
// /__attente (outils/serveur.py), qui laissent s'écouler du temps réel.
const ATTENTE = new URL('../__attente?ms=50', import.meta.url);

// Chaque tour : 50 ms réelles (requête), puis une minuterie de 25 ms qui fait avancer le temps virtuel
// (sinon les minuteries de l'app, comme l'anti double tape, ne partiraient jamais).
export async function attendreReel(condition, message = 'condition', maxMs = 15000) {
  for (let ecoule = 0; ecoule <= maxMs; ecoule += 50) {
    let valeur;
    try { valeur = condition(); } catch { valeur = null; }
    if (valeur) return valeur;
    await fetch(ATTENTE, { cache: 'no-store' });
    await new Promise((resoudre) => setTimeout(resoudre, 25));
  }
  throw new Error(`délai réel dépassé : ${message}`);
}

export async function avecTempsReel(promesse, message = 'opération', maxMs = 15000) {
  let fini = false;
  promesse.then(() => { fini = true; }, () => { fini = true; });
  await attendreReel(() => fini, message, maxMs);
  return promesse;
}
