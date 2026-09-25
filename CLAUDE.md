# Bastory — mémoire du projet (lue automatiquement par Claude)

Jeu de combat en arène, vue du dessus, style **manga / comics** (onomatopées, contours épais, couleurs vives), jouable sur mobile (appli ajoutée à l'écran d'accueil de l'iPhone) et ordinateur. En ligne jusqu'à 6 joueurs, avec bots et boss.
Le propriétaire (Quentin) parle français et n'est pas développeur : répondre en français, simplement, sans jargon.

## Règles à respecter
- **Tout réglage doit être dans la console admin** (`admin.html`) et lu en direct par le jeu. Jamais de valeur « en dur » sans champ admin.
- **Ne jamais citer le nom d'un autre jeu** (ni dans l'appli, ni dans le code, ni dans les commits). On parle de style « arcade ».
- Garder le style manga/comics, mais les effets ne doivent pas cacher les coups (onomatopées modérées).
- Ne rien casser : travailler par petites étapes, lancer `tests.html`, puis **commit + push à chaque étape** (le jeu est publié sur GitHub Pages).
- Commentaires et textes de l'interface en français.
- **Mettre ce fichier CLAUDE.md à jour à chaque demande réalisée** (fonctionnalités, règles, décisions, version de config), et le pousser avec le reste.

## Fichiers
- `index.html` : page du jeu ; charge la config en ligne (Firestore `bastory/config`), puis les scripts avec `?v=Date.now()` (évite les anciennes versions en cache sur téléphone).
- `config.js` : `CONFIG_PAR_DEFAUT` (persos, armes, modes, maps, rôles, gadgets, quêtes, rangs, skins, `app` = réglages généraux) + `migrerConfig(c)` : mises à jour numérotées (`c.version`, actuellement **23**). Toute nouvelle donnée ⇒ nouveau bloc `if ((c.version || 0) < N)` placé **après** le dernier.
- `admin.html` : console admin. Champs définis par des tableaux (`CH.perso`, `CH.arme`, `CH.mode`, `CH_JEU`…) : `[clé, libellé, type, options, aide]`. « Publier » enregistre la config dans Firestore ; le jeu l'écoute en direct (`configEnDirect`).
- `jeu.js` : tout le jeu (menus, partie, réseau Firebase Realtime DB, bots, HUD). `reglage('cle', défaut)` lit `CONFIG.app`.
- `rendu3d.js` : rendu 3D en partie (Three.js r128) ; `modele3d.js` : chargement des modèles `.glb`, menus 3D, **skins** (shader ajouté aux matériaux).
- `sons.js` : sons et musique synthétisés (Web Audio) + MP3 optionnels (`CONFIG.app.musiqueMenu / musiqueJeu`, dossier `musique/`).
- `modeles/` : modèles 3D (`element-nom.glb`, boss : `boss-nom.glb`) ; `PERSONNAGES.md` : fiches et prompts Meshy.
- `tests.html` : tests automatiques dans le navigateur (charge le jeu dans un cadre invisible). Doit afficher ✅ partout.

## Tester en local
Pas de Node sur le Mac d'origine. Lancer un petit serveur : `python3 -m http.server 8765` dans le dossier, puis ouvrir `http://localhost:8765/tests.html` (et `index.html`). Pour jouer sans compte dans le navigateur de test : dans la console, `user = { uid: 'test', displayName: 'Test' }; db = null;` puis `demarrer(...)`.

## Fonctionnalités déjà faites (ne pas refaire)
Visée précise (largeur réelle, arrêt au mur, rebonds), tir mémorisé, marteau de Rokh en 2 temps, rôles (tank, tireur, assassin, soutien, contrôle), gadgets (3/partie), bots malins (visée anticipée, esquive, se cachent), quêtes du jour (récompense au choix), saisons mensuelles + rangs, skins transformants avec aperçu gratuit, mode Survie (gaz), Assaut des tours, régénération hors combat, menu persos (Collection / Détail), sons + musique, correctifs iPhone (bande noire, son en mode silencieux).
Grande carte « 🏰 Royaume » (64×64, générée : 6 ambiances en secteurs + place neutre au centre, `map.def.biomes`, `biomeA(tx,ty)`, rendu 3D par ambiance, reconstruction 3D limitée sur les grandes cartes) et mode « Royaume » (survie ; construction (casser → matériaux `j.mat`, `construireMur`, touche F / bouton 🧱, réglages coutMur/matMur/solideMur…) ; butin (`mode.butin`, coffres → `A:arme:rareté`, `CONFIG.raretes`, `ramasser`, `multButin`, perdu au K.O.) ; atterrissage en parachute (`mode.atterrissage`, `chuteK()` / `enChute()`, intouchable et sans tir pendant la chute, parachute 3D) ; combos d'éléments (`CONFIG.combos` « a+b » triés, `comboElem`, déclenchés dans `degats` quand 2 éléments différents touchent la même cible en < `comboDelai` s) ; météo (`CONFIG.meteos`, `choisirMeteo`, `meteoMult(k)`, `dessinerMeteo`, visibilité réduite via `visible()`) ; boss mondial (`mode.bossMondial`, `majBossMondial` chez l'hôte, `b.mondial` synchronisé, lâche des armes légendaires via l'évènement `bl`) ; planche manga de fin et pass de saison en cours d'ajout).
Essais abandonnés : animations 3D calculées par le jeu (le propriétaire préfère les animations Meshy).
