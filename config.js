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
  "neutre": {
    "nom": "🏛️ Place neutre",
    "sol": "#d9cfbf",
    "sable": "#e9d9b0",
    "mur": "#a7a2b8",
    "palette": [
      "#9aa0b8",
      "#b8a98f",
      "#8fa3a8"
    ],
    "murStyle": "pierre",
    "buisson": "#4bb35a",
    "buissonStyle": "haie",
    "eau": "#46b3e6",
    "ext": "#7aa06a",
    "ciel": "#b9e3ff",
    "coffre": "#c98a45",
    "solStyle": "pave"
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
    "quetesParJour": 3,
    "comboDelai": 3,
    "bossMondialPV": 3,
    "bossMondialButin": 3,
    "butinArme": 75,
    "dureeChute": 4,
    "vitesseChute": 1.6,
    "coutMur": 10,
    "matMur": 10,
    "matBuisson": 4,
    "matMax": 200,
    "solideMur": 60,
    "regenDelai": 3,
    "regenTaux": 4,
    "regenBoss": 0.5,
    "volumeSons": 1,
    "volumeMusique": 1,
    "musiqueMenu": "",
    "musiqueJeu": "",
    "decor3D": 1
  },
  "quetes": [
    { "texte": "Gagne {n} partie(s)", "type": "victoire", "min": 2, "max": 3, "jetons": 2, "actif": true },
    { "texte": "Joue {n} parties", "type": "partie", "min": 3, "max": 5, "jetons": 1, "actif": true },
    { "texte": "Inflige {n} dégâts", "type": "deg", "min": 20000, "max": 40000, "jetons": 2, "actif": true },
    { "texte": "Mets {n} adversaires K.O.", "type": "ko", "min": 3, "max": 6, "jetons": 2, "actif": true },
    { "texte": "Lance {n} supers", "type": "sup", "min": 3, "max": 5, "jetons": 1, "actif": true },
    { "texte": "Utilise {n} gadgets", "type": "gad", "min": 3, "max": 5, "jetons": 1, "actif": true },
    { "texte": "Gagne {n} partie(s) avec {perso}", "type": "victoirePerso", "min": 1, "max": 2, "jetons": 3, "actif": true }
  ],
  "skins": [
    { "cle": "dore", "nom": "Or massif", "icone": "✨", "style": "dore", "couleur1": "#7a4a08", "couleur2": "#ffe27a", "lueur": "#fff1a8", "contour": "#4a2a00", "force": 0.95, "cout": 6 },
    { "cle": "ombre", "nom": "Ombre", "icone": "🌑", "style": "ombre", "couleur1": "#0d0620", "couleur2": "#3b1a6b", "lueur": "#b44dff", "contour": "#b44dff", "force": 0.95, "cout": 5 },
    { "cle": "glace", "nom": "Cristal de glace", "icone": "❄️", "style": "glace", "couleur1": "#3fa9e6", "couleur2": "#e8fbff", "lueur": "#ffffff", "contour": "#1e6fb0", "force": 0.9, "cout": 5 },
    { "cle": "lave", "nom": "Cœur de lave", "icone": "🌋", "style": "lave", "couleur1": "#1a1010", "couleur2": "#ff6a00", "lueur": "#ff3d00", "contour": "#2a0a00", "force": 0.95, "cout": 6 },
    { "cle": "bonbon", "nom": "Sucre d'orge", "icone": "🍬", "style": "bonbon", "couleur1": "#ff4f9a", "couleur2": "#fff4fa", "lueur": "#ffc2e0", "contour": "#8a1044", "force": 0.9, "cout": 4 },
    { "cle": "galaxie", "nom": "Galaxie", "icone": "🌌", "style": "galaxie", "couleur1": "#1a0b4a", "couleur2": "#ff4fd8", "lueur": "#6fd1ff", "contour": "#0a0420", "force": 0.95, "cout": 8 }
  ],
  "pass": {"xpPalier": 250, "xpVictoire": 100, "xpDefaite": 35, "xpKO": 15, "xpQuete": 60, "paliers": [{"type": "jetons", "quantite": 1}, {"type": "essence", "quantite": 40, "element": "tous"}, {"type": "points", "quantite": 25}, {"type": "jetons", "quantite": 2}, {"type": "jetons", "quantite": 5}, {"type": "jetons", "quantite": 1}, {"type": "essence", "quantite": 40, "element": "tous"}, {"type": "points", "quantite": 25}, {"type": "jetons", "quantite": 2}, {"type": "skin", "quantite": 1, "skin": "dore"}, {"type": "jetons", "quantite": 1}, {"type": "essence", "quantite": 40, "element": "tous"}, {"type": "points", "quantite": 25}, {"type": "jetons", "quantite": 2}, {"type": "jetons", "quantite": 5}, {"type": "jetons", "quantite": 1}, {"type": "essence", "quantite": 40, "element": "tous"}, {"type": "points", "quantite": 25}, {"type": "jetons", "quantite": 2}, {"type": "skin", "quantite": 1, "skin": "galaxie"}]},
  "meteos": [
    { "cle": "soleil", "nom": "Grand soleil", "icone": "☀️", "description": "", "poids": 40, "actif": true },
    { "cle": "pluie", "nom": "Pluie", "icone": "🌧️", "description": "🔥 −20 % • 💨 +20 %", "poids": 20, "feu": 0.8, "air": 1.2, "visuel": "pluie", "actif": true },
    { "cle": "sable", "nom": "Tempête de sable", "icone": "🌪️", "description": "on voit moins loin • 🌍 +15 %", "poids": 15, "terre": 1.15, "visibilite": 0.6, "visuel": "sable", "actif": true },
    { "cle": "eclipse", "nom": "Éclipse", "icone": "🌑", "description": "il fait sombre • supers +25 %", "poids": 10, "super": 1.25, "visuel": "nuit", "actif": true },
    { "cle": "neige", "nom": "Neige", "icone": "❄️", "description": "tout le monde ralentit • 💧 +15 %", "poids": 15, "vitesse": 0.9, "eau": 1.15, "visuel": "neige", "actif": true }
  ],
  "combos": {
    "air+eau": { "nom": "ORAGE!", "effet": "chaine", "valeur": 40, "rayon": 240, "couleur": "#ffe14a", "actif": true },
    "air+feu": { "nom": "TORNADE DE FEU!", "effet": "nuageFeu", "valeur": 60, "rayon": 100, "duree": 3, "couleur": "#ff6a00", "actif": true },
    "eau+feu": { "nom": "VAPEUR!", "effet": "vapeur", "valeur": 15, "rayon": 120, "duree": 4, "couleur": "#e8f4ff", "actif": true },
    "eau+terre": { "nom": "BOUE!", "effet": "ralenti", "valeur": 45, "duree": 2.5, "couleur": "#8a5a2b", "actif": true },
    "feu+terre": { "nom": "MAGMA!", "effet": "nuageFeu", "valeur": 80, "rayon": 80, "duree": 4, "couleur": "#ff4a00", "actif": true },
    "air+terre": { "nom": "TEMPÊTE DE SABLE!", "effet": "souffle", "valeur": 25, "recul": 40, "couleur": "#e8c38a", "actif": true }
  },
  "raretes": [
    { "cle": "commun", "nom": "Commune", "icone": "⚪", "couleur": "#c9d0dc", "mult": 1, "poids": 50 },
    { "cle": "rare", "nom": "Rare", "icone": "🔵", "couleur": "#4aa3ff", "mult": 1.15, "poids": 30 },
    { "cle": "epique", "nom": "Épique", "icone": "🟣", "couleur": "#b44dff", "mult": 1.3, "poids": 15 },
    { "cle": "legendaire", "nom": "Légendaire", "icone": "🟡", "couleur": "#ffb020", "mult": 1.5, "poids": 5 }
  ],
  "rangs": [
    { "nom": "Bronze", "min": 0, "icone": "🥉", "couleur": "#cd7f32" },
    { "nom": "Argent", "min": 150, "icone": "🥈", "couleur": "#c0c7d6" },
    { "nom": "Or", "min": 400, "icone": "🥇", "couleur": "#ffd23f" },
    { "nom": "Platine", "min": 800, "icone": "💠", "couleur": "#5ff0ff" },
    { "nom": "Diamant", "min": 1400, "icone": "💎", "couleur": "#8e7bff" },
    { "nom": "Légende", "min": 2200, "icone": "👑", "couleur": "#ff2d55" }
  ],
  "gadgets": {
    "soin": { "nom": "Trousse de soin", "icone": "❤️", "couleur": "#ff5a6e", "effet": "soin", "valeur": 0.3, "duree": 0 },
    "bouclier": { "nom": "Carapace", "icone": "🛡️", "couleur": "#5ac8fa", "effet": "bouclier", "valeur": 0.5, "duree": 3 },
    "sprint": { "nom": "Sprint", "icone": "💨", "couleur": "#b6f0ff", "effet": "vitesse", "valeur": 1.6, "duree": 2 },
    "recharge": { "nom": "Rafale", "icone": "🔋", "couleur": "#ffd23f", "effet": "munitions", "valeur": 1, "duree": 3 },
    "fantome": { "nom": "Fantôme", "icone": "👻", "couleur": "#b67aff", "effet": "invisible", "valeur": 1, "duree": 3 }
  },
  "roles": {
    "tank": { "nom": "🛡️ Tank", "valeur": 15, "regen": 1.4, "description": "Encaisse : reçoit 15 % de dégâts en moins" },
    "tireur": { "nom": "🎯 Tireur", "valeur": 20, "regen": 0.8, "description": "De loin : +20 % de dégâts sur les cibles éloignées" },
    "assassin": { "nom": "🗡️ Assassin", "valeur": 25, "vitesse": 10, "regen": 1.1, "description": "De près : +25 % de dégâts au contact, +10 % de vitesse" },
    "soutien": { "nom": "💚 Soutien", "valeur": 3, "rayon": 220, "regen": 1.2, "description": "Soigne les alliés proches (3 % de leur vie par seconde)" },
    "controle": { "nom": "🌀 Contrôle", "valeur": 25, "regen": 1, "description": "Ralentit de 25 % les ennemis touchés" }
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
  BOULDO:  { arme: 'pioche', role: 'tank', gadget: 'bouclier', capacite: 'brise', action: 'terre', description: 'Tatou mineur. Sa pioche fait jaillir des pics de roche et il brise les blocs en fonçant.' },
  NIMBUS:  { arme: 'eventail', role: 'controle', gadget: 'recharge', capacite: 'vol', action: 'tourbillon', description: 'Renard de nuages. Son éventail souffle des tornades qui repoussent, et il vole au-dessus de tout.' },
  GLOUGLOU:{ arme: 'canonbulles', role: 'soutien', gadget: 'soin', capacite: 'nage', action: 'gel', description: 'Pingouin pirate. Ses bulles ralentissent les ennemis et il glace tout autour de lui.' },
  BRAISE:  { arme: 'marteauforge', role: 'assassin', gadget: 'fantome', capacite: 'feu', action: 'feu', description: 'Lutin forgeron. Son marteau-enclume écrase le sol et sème des braises brûlantes.' },
  MAGMOR:  { arme: 'magma', role: 'tank', gadget: 'bouclier', capacite: 'lave', action: 'terre', description: 'Golem de lave (Terre + Feu). Sa coulée de magma brûle, et il marche sur l\'eau en la durcissant.' },
  STORMY:  { arme: 'eclair', role: 'tireur', gadget: 'sprint', capacite: 'orage', action: 'tourbillon', description: 'Sirène de tempête (Air + Eau). Son éclair rebondit d\'ennemi en ennemi et elle vole, insensible au recul.' }
};
// 🗡️ arme propre à un nouveau perso : copie de l'arme de son élément (réglable ensuite dans l'admin → Armes)
function armePour(c, p) {
  const N = NOUVEAUX[String(p.nom || '').toUpperCase()];
  if (N) { // perso connu : son arme, sa capacité et son action sont déjà prêtes
    if (!c.armes[N.arme]) c.armes[N.arme] = { ...JSON.parse(JSON.stringify(c.armes.rocher || {})), ...ARMES_NEUVES[N.arme] };
    Object.assign(p, { arme: N.arme, capacite: p.capacite || N.capacite, action: p.action || N.action, description: p.description || N.description, role: p.role || N.role || '', gadget: p.gadget || N.gadget || '', armeAuto: true });
    return;
  }
  const mod = { terre: 'rocher', air: 'vent', eau: 'trident', feu: 'boulefeu' }[p.element] || Object.keys(c.armes)[0], id = 'arme_' + String(p.nom || 'perso').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!c.armes[id]) c.armes[id] = { ...JSON.parse(JSON.stringify(c.armes[mod] || {})), nom: 'Arme de ' + (p.nom || 'perso'), rebonds: 0, chaine: 0 };
  p.arme = id; p.armeAuto = true; if (p.description === undefined) p.description = '';
}
// Met à niveau une config existante (ajoute les nouveaux réglages, retire les anciens)
const ROYAUME = {"nom": "🏰 Royaume", "actif": true, "theme": "neutre", "grand": true, "biomes": {"rayon": 7.5, "secteurs": ["campagne", "desert", "neige", "volcan", "plage", "ville"]}, "casseMurs": true, "casseBuissons": true, "pvBloc": 2200, "chanceObjet": 12, "chanceCoffre": 100, "grille": ["################################################################", "#S.SSSSSSSSSSSSSS.SS.SSSSSSS.SSS...............................#", "#S###S..#####SS.SSSSSB##..S#S.###.BB###.......##........#......#", "#.##SSS###..S#SSSSSSSBSBSPS#SB#S#..B#.###.....#..........###.###", "#SSS#SSSS###S##.S.SS.SS#S.S######B.#WW##.......#..........######", "#SSS##########SS.SS.SSSS.CS#C#S####WWWW..##........##..........#", "#S###SSSS##S#SS#..S.#SSS.S.SSSSSBB#WWWW..#........##.B#####....#", "#S###SSSSS.S#S##SSSWWSSS#####SSSB..WWWW.........#.##.B#........#", "#S.SSSSS.S###.SWW.S.WWSBBS.#SSS.....WW.#..#....##..............#", "#SSSSSS###SSSSWWWSSSSWSSSSS#SSBBB...##..#.#....##.###.####.....#", "#.SS.SS##SSS.#WWWW.S.WW.SSSSSS#SB.........#...........##.#####.#", "#SBB...SSSSP.SWWWWWSW.W.SSS.....#....P...#.#........P...####...#", "#S###SSSSSSS.SWWWWW...BB...............###........B......##.####", "#S####.SSSS#S##WWWWWSS........................BB..B..BB..####..#", "#.#####S###SS#SBSWWW........................B...#.....###......#", "#...##SS.##SSS.S####..........#..#..........##.###...#######...#", "#....SS###BSSS.S##........C..###...#...........#.....###..#....#", "#......#SSSSSS..#B................BB#..........#..........#....#", "#........###SS###.....#.#.##..C...##..................C....#...#", "#...######S#SSS#.....WW...#..###....#...........##BB.........###", "#..####.#...#S......WWWW......B..................#.B........##.#", "#.....BB.....##....WWWWW...................C.....#..#..C.....###", "#.....BB.###WW....WWWWWWW...B..........##.#.......###....####..#", "#.##....#.BWWW...WWWWWWWWW.B....###...#####.###...#.#BB..####..#", "#.#..P.....WW....WWWWWWWWW......B.#...#..C#..#......CB....B....#", "#.##...####WW...WWWWWWWWW............##C....##......##..P......#", "#...##.####.W...WWWWWWWW..B.....B....##.......##...###....B....#", "#...###.#.WW......WWW##.##B...#..#...................###WW.....#", "#.....#..#WW...B.WWWW#..##.................###..B.....#WWWW##..#", "#.....#...##...B.WWWW#.........C............#..##...##.WWWWW...#", "#......BBBB#...B.WWWW##B...#........#.......BBB#B...##WWWWWW...#", "#..#.#.#.B.....#...W.........................B.......B.W.W.#.#.#", "#..#.B.#.#.....#..........B.....E.C...B..B...........#.W.W.....#", "#....###..##...###..BB###..#..C.....#....B..........#.#..#.....#", "#....#.#..#....####.BB.#................##..BB......#..#....B..#", "#.#...##........####.###................##.##B###...#.WWWW#.B..#", "#.#........B....#.#C..#.......#..#.....S...#.........WWWWWW#...#", "#.#.....B..BB........C................SSSS.........#.WWWWWW....#", "#.##................##CB........B....SSSSSS###.....#.WWWWW###..#", "#...##.P..C.........##..........SSSSSSSSCSSS#......#..#WW......#", "#...B#...B.......#.........B....S#SSSSS...S##SS...B#BB.....P...#", "#......BB..#........BB......B.....#SS.S.SS.###SS..#C#........#.#", "#.##.......#........C....B..###.SSS.SSSSS#SS#..SS###C.BB#...#..#", "#.##..###..#...............B##...SS##SSSS###S.SS.S.S..BB#.###..#", "#......C...#B.............WW##BBSSSS.SS.S##S..SSSSS###.B#.##...#", "#.###.......B.###.........WWWWBBSCSSSSSSSSSSSSSSSS##.SBBB..#.###", "#.#........###.#.........WWWWW...###SSCSS.SS.S.SS.##.SBSB..#.###", "#........###......#......WWWWW#.SSBBS##S.S..SSSS..###S.SSS.....#", "#....##..##.....##.#........W##CSSBSSS.SSSSSSS.###SSSBBBSSS#...#", "#.######........#..B............SSSS..SSSS.SSS.#S###BB##.S##BB.#", "#..#..#.....###....B............SSSSSSS.SSSSSSSSBS#BB.S.S###.#S#", "#..####...........#...####......SS..S.S..#.S.SSSSSSS.SSSSSBSSSS#", "#...###....P......#.........###.SSSSSSSS#SSSSCSSS##.PSBBSSSSS.S#", "#..#..#..............#.....#.#..SS###SSSS#SSSS#####SSSBBSSSSSSS#", "#..#####..#.###.#..........#B...#SS#SSS.S##S.S.####SS##SSS.BBBS#", "#..##.......##......##..######.###S#SSS.S###SSSS###SS##SSSSBSBS#", "#...........#..B.#.###..#.##...WW.S#.S.SSSBBS...SS..SSSSS.SS##S#", "#...........#......#..###.....WWWWS##SS.###SSSS..SSSSSSS.S..S.S#", "#.................##...#.B...CWWWWW#SS.SS#SSSSS.S.S..SS.SSSSS..#", "#........###.........B##......WWWWS#SSSS#.S.SSS#.##S.SSS.SS#SSS#", "#...####.#...........##..P.....WWWSS#.P.SSSSS##.S..SSSS.SBB#SS.#", "#.....##.............#.......####SSS#.SSS...S##SS.SS.S.S.SB#SS.#", "#....................#...#.....#SSSS.SS.S..SSSSSS.SSSSSSS.SSSSS#", "################################################################"]}; // 🏰 grande carte (générée, modifiable dans l'éditeur de maps)
function migrerConfig(c) {
  const D = CONFIG_PAR_DEFAUT, copie = o => JSON.parse(JSON.stringify(o)), def = (o, d) => { for (const k in d) if (o[k] === undefined) o[k] = d[k]; return o; };
  if (!c.bosses) c.bosses = { troll: c.boss || copie(D.bosses.troll) }; delete c.boss;
  ['modes', 'pouvoirs', 'app', 'elements', 'progression', 'recompenses', 'roles', 'gadgets', 'quetes', 'rangs', 'skins', 'raretes', 'combos', 'meteos', 'pass'].forEach(k => { if (!c[k] || (Array.isArray(c[k]) && !c[k].length)) c[k] = copie(D[k]); });
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
  if ((c.version || 0) < 20) { // v20 : mode Survie (zone de gaz qui se referme, le dernier debout gagne)
    if (!c.modes.some(m => m.objectif === 'survie')) c.modes.push({ nom: 'Survie', description: 'La zone de gaz se referme : sois le dernier debout !', type: 'multi', actif: true, joueursMin: 2, joueursMax: 6, equipes: 'chacun', objectif: 'survie',
      reapparition: false, bots: true, attenteBots: 8, niveauBots: 2, boss: false, nbBoss: 0, typesBoss: [], map: -1, pointsVictoire: 40, pointsDefaite: 5, gazDebut: 20, gazDuree: 90, gazDegats: 8, gazRayonMin: 2.5 });
    c.version = Math.max(c.version || 0, 20);
  }
  if ((c.version || 0) < 21) { // v21 : skins qui transforment vraiment le perso (style + couleurs + lueur)
    const D2 = D.skins || []; if (!Array.isArray(c.skins)) c.skins = []; D2.forEach(d => { const x = c.skins.find(s => s.cle === d.cle); if (!x) c.skins.push(JSON.parse(JSON.stringify(d))); else if (!x.style) Object.assign(x, d, { cout: x.cout ?? d.cout }); });
    (c.quetes || []).forEach(q => { if (!q.recompense) { q.recompense = 'jetons'; q.quantite = q.jetons ?? 1; q.element = 'tous'; } }); // quêtes : récompense au choix
    c.version = Math.max(c.version || 0, 21);
  }
  if ((c.version || 0) < 22) { // v22 : régénération de la vie hors combat (vitesse par rôle)
    for (const k in (D.roles || {})) if (c.roles && c.roles[k] && c.roles[k].regen === undefined) c.roles[k].regen = D.roles[k].regen;
    c.version = Math.max(c.version || 0, 22);
  }
  if ((c.version || 0) < 23) { // v23 : grande carte « Royaume » (6 ambiances + place neutre) et mode Royaume (survie + construction + butin + atterrissage + boss mondial + météo)
    if (!c.maps.some(m => m.nom === ROYAUME.nom)) c.maps.push(JSON.parse(JSON.stringify(ROYAUME)));
    const mi = c.maps.findIndex(m => m.nom === ROYAUME.nom);
    if (!c.modes.some(m => m.objectif === 'survie' && m.nom === 'Royaume')) c.modes.push({ nom: 'Royaume', description: 'Grande carte, 6 ambiances : atterris, pille, construis… le gaz vous pousse tous vers le centre !', type: 'multi', actif: true, joueursMin: 2, joueursMax: 6,
      equipes: 'chacun', objectif: 'survie', reapparition: false, bots: true, attenteBots: 10, niveauBots: 2, boss: false, nbBoss: 0, typesBoss: [], map: mi, pointsVictoire: 60, pointsDefaite: 8,
      gazDebut: 45, gazDuree: 180, gazDegats: 6, gazRayonMin: 4, construction: true, butin: true, atterrissage: true, bossMondial: true, bossMondialApres: 90, meteo: true });
    c.version = Math.max(c.version || 0, 23);
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
  if (c.app && c.app.styleAnneau && !['arcade', 'simple'].includes(c.app.styleAnneau)) c.app.styleAnneau = 'arcade'; // ancien nom du style → arcade
  def(c.app, D.app); // ⚙️ nouveaux réglages de l'appli (sensations de jeu) : valeurs par défaut si absents
  return c;
}
