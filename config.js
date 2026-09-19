// ⚙️ DONNÉES DU JEU — modifiables via admin.html (Exporter) ou à la main
const CONFIG_PAR_DEFAUT = {
  "persos": [
    {
      "nom": "WIXY",
      "image": "images/wixy.png",
      "couleur": "#3498db",
      "pvMax": 6000,
      "vitesse": 4,
      "arme": "bombe",
      "degats": 2000,
      "portee": 300,
      "delaiTir": 45
    },
    {
      "nom": "BORA",
      "image": "images/bora.png",
      "couleur": "#9b59b6",
      "pvMax": 4800,
      "vitesse": 5.5,
      "arme": "boomerang",
      "degats": 1250,
      "portee": 450,
      "delaiTir": 22
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
      "couleur": "#ff9f1a"
    },
    "boomerang": {
      "nom": "Boomerang",
      "image": "images/boomerang.png",
      "type": "retour",
      "effet": "entaille",
      "vitesse": 11,
      "taille": 18,
      "rayon": 0,
      "couleur": "#9cff57"
    },
    "tir": {
      "nom": "Tir magique",
      "image": "",
      "type": "droit",
      "effet": "etincelle",
      "vitesse": 13,
      "taille": 10,
      "rayon": 0,
      "couleur": "#ffe14a"
    }
  },
  "boss": {
    "nom": "TROLL",
    "image": "images/boss.png",
    "pvMax": 10000,
    "vitesse": 1.6,
    "degats": 3000,
    "delaiAttaque": 60,
    "rayonAttaque": 90,
    "taille": 48
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
        "#..B.....##........##.....B..#",
        "#........##..WWWW..##........#",
        "#............WWWW............#",
        "#....###..............###....#",
        "#....#......BB..BB......#....#",
        "#.BB........B....B........BB.#",
        "#.P....##............##....E.#",
        "#......##............##......#",
        "#.BB........B....B........BB.#",
        "#....#......BB..BB......#....#",
        "#....###..............###....#",
        "#............WWWW............#",
        "#........##..WWWW..##........#",
        "#..B.....##........##.....B..#",
        "#..BBB..................BBB..#",
        "#............BBBB............#",
        "##############################"
      ]
    }
  ]
};
