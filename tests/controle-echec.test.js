// Chargé seulement avec tests.html?controle-echec : vérifie que le lanceur signale un échec.
import { test, egal } from './mini-test.js';

test('contrôle : ce test doit échouer', () => egal(1, 2));
