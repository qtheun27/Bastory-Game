# 📖 BASTORY — Fiches des personnages et des boss

Fichier de référence à compléter à chaque nouveau perso ou boss.
**Style commun** : manga / comics, chibi, grosse tête, grands yeux expressifs, aplats de couleurs, contour noir épais.

## Comment créer un modèle dans Meshy

1. **Texte → Image** : colle le « Préfixe commun » puis le prompt du perso.
2. **Image → 3D** : style **Cartoon**, **sans PBR**.
3. **Rig**, puis **Animate** : Idle, Walk, Attack (adaptée à l'arme), Hit Reaction, Dead, Stand Up, Jump, **une danse de victoire** (Dance / Victory / Cheer) et **une chute dans le vide** (Fall / Falling : jouée pendant le parachute du début des parties Royaume ; reconnue toute seule si son nom contient « fall », sinon à choisir dans « 🪂 Animation de chute »). Dans l'admin, choisis-la dans « 🕺 Animation de victoire ». Sans danse, le perso saute sur place à la fin du match.
4. **Export .glb** et nommage :
   - perso : `element-nom.glb` (par exemple `terre-bouldo.glb`) ;
   - boss : `boss-nom.glb`.
5. Dépose le fichier dans le dossier `modeles/`. Le jeu crée tout seul la fiche, l'arme, les animations et les photos de profil, puis tu règles les valeurs dans l'admin.

> **Préfixe commun (à mettre avant chaque prompt)** :
> personnage de jeu vidéo style manga comics chibi, grosse tête, grands yeux d'anime expressifs, couleurs en aplats façon cel-shading, contour noir épais, mignon mais héroïque, corps entier, pose en T avec les bras tendus à l'horizontale, vue de face, fond gris clair uni, sans texte

*Astuce : Meshy comprend un peu mieux l'anglais. Si le rendu est moins bon, fais traduire le prompt.*

---

## 🧍 Persos de base

### 🌍 ROKH — Terre
- **Description** : ours-golem en armure de roche couverte de mousse, avec des runes gravées. Lent, mais rien ne l'arrête.
- **Arme** : marteau de pierre, en deux temps. Il prend son élan (ralenti), frappe le sol juste devant lui (gros dégâts), puis des éclats de roche partent en éventail plus loin (dégâts plus faibles). La visée ne choisit que la direction.
- **Spécificité** : sa charge brise les blocs. Il ne peut pas aller dans l'eau.
- **Action** : Charge • **Super** : Séisme titan.
- **Prompt** : un petit ours golem fait de pierres taillées, mousse verte entre les roches, runes gravées sur les épaules et les genoux, cristaux jaunes dans le dos, tenant un gros marteau de pierre sanglé de cuir, couleurs brun, beige et vert mousse.

### 💨 ZEPHYR — Air
- **Description** : faucon-esprit du vent, rapide et agile, mais fragile.
- **Arme** : arc de vent, dont les flèches rapides ricochent sur les murs.
- **Spécificité** : il saute par-dessus les murs et l'eau (action Saut).
- **Action** : Saut • **Super** : Tempête de flèches.
- **Prompt** : un petit faucon esprit du vent, plumes blanches et bleu ciel, cape de vent tourbillonnante semi-transparente, carquois de flèches dans le dos, tenant un arc fait de spirales de vent, couleurs blanc, bleu ciel et or.

### 💧 NAIA — Eau
- **Description** : axolotl guerrière. Elle est très à l'aise dans l'eau.
- **Arme** : trident. Son jet d'eau repousse, puis la bulle revient vers elle.
- **Spécificité** : elle nage, va plus vite dans l'eau et s'y soigne.
- **Action** : Bulle protectrice • **Super** : Raz-de-marée.
- **Prompt** : une petite axolotl guerrière, branchies roses en plumes, peau blanche tachetée de rose et de turquoise, armure en coquillages et corail, tenant un trident doré, couleurs blanc, rose corail et turquoise.

### 🔥 PYRO — Feu
- **Description** : bébé dragon espiègle qui laisse une traînée de flammes derrière lui.
- **Arme** : boule de feu lancée en cloche, qui explose en laissant une zone enflammée.
- **Spécificité** : il brûle les buissons et ne craint pas le feu.
- **Action** : Brasier • **Super** : Souffle du dragon.
- **Prompt** : un bébé dragon orange tout rond, flamme sur la tête, ventre crème, taches rouges, petites ailes, une boule de feu dans une main, couleurs orange, rouge et jaune.

---

## 🔓 Persos à débloquer (chacun son arme, sa capacité et son action)

> Le jeu installe automatiquement l'arme, la capacité, l'action et la description dès que le fichier `.glb` est déposé, à condition de garder ces noms exacts.

### 🌍 BOULDO — Terre
- **Arme** : *Pioche à cristaux* — tir droit rapide qui fait jaillir des pics de roche à l'impact, avec une petite onde au sol.
- **Capacité** : brise les blocs en fonçant. • **Action** : Charge.
- **Prompt** : un petit tatou mineur, carapace de roche avec des cristaux ambre lumineux, casque de mineur avec une lampe, **tenant une grosse pioche dont la pointe est un cristal ambre**, couleurs brun, sable et ambre.

### 💨 NIMBUS — Air
- **Arme** : *Éventail de vent* — lance une lame de vent tournoyante, large, qui repousse fort les ennemis.
- **Capacité** : vole au-dessus des blocs et de l'eau. • **Action** : 🌪️ Tornade qui repousse tout autour.
- **Prompt** : un renard duveteux fait de nuages, longue écharpe de vent en spirale, queue de brume, **tenant un grand éventail pliant blanc et argent d'où sortent des spirales de vent**, couleurs blanc, bleu ciel et argent.

### 💧 GLOUGLOU — Eau
- **Arme** : *Canon à bulles* — bulles qui rebondissent une fois et **ralentissent** les ennemis touchés.
- **Capacité** : marche sur l'eau. • **Action** : ❄️ Souffle glacé qui ralentit les ennemis proches.
- **Prompt** : un pingouin pirate tout rond, petit tricorne, bandeau sur l'œil, marinière rayée, **tenant un gros canon à bulles en bois avec un réservoir d'eau en verre et des bulles qui s'en échappent**, couleurs bleu marine, blanc et corail.

### 🔥 BRAISE — Feu
- **Arme** : *Marteau-enclume* — lancé en cloche, il écrase le sol, fait une onde de choc et sème des braises qui brûlent.
- **Capacité** : traînée de feu. • **Action** : Brasier.
- **Prompt** : un petit lutin forgeron, tablier de cuir, fissures de lave lumineuses sur la peau, petites cornes enflammées, **tenant un marteau de forge dont la tête est une enclume chauffée à blanc**, couleurs rouge, orange et cuir sombre.

### 🌋 MAGMOR — Terre + Feu *(fusion, plus fort)*
- **Arme** : *Coulée de magma* — jet lent et large qui laisse une grande flaque de lave brûlante.
- **Capacité** : 🌋 Lave — il marche sur l'eau et brûle les buissons. • **Action** : Charge.
- **Super** : fusion Séisme titan + Souffle du dragon.
- **Prompt** : un enfant golem de lave, corps en obsidienne noire avec des fissures de magma, **un poing levé d'où coule une grosse coulée de magma orange**, petit volcan fumant sur la tête, couleurs noir, orange et jaune lumineux.

### ⛈️ STORMY — Air + Eau *(fusion, plus fort)*
- **Arme** : *Éclair en chaîne* — très rapide, il rebondit sur 2 ennemis supplémentaires (pas de trident : c'est celui de Naïa).
- **Capacité** : ⛈️ Orage — elle vole et n'est pas repoussée. • **Action** : 🌪️ Tornade.
- **Super** : fusion Tempête de flèches + Raz-de-marée.
- **Prompt** : une petite sirène de tempête assise sur un nuage de pluie, cheveux en nuages traversés d'éclairs, **tenant un petit orbe électrique dans une main d'où jaillit un éclair en zigzag**, couleurs bleu profond, violet et jaune électrique.

## 👹 Boss

### TROLL (existant)
- **Description** : troll des collines, massif et colérique.
- **Attaque** : gros coup de massue en zone, puis une charge.
- **Prompt** : boss troll chibi géant, peau verte couverte de mousse, cheveux hirsutes, grandes oreilles pointues, gourdin en bois, visage grognon et drôle, couleurs vert, brun et gris.

### KRAKEN PIRATE (proposition)
- **Description** : pieuvre géante capitaine pirate.
- **Attaque** : ses tentacules frappent en zone, et il lance de l'encre qui aveugle.
- **Arme** : sabre d'abordage et jets d'encre. 
- **Prompt** : boss pieuvre chibi géante avec un chapeau et un manteau de capitaine pirate, six énormes tentacules dont **un qui brandit un grand sabre d'abordage**, visage en colère et drôle, couleurs violet et rouge, énorme et menaçant mais mignon.

### ROI CHAMPIGNON (proposition)
- **Description** : champignon géant couronné, grincheux.
- **Attaque** : nuages de spores empoisonnés, et il invoque des mini-champignons.
- **Arme** : sceptre champignon et nuages de spores. 
- **Prompt** : boss roi champignon chibi géant, énorme chapeau rouge à pois blancs, couronne dorée, épaisse barbe de mousse, tenant un sceptre champignon, visage grincheux et drôle, couleurs rouge, blanc, vert et or, énorme et menaçant mais mignon.
