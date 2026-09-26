// Partage d'une tenue (demande de Théo, 2026-09-26) : image PNG (1080 × 1350, format portrait des messageries)
// avec l'avatar habillé, les couleurs de la combinaison et la liste des vêtements, puis partage d'iOS
// (Messages, WhatsApp, Enregistrer l'image…). Couleurs d'interface de l'image : choix graphiques (comme app.css,
// mode clair) ; couleurs des vêtements et de la combinaison : celles de la tenue.

import { dessinerAvatar } from './avatar.js';

export const LARGEUR_IMAGE = 1080;
export const HAUTEUR_IMAGE = 1350;
const MARGE = 72;
const FOND = '#f2f2f7';
const CARTE = '#ffffff';
const TEXTE = '#000000';
const DISCRET = '#6e6e73';
const ALERTE = '#b3261e';
const BORD = 'rgba(0, 0, 0, 0.12)';
const POLICE = '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", sans-serif';

// Coupe un texte trop long pour la largeur donnée (points de suspension).
function ajuster(contexte, texte, largeur) {
  if (contexte.measureText(texte).width <= largeur) return texte;
  let fin = texte.length;
  while (fin > 1 && contexte.measureText(`${texte.slice(0, fin)}…`).width > largeur) fin--;
  return `${texte.slice(0, fin)}…`;
}

function chargerImage(adresse) {
  const image = new Image();
  image.src = adresse;
  return image.decode().then(() => image);
}

// params : { titre, sousTitre, peau (hex), pieces (pour l'avatar : { type, hex, manque }), couleurs ([{ hex, role? }]),
// lignes ([{ hex, joker?, type, texte, manque }]) }. Renvoie une promesse de Blob PNG.
export async function imageTenue({ titre, sousTitre, peau, pieces, couleurs, lignes }) {
  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR_IMAGE;
  canvas.height = HAUTEUR_IMAGE;
  const c = canvas.getContext('2d');
  c.fillStyle = FOND;
  c.fillRect(0, 0, LARGEUR_IMAGE, HAUTEUR_IMAGE);

  // Titre et sous-titre.
  c.fillStyle = TEXTE;
  c.textBaseline = 'alphabetic';
  c.font = `700 60px ${POLICE}`;
  c.fillText(ajuster(c, titre, LARGEUR_IMAGE - 2 * MARGE), MARGE, 150);
  c.fillStyle = DISCRET;
  c.font = `400 36px ${POLICE}`;
  if (sousTitre) c.fillText(ajuster(c, sousTitre, LARGEUR_IMAGE - 2 * MARGE), MARGE, 205);

  // Carte blanche, avatar à gauche.
  const haut = 250;
  c.fillStyle = CARTE;
  c.beginPath();
  c.roundRect(MARGE - 24, haut, LARGEUR_IMAGE - 2 * MARGE + 48, HAUTEUR_IMAGE - haut - 110, 48);
  c.fill();
  const svg = dessinerAvatar({ peau, pieces, description: titre });
  svg.setAttribute('width', '420');
  svg.setAttribute('height', String(Math.round((420 * 284) / 200)));
  const avatar = await chargerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`);
  const hauteurAvatar = (420 * 284) / 200;
  const hauteurCarte = HAUTEUR_IMAGE - haut - 110;
  c.drawImage(avatar, MARGE, haut + (hauteurCarte - hauteurAvatar) / 2, 420, hauteurAvatar); // centré dans la carte

  // À droite : bandes de la combinaison, puis les vêtements (type, puis nom et marque).
  const x = MARGE + 420 + 48;
  const largeur = LARGEUR_IMAGE - MARGE - x;
  const total = couleurs.reduce((somme, couleur) => somme + (couleur.role === 'soutien' ? 0.5 : 1), 0);
  let xBande = x;
  c.save();
  c.beginPath();
  c.roundRect(x, haut + 48, largeur, 84, 20);
  c.clip();
  for (const couleur of couleurs) {
    const l = (largeur * (couleur.role === 'soutien' ? 0.5 : 1)) / total;
    c.fillStyle = couleur.hex;
    c.fillRect(xBande, haut + 48, l + 1, 84);
    xBande += l;
  }
  c.restore();

  let y = haut + 200;
  for (const ligne of lignes) {
    c.beginPath();
    c.arc(x + 22, y - 10, 22, 0, 2 * Math.PI);
    if (ligne.joker) {
      c.save();
      c.clip();
      c.fillStyle = '#ffffff';
      c.fillRect(x, y - 32, 44, 44);
      c.fillStyle = '#000000';
      c.beginPath();
      c.moveTo(x, y - 32);
      c.lineTo(x + 44, y - 32);
      c.lineTo(x, y + 12);
      c.fill();
      c.restore();
    } else {
      c.fillStyle = ligne.hex;
      c.fill();
    }
    c.strokeStyle = BORD;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x + 22, y - 10, 22, 0, 2 * Math.PI);
    c.stroke();
    c.fillStyle = ligne.manque ? ALERTE : TEXTE;
    c.font = `600 30px ${POLICE}`;
    c.fillText(ajuster(c, ligne.manque ? `⚠ ${ligne.type}` : ligne.type, largeur - 64), x + 64, y - 16);
    c.fillStyle = ligne.manque ? ALERTE : DISCRET;
    c.font = `400 28px ${POLICE}`;
    c.fillText(ajuster(c, ligne.texte, largeur - 64), x + 64, y + 20);
    y += 88;
  }

  c.fillStyle = DISCRET;
  c.font = `500 30px ${POLICE}`;
  c.fillText('Garde-robe chromatique', MARGE, HAUTEUR_IMAGE - 50);
  return new Promise((ok, ko) => canvas.toBlob((blob) => (blob ? ok(blob) : ko(new Error('image non créée'))), 'image/png'));
}

// Partage d'iOS si possible, sinon téléchargement. Renvoie 'partage', 'annule', 'refuse' (partage refusé par le
// navigateur, par exemple faute de geste récent) ou 'telechargement'.
export async function partagerFichier(fichier, { titre, telecharger }) {
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre });
      return 'partage';
    } catch (erreur) {
      if (erreur.name === 'AbortError') return 'annule';
      if (erreur.name === 'NotAllowedError') return 'refuse';
    }
  }
  telecharger(fichier);
  return 'telechargement';
}
