// ==============================================================================
// 🛠️ ZONE DES RÉGLAGES - MODIFIEZ CES VALEURS POUR CHANGER LE JEU !
// ==============================================================================

// -- Le Joueur --
const VITESSE_JOUEUR = 5;       // Vitesse de déplacement du personnage
const TAILLE_JOUEUR = 20;       // Taille du cercle du joueur
const COULEUR_JOUEUR = '#3498db'; // Couleur bleue (code hexadécimal)

// -- Les Tirs (Balles) --
const VITESSE_BALLE = 12;       // Vitesse des projectiles
const TAILLE_BALLE = 6;         // Taille de la balle
const DEGATS_BALLE = 10;        // Points de vie enlevés à l'ennemi par balle
const DELAI_TIR = 15;           // Temps d'attente entre 2 tirs (plus le chiffre est petit, plus ça tire vite !)
const COULEUR_BALLE = '#f1c40f';// Couleur jaune

// -- L'Ennemi (Le Robot) --
const TAILLE_ENNEMI = 30;       // Taille du méchant
const PV_MAX_ENNEMI = 100;      // Points de vie maximum
const COULEUR_ENNEMI = '#e74c3c'; // Couleur rouge

// ==============================================================================
// 💻 CODE DU JEU (La mécanique interne)
// ==============================================================================

// 1. Initialisation du Canvas (la zone de dessin)
const canvas = document.querySelector('canvas') || document.createElement('canvas');
if (!canvas.parentNode) document.body.appendChild(canvas); // Crée le canvas si pas fait dans l'HTML
const ctx = canvas.getContext('2d');

// Met le canvas en plein écran
function redimensionner() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Repositionne l'ennemi au centre en cas de changement de taille d'écran
    ennemi.x = canvas.width / 2;
    ennemi.y = canvas.height / 2;
}
window.addEventListener('resize', redimensionner);

// 2. Nos éléments de jeu (Variables)
let joueur = { 
    x: 100, 
    y: 100 
};

let ennemi = { 
    x: 0, 
    y: 0, 
    pv: PV_MAX_ENNEMI // pv = Points de Vie
};

let balles = []; // Un tableau (liste) qui va contenir toutes les balles tirées
let compteurAvantProchainTir = 0; // Un chronomètre pour ne pas tirer 1000 balles par seconde

// 3. Gestion des contrôles (Clavier pour le Mac, Tactile pour la Tablette)
let touchesClavier = {};

// -- Les deux Joysticks Tactiles --
// joystickGauche = Déplacement | joystickDroit = Visée et Tir
let joystickGauche = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };
let joystickDroit  = { actif: false, id: null, origineX: 0, origineY: 0, actuelX: 0, actuelY: 0 };

// Écoute du clavier (Pour tester sur le Mac avec ZQSD / Flèches directionnelles)
window.addEventListener('keydown', (e) => touchesClavier[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => touchesClavier[e.key.toLowerCase()] = false);

// Écoute du tactile (Pour jouer sur la tablette)
canvas.addEventListener('touchstart', gererDebutToucher, {passive: false});
canvas.addEventListener('touchmove', gererMouvementToucher, {passive: false});
canvas.addEventListener('touchend', gererFinToucher);
canvas.addEventListener('touchcancel', gererFinToucher);

function gererDebutToucher(e) {
    e.preventDefault(); // Empêche l'écran de scroller
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        // Si on touche à gauche de l'écran -> Joystick de mouvement
        if (touch.clientX < canvas.width / 2 && !joystickGauche.actif) {
            joystickGauche.actif = true;
            joystickGauche.id = touch.identifier;
            joystickGauche.origineX = touch.clientX;
            joystickGauche.origineY = touch.clientY;
            joystickGauche.actuelX = touch.clientX;
            joystickGauche.actuelY = touch.clientY;
        } 
        // Si on touche à droite de l'écran -> Joystick de tir
        else if (touch.clientX >= canvas.width / 2 && !joystickDroit.actif) {
            joystickDroit.actif = true;
            joystickDroit.id = touch.identifier;
            joystickDroit.origineX = touch.clientX;
            joystickDroit.origineY = touch.clientY;
            joystickDroit.actuelX = touch.clientX;
            joystickDroit.actuelY = touch.clientY;
        }
    }
}

