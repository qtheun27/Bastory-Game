// ==============================================================================
// 🛠️ ZONE DES RÉGLAGES - MODIFIEZ CES VALEURS POUR CHANGER LE JEU !
// ==============================================================================

const TAILLE_JOUEUR = 20; 

const PERSOS = {
    WIXY: { 
        nom: "WIXY",
        image: "images/wixy.png",  
        couleur: "#3498db", 
        pvMax: 6000, 
        vitesse: 4,         
        arme: "bombe",
        degats: 2000,
        portee: 300,        
        delaiTir: 45        
    },
    BORA: { 
        nom: "BORA",
        image: "images/bora.png",  
        couleur: "#9b59b6", 
        pvMax: 4800, 
        vitesse: 6,         
        arme: "boomerang",
        degats: 1250,
        portee: 500,        
        delaiTir: 20        
    }
};

const VITESSE_BALLE = 10;
const TAILLE_BALLE = 15; 
const IMAGE_BOMBE = "images/bombe.png";
const IMAGE_BOOMERANG = "images/boomerang.png";

const TAILLE_ENNEMI = 40;        
const IMAGE_BOSS = "images/boss.png";   
const PV_MAX_ENNEMI = 10000;    
const VITESSE_ENNEMI = 1.5; 
const DEGATS_BOSS = 3000;        // Dégâts du coup de maillet
const DELAI_ATTAQUE_BOSS = 60;   // Temps de recharge du Boss (60 = environ 1 seconde)
const COULEUR_ENNEMI = '#e74c3c'; 

// ==============================================================================
// 💻 PREPARATION DES IMAGES
// ==============================================================================

let imgWixy = new Image(); imgWixy.src = PERSOS.WIXY.image;
PERSOS.WIXY.imgObj = imgWixy; 

let imgBora = new Image(); imgBora.src = PERSOS.BORA.image;
PERSOS.BORA.imgObj = imgBora;

let imgEnnemi = new Image(); imgEnnemi.src = IMAGE_BOSS;
let imgBombe = new Image(); imgBombe.src = IMAGE_BOMBE;
let imgBoomerang = new Image(); imgBoomerang.src = IMAGE_BOOMERANG;

// ==============================================================================
// 💻 CODE DU JEU (Variables et Contrôles)
// ==============================================================================

const canvas = document.querySelector('canvas') || document.createElement('canvas');
if (!canvas.parentNode) document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function redimensionner() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ennemi.x = canvas.width - 100;
    ennemi.y = canvas.height - 100;
}
window.addEventListener('resize', redimensionner);

let etatDuJeu = "MENU"; 
let persoChoisi = null;

let joueur = { x: 100, y: 100, pv: 0, pvMax: 0 };
let ennemi = { x: 0, y: 0, pv: PV_MAX_ENNEMI, chronoAttaque: 0 };
let balles = []; 
let compteurAvantProchainTir = 0; 

let joystickGauche = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };
let joystickDroit  = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };
let touchesClavier = {};

window.addEventListener('keydown', (e) => touchesClavier[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => touchesClavier[e.key.toLowerCase()] = false);

canvas.addEventListener('touchstart', gererDebutToucher, {passive: false});
canvas.addEventListener('touchmove', gererMouvementToucher, {passive: false});
canvas.addEventListener('touchend', gererFinToucher);
canvas.addEventListener('touchcancel', gererFinToucher);
canvas.addEventListener('mousedown', (e) => gererClicEcran(e.clientX)); 

function gererDebutToucher(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        
        if (etatDuJeu === "MENU" || etatDuJeu === "VICTOIRE" || etatDuJeu === "DEFAITE") {
            gererClicEcran(touch.clientX);
            continue;
        }

        if (touch.clientX < canvas.width / 2 && !joystickGauche.actif) {
            joystickGauche.actif = true;
            joystickGauche.id = touch.identifier;
            joystickGauche.origineX = touch.clientX;
            joystickGauche.origineY = touch.clientY;
            joystickGauche.actuelX = touch.clientX;
            joystickGauche.actuelY = touch.clientY;
        } else if (touch.clientX >= canvas.width / 2 && !joystickDroit.actif) {
            joystickDroit.actif = true;
            joystickDroit.id = touch.identifier;
            joystickDroit.origineX = touch.clientX;
            joystickDroit.origineY = touch.clientY;
            joystickDroit.actuelX = touch.clientX;
            joystickDroit.actuelY = touch.clientY;
        }
    }
}

