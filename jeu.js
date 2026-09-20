// =====================================================================
// 🎮 BASTORY GAME — MOTEUR (solo, boss multiples, multijoueur 1V1)
// Données : Firebase / config.js — éditables sans code dans admin.html
// =====================================================================

// ---------- 1. CONFIG & FIREBASE ----------
const CONFIG = migrerConfig(window.CONFIG_DISTANTE || JSON.parse(JSON.stringify(CONFIG_PAR_DEFAUT)));
const TUILE = 64, HAUT_MUR = 28;
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
let rtdb = null;
try { rtdb = firebase.database(); } catch (e) { console.warn('Realtime Database non configurée → multijoueur désactivé', e); }
let db = null;
try { db = firebase.firestore(); } catch (e) { console.warn('Firestore indisponible → pas de points', e); }
let user = null;

// ---------- 2. IMAGES ----------
const cacheImg = {}, cacheBlanc = new Map();
function img(src) {
  if (!src) return null;
  if (!cacheImg[src]) {
    const i = new Image(); cacheImg[src] = i;
    if (src.startsWith('fb:')) { // image stockée dans Firestore (un document par image)
      const c = FIREBASE_CONFIG;
      fetch(`https://firestore.googleapis.com/v1/projects/${c.projectId}/databases/(default)/documents/images/${src.slice(3)}?key=${c.apiKey}`)
        .then(r => r.json()).then(d => { i.src = d.fields.data.stringValue; }).catch(() => {});
    } else i.src = src;
  }
  return cacheImg[src];
}
const pret = i => i && ((i.complete && i.naturalWidth > 0) || (i.getContext && i.width > 0)); // image ou canvas prêt
function blanc(i) { // silhouette blanche pour le flash quand on est touché
  if (!cacheBlanc.has(i)) {
    const c = document.createElement('canvas'); c.width = i.naturalWidth || i.width; c.height = i.naturalHeight || i.height;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    cacheBlanc.set(i, c);
  }
  return cacheBlanc.get(i);
}
CONFIG.persos.forEach(p => img(p.image));
Object.values(CONFIG.armes).forEach(a => img(a.image));
Object.values(CONFIG.bosses).forEach(b => img(b.image));

// ---------- 3. CANVAS ----------
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1, zoom = 1;
let tourne = false; // téléphone tenu en portrait → on fait pivoter l'appli pour rester en paysage
function redim() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  tourne = matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth;
  document.documentElement.classList.toggle('tourne', tourne);
  document.body.style.width = tourne ? innerHeight + 'px' : ''; document.body.style.height = tourne ? innerWidth + 'px' : '';
  W = tourne ? innerHeight : innerWidth; H = tourne ? innerWidth : innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  zoom = Math.max(0.55, Math.min(1.3, Math.min(W, H * 1.7) / (TUILE * 15)));
}
addEventListener('resize', redim); redim();
let ox = 0, oy = 0; const sa = { l: 0, r: 0, t: 0, b: 0 };     // décalage de l'interface (encoche / zone sûre)
const ecran = () => ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
const pt = ev => tourne ? { x: ev.clientY, y: innerWidth - ev.clientX } : { x: ev.clientX, y: ev.clientY }; // coordonnées écran → jeu
function lireZoneSure() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(d); const c = getComputedStyle(d);
  const z = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  Object.assign(sa, tourne ? { l: z.t, t: z.r, r: z.b, b: z.l } : z);
  d.remove();
}
lireZoneSure(); addEventListener('resize', lireZoneSure);
function zoneSure(f) { // dessine l'interface en évitant l'encoche des téléphones
  const w0 = W, h0 = H; ox = sa.l; oy = sa.t; W = w0 - sa.l - sa.r; H = h0 - sa.t - sa.b;
  ecran(); f(); W = w0; H = h0; ox = oy = 0; ecran();
}
const mobile = matchMedia('(pointer: coarse)').matches;
function pleinEcran() { // mobile : plein écran + verrouillage en paysage (si le navigateur le permet)
  if (!mobile || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
}
const monde = (sx, sy) => ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, (W / 2 - cam.x * zoom + sx) * dpr, (H / 2 - cam.y * zoom + sy) * dpr);
const versMonde = (x, y) => ({ x: (x - W / 2) / zoom + cam.x, y: (y - H / 2) / zoom + cam.y });

// ---------- 4. ÉTAT ----------
let etat = 'AUTH', modeIndex = 0, mapIndex = 0, persoIndex = 0, mode = null, hote = true, salle = null;
let map = null, moi = null, autres = {}, bosses = [], projectiles = [], particules = [], textes = [], ondes = [];
let objets = [], degatsTuiles = {}, mesPoints = 0, finInfo = null, attente = { n: 1, min: 1, max: 1, reste: 0 };
let cam = { x: 0, y: 0 }, secousse = 0, temps = 0, finDans = 0, resultat = '', messageFin = '', zones = [];
const modes = () => { const m = CONFIG.modes.filter(m => m.actif !== false); return m.length ? m : CONFIG.modes; };
const modeChoisi = () => modes()[modeIndex % modes().length];
const mapChoisie = m => (m.map >= 0 && CONFIG.maps[m.map]) ? +m.map : mapIndex % CONFIG.maps.length;
const joueurs = () => [moi, ...Object.values(autres)].filter(j => j && !j.parti);
// 🧍 Persos 3D : vrais modèles .glb (voir modele3d.js) — sinon image 2D, sinon pastille de l'élément
const sprites3D = new Map(), visages3D = new Map(), en3D = new Set(); let file3D = Promise.resolve();
const ok3D = () => typeof Modele3D !== 'undefined' && Modele3D.dispo();
const baseDe = p => (p && p.base) || p;
function attendreImage(i) { return new Promise(ok => { if (!i) return ok(null); if (pret(i)) return ok(i.src); i.addEventListener('load', () => ok(i.src)); i.addEventListener('error', () => ok(null)); setTimeout(() => ok(i.src || null), 6000); }); }
function obtenir3D(p) { // planche de sprites du modèle, générée à la demande (une à la fois)
  p = baseDe(p); if (!p || !p.modele || !ok3D()) return null;
  if (sprites3D.has(p)) return sprites3D.get(p);
  if (!en3D.has(p)) { en3D.add(p); file3D = file3D.then(async () => { try { sprites3D.set(p, await Modele3D.generer(p)); } catch (e) { console.warn('Modèle 3D', p.nom, e); sprites3D.set(p, null); } }); }
  return null;
}
function faceParDefaut(p) { // portrait de secours : pastille aux couleurs de l'élément
  const cle = 'face' + p.nom; if (cacheGfx[cle]) return cacheGfx[cle];
  const el = (CONFIG.elements || {})[p.element] || {}, c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d');
  const g = x.createRadialGradient(100, 90, 10, 100, 100, 95); g.addColorStop(0, '#ffffff55'); g.addColorStop(1, (el.couleur || p.couleur || '#5ac8fa') + 'aa');
  x.fillStyle = g; x.beginPath(); x.arc(100, 100, 90, 0, 7); x.fill(); x.font = '100px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(el.icone || '❔', 100, 108);
  return cacheGfx[cle] = c;
}
const carteDe = p => { p = baseDe(p); return p.imageCarte ? img(p.imageCarte) : visages3D.get(p) || (p.image ? img(p.image) : faceParDefaut(p)); }; // image "carte" (menu, fin)
async function preparer3D() { // portraits 3D de tous les persos, puis la planche du perso choisi
  if (!ok3D()) return;
  for (const p of CONFIG.persos) if (p.modele) { try { const v = await Modele3D.visage(p); if (v) visages3D.set(p, v); } catch (e) { console.warn('Modèle 3D', p.nom, e.message); } }
  obtenir3D(CONFIG.persos[persoIndex]);
}
let heroVue = null, heroP = null, heroAngle = Math.PI / 2, heroZone = null, heroDrag = null;
function vitrineHero(p) { // modèle du héros de l'accueil : animation de repos, rotation au doigt
  if (heroP === p) return heroVue;
  if (heroVue) heroVue.liberer(); heroP = p; heroVue = null; heroAngle = Math.PI / 2;
  if (p.modele && ok3D()) Modele3D.vitrine(p).then(v => { if (heroP === p) heroVue = v; else if (v) v.liberer(); }).catch(() => {});
  return null;
}
CONFIG.persos.forEach(p => img(p.imageCarte));
Object.values(CONFIG.bosses).forEach(b => img(b.imageCarte));

// ---------- 5. CONNEXION / INSCRIPTION ----------
const $ = id => document.getElementById(id);
const nomJoueur = () => (user && user.displayName) || 'Joueur'; // seul le pseudo est affiché, jamais l'email
const ERR = {
  'auth/invalid-email': 'Email mal formé', 'auth/invalid-credential': 'Email ou mot de passe incorrect',
  'auth/wrong-password': 'Mot de passe incorrect', 'auth/user-not-found': 'Compte inconnu',
  'auth/email-already-in-use': 'Cet email a déjà un compte', 'auth/weak-password': 'Mot de passe trop court (6 caractères min.)',
  'auth/missing-password': 'Entre un mot de passe', 'auth/too-many-requests': "Trop d'essais, réessaie plus tard",
  'auth/popup-closed-by-user': 'Fenêtre Google fermée', 'auth/unauthorized-domain': 'Domaine non autorisé dans Firebase'
};
const erreurAuth = e => $('authErr').textContent = ERR[e.code] || e.message;
const champs = () => ({ email: $('aEmail').value.trim(), mdp: $('aMdp').value, pseudo: $('aPseudo').value.trim() });
$('authForm').onsubmit = e => { e.preventDefault(); const c = champs(); auth.signInWithEmailAndPassword(c.email, c.mdp).catch(erreurAuth); };
$('bInscription').onclick = async () => {
  const c = champs();
  if (!c.pseudo) return erreurAuth({ message: 'Choisis un pseudo pour créer ton compte' });
  try { const r = await auth.createUserWithEmailAndPassword(c.email, c.mdp); await r.user.updateProfile({ displayName: c.pseudo }); user = auth.currentUser; }
  catch (e) { erreurAuth(e); }
};
$('bGoogle').onclick = () => {
  const g = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(g).catch(e => e.code === 'auth/popup-blocked' ? auth.signInWithRedirect(g) : erreurAuth(e));
};
auth.onAuthStateChanged(u => {
  user = u;
  $('auth').style.display = u ? 'none' : 'flex';
  if (u) { if (etat === 'AUTH') etat = 'MENU'; ecouterPoints(); presence(); initAmis(); } else { quitterSalle(); etat = 'AUTH'; }
});

// ---------- 6. MAP & COLLISIONS ----------
// '.' herbe  '#' mur  'B' buisson  'W' eau  'P' départ joueur (2 pour le 1V1)  'E' départ boss  'C' coffre mystère
function chargerMap(def) {
  const l = Math.max(...def.grille.map(r => r.length));
  const g = def.grille.map(r => r.padEnd(l, '.'));
  const m = { def, g, l, h: g.length, j: [], b: [], t: [], z: 0 };
  const obj = mode ? mode.objectif : '';
  g.forEach((r, y) => { for (let x = 0; x < l; x++) {
    if (r[x] === 'P') m.j.push({ x, y }); if (r[x] === 'E') m.b.push({ x, y });
    if (r[x] === 'T') m.t.push({ x, y });   // 💎 cristal à détruire
    if (r[x] === 'Z') m.z++;                 // 🎯 zone à tenir
  } });
  m.g = g.map(r => r.replace(/T/g, '.').replace(obj === 'zone' ? /$^/ : /Z/g, '.')); // la zone n'existe qu'en mode "zone"
  return m;
}
const tuile = (tx, ty) => (!map || tx < 0 || ty < 0 || tx >= map.l || ty >= map.h) ? '#' : map.g[ty][tx];
const tuileA = (x, y) => tuile(Math.floor(x / TUILE), Math.floor(y / TUILE));
const bloque = c => c === '#' || c === 'W' || c === 'C';
function libre(x, y, r, dep) {
  if (dep === 'vol') return x > TUILE && y > TUILE && x < (map.l - 1) * TUILE && y < (map.h - 1) * TUILE; // 💨 vole au-dessus des blocs et de l'eau
  const k = r * 0.75, bl = dep === 'nage' ? c => c === '#' || c === 'C' : bloque;                          // 💧 se déplace sur l'eau
  return ![[-k, -k], [k, -k], [-k, k], [k, k], [0, -k], [0, k], [-k, 0], [k, 0]].some(([a, b]) => bl(tuileA(x + a, y + b)));
}
function deplacer(e, dx, dy) { if (libre(e.x + dx, e.y, e.r, e.dep)) e.x += dx; if (libre(e.x, e.y + dy, e.r, e.dep)) e.y += dy; }
function tourner(e, a, k) { let d = a - e.angle; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; e.angle += d * k; }
function caseLibre(loin) {
  for (let k = 0; k < 200; k++) {
    const tx = 1 + Math.floor(Math.random() * (map.l - 2)), ty = 1 + Math.floor(Math.random() * (map.h - 2));
    const x = (tx + 0.5) * TUILE, y = (ty + 0.5) * TUILE;
    if (tuile(tx, ty) === '.' && loin.every(j => Math.hypot(j.x - x, j.y - y) > 350)) return { x, y };
  }
  return { x: map.l * TUILE / 2, y: map.h * TUILE / 2 };
}

