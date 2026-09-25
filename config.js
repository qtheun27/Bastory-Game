// ⚙️ DONNÉES DU JEU — config de secours (la version en ligne est dans Firebase, éditable via admin.html)
// 🎨 Ambiances de map : couleurs + styles 3D (murs, buissons, sol, eau, ciel)
const THEMES = {
  "campagne": {
    "nom": "🌾 Campagne",
    "sol": "#6fcf57",
    "sable": "#e9d18f",
    "mur": "#a9a79c",
    "palette": [
      "#b9b39f",
      "#8f9ca3",
      "#9fb38a"
    ],
    "murStyle": "pierre",
    "buisson": "#3fae4a",
    "buissonStyle": "touffe",
    "eau": "#3aa6e0",
    "ext": "#4f9a45",
    "ciel": "#9fdcff",
    "coffre": "#c98a45"
  },
  "ville": {
    "nom": "🏙️ Ville",
    "sol": "#c3c8d2",
    "sable": "#e8dcc0",
    "mur": "#d9644a",
    "palette": [
      "#4a8fe0",
      "#f2b63d",
      "#8e6ad8",
      "#e05a8a"
    ],
    "murStyle": "brique",
    "buisson": "#3a9e52",
    "buissonStyle": "haie",
    "eau": "#39b6e8",
    "ext": "#7d8594",
    "ciel": "#bfe6ff",
    "coffre": "#5a7bd0",
    "solStyle": "pave"
  },
  "desert": {
    "nom": "🏜️ Désert",
    "sol": "#f0c77c",
    "sable": "#f7dca3",
    "mur": "#d98b4a",
    "palette": [
      "#c9733b",
      "#e6a55c",
      "#b85e34"
    ],
    "murStyle": "gres",
    "buisson": "#5fae4a",
    "buissonStyle": "cactus",
    "eau": "#29c4c9",
    "ext": "#d9a45a",
    "ciel": "#ffe3a8",
    "coffre": "#b07a3a"
  },
  "neige": {
    "nom": "❄️ Neige",
    "sol": "#eef6ff",
    "sable": "#d6e6f5",
    "mur": "#8fb7d9",
    "palette": [
      "#b9d7f0",
      "#7fa3c8",
      "#a8c8e8"
    ],
    "murStyle": "glace",
    "buisson": "#2f7d5a",
    "buissonStyle": "sapin",
    "eau": "#5ab8e8",
    "ext": "#dbe9f5",
    "ciel": "#dff1ff",
    "coffre": "#8e6a4a"
  },
  "plage": {
    "nom": "🏝️ Plage",
    "sol": "#7fd65f",
    "sable": "#f4d68e",
    "mur": "#b0824f",
    "palette": [
      "#8a6038",
      "#c79a62"
    ],
    "murStyle": "bois",
    "buisson": "#35b54f",
    "buissonStyle": "touffe",
    "eau": "#2fc2f0",
    "ext": "#f4d68e",
    "ciel": "#9fe6ff",
    "coffre": "#c98a45"
  },
  "volcan": {
    "nom": "🌋 Volcan",
    "sol": "#7a6560",
    "sable": "#9a7a62",
    "mur": "#4a3f48",
    "palette": [
      "#5e4658",
      "#3a3440"
    ],
    "murStyle": "pierre",
    "buisson": "#d0602a",
    "buissonStyle": "cactus",
    "eau": "#ff6a1a",
    "lave": true,
    "ext": "#3a2a2a",
    "ciel": "#ffb07a",
    "coffre": "#7a5a3a"
  }
};
const themeDe = d => ({ ...THEMES.campagne, ...(THEMES[d && d.theme] || {}) });