function gererClicEcran(positionX) {
    if (etatDuJeu === "VICTOIRE" || etatDuJeu === "DEFAITE") {
        etatDuJeu = "MENU";
        return;
    }
    if (etatDuJeu === "MENU") {
        if (positionX < canvas.width / 2) {
            lancerLeJeu(PERSOS.WIXY);
        } else {
            lancerLeJeu(PERSOS.BORA);
        }
    }
}

function gererMouvementToucher(e) {
    e.preventDefault();
    if (etatDuJeu !== "EN_JEU") return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        if (joystickGauche.actif && touch.identifier === joystickGauche.id) {
            joystickGauche.actuelX = touch.clientX;
            joystickGauche.actuelY = touch.clientY;
        }
        if (joystickDroit.actif && touch.identifier === joystickDroit.id) {
            joystickDroit.actuelX = touch.clientX;
            joystickDroit.actuelY = touch.clientY;
        }
    }
}

function gererFinToucher(e) {
    if (etatDuJeu !== "EN_JEU") return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        if (joystickGauche.actif && touch.identifier === joystickGauche.id) joystickGauche.actif = false;
        if (joystickDroit.actif && touch.identifier === joystickDroit.id) joystickDroit.actif = false;
    }
}

function lancerLeJeu(personnage) {
    persoChoisi = personnage;
    joueur.pv = personnage.pvMax;
    joueur.pvMax = personnage.pvMax;
    joueur.x = 100;
    joueur.y = canvas.height / 2;
    
    ennemi.pv = PV_MAX_ENNEMI;
    ennemi.x = canvas.width - 100;
    ennemi.y = canvas.height / 2;
    ennemi.chronoAttaque = 0;
    
    balles = [];
    joystickGauche.actif = false;
    joystickDroit.actif = false;
    etatDuJeu = "EN_JEU";
}

// ==============================================================================
// 🔄 BOUCLE PRINCIPALE ET LOGIQUE
// ==============================================================================

function boucleDeJeu() {
    if (etatDuJeu === "MENU") {
        dessinerMenu();
    } else if (etatDuJeu === "EN_JEU") {
        mettreAJourLaLogique();
        dessinerLesElements();
    } else if (etatDuJeu === "VICTOIRE") {
        dessinerLesElements(); 
        dessinerEcranFin("VICTOIRE !", "#f1c40f");    
    } else if (etatDuJeu === "DEFAITE") {
        dessinerLesElements(); 
        dessinerEcranFin("DEFAITE...", "#e74c3c");    
    }
    requestAnimationFrame(boucleDeJeu);
}

