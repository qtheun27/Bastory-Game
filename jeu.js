// ==============================================================================
// 🛠️ ZONE DES RÉGLAGES - MODIFIEZ CES VALEURS POUR CHANGER LE JEU !
// ==============================================================================

const TAILLE_JOUEUR = 20;

// -- Les Personnages Jouables --
const PERSOS = {
    WIXY: { 
        nom: "WIXY",
        couleur: "#3498db", // Bleu
        pvMax: 6000, 
        vitesse: 4,         // Un peu plus lent
        arme: "bombe",
        degats: 2000,
        portee: TAILLE_JOUEUR * 5, // 5x la taille du perso (attention c'est court !)
        delaiTir: 45        // Long temps d'attente entre deux bombes
    },
    BORA: { 
        nom: "BORA",
        couleur: "#9b59b6", // Violet
        pvMax: 4800, 
        vitesse: 6,         // Plus rapide
        arme: "boomerang",
        degats: 1250,
        portee: TAILLE_JOUEUR * 8,
        delaiTir: 20        // Tire plus vite
    }
};

// -- Les Tirs (Balles) --
const VITESSE_BALLE = 10;
const TAILLE_BALLE = 8;

// -- L'Ennemi (Le Robot) --
const TAILLE_ENNEMI = 30;
const PV_MAX_ENNEMI = 10000;    // J'ai augmenté ses PV pour résister à Wixy !
const COULEUR_ENNEMI = '#e74c3c'; // Rouge

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
let etatDuJeu = "MENU"; // Peut être "MENU" ou "EN_JEU"
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
// Pour cliquer à la souris sur le menu (sur le Mac)
canvas.addEventListener('mousedown', (e) => gererClicMenu(e.clientX));

function gererDebutToucher(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        
        // Si on est dans le menu, le toucher sert à choisir le personnage
        if (etatDuJeu === "MENU") {
            gererClicMenu(touch.clientX);
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

function gererClicMenu(positionX) {
    if (etatDuJeu !== "MENU") return;
    
    if (positionX < canvas.width / 2) {
        lancerLeJeu(PERSOS.WIXY);
    } else {
        lancerLeJeu(PERSOS.BORA);
    }
}

function gererMouvementToucher(e) {
    e.preventDefault();
    if (etatDuJeu === "MENU") return;
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
    if (etatDuJeu === "MENU") return;
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
                origineX: joueur.x,
                origineY: joueur.y,
                vitesseX: Math.cos(angle) * VITESSE_BALLE,
                vitesseY: Math.sin(angle) * VITESSE_BALLE,
                arme: persoChoisi.arme,
                distanceParcourue: 0,
                etape: "aller", // Utile pour le boomerang
                dejaTouche: false // Pour que le boomerang ne blesse qu'une fois à l'aller et une fois au retour
            });
            
            compteurAvantProchainTir = persoChoisi.delaiTir;
        }
    }

    // -- 3. BALLES ET COLLISIONS --
    for (let i = balles.length - 1; i >= 0; i--) {
        let balle = balles[i];
        
        // Logique de mouvement spécifique selon l'arme
        if (balle.arme === "boomerang" && balle.etape === "retour") {
            // Le boomerang revient vers le joueur
            let angleRetour = Math.atan2(joueur.y - balle.y, joueur.x - balle.x);
            balle.vitesseX = Math.cos(angleRetour) * VITESSE_BALLE;
            balle.vitesseY = Math.sin(angleRetour) * VITESSE_BALLE;
        }

        balle.x += balle.vitesseX;
        balle.y += balle.vitesseY;
        
        // Calcul de la distance parcourue (pour savoir quand exploser ou revenir)
        balle.distanceParcourue += Math.hypot(balle.vitesseX, balle.vitesseY);

        // -- Gestion de la portée --
        if (balle.arme === "bombe" && balle.distanceParcourue >= persoChoisi.portee) {
            // La bombe a atteint sa portée max, elle explose et disparaît
            balles.splice(i, 1);
            continue;
        }

        if (balle.arme === "boomerang") {
            if (balle.etape === "aller" && balle.distanceParcourue >= persoChoisi.portee) {
                // Le boomerang a atteint la distance max, il fait demi-tour
                balle.etape = "retour";
                balle.dejaTouche = false; // Il peut retoucher l'ennemi au retour !
            }
            // Si le boomerang est sur le retour et touche presque le joueur, on le supprime
            if (balle.etape === "retour" && Math.hypot(balle.x - joueur.x, balle.y - joueur.y) < TAILLE_JOUEUR) {
                balles.splice(i, 1);
                continue;
            }
        }

        // Si la balle sort de l'écran, on la supprime (sécurité)
        if (balle.x < 0 || balle.x > canvas.width || balle.y < 0 || balle.y > canvas.height) {
            balles.splice(i, 1);
            continue;
        }

        // -- Collision avec l'ennemi --
        let distanceBalleEnnemi = Math.hypot(balle.x - ennemi.x, balle.y - ennemi.y);
        if (ennemi.pv > 0 && distanceBalleEnnemi < TAILLE_BALLE + TAILLE_ENNEMI && !balle.dejaTouche) {
            ennemi.pv -= persoChoisi.degats; 
            if (ennemi.pv < 0) ennemi.pv = 0;
            
            if (balle.arme === "bombe") {
                // La bombe disparaît direct
                balles.splice(i, 1);
            } else if (balle.arme === "boomerang") {
                // Le boomerang continue sa route mais on retient qu'il a déjà touché pour cette étape
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
    
    // Moitié gauche : WIXY
    ctx.fillStyle = PERSOS.WIXY.couleur;
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
    
    // Moitié droite : BORA
    ctx.fillStyle = PERSOS.BORA.couleur;
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Arial";
    
    ctx.fillText("Choisir " + PERSOS.WIXY.nom, canvas.width / 4, canvas.height / 2);
    ctx.fillText("Arme : Bombe", canvas.width / 4, canvas.height / 2 + 40);
    
    ctx.fillText("Choisir " + PERSOS.BORA.nom, (canvas.width / 4) * 3, canvas.height / 2);
    ctx.fillText("Arme : Boomerang", (canvas.width / 4) * 3, canvas.height / 2 + 40);
}

function dessinerLesElements() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dessiner le Joueur
    ctx.beginPath();
    ctx.arc(joueur.x, joueur.y, TAILLE_JOUEUR, 0, Math.PI * 2);
    ctx.fillStyle = persoChoisi.couleur;
    ctx.fill();
    ctx.closePath();

    // 2. Dessiner l'Ennemi
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

    // 3. Dessiner les Balles
    ctx.fillStyle = "white"; // On met les tirs en blanc
    for (let balle of balles) {
        ctx.beginPath();
        ctx.arc(balle.x, balle.y, TAILLE_BALLE, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    // 4. Dessiner les Joysticks
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