import { test, vrai, egal, egalProfond } from './mini-test.js';
import { appliquerEtalonnage, verifierMesuresEtalonnage } from '../js/etalonnage.js';
import { lineaireDepuisOctet, octetDepuisLineaire, labDepuisRgb, chroma } from '../js/couleur.js';

test('sRGB : encodage et décodage linéaires, aller-retour exact sur les 256 niveaux, bornes', () => {
  for (let v = 0; v <= 255; v++) egal(octetDepuisLineaire(lineaireDepuisOctet(v)), v, `niveau ${v}`);
  egal(octetDepuisLineaire(-0.2), 0);
  egal(octetDepuisLineaire(1.5), 255);
});

test('étalonnage : identité quand le noir et le blanc mesurés valent les cibles (Black #111314, White #ffffff)', () => {
  const identite = { noir: [17, 19, 20], blanc: [255, 255, 255] };
  for (let v = 0; v <= 255; v += 5) {
    const rgb = [v, 255 - v, (v * 7) % 256];
    egalProfond(appliquerEtalonnage(rgb, identite), rgb, `rgb ${rgb}`);
  }
});

test('étalonnage : blanc et noir mesurés recalés exactement sur « White » et « Black » du catalogue', () => {
  const mesures = { blanc: [200, 210, 240], noir: [70, 75, 95] };
  egalProfond(appliquerEtalonnage(mesures.blanc, mesures), [255, 255, 255]);
  egalProfond(appliquerEtalonnage(mesures.noir, mesures), [17, 19, 20]);
  egalProfond(appliquerEtalonnage([0, 0, 0], mesures), [0, 0, 0], 'sous le noir mesuré : borné à 0');
  egalProfond(appliquerEtalonnage([255, 255, 255], mesures), [255, 255, 255], 'au-dessus du blanc mesuré : borné à 255');
  let precedent = -1;
  for (let v = 70; v <= 200; v += 10) {
    const [r] = appliquerEtalonnage([v, 150, 150], mesures);
    vrai(r > precedent, `croissant (${v} → ${r})`);
    precedent = r;
  }
});

test('étalonnage : un gris vu bleuté sous la torche redevient neutre', () => {
  const mesures = { blanc: [200, 210, 240], noir: [70, 75, 95] };
  // Gris à mi-chemin (en lumière) entre le noir et le blanc mesurés, canal par canal : il porte la dominante bleue.
  const vu = mesures.noir.map((k, c) => octetDepuisLineaire(lineaireDepuisOctet(k) + 0.3 * (lineaireDepuisOctet(mesures.blanc[c]) - lineaireDepuisOctet(k))));
  const avant = chroma(labDepuisRgb(vu));
  const apres = chroma(labDepuisRgb(appliquerEtalonnage(vu, mesures)));
  vrai(avant > 10, `dominante avant correction : C* ${avant.toFixed(1)}`);
  vrai(apres < 3, `presque neutre après : C* ${apres.toFixed(1)}`);
  return `C* ${avant.toFixed(1)} → ${apres.toFixed(1)}`;
});

test('étalonnage : mesures inutilisables refusées avec un message', () => {
  egal(verifierMesuresEtalonnage([220, 220, 230], [70, 70, 79]), null);
  vrai(verifierMesuresEtalonnage([100, 100, 100], [80, 80, 80]).includes('trop proches'));
  for (const noir of [[200, 70, 70], [70, 200, 70], [70, 70, 210]]) {
    vrai(verifierMesuresEtalonnage([220, 220, 230], noir).includes('trop proches'), `un seul canal trop proche suffit (${noir})`);
  }
  vrai(verifierMesuresEtalonnage([256, 0, 0], [0, 0, 0]).includes('invalides'));
  vrai(verifierMesuresEtalonnage([220, 220], [0, 0, 0]).includes('invalides'));
});