function mettreAJourLaLogique() {
    // 1. DÉPLACEMENT JOUEUR
    let deplacementX = 0;
    let deplacementY = 0;

    if (touchesClavier['q'] || touchesClavier['a'] || touchesClavier['arrowleft']) deplacementX -= persoChoisi.vitesse;
    if (touchesClavier['d'] || touchesClavier['arrowright']) deplacementX += persoChoisi.vitesse;
    if (touchesClavier['z'] || touchesClavier['w'] || touchesClavier['arrowup']) deplacementY -= persoChoisi.vitesse;
    if (touchesClavier['s'] || touchesClavier['arrowdown']) deplacementY += persoChoisi.vitesse;

    if (joystickGauche.actif) {
        let diffX = joystickGauche.actuelX - joystickGauche.origineX;
        let diffY = joystickGauche.actuelY - joystickGauche.origineY;
        let distance = Math.hypot(diffX, diffY);
        if (distance > 0) {
            let force = Math.min(distance / 50, 1); 
            deplacementX = (diffX / distance) * persoChoisi.vitesse * force;
            deplacementY = (diffY / distance) * persoChoisi.vitesse * force;
        }
    }

    joueur.x += deplacementX;
    joueur.y += deplacementY;
    joueur.x = Math.max(TAILLE_JOUEUR, Math.min(canvas.width - TAILLE_JOUEUR, joueur.x));
    joueur.y = Math.max(TAILLE_JOUEUR, Math.min(canvas.height - TAILLE_JOUEUR, joueur.y));

    // 2. COMPORTEMENT DU BOSS
    if (ennemi.pv > 0) {
        let angleVersJoueur = Math.atan2(joueur.y - ennemi.y, joueur.x - ennemi.x);
        ennemi.x += Math.cos(angleVersJoueur) * VITESSE_ENNEMI;
        ennemi.y += Math.sin(angleVersJoueur) * VITESSE_ENNEMI;

        if (ennemi.chronoAttaque > 0) {
            ennemi.chronoAttaque--;
        }

        let distanceBossJoueur = Math.hypot(joueur.x - ennemi.x, joueur.y - ennemi.y);
        
        // Attaque au corps-à-corps du boss
        if (distanceBossJoueur < TAILLE_JOUEUR + TAILLE_ENNEMI + 10) {
            if (ennemi.chronoAttaque <= 0) {
                joueur.pv -= DEGATS_BOSS; // Coup de maillet !
                ennemi.chronoAttaque = DELAI_ATTAQUE_BOSS; // Le boss se repose
                
                if (joueur.pv <= 0) {
                    joueur.pv = 0;
                    etatDuJeu = "DEFAITE";
                }
            }
        }
    }

    // 3. TIR DU JOUEUR
    if (compteurAvantProchainTir > 0) compteurAvantProchainTir--;

    if (joystickDroit.actif) {
        let diffX = joystickDroit.actuelX - joystickDroit.origineX;
        let diffY = joystickDroit.actuelY - joystickDroit.origineY;
        let distance = Math.hypot(diffX, diffY);

        if (distance > 10 && compteurAvantProchainTir <= 0) {
            let angle = Math.atan2(diffY, diffX); 
            balles.push({
                x: joueur.x,
                y: joueur.y,
                vitesseX: Math.cos(angle) * VITESSE_BALLE,
                vitesseY: Math.sin(angle) * VITESSE_BALLE,
                arme: persoChoisi.arme,
                distanceParcourue: 0,
                etape: "aller", 
                dejaTouche: false 
            });
            compteurAvantProchainTir = persoChoisi.delaiTir;
        }
    }

    // 4. BALLES ET COLLISIONS
    for (let i = balles.length - 1; i >= 0; i--) {
        let balle = balles[i];
        
        if (balle.arme === "boomerang" && balle.etape === "retour") {
            let angleRetour = Math.atan2(joueur.y - balle.y, joueur.x - balle.x);
            balle.vitesseX = Math.cos(angleRetour) * VITESSE_BALLE;
            balle.vitesseY = Math.sin(angleRetour) * VITESSE_BALLE;
        }

        balle.x += balle.vitesseX;
        balle.y += balle.vitesseY;
        balle.distanceParcourue += Math.hypot(balle.vitesseX, balle.vitesseY);

        if (balle.arme === "bombe" && balle.distanceParcourue >= persoChoisi.portee) {
            balles.splice(i, 1);
            continue;
        }

        if (balle.arme === "boomerang") {
            if (balle.etape === "aller" && balle.distanceParcourue >= persoChoisi.portee) {
                balle.etape = "retour";
                balle.dejaTouche = false; 
            }
            if (balle.etape === "retour" && Math.hypot(balle.x - joueur.x, balle.y - joueur.y) < TAILLE_JOUEUR) {
                balles.splice(i, 1);
                continue;
            }
        }

        if (balle.x < 0 || balle.x > canvas.width || balle.y < 0 || balle.y > canvas.height) {
            balles.splice(i, 1);
            continue;
        }

        let distanceBalleEnnemi = Math.hypot(balle.x - ennemi.x, balle.y - ennemi.y);
        if (ennemi.pv > 0 && distanceBalleEnnemi < TAILLE_BALLE + TAILLE_ENNEMI && !balle.dejaTouche) {
            ennemi.pv -= persoChoisi.degats; 
            if (ennemi.pv <= 0) {
                ennemi.pv = 0;
                etatDuJeu = "VICTOIRE"; 
            }
            if (balle.arme === "bombe") {
                balles.splice(i, 1);
            } else if (balle.arme === "boomerang") {
                balle.dejaTouche = true; 
            }
        }
    }
}

// ==============================================================================
// 🎨 RENDU VISUEL (DESSIN)
// ==============================================================================

// Fonction pour dessiner les ombres (Crée l'illusion de 3D)
function dessinerOmbre(x, y, taille) {
    ctx.beginPath();
    // Dessine une ellipse (cercle aplati) sous le personnage
    ctx.ellipse(x, y + taille, taille, taille / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fill();
    ctx.closePath();
}

function dessinerMenu() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = PERSOS.WIXY.couleur;
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
    ctx.fillStyle = PERSOS.BORA.couleur;
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    
    if (PERSOS.WIXY.imgObj.complete && PERSOS.WIXY.imgObj.naturalHeight !== 0) {
        ctx.drawImage(PERSOS.WIXY.imgObj, (canvas.width / 4) - 50, (canvas.height / 2) - 120, 100, 100);
    }
    ctx.font = "bold 30px Arial";
    ctx.fillText("Choisir " + PERSOS.WIXY.nom, canvas.width / 4, canvas.height / 2 + 30);
    ctx.font = "20px Arial";
    ctx.fillText("Bombe (Courte portée)", canvas.width / 4, canvas.height / 2 + 70);
    
    if (PERSOS.BORA.imgObj.complete && PERSOS.BORA.imgObj.naturalHeight !== 0) {
        ctx.drawImage(PERSOS.BORA.imgObj, (canvas.width / 4) * 3 - 50, (canvas.height / 2) - 120, 100, 100);
    }
    ctx.font = "bold 30px Arial";
    ctx.fillText("Choisir " + PERSOS.BORA.nom, (canvas.width / 4) * 3, canvas.height / 2 + 30);
    ctx.font = "20px Arial";
    ctx.fillText("Boomerang (Longue portée)", (canvas.width / 4) * 3, canvas.height / 2 + 70);
}

