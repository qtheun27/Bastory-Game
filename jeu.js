// ==============================================================================
// 🛠️ ZONE DES RÉGLAGES - MODIFIEZ CES VALEURS POUR CHANGER LE JEU !
// ==============================================================================

const TAILLE_JOUEUR = 20;

// -- Les Personnages Jouables --
// ASTUCE : Un écran de tablette fait environ 1000 pixels de large. 
// Utilisez des centaines (ex: 400, 600) pour régler la distance !
const PERSOS = {
    WIXY: { 
        nom: "WIXY",
        couleur: "#3498db", 
        pvMax: 6000, 
        vitesse: 4,         
        arme: "bombe",
        degats: 2000,
        portee: 400,        // 400 pixels (portée moyenne/courte)
        delaiTir: 45        
    },
    BORA: { 
        nom: "BORA",
        couleur: "#9b59b6", 
        pvMax: 4800, 
        vitesse: 6,         
        arme: "boomerang",
        degats: 1250,
        portee: 700,        // 700 pixels (longue portée)
        delaiTir: 20        
    }
};

const VITESSE_BALLE = 10;
const TAILLE_BALLE = 8;

const TAILLE_ENNEMI = 30;
const PV_MAX_ENNEMI = 10000;    
const COULEUR_ENNEMI = '#e74c3c'; 

// ==============================================================================
// 💻 CODE DU JEU (La mécanique interne)
// ==============================================================================

const canvas = document.querySelector('canvas') || document.createElement('canvas');
if (!canvas.parentNode) document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function redimensionner() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ennemi.x = canvas.width / 2;
    ennemi.y = canvas.height / 2;
}
window.addEventListener('resize', redimensionner);

// -- Variables d'état --
let etatDuJeu = "MENU"; // Peut être "MENU", "EN_JEU", ou "VICTOIRE"
let persoChoisi = null;

let joueur = { x: 100, y: 100, pv: 0 };
let ennemi = { x: 0, y: 0, pv: PV_MAX_ENNEMI };
let balles = []; 
let compteurAvantProchainTir = 0; 

// -- Joysticks & Contrôles --
let joystickGauche = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };
let joystickDroit  = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };
let touchesClavier = {};

window.addEventListener('keydown', (e) => touchesClavier[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => touchesClavier[e.key.toLowerCase()] = false);

canvas.addEventListener('touchstart', gererDebutToucher, {passive: false});
canvas.addEventListener('touchmove', gererMouvementToucher, {passive: false});
canvas.addEventListener('touchend', gererFinToucher);
canvas.addEventListener('touchcancel', gererFinToucher);
canvas.addEventListener('mousedown', (e) => gererClicEcran(e.clientX)); // Pour le test sur Mac

function gererDebutToucher(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        
        // Si on est dans le menu ou sur l'écran de victoire, on gère le choix
        if (etatDuJeu === "MENU" || etatDuJeu === "VICTOIRE") {
            gererClicEcran(touch.clientX);
            continue;
        }

        // Si on est en jeu, on gère les joysticks
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
    // Si on a gagné, n'importe quel clic ramène au menu
    if (etatDuJeu === "VICTOIRE") {
        etatDuJeu = "MENU";
        return;
    }
    
    // Si on est dans le menu, on choisit le perso selon le côté cliqué
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
    joueur.x = 100;
    joueur.y = canvas.height / 2;
    ennemi.pv = PV_MAX_ENNEMI;
    balles = [];
    // On libère les joysticks par sécurité
    joystickGauche.actif = false;
    joystickDroit.actif = false;
    etatDuJeu = "EN_JEU";
}

// ==============================================================================
// 🔄 BOUCLE PRINCIPALE
// ==============================================================================

function boucleDeJeu() {
    if (etatDuJeu === "MENU") {
        dessinerMenu();
    } else if (etatDuJeu === "EN_JEU") {
        mettreAJourLaLogique();
        dessinerLesElements();
    } else if (etatDuJeu === "VICTOIRE") {
        dessinerLesElements(); // Garde le jeu affiché en fond
        dessinerVictoire();    // Affiche le texte par-dessus
    }
    requestAnimationFrame(boucleDeJeu);
}

function mettreAJourLaLogique() {
    // -- 1. DEPLACEMENT --
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

    // -- 2. TIR --
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

    // -- 3. BALLES ET COLLISIONS --
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

        // -- Gestion de la portée (avec la nouvelle valeur en pixels) --
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

        // -- Collision avec l'ennemi --
        let distanceBalleEnnemi = Math.hypot(balle.x - ennemi.x, balle.y - ennemi.y);
        if (ennemi.pv > 0 && distanceBalleEnnemi < TAILLE_BALLE + TAILLE_ENNEMI && !balle.dejaTouche) {
            ennemi.pv -= persoChoisi.degats; 
            if (ennemi.pv <= 0) {
                ennemi.pv = 0;
                etatDuJeu = "VICTOIRE"; // L'ennemi n'a plus de vie = on a gagné !
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
// 🎨 RENDU VISUEL
// ==============================================================================

function dessinerMenu() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = PERSOS.WIXY.couleur;
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
    
    ctx.fillStyle = PERSOS.BORA.couleur;
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Arial";
    
    ctx.fillText("Choisir " + PERSOS.WIXY.nom, canvas.width / 4, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Bombe (Courte portée)", canvas.width / 4, canvas.height / 2 + 40);
    
    ctx.font = "bold 30px Arial";
    ctx.fillText("Choisir " + PERSOS.BORA.nom, (canvas.width / 4) * 3, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Boomerang (Longue portée)", (canvas.width / 4) * 3, canvas.height / 2 + 40);
}

function dessinerVictoire() {
    // Fond semi-transparent pour griser le jeu derrière
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texte de victoire
    ctx.fillStyle = "#f1c40f"; // Jaune or
    ctx.textAlign = "center";
    ctx.font = "bold 60px Arial";
    ctx.fillText("VICTOIRE !", canvas.width / 2, canvas.height / 2);
    
    ctx.fillStyle = "white";
    ctx.font = "25px Arial";
    ctx.fillText("Touchez l'écran pour rejouer", canvas.width / 2, canvas.height / 2 + 60);
}

function dessinerLesElements() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(joueur.x, joueur.y, TAILLE_JOUEUR, 0, Math.PI * 2);
    ctx.fillStyle = persoChoisi.couleur;
    ctx.fill();
    ctx.closePath();

    if (ennemi.pv > 0) {
        ctx.beginPath();
        ctx.arc(ennemi.x, ennemi.y, TAILLE_ENNEMI, 0, Math.PI * 2);
        ctx.fillStyle = COULEUR_ENNEMI;
        ctx.fill();
        ctx.closePath();

        ctx.fillStyle = 'black';
        ctx.fillRect(ennemi.x - 25, ennemi.y - 45, 50, 10);
        ctx.fillStyle = '#2ecc71';
        let pourcentagePv = ennemi.pv / PV_MAX_ENNEMI;
        ctx.fillRect(ennemi.x - 25, ennemi.y - 45, 50 * pourcentagePv, 10);
    }

    ctx.fillStyle = "white"; 
    for (let balle of balles) {
        ctx.beginPath();
        ctx.arc(balle.x, balle.y, TAILLE_BALLE, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
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

// ==============================================================================
// 🚀 DÉMARRAGE
// ==============================================================================
redimensionner(); 
boucleDeJeu();