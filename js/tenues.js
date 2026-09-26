// Mes tenues (demande de Théo, 2026-09-26) : instantané d'une proposition du moteur, gardé tel quel. Les couleurs
// y sont figées (hex de chaque pièce, couleurs de la combinaison) : la tenue reste juste même si un vêtement change
// ensuite ou si le catalogue Papier Tigre est retiré. Module pur, sans DOM.

// Instantané { types, combinaison, pieces, peau? } d'une proposition (voir moteur.js) pour une tenue types.
// Pièce : couleur portée (hex du vêtement, ou de la couleur manquante ; noir pour un joker manquant).
export function instantaneTenue(proposition, catalogue, types) {
  const couleur = (id) => catalogue.couleurParId.get(id);
  const { combinaison } = proposition;
  return {
    types: [...types],
    combinaison: {
      id: combinaison.id, source: combinaison.source, ref: combinaison.ref, ...(combinaison.nom ? { nom: combinaison.nom } : {}),
      couleurs: combinaison.couleurs.map((id, j) => {
        const c = couleur(id);
        return { id, nom: c.nom, hex: c.hex, ...(combinaison.roles ? { role: combinaison.roles[j] } : {}) };
      }),
    },
    pieces: proposition.pieces.map((p) => ({
      type: p.type,
      hex: p.manque ? (p.couleurId ? couleur(p.couleurId).hex : '#000000') : p.vetement.hex,
      manque: p.manque,
      joker: p.joker,
      ...(p.couleurId ? { couleurId: p.couleurId } : {}),
      ...(p.vetement ? { vetementId: p.vetement.id } : {}),
    })),
    ...(proposition.peau ? { peau: { id: proposition.peau.couleurId, nom: couleur(proposition.peau.couleurId).nom, hex: couleur(proposition.peau.couleurId).hex } } : {}),
  };
}

// Signature d'une tenue (gardée ou instantané) : mêmes types, même combinaison, mêmes vêtements et manques.
export function signatureTenue(tenue) {
  const pieces = tenue.pieces.map((p) => `${p.type}:${p.vetementId ?? ''}:${p.couleurId ?? 'joker'}:${p.manque ? 'm' : ''}`);
  return `${tenue.types.join(',')}|${tenue.combinaison.id}|${pieces.join(',')}`;
}

// Libellé d'une combinaison (du catalogue ou figée) : « Combinaison n° 12 » ; « Wada » reste dans les crédits.
export function referenceCombinaison(combinaison) {
  if (combinaison.source === 'wada') return `Combinaison ${combinaison.ref}`;
  return `Papier Tigre ${combinaison.ref}${combinaison.nom ? ` · ${combinaison.nom}` : ''}`;
}

// Pièces pour l'avatar (js/avatar.js) : { type, hex, manque }.
export function piecesAvatar(tenue) {
  return tenue.pieces.map((p) => ({ type: p.type, hex: p.hex, manque: p.manque }));
}