function dessinerEcranFin(texte, couleurText) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = couleurText; 
    ctx.textAlign = "center";
    ctx.font = "bold 60px Arial";
    ctx.fillText(texte, canvas.width / 2, canvas.height / 2);
    
    ctx.fillStyle = "white";
    ctx.font = "25px Arial";
    ctx.fillText("Touchez l'écran pour rejouer", canvas.width / 2, canvas.height / 2 + 60);
}

function dessinerLesElements() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // DESSINER LE JOUEUR
    dessinerOmbre(joueur.x, joueur.y, TAILLE_JOUEUR); // L'ombre donne l'effet 3D !
    if (persoChoisi.imgObj.complete && persoChoisi.imgObj.naturalHeight !== 0) {
        ctx.drawImage(persoChoisi.imgObj, joueur.x - TAILLE_JOUEUR, joueur.y - TAILLE_JOUEUR - 10, TAILLE_JOUEUR * 2, TAILLE_JOUEUR * 2);
    } else {
        ctx.beginPath();
        ctx.arc(joueur.x, joueur.y - 10, TAILLE_JOUEUR, 0, Math.PI * 2);
        ctx.fillStyle = persoChoisi.couleur;
        ctx.fill();
        ctx.closePath();
    }

    // Barre de vie Joueur (Bleue)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(joueur.x - 20, joueur.y - 40, 40, 8);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(joueur.x - 20, joueur.y - 40, 40 * (Math.max(joueur.pv, 0) / joueur.pvMax), 8);

    // DESSINER LE BOSS
    if (ennemi.pv > 0) {
        dessinerOmbre(ennemi.x, ennemi.y, TAILLE_ENNEMI - 10);
        if (imgEnnemi.complete && imgEnnemi.naturalHeight !== 0) {
            ctx.drawImage(imgEnnemi, ennemi.x - TAILLE_ENNEMI, ennemi.y - TAILLE_ENNEMI - 20, TAILLE_ENNEMI * 2, TAILLE_ENNEMI * 2);
        } else {
            ctx.beginPath();
            ctx.arc(ennemi.x, ennemi.y - 20, TAILLE_ENNEMI, 0, Math.PI * 2);
            ctx.fillStyle = COULEUR_ENNEMI;
            ctx.fill();
            ctx.closePath();
        }

        // Barre de vie Boss (Rouge)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(ennemi.x - 25, ennemi.y - 65, 50, 10);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(ennemi.x - 25, ennemi.y - 65, 50 * (Math.max(ennemi.pv, 0) / PV_MAX_ENNEMI), 10);
    }

    // DESSINER LES TIRS
    for (let balle of balles) {
        let imageAUtiliser = balle.arme === "bombe" ? imgBombe : imgBoomerang;
        if (imageAUtiliser.complete && imageAUtiliser.naturalHeight !== 0) {
            ctx.drawImage(imageAUtiliser, balle.x - TAILLE_BALLE, balle.y - TAILLE_BALLE, TAILLE_BALLE * 2, TAILLE_BALLE * 2);
        } else {
            ctx.beginPath();
            ctx.arc(balle.x, balle.y, TAILLE_BALLE, 0, Math.PI * 2);
            ctx.fillStyle = "white";
            ctx.fill();
            ctx.closePath();
        }
    }

    dessinerJoystick(joystickGauche);
    dessinerJoystick(joystickDroit);
}

function dessinerJoystick(joystick) {
    if (joystick.actif) {
        ctx.beginPath();
        ctx.arc(joystick.origineX, joystick.origineY, 50, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        let diffX = joystick.actuelX - joystick.origineX;
        let diffY = joystick.actuelY - joystick.origineY;
        let distance = Math.hypot(diffX, diffY);
        let limite = 50;
        let boutonX = joystick.actuelX;
        let boutonY = joystick.actuelY;
        
        if (distance > limite) {
            boutonX = joystick.origineX + (diffX / distance) * limite;
            boutonY = joystick.origineY + (diffY / distance) * limite;
        }

        ctx.beginPath();
        ctx.arc(boutonX, boutonY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
    }
}

redimensionner(); 
boucleDeJeu();