function gererMouvementToucher(e) {
    e.preventDefault();
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
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        if (joystickGauche.actif && touch.identifier === joystickGauche.id) {
            joystickGauche.actif = false;
        }
        if (joystickDroit.actif && touch.identifier === joystickDroit.id) {
            joystickDroit.actif = false;
        }
    }
}

// ==============================================================================
// 🔄 BOUCLE PRINCIPALE (Mise à jour et Dessin, 60 fois par seconde)
// ==============================================================================

function boucleDeJeu() {
    mettreAJourLaLogique();
    dessinerLesElements();
    requestAnimationFrame(boucleDeJeu); // Relance la boucle
}

function mettreAJourLaLogique() {
    // -- 1. DEPLACEMENT DU JOUEUR --
    let deplacementX = 0;
    let deplacementY = 0;

    // Via clavier (Test Mac)
    if (touchesClavier['q'] || touchesClavier['a'] || touchesClavier['arrowleft']) deplacementX -= VITESSE_JOUEUR;
    if (touchesClavier['d'] || touchesClavier['arrowright']) deplacementX += VITESSE_JOUEUR;
    if (touchesClavier['z'] || touchesClavier['w'] || touchesClavier['arrowup']) deplacementY -= VITESSE_JOUEUR;
    if (touchesClavier['s'] || touchesClavier['arrowdown']) deplacementY += VITESSE_JOUEUR;

    // Via Joystick Gauche (Tablette)
    if (joystickGauche.actif) {
        let diffX = joystickGauche.actuelX - joystickGauche.origineX;
        let diffY = joystickGauche.actuelY - joystickGauche.origineY;
        let distance = Math.hypot(diffX, diffY);
        
        // On limite la force du joystick pour ne pas aller trop vite
        if (distance > 0) {
            let force = Math.min(distance / 50, 1); // 50 pixels est la taille max du joystick
            deplacementX = (diffX / distance) * VITESSE_JOUEUR * force;
            deplacementY = (diffY / distance) * VITESSE_JOUEUR * force;
        }
    }

    // Appliquer le déplacement
    joueur.x += deplacementX;
    joueur.y += deplacementY;

    // Empêcher le joueur de sortir de l'écran
    joueur.x = Math.max(TAILLE_JOUEUR, Math.min(canvas.width - TAILLE_JOUEUR, joueur.x));
    joueur.y = Math.max(TAILLE_JOUEUR, Math.min(canvas.height - TAILLE_JOUEUR, joueur.y));

    // -- 2. SYSTEME DE TIR (Joystick Droit) --
    if (compteurAvantProchainTir > 0) {
        compteurAvantProchainTir--; // On fait diminuer le chrono
    }

    if (joystickDroit.actif) {
        let diffX = joystickDroit.actuelX - joystickDroit.origineX;
        let diffY = joystickDroit.actuelY - joystickDroit.origineY;
        let distance = Math.hypot(diffX, diffY);

        // Si on tire un peu le joystick et que le chrono est à zéro, on tire !
        if (distance > 10 && compteurAvantProchainTir <= 0) {
            let angle = Math.atan2(diffY, diffX); // Calcule la direction (en radians)
            
            // On crée une nouvelle balle
            balles.push({
                x: joueur.x,
                y: joueur.y,
                vitesseX: Math.cos(angle) * VITESSE_BALLE,
                vitesseY: Math.sin(angle) * VITESSE_BALLE
            });
            
            compteurAvantProchainTir = DELAI_TIR; // Réinitialise le chrono
        }
    }

    // -- 3. DEPLACEMENT DES BALLES ET COLLISIONS --
    for (let i = balles.length - 1; i >= 0; i--) {
        let balle = balles[i];
        
        // Fait avancer la balle
        balle.x += balle.vitesseX;
        balle.y += balle.vitesseY;

        // Si la balle sort de l'écran, on la supprime
        if (balle.x < 0 || balle.x > canvas.width || balle.y < 0 || balle.y > canvas.height) {
            balles.splice(i, 1);
            continue;
        }

        // Vérification de collision avec l'ennemi (Théorème de Pythagore pour calculer la distance)
        let distanceBalleEnnemi = Math.hypot(balle.x - ennemi.x, balle.y - ennemi.y);
        
        if (ennemi.pv > 0 && distanceBalleEnnemi < TAILLE_BALLE + TAILLE_ENNEMI) {
            ennemi.pv -= DEGATS_BALLE; // L'ennemi perd des PV
            balles.splice(i, 1); // La balle disparaît
            if (ennemi.pv < 0) ennemi.pv = 0; // Empêche d'avoir des PV négatifs
        }
    }
}

