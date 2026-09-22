# 📖 BASTORY — Fiches des personnages et des boss

Fichier de référence à compléter à chaque nouveau perso ou boss.
**Style commun** : manga / comics, chibi, grosse tête, grands yeux expressifs, aplats de couleurs, contour noir épais.

## Comment créer un modèle dans Meshy

1. **Texte → Image** : colle le « Préfixe commun » puis le prompt du perso.
2. **Image → 3D** : style **Cartoon**, **sans PBR**.
3. **Rig**, puis **Animate** : Idle, Walk, Attack (adaptée à l'arme), Hit Reaction, Dead, Stand Up et Jump.
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
- **Arme** : marteau de pierre. Il frappe le sol, qui se fend et libère une onde de choc.
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

## 🔓 Persos à débloquer (propositions)

### 🌍 BOULDO — Terre
- **Description** : petit tatou mineur, casqué et cuirassé de cristaux.
- **Arme** : pioche à cristaux qui fait jaillir des pics de roche du sol.
- **Prompt** : un petit tatou mineur, carapace de roche avec des cristaux ambre lumineux, casque de mineur avec une lampe, tenant une pioche en cristal, couleurs brun, sable et ambre.

### 💨 NIMBUS — Air
- **Description** : renard fait de nuages, joueur et insaisissable.
- **Arme** : éventail de vent qui envoie des mini-tornades.
- **Prompt** : un renard duveteux fait de nuages, longue écharpe de vent en spirale, queue de brume, tenant un grand éventail pliant, couleurs blanc, bleu ciel et argent.

### 💧 GLOUGLOU — Eau
- **Description** : pingouin pirate rondouillard et farceur.
- **Arme** : canon à bulles qui ralentit les ennemis.
- **Prompt** : un pingouin pirate tout rond, petit tricorne, bandeau sur l'œil, marinière rayée, tenant un canon à bulles avec un réservoir d'eau en verre, couleurs bleu marine, blanc et corail.

### 🔥 BRAISE — Feu
- **Description** : lutin forgeron, le corps parcouru de fissures de lave.
- **Arme** : marteau-enclume enflammé qui laisse des braises au sol.
- **Prompt** : un petit lutin forgeron, tablier de cuir, fissures de lave lumineuses sur la peau, petites cornes enflammées, tenant un marteau-enclume en feu, couleurs rouge, orange et cuir sombre.

### 🌋 MAGMOR — Terre + Feu *(perso spécial à 2 éléments)*
- **Description** : enfant golem de lave. Il transforme l'eau en roche sous ses pas.
- **Arme** : coulée de magma qui brûle et casse les blocs.
- **Pouvoir fusion** : son super combine le Séisme titan et le Souffle du dragon.
- **Prompt** : un enfant golem de lave, corps en obsidienne noire avec des fissures de magma, lave qui coule des poings, petit volcan fumant sur la tête, couleurs noir, orange et jaune lumineux.

### ⛈️ STORMY — Air + Eau *(perso spécial à 2 éléments)*
- **Description** : sirène de tempête flottant sur un petit nuage.
- **Arme** : éclair qui rebondit d'ennemi en ennemi.
- **Pouvoir fusion** : son super combine la Tempête de flèches et le Raz-de-marée.
- **Prompt** : une petite sirène de tempête assise sur un nuage de pluie, cheveux en nuages traversés d'éclairs, tenant un trident crépitant d'électricité, couleurs bleu profond, violet et jaune électrique.

---

## 👹 Boss

### TROLL (existant)
- **Description** : troll des collines, massif et colérique.
- **Attaque** : gros coup de massue en zone, puis une charge.
- **Prompt** : boss troll chibi géant, peau verte couverte de mousse, cheveux hirsutes, grandes oreilles pointues, gourdin en bois, visage grognon et drôle, couleurs vert, brun et gris.

### KRAKEN PIRATE (proposition)
- **Description** : pieuvre géante capitaine pirate.
- **Attaque** : ses tentacules frappent en zone, et il lance de l'encre qui aveugle.
- **Prompt** : boss pieuvre chibi géante avec un chapeau et un manteau de capitaine pirate, six énormes tentacules dont un qui tient un sabre, visage en colère et drôle, couleurs violet et rouge, énorme et menaçant mais mignon.

### ROI CHAMPIGNON (proposition)
- **Description** : champignon géant couronné, grincheux.
- **Attaque** : nuages de spores empoisonnés, et il invoque des mini-champignons.
- **Prompt** : boss roi champignon chibi géant, énorme chapeau rouge à pois blancs, couronne dorée, épaisse barbe de mousse, tenant un sceptre champignon, visage grincheux et drôle, couleurs rouge, blanc, vert et or, énorme et menaçant mais mignon.