// ---------- 7. CRÉATION DE PARTIE ----------
const elemDe = p => (CONFIG.elements || {})[baseDe(p || {}).element] || null;
const niveauDe = p => Math.max(1, (((mesStats.persos || {})[cleP(baseDe(p) || {})] || {}).niveau) || 1);
const coutNiveau = nv => { const g = CONFIG.progression || {}; return Math.round((+g.coutBase || 50) * Math.pow(+g.coutMult || 1.5, nv - 1)); };
function statsNiveau(p, nv) { // chaque niveau augmente les stats (réglable dans l'admin)
  const g = CONFIG.progression || {}, k = Math.max(0, nv - 1);
  return { ...p, base: p, niveau: nv, pvMax: Math.round(p.pvMax * (1 + k * (+g.bonusPV || 0) / 100)), degats: Math.round(p.degats * (1 + k * (+g.bonusDegats || 0) / 100)), vitesse: p.vitesse * (1 + k * (+g.bonusVitesse || 0) / 100) };
}
async function evoluer(p) { // dépense les essences de l'élément pour passer au niveau suivant
  const el = p.element, nv = niveauDe(p), cout = coutNiveau(nv), max = +(CONFIG.progression || {}).niveauMax || 10, e = (CONFIG.elements || {})[el];
  if (!e) return notif('Ce perso n\'a pas d\'élément');
  if (nv >= max) return notif('Niveau maximum atteint !');
  if (((mesStats.essences || {})[el] || 0) < cout) return notif(`Il te faut ${cout} ${e.icone} (joue avec des persos ${e.nom})`);
  const inc = firebase.firestore.FieldValue.increment;
  try { await db.collection('joueurs').doc(user.uid).set({ essences: { [el]: inc(-cout) }, persos: { [cleP(p)]: { niveau: nv + 1 } } }, { merge: true }); notif(`✨ ${p.nom} passe au niveau ${nv + 1} !`); }
  catch (err) { notif('Évolution impossible : ' + err.message); }
}
function creerJoueur(pi, x, y, uid, nom, eq, nv) {
  const b = CONFIG.persos[pi] || CONFIG.persos[0], p = statsNiveau(b, nv || 1), el = elemDe(b);
  return { uid, nom, eq, perso: p, dep: el ? el.capacite : 'sol', arme: CONFIG.armes[p.arme] || Object.values(CONFIG.armes)[0], x, y, tx: x, ty: y, r: Math.round(26 * Math.min(1.8, Math.max(0.6, +b.modeleEchelle || 1))),
           pv: p.pvMax, pvMax: p.pvMax, angle: 0, recharge: 0, mun: +p.munitions || 3, flash: 0, marche: 0, kx: 0, ky: 0, cache: false, bonus: {}, bo: [] };
}
function creerBoss(id, x, y, i) {
  const ids = Object.keys(CONFIG.bosses);
  if (id !== 'bloc' && !CONFIG.bosses[id]) id = ids[Math.floor(Math.random() * ids.length)]; // 'aleatoire' ou inconnu
  const d = id === 'bloc' ? { nom: 'CRISTAL', cristal: true, image: '', pvMax: +mode.pvCristal || 20000, taille: 40, vitesse: 0, degats: 0, delaiAttaque: 9999, rayonAttaque: 0,
    arme: CONFIG.armes.eclair ? 'eclair' : Object.keys(CONFIG.armes)[0], porteeTir: +mode.porteeCristal || 350, degatsTir: +mode.degatsCristal || 800, cadenceTir: +mode.cadenceCristal || 60 } : (b => { const n = +mode.niveauBoss || 1; return { ...b, pvMax: Math.round(b.pvMax * n), degats: Math.round(b.degats * n), degatsTir: Math.round((+b.degatsTir || b.degats / 2) * n), vitesse: b.vitesse * (0.85 + 0.15 * n) }; })(CONFIG.bosses[id]); // niveau du boss
  return { i, id, def: d, x, y, tx: x, ty: y, r: d.taille || 48, pv: d.pvMax, pvMax: d.pvMax, angle: Math.PI, recharge: 60,
           flash: 0, marche: 0, kx: 0, ky: 0, charge: 0, chargeMax: 1, rage: false, cx: x, cy: y, fx: x, fy: y,
           uid: 'boss' + i, eq: -1, tir: 60, arme: CONFIG.armes[d.arme] || null, perso: { portee: +d.porteeTir || 400, degats: +d.degatsTir || Math.round(d.degats / 2) } };
}
// liste = joueurs de la partie [{uid, nom, p}] (le 1er est l'hôte) ; null = solo
function demarrer(mapIdx, liste) {
  mode = modeChoisi();
  map = chargerMap(CONFIG.maps[mapIdx] || CONFIG.maps[0]);
  liste = liste || [{ uid: user.uid, nom: nomJoueur(), p: persoIndex }];
  const c = t => (t + 0.5) * TUILE, places = [];
  autres = {}; moi = null;
  liste.forEach((d, k) => {
    const sp = map.j[k] ? { x: c(map.j[k].x), y: c(map.j[k].y) }
      : (k === 1 && map.j[0]) ? { x: c(map.l - 1 - map.j[0].x), y: c(map.h - 1 - map.j[0].y) } : caseLibre(places);
    const eq = d.eq !== undefined && d.eq !== null ? d.eq : mode.equipes === 'deux' ? k % 2 : mode.equipes === 'coop' ? 0 : k;
    const j = creerJoueur(d.p, sp.x, sp.y, d.uid, d.nom, eq, d.nv || (d.uid === user.uid ? niveauDe(CONFIG.persos[d.p]) : 1));
    places.push(j);
    if (d.bot) { j.bot = true; j.niv = d.niv || 1; j.pvMax = j.pv = Math.round(j.pvMax * (0.8 + 0.2 * j.niv)); }
    if (d.uid === user.uid) moi = j; else autres[d.uid] = j;
  });
  hote = liste[0].uid === user.uid;
  const pvp = new Set(places.map(j => j.eq)).size > 1;
  bosses = [];
  if (hote && mode.boss && mode.nbBoss > 0) for (let i = 0; i < Math.min(10, mode.nbBoss); i++) {
    const e = !pvp && map.b[i] ? { x: c(map.b[i].x), y: c(map.b[i].y) } : caseLibre(places);
    const types = (mode.typesBoss || []).filter(id => CONFIG.bosses[id]); // plusieurs types de boss, à tour de rôle
    bosses.push(creerBoss(types.length ? types[i % types.length] : 'aleatoire', e.x, e.y, i));
  }
  if (hote && mode.objectif === 'bloc') (map.t.length ? map.t.map(t => ({ x: c(t.x), y: c(t.y) })) : [caseLibre(places)]).forEach(t => {
    const b = creerBoss('bloc', t.x, t.y, bosses.length); // en équipes : chaque cristal appartient à l'équipe la plus proche
    b.eq = pvp ? places.reduce((a, j) => Math.hypot(j.x - t.x, j.y - t.y) < Math.hypot(a.x - t.x, a.y - t.y) ? j : a).eq : -1;
    bosses.push(b);
  });
  zoneProg = {}; decor3D = null;
  if (typeof Modele3D !== 'undefined' && Modele3D.dispo()) Modele3D.decor(map.def).then(d => decor3D = d).catch(e => console.warn('Décor 3D', e)); // murs, coffres, buissons en 3D
  projectiles = []; particules = []; textes = []; ondes = []; objets = []; degatsTuiles = {}; retours = []; levees = {};
  cam.x = moi.x; cam.y = moi.y; finDans = 0; resultat = ''; messageFin = ''; finInfo = null;
  joyG.actif = joyD.actif = false;
  joueurs().forEach(j => obtenir3D(j.perso)); // prépare les persos 3D de la partie pendant l'intro
  etat = 'INTRO'; introT = temps; kills = {}; nuages = []; dots = []; fantomes = []; suivi = null;
  moi.spawn = { x: moi.x, y: moi.y }; Object.values(autres).forEach(j => j.spawn = { x: j.x, y: j.y });
}
const cleP = p => String(p.nom || 'perso').replace(/[.~*/\[\]`]/g, '_'); // clé des points par perso
function verifierFin() {
  if (resultat) return;
  const tous = [moi, ...Object.values(autres)], vivant = j => j.pv > 0 && !j.parti;
  const allies = tous.filter(j => j.eq === moi.eq), ennemis = tous.filter(j => j.eq !== moi.eq);
  if (mode.duree > 0 && temps - debutJeu >= mode.duree * 60) { // ⏱ temps écoulé
    if (!ennemis.length) return finir(bosses.length && bosses.every(b => b.pv <= 0) ? 'VICTOIRE' : 'DEFAITE', 'Temps écoulé');
    const score = eq => tous.filter(j => j.eq === eq).reduce((s, j) => s + (kills[j.uid] || 0), 0);
    const mien = score(moi.eq), leur = Math.max(...[...new Set(ennemis.map(j => j.eq))].map(score));
    return finir(mien > leur ? 'VICTOIRE' : mien < leur ? 'DEFAITE' : 'EGALITE', `Temps écoulé • ${mien} - ${leur}`);
  }
  if (mode.objectif === 'zone') for (const [eq, t] of Object.entries(zoneProg)) if (t >= (+mode.tempsZone || 30) * 60)
    return finir(+eq === moi.eq ? 'VICTOIRE' : 'DEFAITE', +eq === moi.eq ? 'Zone contrôlée !' : 'Zone perdue');
  const cristaux = bosses.filter(b => b.def.cristal);
  if (cristaux.length && ennemis.length) {
    if (cristaux.some(b => b.eq === moi.eq && b.pv <= 0)) return finir('DEFAITE', 'Ton cristal est détruit');
    if (cristaux.some(b => b.eq !== moi.eq && b.pv <= 0)) return finir('VICTOIRE', 'Cristal adverse détruit !');
  }
  if (mode.reapparition && ennemis.length) return; // avec réapparition, le match se joue au temps
  if (ennemis.length) {
    if (!ennemis.some(vivant)) finir('VICTOIRE', ennemis.length > 1 ? 'Équipe adverse éliminée' : 'Tu as battu ' + ennemis[0].nom);
    else if (!allies.some(vivant)) finir('DEFAITE', ennemis.filter(vivant).map(j => j.nom).join(', ') + ' gagne');
  } else if (!allies.some(vivant)) finir('DEFAITE', '');
  else if (bosses.length && bosses.every(b => b.pv <= 0)) finir('VICTOIRE', bosses.length > 1 ? 'Tous les boss sont vaincus' : '');
}
function finir(r, msg) {
  if (resultat) return;
  resultat = r; messageFin = msg || ''; finDans = 70; envoyerEtat(true); moi.revivre = 0;
  const tous = [moi, ...Object.values(autres)], ennemis = tous.filter(j => j.eq !== moi.eq), allies = tous.filter(j => j.eq === moi.eq);
  const [g, p] = ennemis.length ? (r !== 'DEFAITE' ? [allies, ennemis] : [ennemis, allies]) : (r === 'VICTOIRE' ? [allies, bosses] : [bosses, allies]);
  const carte = e => e.def ? { im: img(e.def.imageCarte || e.def.image), nom: e.def.nom } : { im: carteDe(e.perso), nom: e.nom };
  const uniques = l => l.filter((e, i) => !e.def || l.findIndex(o => o.id === e.id) === i).slice(0, 5).map(carte);
  finInfo = { gagnants: uniques(g), perdants: uniques(p), points: +(r === 'VICTOIRE' ? mode.pointsVictoire : mode.pointsDefaite) || 0, t0: temps + 70 };
  if (db && user) {
    const inc = firebase.firestore.FieldValue.increment;
    const elJ = elemDe(moi.perso), gainE = elJ ? +(r === 'VICTOIRE' ? elJ.gainVictoire : elJ.gainDefaite) || 0 : 0; finInfo.essence = elJ && gainE ? gainE + ' ' + elJ.icone : '';
    db.collection('joueurs').doc(user.uid).set({ pseudo: nomJoueur(), points: inc(finInfo.points), ...(elJ ? { essences: { [baseDe(moi.perso).element]: inc(gainE) } } : {}), parties: inc(1), victoires: inc(r === 'VICTOIRE' ? 1 : 0),
      persos: { [cleP(baseDe(moi.perso))]: { points: inc(finInfo.points), parties: inc(1), victoires: inc(r === 'VICTOIRE' ? 1 : 0) } } }, { merge: true }).catch(e => console.warn(e));
  }
}
function ecouterPoints() { if (db && user) db.collection('joueurs').doc(user.uid).onSnapshot(d => { const v = d.data() || {}; mesPoints = v.points || 0; mesStats = { points: v.points || 0, victoires: v.victoires || 0, parties: v.parties || 0, persos: v.persos || {}, essences: v.essences || {} }; }, () => {}); }

// ---------- 8. MULTIJOUEUR (Realtime Database) ----------
// Salle d'attente → départ quand le max est atteint (ou 10 s après avoir atteint le minimum).
// Chacun envoie sa position et gère ses PV ; l'hôte (1er joueur) fait vivre les boss.
async function chercherPartie(opts = {}) {
  if (!rtdb) return alert('Multijoueur indisponible : ajoute databaseURL dans firebase-config.js');
  mode = modeChoisi();
  const max = Math.max(2, +mode.joueursMax || 2), min = Math.min(max, Math.max(2, +mode.joueursMin || 2));
  const cle = 'attente/' + mode.nom.replace(/[.#$\[\]\/]/g, '_'), nouvelle = rtdb.ref('salles').push().key;
  etat = 'ATTENTE'; attente = { n: 1, min, max, reste: 0 };
  let pris = opts.rejoindre || null;
  const nbG = opts.groupe ? Object.keys(groupe.membres).length : 0;
  try {
    if (opts.rejoindre) { /* membre d'un groupe : rejoint directement la salle du chef */ }
    else if (nbG) { if (1 + nbG < max) await rtdb.ref(cle).set({ uid: user.uid, salle: nouvelle, t: Date.now(), n: 1 + nbG }); }
    else await rtdb.ref(cle).transaction(v => {
      if (v && v.salle && v.uid !== user.uid && Date.now() - v.t < 60000 && (v.n || 1) < max) { pris = v.salle; return (v.n || 1) + 1 >= max ? null : { ...v, n: (v.n || 1) + 1 }; }
      pris = null; return { uid: user.uid, salle: nouvelle, t: Date.now(), n: 1 };
    });
  } catch (e) { etat = 'MENU'; return alert('Erreur multijoueur : ' + e.message); }
  if (etat !== 'ATTENTE') return;
  if (nbG) rtdb.ref(`groupes/${user.uid}/partie`).set({ salle: nouvelle, mode: modeIndex, t: Date.now() }); // le groupe suit le chef
  const id = pris || nouvelle, s = salle = { id, ref: rtdb.ref('salles/' + id), cle, hote: !pris, uid: user.uid, debut: false, min, max, depuis: 0, js: {}, cree: Date.now() };
  if (s.hote) { rtdb.ref(cle).onDisconnect().remove(); s.ref.onDisconnect().remove(); await s.ref.child('info').set({ map: mapChoisie(mode) }); }
  const moiRef = s.ref.child('joueurs/' + user.uid);
  moiRef.onDisconnect().remove();
  await moiRef.set({ nom: nomJoueur(), p: persoIndex, nv: niveauDe(CONFIG.persos[persoIndex]), g: groupe.chef || null, pp: ((mesStats.persos || {})[cleP(CONFIG.persos[persoIndex] || {})] || {}).points || 0, t: firebase.database.ServerValue.TIMESTAMP });
  s.ref.child('joueurs').on('value', snap => {
    if (salle !== s) return;
    s.js = snap.val() || {};
    if (etat === 'ATTENTE') {
      attente.n = Object.keys(s.js).length;
      if (s.hote && !s.debut) { if (attente.n >= max) lancerSalle(); else s.depuis = attente.n >= min ? (s.depuis || Date.now()) : 0; }
    } else if (etat === 'JEU') majAutres(s.js);
  });
  s.ref.child('info/debut').on('value', snap => {
    const d = snap.val();
    if (!d || salle !== s || etat !== 'ATTENTE') return;
    s.debut = true;
    if (!d.liste.some(j => j.uid === user.uid)) { quitterSalle(); return chercherPartie(); } // salle déjà pleine
    demarrer(d.map, d.liste);
  });
  s.ref.child('evts').on('child_added', snap => { const e = snap.val(); if (salle === s && etat === 'JEU' && e && (e.par || e.de) !== user.uid) recevoir(e); });
  s.ref.child('bots').on('value', snap => { if (salle === s && etat === 'JEU' && !hote) for (const [uid, d] of Object.entries(snap.val() || {})) if (autres[uid]) { transitionPV(autres[uid], d.pv); Object.assign(autres[uid], { tx: d.x, ty: d.y, angle: d.a, pv: d.pv, cache: d.c, marche: d.m, bo: d.bo ? d.bo.split(',') : [] }); } });
  s.ref.child('boss').on('value', snap => { if (salle === s && etat === 'JEU' && !hote) majBossDistants(snap.val() || []); });
}
function lancerSalle(avecBots) {
  const s = salle; if (!s || s.debut) return; s.debut = true;
  rtdb.ref(s.cle).transaction(v => v && v.salle === s.id ? null : undefined).catch(() => {});
  const liste = Object.entries(s.js).sort((a, b) => (a[1].t || 0) - (b[1].t || 0)).map(([uid, d]) => ({ uid, nom: d.nom, p: d.p, nv: d.nv || 1, g: d.g || null }));
  if (avecBots) { // 🤖 complète avec des bots (nombre pair en équipes)
    let k = 1;
    const humains = Object.values(s.js), moy = humains.reduce((t, d) => t + (+d.pp || 0), 0) / Math.max(1, humains.length);
    const niv = +((+mode.niveauBots || 1) * (mode.botsAdaptatifs !== false ? Math.max(0.7, Math.min(2.2, 0.7 + moy / 400)) : 1)).toFixed(2); // 🤖 niveau selon les points des joueurs
    while (liste.length < s.min || (mode.equipes === 'deux' && liste.length % 2 && liste.length < s.max))
      liste.push({ uid: 'bot' + k, nom: '🤖 Bot ' + k++, p: Math.floor(Math.random() * CONFIG.persos.length), bot: true, niv });
  }
  const grp = {}; liste.forEach(j => (grp[j.g || j.uid] = grp[j.g || j.uid] || []).push(j)); // 👥 amis = même équipe
  if (mode.equipes === 'deux') { const n = [0, 0]; Object.values(grp).sort((a, b) => b.length - a.length).forEach(gr => { const t = n[0] <= n[1] ? 0 : 1; gr.forEach(j => j.eq = t); n[t] += gr.length; }); }
  else if (mode.equipes !== 'coop') Object.values(grp).forEach((gr, k) => gr.forEach(j => j.eq = k));
  s.ref.child('info').once('value', i => s.ref.child('info/debut').set({ map: (i.val() || {}).map || 0, liste }));
}
function rafraichirAttente() {
  const s = salle; if (!s || !s.hote || s.debut) return;
  attente.reste = s.depuis ? Math.max(0, 10 - Math.floor((Date.now() - s.depuis) / 1000)) : 0;
  if (s.depuis && attente.reste === 0) lancerSalle();
  const m = modeChoisi(), attenteBots = (+m.attenteBots || 15) * 1000;
  attente.bots = m.bots !== false && attente.n < s.min ? Math.max(0, Math.ceil((attenteBots - (Date.now() - s.cree)) / 1000)) : 0;
  if (m.bots !== false && attente.n < s.min && Date.now() - s.cree > attenteBots) lancerSalle(true);
  if (temps % 1200 === 0) rtdb.ref(s.cle).transaction(v => v && v.uid === user.uid ? { ...v, t: Date.now() } : undefined);
}
function quitterSalle() {
  const s = salle; salle = null;
  if (!s || !rtdb) return;
  const finie = etat !== 'JEU' || resultat;
  ['joueurs', 'evts', 'boss', 'bots', 'info/debut'].forEach(k => s.ref.child(k).off());
  s.ref.child('joueurs/' + s.uid).remove().catch(() => {});
  rtdb.ref(s.cle).transaction(v => !v || v.salle !== s.id ? undefined : s.hote ? null : { ...v, n: Math.max(1, (v.n || 1) - 1) }).catch(() => {});
  if (s.hote && finie) setTimeout(() => s.ref.remove().catch(() => {}), 3000);
}
function envoyer(e) { if (salle) salle.ref.child('evts').push({ de: user.uid, ...e, par: user.uid }); }
let enLigne = 0, presenceActive = false;
function presence() { // compteur de joueurs connectés
  if (!rtdb || !user || presenceActive) return; presenceActive = true;
  rtdb.ref('.info/connected').on('value', s => {
    if (!s.val() || !user) return;
    const ref = rtdb.ref('presence/' + user.uid);
    ref.onDisconnect().remove(); ref.set({ nom: nomJoueur(), t: firebase.database.ServerValue.TIMESTAMP });
  });
  rtdb.ref('presence').on('value', s => { enLigne = s.numChildren(); enLigneListe = Object.entries(s.val() || {}).map(([uid, v]) => ({ uid, nom: (v && v.nom) || 'Joueur' })); }, () => {});
}
function envoyerEtat(force) {
  if (!salle || !moi || (!force && temps % 4)) return;
  salle.ref.child('joueurs/' + user.uid).update({ x: Math.round(moi.x), y: Math.round(moi.y), a: +moi.angle.toFixed(2), pv: Math.round(moi.pv), c: moi.cache, m: Math.round(moi.marche), bo: bonusActifs(moi).join(',') });
  const bots = Object.values(autres).filter(j => j.bot);
  if (hote && bots.length) salle.ref.child('bots').set(Object.fromEntries(bots.map(j => [j.uid, { x: Math.round(j.x), y: Math.round(j.y), a: +j.angle.toFixed(2), pv: Math.round(j.pv), c: j.cache, m: Math.round(j.marche), bo: bonusActifs(j).join(',') }])));
  if (hote && bosses.length) salle.ref.child('boss').set(bosses.map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), a: +b.angle.toFixed(2), pv: b.pv, ch: b.charge, cm: b.chargeMax, fx: Math.round(b.fx), fy: Math.round(b.fy), rg: b.rage, e: b.eq })));
}
function majAutres(js) {
  for (const [uid, j] of Object.entries(autres)) {
    if (j.bot) continue; // les bots sont envoyés par l'hôte
    const d = js[uid];
    if (!d) { j.parti = true; j.pv = 0; continue; }
    if (d.x !== undefined) { transitionPV(j, d.pv); Object.assign(j, { tx: d.x, ty: d.y, angle: d.a, pv: d.pv, cache: d.c, marche: d.m, bo: d.bo ? d.bo.split(',') : [] }); }
  }
}
function majBossDistants(liste) {
  liste.forEach((d, i) => {
    const b = bosses[i] || (bosses[i] = creerBoss(d.id, d.x, d.y, i));
    b.eq = d.e === undefined ? -1 : d.e;
    Object.assign(b, { tx: d.x, ty: d.y, angle: d.a, charge: d.ch, chargeMax: d.cm || 1, fx: d.fx, fy: d.fy, rage: d.rg });
    if (b.pv > 0 && d.pv <= 0) mortBoss(b);
    b.pv = d.pv;
  });
}
function recevoir(e) {
  const j = entite(e.de);
  if (e.t === 'tir' && j) { j.angle = e.a; creerProjectile(j, e.a, e.f, e.x, e.y, e.d); }
  else if (e.t === 'db' && hote && bosses[e.i]) blesserBoss(bosses[e.i], e.deg);
  else if (e.t === 'fr') frappe(e, false);
  else if (e.t === 'ca') casser(e.tx, e.ty, e.o);
  else if (e.t === 'pr') objets = objets.filter(o => o.tx !== e.tx || o.ty !== e.ty);
  else if (e.t === 'mort' && e.k) kills[e.k] = (kills[e.k] || 0) + 1;
}

// ---------- 9. CONTRÔLES ----------
const touches = {};
addEventListener('keydown', e => {
  if (etat === 'AUTH') return;
  touches[e.key.toLowerCase()] = true;
  if (e.key === ' ' && etat === 'JEU') tirerAuto();
  if (e.key === 'Escape' && etat !== 'MENU') { quitterSalle(); etat = 'MENU'; }
});
addEventListener('keyup', e => touches[e.key.toLowerCase()] = false);
addEventListener('contextmenu', e => e.preventDefault());
const joyG = { actif: false }, joyD = { actif: false };
function vec(j) { const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy); return { dx, dy, d, f: Math.min(d / 60, 1), a: Math.atan2(dy, dx) }; }
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); pleinEcran();
  for (const t of e.changedTouches) {
    if (etat === 'MENU' && surHero(pt(t))) { heroDrag = { x: pt(t).x, id: t.identifier, bouge: 0 }; continue; }
    if (etat !== 'JEU' || moi.pv <= 0) { clic(pt(t).x, pt(t).y); continue; }
    const q = pt(t), j = q.x < W / 2 ? joyG : joyD;
    if (!j.actif) Object.assign(j, { actif: true, id: t.identifier, ox: q.x, oy: q.y, x: q.x, y: q.y });
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) for (const j of [joyG, joyD]) if (j.actif && j.id === t.identifier) { const q = pt(t); j.x = q.x; j.y = q.y; }
  if (heroDrag) for (const t of e.changedTouches) if (t.identifier === heroDrag.id) tournerHero(pt(t).x);
}, { passive: false });
function finTouche(e) {
  if (heroDrag) for (const t of e.changedTouches) if (t.identifier === heroDrag.id) lacherHero();
  for (const t of e.changedTouches) {
    if (joyG.actif && joyG.id === t.identifier) joyG.actif = false;
    if (joyD.actif && joyD.id === t.identifier) {
      joyD.actif = false;
      if (etat === 'JEU') { const v = vec(joyD); v.d > 15 ? tirer(v.a, v.f) : tirerAuto(); }
    }
  }
}
canvas.addEventListener('touchend', finTouche);
canvas.addEventListener('touchcancel', finTouche);
const surHero = q => ecranMenu === 'accueil' && heroZone && q.x - sa.l > heroZone.x && q.x - sa.l < heroZone.x + heroZone.w && q.y - sa.t > heroZone.y && q.y - sa.t < heroZone.y + heroZone.h;
function tournerHero(x) { const dx = x - heroDrag.x; heroDrag.x = x; heroDrag.bouge += Math.abs(dx); heroAngle -= dx * 0.013; }
function lacherHero() { if (heroDrag.bouge < 6) { persoVue = persoIndex; allerA('persos'); } heroDrag = null; }
addEventListener('mousemove', e => { if (heroDrag) tournerHero(pt(e).x); });
addEventListener('mouseup', () => { if (heroDrag) lacherHero(); });
canvas.addEventListener('mousedown', e => {
  if (etat === 'MENU' && surHero(pt(e))) { heroDrag = { x: pt(e).x, bouge: 0 }; return; }
  if (etat !== 'JEU' || moi.pv <= 0) return clic(pt(e).x, pt(e).y);
  const m = versMonde(pt(e).x, pt(e).y), d = Math.hypot(m.x - moi.x, m.y - moi.y);
  tirer(Math.atan2(m.y - moi.y, m.x - moi.x), Math.min(1, d / moi.perso.portee));
});
function clic(x, y) {
  if ((etat === 'VICTOIRE' || etat === 'DEFAITE' || etat === 'EGALITE') && finInfo && temps - finInfo.t0 < 40) return;
  x -= sa.l; y -= sa.t; vagues.push({ x, y, t: temps }); // onde au toucher
  const z = zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  if (z) z.action();
}

// ---------- 10. TIRS & DÉGÂTS ----------
function creerProjectile(j, angle, force, x, y, deg) {
  if (j.perso) j.anim = { n: 'attaque', t: temps }; // 🎬 animation d'attaque
  const a = j.arme, v = a.vitesse || 10;
  const p = { rebonds: +a.rebonds || 0, chaine: +a.chaine || 0, sombre: !!j.def, type: a.type, arme: a, perso: j.perso, deg: deg || j.perso.degats, de: j.uid, x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, dist: 0, rot: 0, z: 0, vie: 0, retour: false, touches: new Set() };
  if (a.type === 'terrain') Object.assign(p, { cases: casesTerrain(a, x, y, angle, Math.max(TUILE, j.perso.portee * force)), t: 0 });
  if (a.type === 'lob') {
    const d = Math.max(80, j.perso.portee * force);
    Object.assign(p, { sx: x, sy: y, cx: x + Math.cos(angle) * d, cy: y + Math.sin(angle) * d, t: 0, duree: Math.max(18, d / v) });
  }
  projectiles.push(p);
}
function tirer(angle, force = 1) {
  if (!moi || moi.recharge > 0 || moi.pv <= 0 || resultat) return;
  const illimite = pouvoirActif(moi, 'munitions');
  if (moi.mun < 1 && !illimite) return;               // plus de munitions
  if (!illimite) moi.mun -= 1;
  moi.recharge = moi.perso.delaiTir; moi.angle = angle; // cadence de tir
  const deg = Math.round(moi.perso.degats * bonus(moi, 'degats'));
  creerProjectile(moi, angle, force, moi.x, moi.y, deg);
  envoyer({ t: 'tir', a: +angle.toFixed(3), f: +force.toFixed(2), x: Math.round(moi.x), y: Math.round(moi.y), d: deg });
}
function tirerAuto() {
  if (!moi) return;
  let c = null, dm = 1e9;
  const vus = [...bosses.filter(b => b.pv > 0), ...joueurs().filter(j => j.eq !== moi.eq && j.pv > 0 && visible(j))];
  for (const e of vus) { const d = Math.hypot(e.x - moi.x, e.y - moi.y); if (d < dm) { dm = d; c = e; } }
  if (c) tirer(Math.atan2(c.y - moi.y, c.x - moi.x), Math.min(1, dm / moi.perso.portee)); else tirer(moi.angle, 1);
}
const visible = j => j === moi || j.eq === moi.eq || !j.cache || Math.hypot(j.x - moi.x, j.y - moi.y) < 170;
function cibles(p) { // ce qu'un projectile peut toucher (boss + joueurs d'une autre équipe)
  const pr = entite(p.de), eq = pr ? pr.eq : -1;
  const l = bosses.filter(b => b.pv > 0 && !(pr && pr.def) && b.eq !== eq).map(b => ({ e: b, k: 'b' + b.i }));
  for (const j of joueurs()) if (j.uid !== p.de && j.eq !== eq && j.pv > 0) l.push({ e: j, k: 'j' + j.uid });
  return l;
}
function majProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i], proprio = entite(p.de), mien = auteur(p);
    let fini = ++p.vie > 400 || !proprio;
    if (!fini && p.type === 'terrain') { // les cases sortent du sol les unes après les autres
      p.t++;
      p.cases = p.cases.filter(c => { if (c[2] > p.t) return true; elever(c[0], c[1], p); return false; });
      if (!p.cases.length) fini = true;
    } else if (!fini && p.type === 'lob') {
      p.t++; const k = p.t / p.duree;
      p.x = p.sx + (p.cx - p.sx) * k; p.y = p.sy + (p.cy - p.sy) * k;
      p.z = Math.sin(k * Math.PI) * 110; p.rot += 0.2;
      if (k >= 1) { exploser(p); fini = true; }
    } else if (!fini) {
      if (p.retour) { const a = Math.atan2(proprio.y - p.y, proprio.x - p.x), v = (p.arme.vitesse || 10) * 1.1; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; }
      p.x += p.vx; p.y += p.vy; p.dist += Math.hypot(p.vx, p.vy);
      (p.tr = p.tr || []).push({ x: p.x, y: p.y }); if (p.tr.length > 8) p.tr.shift(); // traînée
      if (p.type === 'retour') p.rot += 0.45;
      const mur = bloqueTir(tuileA(p.x, p.y));
      if (mur && mien && !p.retour) abimerA(p.x, p.y, p.deg);
      if (p.type === 'retour') {
        if (!p.retour && (p.dist >= p.perso.portee || mur)) { p.retour = true; if (mur) effet('etincelle', p.x, p.y, '#ddd'); }
        if (p.retour && Math.hypot(p.x - proprio.x, p.y - proprio.y) < proprio.r) fini = true;
      } else if (mur && p.rebonds > 0) { // ricochet : repart en sens inverse, plus puissant
        p.x -= p.vx; p.y -= p.vy;
        if (bloqueTir(tuileA(p.x + p.vx, p.y))) p.vx = -p.vx; else p.vy = -p.vy;
        p.rebonds--; p.deg = Math.round(p.deg * (+p.arme.bonusRebond || 1)); p.dist *= 0.5; p.touches.clear();
        effet('etincelle', p.x, p.y, p.arme.couleur);
      } else if (mur || p.dist >= p.perso.portee) { effet('etincelle', p.x, p.y, p.arme.couleur); fini = true; }
      if (!fini) for (const c of cibles(p)) {
        const cle = (p.retour ? 'r' : 'a') + c.k;
        if (!p.touches.has(cle) && Math.hypot(p.x - c.e.x, p.y - c.e.y) < c.e.r + (p.arme.taille || 16)) {
          impact(c.e, p, p.x - p.vx * 3, p.y - p.vy * 3, true);
          if (p.type === 'retour') p.touches.add(cle);
          else if (p.chaine > 0 && (p.touches.add(cle), chercher(p, c.e))) break; // file vers l'ennemi suivant
          else { fini = true; break; }
        }
      }
    }
    if (fini && (+p.arme.nuage || 0) > 0 && p.type !== 'retour') nuages.push({ x: p.x, y: p.y, r: +p.arme.rayonNuage || 90, fin: temps + p.arme.nuage * 60, debut: temps, c: p.arme.couleur || '#9aa0a6', deg: +p.arme.degatsNuage || 0, de: p.de, arme: p.arme });
    if (fini) projectiles.splice(i, 1);
  }
}
function exploser(p) {
  const r = p.arme.rayon || 70;
  effet(p.arme.effet || 'explosion', p.x, p.y, p.arme.couleur, r);
  for (const c of cibles(p)) if (Math.hypot(p.x - c.e.x, p.y - c.e.y) < r + c.e.r * 0.6) impact(c.e, p, p.x, p.y, false);
  if (p.sombre) effetSombre(p.x, p.y);
  if (auteur(p)) abimerZone(p.x, p.y, r, p.deg);
}
function impact(e, p, x, y, avecEffet) {
  const a = p.arme, deg = p.deg, ang = Math.atan2(e.y - y, e.x - x);
  if (avecEffet) effet(a.effet, e.x, e.y - 10, p.sombre ? '#2a0033' : a.couleur, 40, ang);
  if (p.sombre) effetSombre(e.x, e.y - 10);
  if ((+a.retard || 0) > 0 || (+a.poisonDuree || 0) > 0) return planifier(e, p, deg, ang); // ⏳ dégâts à retardement / poison
  degats(e, p.de, deg, x, y, ang, a);
}
function degats(e, de, deg, x, y, ang, a) { // applique les dégâts selon qui a l'autorité
  const pr = entite(de), kb = a && a.effet === 'explosion' ? 6 : 3;
  if (e === moi) return toucherMoi(deg, x, y, de);
  e.flash = 8;
  texteFlottant('-' + deg, e.x, e.y - e.r * 1.4, (a && a.couleur) || '#fff');
  if (e.bot) { if (hote) { e.dernier = de; blesserBot(e, deg, ang); } return; } // les bots sont gérés par l'hôte
  if (!e.def) return;                                 // autre joueur : il gère ses PV lui-même
  if (hote) { e.kx += Math.cos(ang) * kb; e.ky += Math.sin(ang) * kb; }
  if (de === moi.uid || (hote && pr && pr.bot)) hote ? blesserBoss(e, deg) : envoyer({ t: 'db', i: e.i, deg }); // les dégâts des invités passent par l'hôte
}
const entite = uid => uid === moi.uid ? moi : autres[uid] || (String(uid).startsWith('boss') ? bosses[+String(uid).slice(4)] : null);
const auteur = p => { const e = entite(p.de); return p.de === moi.uid || (hote && !!e && (!!e.def || !!e.bot)); }; // qui décide des murs cassés
function chercher(p, touche) { // tête chercheuse : fonce vers l'ennemi le plus proche avec moins de puissance
  let best = null, dm = +p.arme.porteeChaine || 350;
  for (const c of cibles(p)) if (c.e !== touche && !p.touches.has('a' + c.k)) { const d = Math.hypot(c.e.x - p.x, c.e.y - p.y); if (d < dm) { dm = d; best = c.e; } }
  if (!best) return false;
  const a = Math.atan2(best.y - p.y, best.x - p.x), v = Math.hypot(p.vx, p.vy);
  particules.push({ x: (p.x + best.x) / 2, y: (p.y + best.y) / 2, vx: 0, vy: 0, c: p.arme.couleur || '#fff', t: 4, vie: 1, forme: 'trait', a, len: dm });
  p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.dist = 0; p.chaine--;
  p.deg = Math.round(p.deg * (+p.arme.perteChaine || 0.7));
  return true;
}
function effetSombre(x, y) { // aura noire des armes de boss
  ondes.push({ x, y, r: 6, max: 75, c: '#14001f', vie: 1, ep: 12 });
  for (let i = 0; i < 16; i++) particule(x, y, i % 2 ? 'rgba(15,0,25,.9)' : '#6a00a8', 5, 12, 1.3, 'fumee');
}
function blesserBot(j, deg, ang) {
  if (j.pv <= 0 || j.invuln > temps) return;
  deg = Math.round(deg * bonus(j, 'bouclier'));
  j.pv = Math.max(0, j.pv - deg); j.flash = 8; j.kx += Math.cos(ang) * 10; j.ky += Math.sin(ang) * 10;
  if (j.pv === 0) { mourir(j); if (mode.reapparition) j.revivre = temps + (+mode.delaiReapparition || 3) * 60; }
}
function iaBot(j) { // 🤖 : vise l'ennemi visible le plus proche, garde ses distances et tourne autour
  if (j.flash > 0) j.flash--;
  deplacer(j, j.kx, j.ky); j.kx *= 0.8; j.ky *= 0.8;
  if (j.pv <= 0) return;
  if (j.recharge <= 0) j.mun = Math.min(+j.perso.munitions || 3, j.mun + 1 / (+j.perso.recharge || 60));
  if (j.recharge > 0) j.recharge--;
  j.cache = tuileA(j.x, j.y) === 'B' || !!pouvoirActif(j, 'invisible');
  if (mode.botsObjets !== false) for (const o of objets) { // 🤖 ramasse les objets rares
    const d = Math.hypot(o.x - j.x, o.y - j.y);
    if (d < 42) { objets = objets.filter(x => x !== o); envoyer({ t: 'pr', tx: o.tx, ty: o.ty }); activerPouvoir(o.id, j); break; }
    if (d < 260 && !j.objet) j.objet = o;
  }
  if (j.objet && !objets.includes(j.objet)) j.objet = null;
  let c = null, dm = 1e9;
  for (const e of [...joueurs().filter(o => o.eq !== j.eq && o.pv > 0), ...bosses.filter(b => b.pv > 0)]) {
    const d = Math.hypot(e.x - j.x, e.y - j.y);
    if ((!e.cache || d < 170) && d < dm) { dm = d; c = e; }
  }
  const v = j.perso.vitesse * (0.7 + 0.15 * (j.niv || 1)) * bonus(j, 'vitesse');
  if (j.objet) { const a = Math.atan2(j.objet.y - j.y, j.objet.x - j.x); deplacer(j, Math.cos(a) * v, Math.sin(a) * v); j.marche += v; tourner(j, a, 0.15); if (!c || dm > 250) return; }
  if (c) {
    const a = Math.atan2(c.y - j.y, c.x - j.x), ideal = j.perso.portee * 0.7, cote = Math.sin(temps / 50 + j.x * 0.01) > 0 ? 1 : -1;
    const av = dm > ideal ? 1 : dm < ideal * 0.5 ? -1 : 0;
    deplacer(j, (Math.cos(a) * av - Math.sin(a) * cote * 0.6) * v, (Math.sin(a) * av + Math.cos(a) * cote * 0.6) * v);
    j.marche += v; tourner(j, a, 0.2);
    if (dm < j.perso.portee && j.recharge <= 0 && j.mun >= 1 && Math.random() < 0.05 * (j.niv || 1)) {
      const ang = a + (Math.random() - 0.5) * 0.35 / (j.niv || 1), f = Math.min(1, dm / j.perso.portee);
      j.mun -= 1; j.recharge = j.perso.delaiTir;
      const dg = Math.round(j.perso.degats * bonus(j, 'degats') * (0.8 + 0.2 * (j.niv || 1)));
      creerProjectile(j, ang, f, j.x, j.y, dg);
      envoyer({ t: 'tir', de: j.uid, a: +ang.toFixed(3), f: +f.toFixed(2), x: Math.round(j.x), y: Math.round(j.y), d: dg });
    }
  } else { // se promène sur la map
    if (!j.but || Math.hypot(j.but.x - j.x, j.but.y - j.y) < 30 || temps % 240 === 0) j.but = caseLibre([]);
    const a = Math.atan2(j.but.y - j.y, j.but.x - j.x);
    deplacer(j, Math.cos(a) * v, Math.sin(a) * v); j.marche += v; tourner(j, a, 0.1);
  }
}
function toucherMoi(deg, x, y, de) {
  if (moi.pv <= 0 || moi.invuln > temps) return;
  if (de) moi.dernier = de;
  deg = Math.round(deg * bonus(moi, 'bouclier'));     // bouclier = dégâts réduits
  moi.pv = Math.max(0, moi.pv - deg); moi.flash = 8;
  const ang = Math.atan2(moi.y - y, moi.x - x);
  moi.kx += Math.cos(ang) * 14; moi.ky += Math.sin(ang) * 14;
  texteFlottant('-' + deg, moi.x, moi.y - 50, '#ff4d4d');
  if (moi.pv === 0) mourir(moi);
}
function blesserBoss(b, deg) { if (b.pv <= 0) return; b.pv = Math.max(0, b.pv - deg); b.flash = 8; if (b.pv === 0) mortBoss(b); }
function mortBoss(b) { effet('explosion', b.x, b.y, '#7fbf3f', 130); secousse = 22; animMort(b, img(b.def.image)); }
function frappe(e, local) { // coup de massue d'un boss (local = calculé ici par l'hôte)
  effet('impact', e.x, e.y, '#f5deb3', e.r);
  if (moi.pv > 0 && Math.hypot(moi.x - e.x, moi.y - e.y) < e.r + moi.r * 0.5) toucherMoi(e.deg, e.x, e.y);
  if (local) abimerZone(e.x, e.y, e.r, e.deg);
}

// ---------- 10b. ÉLÉMENTS CASSABLES & SUPER POUVOIRS ----------
const bloqueTir = c => c === '#' || c === 'C';
function cassable(tx, ty) {
  if (tx <= 0 || ty <= 0 || tx >= map.l - 1 || ty >= map.h - 1) return false; // les bords de la map restent
  const c = tuile(tx, ty), d = map.def;
  return c === 'C' || (c === '#' && d.casseMurs) || (c === 'B' && d.casseBuissons);
}
function abimer(tx, ty, deg) { // appelé seulement par l'auteur du coup, le résultat est envoyé aux autres
  if (!cassable(tx, ty)) return;
  const c = tuile(tx, ty), k = tx + ',' + ty, pv = (+map.def.pvBloc || 3000) * (c === 'B' ? 0.5 : 1);
  degatsTuiles[k] = (degatsTuiles[k] || 0) + deg;
  if (degatsTuiles[k] < pv) return;
  const chance = c === 'C' ? map.def.chanceCoffre : map.def.chanceObjet;
  const o = Math.random() * 100 < (+chance || 0) ? tirerPouvoir() : null;
  casser(tx, ty, o); envoyer({ t: 'ca', tx, ty, o });
}
const abimerA = (x, y, deg) => abimer(Math.floor(x / TUILE), Math.floor(y / TUILE), deg);
function abimerZone(x, y, r, deg) {
  for (let ty = Math.floor((y - r) / TUILE); ty <= Math.floor((y + r) / TUILE); ty++)
    for (let tx = Math.floor((x - r) / TUILE); tx <= Math.floor((x + r) / TUILE); tx++)
      if (Math.hypot((tx + 0.5) * TUILE - x, (ty + 0.5) * TUILE - y) < r + TUILE * 0.5) abimer(tx, ty, deg);
}
function casser(tx, ty, o) {
  const c = tuile(tx, ty); if (c === '.' || !map.g[ty]) return;
  map.g[ty] = map.g[ty].slice(0, tx) + '.' + map.g[ty].slice(tx + 1);
  delete degatsTuiles[tx + ',' + ty];
  const d = map.def, x = (tx + 0.5) * TUILE, y = (ty + 0.5) * TUILE;
  const col = c === 'B' ? [d.buisson, d.buissonFonce] : c === 'C' ? ['#f1c40f', '#8e5a2b'] : [d.mur, d.murFace];
  for (let i = 0; i < 18; i++) particule(x, y - 10, col[i % 2] || '#a0522d', 7, 9);
  ondes.push({ x, y, r: 6, max: 50, c: '#fff', vie: 1, ep: 6 });
  secousse = Math.max(secousse, 5);
  if (o && CONFIG.pouvoirs[o]) objets.push({ tx, ty, x, y, id: o });
}
function tirerPouvoir() { // tirage au sort pondéré par la rareté
  const l = Object.entries(CONFIG.pouvoirs); if (!l.length) return null;
  let t = Math.random() * l.reduce((s, [, p]) => s + (+p.rarete || 1), 0);
  for (const [id, p] of l) if ((t -= +p.rarete || 1) <= 0) return id;
  return l[0][0];
}
function pouvoirActif(j, effet) {
  for (const [id, fin] of Object.entries(j.bonus || {})) { const p = CONFIG.pouvoirs[id]; if (p && p.effet === effet && fin > temps) return p; }
  return null;
}
const bonus = (j, effet) => { const p = pouvoirActif(j, effet); return p && !isNaN(+p.valeur) ? +p.valeur : 1; };
const bonusActifs = j => Object.entries(j.bonus || {}).filter(([, fin]) => fin > temps).map(([id]) => id);
function activerPouvoir(id, qui = moi) {
  const p = CONFIG.pouvoirs[id]; if (!p) return;
  if (p.effet === 'soin') qui.pv = Math.min(qui.pvMax, qui.pv + qui.pvMax * (+p.valeur || 0.3));
  else qui.bonus[id] = temps + (+p.duree || 8) * 60;
  if (qui !== moi) return texteFlottant((p.icone || '✨') + ' ' + p.nom, qui.x, qui.y - 70, p.couleur || '#fff');
  texteFlottant((p.icone || '✨') + ' ' + p.nom, moi.x, moi.y - 70, p.couleur || '#fff');
  effet('etincelle', moi.x, moi.y, p.couleur || '#fff');
}

// ---------- 10c. ARME DE TERRAIN (fait sortir des cases du sol) ----------
let retours = [], levees = {};
function setTuile(tx, ty, c) { map.g[ty] = map.g[ty].slice(0, tx) + c + map.g[ty].slice(tx + 1); delete degatsTuiles[tx + ',' + ty]; }
function casesTerrain(a, x, y, angle, dist) { // → [[tx, ty, délai], ...]
  const T = TUILE, n = Math.max(1, Math.round(+a.nbCases || 3)), dl = +a.delaiCase || 4, l = [];
  const cx = x + Math.cos(angle) * dist, cy = y + Math.sin(angle) * dist, ox = Math.floor(cx / T), oy = Math.floor(cy / T);
  const ajoute = (tx, ty, d) => { if (!l.some(c => c[0] === tx && c[1] === ty)) l.push([tx, ty, Math.round(d)]); };
  if (a.forme === 'ligne') for (let i = 1; i <= n; i++) ajoute(Math.floor((x + Math.cos(angle) * i * T) / T), Math.floor((y + Math.sin(angle) * i * T) / T), i * dl);
  else if (a.forme === 'mur') { const px = -Math.sin(angle), py = Math.cos(angle); for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * T; ajoute(Math.floor((cx + px * o) / T), Math.floor((cy + py * o) / T), Math.abs(i - (n - 1) / 2) * dl); } }
  else if (a.forme === 'croix') { ajoute(ox, oy, 0); for (let i = 1; i <= n; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ajoute(ox + dx * i, oy + dy * i, i * dl); }
  else { const r = (n - 1) / 2, R = Math.ceil(r); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (Math.hypot(dx, dy) <= r + 0.5) ajoute(ox + dx, oy + dy, Math.hypot(dx, dy) * dl); }
  return l;
}
function elever(tx, ty, p) {
  if (tx <= 0 || ty <= 0 || tx >= map.l - 1 || ty >= map.h - 1) return;
  const a = p.arme, ancien = tuile(tx, ty), c = a.typeCase || '#';
  if (ancien === 'C' || ancien === c) return;
  setTuile(tx, ty, c); levees[tx + ',' + ty] = temps;
  if (+a.dureeCase > 0) retours.push({ tx, ty, ancien, c, fin: temps + a.dureeCase * 60 }); // 0 = permanent
  const T = TUILE, x = (tx + 0.5) * T, y = (ty + 0.5) * T;
  effet(a.effet || 'impact', x, y, a.couleur, 45);
  for (const cb of cibles(p)) {
    const e = cb.e;
    if (!p.touches.has(cb.k) && Math.abs(e.x - x) < T / 2 + e.r * 0.6 && Math.abs(e.y - y) < T / 2 + e.r * 0.6) { p.touches.add(cb.k); impact(e, p, x, y, false); }
  }
  if (bloque(c)) liberer();
}
function liberer() { // éjecte ceux qui se retrouvent coincés dans un bloc
  for (const e of [moi, ...(hote ? [...bosses, ...Object.values(autres).filter(j => j.bot)] : [])]) if (e && !libre(e.x, e.y, e.r)) {
    for (let r = TUILE / 2; r < TUILE * 5; r += TUILE / 2) {
      const a = [...Array(12).keys()].map(i => i / 12 * Math.PI * 2).find(a => libre(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.r));
      if (a !== undefined) { e.x += Math.cos(a) * r; e.y += Math.sin(a) * r; break; }
    }
  }
}

// ---------- 11. LOGIQUE ----------
function maj() {
  temps++;
  let mx = 0, my = 0;
  if (touches.q || touches.a || touches.arrowleft) mx--;
  if (touches.d || touches.arrowright) mx++;
  if (touches.z || touches.w || touches.arrowup) my--;
  if (touches.s || touches.arrowdown) my++;
  const dk = Math.hypot(mx, my); if (dk) { mx /= dk; my /= dk; }
  if (joyG.actif) { const v = vec(joyG); if (v.d > 5) { mx = Math.cos(v.a) * v.f; my = Math.sin(v.a) * v.f; } }
  if (moi.pv <= 0) mx = my = 0;
  const elm = elemDe(moi.perso) || {}, surEau = tuileA(moi.x, moi.y) === 'W';
  const vit = moi.perso.vitesse * bonus(moi, 'vitesse') * (moi.dep === 'nage' && surEau ? +elm.valeur || 1.3 : 1);
  if (moi.dep === 'nage' && surEau && moi.pv > 0) moi.pv = Math.min(moi.pvMax, moi.pv + moi.pvMax * (+elm.soin || 0) / 100 / 60); // 💧 se soigne dans l'eau
  if (moi.dep === 'brise' && (mx || my)) { const tx = Math.floor((moi.x + mx * moi.r * 1.3) / TUILE), ty = Math.floor((moi.y + my * moi.r * 1.3) / TUILE); if (bloqueTir(tuile(tx, ty))) abimer(tx, ty, +elm.valeur || 60); } // 🌍 brise les blocs en fonçant dedans
  deplacer(moi, mx * vit + moi.kx, my * vit + moi.ky);
  moi.kx *= 0.8; moi.ky *= 0.8;
  if (mx || my) { moi.marche += vit; if (!joyD.actif) tourner(moi, Math.atan2(my, mx), 0.25); }
  if (joyD.actif) { const v = vec(joyD); if (v.d > 15) tourner(moi, v.a, 0.4); }
  if (moi.recharge > 0) moi.recharge--;
  if (moi.flash > 0) moi.flash--;
  if (moi.recharge <= 0) moi.mun = Math.min(+moi.perso.munitions || 3, moi.mun + 1 / (+moi.perso.recharge || 60)); // recharge des munitions
  moi.cache = tuileA(moi.x, moi.y) === 'B' || !!pouvoirActif(moi, 'invisible') || nuages.some(n => !n.feu && Math.hypot(n.x - moi.x, n.y - moi.y) < n.r);
  for (const j of joueurs()) if (j.dep === 'feu' && j.pv > 0 && j.marche !== j.mFeu) { j.mFeu = j.marche; if (temps % 10 === 0) { const e = elemDe(j.perso) || {}; nuages.push({ x: j.x, y: j.y + 10, r: 28, fin: temps + (+e.duree || 2) * 60, debut: temps, c: '#ff6a00', deg: +e.valeur || 120, de: j.uid, arme: { effet: 'etincelle', couleur: '#ff8a00' }, feu: true }); } } // 🔥 traînée de feu
  for (const o of objets) if (moi.pv > 0 && Math.hypot(o.x - moi.x, o.y - moi.y) < 42) {
    objets = objets.filter(x => x !== o); envoyer({ t: 'pr', tx: o.tx, ty: o.ty }); activerPouvoir(o.id); break;
  }
  for (const j of Object.values(autres)) {
    if (j.bot && hote) iaBot(j);
    else { j.x += (j.tx - j.x) * 0.35; j.y += (j.ty - j.y) * 0.35; if (j.flash > 0) j.flash--; }
    if (j.bot && hote && j.revivre && temps >= j.revivre) revivre(j);
  }
  for (const b of bosses) {
    if (hote) iaBoss(b);
    else { b.x += (b.tx - b.x) * 0.3; b.y += (b.ty - b.y) * 0.3; if (b.flash > 0) b.flash--; }
  }
  retours = retours.filter(r => { // les cases temporaires reviennent à leur état d'origine
    if (temps < r.fin) return true;
    if (tuile(r.tx, r.ty) === r.c) { setTuile(r.tx, r.ty, r.ancien); levees[r.tx + ',' + r.ty] = temps; if (bloque(r.ancien)) liberer(); }
    return false;
  });
  majProjectiles(); majEffets();
  const vw = W / zoom, vh = H / zoom, cible = (p, v, m) => m <= v ? m / 2 : Math.max(v / 2, Math.min(m - v / 2, p));
  const vue = cibleCamera();
  cam.x += (cible(vue.x, vw, map.l * TUILE) - cam.x) * 0.12;
  cam.y += (cible(vue.y, vh, map.h * TUILE) - cam.y) * 0.12;
  majEvenements();
  envoyerEtat(false);
  verifierFin();
  if (finDans > 0 && --finDans === 0) { etat = resultat; joyG.actif = joyD.actif = false; }
}
function iaBoss(b) {
  const D = b.def;
  if (b.flash > 0) b.flash--;
  if (!D.cristal) deplacer(b, b.kx, b.ky); b.kx *= 0.8; b.ky *= 0.8;
  if (b.pv <= 0) return;
  if (D.cristal) { // 💎 le cristal tire sur les ennemis proches
    let c = null, dm = D.porteeTir;
    for (const j of joueurs()) if (j.pv > 0 && j.eq !== b.eq) { const d = Math.hypot(j.x - b.x, j.y - b.y); if (d < dm) { dm = d; c = j; } }
    if (c && b.tir-- <= 0) {
      const a = Math.atan2(c.y - b.y, c.x - b.x); b.tir = D.cadenceTir;
      creerProjectile(b, a, 1, b.x, b.y - 20, b.perso.degats);
      envoyer({ t: 'tir', de: b.uid, a: +a.toFixed(3), f: 1, x: Math.round(b.x), y: Math.round(b.y - 20), d: b.perso.degats });
    }
    return;
  }
  let cible = null, dmin = 1e9;
  for (const j of joueurs()) if (j.pv > 0 && j.eq !== b.eq) {
    const d = Math.hypot(j.x - b.x, j.y - b.y);
    if ((!j.cache || d < 170) && d < dmin) { dmin = d; cible = j; } // caché (buisson/fantôme) = invisible de loin
  }
  if (cible) { b.cx = cible.x; b.cy = cible.y; }
  b.rage = b.pv < b.pvMax / 2;
  if (b.charge > 0) {
    if (--b.charge === 0) { const e = { t: 'fr', x: b.fx, y: b.fy, r: D.rayonAttaque, deg: D.degats }; frappe(e, true); envoyer(e); b.recharge = D.delaiAttaque; }
    return;
  }
  if (b.recharge > 0) b.recharge--;
  if (b.arme && cible && b.tir-- <= 0 && dmin < b.perso.portee && dmin > b.r + 60) { // tir à distance (effet sombre)
    const a = Math.atan2(cible.y - b.y, cible.x - b.x), f = Math.min(1, dmin / b.perso.portee);
    b.tir = +D.cadenceTir || 90; b.angle = a;
    creerProjectile(b, a, f, b.x, b.y, b.perso.degats);
    envoyer({ t: 'tir', de: b.uid, a: +a.toFixed(3), f: +f.toFixed(2), x: Math.round(b.x), y: Math.round(b.y), d: b.perso.degats });
  }
  if (cible && dmin < b.r + cible.r + 30 && b.recharge <= 0) {
    const a = Math.atan2(cible.y - b.y, cible.x - b.x);
    b.angle = a; b.chargeMax = b.charge = b.rage ? 24 : 36;
    b.fx = b.x + Math.cos(a) * b.r * 1.1; b.fy = b.y + Math.sin(a) * b.r * 1.1;
    return;
  }
  const dx = b.cx - b.x, dy = b.cy - b.y, d = Math.hypot(dx, dy);
  if (d > 8) {
    const v = D.vitesse * (b.rage ? 1.4 : 1), ux = dx / d, uy = dy / d, x0 = b.x, y0 = b.y;
    deplacer(b, ux * v, uy * v);
    if (Math.hypot(b.x - x0, b.y - y0) < v * 0.3) { const s = Math.floor(temps / 120 + b.i) % 2 ? 1 : -1; deplacer(b, -uy * v * s, ux * v * s); }
    b.marche += v; tourner(b, Math.atan2(dy, dx), 0.08);
  }
  for (const o of bosses) if (o !== b && o.pv > 0) {
    const dd = Math.hypot(b.x - o.x, b.y - o.y) || 1;
    if (dd < b.r + o.r) deplacer(b, (b.x - o.x) / dd * 1.5, (b.y - o.y) / dd * 1.5);
  }
}

// ---------- 12. EFFETS (animations d'impact différentes par arme) ----------
function particule(x, y, c, vit, taille, vie = 1, forme = 'rond', extra = {}) {
  const a = Math.random() * Math.PI * 2, v = vit * (0.4 + Math.random() * 0.6);
  particules.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, t: taille * (0.6 + Math.random() * 0.6), vie, forme }, extra));
}
function effet(type, x, y, couleur = '#fff', rayon = 60, angle = 0) {
  if (type === 'explosion') {          // 💣 boule de feu + onde + fumée
    secousse = Math.max(secousse, 10);
    ondes.push({ x, y, r: 8, max: rayon * 1.3, c: couleur, vie: 1, ep: 10 });
    for (let i = 0; i < 26; i++) particule(x, y, ['#fff3b0', '#ffd23f', couleur, '#ff4d1a'][i % 4], rayon / 9, 14);
    for (let i = 0; i < 10; i++) particule(x, y, 'rgba(70,70,70,0.7)', rayon / 18, 18, 1.4, 'fumee');
  } else if (type === 'entaille') {    // 🪃 double entaille en X + éclats
    secousse = Math.max(secousse, 4);
    for (const d of [-0.7, 0.7]) particules.push({ x, y, vx: 0, vy: 0, c: couleur, t: 7, vie: 1, forme: 'trait', a: angle + Math.PI / 2 + d, len: 80 });
    for (let i = 0; i < 12; i++) particule(x, y, i % 2 ? couleur : '#fff', 7, 5);
  } else if (type === 'etincelle') {   // ✨ petites étincelles
    ondes.push({ x, y, r: 4, max: 34, c: couleur, vie: 1, ep: 4 });
    for (let i = 0; i < 12; i++) particule(x, y, i % 2 ? couleur : '#fff', 6, 4, 1, 'trait', { len: 12 });
  } else if (type === 'foudre') {       // ⚡ éclairs
    secousse = Math.max(secousse, 8);
    for (let k = 0; k < 3; k++) {
      const pts = []; let px = x + (Math.random() - 0.5) * 30, py = y - 160;
      for (let i = 0; i < 8; i++) { pts.push([px, py]); px += (Math.random() - 0.5) * 34; py += 20; }
      pts.push([x, y]); particules.push({ x, y, vx: 0, vy: 0, c: k ? couleur : '#fff', t: 5 - k, vie: 1, forme: 'eclair', pts });
    }
    ondes.push({ x, y, r: 6, max: rayon, c: '#fffbe0', vie: 1, ep: 8 });
    for (let i = 0; i < 12; i++) particule(x, y, i % 2 ? couleur : '#fff', 8, 3, 1, 'trait', { len: 14 });
  } else if (type === 'glace') {        // ❄️ éclats de glace
    ondes.push({ x, y, r: 6, max: rayon, c: '#c8f4ff', vie: 1, ep: 10 });
    for (let i = 0; i < 14; i++) particule(x, y, i % 2 ? '#e8fbff' : couleur, 6, 5, 1.2, 'trait', { len: 22 });
    for (let i = 0; i < 10; i++) particule(x, y, '#ffffff', 3, 3, 1.5);
  } else if (type === 'poison') {       // ☠️ bulles toxiques
    for (let i = 0; i < 22; i++) particule(x + (Math.random() - 0.5) * rayon, y + (Math.random() - 0.5) * rayon * 0.6, i % 3 ? couleur : '#b7ff4a', 1.5, 7, 2, 'bulle', { g: -0.03 });
    ondes.push({ x, y, r: 6, max: rayon * 0.9, c: couleur, vie: 1, ep: 6 });
  } else if (type === 'feu') {          // 🔥 flammes
    for (let i = 0; i < 26; i++) particule(x + (Math.random() - 0.5) * rayon * 0.8, y, ['#fff3b0', '#ffb000', couleur, '#ff3b00'][i % 4], 2, 10, 1.3, 'rond', { g: -0.15 });
    for (let i = 0; i < 6; i++) particule(x, y - 20, 'rgba(60,60,60,.6)', 1.5, 14, 1.6, 'fumee');
  } else if (type === 'etoiles') {      // ⭐ étoiles
    for (let i = 0; i < 14; i++) particule(x, y, ['#ffd23f', '#fff', couleur][i % 3], 9, 9, 1.2, 'etoile');
    ondes.push({ x, y, r: 6, max: rayon, c: '#ffd23f', vie: 1, ep: 5 });
  } else if (type === 'vortex') {       // 🌀 tourbillon
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; particules.push({ x: x + Math.cos(a) * rayon, y: y + Math.sin(a) * rayon, vx: -Math.sin(a) * 5 - Math.cos(a) * 3, vy: Math.cos(a) * 5 - Math.sin(a) * 3, c: i % 2 ? couleur : '#fff', t: 5, vie: 1.2, forme: 'rond' }); }
  } else if (type === 'eclaboussure') { // 💦 gouttes
    for (let i = 0; i < 20; i++) particule(x, y, i % 2 ? couleur : '#e0f7ff', 6, 5, 1.2, 'rond', { vy: -4 - Math.random() * 4, g: 0.35 });
    ondes.push({ x, y, r: 6, max: rayon, c: '#bff0ff', vie: 1, ep: 6 });
  } else if (type === 'impact') {      // 🔨 massue du boss : onde de choc + poussière
    secousse = Math.max(secousse, 14);
    ondes.push({ x, y, r: 10, max: rayon * 1.2, c: couleur, vie: 1, ep: 14 });
    for (let i = 0; i < 22; i++) particule(x, y, ['#8b5a2b', '#a0835f', '#6b4a2b'][i % 3], rayon / 10, 12);
    for (let i = 0; i < 8; i++) particule(x, y, 'rgba(160,140,110,0.7)', rayon / 20, 20, 1.3, 'fumee');
  }
}

// ---------- 12b. DESSIN : outils ----------
function texte(t, x, y, taille, couleur, align = 'center', maxW) { // typographie moderne (Inter) avec ombre douce ; maxW = rétrécit si trop long
  ctx.font = `700 ${taille}px Inter, -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`;
  if (maxW && ctx.measureText(t).width > maxW) { taille = Math.max(7, taille * maxW / ctx.measureText(t).width); ctx.font = `700 ${taille}px Inter, -apple-system, system-ui, sans-serif`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = Math.max(2, taille / 4); ctx.shadowOffsetY = 1;
  ctx.fillStyle = couleur; ctx.fillText(t, x, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}
function rect(x, y, w, h, r, fill, stroke, ep = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = ep; ctx.stroke(); }
}
function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); }


let decor3D = null;
const varDecor = (px, py) => Math.floor(alea(px * 0.37 + py * 0.11) * 3);
function mur(px, py) { if (decor3D) ctx.drawImage(decor3D.murs[varDecor(px, py)], px - 2.94, py - HAUT_MUR - 5, 69.9, 101.9); else ctx.drawImage(spriteBloc(map.def, false), px - 2, py - HAUT_MUR - 2); }
const DUREE_ANIM = { attaque: 24, touche: 18, mort: 45, releve: 40 }; // durée des animations spéciales (images à 60/s)
function animSpeciale(e, sp) { // quelle animation spéciale jouer maintenant ?
  if (!sp.spec) return null;
  if (e.pv <= 0) { if (!e.mortT) e.mortT = temps; return sp.spec.lignes.mort ? { n: 'mort', t: e.mortT } : null; }
  e.mortT = 0;
  if (e.flash >= 7 && (!e.anim || e.anim.n !== 'touche' || temps - e.anim.t > 8) && (!e.anim || e.anim.n !== 'attaque')) e.anim = { n: 'touche', t: temps };
  if (e.anim && temps - e.anim.t < DUREE_ANIM[e.anim.n] && sp.spec.lignes[e.anim.n]) return e.anim;
  return null;
}
function dessiner3D(e, sp, anneau, taille) { // perso 3D : on choisit la vignette selon la direction et la pose de marche
  ombreDouce(e.x, e.y + e.r * 0.45, e.r * 1.15, e.r * 0.62);
  ctx.strokeStyle = anneau; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * 1.05, e.r * 0.6, 0, 0, 7); ctx.stroke();
  const a = ((e.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), d = Math.round(a / (Math.PI * 2) * sp.DIRS) % sp.DIRS;
  if (e.marche !== e.mPrec) { e.mPrec = e.marche; e.mT = temps; }
  const po = temps - (e.mT || -99) < 10 ? 1 + Math.floor((e.marche || 0) * 0.1) % sp.MARCHE : 0; // 0 = repos, 1.. = marche
  const k = (taille * 1.45) / (sp.bas - sp.haut) * ((e.def ? 1 : 26 / e.r) * (+(baseDe(e.perso) || {}).modeleEchelle || 1)), s = sp.S * k, x = e.x - s / 2, y = e.y + e.r * 0.5 - sp.bas * k - (e.alt || 0); // pieds posés sur l'anneau (ou en vol)
  e.topY = y + sp.haut * k; e.topT = temps; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = e.cache ? 0.5 : 1;
  const an = animSpeciale(e, sp);
  if (an) { // 🎬 attaque / coup reçu / mort / relevé
    const sc = sp.spec, [l0, nb] = sc.lignes[an.n], f = Math.min(nb - 1, Math.floor((temps - an.t) / DUREE_ANIM[an.n] * nb)), d8 = Math.round(a / (Math.PI * 2) * sc.DIRS) % sc.DIRS;
    if (e.pv <= 0) ctx.globalAlpha = Math.max(0.35, 1 - (temps - an.t) / 240);
    ctx.drawImage(sc.planche, d8 * sc.S, (l0 + f) * sc.S, sc.S, sc.S, x, y, s, s);
  } else ctx.drawImage(sp.planche, d * sp.S, po * sp.S, sp.S, sp.S, x, y, s, s);
  if (e.flash > 0 && !an) { ctx.globalAlpha = (e.flash / 8) * 0.9; ctx.drawImage(blanc(sp.planche), d * sp.S, po * sp.S, sp.S, sp.S, x, y, s, s); }
  ctx.globalAlpha = 1;
}
function dessinerEntite(e, im, anneau, taille) {
  e.alt = e.dep === 'vol' ? ((elemDe(e.perso) || {}).altitude || 22) + Math.sin(temps * 0.08 + e.x * 0.01) * 4 : 0; // 💨 altitude
  const sp3 = e.perso && obtenir3D(e.perso);
  if (sp3) return dessiner3D(e, sp3, anneau, taille);
  if (e.rage) ellipse(e.x, e.y + e.r * 0.45, e.r * 1.5, e.r * 0.9, `rgba(255,0,0,${0.15 + 0.1 * Math.sin(temps * 0.2)})`);
  ombreDouce(e.x, e.y + e.r * 0.45, e.r * 1.15, e.r * 0.62);
  ctx.strokeStyle = anneau; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalAlpha = e.cache ? 0.5 : 1;
  e.topY = e.y - e.r * 0.3 - taille * 0.45; e.topT = temps;
  ctx.translate(e.x, e.y - e.r * 0.3 - (e.alt || 0));
  ctx.rotate(e.angle + Math.PI / 2); // les images regardent vers le haut → on les tourne dans la direction du mouvement
  const gonfle = e.charge > 0 ? (1 - e.charge / e.chargeMax) * 0.15 : 0;
  const sz = taille * (1 + Math.sin(e.marche * 0.18) * 0.05 + gonfle);
  if (pret(im)) {
    ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz);
    if (e.flash > 0) { ctx.globalAlpha = (e.flash / 8) * 0.9; ctx.drawImage(blanc(im), -sz / 2, -sz / 2, sz, sz); }
  } else {
    ctx.rotate(-(e.angle + Math.PI / 2)); ctx.drawImage(faceParDefaut(baseDe(e.perso) || {}), -e.r * 1.3, -e.r * 1.3, e.r * 2.6, e.r * 2.6);
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -e.r, 8, 16);
  }
  ctx.restore();
}


function dessinerProjectile(p) {
  if (p.tr && p.tr.length > 1) { // traînée lumineuse
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < p.tr.length; i++) { ctx.globalAlpha = i / p.tr.length * 0.6; ctx.strokeStyle = p.sombre ? '#6a00a8' : (p.arme.couleur || '#fff'); ctx.lineWidth = (p.arme.taille || 12) * 0.7 * i / p.tr.length;
      ctx.beginPath(); ctx.moveTo(p.tr[i - 1].x, p.tr[i - 1].y - 10); ctx.lineTo(p.tr[i].x, p.tr[i].y - 10); ctx.stroke(); }
    ctx.restore();
  }
  const a = p.arme, im = img(a.image), s = (a.taille || 16) * 2.4;
  const k = 1 - p.z / 220;
  if (p.sombre) { ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = 25; ellipse(p.x, p.y - p.z - 10, s * 0.6, s * 0.6, 'rgba(30,0,45,.65)'); ctx.restore(); }
  ellipse(p.x, p.y + 6, s * 0.4 * k, s * 0.22 * k, 'rgba(0,0,0,.3)');
  ctx.save();
  ctx.translate(p.x, p.y - p.z - 10);
  ctx.rotate(p.type === 'droit' ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.rot);
  if (pret(im)) ctx.drawImage(im, -s / 2, -s / 2, s, s);
  else { ctx.fillStyle = a.couleur || '#fff'; ctx.shadowColor = a.couleur || '#fff'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, s / 3, 0, 7); ctx.fill(); }
  ctx.restore();
}


function dessinerEffets() {
  for (const o of ondes) {
    ctx.globalAlpha = Math.max(0, o.vie); ctx.strokeStyle = o.c; ctx.lineWidth = o.ep * o.vie;
    ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.8, 0, 0, 7); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of particules) {
    ctx.globalCompositeOperation = p.forme === 'fumee' ? 'source-over' : 'lighter'; // étincelles lumineuses
    ctx.globalAlpha = Math.max(0, Math.min(1, p.vie)); ctx.fillStyle = ctx.strokeStyle = p.c;
    if (p.forme === 'trait') {
      const a = p.a !== undefined ? p.a : Math.atan2(p.vy, p.vx), l = p.len / 2;
      ctx.lineWidth = p.t * Math.max(0.2, p.vie);
      ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); ctx.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); ctx.stroke();
    } else if (p.forme === 'eclair') {
      ctx.lineWidth = p.t; ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    } else if (p.forme === 'etoile') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? p.t * 0.45 : p.t, a = i * Math.PI / 5 + p.vie * 3; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
      ctx.fill();
    } else if (p.forme === 'bulle') {
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 7); ctx.stroke();
      ctx.globalAlpha *= 0.3; ctx.fill();
    } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 7); ctx.fill(); }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const t of textes) { ctx.globalAlpha = Math.max(0, Math.min(1, t.vie * 1.5)); titre(t.txt, t.x, t.y, 24 * (1 + Math.max(0, t.vie - 0.85) * 2.5), t.c); } // chiffres qui rebondissent
  ctx.globalAlpha = 1;
}

function majEffets() {
  for (const p of particules) {
    p.x += p.vx; p.y += p.vy;
    if (p.g) { p.vy += p.g; p.vx *= 0.95; } else { p.vx *= 0.9; p.vy *= 0.9; }
    if (p.forme === 'fumee') { p.t *= 1.03; p.y -= 0.4; p.vie -= 0.025; }
    else if (p.forme === 'bulle') p.vie -= 0.025;
    else p.vie -= p.forme === 'eclair' ? 0.07 : p.forme === 'trait' && p.a !== undefined ? 0.06 : 0.04;
  }
  for (const o of ondes) { o.r += (o.max - o.r) * 0.25; o.vie -= 0.06; }
  for (const t of textes) { t.y -= 1; t.vie -= 0.02; }
  particules = particules.filter(p => p.vie > 0); ondes = ondes.filter(o => o.vie > 0); textes = textes.filter(t => t.vie > 0);
}

function texteFlottant(txt, x, y, c) { textes.push({ txt, x: x + (Math.random() - 0.5) * 20, y, c, vie: 1 }); }

// ---------- 12c. GRAPHISMES : textures & sprites pré-calculés (rapides) ----------
const cacheGfx = {};
function ombrer(hex, k) { // éclaircit (k>0) ou assombrit (k<0) une couleur #rrggbb
  const n = parseInt((hex || '#888888').slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c + (k > 0 ? (255 - c) * k : c * k))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function alea(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); } // hasard reproductible
function motifHerbe(d) { // herbe réaliste : bruit à plusieurs échelles + brins + petites zones de terre, raccord sans couture
  const k = 'h2' + d.herbe1 + d.herbe2; if (cacheGfx[k]) return cacheGfx[k];
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N);
  const c1 = parseInt(d.herbe1.slice(1), 16), c2 = parseInt(d.herbe2.slice(1), 16), rgb = n => [n >> 16, (n >> 8) & 255, n & 255], A = rgb(c1), B = rgb(c2);
  const bruit = (px, py, f) => { const X = px * f / N, Y = py * f / N, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, s = t => t * t * (3 - 2 * t);
    const g = (i, j) => alea(((i % f) + f) % f * 131 + (((j % f) + f) % f) * 17 + f * 7); const a = g(x0, y0), b = g(x0 + 1, y0), cc = g(x0, y0 + 1), dd = g(x0 + 1, y0 + 1);
    return a + (b - a) * s(fx) + (cc - a) * s(fy) + (a - b - cc + dd) * s(fx) * s(fy); };
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const n = bruit(px, py, 4) * 0.5 + bruit(px, py, 8) * 0.3 + bruit(px, py, 32) * 0.2, t = Math.min(1, Math.max(0, (n - 0.3) * 1.6)), l = 0.9 + bruit(px, py, 64) * 0.2, o = (py * N + px) * 4;
    for (let k2 = 0; k2 < 3; k2++) im.data[o + k2] = (A[k2] * (1 - t) + B[k2] * t) * l; im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  for (let i = 0; i < 2200; i++) { // brins d'herbe
    const px = alea(i + 7) * N, py = alea(i + 3000) * N, len = 3 + alea(i + 9000) * 7, a = -Math.PI / 2 + (alea(i + 5) - 0.5) * 0.9;
    x.strokeStyle = alea(i + 77) > 0.55 ? 'rgba(255,255,220,.10)' : 'rgba(0,35,0,.16)'; x.lineWidth = 1.1;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + 1, py + Math.sin(a) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
  }
  return cacheGfx[k] = ctx.createPattern(c, 'repeat');
}
function spriteBloc(d, estCoffre) { // mur / coffre en relief avec biseau et dégradés
  const k = 'b' + estCoffre + d.mur + d.murFace; if (cacheGfx[k]) return cacheGfx[k];
  const T = TUILE, h = HAUT_MUR, c = document.createElement('canvas'); c.width = T + 4; c.height = T + h + 4;
  const x = c.getContext('2d'), haut = estCoffre ? '#c98a4b' : d.mur, face = estCoffre ? '#7a4a22' : d.murFace;
  x.translate(2, 2);
  let g = x.createLinearGradient(0, T - h, 0, T + h); g.addColorStop(0, face); g.addColorStop(1, ombrer(face, -0.35));
  x.fillStyle = g; x.beginPath(); x.roundRect(0, h, T, T, 10); x.fill();                           // face avant
  g = x.createLinearGradient(0, 0, T, T); g.addColorStop(0, ombrer(haut, 0.22)); g.addColorStop(1, ombrer(haut, -0.08));
  x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, T, T, 10); x.fill();                           // dessus
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${alea(i) > 0.5 ? '255,255,255' : '0,0,0'},.06)`; x.fillRect(alea(i + 3) * T, alea(i + 8) * T, 3, 3); }
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.roundRect(2, 2, T - 4, T - 4, 8); x.stroke(); // biseau clair
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(8, T / 2); x.lineTo(T - 8, T / 2); x.stroke();
  if (estCoffre) { x.fillStyle = '#f5c542'; x.fillRect(0, 22, T, 7); x.fillRect(T / 2 - 5, 0, 10, T); x.fillStyle = '#fff6c9'; x.fillRect(T / 2 - 5, 22, 10, 7); }
  return cacheGfx[k] = c;
}
function spriteOmbre() {
  if (cacheGfx.ombre) return cacheGfx.ombre;
  const c = document.createElement('canvas'); c.width = TUILE + 30; c.height = TUILE + 30; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(0,0,0,.045)'; x.beginPath(); x.roundRect(14 - i * 1.5, 12 - i * 1.5, TUILE + i * 3, TUILE + i * 3, 12 + i); x.fill(); }
  return cacheGfx.ombre = c;
}
function spriteBuisson(d) {
  const k = 'bu' + d.buisson + d.buissonFonce; if (cacheGfx[k]) return cacheGfx[k];
  const c = document.createElement('canvas'); c.width = 92; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(46, 80, 40, 12, 0, 0, 7); x.fill();
  const boule = (bx, by, r, col) => { const g = x.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r); g.addColorStop(0, ombrer(col, 0.35)); g.addColorStop(0.6, col); g.addColorStop(1, ombrer(col, -0.35)); x.fillStyle = g; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); };
  [[24, 56, 24], [68, 56, 24], [46, 64, 26], [46, 40, 24]].forEach(([a, b, r]) => boule(a, b, r, d.buissonFonce || '#1f7a35'));
  [[30, 46, 18], [62, 46, 18], [46, 34, 18], [46, 56, 18]].forEach(([a, b, r]) => boule(a, b, r, d.buisson || '#2fae4a'));
  for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.ellipse(18 + alea(i) * 56, 22 + alea(i + 40) * 48, 3, 1.6, alea(i + 9) * 3, 0, 7); x.fill(); }
  return cacheGfx[k] = c;
}
function spriteDeco(k) { // petites fleurs, cailloux, touffes
  const cle = 'deco' + k; if (cacheGfx[cle]) return cacheGfx[cle];
  const c = document.createElement('canvas'); c.width = c.height = 34; const x = c.getContext('2d');
  if (k === 0 || k === 1) { const col = k ? '#ffd23f' : '#ffffff'; for (let i = 0; i < 4; i++) { const cx = 8 + alea(i + k * 9) * 18, cy = 8 + alea(i + 30 + k) * 18;
    x.fillStyle = 'rgba(0,40,0,.25)'; x.beginPath(); x.ellipse(cx, cy + 3, 4, 2, 0, 0, 7); x.fill();
    for (let pe = 0; pe < 5; pe++) { const a = pe / 5 * Math.PI * 2; x.fillStyle = col; x.beginPath(); x.arc(cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, 2, 0, 7); x.fill(); }
    x.fillStyle = k ? '#ff8a00' : '#ffd23f'; x.beginPath(); x.arc(cx, cy, 1.6, 0, 7); x.fill(); } }
  else if (k === 2) for (let i = 0; i < 3; i++) { const cx = 8 + alea(i + 70) * 18, cy = 10 + alea(i + 80) * 16, r = 3 + alea(i + 90) * 3;
    const g = x.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, r); g.addColorStop(0, '#d9d4cc'); g.addColorStop(1, '#8a857c'); x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(cx + 1, cy + 2, r, r * 0.6, 0, 0, 7); x.fill(); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r, r * 0.75, 0, 0, 7); x.fill(); }
  else { x.strokeStyle = 'rgba(20,90,20,.55)'; x.lineWidth = 1.6; x.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.18; x.beginPath(); x.moveTo(17, 28); x.quadraticCurveTo(17 + Math.cos(a) * 6, 20, 17 + Math.cos(a) * 12, 28 + Math.sin(a) * 14); x.stroke(); } }
  return cacheGfx[cle] = c;
}
function ombreDouce(x, y, rx, ry) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, 7); ctx.fill(); ctx.restore();
}
function vignette() {
  const k = 'v' + W + 'x' + H; if (cacheGfx[k]) return cacheGfx[k];
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,.45)'); return cacheGfx[k] = g;
}
function verre(x, y, w, h, r, teinte) { // panneau "liquid glass"
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, teinte || 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,.06)');
  rect(x, y, w, h, r, g, 'rgba(255,255,255,.28)', 1);
}
function dessinerCristal(b) { // 💎 cristal flottant aux couleurs de son équipe
  const col = b.eq === -1 ? '#b57bff' : b.eq === moi.eq ? '#5ac8fa' : '#ff5a6e', f = Math.sin(temps * 0.06) * 6, y = b.y - 30 + f;
  ombreDouce(b.x, b.y + 18, 40, 14);
  const halo = ctx.createRadialGradient(b.x, y, 4, b.x, y, 80); halo.addColorStop(0, col + '88'); halo.addColorStop(1, col + '00'); ctx.fillStyle = halo; ctx.fillRect(b.x - 80, y - 80, 160, 160);
  const pts = [[0, -46], [26, -14], [18, 30], [-18, 30], [-26, -14]];
  ctx.save(); ctx.translate(b.x, y); ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
  const g = ctx.createLinearGradient(-26, -46, 26, 30); g.addColorStop(0, ombrer(col, 0.6)); g.addColorStop(0.5, col); g.addColorStop(1, ombrer(col, -0.4));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(8, -14); ctx.lineTo(0, 30); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
  if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash / 8})`; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.fill(); }
  ctx.restore();
}

// ---------- 13. DESSIN : monde ----------
function dessinerJeu() {
  ecran(); ctx.fillStyle = '#16351f'; ctx.fillRect(0, 0, W, H);
  const s = secousse; secousse = secousse < 0.3 ? 0 : secousse * 0.85;
  monde((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  const T = TUILE, d = map.def, vw = W / zoom / 2 + T, vh = H / zoom / 2 + T * 2;
  const x0 = Math.max(0, Math.floor((cam.x - vw) / T)), x1 = Math.min(map.l - 1, Math.ceil((cam.x + vw) / T));
  const y0 = Math.max(0, Math.floor((cam.y - vh) / T)), y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh) / T));
  const tuiles = f => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(tuile(x, y), x, y, x * T, y * T); };

  ctx.fillStyle = motifHerbe(d); ctx.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T); // herbe texturée
  tuiles((c, x, y, px, py) => { if (c === '.' && alea(x * 97 + y * 13) < 0.16) ctx.drawImage(spriteDeco(Math.floor(alea(x + y * 7) * 4)), px + alea(x * 3 + y) * 30, py + alea(y * 5 + x) * 30); }); // fleurs & cailloux
  tuiles((c, x, y, px, py) => { // eau : dégradé, reflets animés et écume sur les bords
    if (c === 'Z') { // 🎯 zone
      const col = zoneControle === moi.eq ? '90,200,255' : typeof zoneControle === 'number' ? '255,90,90' : zoneControle ? '255,210,63' : '255,255,255';
      ctx.fillStyle = `rgba(${col},${0.16 + 0.06 * Math.sin(temps * 0.08)})`; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 3; ctx.beginPath();
      if (tuile(x, y - 1) !== 'Z') { ctx.moveTo(px, py); ctx.lineTo(px + T, py); } if (tuile(x, y + 1) !== 'Z') { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
      if (tuile(x - 1, y) !== 'Z') { ctx.moveTo(px, py); ctx.lineTo(px, py + T); } if (tuile(x + 1, y) !== 'Z') { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
      ctx.stroke(); return;
    }
    if (c !== 'W') return;
    ctx.fillStyle = d.eau || '#3aa6e0'; ctx.fillRect(px, py, T, T);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(temps * 0.03 + x * 0.7 + y * 0.9)})`; ctx.fillRect(px, py, T, T); // scintillement
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) { const o = Math.sin(temps * 0.04 + x * 1.7 + y + k * 2) * 6; ctx.beginPath(); ctx.moveTo(px + 8, py + 22 + k * 22 + o); ctx.bezierCurveTo(px + 24, py + 14 + k * 22 + o, px + 40, py + 30 + k * 22 + o, px + 56, py + 20 + k * 22 + o); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    if (tuile(x, y - 1) !== 'W') { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px, py, T, 8); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(px, py + 8, T, 2); }
    if (tuile(x, y + 1) !== 'W') ctx.fillRect(px, py + T - 3, T, 3);
    if (tuile(x - 1, y) !== 'W') ctx.fillRect(px, py, 3, T);
    if (tuile(x + 1, y) !== 'W') ctx.fillRect(px + T - 3, py, 3, T);
  });
  tuiles((c, x, y, px, py) => { if (bloqueTir(c)) ctx.drawImage(spriteOmbre(), px - 6, py - 2); }); // ombres douces
  for (const o of objets) { // objets rares au sol
    const p = CONFIG.pouvoirs[o.id] || {}, b = Math.sin(temps * 0.1 + o.x) * 5;
    ellipse(o.x, o.y + 14, 16, 7, 'rgba(0,0,0,.3)');
    ctx.save(); ctx.shadowColor = p.couleur || '#fff'; ctx.shadowBlur = 20;
    ellipse(o.x, o.y - 8 + b, 20, 20, p.couleur || '#fff'); ctx.restore();
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.icone || '✨', o.x, o.y - 7 + b);
  }

  dessinerVisee();
  for (const b of bosses) if (b.charge > 0 && b.pv > 0) {
    const k = 1 - b.charge / b.chargeMax, R = b.def.rayonAttaque;
    ellipse(b.fx, b.fy, R, R * 0.8, 'rgba(255,40,40,.2)');
    ellipse(b.fx, b.fy, R * k, R * 0.8 * k, 'rgba(255,40,40,.45)');
  }
  const objs = []; // tri par profondeur = effet 3D
  tuiles((c, x, y, px, py) => { if (c === '#') objs.push([(y + 1) * T - 1, () => { // les murs qui sortent du sol montent
                                   const f = levees[x + ',' + y] !== undefined ? Math.min(1, (temps - levees[x + ',' + y]) / 12) : 1;
                                   ctx.save(); ctx.translate(0, (1 - f) * 40); mur(px, py); fissures(x, y, px, py); ctx.restore(); }]);
                                 if (c === 'C') objs.push([(y + 1) * T - 1, () => { coffre(px, py); fissures(x, y, px, py); }]); });
  dessinerNuages();
  for (const j of joueurs()) if (visible(j) && (j.pv > 0 || ((obtenir3D(j.perso) || {}).spec || { lignes: {} }).lignes.mort))
    objs.push([j.y + j.r * 0.5, () => { aura(j); dessinerEntite(j, img(j.perso.image), j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.r * 2.9); }]);
  for (const b of bosses) if (b.pv > 0) objs.push([b.y + b.r * 0.5, () => b.def.cristal ? dessinerCristal(b) : dessinerEntite(b, img(b.def.image), '#ff7b1a', b.r * 2.9)]);
  for (const p of projectiles) if (p.type !== 'lob' && p.type !== 'terrain') objs.push([p.y, () => dessinerProjectile(p)]);
  objs.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());

  tuiles((c, x, y, px, py) => { if (c === 'B') buisson(px, py); });
  for (const p of projectiles) if (p.type === 'lob') dessinerProjectile(p);
  dessinerEffets();
  for (const j of joueurs()) if (j.pv > 0 && visible(j)) barreVie(j, j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.nom);
  for (const b of bosses) if (b.pv > 0) barreVie(b, '#ff7b1a');
  for (let k = 0; k < 5; k++) { // ombres de nuages qui glissent sur la map
    const nx = ((alea(k) * map.l * T + temps * (0.25 + k * 0.05)) % (map.l * T + 600)) - 300, ny = alea(k + 20) * map.h * T;
    const gn = ctx.createRadialGradient(nx, ny, 0, nx, ny, 260); gn.addColorStop(0, 'rgba(10,20,40,.12)'); gn.addColorStop(1, 'rgba(10,20,40,0)'); ctx.fillStyle = gn; ctx.fillRect(nx - 260, ny - 260, 520, 520);
  }
  ecran(); ctx.fillStyle = vignette(); ctx.fillRect(0, 0, W, H); // vignette cinéma
  const lum = ctx.createLinearGradient(0, 0, W, H); lum.addColorStop(0, 'rgba(255,225,160,.08)'); lum.addColorStop(1, 'rgba(60,90,200,.08)'); ctx.fillStyle = lum; ctx.fillRect(0, 0, W, H); // lumière chaude / ombre froide
  zoneSure(dessinerHUD);
}
function coffre(px, py) { if (decor3D) ctx.drawImage(decor3D.coffre, px - 2.94, py - HAUT_MUR - 5, 69.9, 101.9); else ctx.drawImage(spriteBloc(map.def, true), px - 2, py - HAUT_MUR - 2); emoji('✨', px + 32, py - HAUT_MUR + 30 + Math.sin(temps * 0.1) * 2, 14); }
function fissures(tx, ty, px, py) {
  const dg = degatsTuiles[tx + ',' + ty]; if (!dg) return;
  const k = Math.min(1, dg / (+map.def.pvBloc || 3000)), T = TUILE, y = py - HAUT_MUR;
  ctx.strokeStyle = `rgba(30,15,0,${0.4 + k * 0.5})`; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(px + 32, y + 10); ctx.lineTo(px + 24, y + 30); ctx.lineTo(px + 36, y + 42);
  if (k > 0.5) { ctx.moveTo(px + 24, y + 30); ctx.lineTo(px + 10, y + 36); ctx.moveTo(px + 36, y + 42); ctx.lineTo(px + 50, y + 56); }
  ctx.stroke();
}
function aura(j) { // anneau coloré pour chaque super pouvoir actif
  const l = j === moi ? bonusActifs(moi) : (j.bo || []);
  l.forEach((id, i) => {
    const p = CONFIG.pouvoirs[id]; if (!p) return;
    ctx.strokeStyle = p.couleur || '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(temps * 0.2 + i);
    ctx.beginPath(); ctx.ellipse(j.x, j.y + j.r * 0.45, j.r * (1.3 + i * 0.25), j.r * (0.75 + i * 0.15), 0, 0, 7); ctx.stroke();
  });
  ctx.globalAlpha = 1;
}
function buisson(px, py) {
  const cx = px + 32, cy = py + 24, sw = Math.sin(temps * 0.04 + px * 0.1) * 1.5;
  ctx.globalAlpha = Math.hypot(moi.x - cx, moi.y - cy - 8) < 70 ? 0.45 : 1;
  if (decor3D) ctx.drawImage(decor3D.buissons[varDecor(px, py)], px + 32 - 41.6 + sw, py + 32 - 83.55, 83.3, 133.7); else ctx.drawImage(spriteBuisson(map.def), px - 14 + sw, py - 22);
  ctx.globalAlpha = 1;
}
function dessinerVisee() {
  if (!joyD.actif) return;
  const v = vec(joyD); if (v.d < 15) return;
  const a = moi.arme, portee = moi.perso.portee;
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  if (a.type === 'terrain') { for (const [tx, ty] of casesTerrain(a, moi.x, moi.y, v.a, Math.max(TUILE, portee * v.f))) ctx.fillRect(tx * TUILE + 4, ty * TUILE + 4, TUILE - 8, TUILE - 8); }
  else if (a.type === 'lob') {
    const dist = Math.max(80, portee * v.f), tx = moi.x + Math.cos(v.a) * dist, ty = moi.y + Math.sin(v.a) * dist, R = a.rayon || 70;
    ctx.beginPath(); ctx.ellipse(tx, ty, R, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(moi.x, moi.y);
    ctx.quadraticCurveTo((moi.x + tx) / 2, (moi.y + ty) / 2 - dist * 0.35, tx, ty); ctx.stroke();
  } else { ctx.translate(moi.x, moi.y); ctx.rotate(v.a); ctx.beginPath(); ctx.roundRect(0, -16, portee, 32, 16); ctx.fill(); }
  ctx.restore();
}
function barreVie(e, couleur, nom) { // pastille nom + barre de vie + munitions, toujours AU-DESSUS du perso
  const w = Math.max(64, e.r * 2.3), top = e.topT >= temps - 1 ? e.topY : e.y - e.r * 1.7, x = e.x - w / 2, y = top - 14;
  if (nom) { ctx.font = '700 11px Inter, system-ui, sans-serif'; const tw = Math.min(150, ctx.measureText(nom).width + 18);
    rect(e.x - tw / 2, y - 22, tw, 17, 8.5, 'rgba(8,12,32,.6)'); texte(nom, e.x, y - 13.5, 11, '#fff', 'center', tw - 10); }
  rect(x - 2, y - 2, w + 4, 11, 5.5, 'rgba(8,12,32,.7)');
  if (e.pv > 0) { const f = Math.max(6, w * e.pv / e.pvMax), g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, ombrer(couleur, 0.3)); g.addColorStop(1, couleur);
    rect(x, y, f, 7, 3.5, g); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 3, y + 1, Math.max(0, f - 6), 1.5); }
  texte(String(Math.ceil(e.pv)), x + w + 5, y + 3.5, 10, '#fff', 'left');
  if (e === moi) { // munitions
    const n = +moi.perso.munitions || 3, sw = (w - (n - 1) * 3) / n, inf = pouvoirActif(moi, 'munitions');
    for (let i = 0; i < n; i++) { const f = inf ? 1 : Math.max(0, Math.min(1, moi.mun - i));
      rect(x + i * (sw + 3), y + 11, sw, 5, 2.5, 'rgba(8,12,32,.7)'); if (f > 0) rect(x + i * (sw + 3), y + 11, sw * f, 5, 2.5, f === 1 ? (inf ? '#b67aff' : '#ffb020') : '#8a6a20'); }
  }
}
function bouton(x, y, w, h, txt, fond, action, taille = 14) {
  rect(x, y, w, h, 12, fond, '#1a1030', 3); texte(txt, x + w / 2, y + h / 2, taille, '#fff');
  if (action) zones.push({ x, y, w, h, action });
}
function fond() { // fond sombre premium : dégradé profond, halos de couleur qui dérivent, grille au sol
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#05070f');
  ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
  const t = temps * 0.003, R = Math.max(W, H) * 0.6;
  [['#2563eb', 0.15, 0.2, 1], ['#7c3aed', 0.85, 0.15, 1.3], ['#db2777', 0.7, 0.9, 0.8]].forEach(([c, x, y, v], i) => {
    const cx = W * (x + Math.sin(t * v + i) * 0.08), cy = H * (y + Math.cos(t * v + i * 2) * 0.08), r = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    r.addColorStop(0, c + '77'); r.addColorStop(1, c + '00'); ctx.fillStyle = r; ctx.fillRect(-100, -100, W + 200, H + 200);
  });
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; const hz = H * 0.62; // grille en perspective
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hz); ctx.lineTo(W / 2 + i * W * 0.18, H + 20); ctx.stroke(); }
  for (let k = 0; k < 8; k++) { const y = hz + Math.pow(k / 8, 2) * (H - hz) + ((temps * 0.3) % 20) * (k / 8); ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(W + 10, y); ctx.stroke(); }
}
function dessinerHUD() {
  zones = []; hudExtra();
  const bw = Math.min(420, W * 0.5), bx = (W - bw) / 2;
  let y = 18;
  const bossV = bosses.filter(b => !b.def.cristal);
  if (bossV.length) {
    const pv = bossV.reduce((s, b) => s + Math.max(0, b.pv), 0), max = bossV.reduce((s, b) => s + b.pvMax, 0);
    const titre = bossV.length > 1 ? `BOSS ${bossV.filter(b => b.pv > 0).length}/${bossV.length}` : bossV[0].def.nom;
    texte(titre + (bossV.some(b => b.rage && b.pv > 0) ? ' 😡' : ''), W / 2, y, 16, '#ffd23f');
    verre(bx - 3, y + 12, bw + 6, 20, 10);
    if (pv > 0) rect(bx, y + 15, bw * pv / max, 14, 6, '#ff7b1a');
    y += 44;
  }
  const tous = [moi, ...Object.values(autres)], viv = l => l.filter(j => j.pv > 0 && !j.parti).length;
  const al = tous.filter(j => j.eq === moi.eq), en = tous.filter(j => j.eq !== moi.eq);
  if (tous.length > 1) texte((al.length > 1 ? `🟢 Alliés ${viv(al)}/${al.length}   ` : '') + (en.length ? `⚔️ Ennemis ${viv(en)}/${en.length}` : ''), W / 2, y, 15, '#fff');
  ctx.beginPath(); ctx.arc(38, 38, 28, 0, 7); ctx.fillStyle = moi.perso.couleur; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#1a1030'; ctx.stroke();
  const im = carteDe(moi.perso); if (pret(im)) ctx.drawImage(im, 14, 14, 48, 48);
  texte(moi.nom, 74, 26, 16, '#fff', 'left', 150);
  texte(Math.ceil(moi.pv) + ' PV', 74, 48, 13, '#8fd3ff', 'left');
  bonusActifs(moi).forEach((id, i) => { // super pouvoirs actifs + temps restant
    const p = CONFIG.pouvoirs[id], x = 14 + i * 50;
    rect(x, 74, 44, 44, 10, p.couleur || '#fff', '#1a1030', 3);
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.icone || '✨', x + 22, 92);
    texte(Math.ceil((moi.bonus[id] - temps) / 60) + 's', x + 22, 112, 11, '#fff');
  });
  if (mobile) { // emplacements des joysticks (comme arcade)
    const u = U();
    if (!joyG.actif) { ctx.globalAlpha = 0.18; ellipse(95 * u, H - 95 * u, 55 * u, 55 * u, '#fff'); ctx.globalAlpha = 0.35; ellipse(95 * u, H - 95 * u, 24 * u, 24 * u, '#fff'); ctx.globalAlpha = 1; }
    if (!joyD.actif) { ctx.globalAlpha = 0.2; ellipse(W - 95 * u, H - 95 * u, 55 * u, 55 * u, '#ffb000'); ctx.globalAlpha = 0.45; ellipse(W - 95 * u, H - 95 * u, 24 * u, 24 * u, '#ffb000'); ctx.globalAlpha = 1; emoji('🎯', W - 95 * u, H - 95 * u, 20 * u); }
  }
  dessinerJoystick(joyG, '#ffffff');
  dessinerJoystick(joyD, '#ffb000'); ecran();
  if (!('ontouchstart' in window)) texte('ZQSD/flèches : bouger • Clic : tirer • Espace : tir auto • Échap : quitter', W / 2, H - 16, 12, '#fff');
}
function dessinerJoystick(j, c) {
  if (!j.actif) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // les joysticks suivent le doigt (coordonnées écran brutes)
  const v = vec(j), l = Math.min(v.d, 50);
  ctx.globalAlpha = 0.3; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(j.ox, j.oy, 55, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(j.ox + Math.cos(v.a) * l, j.oy + Math.sin(v.a) * l, 24, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
// ---------- 14a. INTERFACE MODERNE : typographie, icônes vectorielles, boutons ----------
if (document.fonts) ['italic 800 40px "Barlow Condensed"', '700 20px Inter', '600 20px Inter'].forEach(f => document.fonts.load(f).catch(() => {}));
function titre(t, x, y, taille, couleur, align = 'center', maxW) { // titres condensés italiques (style jeux récents)
  ctx.font = `italic 800 ${taille}px "Barlow Condensed", Inter, -apple-system, system-ui, sans-serif`;
  if (maxW && ctx.measureText(String(t).toUpperCase()).width > maxW) { taille = Math.max(8, taille * maxW / ctx.measureText(String(t).toUpperCase()).width); ctx.font = `italic 800 ${taille}px "Barlow Condensed", Inter, system-ui, sans-serif`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = taille / 5; ctx.shadowOffsetY = taille / 20;
  ctx.fillStyle = couleur; ctx.fillText(String(t).toUpperCase(), x, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}
function icone(nom, x, y, s, c = '#fff') { // petites icônes vectorielles (plus nettes que les emojis)
  ctx.save(); ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const cercle = (cx, cy, r) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); };
  switch (nom) {
    case 'trophee': ctx.moveTo(7, 4); ctx.lineTo(17, 4); ctx.lineTo(17, 9); ctx.arc(12, 9, 5, 0, Math.PI); ctx.closePath();
      ctx.moveTo(7, 6); ctx.lineTo(4, 6); ctx.quadraticCurveTo(4, 11, 8, 11.5); ctx.moveTo(17, 6); ctx.lineTo(20, 6); ctx.quadraticCurveTo(20, 11, 16, 11.5);
      ctx.moveTo(12, 14); ctx.lineTo(12, 18); ctx.moveTo(8, 20); ctx.lineTo(16, 20); break;
    case 'perso': cercle(12, 8, 4); ctx.moveTo(4, 21); ctx.quadraticCurveTo(4, 14, 12, 14); ctx.quadraticCurveTo(20, 14, 20, 21); break;
    case 'amis': cercle(9, 8, 3.5); ctx.moveTo(2.5, 20); ctx.quadraticCurveTo(3, 13.5, 9, 13.5); ctx.quadraticCurveTo(15, 13.5, 15.5, 20);
      ctx.moveTo(15, 4.8); ctx.arc(16.5, 8, 3, -1.9, 1.9); ctx.moveTo(18, 13.8); ctx.quadraticCurveTo(21.5, 15, 21.5, 20); break;
    case 'classement': ctx.moveTo(4, 20); ctx.lineTo(20, 20); ctx.rect(5, 12, 4, 8); ctx.rect(10, 6, 4, 14); ctx.rect(15, 9, 4, 11); break;
    case 'eclair': ctx.moveTo(13, 2); ctx.lineTo(4, 14); ctx.lineTo(11, 14); ctx.lineTo(10, 22); ctx.lineTo(20, 9); ctx.lineTo(13, 9); ctx.closePath(); break;
    case 'reglages': cercle(12, 12, 3.2); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(12 + Math.cos(a) * 6.5, 12 + Math.sin(a) * 6.5); ctx.lineTo(12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5); } cercle(12, 12, 6.5); break;
    case 'quitter': ctx.moveTo(12, 3); ctx.lineTo(12, 12); ctx.moveTo(12 + 7.5 * Math.cos(-0.97), 13 + 7.5 * Math.sin(-0.97)); ctx.arc(12, 13, 7.5, -0.97, 4.11); break;
    case 'plus': ctx.moveTo(12, 5); ctx.lineTo(12, 19); ctx.moveTo(5, 12); ctx.lineTo(19, 12); break;
    case 'retour': ctx.moveTo(15, 5); ctx.lineTo(8, 12); ctx.lineTo(15, 19); break;
    case 'suite': ctx.moveTo(9, 5); ctx.lineTo(16, 12); ctx.lineTo(9, 19); break;
    case 'carte': ctx.moveTo(3, 6); ctx.lineTo(9, 4); ctx.lineTo(15, 6); ctx.lineTo(21, 4); ctx.lineTo(21, 18); ctx.lineTo(15, 20); ctx.lineTo(9, 18); ctx.lineTo(3, 20); ctx.closePath(); ctx.moveTo(9, 4); ctx.lineTo(9, 18); ctx.moveTo(15, 6); ctx.lineTo(15, 20); break;
    case 'coeur': ctx.moveTo(12, 20); ctx.bezierCurveTo(-2, 11, 5, 1, 12, 7); ctx.bezierCurveTo(19, 1, 26, 11, 12, 20); break;
    case 'cible': cercle(12, 12, 9); cercle(12, 12, 5); cercle(12, 12, 1.2); break;
    case 'check': ctx.moveTo(5, 12.5); ctx.lineTo(10, 17); ctx.lineTo(19, 7); break;
  }
  ctx.stroke(); ctx.restore();
}
function boutonJeu(x, y, w, h, c1, c2, action) { // bouton arrondi coloré "liquid glass" : halo, reflet vitré, liseré, balayage lumineux
  const u = U(), r = Math.min(h / 2, 26 * u), chemin = () => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  ctx.save(); ctx.shadowColor = (c2.startsWith('#') ? c2 + '99' : 'rgba(0,0,0,.35)'); ctx.shadowBlur = 26 * u; ctx.shadowOffsetY = 8 * u;
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); chemin(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); chemin(); ctx.clip();
  const v = ctx.createLinearGradient(0, y, 0, y + h * 0.6); v.addColorStop(0, 'rgba(255,255,255,.42)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = v; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h * 0.55, r); ctx.fill();
  const p = ((temps * 7) % (w * 4)) - w * 0.5, gg = ctx.createLinearGradient(x + p, 0, x + p + w * 0.35, 0);
  gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,.25)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gg; ctx.fillRect(x, y, w, h); ctx.restore();
  chemin(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  if (action) zones.push({ x, y, w, h, action });
}
function avatarLettre(nom, x, y, r) { // pastille ronde avec l'initiale (couleur selon le pseudo)
  let hsh = 0; for (const ch of String(nom)) hsh = (hsh * 31 + ch.charCodeAt(0)) % 360;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, `hsl(${hsh},80%,62%)`); g.addColorStop(1, `hsl(${(hsh + 40) % 360},75%,42%)`);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  texte(String(nom).replace(/^🤖\s*/, '').charAt(0).toUpperCase(), x, y + 1, r * 1.05, '#fff');
}
let notifTxt = '', notifT = -999;
function notif(t) { notifTxt = t; notifT = temps; }
function dessinerVagues() {
  vagues = vagues.filter(v => temps - v.t < 22);
  for (const v of vagues) { const k = (temps - v.t) / 22; ctx.globalAlpha = (1 - k) * 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(v.x, v.y, 8 + k * 40, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function dessinerNotif() {
  const age = temps - notifT; if (age > 200) return;
  const u = U(), a = Math.min(1, age / 10, (200 - age) / 20), w = Math.min(W - 40, 30 * u + notifTxt.length * 8.2 * u), y = 64 * u - (1 - a) * 20;
  ctx.globalAlpha = a; verre(W / 2 - w / 2, y, w, 40 * u, 20 * u, 'rgba(20,24,50,.85)'); texte(notifTxt, W / 2, y + 20 * u, 14 * u, '#fff'); ctx.globalAlpha = 1;
}

// ---------- 14c. AMIS & GROUPES (inviter → accepter/refuser → même équipe) ----------
let groupe = { chef: null, membres: {} }, invitations = [], invitesEnvoyees = {}, enLigneListe = [], amisActif = false, dernierePartie = null;
function initAmis() {
  if (!rtdb || !user || amisActif) return; amisActif = true;
  rtdb.ref('invites/' + user.uid).on('child_added', s => { const v = s.val(); if (v && Date.now() - (v.t || 0) < 120000) { invitations.push({ de: s.key, nom: v.nom }); } s.ref.remove(); });
  rtdb.ref('refus/' + user.uid).on('child_added', s => { notif(s.val() + ' a refusé ton invitation'); delete invitesEnvoyees[s.key]; s.ref.remove(); });
  const mien = rtdb.ref('groupes/' + user.uid); mien.onDisconnect().remove();
  mien.child('membres').on('value', s => { // je suis chef de mon groupe
    const v = s.val() || {}; if (groupe.chef && groupe.chef !== user.uid) return;
    for (const [k, m] of Object.entries(v)) if (!groupe.membres[k]) { notif(m.nom + ' a rejoint ton groupe'); delete invitesEnvoyees[k]; }
    groupe = Object.keys(v).length ? { chef: user.uid, membres: v } : { chef: null, membres: {} };
  });
}
function inviter(uid) {
  if (groupe.chef && groupe.chef !== user.uid) return notif('Quitte ton groupe pour inviter');
  rtdb.ref(`invites/${uid}/${user.uid}`).set({ nom: nomJoueur(), t: firebase.database.ServerValue.TIMESTAMP });
  invitesEnvoyees[uid] = temps; notif('Invitation envoyée ✓');
}
function refuser(inv) { invitations.shift(); rtdb.ref(`refus/${inv.de}/${user.uid}`).set(nomJoueur()); }
function accepter(inv) {
  invitations.shift(); quitterGroupe();
  const chef = inv.de, base = rtdb.ref('groupes/' + chef), ref = base.child('membres/' + user.uid);
  groupe = { chef, nomChef: inv.nom, membres: {}, vu: false, premier: true };
  ref.onDisconnect().remove(); ref.set({ nom: nomJoueur() });
  base.child('membres').on('value', s => {
    if (groupe.chef !== chef) return;
    groupe.membres = s.val() || {};
    if (groupe.membres[user.uid]) groupe.vu = true; else if (groupe.vu) { quitterGroupe(); notif('Le groupe a été dissous'); }
  });
  base.child('partie').on('value', s => { // le chef lance : on le suit automatiquement
    const p = s.val(); if (groupe.chef !== chef) return;
    if (groupe.premier) { groupe.premier = false; dernierePartie = p && p.salle; return; }
    if (!p || p.salle === dernierePartie) return; dernierePartie = p.salle;
    if (['JEU', 'INTRO', 'ATTENTE'].includes(etat)) return;
    quitterSalle(); etat = 'MENU'; modeIndex = p.mode; chercherPartie({ rejoindre: p.salle });
  });
  notif('Tu as rejoint le groupe de ' + inv.nom);
}
function quitterGroupe() {
  if (!rtdb || !user) return;
  const g = groupe;
  if (g.chef && g.chef !== user.uid) { const b = rtdb.ref('groupes/' + g.chef); b.child('membres').off(); b.child('partie').off(); b.child('membres/' + user.uid).remove(); }
  else if (Object.keys(g.membres || {}).length) rtdb.ref('groupes/' + user.uid).remove();
  groupe = { chef: null, membres: {} };
}
function modaleInvitation() {
  const u = U(), inv = invitations[0], w = Math.min(430 * u, W - 40), h = 200 * u, x = W / 2 - w / 2, y = H / 2 - h / 2;
  zones = []; // seule la fenêtre répond
  ctx.fillStyle = 'rgba(3,6,20,.65)'; ctx.fillRect(-100, -100, W + 200, H + 200);
  verre(x, y, w, h, 26 * u, 'rgba(40,48,90,.9)');
  avatarLettre(inv.nom, x + w / 2, y + 40 * u, 24 * u);
  titre('Invitation', x + w / 2, y + 84 * u, 28 * u, '#fff');
  texte(inv.nom + " t'invite à jouer dans son équipe", x + w / 2, y + 112 * u, 14 * u, 'rgba(255,255,255,.8)', 'center', w - 40 * u);
  const bw = (w - 60 * u) / 2, by = y + h - 62 * u;
  bouton3D(x + 20 * u, by, bw, 44 * u, '#4a5078', '#30355a', () => refuser(inv)); texte('Refuser', x + 20 * u + bw / 2, by + 22 * u, 15 * u, '#fff');
  bouton3D(x + 40 * u + bw, by, bw, 44 * u, '#34d399', '#059669', () => accepter(inv)); texte('Accepter', x + 40 * u + bw * 1.5, by + 22 * u, 15 * u, '#fff');
}
function menuAmis() {
  const u = U(), top = barreHaut('Amis', true), x0 = 20 * u, y0 = top + 14 * u, gw = Math.min(310 * u, W * 0.36), h = H - y0 - 18 * u;
  verre(x0, y0, gw, h, 22 * u);
  titre('Mon groupe', x0 + 20 * u, y0 + 26 * u, 22 * u, '#fff', 'left');
  const chefMoi = !groupe.chef || groupe.chef === user.uid;
  const l = [{ nom: chefMoi ? nomJoueur() : groupe.nomChef, tag: 'CHEF' }, ...Object.entries(groupe.membres).map(([uid, m]) => ({ nom: m.nom, tag: uid === user.uid ? 'TOI' : '' }))];
  l.forEach((m, i) => {
    const y = y0 + 56 * u + i * 50 * u; if (y > y0 + h - 110 * u) return;
    avatarLettre(m.nom, x0 + 38 * u, y + 18 * u, 17 * u); texte(m.nom, x0 + 64 * u, y + 18 * u, 15 * u, '#fff', 'left', gw - 140 * u);
    if (m.tag) { rect(x0 + gw - 64 * u, y + 8 * u, 46 * u, 20 * u, 10 * u, m.tag === 'CHEF' ? 'rgba(255,212,0,.25)' : 'rgba(90,200,250,.25)'); texte(m.tag, x0 + gw - 41 * u, y + 18 * u, 10 * u, '#fff'); }
  });
  texte('Le chef lance la partie : tout le groupe', x0 + gw / 2, y0 + h - 92 * u, 11 * u, 'rgba(255,255,255,.6)');
  texte('joue dans la même équipe.', x0 + gw / 2, y0 + h - 76 * u, 11 * u, 'rgba(255,255,255,.6)');
  if (l.length > 1) { bouton3D(x0 + 20 * u, y0 + h - 60 * u, gw - 40 * u, 42 * u, '#ff6b61', '#d93a30', quitterGroupe); texte(chefMoi ? 'Dissoudre le groupe' : 'Quitter le groupe', x0 + gw / 2, y0 + h - 39 * u, 14 * u, '#fff'); }
  const lx = x0 + gw + 16 * u, lw = W - lx - 20 * u, dispo = enLigneListe.filter(j => j.uid !== user.uid);
  titre('En ligne', lx + 4 * u, y0 + 20 * u, 22 * u, '#fff', 'left');
  ctx.beginPath(); ctx.arc(lx + 132 * u, y0 + 20 * u, 5 * u, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill(); texte(String(dispo.length), lx + 144 * u, y0 + 20 * u, 14 * u, '#34d399', 'left');
  if (!dispo.length) return texte("Personne d'autre n'est en ligne pour l'instant", lx + lw / 2, y0 + 90 * u, 15 * u, 'rgba(255,255,255,.7)');
  const rh = 56 * u, nb = Math.max(1, Math.floor((h - 46 * u) / (rh + 8 * u)));
  dispo.slice(0, nb).forEach((j, i) => {
    const y = y0 + 44 * u + i * (rh + 8 * u); verre(lx, y, lw, rh, 16 * u);
    avatarLettre(j.nom, lx + 32 * u, y + rh / 2, 18 * u); texte(j.nom, lx + 60 * u, y + rh / 2, 15 * u, '#fff', 'left', lw - 230 * u);
    const bw = 130 * u, bx = lx + lw - bw - 12 * u;
    if (groupe.membres[j.uid] || groupe.chef === j.uid) { icone('check', bx + 20 * u, y + rh / 2, 18 * u, '#34d399'); texte('Dans ton groupe', bx + 34 * u, y + rh / 2, 12 * u, '#34d399', 'left'); }
    else if (invitesEnvoyees[j.uid] && temps - invitesEnvoyees[j.uid] < 1800) texte('Invitation envoyée…', bx + bw, y + rh / 2, 12 * u, 'rgba(255,255,255,.6)', 'right');
    else { bouton3D(bx, y + 10 * u, bw, rh - 20 * u, '#3a9bff', '#0a6cff', () => inviter(j.uid)); texte('Inviter', bx + bw / 2, y + rh / 2, 14 * u, '#fff'); }
  });
}

// ---------- 14b. MENU PRINCIPAL (style arcade) ----------
// Écrans : accueil • persos • modes • classement • pouvoirs
let ecranMenu = 'accueil', persoVue = 0, pageMenu = 0, mesStats = { points: 0, victoires: 0, parties: 0 }, classement = null, classementT = -9999;
const cacheMini = {};
const U = () => Math.max(0.6, Math.min(1.35, Math.min(W / 900, H / 440)));   // échelle de l'interface selon l'écran
const selPerso = () => CONFIG.persos[persoIndex] || CONFIG.persos[0];
const modesStyle = m => m.type === 'solo' ? ['🧍', '#4cd964', '#1f9d3a', 'Solo'] : m.equipes === 'coop' ? ['🤝', '#5ac8fa', '#1d74c9', 'Coop']
  : m.equipes === 'deux' ? ['⚔️', '#ff9f43', '#d35400', 'Équipes'] : ['👥', '#ff6b6b', '#c0392b', 'Chacun pour soi'];
function emoji(t, x, y, taille) { ctx.font = `${taille}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
let transT = -99, vagues = [];
function allerA(e) { ecranMenu = e; pageMenu = 0; transT = temps; }
function bouton3D(x, y, w, h, c1, c2, action, r) { // bouton moderne : dégradé net, liseré lumineux, ombre portée
  const u = U(); r = r || Math.min(h / 2, 14 * u);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 6 * u;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  rect(x, y, w, h, r, g); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, w, 1.5 * u); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x, y + h - 2.5 * u, w, 2.5 * u); ctx.restore();
  if (action) zones.push({ x, y, w, h, action });
}
function pastille(x, y, w, icon, txt, action, couleurIcone) {
  const u = U(), h = 34 * u;
  verre(x, y, w, h, h / 2, 'rgba(255,255,255,.12)');
  if (/^[a-z]+$/.test(icon)) icone(icon, x + h / 2 + 2, y + h / 2, 17 * u, couleurIcone || '#fff'); else emoji(icon, x + h / 2 + 2, y + h / 2, 16 * u);
  texte(txt, x + h + 4 * u, y + h / 2, 13 * u, '#fff', 'left');
  if (action) zones.push({ x, y, w, h, action });
}
function lignes(txt, maxW, taille) { // coupe un texte en lignes
  ctx.font = `900 ${taille}px Arial`; const out = []; let l = '';
  for (const m of String(txt || '').split(' ')) { const t = l ? l + ' ' + m : m; if (ctx.measureText(t).width > maxW && l) { out.push(l); l = m; } else l = t; }
  if (l) out.push(l); return out;
}
function miniMap(def) { // aperçu de la map (1 pixel = 1 case)
  const cle = def.nom + def.grille.join('').length;
  if (!cacheMini[cle]) {
    const g = def.grille, c = document.createElement('canvas'); c.width = Math.max(...g.map(r => r.length)); c.height = g.length;
    const x = c.getContext('2d'), col = { '#': def.mur, 'B': def.buissonFonce, 'W': def.eau, 'C': '#f1c40f', 'P': '#3aa0ff', 'E': '#ff3b3b' };
    g.forEach((r, j) => [...r].forEach((t, i) => { x.fillStyle = col[t] || def.herbe1; x.fillRect(i, j, 1, 1); }));
    cacheMini[cle] = c;
  }
  return cacheMini[cle];
}
function dessinerMiniMap(def, x, y, w, h) {
  const m = miniMap(def), k = Math.min(w / m.width, h / m.height), mw = m.width * k, mh = m.height * k;
  rect(x - 3, y - 3, w + 6, h + 6, 8, 'rgba(0,0,0,.4)');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(m, x + (w - mw) / 2, y + (h - mh) / 2, mw, mh); ctx.imageSmoothingEnabled = true;
}
function fondMenu() { fond(); }
function barreHaut(titreEcran, retour) {
  const u = U(), h = 56 * u;
  if (retour) {
    verre(14 * u, 10 * u, 40 * u, 40 * u, 20 * u); icone('retour', 34 * u, 30 * u, 20 * u);
    zones.push({ x: 0, y: 0, w: 70 * u, h: 56 * u, action: () => allerA('accueil') });
    titre(titreEcran, 68 * u, 31 * u, 30 * u, '#fff', 'left');
  } else { // profil
    const p = selPerso(), im = carteDe(p);
    verre(12 * u, 9 * u, 230 * u, 42 * u, 21 * u);
    ctx.beginPath(); ctx.arc(33 * u, 30 * u, 17 * u, 0, 7); ctx.fillStyle = p.couleur; ctx.fill();
    if (pret(im)) ctx.drawImage(im, 17 * u, 14 * u, 32 * u, 32 * u);
    texte(nomJoueur(), 58 * u, 23 * u, 14 * u, '#fff', 'left', 175 * u);
    texte(mesStats.victoires + ' victoires • ' + mesStats.parties + ' parties', 58 * u, 39 * u, 10 * u, 'rgba(255,255,255,.65)', 'left');
    zones.push({ x: 12 * u, y: 9 * u, w: 230 * u, h: 42 * u, action: () => ouvrirProfil(auth, p => db && db.collection('joueurs').doc(user.uid).set({ pseudo: p }, { merge: true })) });
  }
  pastille(W - 356 * u, 12 * u, 124 * u, 'trophee', mesStats.points + ' pts', null, '#ffd400');
  pastille(W - 224 * u, 12 * u, 118 * u, '●', enLigne + ' en ligne');
  ctx.beginPath(); ctx.arc(W - 224 * u + 19 * u, 29 * u, 5 * u, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill();
  verre(W - 98 * u, 12 * u, 36 * u, 34 * u, 17 * u); icone('reglages', W - 80 * u, 29 * u, 18 * u);
  zones.push({ x: W - 98 * u, y: 12 * u, w: 36 * u, h: 34 * u, action: () => location.href = 'admin.html' });
  verre(W - 54 * u, 12 * u, 36 * u, 34 * u, 17 * u, 'rgba(255,80,80,.25)'); icone('quitter', W - 36 * u, 29 * u, 18 * u);
  zones.push({ x: W - 54 * u, y: 12 * u, w: 36 * u, h: 34 * u, action: () => { quitterGroupe(); if (rtdb && user) rtdb.ref('presence/' + user.uid).remove(); auth.signOut(); } });
  return h;
}
function statBarre(x, y, w, icone, lab, val, txt, couleur) {
  const u = U();
  emoji(icone, x + 10 * u, y + 7 * u, 14 * u); texte(lab, x + 24 * u, y + 7 * u, 11 * u, '#fff', 'left');
  const bx = x + 96 * u, bw = w - 96 * u - 50 * u;
  rect(bx, y, bw, 14 * u, 7 * u, 'rgba(0,0,0,.45)');
  rect(bx, y, Math.max(8 * u, bw * Math.max(0, Math.min(1, val))), 14 * u, 7 * u, couleur || '#ffd23f');
  texte(txt, x + w - 4 * u, y + 7 * u, 11 * u, '#fff', 'right');
}
function lancerPartie() {
  const m = modeChoisi();
  if (groupe.chef && groupe.chef !== user.uid) return notif("C'est le chef du groupe qui lance la partie");
  if (m.type === 'multi') chercherPartie({ groupe: Object.keys(groupe.membres).length > 0 });
  else { if (Object.keys(groupe.membres).length) notif('Mode solo : ton groupe ne te suit pas'); demarrer(mapChoisie(m), null); }
}
function dessinerMenu() {
  ecran(); zones = [];
  fondMenu();
  if (etat === 'AUTH') return;
  ({ accueil: menuAccueil, persos: menuPersos, modes: menuModes, classement: menuClassement, pouvoirs: menuPouvoirs, amis: menuAmis })[ecranMenu]();
  const kt = Math.min(1, (temps - transT) / 14); if (kt < 1) { ctx.fillStyle = `rgba(5,7,15,${(1 - kt) * 0.9})`; ctx.fillRect(-100, -100, W + 200, H + 200); } // fondu entre écrans
  dessinerVagues(); dessinerNotif();
  if (invitations.length) modaleInvitation();
}

// --- Accueil (style jeux récents : héros éclairé, navigation latérale, lobby d'équipe, gros bouton JOUER)
function menuAccueil() {
  const u = U(), p = selPerso(), a = CONFIG.armes[p.arme] || {}, m = modeChoisi(), [, c1, c2, lab] = modesStyle(m), multi = m.type === 'multi';
  const top = barreHaut();
  // navigation à gauche
  const nav = [['perso', 'Persos', 'persos', '#5ac8fa', '#2f6bff'], ['amis', 'Amis', 'amis', '#4ade80', '#059669'], ['classement', 'Classement', 'classement', '#ffc24b', '#ff7a00'], ['eclair', 'Pouvoirs', 'pouvoirs', '#ff7ac0', '#b43cff']];
  nav.forEach(([ic, t, e, a1, a2], k) => {
    const y = top + 18 * u + k * 58 * u, w = 158 * u;
    boutonJeu(14 * u, y, w, 46 * u, a1, a2, () => allerA(e));
    icone(ic, 40 * u, y + 23 * u, 20 * u); titre(t, 58 * u, y + 24 * u, 20 * u, '#fff', 'left', w - 80 * u);
    if (k === 1 && Object.keys(groupe.membres).length) { ctx.beginPath(); ctx.arc(14 * u + w - 22 * u, y + 23 * u, 10 * u, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill(); texte(String(Object.keys(groupe.membres).length + 1), 14 * u + w - 22 * u, y + 24 * u, 11 * u, '#fff'); }
  });
  // héros au centre, sous un projecteur
  const colD = Math.min(330 * u, W * 0.34), gauche = 190 * u, cx = gauche + (W - gauche - colD - 30 * u) / 2, taille = Math.min(H * 0.5, (W - gauche - colD) * 0.62), cy = top + (H - top) * 0.44;
  const spot = ctx.createRadialGradient(cx, cy, 10, cx, cy, taille * 1.1); spot.addColorStop(0, p.couleur + 'aa'); spot.addColorStop(0.5, p.couleur + '33'); spot.addColorStop(1, p.couleur + '00');
  ctx.fillStyle = spot; ctx.fillRect(cx - taille * 1.2, cy - taille * 1.2, taille * 2.4, taille * 2.4);
  const sol = cy + taille * 0.46; // anneau lumineux au sol
  ctx.save(); ctx.translate(cx, sol); ctx.scale(1, 0.26);
  for (let i = 3; i >= 1; i--) { ctx.beginPath(); ctx.arc(0, 0, taille * (0.28 + i * 0.07) + Math.sin(temps * 0.05 + i) * 3, 0, 7); ctx.strokeStyle = p.couleur + ['', 'cc', '77', '33'][i]; ctx.lineWidth = 3; ctx.stroke(); }
  const og = ctx.createRadialGradient(0, 0, 0, 0, 0, taille * 0.42); og.addColorStop(0, 'rgba(0,0,0,.55)'); og.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, taille * 0.42, 0, 7); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 18; i++) { // poussières lumineuses
    const t = (temps * 0.4 + i * 37) % 300, px = cx + (alea(i) - 0.5) * taille * 1.3, py = sol - t * 0.9;
    ctx.globalAlpha = Math.max(0, 0.6 - t / 300); ellipse(px, py, 2, 2, '#fff'); ctx.globalAlpha = 1;
  }
  const im = carteDe(p), b = Math.sin(temps * 0.045) * 6 * u;
  const vh = vitrineHero(p);
  if (vh) { // héros 3D haute définition, immobile ; on le fait tourner en glissant le doigt
    const T = Math.round(Math.min(900, taille * 1.6 * dpr)), c = vh.rendre(heroAngle, T, temps / 150), D = taille * 0.82 * Math.min(1.25, +p.modeleEchelle || 1) / Math.max(0.2, (vh.bas - vh.haut) || 0.7);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, cx - D / 2, sol - 4 * u - vh.bas * D, D, D);
  } else if (pret(im)) ctx.drawImage(im, cx - taille / 2, cy - taille / 2 - 14 * u + b, taille, taille);
  heroZone = { x: cx - taille / 2, y: cy - taille / 2, w: taille, h: taille };
  if (vh) texte('↔ Glisse pour faire tourner', cx, top + 22 * u, 10 * u, 'rgba(255,255,255,.5)');
  const ny = Math.min(H - 64 * u, sol + 34 * u), sp = (mesStats.persos || {})[cleP(p)] || {};
  titre(p.nom, cx, ny, 46 * u, '#fff', 'center', Math.max(160 * u, taille * 1.1));
  const lw = Math.min(taille, 220 * u); rect(cx - lw / 2, ny + 22 * u, lw, 3 * u, 2, p.couleur);
  const elA = elemDe(p), infos = [['eclair', (elA ? elA.icone + ' ' : '') + 'Niv. ' + niveauDe(p)], ['coeur', statsNiveau(p, niveauDe(p)).pvMax], ['cible', a.nom || p.arme], ['trophee', (sp.points || 0) + ' pts']];
  ctx.font = `700 ${12 * u}px Inter, system-ui, sans-serif`; // infos centrées, espacées selon leur longueur réelle
  const largeurs = infos.map(([, v]) => Math.min(150 * u, ctx.measureText(String(v)).width) + 30 * u), tot = largeurs.reduce((a, b) => a + b, 0);
  let ix = cx - tot / 2;
  infos.forEach(([ic, v], k) => { icone(ic, ix + 8 * u, ny + 42 * u, 14 * u, ic === 'trophee' ? '#ffd400' : 'rgba(255,255,255,.8)'); texte(String(v), ix + 20 * u, ny + 42 * u, 12 * u, '#fff', 'left', 150 * u); ix += largeurs[k]; });
  // carte du mode (droite)
  const mx = W - colD - 18 * u, my = top + 18 * u, mh = Math.min(128 * u, H * 0.3);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 8 * u;
  const gm = ctx.createLinearGradient(mx, my, mx + colD, my + mh); gm.addColorStop(0, c1); gm.addColorStop(1, c2); rect(mx, my, colD, mh, 20 * u, gm); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(mx, my, colD, mh, 20 * u); ctx.clip(); ctx.globalAlpha = 0.35;
  const def = CONFIG.maps[mapChoisie(m)], mm = miniMap(def); ctx.imageSmoothingEnabled = false; ctx.drawImage(mm, mx + colD * 0.45, my, colD * 0.6, mh); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
  const fg = ctx.createLinearGradient(mx, 0, mx + colD, 0); fg.addColorStop(0.35, c2); fg.addColorStop(0.75, c2 + '00'); ctx.fillStyle = fg; ctx.fillRect(mx, my, colD, mh);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(mx, my, colD, 1.5); ctx.restore();
  texte('MODE DE JEU • ' + lab.toUpperCase(), mx + 20 * u, my + 22 * u, 10 * u, 'rgba(255,255,255,.75)', 'left');
  titre(m.nom, mx + 20 * u, my + 50 * u, 32 * u, '#fff', 'left', colD - 70 * u);
  icone('carte', mx + 28 * u, my + mh - 24 * u, 15 * u); texte(def.nom, mx + 42 * u, my + mh - 24 * u, 12 * u, '#fff', 'left');
  const obj = { zone: '  •  Zone', bloc: '  •  Cristal' }[m.objectif] || '';
  texte((multi ? m.joueursMin + '-' + m.joueursMax + ' joueurs' : 'Solo') + (m.boss && m.nbBoss ? '  •  ' + m.nbBoss + ' boss' : '') + obj, mx + 20 * u, my + 76 * u, 12 * u, 'rgba(255,255,255,.9)', 'left');
  icone('suite', mx + colD - 24 * u, my + mh / 2, 22 * u);
  zones.push({ x: mx, y: my, w: colD, h: mh, action: () => allerA('modes') });
  // lobby d'équipe (invitations)
  const ly = my + mh + 14 * u, slots = multi ? Math.min(4, Math.max(2, +m.joueursMax || 2)) : 1, r = 22 * u, chefMoi = !groupe.chef || groupe.chef === user.uid;
  texte(multi ? 'TON ÉQUIPE' : 'MODE SOLO', mx + 4 * u, ly + 6 * u, 10 * u, 'rgba(255,255,255,.65)', 'left');
  const membres = [{ nom: chefMoi ? nomJoueur() : groupe.nomChef, moi: chefMoi }, ...Object.entries(groupe.membres).map(([uid, v]) => ({ nom: v.nom, moi: uid === user.uid }))];
  for (let i = 0; i < slots; i++) {
    const sx = mx + r + 4 * u + i * (r * 2 + 12 * u), sy = ly + 22 * u + r, mb = membres[i];
    if (mb) { if (mb.moi && pret(im)) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fillStyle = p.couleur; ctx.fill(); ctx.drawImage(im, sx - r * 0.9, sy - r * 0.9, r * 1.8, r * 1.8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } else avatarLettre(mb.nom, sx, sy, r); }
    else { ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); icone('plus', sx, sy, 16 * u, 'rgba(255,255,255,.8)');
      zones.push({ x: sx - r, y: sy - r, w: r * 2, h: r * 2, action: () => allerA('amis') }); }
  }
  if (multi && membres.length < slots) texte('Inviter un ami', mx + 4 * u, ly + 22 * u + r * 2 + 14 * u, 11 * u, 'rgba(255,255,255,.7)', 'left');
  // bouton JOUER
  const jh = 84 * u, jy = H - jh - 20 * u, membre = groupe.chef && groupe.chef !== user.uid;
  boutonJeu(mx, jy, colD, jh, membre ? '#8a8fa8' : '#ffe14a', membre ? '#5c6078' : '#ff8a00', lancerPartie);
  titre(membre ? 'En attente' : 'Jouer', mx + colD / 2 - 6 * u, jy + jh / 2 - 6 * u, (membre ? 30 : 46) * u, membre ? '#fff' : '#1f1300');
  texte(membre ? 'du chef du groupe' : multi ? 'EN LIGNE' : 'SOLO', mx + colD / 2 - 6 * u, jy + jh - 16 * u, 11 * u, membre ? '#fff' : 'rgba(40,24,0,.75)');
}

// --- Persos : grille + fiche détaillée
function menuPersos() {
  const u = U(), top = barreHaut('PERSOS', true), n = CONFIG.persos.length;
  const panW = Math.min(360 * u, W * 0.42), zoneW = W - panW - 36 * u, x0 = 14 * u, y0 = top + 14 * u, zoneH = H - y0 - 14 * u;
  const cols = Math.max(2, Math.floor(zoneW / (120 * u))), cw = (zoneW - (cols - 1) * 10 * u) / cols, chh = cw * 1.2;
  const rows = Math.max(1, Math.floor((zoneH - 30 * u) / (chh + 10 * u))), parPage = cols * rows, pages = Math.ceil(n / parPage);
  pageMenu = Math.min(pageMenu, pages - 1);
  CONFIG.persos.slice(pageMenu * parPage, (pageMenu + 1) * parPage).forEach((p, k) => {
    const i = pageMenu * parPage + k, x = x0 + (k % cols) * (cw + 10 * u), y = y0 + Math.floor(k / cols) * (chh + 10 * u), im = carteDe(p);
    bouton3D(x, y, cw, chh, p.couleur, '#1a1030', () => persoVue = i);
    if (pret(im)) ctx.drawImage(im, x + cw * 0.12, y + 6 * u, cw * 0.76, cw * 0.76);
    rect(x + 4 * u, y + chh - 28 * u, cw - 8 * u, 24 * u, 8 * u, 'rgba(0,0,0,.5)');
    texte(p.nom, x + cw / 2, y + chh - 16 * u, 13 * u, '#fff', 'center', cw - 16 * u);
    if (i === persoVue) rect(x - 3 * u, y - 3 * u, cw + 6 * u, chh + 6 * u, 16 * u, null, '#ffffff', 3 * u);
    if (i === persoIndex) emoji('✅', x + cw - 14 * u, y + 14 * u, 16 * u);
    const ec = elemDe(p); rect(x + 6 * u, y + 6 * u, 58 * u, 20 * u, 10 * u, 'rgba(8,12,32,.6)'); texte((ec ? ec.icone : '') + ' Niv.' + niveauDe(p), x + 35 * u, y + 16 * u, 10 * u, '#fff', 'center', 54 * u);
  });
  if (pages > 1) {
    bouton3D(x0, H - 40 * u, 60 * u, 30 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + pages - 1) % pages); texte('◀', x0 + 30 * u, H - 25 * u, 14 * u, '#fff');
    texte((pageMenu + 1) + ' / ' + pages, x0 + zoneW / 2, H - 25 * u, 13 * u, '#fff');
    bouton3D(x0 + zoneW - 60 * u, H - 40 * u, 60 * u, 30 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + 1) % pages); texte('▶', x0 + zoneW - 30 * u, H - 25 * u, 14 * u, '#fff');
  }
  // fiche du perso
  const p = CONFIG.persos[persoVue] || selPerso(), a = CONFIG.armes[p.arme] || {}, px = W - panW - 14 * u, py = y0, ph = H - py - 14 * u;
  rect(px, py, panW, ph, 18 * u, 'rgba(255,255,255,.1)', p.couleur, 3 * u);
  const is = Math.min(panW * 0.42, ph * 0.3), im = carteDe(p);
  if (pret(im)) ctx.drawImage(im, px + 12 * u, py + 10 * u + Math.sin(temps * 0.05) * 3 * u, is, is);
  texte(p.nom, px + 24 * u + is, py + 24 * u, 22 * u, '#fff', 'left');
  const ai = img(a.image); if (pret(ai)) ctx.drawImage(ai, px + 24 * u + is, py + 40 * u, 26 * u, 26 * u);
  texte(a.nom || p.arme, px + 56 * u + is, py + 53 * u, 13 * u, '#ffe8a3', 'left');
  const types = { lob: 'Lancer en cloche', retour: 'Aller-retour', droit: 'Tir droit', terrain: 'Fait surgir le sol' };
  const extra = [types[a.type], a.rebonds > 0 ? a.rebonds + ' ricochets' : '', a.chaine > 0 ? 'chercheur ×' + a.chaine : ''].filter(Boolean).join(' • ');
  lignes(extra, panW - is - 36 * u, 10 * u).slice(0, 2).forEach((l, k) => texte(l, px + 24 * u + is, py + 78 * u + k * 14 * u, 10 * u, '#cfd8ff', 'left'));
  const st = [['❤️', 'Vie', p.pvMax / 8000, p.pvMax, '#ff5a6e'], ['💥', 'Dégâts', p.degats / 3000, p.degats, '#ff9f43'], ['🏃', 'Vitesse', p.vitesse / 8, p.vitesse, '#4cd964'],
    ['🎯', 'Portée', p.portee / 600, p.portee, '#5ac8fa'], ['🔋', 'Munitions', (p.munitions || 3) / 6, p.munitions || 3, '#ffd23f'],
    ['⚡', 'Cadence', 1 - (p.delaiTir || 30) / 90, ((p.delaiTir || 30) / 60).toFixed(2) + 's', '#b57bff'], ['♻️', 'Recharge', 1 - (p.recharge || 60) / 150, ((p.recharge || 60) / 60).toFixed(1) + 's', '#ff7ab6']];
  const sp = (mesStats.persos || {})[cleP(p)] || {}, epF = elemDe(p);
  if (epF) texte(`${epF.icone} ${epF.nom} • Niveau ${niveauDe(p)} • ${({ vol: 'vole au-dessus des blocs', nage: 'se déplace sur l\'eau', feu: 'laisse une traînée de feu', brise: 'brise les blocs', sol: '' })[epF.capacite] || ''}`, px + panW / 2, py + is + 2 * u, 11 * u, epF.couleur, 'center', panW - 20 * u);
  texte(`🏆 ${sp.points || 0} pts  •  ⭐ ${sp.victoires || 0} victoires  •  🎮 ${sp.parties || 0} parties`, px + panW / 2, py + is + 16 * u, 11 * u, '#ffe8a3');
  const sy = py + is + 34 * u, pas = Math.min(24 * u, (ph - is - 150 * u) / st.length);
  st.forEach((s, k) => statBarre(px + 12 * u, sy + k * pas, panW - 24 * u, ...s));
  const choisi = persoVue === persoIndex, bh = 44 * u, bw = (panW - 50 * u) / 2, by = py + ph - bh - 12 * u, ep = elemDe(p), nvP = niveauDe(p), maxN = +(CONFIG.progression || {}).niveauMax || 10;
  if (ep) { bouton3D(px + 20 * u, by, bw, bh, nvP >= maxN ? '#9aa5b8' : ep.couleur, nvP >= maxN ? '#5d6778' : ombrer(ep.couleur, -0.35), () => evoluer(p));
    texte(nvP >= maxN ? 'Niveau max' : `Évoluer • ${coutNiveau(nvP)} ${ep.icone}`, px + 20 * u + bw / 2, by + bh / 2, 13 * u, '#fff', 'center', bw - 12 * u); }
  bouton3D(ep ? px + 30 * u + bw : px + 20 * u, by, ep ? bw : panW - 40 * u, bh, choisi ? '#9aa5b8' : '#4cd964', choisi ? '#5d6778' : '#1f9d3a', choisi ? null : () => { persoIndex = persoVue; allerA('accueil'); });
  texte(choisi ? '✔ Choisi' : 'Choisir', (ep ? px + 30 * u + bw * 1.5 : px + panW / 2), by + bh / 2, 15 * u, '#fff');
  // porte-monnaie d'essences
  const els = Object.entries(CONFIG.elements || {}), pw = (panW - 40 * u - (els.length - 1) * 6 * u) / Math.max(1, els.length);
  els.forEach(([k, e2], n) => { const ex = px + 20 * u + n * (pw + 6 * u); verre(ex, by - 36 * u, pw, 26 * u, 13 * u); texte(e2.icone + ' ' + ((mesStats.essences || {})[k] || 0), ex + pw / 2, by - 23 * u, 12 * u, '#fff', 'center', pw - 8 * u); }); // essences
}

// --- Modes de jeu + choix de la map
function menuModes() { // cartes de modes façon accueil + choix de la map
  const u = U(), top = barreHaut('Modes de jeu', true), liste = modes(), m = modeChoisi();
  const mapH = m.map >= 0 && CONFIG.maps[m.map] ? 40 * u : 124 * u, x0 = 20 * u, y0 = top + 14 * u, zoneW = W - 40 * u, gap = 14 * u, zoneH = H - y0 - mapH - 28 * u;
  const cols = Math.max(2, Math.min(4, Math.floor(zoneW / (230 * u)))), cw = (zoneW - (cols - 1) * gap) / cols, chh = Math.max(96 * u, Math.min(150 * u, zoneH));
  const rows = Math.max(1, Math.floor((zoneH + gap) / (chh + gap))), parPage = cols * rows, pages = Math.ceil(liste.length / parPage);
  pageMenu = Math.min(pageMenu, pages - 1);
  liste.slice(pageMenu * parPage, (pageMenu + 1) * parPage).forEach((md, k) => {
    const i = pageMenu * parPage + k, x = x0 + (k % cols) * (cw + gap), y = y0 + Math.floor(k / cols) * (chh + gap), [, c1, c2, lab] = modesStyle(md), sel = i === modeIndex % liste.length;
    ctx.save(); ctx.shadowColor = sel ? c1 : 'rgba(0,0,0,.4)'; ctx.shadowBlur = (sel ? 30 : 16) * u; ctx.shadowOffsetY = 6 * u;
    const gm = ctx.createLinearGradient(x, y, x + cw, y + chh); gm.addColorStop(0, c1); gm.addColorStop(1, c2); rect(x, y, cw, chh, 22 * u, gm); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 22 * u); ctx.clip();
    const def = CONFIG.maps[md.map >= 0 && CONFIG.maps[md.map] ? md.map : mapIndex % CONFIG.maps.length], mm = miniMap(def);
    ctx.globalAlpha = 0.28; ctx.imageSmoothingEnabled = false; ctx.drawImage(mm, x + cw * 0.45, y, cw * 0.6, chh); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
    const fg = ctx.createLinearGradient(x, 0, x + cw, 0); fg.addColorStop(0.35, c2); fg.addColorStop(0.8, c2 + '00'); ctx.fillStyle = fg; ctx.fillRect(x, y, cw, chh);
    const hl = ctx.createLinearGradient(0, y, 0, y + chh * 0.5); hl.addColorStop(0, 'rgba(255,255,255,.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(x, y, cw, chh * 0.5);
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 22 * u); ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.4)'; ctx.lineWidth = sel ? 3 * u : 1; ctx.stroke();
    texte(lab.toUpperCase() + (md.type === 'multi' ? ' • EN LIGNE' : ''), x + 16 * u, y + 20 * u, 9.5 * u, 'rgba(255,255,255,.8)', 'left', cw - 60 * u);
    titre(md.nom, x + 16 * u, y + 44 * u, 24 * u, '#fff', 'left', cw - 32 * u);
    lignes(md.description, cw - 32 * u, 11 * u).slice(0, chh > 120 * u ? 2 : 1).forEach((l, j) => texte(l, x + 16 * u, y + 68 * u + j * 15 * u, 11 * u, 'rgba(255,255,255,.9)', 'left', cw - 32 * u));
    let ix = x + 16 * u; const iy = y + chh - 18 * u;
    [['amis', md.type === 'multi' ? (md.joueursMin === md.joueursMax ? md.joueursMax : md.joueursMin + '-' + md.joueursMax) : '1'], ['trophee', '+' + md.pointsVictoire],
     md.objectif === 'zone' ? ['cible', 'Zone'] : md.objectif === 'bloc' ? ['cible', 'Cristal'] : md.boss && md.nbBoss ? ['eclair', md.nbBoss + ' boss'] : null].filter(Boolean).forEach(([ic, v]) => {
      icone(ic, ix + 7 * u, iy, 13 * u, ic === 'trophee' ? '#ffe14a' : '#fff'); texte(String(v), ix + 18 * u, iy, 11 * u, '#fff', 'left'); ctx.font = `700 ${11 * u}px Inter, system-ui`; ix += ctx.measureText(String(v)).width + 34 * u; });
    if (sel) { ctx.beginPath(); ctx.arc(x + cw - 20 * u, y + 20 * u, 12 * u, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); icone('check', x + cw - 20 * u, y + 20 * u, 14 * u, c2); }
    zones.push({ x, y, w: cw, h: chh, action: () => modeIndex = i });
  });
  if (pages > 1) { // pages
    const py = H - mapH - 22 * u - 36 * u, px = W - 20 * u - 84 * u;
    [[-1, 'retour'], [1, 'suite']].forEach(([d, ic], k) => { verre(px + k * 46 * u, py, 38 * u, 36 * u, 18 * u); icone(ic, px + k * 46 * u + 19 * u, py + 18 * u, 18 * u);
      zones.push({ x: px + k * 46 * u, y: py, w: 38 * u, h: 36 * u, action: () => pageMenu = (pageMenu + d + pages) % pages }); });
    texte((pageMenu + 1) + ' / ' + pages, px - 12 * u, py + 18 * u, 12 * u, 'rgba(255,255,255,.8)', 'right');
  }
  const my = H - mapH - 14 * u;
  if (m.map >= 0 && CONFIG.maps[m.map]) { verre(x0, my, zoneW, mapH, mapH / 2); icone('carte', x0 + 24 * u, my + mapH / 2, 16 * u); texte('Map imposée par ce mode : ' + CONFIG.maps[m.map].nom, x0 + 42 * u, my + mapH / 2, 13 * u, '#fff', 'left', zoneW - 60 * u); return; }
  verre(x0, my, zoneW, mapH, 24 * u);
  titre('Map', x0 + 18 * u, my + 20 * u, 18 * u, '#fff', 'left');
  const th = mapH - 50 * u, tw = th * 1.5;
  CONFIG.maps.forEach((def, i) => {
    const x = x0 + 18 * u + i * (tw + 14 * u), y = my + 36 * u; if (x + tw > x0 + zoneW - 10 * u) return;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, tw, th, 12 * u); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.drawImage(miniMap(def), x, y, tw, th); ctx.imageSmoothingEnabled = true;
    const gb = ctx.createLinearGradient(0, y + th * 0.5, 0, y + th); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,.65)'); ctx.fillStyle = gb; ctx.fillRect(x, y, tw, th); ctx.restore();
    texte(def.nom, x + tw / 2, y + th - 10 * u, 10 * u, '#fff', 'center', tw - 8 * u);
    const sel = i === mapIndex % CONFIG.maps.length; ctx.beginPath(); ctx.roundRect(x, y, tw, th, 12 * u); ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = sel ? 3 * u : 1; ctx.stroke();
    zones.push({ x, y, w: tw, h: th, action: () => mapIndex = i });
  });
}
function menuClassement() {
  const u = U(), top = barreHaut('CLASSEMENT', true);
  if (db && temps - classementT > 900) { // rafraîchi toutes les ~15 s
    classementT = temps;
    db.collection('joueurs').orderBy('points', 'desc').limit(30).get().then(s => classement = s.docs.map(d => ({ uid: d.id, ...d.data() }))).catch(() => classement = classement || []);
  }
  const cw = Math.min(260 * u, W * 0.3), x0 = 14 * u, y0 = top + 14 * u, h = H - y0 - 14 * u;
  rect(x0, y0, cw, h, 18 * u, 'rgba(255,255,255,.1)', '#ffd23f', 3 * u);
  const im = carteDe(selPerso()), is = Math.min(cw * 0.45, h * 0.3);
  if (pret(im)) ctx.drawImage(im, x0 + cw / 2 - is / 2, y0 + 10 * u, is, is);
  texte(nomJoueur(), x0 + cw / 2, y0 + is + 24 * u, 18 * u, '#fff');
  const rang = classement ? classement.findIndex(j => j.uid === (user && user.uid)) + 1 : 0;
  [['🏆', 'Points', mesStats.points], ['⭐', 'Victoires', mesStats.victoires], ['🎮', 'Parties', mesStats.parties],
   ['📈', 'Taux de victoire', mesStats.parties ? Math.round(mesStats.victoires / mesStats.parties * 100) + ' %' : '-'], ['🥇', 'Rang', rang ? '#' + rang : '-']]
    .forEach(([i, l, v], k) => { const y = y0 + is + 50 * u + k * 26 * u; if (y > y0 + h - 14 * u) return; emoji(i, x0 + 22 * u, y, 15 * u); texte(l, x0 + 38 * u, y, 12 * u, '#cfd8ff', 'left'); texte(String(v), x0 + cw - 14 * u, y, 14 * u, '#fff', 'right'); });
  const lx = x0 + cw + 14 * u, lw = W - lx - 14 * u;
  if (!classement) return texte('Chargement…', lx + lw / 2, y0 + 40 * u, 16 * u, '#fff');
  if (!classement.length) return texte('Personne encore… joue une partie !', lx + lw / 2, y0 + 40 * u, 16 * u, '#fff');
  const rh = 32 * u, parCol = Math.max(1, Math.floor(h / (rh + 6 * u))), cols = classement.length > parCol && lw > 500 * u ? 2 : 1, colW = (lw - (cols - 1) * 12 * u) / cols;
  classement.slice(0, parCol * cols).forEach((j, k) => {
    const x = lx + Math.floor(k / parCol) * (colW + 12 * u), y = y0 + (k % parCol) * (rh + 6 * u), moiL = user && j.uid === user.uid;
    rect(x, y, colW, rh, 10 * u, moiL ? 'rgba(255,210,63,.35)' : 'rgba(255,255,255,.1)', moiL ? '#ffd23f' : null, 2);
    const med = ['🥇', '🥈', '🥉'][k];
    if (med) emoji(med, x + 18 * u, y + rh / 2, 18 * u); else texte('#' + (k + 1), x + 18 * u, y + rh / 2, 12 * u, '#cfd8ff');
    texte(j.pseudo || 'Joueur', x + 38 * u, y + rh / 2, 13 * u, '#fff', 'left', colW - 170 * u);
    texte('⭐' + (j.victoires || 0) + '   🏆 ' + (j.points || 0), x + colW - 10 * u, y + rh / 2, 12 * u, '#ffe8a3', 'right');
  });
}

// --- Super pouvoirs + aide
function menuPouvoirs() {
  const u = U(), top = barreHaut('SUPER POUVOIRS', true), l = Object.values(CONFIG.pouvoirs);
  const x0 = 14 * u, y0 = top + 14 * u, zoneW = W - 28 * u, aideH = 64 * u;
  const cols = Math.max(2, Math.floor(zoneW / (200 * u))), cw = (zoneW - (cols - 1) * 12 * u) / cols, chh = 70 * u;
  const desc = p => ({ vitesse: `Vitesse ×${p.valeur}`, degats: `Dégâts ×${p.valeur}`, bouclier: `Dégâts reçus ×${p.valeur}`, soin: `Soigne ${Math.round(p.valeur * 100)} % des PV`,
    munitions: 'Munitions illimitées', invisible: 'Invisible pour les ennemis' })[p.effet] + (p.effet !== 'soin' ? ` • ${p.duree} s` : '');
  l.forEach((p, k) => {
    const x = x0 + (k % cols) * (cw + 12 * u), y = y0 + Math.floor(k / cols) * (chh + 10 * u); if (y + chh > H - aideH - 20 * u) return;
    rect(x, y, cw, chh, 14 * u, 'rgba(255,255,255,.1)', p.couleur, 3 * u);
    ctx.beginPath(); ctx.arc(x + 34 * u, y + chh / 2, 24 * u, 0, 7); ctx.fillStyle = p.couleur; ctx.fill();
    emoji(p.icone || '✨', x + 34 * u, y + chh / 2, 24 * u);
    texte(p.nom, x + 66 * u, y + chh / 2 - 10 * u, 15 * u, '#fff', 'left');
    texte(desc(p), x + 66 * u, y + chh / 2 + 12 * u, 11 * u, '#cfd8ff', 'left');
  });
  const ay = H - aideH - 12 * u;
  rect(x0, ay, zoneW, aideH, 14 * u, 'rgba(255,255,255,.1)');
  texte('🎁 Casse les murs, buissons et coffres pour trouver des pouvoirs — marche dessus pour les ramasser.', x0 + 14 * u, ay + 20 * u, 12 * u, '#fff', 'left');
  texte('🕹️ Joystick gauche : bouger • Joystick droit : viser et relâcher pour tirer (petit tap = tir auto) • 🌳 Buisson = caché', x0 + 14 * u, ay + 44 * u, 11 * u, '#cfd8ff', 'left');
}

function dessinerAttente() {
  ecran(); zones = []; fond();
  const u = U(), cx = W / 2, cy = H * 0.42;
  titre(mode ? mode.nom : '', cx, H * 0.14, 34 * u, '#fff', 'center', W - 40);
  for (let i = 0; i < 3; i++) { // anneaux de chargement
    ctx.beginPath(); ctx.arc(cx, cy, (46 + i * 16) * u, temps * (0.05 + i * 0.02) + i, temps * (0.05 + i * 0.02) + i + Math.PI * (0.6 + i * 0.3));
    ctx.strokeStyle = ['#5ac8fa', '#b57bff', '#ff7ab6'][i]; ctx.lineWidth = 5 * u; ctx.lineCap = 'round'; ctx.stroke();
  }
  titre(attente.n + '/' + attente.max, cx, cy + 2 * u, 30 * u, '#fff');
  texte('Recherche de joueurs' + '.'.repeat(1 + Math.floor(temps / 30) % 3), cx, cy + 110 * u, 16 * u, 'rgba(255,255,255,.85)');
  const info = attente.reste > 0 ? `Départ dans ${attente.reste} s` : attente.bots > 0 ? `Bots dans ${attente.bots} s si personne ne rejoint` : attente.min < attente.max ? `Départ possible à ${attente.min} joueurs` : '';
  if (info) { verre(cx - 150 * u, cy + 128 * u, 300 * u, 30 * u, 15 * u); texte(info, cx, cy + 143 * u, 12 * u, '#fff', 'center', 280 * u); }
  boutonJeu(cx - 90 * u, H - 64 * u, 180 * u, 44 * u, '#ff7a6b', '#ff2d55', () => { quitterSalle(); etat = 'MENU'; }); titre('Annuler', cx, H - 42 * u, 20 * u, '#fff');
}
function dessinerFin() { // animation de victoire / défaite avec les gagnants et les perdants
  ecran();
  const t = Math.max(0, temps - (finInfo ? finInfo.t0 : temps)), vic = etat === 'VICTOIRE', G = finInfo ? finInfo.gagnants : [], P = finInfo ? finInfo.perdants : [];
  zones = [];
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(-100, -100, W + 200, H + 200);
  const cy = H * 0.42;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(t * 0.01); ctx.fillStyle = vic ? 'rgba(255,210,63,.12)' : 'rgba(255,60,60,.08)';
  for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -1500); ctx.lineTo(40, -1500); ctx.fill(); }
  ctx.restore();
  if (vic) for (let i = 0; i < 70; i++) { // confettis
    const x = (i * 137.5 + Math.sin(t * 0.05 + i) * 30) % W, y = ((i * 53 + t * (2 + i % 4)) % (H + 40)) - 20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.1 + i); ctx.fillStyle = ['#ffd23f', '#ff5a8a', '#5ad1ff', '#9cff57', '#b67aff'][i % 5];
    ctx.beginPath(); ctx.roundRect(-5, -3, 10, 6, 3); ctx.fill(); ctx.restore();
  }
  const sc = Math.min(1, t / 15) * (1 + Math.max(0, Math.sin(Math.min(t, 30) / 30 * Math.PI)) * 0.25);
  ctx.save(); ctx.translate(W / 2, H * 0.1); ctx.scale(sc, sc);
  titre(vic ? 'Victoire' : etat === 'EGALITE' ? 'Égalité' : 'Défaite', 0, 0, Math.min(72, W / 8), vic ? '#ffe14a' : etat === 'EGALITE' ? '#fff' : '#ff5a6e'); ctx.restore();
  const tg = Math.min(H * 0.26, 150, (W - 40) / Math.max(1, G.length) / 1.15);
  G.forEach((c, i) => { // gagnants : rebondissent avec une couronne
    const x = W / 2 + (i - (G.length - 1) / 2) * tg * 1.15, y = cy + Math.sin(t * 0.12 + i) * 8 - Math.max(0, 25 - t) * 12;
    ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; ellipse(x, y, tg * 0.45, tg * 0.45, 'rgba(255,210,63,.35)'); ctx.restore();
    if (pret(c.im)) ctx.drawImage(c.im, x - tg / 2, y - tg / 2, tg, tg);
    ctx.save(); ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 18; icone('trophee', x, y - tg * 0.58 + Math.sin(t * 0.15) * 3, tg * 0.26, '#ffd400'); ctx.restore();
    texte(c.nom, x, y + tg * 0.6, 15, '#fff', 'center', tg * 1.1);
  });
  const tp = tg * 0.5, py = H * 0.74 + Math.min(t, 40) * 0.3;
  P.forEach((c, i) => { // perdants : en gris, penchés
    const x = W / 2 + (i - (P.length - 1) / 2) * tp * 1.3;
    ctx.save(); ctx.translate(x, py); ctx.rotate((i % 2 ? 1 : -1) * Math.min(0.35, t * 0.01)); ctx.globalAlpha = 0.8;
    ctx.filter = 'grayscale(1) brightness(.6)';
    if (pret(c.im)) ctx.drawImage(c.im, -tp / 2, -tp / 2, tp, tp);
    ctx.filter = 'none'; ctx.restore();
    texte(c.nom, x, py + tp * 0.64, 12, 'rgba(255,255,255,.55)', 'center', tp * 1.2);
  });
  if (messageFin) texte(messageFin, W / 2, H * 0.19, 16, '#fff');
  if (finInfo && t > 20) texte('+' + finInfo.points + ' 🏆' + (finInfo.essence ? '   +' + finInfo.essence : ''), W / 2, H * 0.62 - Math.min(20, (t - 20)), 22, '#9cff57');
  if (t > 40) { // boutons de fin
    const u = U(), bw = 170 * u, bh = 50 * u, y = H - bh - 14 * u;
    bouton3D(W / 2 - bw - 10 * u, y, bw, bh, '#ffe14a', '#f0a000', () => { quitterSalle(); etat = 'MENU'; lancerPartie(); }); texte('🔁 REJOUER', W / 2 - bw / 2 - 10 * u, y + bh / 2, 17 * u, '#fff');
    bouton3D(W / 2 + 10 * u, y, bw, bh, '#8e7bff', '#5b3fd6', () => { quitterSalle(); etat = 'MENU'; allerA('accueil'); }); texte('🏠 MENU', W / 2 + bw / 2 + 10 * u, y + bh / 2, 17 * u, '#fff');
  }
}


// ---------- 16. ÉVÉNEMENTS DE PARTIE : intro, mort, réapparition, spectateur, poison, fumée ----------
let introT = 0, debutJeu = 0, kills = {}, nuages = [], dots = [], fantomes = [], suivi = null;
function animMort(e, im) { // le perso tourne, rétrécit et s'envole en fondu
  fantomes.push({ im: im || img(e.perso ? e.perso.image : ''), x: e.x, y: e.y, a: e.angle || 0, t: temps, taille: e.r * 2.9 });
  for (let i = 0; i < 20; i++) particule(e.x, e.y, i % 2 ? '#ffffff' : '#9aa0ff', 6, 6, 1.4, 'rond');
  ondes.push({ x: e.x, y: e.y, r: 8, max: 90, c: '#ffffff', vie: 1, ep: 8 });
}
function animReap(e) { // colonne de lumière à la réapparition
  e.anim = { n: 'releve', t: temps }; e.mortT = 0;
  ondes.push({ x: e.x, y: e.y, r: 4, max: 80, c: '#7dff9c', vie: 1, ep: 10 });
  for (let i = 0; i < 24; i++) particule(e.x, e.y, i % 2 ? '#7dff9c' : '#ffffff', 5, 6, 1.2, 'rond', { g: -0.12 });
  fantomes.push({ lumiere: true, x: e.x, y: e.y, t: temps });
}
function mourir(j) {
  effet('explosion', j.x, j.y, '#888', 60); animMort(j);
  if (j === moi) {
    envoyerEtat(true);
    if (moi.dernier && moi.dernier !== moi.uid) { kills[moi.dernier] = (kills[moi.dernier] || 0) + 1; envoyer({ t: 'mort', k: moi.dernier }); }
    if (mode.reapparition && !resultat) moi.revivre = temps + (+mode.delaiReapparition || 3) * 60;
  } else if (j.bot && hote && j.dernier) { kills[j.dernier] = (kills[j.dernier] || 0) + 1; envoyer({ t: 'mort', k: j.dernier }); }
}
function revivre(j) {
  const sp = j.spawn || caseLibre([]);
  Object.assign(j, { x: sp.x, y: sp.y, tx: sp.x, ty: sp.y, pv: j.pvMax, revivre: 0, invuln: temps + 120, mun: +j.perso.munitions || 3, bonus: {} });
  animReap(j); if (j === moi) envoyerEtat(true);
}
function transitionPV(j, pv) { // détecte la mort / réapparition des autres joueurs
  if (j.pv > 0 && pv <= 0) animMort(j); else if (j.pv <= 0 && pv > 0) animReap(j);
}
function planifier(e, p, deg, ang) { // dégâts à retardement et/ou poison étalé dans le temps
  const a = p.arme, retard = (+a.retard || 0) * 60, n = (+a.poisonDuree || 0) > 0 ? Math.max(1, Math.round(a.poisonDuree * 2)) : 1;
  for (let k = 0; k < n; k++) dots.push({ e, de: p.de, deg: Math.round(deg / n), t: temps + retard + k * 30, a, ang });
  e.empoisonne = temps + retard + n * 30; e.couleurPoison = a.couleur || '#7dff4a';
}
let zoneProg = {};
function majZone() { // 🎯 une équipe seule dans la zone la fait progresser
  if (mode.objectif !== 'zone' || !map.z) return;
  const dedans = new Set();
  for (const j of joueurs()) if (j.pv > 0 && tuileA(j.x, j.y) === 'Z') dedans.add(j.eq);
  for (const b of bosses) if (b.pv > 0 && !b.def.cristal && tuileA(b.x, b.y) === 'Z') dedans.add(-1);
  zoneControle = dedans.size === 1 ? [...dedans][0] : dedans.size ? 'conteste' : null;
  if (typeof zoneControle === 'number' && zoneControle >= 0) zoneProg[zoneControle] = (zoneProg[zoneControle] || 0) + 1;
}
let zoneControle = null;
function majEvenements() {
  majZone();
  if (moi.revivre && temps >= moi.revivre && !resultat) revivre(moi);
  for (const d of dots) if (temps >= d.t && !d.fait) { d.fait = true; if (d.e.pv > 0) degats(d.e, d.de, d.deg, d.e.x, d.e.y + 1, d.ang, d.a); }
  dots = dots.filter(d => !d.fait);
  for (const n of nuages) if ((temps - n.debut) % 30 === 29 && n.deg > 0) { // le nuage blesse toutes les ½ s
    const pr = entite(n.de), eq = pr ? pr.eq : -1;
    for (const e of [...bosses.filter(b => b.pv > 0 && !(pr && pr.def)), ...joueurs().filter(j => j.pv > 0 && j.eq !== eq && !(n.feu && j.dep === 'feu'))])
      if (Math.hypot(e.x - n.x, e.y - n.y) < n.r) degats(e, n.de, Math.round(n.deg / 2), n.x, n.y, 0, n.arme);
  }
  nuages = nuages.filter(n => temps < n.fin);
  fantomes = fantomes.filter(f => temps - f.t < 60);
}
function cibleCamera() { // mort : on suit un allié en vie (ou n'importe qui)
  if (moi.pv > 0) return moi;
  const allies = joueurs().filter(j => j !== moi && j.pv > 0 && j.eq === moi.eq), l = allies.length ? allies : joueurs().filter(j => j !== moi && j.pv > 0);
  let s = l.find(j => j.uid === suivi); if (!s && l.length) { s = l[0]; suivi = s.uid; }
  return s || moi;
}
function dessinerNuages() {
  for (const n of nuages) {
    if (n.feu) { const k = Math.min(1, (n.fin - temps) / 40), f = 1 + Math.sin(temps * 0.4 + n.x) * 0.15; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(n.x, n.y - 6, 2, n.x, n.y, n.r * f); g.addColorStop(0, `rgba(255,220,120,${0.7 * k})`); g.addColorStop(0.5, `rgba(255,110,20,${0.45 * k})`); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r * f, n.r * 0.6 * f, 0, 0, 7); ctx.fill(); ctx.restore(); continue; } // 🔥
    const k = Math.min(1, (n.fin - temps) / 60, (temps - n.debut) / 15);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + temps * 0.01, d = n.r * 0.55;
      ctx.globalAlpha = 0.28 * k; ellipse(n.x + Math.cos(a) * d, n.y + Math.sin(a) * d * 0.7, n.r * 0.55, n.r * 0.42, n.c);
    }
    ctx.globalAlpha = 0.35 * k; ellipse(n.x, n.y, n.r * 0.7, n.r * 0.5, n.c); ctx.globalAlpha = 1;
  }
  for (const f of fantomes) {
    const t = (temps - f.t) / 60;
    if (f.lumiere) { const g = ctx.createLinearGradient(0, f.y - 200, 0, f.y); g.addColorStop(0, 'rgba(125,255,156,0)'); g.addColorStop(1, `rgba(125,255,156,${0.5 * (1 - t)})`); ctx.fillStyle = g; ctx.fillRect(f.x - 30, f.y - 200, 60, 200); continue; }
    if (!pret(f.im)) continue;
    ctx.save(); ctx.globalAlpha = 1 - t; ctx.translate(f.x, f.y - t * 80); ctx.rotate(f.a + Math.PI / 2 + t * 6);
    const s = f.taille * (1 - t * 0.6); ctx.drawImage(f.im, -s / 2, -s / 2, s, s); ctx.restore();
  }
  for (const e of [...joueurs(), ...bosses]) if (e.empoisonne > temps && e.pv > 0 && temps % 6 === 0) // bulles de poison
    particule(e.x + (Math.random() - 0.5) * e.r, e.y - e.r, e.couleurPoison, 1, 5, 1, 'rond', { g: -0.1 });
  if (moi.invuln > temps && moi.pv > 0) { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(temps * 0.4); ctx.strokeStyle = '#7dff9c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(moi.x, moi.y - 8, moi.r * 1.5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
}
function hudExtra() { // chrono, score et mode spectateur
  const u = U();
  if (mode.duree > 0 && etat === 'JEU') {
    const r = Math.max(0, mode.duree - Math.floor((temps - debutJeu) / 60)), txt = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');
    rect(W - 104 * u, 10 * u, 92 * u, 34 * u, 17 * u, r <= 10 ? 'rgba(200,30,30,.8)' : 'rgba(0,0,0,.5)');
    texte('⏱ ' + txt, W - 58 * u, 27 * u, 16 * u, '#fff');
  }
  const tous = [moi, ...Object.values(autres)], en = tous.filter(j => j.eq !== moi.eq);
  if (mode.reapparition && en.length) {
    const sc = eq => tous.filter(j => j.eq === eq).reduce((s, j) => s + (kills[j.uid] || 0), 0);
    texte(`🔵 ${sc(moi.eq)}  —  ${Math.max(...[...new Set(en.map(j => j.eq))].map(sc))} 🔴`, W - 58 * u, 58 * u, 14 * u, '#fff');
  }
  if (mode.objectif === 'zone') { // progression de la zone
    const tz = (+mode.tempsZone || 30) * 60, eqs = [...new Set([moi, ...Object.values(autres)].map(j => j.eq))];
    eqs.forEach((eq, i) => { const y = 84 * u + i * 22 * u, p = Math.min(1, (zoneProg[eq] || 0) / tz);
      verre(W - 190 * u, y, 178 * u, 18 * u, 9 * u); rect(W - 188 * u, y + 2 * u, 174 * u * p, 14 * u, 7 * u, eq === moi.eq ? '#5ac8fa' : '#ff5a6e');
      texte((eq === moi.eq ? '🎯 Nous ' : '🎯 Eux ') + Math.round(p * 100) + '%', W - 101 * u, y + 9 * u, 11 * u, '#fff'); });
    if (zoneControle === 'conteste') texte('⚔️ Zone contestée', W / 2, H - 100 * u, 16 * u, '#ffd23f');
  }
  if (moi.pv > 0 || resultat) return;
  const v = cibleCamera(), l = joueurs().filter(j => j !== moi && j.pv > 0 && (j.eq === moi.eq || !joueurs().some(a => a !== moi && a.eq === moi.eq && a.pv > 0)));
  const bw = 320 * u, bx = W / 2 - bw / 2, by = H - 72 * u;
  rect(bx, by, bw, 56 * u, 16 * u, 'rgba(0,0,0,.6)', '#ffd23f', 2);
  texte(moi.revivre ? `💀 Réapparition dans ${Math.ceil((moi.revivre - temps) / 60)} s` : '💀 Tu es éliminé', W / 2, by + 16 * u, 13 * u, '#ffb3b3');
  if (v !== moi) {
    texte('👁️ ' + v.nom, W / 2, by + 38 * u, 15 * u, '#fff');
    if (l.length > 1) {
      const suiv = d => { const i = l.findIndex(j => j.uid === v.uid); suivi = l[(i + d + l.length) % l.length].uid; };
      bouton3D(bx + 8 * u, by + 24 * u, 40 * u, 26 * u, '#8e7bff', '#5b3fd6', () => suiv(-1)); texte('◀', bx + 28 * u, by + 37 * u, 13 * u, '#fff');
      bouton3D(bx + bw - 48 * u, by + 24 * u, 40 * u, 26 * u, '#8e7bff', '#5b3fd6', () => suiv(1)); texte('▶', bx + bw - 28 * u, by + 37 * u, 13 * u, '#fff');
    }
  }
}
function dessinerIntro() { // présentation des équipes (cartes en verre) puis compte à rebours circulaire
  const u = U(), t = temps - introT, tous = [moi, ...Object.values(autres)];
  const eqA = tous.filter(j => j.eq === moi.eq), eqB = tous.filter(j => j.eq !== moi.eq);
  const droite = eqB.length ? eqB.map(j => ({ im: carteDe(j.perso), nom: j.nom, c: '#ff5a6e' })) : bosses.filter(b => !b.def.cristal).map(b => ({ im: img(b.def.imageCarte || b.def.image), nom: b.def.nom, c: '#ff9f1a' }));
  const gauche = eqA.map(j => ({ im: carteDe(j.perso), nom: j.nom, c: j === moi ? '#5ac8fa' : '#34d399' }));
  if (t < 150) {
    const k = Math.min(1, t / 22), e = 1 - Math.pow(1 - k, 3), sortie = Math.max(0, (t - 128) / 22);
    ctx.fillStyle = `rgba(5,8,25,${0.78 * (1 - sortie)})`; ctx.fillRect(-100, -100, W + 200, H + 200);
    ctx.globalAlpha = 1 - sortie; titre(mode.nom, W / 2, 34 * u, 28 * u, '#fff', 'center', W - 40);
    const carte = (c, x, y, s) => {
      ctx.save(); ctx.shadowColor = c.c; ctx.shadowBlur = 24 * u; rect(x - s / 2, y - s * 0.55, s, s * 1.25, 22 * u, 'rgba(255,255,255,.14)', c.c, 2 * u); ctx.restore();
      const g = ctx.createRadialGradient(x, y - s * 0.05, 4, x, y, s * 0.6); g.addColorStop(0, c.c + '88'); g.addColorStop(1, c.c + '00'); ctx.fillStyle = g; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (pret(c.im)) ctx.drawImage(c.im, x - s * 0.42, y - s * 0.5, s * 0.84, s * 0.84);
      texte(c.nom, x, y + s * 0.52, 13 * u, '#fff', 'center', s - 10 * u);
    };
    const col = (l, cote) => { const s = Math.min(120 * u, (H - 110 * u) / Math.max(1, l.length) / 1.35); l.forEach((c, i) => {
      const x = W / 2 + cote * W * 0.24 - cote * (1 - e) * W * 0.5 + cote * sortie * W * 0.5, y = H / 2 + (i - (l.length - 1) / 2) * s * 1.38 + 10 * u;
      carte(c, x, y, s); }); };
    col(gauche, -1); if (droite.length) col(droite, 1);
    if (droite.length) { ctx.save(); ctx.translate(W / 2, H / 2 + 10 * u); ctx.scale(e, e); ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 30; titre('VS', 0, 0, 64 * u, '#ffe14a'); ctx.restore(); }
    ctx.globalAlpha = 1;
  } else {
    const r = 230 - t, n = Math.ceil(r / 27), f = (r % 27) / 27, txt = n > 0 && t < 211 ? String(Math.min(3, n)) : 'GO !', R = 70 * u;
    ctx.fillStyle = 'rgba(5,8,25,.25)'; ctx.fillRect(-100, -100, W + 200, H + 200);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.stroke();
    if (txt !== 'GO !') { ctx.beginPath(); ctx.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.strokeStyle = '#5ac8fa'; ctx.lineWidth = 6 * u; ctx.lineCap = 'round'; ctx.stroke(); }
    ctx.save(); ctx.translate(W / 2, H / 2); const sc = txt === 'GO !' ? 1 + (1 - f) * 0.4 : 0.85 + (1 - f) * 0.3; ctx.scale(sc, sc);
    titre(txt, 0, 2, (txt === 'GO !' ? 54 : 70) * u, txt === 'GO !' ? '#4ade80' : '#fff'); ctx.restore();
  }
}
function boucle() {
  if (etat === 'AUTH' || etat === 'MENU') { temps++; zoneSure(dessinerMenu); }
  else if (etat === 'ATTENTE') { temps++; zoneSure(dessinerAttente); rafraichirAttente(); }
  else if (etat === 'INTRO') { temps++; majEffets(); dessinerJeu(); zoneSure(dessinerIntro); if (temps - introT > 230) { etat = 'JEU'; debutJeu = temps; } }
  else { if (etat === 'JEU') maj(); else temps++; dessinerJeu(); if (etat !== 'JEU') zoneSure(dessinerFin); }
  requestAnimationFrame(boucle);
}
boucle();
// 📂 Nouveaux persos automatiques : tout fichier .glb déposé dans "modeles/" sur GitHub devient un perso jouable.
// Nom du fichier = nom du perso ; préfixe facultatif pour l'élément : "feu-dragon.glb", "eau-requin.glb"…
async function detecterModeles() {
  try {
    const hote = location.hostname.match(/^([^.]+)\.github\.io$/), depot = (CONFIG.app && CONFIG.app.depot) || (hote && hote[1] + '/' + location.pathname.split('/')[1]);
    if (!depot) return;
    const l = await (await fetch(`https://api.github.com/repos/${depot}/contents/modeles`)).json();
    if (!Array.isArray(l)) return;
    const ARME = { terre: 'rocher', air: 'vent', eau: 'trident', feu: 'boulefeu' };
    for (const f of l.filter(f => /\.glb$/i.test(f.name))) {
      const chemin = 'modeles/' + f.name; if (CONFIG.persos.some(p => p.modele === chemin)) continue;
      const m = f.name.replace(/\.glb$/i, '').match(/^(terre|air|eau|feu)[-_ ](.+)$/i), element = m ? m[1].toLowerCase() : '', nom = (m ? m[2] : f.name.replace(/\.glb$/i, '')).replace(/[-_]+/g, ' ').toUpperCase().slice(0, 16);
      const el = (CONFIG.elements || {})[element] || {}, a = ARME[element] && CONFIG.armes[ARME[element]] ? ARME[element] : Object.keys(CONFIG.armes)[0];
      CONFIG.persos.push({ nom, element, modele: chemin, modeleEchelle: 1, modeleRotation: 0, couleur: el.couleur || '#8b5cf6', image: '', imageCarte: '', arme: a,
        pvMax: 5500, vitesse: 5, degats: 1400, portee: 400, delaiTir: 28, munitions: 3, recharge: 55 });
    }
  } catch (e) { console.warn('Détection des modèles', e); }
}
detecterModeles().then(preparer3D); // détecte les nouveaux modèles, puis génère les persos 3D en arrière-plan