// ==============================================================================
// 🎨 DESSIN SUR L'ÉCRAN (Le rendu visuel)
// ==============================================================================

function dessinerLesElements() {
    // Effacer l'écran précédent (fond transparent pour laisser voir le CSS)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dessiner le Joueur
    ctx.beginPath();
    ctx.arc(joueur.x, joueur.y, TAILLE_JOUEUR, 0, Math.PI * 2);
    ctx.fillStyle = COULEUR_JOUEUR;
    ctx.fill();
    ctx.closePath();

    // 2. Dessiner l'Ennemi (s'il est encore en vie)
    if (ennemi.pv > 0) {
        // Le corps de l'ennemi
        ctx.beginPath();
        ctx.arc(ennemi.x, ennemi.y, TAILLE_ENNEMI, 0, Math.PI * 2);
        ctx.fillStyle = COULEUR_ENNEMI;
        ctx.fill();
        ctx.closePath();

        // La barre de vie (fond noir)
        ctx.fillStyle = 'black';
        ctx.fillRect(ennemi.x - 25, ennemi.y - 45, 50, 10);
        // La barre de vie (partie verte restante)
        ctx.fillStyle = '#2ecc71'; // Vert
        let pourcentagePv = ennemi.pv / PV_MAX_ENNEMI;
        ctx.fillRect(ennemi.x - 25, ennemi.y - 45, 50 * pourcentagePv, 10);
    }

    // 3. Dessiner les Balles
    ctx.fillStyle = COULEUR_BALLE;
    for (let balle of balles) {
        ctx.beginPath();
        ctx.arc(balle.x, balle.y, TAILLE_BALLE, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    // 4. Dessiner les Joysticks (UI Tactile)
    dessinerJoystick(joystickGauche);
    dessinerJoystick(joystickDroit);
}

// Fonction utilitaire pour dessiner un joystick s'il est actif
function dessinerJoystick(joystick) {
    if (joystick.actif) {
        // La base (Grand cercle transparent)
        ctx.beginPath();
        ctx.arc(joystick.origineX, joystick.origineY, 50, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Blanc transparent
        ctx.fill();
        
        // Le bouton (Petit cercle intérieur, limité au rayon de la base)
        let diffX = joystick.actuelX - joystick.origineX;
        let diffY = joystick.actuelY - joystick.origineY;
        let distance = Math.hypot(diffX, diffY);
        let limite = 50; // Rayon max
        
        let boutonX = joystick.actuelX;
        let boutonY = joystick.actuelY;
        
        if (distance > limite) {
            boutonX = joystick.origineX + (diffX / distance) * limite;
            boutonY = joystick.origineY + (diffY / distance) * limite;
        }

        ctx.beginPath();
        ctx.arc(boutonX, boutonY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Blanc plus visible
        ctx.fill();
    }
}

// ==============================================================================
// 🚀 DÉMARRAGE DU JEU
// ==============================================================================
redimensionner(); // Ajuste la taille dès le lancement
boucleDeJeu();    // Lance le moteur du jeu