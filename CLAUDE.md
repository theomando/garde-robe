# CLAUDE.md : PWA « Garde-robe chromatique » (nom provisoire)

## Objectif
PWA pour iPhone, gratuite et 100 % locale. L'utilisateur enregistre son teint et la couleur de chacun de ses vêtements, par type (scan caméra avec torche, ou choix manuel). Pour la tenue du jour (liste de types), l'app propose des combinaisons de couleurs issues d'un catalogue fusionné (Sanzō Wada et Papier Tigre), les affiche sur un avatar 2D et indique les couleurs manquantes.

## Contraintes non négociables
- Coût nul : aucun service payant, aucun compte, aucun backend. Les données utilisateur restent sur l'appareil (localStorage ou IndexedDB).
- Cible : Safari iOS, app installée sur l'écran d'accueil. HTML, CSS et JS vanilla en modules ES, sans framework ni build. Tout est servi par l'app elle-même (aucun CDN). Interface en français.
- Installable (manifest, icône) et utilisable hors ligne après la première visite (service worker qui met en cache l'app et les données de référence).
- Servie en HTTPS, car getUserMedia n'existe qu'en contexte sécurisé (MDN, page getUserMedia : « The getUserMedia() method is only available in secure contexts »).
- Hébergement statique gratuit en HTTPS : propose deux options et justifie ton choix avant de déployer. Choix de principe validé le 2026-09-24 : GitHub Pages, dépôt public, publication avec git. Repli : Cloudflare Pages (dépôt par glisser-déposer d'un dossier construit par liste blanche). Confirmation finale avant le premier déploiement.
- Partage : des amis ouvrent la même URL, chacun garde ses données en local.
- Export et import JSON de toutes les données utilisateur. Un import invalide est refusé et laisse les données intactes.
- Le catalogue Papier Tigre n'est jamais déployé : chaque appareil l'importe depuis un fichier local (Réglages) et le stocke en local. data/papier-tigre.json figure dans .gitignore (droits de redistribution non vérifiés).

## Données de référence

### Wada
- Source : colors.json du dépôt github.com/mattdesl/dictionary-of-colour-combinations, branche master, commit c142bd0 du 2020-05-27, SHA-256 555f11c32eb8133078fd470dd7d5320533aaa8b636f12fa06a8dd3d0ee2703b4. Licence MIT, « Copyright (c) 2020 Matt DesLauriers », texte complet dans data/LICENSE-wada.md. Données compilées à l'origine par Dain M. Blodorn Kim (github.com/dblodorn/sanzo-wada, MIT), à créditer aussi. Copie unique dans data/wada.json, sans modification.
- Contenu vérifié le 2026-09-23 : 159 couleurs, 348 combinaisons (identifiants 1 à 120 : 2 couleurs, 121 à 240 : 3, 241 à 348 : 4), noms et hex uniques, hex conforme à rgb.
- Reconstruire chaque combinaison en regroupant les couleurs par identifiant du champ combinations. L'ordre des couleurs dans une combinaison est celui du fichier : l'ordre du livre n'est pas récupérable.
- Identifiants : couleurs « wada-1 » à « wada-159 » (rang dans le fichier), combinaisons « wada-n1 » à « wada-n348 ». ref « n° N » : on suppose que N est le numéro du livre (vérification communautaire, issue #1 du dépôt ; aucune source primaire).
- Recalculer tous les Lab depuis rgb avec la conversion de l'app. Le champ lab du fichier est calculé depuis cmyk (profil U.S. Web Coated SWOP v2, illuminant D50 ; README et src/augment_sanzo.py du dépôt) et s'écarte de rgb jusqu'à ΔE76 18 pour des cyans hors du gamut sRGB.
- Noms laissés en anglais, sans traduction. Anomalies connues gardées telles quelles (copie fidèle) : 4 CMYK signalés faux (issue #1), coquille « Calamine BLue » (PR #2).

### Papier Tigre (Color Inspiration, volumes 1 à 3)
- Aucune version numérique connue. Livres autoédités par Papier Tigre ; chaque fiche produit annonce 450 harmonies, 150 destinations et les coordonnées CMJN et RVB de chaque couleur (papiertigre.fr). data/papier-tigre.json est saisi à la main depuis les livres (RVB imprimés). L'app fonctionne sans ce fichier ou avec un fichier partiel.
- Structure constatée sur le livre (p. 30, harmonie « Angkor, Cambodge ») : chaque harmonie porte un nom, un pays et un numéro de page, avec 3 couleurs « Dominantes » et 3 « Soutiens », chacune imprimée en CMJN et en RVB. Hypothèse non vérifiée : une destination par double page, les « 450 combinaisons » comptant 3 paires dominante-soutien par destination, soit environ 150 harmonies et 900 couleurs par volume. Le format ci-dessous ne dépend pas de cette hypothèse.
- Format du fichier saisi :
  `{ "format": "papier-tigre", "version": 1, "harmonies": [ { "volume": 1, "page": 30, "nom": "Angkor", "pays": "Cambodge", "dominantes": [[r, v, b], …], "soutiens": [[r, v, b], …], "cmjn": { "dominantes": [[c, m, j, n], …], "soutiens": [[c, m, j, n], …] } } ] }`
  Règles : volume de 1 à 3 ; page entière ≥ 1 ; couple (volume, page) unique ; 1 à 3 dominantes ; 0 à 3 soutiens ; 2 à 6 couleurs au total ; RVB entiers de 0 à 255 ; nom non vide ; pays facultatif ; cmjn facultatif (mêmes longueurs, entiers de 0 à 100), conservé pour contrôle de saisie, jamais utilisé en calcul.
- Conversion vers le catalogue fusionné : combinaison « papier-tigre-v1-p30 », ref « vol. 1, p. 30 », nom « Angkor (Cambodge) » ; couleurs « papier-tigre-v1-p30-d1 » à « -d3 » et « -s1 » à « -s3 », nommées « Angkor, dominante 1 », etc. ; hex dérivé du RVB ; rôles « dominante » ou « soutien ».
- Validateur : un seul module (js/papier-tigre.js), utilisé par l'import des Réglages et par la page outils/validateur.html. Erreurs : schéma, RVB, doublon (volume, page), nombres de couleurs. Avertissement : même RVB deux fois dans une harmonie.
- Ne pas transmettre ce fichier à d'autres personnes : ce serait une redistribution.

### Schéma du catalogue fusionné
- couleur : id (préfixé par la source), nom, hex, source ("wada" ou "papier-tigre")
- combinaison : id, source, ref (ex. "n° 198" ou "vol. 1, p. 57"), nom (facultatif), couleurs (liste de 2 à 6 id), roles (liste optionnelle de "dominante" ou "soutien", termes du livre, de même longueur que couleurs)

### Teint : Monk Skin Tone Scale
Monk, Ellis. « Monk Skin Tone Scale », 2019. https://skintone.google. Licence CC BY 4.0. MST 1 à 10 : #f6ede4, #f3e7db, #f7ead0, #eadaba, #d7bd96, #a07e56, #825c43, #604134, #3a312a, #292420. Valeurs vérifiées le 2026-09-23 : identiques sur skintone.google/get-started, dans les fichiers officiels « MST Swatches.zip » et sur Wikipédia. Le site publie aussi le Lab (D65, 3 décimales) de chaque teinte : ces valeurs servent de test à la conversion hex → Lab.

### Données utilisateur
- vêtement : id, type, hex, origine ("scan" ou "manuel"), idCouleurCatalogue (optionnel), dateAjout (ISO 8601)
- réglages : mst (1 à 10), teintActif (booléen), tolerance (1 à 30, pas de 0,5), favoris (liste d'id de couleurs), etalonnage (facultatif : { torche?, sans-torche?, photo? : { blanc: [r, v, b], noir: [r, v, b], date } }, mesures brutes)
- tenuesTypes : ensembles de types déjà demandés (base des statistiques), enregistrés quand l'utilisateur touche « Proposer », sans doublon.
- Choix manuel (bijoux compris) : uniquement dans le catalogue ; hex et idCouleurCatalogue sont copiés depuis la couleur choisie. Pas de saisie libre.
- Après « Ajuster » : hex prend la valeur de la couleur choisie, idCouleurCatalogue son id, origine reste « scan ».
- Stockage : localStorage, deux clés préfixées « garde-robe: » (état utilisateur ; catalogue Papier Tigre). Une seule écriture par clé.
- Export : état utilisateur seulement, sans le catalogue Papier Tigre : `{ format, version, dateExport, vetements, reglages, tenuesTypes }`. Les favoris et idCouleurCatalogue qui visent Papier Tigre sont exportés tels quels.
- Import : validation complète en mémoire, puis remplacement total en une écriture. Champ inconnu ou version plus récente : refus.

## Types de vêtements
Constante unique, extensible : chaussures, pantalon, short, ceinture, t-shirt, chemise, pull, veste, manteau, chapeau, bijoux. Une tenue contient au plus une pièce par type et un seul bas (pantalon ou short).

## Colorimétrie (module pur, sans DOM, testé)
- hex → sRGB (IEC 61966-2-1 : décodage avec seuil 0,04045, pente 12,92, exposant 2,4 ; matrice à 4 décimales 0,4124 0,3576 0,1805 / 0,2126 0,7152 0,0722 / 0,0193 0,1192 0,9505, reprise dans l'article Wikipédia « sRGB ») → XYZ (D65 ; blanc de référence = matrice × (1, 1, 1), pour que #ffffff donne exactement L* = 100, a* = b* = 0) → CIELAB (fonction f de la CIE, seuil (6/29)³) → ΔE00 (CIEDE2000, kL = kC = kH = 1).
- Validation : les 34 paires de test de Sharma, Wu et Dalal (2005, Color Research and Application 30(1), p. 21-30), fichier dataNprograms/ciede2000testdata.txt sur https://www.hajim.rochester.edu/ece/~gsharma/ciede2000/ (l'ancienne adresse www.ece.rochester.edu redirige), écart ≤ 1e-4. Conversion hex → Lab : invariants (blanc, noir, 256 gris) et Lab des 10 teintes MST publiés par skintone.google.
- Couverture : un vêtement couvre une couleur du catalogue si ΔE00 ≤ tolérance. Tolérance par défaut 10, réglable de 1 à 30 par pas de 0,5 (valeurs non sourcées, à calibrer).
- Jokers : un vêtement est noir si L* ≤ 20 et C*ab ≤ 8, blanc si L* ≥ 90 et C*ab ≤ 8 (seuils de départ en constantes nommées, à calibrer). Les teintes MST 1 et 2 passent le seuil « blanc » et MST 10 le seuil « noir » : sans effet sur la peau, qui n'est jamais un joker, mais un vêtement beige très clair compte comme blanc.

## Moteur de propositions (module pur, testé)
Entrées : types de la tenue, garde-robe, catalogue, réglages.
1. Pièces visibles : appliquer les règles d'occultation (section Avatar). Une pièce masquée sort du calcul et du rendu.
2. Pour chaque combinaison, chaque pièce visible reçoit une couleur de la combinaison ou « joker ». Chaque couleur obligatoire est portée par au moins une pièce. Couleurs obligatoires : les « dominante » quand la combinaison a des rôles, toutes ses couleurs sinon (cas de Wada). Une couleur « soutien » est facultative : elle peut être portée, sans obligation. Une couleur peut couvrir plusieurs pièces, une pièce ne porte qu'une couleur.
3. Teint actif : la peau est une pièce virtuelle toujours visible. Elle couvre au plus une couleur, seulement si ΔE00(teint, couleur) ≤ tolérance, et ne compte jamais comme manque.
4. Manque : pièce dont le type n'a dans la garde-robe aucun vêtement couvrant la couleur affectée (aucun vêtement noir ou blanc si l'affectation est « joker »). Un manque se note (type, couleur) ou (type, joker).
5. Coût d'une pièce : couleur couverte = plus petit ΔE00 parmi les vêtements du type qui la couvrent ; joker disponible = tolérance (constante COUT_JOKER, pour que le joker reste un repli) ; manque = 0 ; peau sur une couleur = ΔE00(teint, couleur). Retenir l'affectation qui minimise, dans l'ordre : le nombre de manques ; puis la peau non utilisée (la peau porte une couleur dès que possible) ; puis le nombre de manques affectés à une couleur plutôt qu'au joker ; puis la somme des coûts. Ex æquo : affectation la plus petite dans l'ordre des TYPES puis la peau, options dans l'ordre des couleurs de la combinaison puis joker (ou « aucune » pour la peau). Écarter la combinaison au-delà de 2 manques, ou si ses couleurs obligatoires sont plus nombreuses que les pièces visibles (peau comprise quand elle peut couvrir une couleur obligatoire).
6. ΔE00 moyen = somme des coûts divisée par le nombre de pièces qui portent une couleur couverte, un joker, ou (peau) une couleur. Les manques sont exclus. Affiché « — » si ce nombre vaut 0. Tri : manques croissants, puis peau utilisée d'abord (teint actif), puis nombre de couleurs de la combinaison présentes dans les favoris (décroissant), puis ΔE00 moyen croissant, puis Wada avant Papier Tigre, puis ordre du catalogue. Le filtre « avec mes favoris » (au moins une couleur favorite) s'applique avant la coupe. Au plus 20 propositions affichées, chacune avec sa source et sa référence.
7. Budget : calcul complet (Wada et Papier Tigre) en moins d'une seconde sur l'iPhone de référence (iPhone 13 Pro). Algorithme retenu : programmation dynamique exacte sur l'ensemble des couleurs obligatoires déjà portées (au plus 2⁶ = 64 états), une passe par pièce visible puis une pour la peau ; coûts en entiers de micro-ΔE pour des comparaisons exactes. Les ΔE00 vêtement × couleur sont mis en cache par vêtement. Contrôle par énumération exhaustive dans les tests. Justification : exact, au plus (pièces + 1) × 64 × 7 opérations par combinaison ; la force brute coûte 7¹⁰ affectations par combinaison, l'algorithme hongrois impose de réduire les critères à un seul nombre, et aucun solveur n'est disponible sans bibliothèque.
8. Tenue invalide (pantalon et short ensemble) : erreur du moteur ; dans l'interface, cocher l'une des deux cases décoche l'autre.

## Favoris et statistiques
- Favori : étoile sur une couleur du catalogue (sélecteur de catalogue, dépliant « Ajuster », propositions). Effet : critère de tri et filtre « avec mes favoris ».
- Manques fréquents : pour chaque tenue type enregistrée, recalculer les propositions retenues (toutes les combinaisons non écartées, sans filtre ni coupe) avec la garde-robe et les réglages courants, et compter leurs manques par (couleur, type). Afficher le top 10 : pastille, nom, type, nombre de propositions concernées. Manque joker : nom « Noir ou blanc », pastille noire et blanche. Ex æquo : ordre du catalogue (joker en dernier), puis ordre des TYPES.

## Scan de couleur
- Caméra arrière via getUserMedia (facingMode "environment"), demandée seulement quand l'utilisateur touche « Scanner ». Un seul flux par session de scan ; track.stop() en quittant le scan et sur visibilitychange (hidden). Aucune navigation par # (WebKit bug 215884 : un changement de hash coupait le flux et l'autorisation). iOS peut redemander l'autorisation à chaque lancement (WebKit bug 280394, ouvert).
- Torche (Safari 17.4 et suivants, seulement si l'appareil en a une) via applyConstraints({ advanced: [{ torch: true }] }) quand getCapabilities().torch vaut true. Elle peut s'éteindre si la configuration change (ne plus toucher résolution ni zoom) ou être refusée sans erreur (surchauffe).
- Repli si torche absente ou caméra refusée : input type="file" accept="image/*" capture="environment". Vérifier sur l'appareil si l'interface photo d'iOS propose alors le flash. Photo prise : JPEG ; image de la photothèque : HEIC possible (iOS 26.4 et suivants) ; décoder avec createImageBitmap sans supposer le format.
- Mesure : médiane par canal d'un carré central (côté 10 % du plus petit côté de l'image, constante) matérialisé par un réticule, pixels saturés exclus (un canal ≥ 250, constante). Moins de la moitié de pixels valides : « reflet trop fort, recommencez ». Canvas et getImageData en sRGB.
- Balance des blancs : whiteBalanceMode existe sous WebKit depuis Safari 17.4 ('manual' la verrouille). Si getCapabilities() le propose, la verrouiller après un délai fixe sous la torche (constante), revenir à 'continuous' en quittant. L'exposition ne peut pas être verrouillée (exposureMode absent de WebKit) : la mesure reste approximative.
- Piège documenté : getSettings().torch renvoyait des valeurs périmées sous iOS 18.0 à 18.3 (WebKit bug 280970, corrigé en 18.4). Garder quand même l'état de la torche côté app.
- Après mesure : demander le type (prérempli si l'ajout part d'une section), afficher la couleur scannée et la conserver par défaut. Bouton « Ajuster » : dépliant cliquable des 12 couleurs du catalogue les plus proches (ΔE00 croissant), extensible au catalogue complet.
- Bijoux : choix manuel dans le catalogue, sans scan.
- Après la mesure, trois étapes (demande de Théo, 2026-09-26) : « Couleur mesurée » avec « Veux-tu ajuster la couleur ? » (Oui / Non) ; si oui, « Ajuster la couleur » (rangée « Noir, gris et blanc » : neutres du catalogue à C* ≤ NEUTRE_C_MAX, puis les 12 plus proches, puis tout le catalogue) ; enfin « Type de vêtement ». Retour à chaque étape.
- Constat sur iPhone 13 Pro (2026-09-26) : un vêtement noir sort bleuté avec la torche et gris sans, car l'exposition est automatique et non verrouillable, et la torche est froide.
- Étalonnage (demande de Théo, 2026-09-26) : dans Réglages, un vêtement entièrement blanc puis un entièrement noir sont scannés une fois, dans les conditions habituelles. Correction par deux points, canal par canal, en sRGB linéaire : le noir mesuré devient « Black » (#111314), le blanc mesuré « White » (#ffffff), couleurs du catalogue Wada. Un étalonnage par façon de mesurer (torche, sans torche, photo), car l'exposition diffère. La mesure brute reste affichée à côté de la couleur corrigée. Écart minimal blanc-noir par canal : ETALONNAGE_ECART_MIN (30 sur 255, à calibrer). Gain attendu surtout pour les neutres ; approximatif pour les couleurs vives (à vérifier sur l'iPhone).

## Avatar
- SVG 2D en style figurine à blocs (demande de Théo, 2026-09-26, d'après des exemples de minifigurines ; dessin original, sans marque) : tête cylindrique à plot avec yeux et sourire (traits clairs sur peau foncée), torse en trapèze, mains en pince, hanches et jambes en blocs, reflets clairs. Peau à la teinte MST choisie (même si le teint est inactif dans les combinaisons), une zone par type ; les vêtements ouverts sont « imprimés » sur le torse.
- Couches, du corps vers l'extérieur : t-shirt, pull, chemise, veste, manteau.
- Le pull masque le t-shirt. La chemise est toujours portée ouverte : jamais masquée, elle laisse voir la couche du dessous (bande centrale). Veste et manteau sont aussi portés ouverts. Ceinture, chapeau et bijoux sont toujours visibles. Couches et occultations sont rangées dans une table (js/constantes.js).
- Pièce couverte : dessinée avec le hex du vêtement retenu (plus petit ΔE00, puis le plus ancien). Joker : noir avant blanc. Pièce en manque : hachurée dans la couleur manquante ; manque joker : hachures noires et blanches.
- Proposition n° 1 sélectionnée par défaut. Toucher une proposition met l'avatar à jour.

## Écrans
1. Premier lancement : 10 pastilles MST (choix obligatoire) et interrupteur « teint dans les combinaisons » (désactivé par défaut). Hors mode installé : inviter à installer l'app avant de saisir, car le stockage de l'app installée est séparé de celui de Safari.
2. Garde-robe : liste par type, ajout (scan ou manuel), édition, suppression.
3. Tenue du jour : cases des types (pantalon et short exclusifs), bouton « Proposer », avatar, propositions, filtre favoris. Cases préremplies avec la dernière tenue type ; repliées après « Proposer » ; avatar fixe en haut pendant le défilement ; la proposition touchée affiche son détail (vêtement à porter pour chaque pièce, manques, peau) et les étoiles de ses couleurs.
4. Manques fréquents.
5. Réglages : teint, interrupteur, tolérance, favoris, import du catalogue Papier Tigre, export et import des données, crédits (Wada via mattdesl et dblodorn sous MIT ; Monk, Ellis, « Monk Skin Tone Scale », 2019, sous CC BY 4.0 ; Papier Tigre, Color Inspiration).
- Composant commun : sélecteur de catalogue (couleurs par source, étoile, recherche par nom), utilisé par le choix manuel, « Ajuster > tout le catalogue » et Réglages > Favoris.
- Navigation : barre d'onglets Garde-robe, Tenue, Manques, Réglages, sans # dans l'URL. Confirmations par <dialog>, pas par confirm() (comportement en mode installé non vérifié).

## PWA sur iOS (vérifié le 2026-09-23)
- Le stockage d'une web app installée est séparé de celui de Safari (WebKit bug 181849) et n'est pas soumis à la limite de 7 jours (blog WebKit, 24/03/2020). Appeler navigator.storage.persist() au premier lancement ; rappeler d'exporter.
- Export : navigator.share({ files }) ; repli <a download> (en mode installé, iOS affiche un aperçu, WebKit bug 275288) ; dernier repli : zone de texte à copier. Import : accept=".json,application/json", plus un bouton sans filtre.
- Service worker à la racine (./sw.js), cache versionné, précache avec { cache: 'reload' } ; data/papier-tigre.json, tests/ et outils/ jamais précachés ; bandeau « Nouvelle version, recharger ».
- Icônes : apple-touch-icon PNG 180×180 (prioritaire sur le manifest), icônes du manifest 192, 512 et 1024 (purpose any) ; display: standalone.
- Chemins relatifs partout (site servi sous /garde-robe/ sur GitHub Pages ; origine partagée avec les autres sites du compte, d'où les clés préfixées).
- À tester sur l'iPhone 13 Pro (étape déploiement) : installation, hors ligne, autorisation caméra, torche, balance des blancs, flash du repli, export et import, persist(), mise à jour du service worker, budget < 1 s (outils/bench.html).

## Méthode de travail
- Avant de coder : arborescence et plan d'étapes, chacune avec un critère de fin vérifiable. Attendre validation.
- Ordre : socle et harnais de test, colorimétrie et tests, catalogue, moteur et tests, garde-robe, scan, tenue et avatar, statistiques, PWA et déploiement. Arrêts pour validation : après la colorimétrie, après le moteur, avant le déploiement.
- Tests : Node est absent de la machine. Page tests/tests.html, lancée par tests/lancer-tests.ps1 (serveur outils/serveur.py sur 127.0.0.1, Edge sans fenêtre avec --virtual-time-budget et --dump-dom, ligne « RESULTAT ok/total », code de sortie non nul en cas d'échec). Mesures de temps dans outils/bench.html, car le mode sans fenêtre virtualise le temps. Edge est lancé avec une caméra simulée (--use-fake-device-for-media-stream, --use-fake-ui-for-media-stream, sans torche). Le temps virtuel ne compte ni les décodages d'image ni l'ouverture de la caméra : ces attentes passent par tests/aides.js (attendreReel, avecTempsReel), qui interrogent /__attente (outils/serveur.py) pour laisser s'écouler du temps réel. createImageBitmap ne se termine jamais dans ce mode : les photos sont décodées par <img>. Chaque test est borné à 20 s et la page affiche sa progression.
- Git : un commit par étape terminée, envoyé sur https://github.com/theomando/garde-robe (dépôt public depuis le 2026-09-24, adresse d'auteur privée 186628105+theomando@users.noreply.github.com). Site GitHub Pages activé le 2026-09-26 à la demande de Théo, pour travailler directement sur l'iPhone : https://theomando.github.io/garde-robe/ (vérifié : pages en 200, data/papier-tigre.json et notes en 404). Chaque envoi met le site à jour ; bouton Réglages > « Charger la dernière version » contre le cache de 10 min. Service worker, manifest et icônes restent pour l'étape déploiement.
- Demande contraire à une contrainte non négociable : le signaler et demander confirmation avant d'agir.
- Information manquante (structure Papier Tigre, comportement iOS non vérifié) : le dire et proposer une hypothèse explicite. Toute valeur de couleur provient d'une source nommée (fichier de données ou mesure). Les couleurs de l'interface (texte, fonds, contours) sont des choix graphiques, regroupés dans des variables CSS nommées ; le joker utilise #000000 et #ffffff (bornes du codage sRGB).

## Cas limites à couvrir par des tests
- Garde-robe vide : aucune proposition retenue au-delà de 2 pièces visibles, message qui invite à ajouter des vêtements.
- Tenue chaussures, pantalon, ceinture, t-shirt, pull : t-shirt exclu du calcul et non dessiné.
- Combinaison de 4 couleurs, 2 pièces visibles, teint inactif : écartée.
- Harmonie Papier Tigre (3 dominantes, 3 soutiens), 4 pièces visibles, teint inactif : évaluée et non écartée, car seules les 3 dominantes doivent être portées.
- Teint actif et couleur de combinaison à ΔE00 ≤ tolérance du teint : la peau la couvre et la proposition passe devant à manques égaux.
- Seul pantalon possédé noir : il occupe le bas sans créer de manque (joker) dans toute proposition où les autres pièces (et la peau) suffisent à porter les couleurs obligatoires. Contre-exemple attendu : tenue [pantalon, t-shirt] et combinaison de 2 couleurs, le pantalon porte une couleur et crée un manque.
- Pièce en manque qui ne porte aucune couleur obligatoire : notée (type, joker), et un vêtement possédé qui couvre une couleur est préféré au joker.
- Tolérance exactement égale au ΔE00 : la couleur est couverte (≤ inclusif).
- Une seule pièce visible et une combinaison de 2 couleurs : retenue seulement si la peau porte l'une d'elles.
- Plus de 2 manques : combinaison écartée.
- Joker disponible en noir et en blanc : l'avatar dessine le noir.
- Pantalon et short cochés ensemble : erreur « tenue invalide ».
- Torche indisponible ou caméra refusée : repli sans blocage.
- Import JSON invalide : refusé, données intactes (y compris si l'écriture échoue).