const CONFIG_PAR_DEFAUT = {
  "persos": [
    {
      "image": "",
      "imageCarte": "",
      "munitions": 3,
      "recharge": 55,
      "modeleEchelle": 1,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": "",
      "nom": "ROKH",
      "element": "terre",
      "couleur": "#b7791f",
      "arme": "rocher",
      "pvMax": 8500,
      "vitesse": 3,
      "degats": 2000,
      "portee": 300,
      "delaiTir": 55,
      "modele": "modeles/rokh.glb"
    },
    {
      "image": "",
      "imageCarte": "",
      "munitions": 3,
      "recharge": 55,
      "modeleEchelle": 1.2,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": "",
      "nom": "ZEPHYR",
      "element": "air",
      "couleur": "#7dd3fc",
      "arme": "vent",
      "pvMax": 3800,
      "vitesse": 4.6,
      "degats": 950,
      "portee": 520,
      "delaiTir": 20,
      "modele": "modeles/zephyr.glb"
    },
    {
      "image": "",
      "imageCarte": "",
      "munitions": 3,
      "recharge": 55,
      "modeleEchelle": 1,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": "",
      "nom": "NAIA",
      "element": "eau",
      "couleur": "#3b82f6",
      "arme": "trident",
      "pvMax": 5400,
      "vitesse": 4,
      "degats": 1250,
      "portee": 400,
      "delaiTir": 28,
      "modele": "modeles/naia.glb"
    },
    {
      "image": "",
      "imageCarte": "",
      "munitions": 3,
      "recharge": 55,
      "modeleEchelle": 1,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": "",
      "nom": "PYRO",
      "element": "feu",
      "couleur": "#f97316",
      "arme": "boulefeu",
      "pvMax": 5000,
      "vitesse": 4.1,
      "degats": 1600,
      "portee": 360,
      "delaiTir": 34,
      "modele": "modeles/pyro.glb"
    },
    {
      "nom": "WIXY",
      "image": "images/wixy.png",
      "couleur": "#3498db",
      "pvMax": 6000,
      "vitesse": 3.4,
      "arme": "bombe",
      "degats": 2000,
      "portee": 300,
      "delaiTir": 45,
      "imageCarte": "",
      "munitions": 3,
      "recharge": 60,
      "element": "feu",
      "modele": "",
      "modeleEchelle": 1,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": ""
    },
    {
      "nom": "BORA",
      "image": "images/bora.png",
      "couleur": "#9b59b6",
      "pvMax": 4800,
      "vitesse": 4.3,
      "arme": "boomerang",
      "degats": 1250,
      "portee": 450,
      "delaiTir": 22,
      "imageCarte": "",
      "munitions": 3,
      "recharge": 45,
      "element": "terre",
      "modele": "",
      "modeleEchelle": 1,
      "modeleRotation": 0,
      "animRepos": "",
      "animMarche": "",
      "animAttaque": ""
    }
  ],
  "armes": {
    "bombe": {
      "nom": "Bombe",
      "image": "images/bombe.png",
      "type": "lob",
      "effet": "explosion",
      "vitesse": 9,
      "taille": 18,
      "rayon": 80,
      "couleur": "#ff9f1a",
      "forme": "zone",
      "nbCases": 3,
      "typeCase": "#",
      "dureeCase": 5,
      "delaiCase": 4
    },
    "boomerang": {
      "nom": "Boomerang",
      "image": "images/boomerang.png",
      "type": "retour",
      "effet": "entaille",
      "vitesse": 11,
      "taille": 18,
      "rayon": 0,
      "couleur": "#9cff57",
      "forme": "zone",
      "nbCases": 3,
      "typeCase": "#",
      "dureeCase": 5,
      "delaiCase": 4
    },
    "tir": {
      "nom": "Tir magique",
      "image": "",
      "type": "droit",
      "effet": "etincelle",
      "vitesse": 13,
      "taille": 10,
      "rayon": 0,
      "couleur": "#ffe14a",
      "forme": "zone",
      "nbCases": 3,
      "typeCase": "#",
      "dureeCase": 5,
      "delaiCase": 4
    },
    "seisme": {
      "nom": "Séisme",
      "image": "",
      "type": "terrain",
      "effet": "impact",
      "vitesse": 10,
      "taille": 16,
      "rayon": 0,
      "couleur": "#c98a4b",
      "forme": "mur",
      "nbCases": 3,
      "typeCase": "#",
      "dureeCase": 5,
      "delaiCase": 4
    },
    "ricochet": {
      "nom": "Laser ricochet",
      "image": "",
      "type": "droit",
      "effet": "etincelle",
      "vitesse": 14,
      "taille": 10,
      "rayon": 0,
      "couleur": "#5ad1ff",
      "rebonds": 3,
      "bonusRebond": 1.25,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350
    },
    "eclair": {
      "nom": "Éclair chercheur",
      "image": "",
      "type": "droit",
      "effet": "foudre",
      "vitesse": 13,
      "taille": 10,
      "rayon": 0,
      "couleur": "#ffe14a",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 3,
      "perteChaine": 0.7,
      "porteeChaine": 350
    },
    "fumigene": {
      "nom": "Grenade fumigène",
      "image": "",
      "type": "lob",
      "effet": "fumee",
      "vitesse": 9,
      "taille": 16,
      "rayon": 70,
      "couleur": "#9aa0a6",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0,
      "poisonDuree": 0,
      "nuage": 5,
      "rayonNuage": 95,
      "degatsNuage": 250
    },
    "dard": {
      "nom": "Dard empoisonné",
      "image": "",
      "type": "droit",
      "effet": "poison",
      "vitesse": 14,
      "taille": 10,
      "rayon": 0,
      "couleur": "#7dff4a",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0.5,
      "poisonDuree": 4,
      "nuage": 0,
      "rayonNuage": 90,
      "degatsNuage": 0
    },
    "rocher": {
      "nom": "Marteau de pierre",
      "image": "",
      "type": "lob",
      "effet": "impact",
      "vitesse": 7.5,
      "taille": 20,
      "rayon": 90,
      "couleur": "#a07850",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0,
      "poisonDuree": 0,
      "nuage": 0,
      "rayonNuage": 90,
      "degatsNuage": 0,
      "onde": 150,
      "recul": 10,
      "forme": "onde"
    },
    "vent": {
      "nom": "Arc de vent",
      "image": "",
      "type": "droit",
      "effet": "etincelle",
      "vitesse": 15,
      "taille": 9,
      "rayon": 0,
      "couleur": "#bdf2ff",
      "rebonds": 2,
      "bonusRebond": 1.15,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0,
      "poisonDuree": 0,
      "nuage": 0,
      "rayonNuage": 90,
      "degatsNuage": 0,
      "forme": "fleche"
    },
    "trident": {
      "nom": "Trident",
      "image": "",
      "type": "retour",
      "effet": "eclaboussure",
      "vitesse": 12,
      "taille": 16,
      "rayon": 0,
      "couleur": "#3aa6ff",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0,
      "poisonDuree": 0,
      "nuage": 0,
      "rayonNuage": 90,
      "degatsNuage": 0,
      "recul": 16,
      "forme": "bulle"
    },
    "boulefeu": {
      "nom": "Boule de feu",
      "image": "",
      "type": "lob",
      "effet": "explosion",
      "vitesse": 10,
      "taille": 16,
      "rayon": 75,
      "couleur": "#ff6a00",
      "rebonds": 0,
      "bonusRebond": 1.2,
      "chaine": 0,
      "perteChaine": 0.7,
      "porteeChaine": 350,
      "retard": 0,
      "poisonDuree": 0,
      "nuage": 3,
      "rayonNuage": 70,
      "degatsNuage": 300,
      "forme": "feu"
    }
  },
  "maps": [
    {
      "nom": "Clairière",
      "herbe1": "#5cc24a",
      "herbe2": "#52b442",
      "mur": "#c98a4b",
      "murFace": "#8e5a2b",
      "buisson": "#2fae4a",
      "buissonFonce": "#1f7a35",
      "eau": "#3aa6e0",
      "grille": [
        "##############################",
        "#............BBBB............#",
        "#..BBB..................BBB..#",
        "#..B...C.##........##.....B..#",
        "#........##..WWWW..##........#",
        "#............WWWW............#",
        "#....###..............###....#",
        "#....#......BB..BB......#....#",
        "#.BB........BZZZZB........BB.#",
        "#.P.T..##...ZZCZZZ...##....E.#",
        "#......##...ZZZCZZ...##..T...#",
        "#.BB........BZZZZB........BB.#",
        "#....#......BB..BB......#....#",
        "#....###..............###....#",
        "#............WWWW............#",
        "#........##..WWWW..##........#",
        "#..B.....##........##.C...B..#",
        "#..BBB..................BBB..#",
        "#............BBBB............#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100,
      "theme": "campagne"
    },
    {
      "nom": "Plage des pirates",
      "herbe1": "#6fd35a",
      "herbe2": "#62c24f",
      "mur": "#c98a4b",
      "murFace": "#8e5a2b",
      "buisson": "#2fae4a",
      "buissonFonce": "#1f7a35",
      "eau": "#2fb8f0",
      "sable": "#f4d68e",
      "grille": [
        "##############################",
        "#WWWWS..................SSSSS#",
        "#WWWWS.BB...............SSSSS#",
        "#WWWSS.B..WWW.....BB....SSSSS#",
        "#WWWSS....WWW..E..C.....SSSSS#",
        "#SSSSS..................SSSSS#",
        "#SSSSS..##.....##...B...SSSSS#",
        "#SSPSS..#..........BB...SSSSS#",
        "#SSSSSB.....#ZZZZ.......SSSSS#",
        "#SSSSSB.....#ZZZZ.......STSSS#",
        "#SSSTS.......ZZZZ#.....BSSSSS#",
        "#SSSSS.......ZZZZ#.....BSSSSS#",
        "#SSSSS...BB..........#..SSPSS#",
        "#SSSSS...B...##.....##..SSSSS#",
        "#SSSSS..................SSSSS#",
        "#SSSSS.....C.....WWW....SSWWW#",
        "#SSSSS....BB.....WWW..B.SSWWW#",
        "#SSSSS...............BB.SWWWW#",
        "#SSSSS..................SWWWW#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100,
      "theme": "plage"
    },
    {
      "nom": "Village des Toits",
      "theme": "ville",
      "actif": true,
      "grille": [
        "##############################",
        "#............................#",
        "#........##.WW.E.............#",
        "#..####O.##...O..............#",
        "#..####..##.........BB.......#",
        "#........##............O.....#",
        "#...........BBBB..C..........#",
        "#..BB........................#",
        "#..BB........ZZZZ............#",
        "#.1.5........ZNZZ...###....2.#",
        "#.1....###...ZZNZ........6.2.#",
        "#............ZZZZ........BB..#",
        "#........................BB..#",
        "#..........C..BBBB...........#",
        "#.....O............##........#",
        "#.......BB.........##..####..#",
        "#..............O...##.O####..#",
        "#...............WW.##........#",
        "#............................#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100
    },
    {
      "nom": "Oasis Mirage",
      "theme": "desert",
      "actif": true,
      "grille": [
        "##############################",
        "#......................SSSSSS#",
        "#..........O...........SSSSSS#",
        "#...##.........E...C..OSSSSSS#",
        "#...#....B.............SSSSSS#",
        "#...#.O...................B..#",
        "#...#.........N..............#",
        "#......B...........###.......#",
        "#...........BWWWW..........2.#",
        "#.1.........BWWWW........6...#",
        "#...5........WWWWB.........2.#",
        "#.1..........WWWWB...........#",
        "#.......###...........B......#",
        "#..............N.........#...#",
        "#..B...................O.#...#",
        "#SSSSSS.............B....#...#",
        "#SSSSSSO..C.............##...#",
        "#SSSSSS...........O..........#",
        "#SSSSSS......................#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100
    },
    {
      "nom": "Pic Gelé",
      "theme": "neige",
      "actif": true,
      "grille": [
        "##############################",
        "#............................#",
        "#...........WWW..............#",
        "#.....#..BB.WWW..............#",
        "#..O..#.....WWW..E...C.......#",
        "#.....#......O...........BB..#",
        "#.....#..................BB..#",
        "#.....#..B.O.................#",
        "#............ZZZZ###.........#",
        "#.1..........ZZZZ........6.2.#",
        "#.1.5........ZZZZ..........2.#",
        "#.........###ZZZZ............#",
        "#.................O.B..#.....#",
        "#..BB..................#.....#",
        "#..BB...........O......#.....#",
        "#.......C......WWW.....#..O..#",
        "#..............WWW.BB..#.....#",
        "#..............WWW...........#",
        "#............................#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100
    },
    {
      "nom": "Cratère Brûlant",
      "theme": "volcan",
      "actif": true,
      "grille": [
        "##############################",
        "#............................#",
        "#.............E..............#",
        "#........B...O.........O.....#",
        "#...###..............##......#",
        "#....................##......#",
        "#..........WWW.WWWW..##......#",
        "#..........W......W..........#",
        "#...BB.....W......W..........#",
        "#.1.5.........NN..W.C......2.#",
        "#.1......C.W..NN.........6.2.#",
        "#..........W......W.....BB...#",
        "#..........W......W..........#",
        "#......##..WWWW.WWW..........#",
        "#......##....................#",
        "#......##..............###...#",
        "#.....O.........O...B........#",
        "#............................#",
        "#............................#",
        "##############################"
      ],
      "casseMurs": true,
      "casseBuissons": true,
      "pvBloc": 3000,
      "chanceObjet": 10,
      "chanceCoffre": 100
    }
  ],
  "bosses": {
    "troll": {
      "nom": "TROLL",
      "image": "images/boss.png",
      "pvMax": 10000,
      "vitesse": 1.6,
      "degats": 3000,
      "delaiAttaque": 60,
      "rayonAttaque": 90,
      "taille": 48,
      "imageCarte": "",
      "arme": "",
      "porteeTir": 400,
      "degatsTir": 1500,
      "cadenceTir": 90
    }
  },
  "modes": [
    {
      "nom": "Chasse au boss",
      "description": "Bats le boss en solo",
      "type": "solo",
      "actif": true,
      "joueursMin": 1,
      "joueursMax": 1,
      "equipes": "chacun",
      "boss": true,
      "nbBoss": 1,
      "map": -1,
      "pointsVictoire": 20,
      "pointsDefaite": 2,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": false,
      "delaiReapparition": 3,
      "duree": 0,
      "objectif": "standard",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Horde de trolls",
      "description": "Survis à plusieurs boss",
      "type": "solo",
      "actif": true,
      "joueursMin": 1,
      "joueursMax": 1,
      "equipes": "chacun",
      "boss": true,
      "nbBoss": 3,
      "map": -1,
      "pointsVictoire": 50,
      "pointsDefaite": 5,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": false,
      "delaiReapparition": 3,
      "duree": 0,
      "objectif": "standard",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Duel 1V1",
      "description": "Affronte un joueur en ligne",
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 2,
      "equipes": "chacun",
      "boss": false,
      "nbBoss": 0,
      "map": -1,
      "pointsVictoire": 30,
      "pointsDefaite": 5,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 3,
      "duree": 150,
      "objectif": "standard",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Équipes 2V2",
      "description": "Deux équipes s'affrontent",
      "type": "multi",
      "actif": true,
      "joueursMin": 4,
      "joueursMax": 4,
      "equipes": "deux",
      "boss": false,
      "nbBoss": 0,
      "map": -1,
      "pointsVictoire": 40,
      "pointsDefaite": 5,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 3,
      "duree": 150,
      "objectif": "standard",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Coop contre les boss",
      "description": "Ensemble contre les boss",
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 4,
      "equipes": "coop",
      "boss": true,
      "nbBoss": 2,
      "map": -1,
      "pointsVictoire": 40,
      "pointsDefaite": 5,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": false,
      "delaiReapparition": 3,
      "duree": 0,
      "objectif": "standard",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Zone de contrôle",
      "description": "Tiens la zone centrale",
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 4,
      "equipes": "deux",
      "boss": false,
      "nbBoss": 0,
      "typeBoss": "aleatoire",
      "map": -1,
      "pointsVictoire": 40,
      "pointsDefaite": 5,
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 3,
      "duree": 180,
      "objectif": "zone",
      "tempsZone": 40,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "nom": "Assaut des tours",
      "description": "Détruis la tour ennemie (elle se défend en tirant !)",
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 4,
      "equipes": "deux",
      "boss": false,
      "nbBoss": 0,
      "typeBoss": "aleatoire",
      "map": -1,
      "pointsVictoire": 40,
      "pointsDefaite": 5,
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 4,
      "duree": 240,
      "objectif": "bloc",
      "tempsZone": 30,
      "pvCristal": 20000,
      "degatsCristal": 800,
      "porteeCristal": 350,
      "cadenceCristal": 60,
      "botsObjets": true,
      "niveauBoss": 1,
      "niveauBots": 1,
      "botsAdaptatifs": true
    },
    {
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 4,
      "equipes": "deux",
      "boss": false,
      "nbBoss": 0,
      "map": -1,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 3,
      "nom": "Marathon",
      "description": "Tours puis zone : l'équipe qui gagne le plus d'étapes l'emporte",
      "pointsVictoire": 50,
      "pointsDefaite": 8,
      "duree": 0,
      "objectif": "marathon",
      "etapes": "bloc,zone",
      "tempsZone": 25,
      "pvCristal": 15000
    },
    {
      "type": "multi",
      "actif": true,
      "joueursMin": 2,
      "joueursMax": 4,
      "equipes": "deux",
      "boss": false,
      "nbBoss": 0,
      "map": -1,
      "typesBoss": [],
      "bots": true,
      "attenteBots": 15,
      "reapparition": true,
      "delaiReapparition": 3,
      "nom": "Chasse au trésor",
      "description": "Trouve les trésors cachés avant l'équipe adverse",
      "pointsVictoire": 35,
      "pointsDefaite": 6,
      "duree": 150,
      "objectif": "tresor",
      "nbTresors": 14,
      "objectifTresors": 7
    }
  ],
  "pouvoirs": {
    "turbo": {
      "nom": "Turbo",
      "icone": "⚡",
      "couleur": "#ffe14a",
      "effet": "vitesse",
      "valeur": 1.6,
      "duree": 8,
      "rarete": 3
    },
    "force": {
      "nom": "Super force",
      "icone": "💪",
      "couleur": "#ff5a3c",
      "effet": "degats",
      "valeur": 2,
      "duree": 8,
      "rarete": 2
    },
    "bouclier": {
      "nom": "Bouclier",
      "icone": "🛡️",
      "couleur": "#5ad1ff",
      "effet": "bouclier",
      "valeur": 0.3,
      "duree": 6,
      "rarete": 2
    },
    "soin": {
      "nom": "Potion de soin",
      "icone": "❤️",
      "couleur": "#ff7aa8",
      "effet": "soin",
      "valeur": 0.4,
      "duree": 0,
      "rarete": 3
    },
    "rafale": {
      "nom": "Munitions infinies",
      "icone": "♾️",
      "couleur": "#b67aff",
      "effet": "munitions",
      "valeur": 1,
      "duree": 6,
      "rarete": 1
    },
    "fantome": {
      "nom": "Fantôme",
      "icone": "👻",
      "couleur": "#dddddd",
      "effet": "invisible",
      "valeur": 1,
      "duree": 6,
      "rarete": 1
    }
  },
  "version": 13,
  "app": {
    "nom": "Bastory",
    "nomCourt": "Bastory",
    "icone": "images/icone-maskable-512.png",
    "couleur": "#2b1d6b",
    "vitesseJeu": 0.85,
    "reactivite": 0.55,
    "rotation": 0.4,
    "tamponTir": 15,
    "reculTir": 1.6,
    "tremblementTir": 2,
    "eclatCanon": true,
    "maintienVisee": 18,
    "rebondPerso": 1,
    "pasMarche": 2.6,
    "haloTirs": 1,
    "traineeTirs": 6,
    "impact3D": 1,
    "styleAnneau": "arcade",
    "onomatopees": 1,
    "flashEcran": 0.4,
    "tailleDegats": 1,
    "esquiveBots": 1,
    "decor3D": 1
  },
  "gadgets": {
    "soin": { "nom": "Trousse de soin", "icone": "❤️", "couleur": "#ff5a6e", "effet": "soin", "valeur": 0.3, "duree": 0 },
    "bouclier": { "nom": "Carapace", "icone": "🛡️", "couleur": "#5ac8fa", "effet": "bouclier", "valeur": 0.5, "duree": 3 },
    "sprint": { "nom": "Sprint", "icone": "💨", "couleur": "#b6f0ff", "effet": "vitesse", "valeur": 1.6, "duree": 2 },
    "recharge": { "nom": "Rafale", "icone": "🔋", "couleur": "#ffd23f", "effet": "munitions", "valeur": 1, "duree": 3 },
    "fantome": { "nom": "Fantôme", "icone": "👻", "couleur": "#b67aff", "effet": "invisible", "valeur": 1, "duree": 3 }
  },
  "roles": {
    "tank": { "nom": "🛡️ Tank", "valeur": 15, "description": "Encaisse : reçoit 15 % de dégâts en moins" },
    "tireur": { "nom": "🎯 Tireur", "valeur": 20, "description": "De loin : +20 % de dégâts sur les cibles éloignées" },
    "assassin": { "nom": "🗡️ Assassin", "valeur": 25, "vitesse": 10, "description": "De près : +25 % de dégâts au contact, +10 % de vitesse" },
    "soutien": { "nom": "💚 Soutien", "valeur": 3, "rayon": 220, "description": "Soigne les alliés proches (3 % de leur vie par seconde)" },
    "controle": { "nom": "🌀 Contrôle", "valeur": 25, "description": "Ralentit de 25 % les ennemis touchés" }
  },
  "elements": {
    "terre": {
      "nom": "Terre",
      "icone": "🌍",
      "couleur": "#b7791f",
      "capacite": "brise",
      "valeur": 60,
      "gainVictoire": 30,
      "gainDefaite": 10,
      "superNom": "Séisme titan",
      "superCharge": 7000,
      "actionNom": "Charge",
      "actionRecharge": 7
    },
    "air": {
      "nom": "Air",
      "icone": "💨",
      "couleur": "#38bdf8",
      "capacite": "saut",
      "altitude": 24,
      "valeur": 0,
      "gainVictoire": 30,
      "gainDefaite": 10,
      "superNom": "Tempête de flèches",
      "superCharge": 5000,
      "actionNom": "Saut",
      "actionRecharge": 5
    },
    "eau": {
      "nom": "Eau",
      "icone": "💧",
      "couleur": "#2563eb",
      "capacite": "nage",
      "valeur": 1.35,
      "soin": 1.5,
      "gainVictoire": 30,
      "gainDefaite": 10,
      "superNom": "Raz-de-marée",
      "superCharge": 6000,
      "actionNom": "Bulle",
      "actionRecharge": 8
    },
    "feu": {
      "nom": "Feu",
      "icone": "🔥",
      "couleur": "#ef4444",
      "capacite": "feu",
      "valeur": 120,
      "duree": 2,
      "gainVictoire": 30,
      "gainDefaite": 10,
      "superNom": "Souffle du dragon",
      "superCharge": 6500,
      "actionNom": "Brasier",
      "actionRecharge": 8
    }
  },
  "progression": {
    "niveauMax": 10,
    "coutBase": 50,
    "coutMult": 1.5,
    "bonusPV": 8,
    "bonusDegats": 6,
    "bonusVitesse": 2
  },
  "recompenses": [
    {
      "victoires": 1,
      "element": "terre",
      "quantite": 20
    },
    {
      "victoires": 3,
      "element": "air",
      "quantite": 30
    },
    {
      "victoires": 5,
      "element": "eau",
      "quantite": 40
    },
    {
      "victoires": 8,
      "element": "feu",
      "quantite": 50
    },
    {
      "victoires": 12,
      "element": "tous",
      "quantite": 30
    },
    {
      "victoires": 20,
      "element": "terre",
      "quantite": 100
    },
    {
      "victoires": 30,
      "element": "air",
      "quantite": 120
    },
    {
      "victoires": 45,
      "element": "eau",
      "quantite": 150
    },
    {
      "victoires": 60,
      "element": "feu",
      "quantite": 180
    },
    {
      "victoires": 100,
      "element": "tous",
      "quantite": 150
    }
  ]
};

// 🗡️ armes toutes prêtes des persos à débloquer (chacune son effet)
const ARMES_NEUVES = {
  pioche:      { nom: 'Pioche à cristaux', type: 'droit', effet: 'etincelle', vitesse: 9, taille: 26, rayon: 70, couleur: '#ffd23f', forme: 'rocher', onde: 90, recul: 8, rebonds: 0, chaine: 0, nuage: 0, retard: 0 },
  eventail:    { nom: 'Éventail de vent', type: 'droit', effet: 'vortex', vitesse: 12, taille: 34, rayon: 90, couleur: '#b6f0ff', forme: 'lame', recul: 30, rebonds: 0, chaine: 0, nuage: 0, retard: 0 },
  canonbulles: { nom: 'Canon à bulles', type: 'droit', effet: 'eclaboussure', vitesse: 8, taille: 24, rayon: 60, couleur: '#5ff0ff', forme: 'bulle', ralenti: 0.55, rebonds: 1, recul: 6, chaine: 0, nuage: 0 },
  marteauforge:{ nom: 'Marteau-enclume', type: 'lob', effet: 'impact', vitesse: 14, taille: 30, rayon: 95, couleur: '#ff8a1f', forme: 'feu', nuage: 3, rayonNuage: 70, degatsNuage: 260, onde: 110, recul: 14 },
  magma:       { nom: 'Coulée de magma', type: 'droit', effet: 'feu', vitesse: 7, taille: 30, rayon: 80, couleur: '#ff4a00', forme: 'feu', nuage: 4, rayonNuage: 80, degatsNuage: 320, onde: 100, recul: 10 },
  eclair:      { nom: 'Éclair en chaîne', type: 'droit', effet: 'foudre', vitesse: 16, taille: 22, rayon: 0, couleur: '#ffe14a', forme: 'fleche', chaine: 2, perteChaine: 0.7, porteeChaine: 340, recul: 6, rebonds: 0 }
};
// fiche complète des persos à débloquer : arme, capacité et action différentes pour chacun
const NOUVEAUX = {
  BOULDO:  { arme: 'pioche', capacite: 'brise', action: 'terre', description: 'Tatou mineur. Sa pioche fait jaillir des pics de roche et il brise les blocs en fonçant.' },
  NIMBUS:  { arme: 'eventail', capacite: 'vol', action: 'tourbillon', description: 'Renard de nuages. Son éventail souffle des tornades qui repoussent, et il vole au-dessus de tout.' },
  GLOUGLOU:{ arme: 'canonbulles', capacite: 'nage', action: 'gel', description: 'Pingouin pirate. Ses bulles ralentissent les ennemis et il glace tout autour de lui.' },
  BRAISE:  { arme: 'marteauforge', capacite: 'feu', action: 'feu', description: 'Lutin forgeron. Son marteau-enclume écrase le sol et sème des braises brûlantes.' },
  MAGMOR:  { arme: 'magma', capacite: 'lave', action: 'terre', description: 'Golem de lave (Terre + Feu). Sa coulée de magma brûle, et il marche sur l\'eau en la durcissant.' },
  STORMY:  { arme: 'eclair', capacite: 'orage', action: 'tourbillon', description: 'Sirène de tempête (Air + Eau). Son éclair rebondit d\'ennemi en ennemi et elle vole, insensible au recul.' }
};
// 🗡️ arme propre à un nouveau perso : copie de l'arme de son élément (réglable ensuite dans l'admin → Armes)
function armePour(c, p) {
  const N = NOUVEAUX[String(p.nom || '').toUpperCase()];
  if (N) { // perso connu : son arme, sa capacité et son action sont déjà prêtes
    if (!c.armes[N.arme]) c.armes[N.arme] = { ...JSON.parse(JSON.stringify(c.armes.rocher || {})), ...ARMES_NEUVES[N.arme] };
    Object.assign(p, { arme: N.arme, capacite: p.capacite || N.capacite, action: p.action || N.action, description: p.description || N.description, armeAuto: true });
    return;
  }
  const mod = { terre: 'rocher', air: 'vent', eau: 'trident', feu: 'boulefeu' }[p.element] || Object.keys(c.armes)[0], id = 'arme_' + String(p.nom || 'perso').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!c.armes[id]) c.armes[id] = { ...JSON.parse(JSON.stringify(c.armes[mod] || {})), nom: 'Arme de ' + (p.nom || 'perso'), rebonds: 0, chaine: 0 };
  p.arme = id; p.armeAuto = true; if (p.description === undefined) p.description = '';
}
// Met à niveau une config existante (ajoute les nouveaux réglages, retire les anciens)
function migrerConfig(c) {
  const D = CONFIG_PAR_DEFAUT, copie = o => JSON.parse(JSON.stringify(o)), def = (o, d) => { for (const k in d) if (o[k] === undefined) o[k] = d[k]; return o; };
  if (!c.bosses) c.bosses = { troll: c.boss || copie(D.bosses.troll) }; delete c.boss;
  ['modes', 'pouvoirs', 'app', 'elements', 'progression', 'recompenses', 'roles', 'gadgets'].forEach(k => { if (!c[k] || (Array.isArray(c[k]) && !c[k].length)) c[k] = copie(D[k]); });
  for (const k in D.armes) if (!c.armes[k] && ['seisme', 'ricochet', 'eclair', 'fumigene', 'dard', 'rocher', 'vent', 'trident', 'boulefeu'].includes(k)) c.armes[k] = copie(D.armes[k]);
  if ((c.version || 0) < 8) { // v8 : persos = vrais modèles 3D .glb + éléments ; les anciens persos "assemblés" sont retirés
    c.persos = c.persos.filter(p => p.image || p.modele);
    c.persos.forEach(p => Object.keys(p).forEach(k => { if (k.startsWith('t3') || k === 'mode3D') delete p[k]; }));
    D.persos.filter(p => p.modele).forEach(p => { if (!c.persos.some(x => x.nom === p.nom)) c.persos.unshift(copie(p)); });
    ['v3d', 'v3d2', 'v3d3'].forEach(k => delete c[k]); c.version = 8;
  }
  if ((c.version || 0) < 9) { // v9 : gameplay plus posé, armes typées, super/action, sable, marathon, chasse au trésor, récompenses
    const P = {"ROKH":{"vitesse":3,"pvMax":8500,"degats":2000,"portee":300,"delaiTir":55},"ZEPHYR":{"vitesse":4.6,"pvMax":3800,"degats":950,"portee":520,"delaiTir":20,"modeleEchelle":1.2},"NAIA":{"vitesse":4,"pvMax":5400,"degats":1250,"portee":400,"delaiTir":28},"PYRO":{"vitesse":4.1,"pvMax":5000,"degats":1600,"portee":360,"delaiTir":34},"WIXY":{"vitesse":3.4},"BORA":{"vitesse":4.3}};
    c.persos.forEach(p => { if (P[p.nom]) Object.assign(p, P[p.nom]); else p.vitesse = +((+p.vitesse || 4) * 0.82).toFixed(2); });
    ['rocher', 'vent', 'trident', 'boulefeu'].forEach(k => { if (c.armes[k]) ['vitesse', 'onde', 'recul', 'forme', 'rebonds', 'effet', 'nuage', 'degatsNuage'].forEach(x => { if (D.armes[k][x] !== undefined) c.armes[k][x] = D.armes[k][x]; }); });
    for (const k in D.elements) if (c.elements[k]) def(c.elements[k], D.elements[k]);
    D.modes.filter(m => ['marathon', 'tresor'].includes(m.objectif)).forEach(m => { if (!c.modes.some(x => x.nom === m.nom)) c.modes.push(copie(m)); });
    D.maps.filter(m => m.sable).forEach(m => { if (!c.maps.some(x => x.nom === m.nom)) c.maps.push(copie(m)); });
    c.version = 9;
  }
  if ((c.version || 0) < 10) { // v10 : persos plus lents, Zéphyr marche et saute au lieu de voler
    c.persos.forEach(p => p.vitesse = +((+p.vitesse || 4) * 0.85).toFixed(2));
    if (c.elements.air) { if (c.elements.air.capacite === 'vol') c.elements.air.capacite = 'saut'; if (c.elements.air.actionNom === 'Rafale') c.elements.air.actionNom = 'Saut'; }
    c.version = 10;
  }
  if ((c.version || 0) < 11) { // v11 : Rokh frappe au marteau (onde de choc au sol, courte portée)
    if (c.armes.rocher) Object.assign(c.armes.rocher, { forme: 'onde', vitesse: 11, taille: 22, rayon: 95, onde: 150, effet: 'impact' });
    c.persos.forEach(p => { if (p.nom === 'ROKH') p.portee = 240; });
    c.version = 11;
  }
  if ((c.version || 0) < 12) { if (c.armes.rocher) c.armes.rocher.vitesse = 26; c.version = 12; } // v12 : le marteau frappe le sol tout de suite
  if ((c.version || 0) < 13) { // v13 : ambiances de map (thèmes 3D) + 4 maps thématiques
    c.maps.forEach(m => { if (!m.theme) m.theme = m.sable ? 'plage' : 'campagne'; });
    D.maps.filter(m => ['ville', 'desert', 'neige', 'volcan'].includes(m.theme)).forEach(m => { if (!c.maps.some(x => x.nom === m.nom)) c.maps.push(copie(m)); });
    c.version = 13;
  }
  if ((c.version || 0) < 14) { // v14 : persos de base / à débloquer, récompenses jetons et photos de profil
    c.persos.forEach(p => { if (p.deBase === undefined) p.deBase = true; if (p.coutJetons === undefined) p.coutJetons = 3; });
    (c.recompenses || []).forEach(r => { if (!r.type) r.type = 'essence'; });
    if (!c.recompenses.some(r => r.type !== 'essence')) { c.recompenses.push({ victoires: 10, type: 'avatar', quantite: 2 }, { victoires: 15, type: 'jetons', quantite: 3 }, { victoires: 25, type: 'avatar', quantite: 2 }, { victoires: 35, type: 'jetons', quantite: 3 }, { victoires: 50, type: 'avatar', quantite: 3 }); c.recompenses.sort((a, b) => a.victoires - b.victoires); }
    c.version = 14;
  }
  if ((c.version || 0) < 15) { // v15 : descriptions des persos
    const DESC = { ROKH: 'Ours-golem de roche. Son marteau fend le sol en onde de choc, sa charge brise les blocs.', ZEPHYR: 'Faucon du vent. Ses flèches rapides ricochent, il saute par-dessus les murs.',
      NAIA: 'Axolotl guerrière. Son trident repousse puis revient ; elle nage et se soigne dans l\'eau.', PYRO: 'Bébé dragon. Sa boule de feu explose en flammes et il laisse une traînée brûlante.' };
    c.persos.forEach(p => { if (!p.description && DESC[p.nom]) p.description = DESC[p.nom]; }); c.version = 15;
  }
  if ((c.version || 0) < 16) { // v16 : marteau de Rokh en 2 temps (frappe au sol puis éclats de roche)
    if (c.armes.rocher && c.armes.rocher.forme === 'onde') Object.assign(c.armes.rocher, { type: 'frappe', distanceFrappe: 100, delaiFrappe: 16, rayon: 85, eclats: 5, degatsEclats: 45, angleEclats: 75, porteeEclats: 180, vitesseEclats: 9, ralentiElan: 0.35 });
    c.modes.forEach(m => { if (m.nom === 'Guerre des cristaux') m.nom = 'Assaut des tours'; if (m.description === 'Détruis le cristal ennemi') m.description = 'Détruis la tour ennemie (elle se défend en tirant !)'; if (m.description) m.description = m.description.replace(/^Cristaux puis/, 'Tours puis'); }); // 🏰 le cristal devient une tour
    c.version = Math.max(c.version || 0, 16);
  }
  if ((c.version || 0) < 17) { // v17 : l'éventail de Nimbus devient une lame de vent tournoyante (la forme « onde » est réservée au marteau)
    if (c.armes.eventail && c.armes.eventail.forme === 'onde') c.armes.eventail.forme = 'lame';
    c.version = 17;
  }
  if ((c.version || 0) < 18) { // v18 : rôles des persos
    const R = { ROKH: 'tank', BOULDO: 'tank', MAGMOR: 'tank', ZEPHYR: 'tireur', STORMY: 'tireur', NAIA: 'soutien', GLOUGLOU: 'soutien', PYRO: 'controle', NIMBUS: 'controle', BRAISE: 'assassin', BORA: 'assassin', WIXY: 'controle' };
    c.persos.forEach(p => { if (!p.role) p.role = R[p.nom] || ''; }); c.version = Math.max(c.version || 0, 18);
  }
  if ((c.version || 0) < 19) { // v19 : gadgets (3 par partie)
    const G = { tank: 'bouclier', tireur: 'sprint', soutien: 'soin', controle: 'recharge', assassin: 'fantome' };
    c.persos.forEach(p => { if (p.gadget === undefined) p.gadget = G[p.role] || 'soin'; }); if (c.app && c.app.gadgetsParPartie === undefined) c.app.gadgetsParPartie = 3; c.version = 19;
  }

  c.persos.forEach(p => { if (typeof p.base === 'boolean') { p.deBase = p.base; delete p.base; } }); // réparation : ancien nom du champ
  c.persos.forEach(p => { if (p.deBase === false && !p.armeAuto) armePour(c, p); }); // nouveaux persos : arme créée automatiquement
  if (/wixy\.png$/i.test((c.app || {}).icone || '')) c.app.icone = 'images/icone-maskable-512.png'; // nouvelle icône PWA
  c.modes.forEach(m => {
    if (m.type === '1v1') { m.type = 'multi'; m.joueursMin = m.joueursMin || 2; m.joueursMax = m.joueursMax || 2; }
    def(m, { joueursMin: 1, joueursMax: 1, equipes: 'chacun', pointsVictoire: 30, pointsDefaite: 5, bots: true, attenteBots: 15, reapparition: false, delaiReapparition: 3, duree: 0,
             objectif: 'standard', etapes: 'bloc,zone', nbTresors: 14, objectifTresors: 7, tempsZone: 30, pvCristal: 20000, degatsCristal: 800, porteeCristal: 350, cadenceCristal: 60, botsObjets: true, niveauBoss: 1, niveauBots: 1, botsAdaptatifs: true });
  });
  c.persos.forEach(p => def(p, { imageCarte: '', munitions: 3, recharge: 60, element: '', modele: '', modeleEchelle: 1, modeleRotation: 0, animRepos: '', animMarche: '', animAttaque: '', animTouche: '', animMort: '', animReleve: '' }));
  Object.values(c.bosses).forEach(b => def(b, { imageCarte: '', arme: '', porteeTir: 400, degatsTir: 1500, cadenceTir: 90, modele: '', modeleEchelle: 1, modeleRotation: 0, animRepos: '', animMarche: '', animAttaque: '', animTouche: '', animMort: '' }));
  Object.values(c.armes).forEach(a => def(a, { ralenti: 0, rebonds: 0, bonusRebond: 1.2, chaine: 0, perteChaine: 0.7, porteeChaine: 350, onde: 0, recul: 0, forme: '', retard: 0, poisonDuree: 0, nuage: 0, rayonNuage: 90, degatsNuage: 150 }));
  c.maps.forEach(m => def(m, { casseMurs: true, casseBuissons: true, pvBloc: 3000, chanceObjet: 10, chanceCoffre: 100, sable: '#f4d68e' }));
  if (c.app && c.app.styleAnneau === 'arcade') c.app.styleAnneau = 'arcade';
  def(c.app, D.app); // ⚙️ nouveaux réglages de l'appli (sensations de jeu) : valeurs par défaut si absents
  return c;
}
