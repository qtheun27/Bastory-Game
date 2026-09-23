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
  const SW = screen.width || 0, SH = screen.height || 0;
  let LW = Math.round(innerWidth), LH = Math.round(innerHeight);
  if (tourne) { LW = Math.max(LW, Math.min(SW, SH)); LH = Math.max(LH, Math.max(SW, SH)); } // écran pivoté : on remplit tout
  W = tourne ? LH : LW; H = tourne ? LW : LH;
  dpr = Math.max(1, Math.min(dpr, Math.sqrt(2.6e6 / Math.max(1, W * H)))); // grands écrans : moins de pixels à dessiner = plus fluide
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; document.body.style.width = W + 'px'; document.body.style.height = H + 'px'; // plus de bande de fond visible
  zoom = Math.max(0.55, Math.min(1.3, Math.min(W, H * 1.7) / (TUILE * 22)));
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
const redimPlusTard = () => [60, 250, 600, 1200].forEach(t => setTimeout(() => { redim(); lireZoneSure(); }, t)); // iOS/Android donnent la bonne taille avec un temps de retard
addEventListener('orientationchange', redimPlusTard); addEventListener('pageshow', redimPlusTard); if (window.visualViewport) visualViewport.addEventListener('resize', redimPlusTard); redimPlusTard();
function zoneSure(f) { // dessine l'interface en évitant l'encoche des téléphones
  const w0 = W, h0 = H; ox = sa.l; oy = sa.t; W = w0 - sa.l - sa.r; H = h0 - sa.t - sa.b;
  ecran(); f(); W = w0; H = h0; ox = oy = 0; ecran();
}
const mobile = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; // ordi dès qu'une souris / un trackpad est présent
function pleinEcran() { // mobile : plein écran + verrouillage en paysage (si le navigateur le permet)
  if (!mobile || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
}
let aff3 = null; // transformation sol → écran de la caméra 3D (null = vue 2D)
const monde = (sx, sy) => aff3 ? ctx.setTransform(aff3[0] * dpr, aff3[1] * dpr, aff3[2] * dpr, aff3[3] * dpr, aff3[4] * dpr, aff3[5] * dpr)
  : ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, (W / 2 - cam.x * zoom + sx) * dpr, (H / 2 - cam.y * zoom + sy) * dpr);
const versMonde = (x, y) => { // écran → monde (vue 3D, 2,5D ou 2D)
  if (aff3) return Rendu3D.versMonde(x, y);
  if (vue25) { const t = Math.max(0, Math.min(1, y / H)); x = W / 2 + (x - W / 2) / (1 + PERSP * t); y = H / PERSP * Math.log(1 + PERSP * t); }
  return { x: (x - W / 2) / zoom + cam.x, y: (y - H / 2) / zoom + cam.y };
};

// ---------- 4. ÉTAT ----------
let etat = 'AUTH', modeIndex = 0, mapIndex = 0, persoIndex = 0, mode = null, hote = true, salle = null;
let persoSauve = 0, persoCharge = false; try { persoIndex = persoSauve = Math.max(0, Math.min(CONFIG.persos.length - 1, +localStorage.getItem('bastoryPerso') || 0)); } catch (e) {} // 💾 dernier perso choisi
let map = null, moi = null, autres = {}, bosses = [], projectiles = [], particules = [], textes = [], ondes = [];
let objets = [], degatsTuiles = {}, mesPoints = 0, finInfo = null, attente = { n: 1, min: 1, max: 1, reste: 0 };
let cam = { x: 0, y: 0 }, secousse = 0, temps = 0, finDans = 0, resultat = '', messageFin = '', zones = [];
const modes = () => { const m = CONFIG.modes.filter(m => m.actif !== false); return m.length ? m : CONFIG.modes; };
const modeChoisi = () => modes()[modeIndex % modes().length];
const nbEquipes = m => ({ deux: 2, trois: 3, quatre: 4 })[m && m.equipes] || 0; // modes en équipes (2 à 4)
const EQ_COUL = ['#1e90ff', '#ff2d55', '#1fc46b', '#ffd23f'];                 // bleu, rouge, vert, jaune
const signature = m => { // empreinte unique d'un mode : deux joueurs ne se croisent que s'ils ont exactement le même mode
  const t = [m.nom, m.type, m.equipes, m.joueursMin, m.joueursMax, m.objectif, m.boss ? m.nbBoss : 0, m.duree].join('|'); let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(m.nom || 'mode').replace(/[.#$\[\]\/\s]/g, '_').slice(0, 24) + '_' + (h >>> 0).toString(36);
};
const mapChoisie = m => (m.map >= 0 && CONFIG.maps[m.map]) ? +m.map : mapsActives()[mapIndex % mapsActives().length];
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
  for (const p of [...CONFIG.persos, ...Object.values(CONFIG.bosses)]) if (p.modele) { try { const v = await Modele3D.visage(p); if (v) visages3D.set(p, v); } catch (e) { console.warn('Modèle 3D', p.nom, e.message); } }
  obtenir3D(CONFIG.persos[persoIndex]);
}
const animMenu = (vh, p) => { // 🎬 animation du perso dans les menus (réglable dans l'admin)
  const a = p.animAccueil; if (a === 'fixe') return [0, 'repos']; if (a && vh.a && vh.a(a)) return [(temps / 150) % 1, a];
  const cyc = temps % 420, att = cyc < 80 && vh.a && vh.a('attaque'); return [att ? cyc / 80 : temps / 150, att ? 'attaque' : 'repos']; };
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
  if (u) { if (etat === 'AUTH') etat = 'MENU'; ecouterPoints(); presence(); ecouterAmis(); initAmis(); } else { quitterSalle(); etat = 'AUTH'; }
});

// ---------- 6. MAP & COLLISIONS ----------
// 1-4 départs d'équipe  5-8 cristaux d'équipe  N cristal neutre  O cachette de trésor
// '.' herbe  'S' sable  '#' mur  'B' buisson  'W' eau  'P' départ joueur (2 pour le 1V1)  'E' départ boss  'C' coffre mystère
const styliser = d => { if (!d || !d.theme) return d; const t = themeDe(d); // 🎨 couleurs de l'ambiance choisie (campagne, ville, désert…)
  return { ...d, herbe1: t.sol, herbe2: t.sol, mur: t.mur, murFace: ombrer(t.mur, -0.3), buisson: t.buisson, buissonFonce: ombrer(t.buisson, -0.25), eau: t.eau, sable: t.sable, palette: t.palette }; };
function chargerMap(def) {
  def = styliser(def);
  const l = Math.max(...def.grille.map(r => r.length));
  const g = def.grille.map(r => r.padEnd(l, '.'));
  const m = { def, g, l, h: g.length, j: [], b: [], t: [], z: 0, eqj: [[], [], [], []], tc: [], tn: [], o: [] };
  const obj = mode ? mode.objectif : '';
  g.forEach((r, y) => { for (let x = 0; x < l; x++) {
    if (r[x] === 'P') m.j.push({ x, y }); if (r[x] === 'E') m.b.push({ x, y });
    if (r[x] === 'T') m.t.push({ x, y });   // 💎 cristal (à l'équipe dont le départ est le plus proche)
    if (r[x] >= '1' && r[x] <= '4') m.eqj[r[x] - 1].push({ x, y });      // 🔵🔴🟢🟡 départs de l'équipe 1 à 4
    if (r[x] >= '5' && r[x] <= '8') m.tc.push({ x, y, eq: r[x] - 5 });   // 💎 cristal de l'équipe 1 à 4
    if (r[x] === 'N') m.tn.push({ x, y });  // 💎 cristal neutre : à la 1re équipe qui le casse
    if (r[x] === 'O') m.o.push({ x, y });   // 💰 cachette de trésor
    if (r[x] === 'Z') m.z++;                 // 🎯 zone à tenir
  } });
  m.g = g.map(r => r.replace(/[T1-8NO]/g, '.').replace(obj === 'zone' || obj === 'marathon' ? /$^/ : /Z/g, '.')); // la zone n'existe qu'en mode "zone"
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
const DEP_BASE = { lave: 'nage', orage: 'vol' }; // 🌋 lave = marche sur l'eau • ⛈️ orage = vol
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
  return { uid, nom, eq, perso: p, dep: DEP_BASE[b.capacite || (el ? el.capacite : 'sol')] || b.capacite || (el ? el.capacite : 'sol'), depSpecial: b.capacite || '', arme: CONFIG.armes[p.arme] || Object.values(CONFIG.armes)[0], x, y, tx: x, ty: y, r: Math.round(Math.min(60, Math.max(14, +b.taille || 26))),
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
    const eq = d.eq !== undefined && d.eq !== null ? d.eq : nbEquipes(mode) ? k % nbEquipes(mode) : mode.equipes === 'coop' ? 0 : k;
    const pe = map.eqj[eq] || [], n = pe.filter(p => p.pris).length, libreE = pe.find(p => !p.pris); // départs réservés à l'équipe
    const sp = libreE ? (libreE.pris = true, { x: c(libreE.x), y: c(libreE.y) }) : map.j[k] ? { x: c(map.j[k].x), y: c(map.j[k].y) }
      : (k === 1 && map.j[0]) ? { x: c(map.l - 1 - map.j[0].x), y: c(map.h - 1 - map.j[0].y) } : caseLibre(places);
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
  zoneProg = {}; decor3D = null;
  if (typeof Modele3D !== 'undefined' && Modele3D.dispo()) Modele3D.decor(map.def).then(d => decor3D = d).catch(e => console.warn('Décor 3D', e)); // murs, coffres, buissons en 3D
  projectiles = []; particules = []; textes = []; ondes = []; objets = []; degatsTuiles = {}; retours = []; levees = {};
  cam.x = moi.x; cam.y = moi.y; finDans = 0; resultat = ''; messageFin = ''; finInfo = null;
  joyG.actif = joyD.actif = false;
  if (vueMode !== '3d') joueurs().forEach(j => obtenir3D(j.perso)); // en 2D : prépare les planches de sprites pendant l'intro
  etat = 'INTRO'; introT = temps; kills = {}; nuages = []; dots = []; fantomes = []; suivi = null;
  moi.spawn = { x: moi.x, y: moi.y }; Object.values(autres).forEach(j => j.spawn = { x: j.x, y: j.y });
  graine = liste.reduce((s, d) => s + [...String(d.uid)].reduce((a, c) => a + c.charCodeAt(0), 0), mapIdx * 13); // même graine chez tous les joueurs
  etape = 0; scoreEtapes = {}; bandeauEtape = null; tresors = []; scoreTresor = {}; preparerObjectif();
  if (mode.boss && vueMode !== '3d') Object.values(CONFIG.bosses).forEach(b => b.modele && obtenir3D(b)); // boss en 3D
}
const cleP = p => String(p.nom || 'perso').replace(/[.~*/\[\]`]/g, '_'); // clé des points par perso
function verifierFin() {
  if (resultat) return;
  const tous = [moi, ...Object.values(autres)], vivant = j => j.pv > 0 && !j.parti, o = obj();
  const allies = tous.filter(j => j.eq === moi.eq), ennemis = tous.filter(j => j.eq !== moi.eq);
  if (mode.duree > 0 && temps - debutJeu >= mode.duree * 60) { // ⏱ temps écoulé
    if (!ennemis.length) return finir(bosses.length && bosses.every(b => b.pv <= 0) ? 'VICTOIRE' : 'DEFAITE', 'Temps écoulé');
    const score = eq => mode.objectif === 'marathon' ? (scoreEtapes[eq] || 0) : o === 'tresor' ? (scoreTresor[eq] || 0) : tous.filter(j => j.eq === eq).reduce((s, j) => s + (kills[j.uid] || 0), 0);
    const mien = score(moi.eq), leur = Math.max(...[...new Set(ennemis.map(j => j.eq))].map(score));
    return finir(mien > leur ? 'VICTOIRE' : mien < leur ? 'DEFAITE' : 'EGALITE', `Temps écoulé • ${mien} - ${leur}`);
  }
  if (o === 'zone') for (const [eq, t] of Object.entries(zoneProg)) if (t >= (+mode.tempsZone || 30) * 60) return gagnerObjectif(+eq, 'Zone contrôlée !', 'Zone perdue');
  if (o === 'tresor') for (const [eq, n] of Object.entries(scoreTresor)) if (n >= (+mode.objectifTresors || 7)) return gagnerObjectif(+eq, 'Trésors trouvés !', 'Les trésors sont à eux…');
  if (o === 'bloc' && ennemis.length) { // 💎 1re équipe à casser un cristal adverse → gagne ; cristaux neutres → la majorité gagne
    const adv = cristauxCasses.find(c => c.p >= 0 && c.eq != null && c.eq !== c.p);
    if (adv) return gagnerObjectif(adv.eq, 'Cristal adverse détruit !', adv.p === moi.eq ? 'Ton cristal est détruit' : 'Un cristal est tombé…');
    const N = nbNeutres(), sc = scoreNeutres(), best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
    if (N && best && (best[1] > N / 2 || cristauxCasses.filter(c => c.p === -2).length >= N)) return gagnerObjectif(+best[0], 'Cristaux conquis !', 'Ils ont cassé plus de cristaux…');
  }
  if (mode.reapparition && ennemis.length) return; // avec réapparition, le match se joue au temps ou à l'objectif
  if (ennemis.length) {
    if (!ennemis.some(vivant)) finir('VICTOIRE', ennemis.length > 1 ? 'Équipe adverse éliminée' : 'Tu as battu ' + ennemis[0].nom);
    else if (!allies.some(vivant)) finir('DEFAITE', ennemis.filter(vivant).map(j => j.nom).join(', ') + ' gagne');
  } else if (!allies.some(vivant)) finir('DEFAITE', '');
  else if (bosses.length && bosses.every(b => b.pv <= 0)) finir('VICTOIRE', bosses.length > 1 ? 'Tous les boss sont vaincus' : '');
}
function noterCombat(r) { // 📓 journal des 30 derniers combats (joueurs affrontés ou alliés, hors bots)
  try { const l = JSON.parse(localStorage.getItem('bastoryJournal') || '[]');
    l.unshift({ t: Date.now(), mode: mode.nom, r, j: Object.values(autres).filter(j => !j.bot || j.parti === undefined && !String(j.uid).startsWith('bot')).filter(j => !String(j.uid).startsWith('bot')).map(j => ({ uid: j.uid, nom: j.nom, allie: j.eq === moi.eq })) });
    localStorage.setItem('bastoryJournal', JSON.stringify(l.slice(0, 30))); } catch (e) {}
}
function finir(r, msg) {
  if (!resultat) noterCombat(r);
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
function ecouterPoints() { if (db && user) db.collection('joueurs').doc(user.uid).onSnapshot(d => { const v = d.data() || {}; if (!persoCharge && v.perso !== undefined) { persoCharge = true; persoIndex = persoSauve = Math.max(0, Math.min(CONFIG.persos.length - 1, +v.perso)); } if (v.hud) Object.assign(hudPerso, v.hud); mesPoints = v.points || 0; if (v.touches && !toucheAttendue) mesTouches = { ...TOUCHES_DEF, ...v.touches }; mesStats = { points: v.points || 0, victoires: v.victoires || 0, parties: v.parties || 0, persos: v.persos || {}, essences: v.essences || {}, recompenses: v.recompenses || [], jetons: v.jetons || 0, persosDebloques: v.persosDebloques || [], avatars: v.avatars || [], avatar: v.avatar || null }; }, () => {}); }

// ---------- 8. MULTIJOUEUR (Realtime Database) ----------
// Salle d'attente → départ quand le max est atteint (ou 10 s après avoir atteint le minimum).
// Chacun envoie sa position et gère ses PV ; l'hôte (1er joueur) fait vivre les boss.
async function chercherPartie(opts = {}) {
  if (!rtdb) return alert('Multijoueur indisponible : ajoute databaseURL dans firebase-config.js');
  mode = modeChoisi();
  const max = Math.max(2, +mode.joueursMax || 2), min = Math.min(max, Math.max(2, +mode.joueursMin || 2));
  const sig = signature(mode), cle = 'attente/' + sig, nouvelle = rtdb.ref('salles').push().key;
  etat = 'ATTENTE'; attente = { n: 1, min, max, reste: 0 };
  let pris = opts.rejoindre || null;
  const nbG = opts.groupe ? Object.keys(groupe.membres).length : 0;
  try {
    if (opts.rejoindre) { /* membre d'un groupe : rejoint directement la salle du chef */ }
    else if (nbG) { if (1 + nbG < max) await rtdb.ref(cle).set({ uid: user.uid, salle: nouvelle, t: Date.now(), n: 1 + nbG, sig }); }
    else await rtdb.ref(cle).transaction(v => {
      if (v && v.salle && v.sig === sig && v.uid !== user.uid && Date.now() - v.t < 60000 && (v.n || 1) < max) { pris = v.salle; return (v.n || 1) + 1 >= max ? null : { ...v, n: (v.n || 1) + 1 }; }
      pris = null; return { uid: user.uid, salle: nouvelle, t: Date.now(), n: 1, sig };
    });
  } catch (e) { etat = 'MENU'; return alert('Erreur multijoueur : ' + e.message); }
  if (etat !== 'ATTENTE') return;
  if (nbG) rtdb.ref(`groupes/${user.uid}/partie`).set({ salle: nouvelle, mode: modeIndex, sig, t: Date.now() }); // le groupe suit le chef
  const id = pris || nouvelle, s = salle = { id, ref: rtdb.ref('salles/' + id), cle, sig, hote: !pris, uid: user.uid, debut: false, min, max, depuis: 0, js: {}, cree: Date.now() };
  if (s.hote) { rtdb.ref(cle).onDisconnect().remove(); s.ref.onDisconnect().remove(); await s.ref.child('info').set({ map: mapChoisie(mode), sig }); }
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
    if (d.sig !== s.sig || !d.liste.some(j => j.uid === user.uid)) { quitterSalle(); return chercherPartie(); } // autre mode ou salle pleine // salle déjà pleine
    demarrer(d.map, d.liste);
  });
  s.ref.child('evts').on('child_added', snap => { const e = snap.val(); if (salle === s && etat === 'JEU' && e && (e.par || e.de) !== user.uid) recevoir(e); });
  s.ref.child('bots').on('value', snap => { if (salle === s && etat === 'JEU' && !hote && !s.hote) for (const [uid, d] of Object.entries(snap.val() || {})) if (autres[uid]) { transitionPV(autres[uid], d.pv); Object.assign(autres[uid], { tx: d.x, ty: d.y, angle: d.a, pv: d.pv, cache: d.c, marche: d.m, bo: d.bo ? d.bo.split(',') : [] }); } });
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
    while (liste.length < s.min || (nbEquipes(mode) && liste.length % nbEquipes(mode) && liste.length < s.max))
      liste.push({ uid: 'bot' + k, nom: '🤖 Bot ' + k++, p: Math.floor(Math.random() * CONFIG.persos.length), bot: true, niv });
  }
  const grp = {}; liste.forEach(j => (grp[j.g || j.uid] = grp[j.g || j.uid] || []).push(j)); // 👥 amis = même équipe
  if (nbEquipes(mode)) { const n = Array(nbEquipes(mode)).fill(0); Object.values(grp).sort((a, b) => b.length - a.length).forEach(gr => { const t = n.indexOf(Math.min(...n)); gr.forEach(j => j.eq = t); n[t] += gr.length; }); }
  else if (mode.equipes !== 'coop') Object.values(grp).forEach((gr, k) => gr.forEach(j => j.eq = k));
  s.ref.child('info').once('value', i => s.ref.child('info/debut').set({ map: (i.val() || {}).map || 0, liste, sig: s.sig }));
}
function rafraichirAttente() {
  const s = salle; if (!s || !s.hote || s.debut) return;
  attente.reste = s.depuis ? Math.max(0, (+modeChoisi().attenteDepart || 10) - Math.floor((Date.now() - s.depuis) / 1000)) : 0;
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
    if (!d) { j.bot = true; j.niv = j.niv || 1; if (j.pv <= 0) j.pv = 1; // déconnecté : son perso continue en bot
      if (!hote) { const humains = [moi, ...Object.values(autres)].filter(x => !x.bot && !String(x.uid).startsWith('bot')).map(x => x.uid).sort(); if (humains[0] === moi.uid) { hote = true; if (salle) salle.hote = true; notif('👑 Tu reprends la partie (l\'hôte est parti)'); } }
      continue; }
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
  else if (e.t === 'db' && hote && bosses[e.i]) blesserBoss(bosses[e.i], e.deg, e.de);
  else if (e.t === 'fr') frappe(e, false);
  else if (e.t === 'ca') casser(e.tx, e.ty, e.o);
  else if (e.t === 'pr') objets = objets.filter(o => o.tx !== e.tx || o.ty !== e.ty);
  else if (e.t === 'mort' && e.k) kills[e.k] = (kills[e.k] || 0) + 1;
  else if (e.t === 'su' && j) lancerSuper(j, e.a, true);
  else if (e.t === 'ac' && j) lancerAction(j, e.a, true);
  else if (e.t === 'tr') prendreTresor(e.i, e.eq, true, e.u);
  else if (e.t === 'lt') lacherTresors(entite(e.u), e.n, true, e.x, e.y, e.id0);
  else if (e.t === 'cr') cristalCasse(e.p, e.eq, true);
  else if (e.t === 'et') etapeSuivante(e.n, e.eq, true);
}

// ---------- 9. CONTRÔLES ----------
const touches = {};
addEventListener('keydown', e => {
  if (etat === 'AUTH') return;
  const k = e.key.toLowerCase();
  if (toucheAttendue && etat === 'MENU') { // ⌨️ nouvelle touche choisie dans l'onglet Commandes (échange si déjà utilisée)
    if (k !== 'escape') { for (const a in mesTouches) if (mesTouches[a] === k) mesTouches[a] = mesTouches[toucheAttendue]; mesTouches[toucheAttendue] = k; sauverTouches(); }
    toucheAttendue = null; e.preventDefault(); return;
  }
  touches[k] = true;
  if (etat === 'MENU' && ecranMenu === 'persos' && (k === 'arrowleft' || k === 'arrowright')) changerPerso(k === 'arrowleft' ? -1 : 1);
  if (etat === 'JEU') {
    if (k === mesTouches.auto) { e.preventDefault(); tirerAuto(); }
    if (k === mesTouches.action) lancerAction(moi);            // 🎮 action d'élément
    if (k === mesTouches.super) lancerSuper(moi, angleSouris()); // ⭐ super, vers la souris
  }
  if (k === 'escape' && etat !== 'MENU') { quitterSalle(); etat = 'MENU'; }
});
addEventListener('keyup', e => touches[e.key.toLowerCase()] = false);
addEventListener('contextmenu', e => e.preventDefault());
const joyG = { actif: false }, joyD = { actif: false };
function vec(j) { const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy); return { dx, dy, d, f: Math.min(d / 60, 1), a: Math.atan2(dy, dx) }; }
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); pleinEcran();
  for (const t of e.changedTouches) {
    if (etat === 'MENU' && (ecranMenu === 'hud' || ecranMenu === 'commandes') && prendreBoutonHud(pt(t))) continue;
    if (etat === 'MENU') glisse = { x: pt(t).x, id: t.identifier };
    if (etat === 'MENU' && surHero(pt(t))) { heroDrag = { x: pt(t).x, id: t.identifier, bouge: 0 }; continue; }
    if (etat !== 'JEU' || moi.pv <= 0) { clic(pt(t).x, pt(t).y); continue; }
    const hb = boutonHUD(pt(t)); // boutons SUPER (glisser pour viser) / ACTION
    if (hb && hb.vise && moi.superPret) { const q = pt(t); Object.assign(joyS, { actif: true, id: t.identifier, ox: q.x, oy: q.y, x: q.x, y: q.y }); continue; }
    if (hb) { hb.f(); continue; }
    const q = pt(t), j = q.x < W / 2 ? joyG : joyD, { T } = posHUD(), tx = T.x + sa.l, ty = T.y + sa.t, ancre = j === joyD && Math.hypot(q.x - tx, q.y - ty) < T.r * 1.6;
    if (!j.actif) Object.assign(j, { actif: true, id: t.identifier, ox: ancre ? tx : q.x, oy: ancre ? ty : q.y, x: q.x, y: q.y }); // l'attaque part du centre de son bouton
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (hudDrag) deplacerBoutonHud(pt(e.changedTouches[0]));
  for (const t of e.changedTouches) for (const j of [joyG, joyD, joyS]) if (j.actif && j.id === t.identifier) { const q = pt(t); j.x = q.x; j.y = q.y; }
  if (heroDrag) for (const t of e.changedTouches) if (t.identifier === heroDrag.id) tournerHero(pt(t).x);
}, { passive: false });
function finTouche(e) {
  if (hudDrag) { hudDrag = null; sauverHud(); }
  if (glisse) for (const t of e.changedTouches) if (t.identifier === glisse.id) { const dx = pt(t).x - glisse.x; if (Math.abs(dx) > 60 && etat === 'MENU') { if (ecranMenu === 'modes') changerMode(dx < 0 ? 1 : -1); if (ecranMenu === 'persos') changerPerso(dx < 0 ? 1 : -1); } glisse = null; }
  if (heroDrag) for (const t of e.changedTouches) if (t.identifier === heroDrag.id) lacherHero();
  for (const t of e.changedTouches) {
    if (joyG.actif && joyG.id === t.identifier) joyG.actif = false;
    if (joyS.actif && joyS.id === t.identifier) { joyS.actif = false; const v = vec(joyS); if (etat === 'JEU') lancerSuper(moi, v.d > 15 ? v.a : angleAuto()); }
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
addEventListener('mousemove', e => { souris = pt(e); if (heroDrag) tournerHero(pt(e).x); if (hudDrag) deplacerBoutonHud(pt(e)); });
addEventListener('mouseup', () => { if (heroDrag) lacherHero(); if (hudDrag) { hudDrag = null; sauverHud(); } });
canvas.addEventListener('mousedown', e => {
  if (etat === 'MENU' && surHero(pt(e))) { heroDrag = { x: pt(e).x, bouge: 0 }; return; }
  if (etat === 'MENU' && (ecranMenu === 'hud' || ecranMenu === 'commandes') && prendreBoutonHud(pt(e))) return;
  if (etat !== 'JEU' || moi.pv <= 0) return clic(pt(e).x, pt(e).y);
  const hb = boutonHUD(pt(e)); if (hb) return hb.f();
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
  if (moi.anim && moi.anim.n === 'releve' && temps - moi.anim.t < DUREE_ANIM.releve) return; // pas de tir en se relevant
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
  if (+p.arme.onde) { // 🌍 onde de choc au sol autour de l'impact (marteau de Rokh)
    if (ondes.length > 14) ondes.shift();
    ondes.push({ x: p.x, y: p.y, r, max: +p.arme.onde, c: '#fff3c4', vie: 1, ep: 12 }); ono('KRAKOOM!', p.x, p.y, 1.3, '#ffe14a');
    fissuresSol.push({ x: p.x, y: p.y, t: temps, g: Math.random() * 100 }); secousse = Math.max(secousse, 12); effet('impact', p.x, p.y, '#c98a4b', 110); // sol fracassé
    for (const c of cibles(p)) { const d = Math.hypot(p.x - c.e.x, p.y - c.e.y); if (d >= r + c.e.r * 0.6 && d < +p.arme.onde) impact(c.e, { ...p, deg: Math.round(p.deg * 0.45) }, p.x, p.y, false); }
  }
}
function impact(e, p, x, y, avecEffet) {
  const a = p.arme, deg = p.deg, ang = Math.atan2(e.y - y, e.x - x);
  if (avecEffet) effet(a.effet, e.x, e.y - 10, p.sombre ? '#2a0033' : a.couleur, 40, ang);
  if (p.sombre) effetSombre(e.x, e.y - 10);
  if ((+a.retard || 0) > 0 || (+a.poisonDuree || 0) > 0) return planifier(e, p, deg, ang); // ⏳ dégâts à retardement / poison
  degats(e, p.de, deg, x, y, ang, a);
}
function degats(e, de, deg, x, y, ang, a) { // applique les dégâts selon qui a l'autorité
  if (a && +a.ralenti) { e.ralenti = +a.ralenti; e.ralentiT = temps + 120; } // 🫧 arme qui ralentit
  const pr = entite(de), kb = (a && +a.recul) || (a && a.effet === 'explosion' ? 6 : 3);
  if (pr && pr.perso && (de === moi.uid || (hote && pr.bot))) gagnerSuper(pr, deg); // ⭐ les dégâts chargent le super
  if (e === moi) { if (a && +a.recul && moi.depSpecial !== 'orage') { moi.kx += Math.cos(ang) * a.recul; moi.ky += Math.sin(ang) * a.recul; } return toucherMoi(deg, x, y, de); }
  e.flash = 8;
  texteFlottant('-' + deg, e.x, e.y - e.r * 1.4, (a && a.couleur) || '#fff');
  if (e.bot) { if (hote) { e.dernier = de; blesserBot(e, deg, ang); } return; } // les bots sont gérés par l'hôte
  if (!e.def) return;                                 // autre joueur : il gère ses PV lui-même
  if (hote) { e.kx += Math.cos(ang) * kb; e.ky += Math.sin(ang) * kb; }
  if (de === moi.uid || (hote && pr && pr.bot)) hote ? blesserBoss(e, deg, de) : envoyer({ t: 'db', i: e.i, deg, de }); // les dégâts des invités passent par l'hôte
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
  if (j.pv <= 0 || dash(j)) return;
  if (j.anim && j.anim.n === 'releve' && temps - j.anim.t < DUREE_ANIM.releve) return; // il se relève : immobile comme les joueurs
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
  for (const e of [...joueurs().filter(o => o.eq !== j.eq && o.pv > 0), ...bosses.filter(b => b.pv > 0 && b.eq !== j.eq)]) {
    const d = Math.hypot(e.x - j.x, e.y - j.y);
    if ((!e.cache || d < 170) && d < dm) { dm = d; c = e; }
  }
  const v = j.perso.vitesse * KV() * (0.7 + 0.15 * (j.niv || 1)) * bonus(j, 'vitesse');
  if (!j.objet && obj() === 'tresor' && (!c || dm > 260)) { // 🤖 part à la chasse au trésor
    const t = tresors.filter(t => t.pris === null).sort((a, b) => Math.hypot(a.x - j.x, a.y - j.y) - Math.hypot(b.x - j.x, b.y - j.y))[0];
    if (t) { allerVers(j, t.x, t.y, v); return; }
  }
  const butO = butObjectif(j); // 🎯 zone à tenir, cristal à casser ou à défendre
  if (butO) { const dO = Math.hypot(butO.x - j.x, butO.y - j.y), zone = obj() === 'zone';
    if ((zone && dO > (butO.r || 90) * 0.7) || (!zone && (!c || dm > 260) && dO > 120)) { allerVers(j, butO.x, butO.y, v); return; }
    if (zone && !c) { if (dO > 30) allerVers(j, butO.x, butO.y, v * 0.5); return; } // reste dans la zone
  }
  if (j.objet) { allerVers(j, j.objet.x, j.objet.y, v); if (!c || dm > 250) return; }
  if (c) {
    const a = Math.atan2(c.y - j.y, c.x - j.x), ideal = j.perso.portee * 0.7, cote = Math.sin(temps / 50 + j.x * 0.01) > 0 ? 1 : -1;
    const av = dm > ideal ? 1 : dm < ideal * 0.5 ? -1 : 0, ax = j.x, ay = j.y;
    deplacer(j, (Math.cos(a) * av - Math.sin(a) * cote * 0.6) * v, (Math.sin(a) * av + Math.cos(a) * cote * 0.6) * v);
    j.marche += v; tourner(j, a, 0.2);
    if (av > 0 && Math.hypot(j.x - ax, j.y - ay) < v * 0.35 && (j.coince = (j.coince || 0) + 1) > 8) { allerVers(j, c.x, c.y, v); j.coince = 0; } // bloqué par un mur : il contourne
    if (dm < j.perso.portee && j.recharge <= 0 && j.mun >= 1 && Math.random() < 0.05 * (j.niv || 1)) {
      const ang = a + (Math.random() - 0.5) * 0.35 / (j.niv || 1), f = Math.min(1, dm / j.perso.portee);
      j.mun -= 1; j.recharge = j.perso.delaiTir;
      const dg = Math.round(j.perso.degats * bonus(j, 'degats') * (0.8 + 0.2 * (j.niv || 1)));
      creerProjectile(j, ang, f, j.x, j.y, dg);
      envoyer({ t: 'tir', de: j.uid, a: +ang.toFixed(3), f: +f.toFixed(2), x: Math.round(j.x), y: Math.round(j.y), d: dg });
    }
    if (j.superPret && dm < 320) lancerSuper(j, a); else if (dm < 220 && (j.actionT || 0) < temps && Math.random() < 0.01) lancerAction(j, a);
  } else { // se promène sur la map
    if (!j.but || Math.hypot(j.but.x - j.x, j.but.y - j.y) < 30 || temps % 240 === 0) j.but = caseLibre([]);
    allerVers(j, j.but.x, j.but.y, v);
  }
}
function toucherMoi(deg, x, y, de) {
  if (moi.pv <= 0 || moi.invuln > temps) return;
  if (de) moi.dernier = de;
  deg = Math.round(deg * bonus(moi, 'bouclier') * (moi.bulle > temps ? 0.35 : 1)); // bouclier / bulle de Naïa = dégâts réduits
  moi.pv = Math.max(0, moi.pv - deg); moi.flash = 8;
  const ang = Math.atan2(moi.y - y, moi.x - x);
  moi.kx += Math.cos(ang) * 14; moi.ky += Math.sin(ang) * 14;
  texteFlottant('-' + deg, moi.x, moi.y - 50, '#ff4d4d');
  if (moi.pv === 0) mourir(moi);
}
function blesserBoss(b, deg, de) {
  if (b.pv <= 0) return; b.pv = Math.max(0, b.pv - deg); b.flash = 8;
  if (b.pv === 0) { mortBoss(b); if (b.def.cristal && hote) { const e = entite(de); cristalCasse(b.eq, e ? e.eq : (joueurs().find(j => j.eq !== b.eq) || {}).eq); } }
}
function mortBoss(b) { effet('explosion', b.x, b.y, '#7fbf3f', 130); secousse = 22; animMort(b, img(b.def.image)); }
function frappe(e, local) { // coup de massue d'un boss (local = calculé ici par l'hôte)
  const b = bosses.find(b => Math.hypot(b.x - e.x, b.y - e.y) < 180); if (b) b.anim = { n: 'attaque', t: temps };
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
  const fige = moi.anim && moi.anim.n === 'releve' && temps - moi.anim.t < DUREE_ANIM.releve; // on se relève : pas encore de contrôle
  if (appuye('gauche')) mx--;
  if (appuye('droite')) mx++;
  if (appuye('haut')) my--;
  if (appuye('bas')) my++;
  const dk = Math.hypot(mx, my); if (dk) { mx /= dk; my /= dk; }
  if (joyG.actif) { const v = vec(joyG); if (v.d > 5) { mx = Math.cos(v.a) * v.f; my = Math.sin(v.a) * v.f; } }
  if (moi.pv <= 0) mx = my = 0;
  const elm = elemDe(moi.perso) || {}, surEau = tuileA(moi.x, moi.y) === 'W';
  if (fige) { mx = 0; my = 0; }
  const vit = moi.perso.vitesse * KV() * bonus(moi, 'vitesse') * (moi.dep === 'nage' && surEau ? +elm.valeur || 1.3 : 1) * (moi.dep !== 'vol' && tuileA(moi.x, moi.y) === 'S' ? 0.8 : 1) * (moi.ralentiT > temps ? moi.ralenti || 0.6 : 1); // 🏖️ le sable ralentit
  if (moi.dep === 'nage' && surEau && moi.pv > 0) moi.pv = Math.min(moi.pvMax, moi.pv + moi.pvMax * (+elm.soin || 0) / 100 / 60); // 💧 se soigne dans l'eau
  if (moi.dep === 'brise' && (mx || my)) { const tx = Math.floor((moi.x + mx * moi.r * 1.3) / TUILE), ty = Math.floor((moi.y + my * moi.r * 1.3) / TUILE); if (bloqueTir(tuile(tx, ty))) abimer(tx, ty, +elm.valeur || 60); } // 🌍 brise les blocs en fonçant dedans
  moi.vx = (moi.vx || 0) + (mx * vit - (moi.vx || 0)) * 0.35; moi.vy = (moi.vy || 0) + (my * vit - (moi.vy || 0)) * 0.35; // départ / arrêt en douceur
  if (!dash(moi)) deplacer(moi, moi.vx + moi.kx, moi.vy + moi.ky); else deplacer(moi, moi.kx, moi.ky);
  moi.kx *= 0.8; moi.ky *= 0.8;
  if (mx || my) { moi.marche += vit; if (!joyD.actif) tourner(moi, Math.atan2(my, mx), 0.25); }
  if (joyD.actif) { const v = vec(joyD); if (v.d > 15) tourner(moi, v.a, 0.4); }
  if (moi.recharge > 0) moi.recharge--;
  if (moi.flash > 0) moi.flash--;
  if (moi.recharge <= 0) moi.mun = Math.min(+moi.perso.munitions || 3, moi.mun + 1 / (+moi.perso.recharge || 60)); // recharge des munitions
  moi.cache = tuileA(moi.x, moi.y) === 'B' || !!pouvoirActif(moi, 'invisible') || nuages.some(n => !n.feu && Math.hypot(n.x - moi.x, n.y - moi.y) < n.r);
  for (const j of joueurs()) if (j.dep === 'feu' && j.pv > 0 && j.marche !== j.mFeu) { j.mFeu = j.marche; if (temps % 10 === 0) { const e = elemDe(j.perso) || {}; nuages.push({ x: j.x, y: j.y + 10, r: 28, fin: temps + (+e.duree || 2) * 60, debut: temps, c: '#ff6a00', deg: +e.valeur || 120, de: j.uid, arme: { effet: 'etincelle', couleur: '#ff8a00' }, feu: true }); } } // 🔥 traînée de feu
  if ((moi.dep === 'feu' || moi.depSpecial === 'lave') && moi.pv > 0 && tuileA(moi.x, moi.y) === 'B' && map.def.casseBuissons !== false) abimer(Math.floor(moi.x / TUILE), Math.floor(moi.y / TUILE), 1e6); // 🔥 Pyro brûle les buissons
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
  majProjectiles(); majEffets(); majTresors();
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
  if (particules.length > 420) return; // 🚦 gros carnage à 6 joueurs : on plafonne les particules
  const a = Math.random() * Math.PI * 2, v = vit * (0.4 + Math.random() * 0.6);
  particules.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, t: taille * (0.6 + Math.random() * 0.6), vie, forme }, extra));
}
function effet(type, x, y, couleur = '#fff', rayon = 60, angle = 0) {
  onoEffet(type, x, y);
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
// ---------- 💥 THÈME MANGA COMIQUE : outils de dessin, onomatopées, intro ----------
const NOIR = '#0b0620', POLICE_BD = 'Bangers, "Luckiest Guy", Impact, sans-serif', POLICE = 'Fredoka, "Baloo 2", Fredoka, system-ui, sans-serif';
const R = () => Math.hypot(W, H);
const elastique = k => k <= 0 ? 0 : k >= 1 ? 1 : 1 + Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * 2 * Math.PI / 3);
const sortir = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const hasard = n => { const x = Math.sin(n * 91.3 + 17.7) * 43758.5453; return x - Math.floor(x); };

// ---------- OUTILS DE DESSIN MANGA ----------
function trame(alpha, couleur = '#fff') { // trame de points (screentone)
  const k = 'trame' + couleur; if (!cacheGfx[k]) { const c = document.createElement('canvas'); c.width = c.height = 14; const x = c.getContext('2d');
    x.fillStyle = couleur; x.beginPath(); x.arc(4, 4, 2, 0, 7); x.arc(11, 11, 2, 0, 7); x.fill(); cacheGfx[k] = ctx.createPattern(c, 'repeat'); }
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = cacheGfx[k]; ctx.fillRect(-50, -50, W + 100, H + 100); ctx.restore();
}
function rayons(cx, cy, rot, couleur, alpha, n = 18) { // soleil levant / fond de manga
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = couleur; ctx.beginPath(); const L = R();
  for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n, b = a + Math.PI / n; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); ctx.lineTo(cx + Math.cos(b) * L, cy + Math.sin(b) * L); }
  ctx.fill(); ctx.restore();
}
function lignesVitesse(cx, cy, rIn, n, alpha, couleur = '#000') { // lignes de concentration
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = couleur; const L = R();
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.004 + Math.random() * 0.012, r0 = rIn * (0.8 + Math.random() * 0.5);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a - e) * L, cy + Math.sin(a - e) * L); ctx.lineTo(cx + Math.cos(a + e) * L, cy + Math.sin(a + e) * L); ctx.fill(); }
  ctx.restore();
}
function lignesHoriz(alpha, couleur, dir = 1) { // lignes de vitesse qui défilent (intro)
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = couleur;
  for (let i = 0; i < 26; i++) { const y = hasard(i) * H, l = 80 + hasard(i + 9) * W * 0.5, v = 18 + hasard(i + 3) * 30, x = ((temps * v * dir + hasard(i + 5) * W * 2) % (W * 2)) - W * 0.5;
    ctx.fillRect(dir > 0 ? x : W - x - l, y, l, 1.5 + hasard(i + 7) * 4); }
  ctx.restore();
}
function eclat(x, y, r, pointes, fond, seed = 1, contour = NOIR, ep = 4) { // bulle "explosion" de BD
  ctx.beginPath();
  for (let i = 0; i < pointes * 2; i++) { const a = i * Math.PI / pointes + seed, rr = i % 2 ? r * (0.62 + hasard(i + seed * 7) * 0.12) : r * (0.95 + hasard(i + seed) * 0.25); ctx.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fond; ctx.fill(); if (contour) { ctx.lineJoin = 'round'; ctx.lineWidth = ep; ctx.strokeStyle = contour; ctx.stroke(); }
}
function bd(txt, x, y, taille, couleur = '#ffe14a', rot = 0, halo = '#fff') { // onomatopée : remplissage + contour noir + halo blanc
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = `${taille}px ${POLICE_BD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (halo) { ctx.lineWidth = taille * 0.34; ctx.strokeStyle = halo; ctx.strokeText(txt, 0, 0); }
  ctx.lineWidth = taille * 0.18; ctx.strokeStyle = NOIR; ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = couleur; ctx.fillText(txt, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-taille * 20, -taille, taille * 40, taille * 0.45); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillText(txt, 0, 0); ctx.restore(); // reflet haut
  ctx.restore();
}

// ---------- TYPOGRAPHIE : textes contourés façon arcade ----------
function texte(t, x, y, taille, couleur, align = 'center', maxW) {
  t = String(t);
  if (!texte.re) { texte.all = Object.entries(CONFIG.elements || {}).filter(([k, e]) => ELEM_DEF[k] && e.icone); texte.re = new RegExp(texte.all.map(([, e]) => e.icone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || '$^'); }
  const ems = texte.re.test(t) ? texte.all.filter(([, e]) => t.includes(e.icone)) : [];
  if (ems.length) {
    const re = new RegExp('(' + ems.map(([, e]) => e.icone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')'), parts = t.split(re).filter(Boolean), cle = s => (ems.find(([, e]) => e.icone === s) || [])[0];
    ctx.font = `600 ${taille}px ${POLICE}`; const tw = parts.reduce((a, s) => a + (cle(s) ? taille * 1.3 : ctx.measureText(s).width), 0);
    if (maxW && tw > maxW) return texte(t, x, y, taille * maxW / tw * 0.98, couleur, align);
    let px = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
    for (const s of parts) { const k = cle(s); if (k) { iconeElement(k, px + taille * 0.62, y, taille * 1.1); px += taille * 1.3; } else { texte(s, px, y, taille, couleur, 'left'); ctx.font = `600 ${taille}px ${POLICE}`; px += ctx.measureText(s).width; } }
    return;
  }
  if (fonce(couleur)) couleur = '#fff';
  t = String(t); const f = s => `600 ${s}px ${POLICE}`; ctx.font = f(taille);
  if (maxW && ctx.measureText(t).width > maxW) { taille = Math.max(7, taille * maxW / ctx.measureText(t).width); ctx.font = f(taille); }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(2, taille * 0.26); ctx.strokeStyle = NOIR; ctx.strokeText(t, x, y + taille * 0.09); ctx.strokeText(t, x, y);
  ctx.fillStyle = couleur; ctx.fillText(t, x, y);
}
const fonce = c => { let r, g, b; const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || ''), q = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/i.exec(c || '');
  if (m) { let h = m[1]; if (h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h, 16); r = n >> 16; g = n >> 8 & 255; b = n & 255; } else if (q) [r, g, b] = [+q[1], +q[2], +q[3]]; else return false;
  return r * 0.299 + g * 0.587 + b * 0.114 < 90; }; // couleur de texte sombre → on force un texte clair
function titre(t, x, y, taille, couleur, align = 'center', maxW) {
  if (fonce(couleur)) couleur = '#fff';
  t = String(t).toUpperCase(); taille *= 1.1; const f = s => `${s}px ${POLICE_BD}`; ctx.font = f(taille);
  if (maxW && ctx.measureText(t).width > maxW) { taille = Math.max(8, taille * maxW / ctx.measureText(t).width); ctx.font = f(taille); }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2; const ep = Math.max(3, taille * 0.17);
  ctx.lineWidth = ep; ctx.strokeStyle = NOIR; ctx.fillStyle = NOIR;
  ctx.strokeText(t, x + taille * 0.05, y + taille * 0.09); ctx.fillText(t, x + taille * 0.05, y + taille * 0.09); // ombre dure
  ctx.strokeText(t, x, y); ctx.fillStyle = couleur; ctx.fillText(t, x, y);
  if (taille > 22) { ctx.save(); ctx.beginPath(); ctx.rect(x - 4000, y - taille, 8000, taille * 0.5); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText(t, x, y); ctx.restore(); }
}

// ---------- PANNEAUX & BOUTONS DESSINÉS ----------
function verre(x, y, w, h, r, teinte) { // case de manga : fond encre, contour noir épais, ombre dure
  const u = U();
  rect(x + 3 * u, y + 4 * u, w, h, r, 'rgba(11,6,32,.55)');
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a2d9c'); g.addColorStop(1, '#1d1558');
  rect(x, y, w, h, r, g); if (teinte) rect(x, y, w, h, r, teinte);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, Math.min(h * 0.42, 14 * u + h * 0.2)); ctx.restore();
  rect(x, y, w, h, r, null, NOIR, Math.max(2, 2.8 * u));
  rect(x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, Math.max(0, r - 2.5 * u), null, 'rgba(255,255,255,.22)', 1);
}
function boutonBD(x, y, w, h, c1, c2, r, brillant) { // bouton moderne : pilule bombée, ombre douce, reflet vitré
  const u = U(); r = Math.min(r, h / 2);
  ctx.save(); ctx.shadowColor = 'rgba(15,0,50,.45)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 5 * u;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); rect(x, y, w, h, r, g); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.55); gl.addColorStop(0, 'rgba(255,255,255,.5)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(x, y, w, h * 0.55);
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x, y + h - 4 * u, w, 4 * u);
  if (brillant) { const q = ((temps * 5) % (w * 3)) - w * 0.5; const gs = ctx.createLinearGradient(x + q - 40 * u, 0, x + q + 40 * u, 0); gs.addColorStop(0, 'rgba(255,255,255,0)'); gs.addColorStop(0.5, 'rgba(255,255,255,.35)'); gs.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gs; ctx.fillRect(x, y, w, h); }
  ctx.restore();
  rect(x + 1.5 * u, y + 1.5 * u, w - 3 * u, h - 3 * u, Math.max(0, r - 1.5 * u), null, 'rgba(255,255,255,.45)', 1.5 * u);
  rect(x, y, w, h, r, null, 'rgba(11,6,32,.7)', 2 * u);
}
function bouton3D(x, y, w, h, c1, c2, action, r) { const u = U(); boutonBD(x, y, w, h, c1, c2, r || Math.min(h / 2, 14 * u), false); if (action) zones.push({ x, y, w, h, action }); };
function boutonJeu(x, y, w, h, c1, c2, action) {
  const u = U(), r = Math.min(h / 2, 22 * u);
  boutonBD(x, y, w, h, c1, c2, r, true);
  const s = 7 * u * (1 + 0.35 * Math.sin(temps * 0.15)); // petite étincelle qui pulse
  ctx.save(); ctx.translate(x + w - 10 * u, y + 6 * u); ctx.rotate(temps * 0.05); ctx.fillStyle = '#fff'; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.3 : s, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore();
  if (action) zones.push({ x, y, w, h, action });
}
function bouton(x, y, w, h, txt, fond, action, taille = 14) {
  rect(x, y + 4, w, h, 12, NOIR); rect(x, y, w, h, 12, fond, NOIR, 3); texte(txt, x + w / 2, y + h / 2, taille, '#fff');
  if (action) zones.push({ x, y, w, h, action });
}

// ---------- FONDS DES MENUS : ciel manga lumineux ----------
const DECO = ['DON!', 'BAM!', 'ZUUUN', 'GOGOGO', 'PAF!', 'BOOM!', 'WAAH!'];
function fond() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#18b8ff'); g.addColorStop(0.55, '#5a4dff'); g.addColorStop(1, '#ff3d9a');
  ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
  rayons(W * 0.5, H * 0.38, temps * 0.0025, '#ffffff', 0.11, 20);
  const s = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, Math.max(W, H) * 0.45); s.addColorStop(0, 'rgba(255,245,180,.55)'); s.addColorStop(1, 'rgba(255,245,180,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  trame(0.07);
  ctx.save(); ctx.fillStyle = '#fff'; for (let i = 0; i < 18; i++) { const x = hasard(i + 40) * W, y = H - ((temps * (0.4 + hasard(i) * 0.8) + hasard(i + 3) * H) % (H + 40)), r = 1.5 + hasard(i + 7) * 2.5; // ✨ étincelles qui montent
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(temps * 0.08 + i); ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.35 : r * 1.8, an = k * Math.PI / 4; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } ctx.fill(); } ctx.restore();
  const u = U(); ctx.save(); ctx.globalAlpha = 0.13; // onomatopées géantes qui dérivent en fond
  DECO.forEach((t, i) => { const x = (((hasard(i) + temps * 0.00025 * (1 + i % 3)) % 1.3) - 0.15) * W, y = H * (0.12 + hasard(i + 4) * 0.8);
    bd(t, x, y + Math.sin(temps * 0.02 + i) * 6, (50 + hasard(i + 2) * 50) * u, '#fff', -0.25 + hasard(i + 8) * 0.5, null); });
  ctx.restore();
}
function vignette() {
  const k = 'vm' + W + 'x' + H; if (cacheGfx[k]) return cacheGfx[k];
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,0,70,.32)'); return cacheGfx[k] = g;
}

// ---------- SOL DES MAPS : herbe cartoon (aplats + touffes contourées) ----------
function motifHerbe(d) { // 🟩 sol dessiné : dalles d'herbe biseautées (propre et lisible, peu de détails)
  const k = 'toon2' + d.herbe1; if (cacheGfx[k]) return cacheGfx[k];
  const c1 = /^#[0-9a-f]{6}$/i.test(d.herbe1 || '') ? d.herbe1 : '#5fd14a', T = 64, N = T * 2, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  for (let i = 0; i < 4; i++) { const px = (i % 2) * T, py = Math.floor(i / 2) * T; x.fillStyle = i === 0 || i === 3 ? ombrer(c1, 0.08) : c1; x.fillRect(px, py, T, T);
    x.fillStyle = 'rgba(255,255,255,.13)'; x.fillRect(px, py, T, 3); x.fillRect(px, py, 3, T);          // biseau clair
    x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(px, py + T - 3, T, 3); x.fillRect(px + T - 3, py, 3, T); } // biseau sombre
  x.strokeStyle = ombrer(c1, -0.22); x.lineWidth = 2.5; x.lineCap = 'round';
  for (const [px, py] of [[20, 40], [96, 104], [84, 22]]) { x.beginPath(); x.moveTo(px - 5, py); x.lineTo(px - 7, py - 8); x.moveTo(px, py); x.lineTo(px, py - 11); x.moveTo(px + 5, py); x.lineTo(px + 7, py - 8); x.stroke(); } // quelques touffes
  return cacheGfx[k] = ctx.createPattern(c, 'repeat');
}

// ---------- ONOMATOPÉES EN JEU ----------
const ONO = { explosion: ['DOKAAN!', 'KABOOM!', 'BOOM!!'], entaille: ['ZASH!', 'SHLAK!'], etincelle: ['PAF!', 'TCHAK!', 'POK!'], foudre: ['BZZZT!', 'ZAAAP!'],
  glace: ['KRAAK!', 'CLING!'], poison: ['BLURP!', 'GLOUB!'], feu: ['FWOOSH!', 'BRAOOO!'], etoiles: ['PING!', 'TWINK!'], vortex: ['FWIIII!', 'WHOOSH!'],
  eclaboussure: ['SPLASH!', 'PLOUF!'], impact: ['BAM!!', 'DOOOM!', 'GADOOM!'] };
const COULEURS = ['#ffe14a', '#ff5ab4', '#5ff0ff', '#ff8a1f', '#b6ff4a'];
let onos = [], choc = 0, flash = 0;
function ono(txt, x, y, gros = 1, couleur) {
  if (onos.length > 5) onos.shift();
  onos.push({ txt, x: x + (Math.random() - 0.5) * 30, y: y - 20, vie: 1, gros, c: couleur || COULEURS[Math.floor(Math.random() * COULEURS.length)], rot: (Math.random() - 0.5) * 0.6, seed: Math.random() * 6 });
}
function onoEffet(type, x, y) { // onomatopée selon l'effet de l'arme
  const l = ONO[type]; if (!l) return;
  const fort = type === 'explosion' || type === 'impact' || type === 'foudre';
  if (fort || Math.random() < 0.55) ono(l[Math.floor(Math.random() * l.length)], x, y, fort ? 1.25 : 0.85);
  if (fort) { choc = Math.max(choc, 0.8); flash = Math.max(flash, 0.35); }
}
function dessinerOnos() { // onomatopées (repère du monde)
  viseeSuper();
  for (const o of onos) {
    const age = 1 - o.vie, k = elastique(Math.min(1, age * 4)), s = 26 * o.gros * (0.3 + 0.7 * k);
    ctx.globalAlpha = Math.min(1, o.vie * 2.5);
    const tr = o.vie > 0.75 ? (Math.random() - 0.5) * 3 : 0; // tremblement à l'impact
    ctx.save(); ctx.translate(o.x + tr, o.y - age * 18 + tr); ctx.rotate(o.rot);
    if (o.gros > 1.1) eclat(0, 0, s * 1.6, 11, 'rgba(255,255,255,.9)', o.seed, NOIR, 3);
    bd(o.txt, 0, 0, s, o.c, 0); ctx.restore();
    o.vie -= 0.022;
  }
  ctx.globalAlpha = 1; onos = onos.filter(o => o.vie > 0);
}
function chocManga() { // image "choc" : flash + lignes de concentration
  if (choc > 0.03 || flash > 0.03) {
    ecran();
    if (flash > 0.03) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); flash *= 0.7; }
    if (choc > 0.03) { lignesVitesse(W / 2, H / 2, Math.min(W, H) * 0.42, 38, Math.min(0.55, choc * 0.5)); choc *= 0.88; }
  }
}

// ---------- 🎬 INTRO DE MATCH : chaque combattant en grand, puis VS, puis 3-2-1 ----------
let intro = null;
const KV = () => Math.max(0.3, +((CONFIG.app || {}).vitesseJeu) || 0.85); // vitesse générale des persos (réglage Appli)
const KI = () => Math.max(0.4, +((CONFIG.app || {}).introVitesse) || 1); // durée de l'intro (réglage Appli)
const SHOW = 80, VS = 95, CD = 136, TIC = 32; // durées (images à 60/s)
function bossPourIntro() {
  const b = bosses.find(b => b.def && !b.def.cristal); if (b) return b.def;
  const id = (mode.typesBoss || []).find(id => CONFIG.bosses[id]); return CONFIG.bosses[id] || Object.values(CONFIG.bosses).find(b => !b.cristal) || { nom: 'BOSS' };
}
function preparerIntro() {
  if (intro) intro.vedettes.forEach(v => v.vue && v.vue.liberer());
  const tous = [moi, ...Object.values(autres)], amis = tous.filter(j => j.eq === moi.eq), ennemis = tous.filter(j => j.eq !== moi.eq);
  const fiche = (j, cote) => ({ p: baseDe(j.perso), im: carteDe(j.perso), nom: j.nom, sous: (baseDe(j.perso) || {}).nom || '', c: cote < 0 ? (j === moi ? '#1e90ff' : '#1fc46b') : '#ff2d55', cote, vue: null });
  const liste = [fiche(moi, -1), ...amis.filter(j => j !== moi).map(j => fiche(j, -1)), ...ennemis.map(j => fiche(j, 1))];
  if (mode.boss && mode.nbBoss > 0) { const d = bossBase(bossPourIntro()); liste.push({ p: d.modele ? d : null, im: carteDe(d), nom: d.nom || 'BOSS', sous: 'BOSS', c: '#ff8a00', cote: 1 }); }
  const G = liste.filter(v => v.cote < 0), D = liste.filter(v => v.cote > 0); // une apparition par équipe (tout le monde côte à côte)
  const vedettes = [G.length && { ...G[0], membres: G, cote: -1 }, D.length && { ...D[0], membres: D, cote: 1 }].filter(Boolean);
  intro = { cle: introT, vedettes, gauche: [...amis.map(j => fiche(j, -1))], droite: liste.filter(v => v.cote > 0) };
  intro.total = Math.round((vedettes.length * SHOW + VS + CD) * KI()); // même durée chez tous les joueurs (ne dépend que de la partie)
  vedettes.forEach(v => { if (v.membres.length === 1 && v.p && v.p.modele && ok3D()) Modele3D.vitrine(v.p).then(x => { if (intro && intro.vedettes.includes(v)) v.vue = x; else if (x) x.liberer(); }).catch(() => {}); });
}
const PHRASES = ['DOGOGOGO', 'ZUDOOON!!', 'BAKOOM!!', 'GOGOGO…'];
function introVedette(v, l, i) {
  const u = U(), e = sortir(l / 14), k = elastique(Math.min(1, l / 18)), fin = Math.max(0, (l - (SHOW - 10)) / 10), gauche = v.cote < 0;
  ctx.fillStyle = v.c; ctx.fillRect(-50, -50, W + 100, H + 100);
  rayons(W * (gauche ? 0.32 : 0.68), H * 0.55, temps * 0.01 * (gauche ? 1 : -1), '#ffffff', 0.2, 16);
  trame(0.12, '#000'); lignesHoriz(0.35, '#fff', gauche ? 1 : -1);
  // "ゴゴゴ" qui tremblent derrière
  ctx.save(); ctx.globalAlpha = 0.5; for (let n = 0; n < 4; n++) bd(PHRASES[0].slice(0, 2 + n % 3), W * (gauche ? 0.1 : 0.9) + (Math.random() - 0.5) * 4, H * (0.18 + n * 0.2), 40 * u, '#2a0d4a', -0.2, null); ctx.restore();
  // les persos de l'équipe en GRAND, côte à côte
  const mb = v.membres || [v], cx = W * (gauche ? 0.33 : 0.67) - v.cote * (1 - e) * W * 0.7, sc = (1.35 - 0.35 * k) * (mb.length > 1 ? 1 / (1 + (mb.length - 1) * 0.28) : 1);
  if (mb.length > 1) { const pas = Math.min(W * 0.26, W * 0.62 / mb.length);
    mb.forEach((m, n) => { const mx = cx + (n - (mb.length - 1) / 2) * pas, s2 = Math.min(H * 0.8, pas * 1.5) * (1.25 - 0.25 * k);
      if (pret(m.im)) ctx.drawImage(m.im, mx - s2 / 2, H * 0.92 - s2, s2, s2);
      ctx.save(); ctx.translate(mx, H * 0.95); rect(-pas * 0.44, -14 * u, pas * 0.88, 26 * u, 8 * u, NOIR); ctx.restore();
      texte(m.nom, mx, H * 0.95, 13 * u, '#fff', 'center', pas * 0.8); }); }
  ctx.save(); ctx.translate(cx, H); ctx.scale(sc, sc);
  if (mb.length > 1) { ctx.restore(); ctx.save(); ctx.translate(0, 0); } else
  if (v.vue) {
    const D = H * 1.02, T = Math.round(Math.min(520, D * Math.min(1.5, window.devicePixelRatio || 1))), anim = v.vue.a && v.vue.a('attaque') ? 'attaque' : 'repos';
    const c = v.vue.rendre(Math.PI / 2 + (gauche ? -0.45 : 0.45), T, (l / 90) % 1, anim), taille = D * 0.9 / Math.max(0.3, (v.vue.bas - v.vue.haut) || 0.7);
    ctx.drawImage(c, -taille / 2, -H * 0.02 - (v.vue.bas || 0.95) * taille, taille, taille);
  } else if (pret(v.im)) { const s = H * 0.82; ctx.drawImage(v.im, -s / 2, -s - H * 0.06, s, s); }
  ctx.restore();
  if (l > 11 && l < 15) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, W, H); } // flash d'impact
  if (l > 12) lignesVitesse(cx, H * 0.5, H * 0.45, 26, 0.25);
  // bande noire en diagonale avec le nom
  const nx = W * (gauche ? 0.7 : 0.3), bandeX = v.cote * (1 - sortir((l - 6) / 12)) * W;
  ctx.save(); ctx.translate(nx + bandeX, H * 0.62); ctx.rotate(-0.09);
  ctx.fillStyle = NOIR; ctx.fillRect(-W * 0.45, -44 * u, W * 0.9, 88 * u); ctx.fillStyle = '#ffe14a'; ctx.fillRect(-W * 0.45, -44 * u, W * 0.9, 5 * u); ctx.fillRect(-W * 0.45, 39 * u, W * 0.9, 5 * u);
  titre(v.nom, 0, 2 * u, 54 * u, '#fff', 'center', W * 0.42);
  ctx.restore();
  if (v.sous) { ctx.save(); ctx.translate(nx + bandeX * 1.3, H * 0.44); ctx.rotate(-0.09); eclat(0, 0, 42 * u, 9, '#ffe14a', i + 1, NOIR, 3 * u); ctx.restore(); titre(v.sous, nx + bandeX * 1.3, H * 0.44, 26 * u, '#ff2d55', 'center', 150 * u); }
  if (l > 14) { const kk = elastique(Math.min(1, (l - 14) / 16)); bd(PHRASES[1 + i % 3], nx + (Math.random() - 0.5) * 3, H * 0.84, 46 * u * kk, COULEURS[i % 5], 0.08 * v.cote); }
  if (fin > 0) { ctx.fillStyle = NOIR; ctx.beginPath(); const X = -W * 0.3 + fin * W * 1.6; ctx.moveTo(X - W * 0.4, 0); ctx.lineTo(X + W * 0.1, 0); ctx.lineTo(X - W * 0.1, H); ctx.lineTo(X - W * 0.6, H); ctx.fill(); }
}
function introVS(l) {
  const u = U(), e = sortir(l / 16), k = elastique(Math.min(1, (l - 8) / 22)), fin = Math.max(0, (l - (VS - 14)) / 14), dx = (1 - e) * W * 0.6 + fin * W * 0.6;
  const zig = (cote) => { ctx.beginPath(); ctx.moveTo(W / 2 + cote * W, -10); for (let i = 0; i <= 10; i++) ctx.lineTo(W / 2 + (i % 2 ? 22 : -22) * u + (i / 10 - 0.5) * -90 * u + cote * dx * 0.2, i * H / 10); ctx.lineTo(W / 2 + cote * W, H + 10); ctx.closePath(); };
  ctx.save(); zig(-1); ctx.fillStyle = '#1e7bff'; ctx.fill(); ctx.clip(); rayons(W * 0.25, H / 2, temps * 0.01, '#fff', 0.16); trame(0.12, '#000'); ctx.restore();
  ctx.save(); zig(1); ctx.fillStyle = '#ff2d55'; ctx.fill(); ctx.clip(); rayons(W * 0.75, H / 2, -temps * 0.01, '#fff', 0.16); trame(0.12, '#000'); ctx.restore();
  zig(1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 10 * u; ctx.stroke(); ctx.strokeStyle = NOIR; ctx.lineWidth = 4 * u; ctx.stroke(); // éclair central
  titre(mode.nom, W / 2, 34 * u, 30 * u, '#ffe14a', 'center', W - 40);
  const equipe = (l2, cote) => { // une case de BD inclinée par perso, qui arrive en rebondissant
    const n = l2.length, zw = W * 0.42, pw = Math.min(zw / Math.max(1, n), H * 0.46), ph = H * 0.6, x0 = W / 2 + cote * (W * 0.26 + dx) - (n * pw) / 2, y0 = H * 0.2;
    l2.forEach((c, i) => {
      const x = x0 + i * pw, sk = 16 * u, y = y0 + (i % 2) * 12 * u, t = elastique(Math.min(1, Math.max(0, (l - 6 - i * 5) / 18))), coul = /^#[0-9a-f]{6}$/i.test(c.c) ? c.c : '#5a4dff';
      const chemin = () => { ctx.beginPath(); ctx.moveTo(x + sk, y); ctx.lineTo(x + pw - 4 * u, y); ctx.lineTo(x + pw - 4 * u - sk, y + ph); ctx.lineTo(x, y + ph); ctx.closePath(); };
      ctx.save(); ctx.translate(x + pw / 2, y + ph / 2); ctx.scale(t, t); ctx.rotate(-0.04 * cote); ctx.translate(-x - pw / 2, -y - ph / 2);
      ctx.save(); ctx.translate(6 * u, 7 * u); chemin(); ctx.fillStyle = NOIR; ctx.fill(); ctx.restore();
      ctx.save(); chemin(); ctx.clip(); const g = ctx.createLinearGradient(0, y, 0, y + ph); g.addColorStop(0, ombrer(coul, 0.35)); g.addColorStop(1, ombrer(coul, -0.4)); ctx.fillStyle = g; ctx.fillRect(x - 5, y - 5, pw + 10, ph + 10);
      rayons(x + pw / 2, y + ph * 0.4, temps * 0.01 * cote, '#fff', 0.2, 12); trame(0.1, '#000');
      if (pret(c.im)) { const s = Math.max(pw * 1.3, ph * 1.0); ctx.drawImage(c.im, x + pw / 2 - s / 2, y + ph * 1.02 - s * 0.95 + Math.sin(temps * 0.08 + i) * 3 * u, s, s); }
      ctx.fillStyle = NOIR; ctx.fillRect(x - 5, y + ph - 34 * u, pw + 10, 34 * u); ctx.fillStyle = coul; ctx.fillRect(x - 5, y + ph - 34 * u, pw + 10, 4 * u); ctx.restore();
      chemin(); ctx.lineJoin = 'round'; ctx.lineWidth = 4 * u; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = NOIR; ctx.stroke();
      titre(c.nom, x + pw / 2 - 6 * u, y + ph - 16 * u, 16 * u, '#fff', 'center', pw - 24 * u);
      ctx.restore();
    });
  };
  equipe(intro.gauche, -1); if (intro.droite.length) equipe(intro.droite, 1);
  ctx.save(); ctx.translate(W / 2 + (Math.random() - 0.5) * 6 * (1 - k * 0.7), H / 2 + 12 * u); ctx.scale(k, k);
  eclat(0, 0, 62 * u, 12, '#ffe14a', 2, NOIR, 5 * u); bd('VS', 0, 4 * u, 78 * u, '#ff2d55', -0.08); ctx.restore();
  if (l > 30) bd('BAKOOOM!!', W / 2, H - 34 * u, 34 * u * elastique(Math.min(1, (l - 30) / 14)), '#fff', -0.05);
}
function introDecompte(l) {
  const u = U(), n = Math.floor(l / TIC), f = (l % TIC) / TIC, go = n >= 3, cx = W / 2, cy = H / 2;
  ctx.fillStyle = 'rgba(20,0,40,.28)'; ctx.fillRect(-50, -50, W + 100, H + 100);
  const k = elastique(Math.min(1, f * 2.2));
  if (!go) {
    lignesVitesse(cx, cy, 120 * u, 26, 0.3);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((n - 1) * 0.12);
    eclat(0, 0, 70 * u, 10, ['#ff2d55', '#ff8a1f', '#ffe14a'][n], n + 3, NOIR, 5 * u); bd(String(3 - n), 0, 6 * u, 96 * u, '#fff', 0, NOIR); ctx.restore();
    bd(['TIC!', 'TAC!', 'TOC!'][n], cx + 110 * u, cy - 70 * u, 26 * u * k, '#5ff0ff', 0.3);
  } else { // GO : une seule apparition jusqu'à la fin du décompte
    const fg = Math.min(1, (l - 3 * TIC) / (CD - 3 * TIC));
    const kg = elastique(Math.min(1, fg * 1.6));
    rayons(cx, cy, temps * 0.03, '#ffe14a', 0.35 * (1 - fg), 22); lignesVitesse(cx, cy, 90 * u, 44, 0.45 * (1 - fg));
    if (fg < 0.12) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - fg) * 3); ctx.translate(cx, cy); ctx.scale(kg * (1 + fg * 0.3), kg * (1 + fg * 0.3));
    bd('GO !!', 0, 0, 120 * u, '#b6ff4a', -0.08); ctx.restore();
  }
}
function dessinerIntro() {
  if (!intro || intro.cle !== introT) preparerIntro();
  const t = Math.round((temps - introT) / KI()), nV = intro.vedettes.length * SHOW;
  if (t < nV) introVedette(intro.vedettes[Math.floor(t / SHOW)], t % SHOW, Math.floor(t / SHOW));
  else if (t < nV + VS) introVS(t - nV);
  else introDecompte(t - nV - VS);
}
function pasDeJeu() { // ⏱ une étape de jeu = 1/60 s, quel que soit l'écran (60, 120 Hz…)
  if (etat === 'AUTH' || etat === 'MENU') { temps++;
    if (persoIndex !== persoSauve && user) { persoSauve = persoIndex; try { localStorage.setItem('bastoryPerso', persoIndex); } catch (e) {} if (db) db.collection('joueurs').doc(user.uid).set({ perso: persoIndex }, { merge: true }).catch(() => {}); } }
  else if (etat === 'ATTENTE') { temps++; rafraichirAttente(); }
  else if (etat === 'INTRO') { temps++; majEffets();
    if (intro && intro.cle === introT && temps - introT > intro.total) { etat = 'JEU'; debutJeu = temps; intro.vedettes.forEach(v => { if (v.vue) v.vue.liberer(); v.vue = null; }); ono('FIGHT!!', moi.x, moi.y - 60, 1.6, '#ffe14a'); } }
  else if (etat === 'JEU') maj();
  else temps++;
}
let horlogeJeu = 0, resteJeu = 0;
function boucle(ts) {
  const now = ts || performance.now(); if (!horlogeJeu) horlogeJeu = now;
  resteJeu += Math.min(120, now - horlogeJeu); horlogeJeu = now;
  let n = Math.floor(resteJeu / (1000 / 60)); resteJeu -= n * (1000 / 60);
  for (n = Math.min(n, 4); n > 0; n--) pasDeJeu();   // au plus 4 étapes d'un coup (écran lent)
  if (etat === 'AUTH' || etat === 'MENU') { if (typeof Rendu3D !== 'undefined') Rendu3D.cacher(); aff3 = null; zoneSure(dessinerMenu); }
  else if (etat === 'ATTENTE') zoneSure(dessinerAttente);
  else if (etat === 'INTRO') { dessinerJeu(); zoneSure(dessinerIntro); }
  else { dessinerJeu(); if (etat !== 'JEU') zoneSure(dessinerFin); }
  requestAnimationFrame(boucle);
}

// ---------- FIN DE PARTIE : YATTA ! / GAAAN… ----------
function finManga() { // YATTA ! / GAAAN…
  const u = U(), t = temps - (finInfo ? finInfo.t0 : temps), vic = etat === 'VICTOIRE';
  if (t < 12) return;
  const k = elastique(Math.min(1, (t - 12) / 20)), txt = vic ? 'YATTAAA!!' : etat === 'EGALITE' ? 'HEIN ?!' : 'GAAAN…';
  ctx.save(); ctx.translate(W * 0.13, H * 0.2); ctx.rotate(-0.18); ctx.scale(k, k); eclat(0, 0, 52 * u, 11, vic ? '#ffe14a' : '#9fb4ff', 4, NOIR, 4 * u); bd(txt, 0, 0, 30 * u, vic ? '#ff2d55' : '#fff'); ctx.restore();
  if (vic) { ctx.save(); ctx.translate(W * 0.87, H * 0.78); ctx.rotate(0.16); ctx.scale(k, k); bd('WAHAHA!', 0, 0, 30 * u, '#5ff0ff'); ctx.restore(); }
  else if (etat === 'DEFAITE') { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 5; i++) { const x = W * (0.8 + i * 0.03), y = ((t * 2 + i * 60) % (H * 0.6)) + H * 0.1; ctx.fillStyle = '#9fb4ff'; ctx.fillRect(x, y, 2 * u, 40 * u); } ctx.restore(); } // "traits de déprime"
}
function rect(x, y, w, h, r, fill, stroke, ep = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = ep; ctx.stroke(); }
}
function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); }


let decor3D = null;
const varDecor = (px, py) => Math.floor(alea(px * 0.37 + py * 0.11) * 3);
const couleurMur = (px, py) => { const v = alea(Math.floor(px / 192) * 7.3 + Math.floor(py / 192) * 13.1); return v < 0.45 ? 0 : 1 + Math.floor((v - 0.45) / 0.55 * 4); }; // même couleur par groupe de 3×3 cases
function mur(px, py) { if (decor3D) ctx.drawImage(decor3D.murs[(couleurMur(px, py) * 3 + varDecor(px, py)) % decor3D.murs.length], px - 2.94, py - HAUT_MUR - 5, 69.9, 101.9); else ctx.drawImage(spriteBloc(map.def, false), px - 2, py - HAUT_MUR - 2); }
const DUREE_ANIM = { attaque: 34, touche: 22, mort: 60, releve: 50 }; // durée des animations spéciales (images à 60/s)
function animSpeciale(e, sp) { // quelle animation spéciale jouer maintenant ?
  if (!sp.spec) return null;
  if (e.pv <= 0) { if (!e.mortT) e.mortT = temps; return sp.spec.lignes.mort ? { n: 'mort', t: e.mortT } : null; }
  e.mortT = 0;
  if (e.flash >= 7 && (!e.anim || e.anim.n !== 'touche' || temps - e.anim.t > 8) && (!e.anim || e.anim.n !== 'attaque')) e.anim = { n: 'touche', t: temps };
  if (e.anim && temps - e.anim.t < DUREE_ANIM[e.anim.n] && sp.spec.lignes[e.anim.n]) return e.anim;
  return null;
}
function dessiner3D(e, sp, anneau, taille) { // perso 3D : on choisit la vignette selon la direction et la pose de marche
  ombreDouce(e.x + e.r * 0.3, e.y + e.r * 0.5, e.r * 1.5, e.r * 0.72); // ombre portée (soleil en haut à gauche)
  ctx.strokeStyle = anneau; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * 1.05, e.r * 0.6, 0, 0, 7); ctx.stroke();
  const a = (((e.angle || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), d = Math.round(a / (Math.PI * 2) * sp.DIRS) % sp.DIRS;
  if (e.marche !== e.mPrec) { e.mPrec = e.marche; e.mT = temps; }
  const po = temps - (e.mT || -99) < 10 ? 1 + Math.floor((e.marche || 0) * 0.1) % sp.MARCHE : 0; // 0 = repos, 1.. = marche
  const k = (taille * 1.45) / (sp.bas - sp.haut) * ((e.def ? 1 : 26 / e.r) * (+(e.def ? bossBase(e.def) : baseDe(e.perso) || {}).modeleEchelle || 1)), s = sp.S * k, x = e.x - s / 2, y = e.y + e.r * 0.5 - sp.bas * k - (e.alt || 0); // pieds posés sur l'anneau (ou en vol)
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
  if (typeof Rendu3D !== 'undefined' && Rendu3D.gere(e)) { // modèle 3D animé en direct : ici on ne dessine que l'anneau d'équipe au sol
    ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = anneau; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.15, e.r * 1.15, 0, 0, 7); ctx.stroke(); ctx.restore(); auraElem(e); return; }
  e.alt = e.dep === 'vol' ? ((elemDe(e.perso) || {}).altitude || 22) + Math.sin(temps * 0.08 + e.x * 0.01) * 4 : 0; // 💨 altitude
  if (e.dash && e.dash.saut && temps < e.dash.fin) e.alt = Math.sin((1 - (e.dash.fin - temps) / e.dash.duree) * Math.PI) * 70; // hauteur du saut
  auraElem(e);
  if (e.def && !hote) { const d = Math.hypot(e.x - (e.px ?? e.x), e.y - (e.py ?? e.y)); if (d > 0.4) e.marche = (e.marche || 0) + d; e.px = e.x; e.py = e.y; } // boss distants : animation de marche
  if (aff3 && (e.def ? bossBase(e.def).modele : (baseDe(e.perso) || {}).modele)) return; // modèle 3D en cours de chargement : rien de lourd à générer
  const sp3 = e.def ? (bossBase(e.def).modele ? obtenir3D(bossBase(e.def)) : null) : e.perso && obtenir3D(e.perso); // persos ET boss en 3D
  if (sp3) return dessiner3D(e, sp3, anneau, taille);
  if (e.rage) ellipse(e.x, e.y + e.r * 0.45, e.r * 1.5, e.r * 0.9, `rgba(255,0,0,${0.15 + 0.1 * Math.sin(temps * 0.2)})`);
  ombreDouce(e.x + e.r * 0.3, e.y + e.r * 0.5, e.r * 1.5, e.r * 0.72); // ombre portée (soleil en haut à gauche)
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
  const a = p.arme, im = img(a.image), s = (a.taille || 16) * 2.8;
  if (a.forme === 'onde') return ondeMarteau(p);
  if (aff3) return; // en 3D : le projectile est un vrai objet 3D (trainée et ombre restent au sol)
  const k = 1 - p.z / 220;
  if (p.sombre) { ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = 25; ellipse(p.x, p.y - p.z - 10, s * 0.6, s * 0.6, 'rgba(30,0,45,.65)'); ctx.restore(); }
  ellipse(p.x, p.y + 6, s * 0.4 * k, s * 0.22 * k, 'rgba(0,0,0,.3)');
  ctx.save();
  ctx.translate(p.x, p.y - p.z - 10);
  ctx.rotate(p.type === 'droit' ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.rot);
  if (pret(im)) ctx.drawImage(im, -s / 2, -s / 2, s, s);
  else formeTir(p, s);
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
  dessinerOnos();
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

// ---------- 🌟 POUVOIRS D'ÉLÉMENT : bouton ACTION + SUPER propre à chaque perso ----------
const ELEM_DEF = { // noms et onomatopées par défaut (nom / charge / recharge réglables dans l'admin → Éléments)
  terre: { superNom: 'Séisme titan', actionNom: 'Charge', ono: 'DOGOOON!!' }, air: { superNom: 'Tempête de flèches', actionNom: 'Rafale', ono: 'FWOOOSH!!' },
  eau: { superNom: 'Raz-de-marée', actionNom: 'Bulle', ono: 'SPLAAASH!!' }, feu: { superNom: 'Souffle du dragon', actionNom: 'Brasier', ono: 'BRAOOOM!!' } };
const cleElem = p => (baseDe(p) || {}).element;
const elementsDe = p => { const b = baseDe(p) || {}; return [b.element, b.element2, b.element3, b.element4].filter((k, i, a) => ELEM_DEF[k] && a.indexOf(k) === i); }; // 1 à 4 éléments par perso
const infoElem = j => { const k = j && cleElem(j.perso); return ELEM_DEF[k] ? { k, ...ELEM_DEF[k], ...(elemDe(j.perso) || {}) } : null; };
const chargeSuper = j => +(infoElem(j) || {}).superCharge || Math.max(3000, (j.perso.degats || 1000) * 4);
function gagnerSuper(j, deg) {
  if (!j || !j.perso || j.superPret || !infoElem(j)) return;
  j.superC = (j.superC || 0) + deg;
  if (j.superC >= chargeSuper(j)) { j.superPret = true; if (j === moi) ono('SUPER PRÊT !', moi.x, moi.y - 70, 1.2, '#ffe14a'); }
}
function tirSpecial(j, arme, angle, force, deg) { const a = j.arme; j.arme = arme; creerProjectile(j, angle, force, j.x, j.y, deg); j.arme = a; }
const moiOuBot = j => j === moi || (j.bot && hote); // qui applique les effets sur ce perso
function lancerSuper(j, angle = j.angle, distant) {
  const e = infoElem(j); if (!e || j.pv <= 0 || resultat || (!distant && !j.superPret)) return;
  if (!distant) { j.superPret = false; j.superC = 0; envoyer({ t: 'su', de: j.uid, a: +angle.toFixed(3) }); }
  const deg = Math.round(j.perso.degats * bonus(j, 'degats')), A = j.arme;
  j.anim = { n: (baseDe(j.perso) || {}).animSuper || 'attaque', t: temps }; ono(e.ono, j.x, j.y - 60, 1.7, j.perso.couleur); choc = 1; flash = 0.4;
  const ks = elementsDe(j.perso), d2 = Math.round(deg * (ks.length > 1 ? 0.8 : 1)); if (ks.length > 1) ono('FUSION!!', j.x, j.y - 100, 1.6, '#ffe14a');
  ks.forEach(k => {
    if (k === 'terre') exploser({ x: j.x, y: j.y, de: j.uid, deg: Math.round(d2 * 1.6), perso: j.perso, arme: { effet: 'impact', rayon: 190, couleur: '#c98a4b', recul: 26 } });
    else if (k === 'air') for (let i = 0; i < 12; i++) tirSpecial(j, { ...A, rebonds: 3 }, angle + i * Math.PI / 6, 1, Math.round(d2 * 0.8));
    else if (k === 'eau') { for (let i = -3; i <= 3; i++) tirSpecial(j, { ...A, recul: 30 }, angle + i * 0.18, 1, d2); if (moiOuBot(j)) j.pv = Math.min(j.pvMax, j.pv + j.pvMax * 0.25); effet('eclaboussure', j.x, j.y, '#5ff0ff', 120); }
    else if (k === 'feu') for (let i = -2; i <= 2; i++) tirSpecial(j, { ...A, type: 'lob', nuage: 4, rayonNuage: 80 }, angle + i * 0.22, 0.6 + Math.abs(i) * 0.15, d2);
  });
}
function lancerAction(j, angle = j.angle, distant) {
  const e = infoElem(j); if (!e || j.pv <= 0 || resultat) return;
  if (!distant) { if ((j.actionT || 0) > temps) return; j.actionT = temps + (+e.actionRecharge || 7) * 60; envoyer({ t: 'ac', de: j.uid, a: +angle.toFixed(3) }); }
  j.anim = { n: (baseDe(j.perso) || {}).animAction || 'attaque', t: temps };
  const k = (baseDe(j.perso) || {}).action || e.k; // action propre au perso (sinon celle de son élément)
  if (k === 'tourbillon') { // 🌪️ tornade qui repousse tout autour
    effet('vortex', j.x, j.y, '#b6f0ff', 170); ondes.push({ x: j.x, y: j.y, r: 20, max: 190, c: '#b6f0ff', vie: 1, ep: 14 }); ono('FWOOSH!', j.x, j.y - 50, 1.2, '#5ff0ff');
    if (moiOuBot(j)) for (const c of [...bosses.filter(b => b.pv > 0 && !b.def.cristal), ...joueurs().filter(o => o.eq !== j.eq && o.pv > 0)]) { const d = Math.hypot(c.x - j.x, c.y - j.y); if (d < 190) degats(c, j.uid, Math.round(j.perso.degats * 0.35), j.x, j.y, Math.atan2(c.y - j.y, c.x - j.x), { recul: 40, effet: 'vortex' }); }
  } else if (k === 'gel') { // ❄️ souffle glacé : les ennemis proches sont ralentis
    effet('glace', j.x, j.y, '#9fe3ff', 150); ono('FRIIIZ!', j.x, j.y - 50, 1.2, '#5ff0ff');
    if (moiOuBot(j)) for (const c of joueurs().filter(o => o.eq !== j.eq && o.pv > 0 && Math.hypot(o.x - j.x, o.y - j.y) < 170)) degats(c, j.uid, Math.round(j.perso.degats * 0.25), j.x, j.y, 0, { ralenti: 0.45, effet: 'glace' });
  } else if (k === 'terre' || k === 'air') { // 🌍 charge qui brise tout • 💨 saut d'esquive par-dessus les murs
    j.dash = { a: angle, fin: temps + (k === 'terre' ? 22 : 26), duree: k === 'terre' ? 22 : 26, v: k === 'terre' ? 2.6 : 2.2, saut: k === 'air', touches: new Set() };
    if (k === 'air') j.invuln = temps + 26; ono(k === 'terre' ? 'DODODO!' : 'HOP!', j.x, j.y - 50, 1);
  } else if (k === 'eau') { j.bulle = temps + 180; if (moiOuBot(j)) j.pv = Math.min(j.pvMax, j.pv + j.pvMax * 0.1); ono('POP!', j.x, j.y - 50, 1, '#5ff0ff'); }
  else if (k === 'feu') { // 🔥 cercle de flammes qui brûle aussi les buissons
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; nuages.push({ x: j.x + Math.cos(a) * 70, y: j.y + Math.sin(a) * 70, r: 34, fin: temps + 180, debut: temps, c: '#ff6a00', deg: (+e.valeur || 120) * 2, de: j.uid, arme: { effet: 'etincelle', couleur: '#ff8a00' }, feu: true }); }
    if (!distant) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = Math.floor(j.x / TUILE) + dx, ty = Math.floor(j.y / TUILE) + dy; if (tuile(tx, ty) === 'B') abimer(tx, ty, 1e6); }
    ono('BRAAA!', j.x, j.y - 50, 1.1, '#ff8a1f');
  }
}
function dash(j) { // avance pendant la charge / la rafale ; la charge de Rokh blesse ce qu'elle percute
  if (!j.dash) return false;
  if (temps >= j.dash.fin) { const s = j.dash.saut; j.dash = null; if (s) liberer(); return false; } // atterrissage : jamais coincé dans un mur
  const v = j.perso.vitesse * KV() * j.dash.v, dx = Math.cos(j.dash.a) * v, dy = Math.sin(j.dash.a) * v;
  if (((baseDe(j.perso) || {}).action || cleElem(j.perso)) === 'terre') {
    const tx = Math.floor((j.x + Math.cos(j.dash.a) * j.r * 1.3) / TUILE), ty = Math.floor((j.y + Math.sin(j.dash.a) * j.r * 1.3) / TUILE);
    if (moiOuBot(j) && bloqueTir(tuile(tx, ty))) abimer(tx, ty, 900);
    for (const e of [...bosses.filter(b => b.pv > 0 && !b.def.cristal), ...joueurs().filter(o => o.eq !== j.eq && o.pv > 0)])
      if (!j.dash.touches.has(e) && Math.hypot(e.x - j.x, e.y - j.y) < j.r + (e.r || 26)) { j.dash.touches.add(e); effet('impact', e.x, e.y, '#c98a4b', 60); if (moiOuBot(j)) degats(e, j.uid, Math.round(j.perso.degats * 0.7), j.x, j.y, j.dash.a, { recul: 22 }); }
  }
  if (j.dash.saut) { const d0 = j.dep; j.dep = 'vol'; deplacer(j, dx, dy); j.dep = d0; } else deplacer(j, dx, dy);
  j.marche += v; tourner(j, j.dash.a, 0.5);
  return true;
}
let hudBoutons = [], hudDrag = null, hudPerso = { taille: 1 }; // 📱 place et taille des boutons (onglet Commandes)
try { Object.assign(hudPerso, JSON.parse(localStorage.getItem('bastoryHud') || '{}')); } catch (e) {}
function posHUD() {
  const u = U(), tact = mobile, k = hudPerso.taille || 1;
  return { T: { x: hudPerso.tx != null ? hudPerso.tx * W : W - 100 * u, y: hudPerso.ty != null ? hudPerso.ty * H : H - 100 * u, r: 52 * u * k }, S: { x: hudPerso.sx != null ? hudPerso.sx * W : W - (tact ? 205 : 150) * u, y: hudPerso.sy != null ? hudPerso.sy * H : H - (tact ? 180 : 100) * u, r: (tact ? 40 : 32) * u * k },
           A: { x: hudPerso.ax != null ? hudPerso.ax * W : W - (tact ? 222 : 66) * u, y: hudPerso.ay != null ? hudPerso.ay * H : H - (tact ? 60 : 100) * u, r: (tact ? 31 : 26) * u * k } };
}
function sauverHud() { try { localStorage.setItem('bastoryHud', JSON.stringify(hudPerso)); } catch (e) {} if (db && user) db.collection('joueurs').doc(user.uid).set({ hud: hudPerso }, { merge: true }).catch(() => {}); }
function prendreBoutonHud(q) { const P = posHUD(), x = q.x - sa.l, y = q.y - sa.t; hudDrag = ['S', 'A', 'T'].find(k => Math.hypot(x - P[k].x, y - P[k].y) < P[k].r * 1.3) || null; return !!hudDrag; }
function deplacerBoutonHud(q) { const x = Math.max(0.05, Math.min(0.97, (q.x - sa.l) / W)), y = Math.max(0.12, Math.min(0.95, (q.y - sa.t) / H)); const k = hudDrag.toLowerCase(); hudPerso[k + 'x'] = x; hudPerso[k + 'y'] = y; }
function menuHud() { // 📱 placer et redimensionner les boutons SUPER / ACTION
  const u = U(), top = barreHaut(mobile ? 'COMMANDES' : 'BOUTONS', true), { S, A, T } = posHUD(), e = infoElem({ perso: CONFIG.persos[persoIndex] }) || { k: 'feu', couleur: '#ff6a00', actionNom: 'Action' };
  titre('Glisse les boutons où tu veux', W / 2, top + 20 * u, 20 * u, '#fff', 'center', W - 40 * u);
  ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(120 * u, H - 110 * u, 55 * u, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); texte('Joystick', 120 * u, H - 110 * u, 12 * u, '#fff');
  for (const [b, c1, c2, nom] of [[T, '#ff8c6e', '#c81e3c', 'ATTAQUE'], [S, '#fff3a0', '#ff8a1f', 'SUPER'], [A, ombrer(e.couleur || '#ff6a00', 0.4), ombrer(e.couleur || '#ff6a00', -0.35), e.actionNom]]) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.4, 1, b.x, b.y, b.r); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 4 * u; ctx.strokeStyle = hudDrag && b === ({ S, A, T })[hudDrag] ? '#ffe14a' : NOIR; ctx.stroke(); titre(nom, b.x, b.y, 12 * u, '#fff', 'center', b.r * 1.8); }
  const by = H - 52 * u, bx = W / 2 - 190 * u;
  bouton3D(bx, by, 60 * u, 40 * u, '#8e7bff', '#5b3fd6', () => { hudPerso.taille = Math.max(0.7, +(hudPerso.taille - 0.1).toFixed(1)); sauverHud(); }); titre('−', bx + 30 * u, by + 19 * u, 24 * u, '#fff');
  titre('Taille ' + Math.round(hudPerso.taille * 100) + '%', bx + 130 * u, by + 19 * u, 16 * u, '#fff');
  bouton3D(bx + 200 * u, by, 60 * u, 40 * u, '#8e7bff', '#5b3fd6', () => { hudPerso.taille = Math.min(1.6, +(hudPerso.taille + 0.1).toFixed(1)); sauverHud(); }); titre('+', bx + 230 * u, by + 19 * u, 24 * u, '#fff');
  bouton3D(bx + 280 * u, by, 110 * u, 40 * u, '#ffd23f', '#ff8a1f', () => { hudPerso = { taille: 1 }; sauverHud(); }); titre('Par défaut', bx + 335 * u, by + 19 * u, 15 * u, '#fff');
  if (mobile) { bouton3D(bx + 400 * u, by, 110 * u, 40 * u, '#b6ff4a', '#1fc46b', () => { vueMode = ({ '3d': '25', '25': '2d', '2d': '3d' })[vueMode]; vue25 = vueMode === '25'; try { localStorage.setItem('bastoryVue', vueMode); } catch (e) {} }); titre('Vue ' + NOM_VUE[vueMode], bx + 455 * u, by + 19 * u, 15 * u, '#fff'); }
}
const boutonHUD = q => hudBoutons.find(b => Math.hypot(q.x - sa.l - b.x, q.y - sa.t - b.y) < b.r * 1.3);
function hudElem() { // 🎮 boutons ronds façon arcade : SUPER (anneau de charge) + ACTION (recharge)
  hudBoutons = []; hudObjectif();
  const e = infoElem(moi); if (!e || moi.pv <= 0 || etat !== 'JEU') return;
  const u = U(), tact = true, { S, A, T } = posHUD();
  if (!mobile) { texte(libTouche(mesTouches.action) + ' : ' + e.actionNom + '  •  ' + libTouche(mesTouches.super) + ' : ' + e.superNom, W / 2, H - 36, 12, '#ffe14a'); return; }
  const rond = (b, c1, c2, halo) => { // ombre portée, dégradé bombé, contour épais, reflet
    ctx.beginPath(); ctx.arc(b.x, b.y + 5 * u, b.r, 0, 7); ctx.fillStyle = 'rgba(11,6,32,.55)'; ctx.fill();
    if (halo) { ctx.save(); ctx.globalAlpha = 0.45 + 0.3 * Math.sin(temps * 0.2); ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.4, 0, 7); ctx.fillStyle = halo; ctx.fill(); ctx.restore(); }
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = NOIR; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 5 * u, 0, 7); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.45, b.r * 0.45, b.r * 0.2, -0.4, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
  };
  const k = Math.min(1, (moi.superC || 0) / chargeSuper(moi)), ok = moi.superPret, ec = e.couleur || '#5ac8fa';
  rond(S, ok ? '#fff3a0' : '#3a2d9c', ok ? '#ff8a1f' : '#140c3a', ok ? 'rgba(255,225,74,.55)' : null);
  if (ok) { ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(temps * 0.03); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(S.r + 7 * u, 0); ctx.lineTo(S.r + 15 * u, 0); ctx.stroke(); } ctx.restore(); }
  else { ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 3 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 6 * u; ctx.lineCap = 'round'; ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = ok ? 1 : 0.5; iconeElement(e.k, S.x, S.y, S.r * 1.05); ctx.restore();
  hudBoutons.push({ ...S, vise: true, f: () => lancerSuper(moi, angleAuto()) });
  const reste = Math.max(0, (moi.actionT || 0) - temps), tot = (+e.actionRecharge || 7) * 60;
  rond(A, ombrer(ec, 0.4), ombrer(ec, -0.35));
  icone('eclair', A.x, A.y, A.r * 0.95, '#fff');
  if (reste) { ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, A.r - 2 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reste / tot); ctx.closePath(); ctx.fillStyle = 'rgba(11,6,32,.7)'; ctx.fill(); titre(Math.ceil(reste / 60), A.x, A.y, 20 * u, '#fff'); }
  hudBoutons.push({ ...A, f: () => lancerAction(moi) });
  if (!joyD.actif) { // 🎯 bouton d'attaque principale (le joystick d'attaque part de son centre)
    ctx.beginPath(); ctx.arc(T.x, T.y + 5 * u, T.r, 0, 7); ctx.fillStyle = 'rgba(11,6,32,.45)'; ctx.fill();
    const g = ctx.createRadialGradient(T.x - T.r * 0.3, T.y - T.r * 0.4, 2, T.x, T.y, T.r); g.addColorStop(0, 'rgba(255,140,110,.9)'); g.addColorStop(1, 'rgba(200,30,60,.75)');
    ctx.beginPath(); ctx.arc(T.x, T.y, T.r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = NOIR; ctx.stroke();
    ctx.beginPath(); ctx.arc(T.x, T.y, T.r - 6 * u, 0, 7); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
    icone('cible', T.x, T.y, T.r * 0.9, '#fff');
  }
}
function auraElem(e) { // au sol : super prêt, vol de Zéphyr, traînée de charge
  if (e.superPret) { ctx.save(); ctx.globalAlpha = 0.55 + 0.3 * Math.sin(temps * 0.25); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * 1.4, e.r * 0.75, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  if (e.dep === 'vol') { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = temps * 0.12 + i * 2.1; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * (0.8 + i * 0.22), e.r * (0.4 + i * 0.11), 0, a, a + 1.5); ctx.stroke(); } ctx.restore(); }
  if (e.dash && temps < e.dash.fin) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const o = (i - 2.5) * 9, bx = e.x - Math.cos(e.dash.a) * (e.r + 10) - Math.sin(e.dash.a) * o, by = e.y - 20 - Math.sin(e.dash.a) * (e.r + 10) + Math.cos(e.dash.a) * o;
      ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(e.dash.a) * (30 + i % 3 * 14), by - Math.sin(e.dash.a) * (30 + i % 3 * 14)); ctx.stroke(); } ctx.restore(); }
}
function bullesElem() { // 🫧 bulle protectrice de Naïa (par-dessus le perso)
  for (const j of joueurs()) if (j.bulle > temps && j.pv > 0) {
    const r = j.r * 1.55 * (1 + Math.sin(temps * 0.15) * 0.03), y = j.y - j.r * 0.7;
    ctx.save(); ctx.globalAlpha = Math.min(1, (j.bulle - temps) / 30); ctx.beginPath(); ctx.arc(j.x, y, r, 0, 7); ctx.fillStyle = 'rgba(95,240,255,.18)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = NOIR; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(j.x - r * 0.4, y - r * 0.45, r * 0.12, 0, 7); ctx.fill(); ctx.restore();
  }
}

// ---------- 🏴‍☠️ CHASSE AU TRÉSOR & 🏃 MARATHON (plusieurs objectifs à la suite) ----------
let tresors = [], scoreTresor = {}, etape = 0, scoreEtapes = {}, bandeauEtape = null, graine = 1;
const etapesDe = m => String(m.etapes || 'bloc,zone').split(',').map(s => s.trim()).filter(s => ['bloc', 'zone', 'tresor'].includes(s));
const obj = () => mode.objectif === 'marathon' ? (etapesDe(mode)[etape] || 'zone') : mode.objectif;
const NOM_OBJ = { bloc: 'Guerre des cristaux', zone: 'Zone de contrôle', tresor: 'Chasse au trésor', standard: 'Élimination' };
let cristauxCasses = []; // { p: équipe du cristal (-2 = neutre), eq: équipe qui l'a cassé }
function cristalCasse(p, eq, distant) {
  cristauxCasses.push({ p, eq }); if (!distant) envoyer({ t: 'cr', p, eq });
  if (eq === moi.eq) ono(p === -2 ? 'CRISTAL CONQUIS!' : 'CRISTAL BRISÉ!!', moi.x, moi.y - 80, 1.4, '#ffe14a');
}
const scoreNeutres = () => { const s = {}; cristauxCasses.filter(c => c.p === -2 && c.eq != null).forEach(c => s[c.eq] = (s[c.eq] || 0) + 1); return s; };
const nbNeutres = () => { const eqs = new Set(joueurs().map(j => j.eq)); return map.tn.length + map.tc.filter(t => !eqs.has(t.eq)).length + (eqs.size > 1 && !map.t.length && !map.tc.length && !map.tn.length ? 1 : 0); };
function placerCristaux() { // T = équipe la plus proche • 5-8 = cristal de l'équipe 1-4 • N = neutre
  const tous = joueurs(), eqs = new Set(tous.map(j => j.eq)), pvp = eqs.size > 1, c = t => (t + 0.5) * TUILE, pos = j => j.spawn || j;
  const ajouter = (x, y, eq) => { const b = creerBoss('bloc', x, y, bosses.length); b.eq = eq; bosses.push(b); };
  map.tc.forEach(t => ajouter(c(t.x), c(t.y), eqs.has(t.eq) ? t.eq : -2)); // équipe absente de la partie → cristal neutre
  map.tn.forEach(t => ajouter(c(t.x), c(t.y), -2));
  map.t.forEach(t => { const x = c(t.x), y = c(t.y); ajouter(x, y, pvp ? tous.reduce((a, j) => Math.hypot(pos(j).x - x, pos(j).y - y) < Math.hypot(pos(a).x - x, pos(a).y - y) ? j : a).eq : -1); });
  if (!map.t.length && !map.tc.length && !map.tn.length) { const p = caseLibre(tous); ajouter(p.x, p.y, pvp ? -2 : -1); }
}
function placerTresors(g) { // cachettes de la map d'abord, complétées au hasard pour atteindre le nombre voulu (même tirage chez tous)
  tresors = []; scoreTresor = {}; joueurs().forEach(j => j.tresors = 0);
  const cach = map.o.map(c => ({ ...c })), libres = [];
  map.g.forEach((r, y) => [...r].forEach((c, x) => { if ((c === '.' || c === 'B' || c === 'S') && !map.o.some(o => o.x === x && o.y === y)) libres.push({ x, y }); }));
  for (let i = 0, n = +mode.nbTresors || 14; i < n; i++) { const l = cach.length ? cach : libres; if (!l.length) break;
    const c = l.splice(Math.floor(alea(g + i * 7.31) * l.length), 1)[0]; tresors.push({ id: 't' + i, x: (c.x + 0.5) * TUILE, y: (c.y + 0.5) * TUILE, pris: null }); }
}
function lacherTresors(e, n, distant, x, y, id0) { // 💰 un joueur éliminé lâche ses trésors : les autres peuvent les ramasser
  n = n || (e && e.tresors) || 0; if (!n || !e) return; x = x ?? e.x; y = y ?? e.y; id0 = id0 || e.uid + '_' + temps;
  if (!distant) envoyer({ t: 'lt', u: e.uid, n, x: Math.round(x), y: Math.round(y), id0 });
  e.tresors = 0; scoreTresor[e.eq] = Math.max(0, (scoreTresor[e.eq] || 0) - n);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = x + Math.cos(a) * 45, py = y + Math.sin(a) * 45, ok = !bloqueTir(tuileA(px, py)) && tuileA(px, py) !== 'W';
    tresors.push({ id: id0 + '_' + i, x: ok ? px : x, y: ok ? py : y, pris: null, lache: true }); }
  ono('PLOP!', x, y - 30, 1.1, '#ffd23f');
}
function preparerObjectif() { // met en place l'objectif en cours (cristaux, zone, trésors)
  zoneProg = {}; zoneControle = null; cristauxCasses = [];
  if (hote) { bosses = bosses.filter(b => !b.def.cristal); if (obj() === 'bloc') placerCristaux(); }
  if (obj() === 'tresor') placerTresors(graine + etape * 101);
}
function prendreTresor(id, eq, distant, uid) {
  const t = tresors.find(t => t.id === id); if (!t || t.pris !== null) return;
  t.pris = eq; scoreTresor[eq] = (scoreTresor[eq] || 0) + 1; const pj = entite(uid); if (pj) pj.tresors = (pj.tresors || 0) + 1;
  effet('etoiles', t.x, t.y, '#ffd23f', 70); ono(eq === moi.eq ? 'KACHING!' : 'OH NON!', t.x, t.y - 20, 1.1, eq === moi.eq ? '#ffe14a' : '#ff5a6e');
  if (!distant) envoyer({ t: 'tr', i: id, eq, u: uid });
}
function majTresors() {
  if (obj() !== 'tresor') return;
  for (const j of joueurs()) if (moiOuBot(j) && j.pv > 0) tresors.forEach(t => { if (t.pris === null && Math.hypot(t.x - j.x, t.y - j.y) < 40) prendreTresor(t.id, j.eq, false, j.uid); });
}
function dessinerTresors() { // cachés : on ne les voit qu'en s'approchant (quelques scintillements trahissent leur cachette)
  if (obj() !== 'tresor') return;
  for (const [i, t] of tresors.entries()) {
    if (t.pris !== null) continue;
    const d = Math.hypot(t.x - moi.x, t.y - moi.y), vis = t.lache ? 1 : Math.max(0, Math.min(1, (230 - d) / 80)), f = (temps + i * 37) % 140;
    if (vis <= 0) { if (f < 16) { ctx.save(); ctx.globalAlpha = 1 - f / 16; ctx.fillStyle = '#fff'; ctx.translate(t.x, t.y - 10); ctx.rotate(f * 0.1); ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 2 : 8; ctx.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); } ctx.fill(); ctx.restore(); } continue; }
    const b = Math.sin(temps * 0.1 + i) * 3; ctx.save(); ctx.globalAlpha = vis; ctx.translate(t.x, t.y - 8 + b);
    ellipse(0, 18 - b, 20, 7, 'rgba(0,0,0,.3)'); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = NOIR;
    ctx.fillStyle = '#b8742f'; ctx.beginPath(); ctx.roundRect(-18, -4, 36, 22, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d58f44'; ctx.beginPath(); ctx.roundRect(-18, -16, 36, 14, [8, 8, 2, 2]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -16, 8, 34); ctx.strokeRect(-4, -16, 8, 34); ctx.beginPath(); ctx.arc(0, -2, 4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = vis * (0.35 + 0.25 * Math.sin(temps * 0.2)); ellipse(0, -6, 30, 22, '#ffd23f'); ctx.restore();
  }
}
function gagnerObjectif(eq, msgV, msgD) { // objectif rempli : fin du match, ou étape suivante du marathon (décidée par l'hôte)
  if (mode.objectif !== 'marathon') return finir(eq === moi.eq ? 'VICTOIRE' : 'DEFAITE', eq === moi.eq ? msgV : msgD);
  if (hote) etapeSuivante(etape + 1, eq);
}
function etapeSuivante(n, eq, distant) {
  if (n <= etape) return;
  if (!distant) envoyer({ t: 'et', n, eq });
  scoreEtapes[eq] = (scoreEtapes[eq] || 0) + 1; etape = n;
  if (etape >= etapesDe(mode).length) { const mien = scoreEtapes[moi.eq] || 0, leur = Math.max(0, ...Object.entries(scoreEtapes).filter(([k]) => +k !== moi.eq).map(([, v]) => v));
    return finir(mien > leur ? 'VICTOIRE' : mien < leur ? 'DEFAITE' : 'EGALITE', `Marathon ${mien} - ${leur}`); }
  preparerObjectif(); bandeauEtape = { t: temps, txt: 'ÉTAPE ' + (etape + 1) + ' : ' + NOM_OBJ[obj()], nous: eq === moi.eq }; choc = 1; flash = 0.5;
}
function hudObjectif() { // compteurs trésors / étapes + bandeau d'étape animé
  const u = U();
  if (obj() === 'tresor') { const eqs = [...new Set(joueurs().map(j => j.eq))], but = +mode.objectifTresors || 7;
    eqs.forEach((eq, i) => { const y = 84 * u + i * 24 * u; verre(W - 190 * u, y, 178 * u, 20 * u, 10 * u);
      rect(W - 188 * u, y + 2 * u, 174 * u * Math.min(1, (scoreTresor[eq] || 0) / but), 16 * u, 8 * u, eq === moi.eq ? '#ffd23f' : '#ff5a6e');
      texte((eq === moi.eq ? '💰 Nous ' : '💰 Eux ') + (scoreTresor[eq] || 0) + ' / ' + but, W - 101 * u, y + 10 * u, 11 * u, '#fff'); }); }
  if (obj() === 'bloc' && nbNeutres()) { const sc = scoreNeutres(), eqs = [...new Set(joueurs().map(j => j.eq))];
    eqs.forEach((eq, i) => { const y = 84 * u + i * 24 * u; verre(W - 190 * u, y, 178 * u, 20 * u, 10 * u); texte((eq === moi.eq ? '💎 Nous ' : '💎 Équipe ' + (eq + 1) + ' ') + (sc[eq] || 0) + ' / ' + nbNeutres(), W - 101 * u, y + 10 * u, 11 * u, eq === moi.eq ? '#5ff0ff' : '#fff'); }); }
  if (mode.objectif === 'marathon') { const l = etapesDe(mode), mien = scoreEtapes[moi.eq] || 0, leur = Math.max(0, ...Object.entries(scoreEtapes).filter(([k]) => +k !== moi.eq).map(([, v]) => v));
    verre(W / 2 - 120 * u, 44 * u, 240 * u, 26 * u, 13 * u); titre(`Étape ${Math.min(etape + 1, l.length)}/${l.length} • ${NOM_OBJ[obj()]}  ${mien}-${leur}`, W / 2, 57 * u, 14 * u, '#ffe14a', 'center', 230 * u); }
  if (bandeauEtape && temps - bandeauEtape.t < 150) { const t = temps - bandeauEtape.t, e = elastique(Math.min(1, t / 20)), s = Math.max(0, (t - 120) / 30);
    ctx.save(); ctx.globalAlpha = 1 - s; ctx.translate(W / 2 + s * W, H * 0.4); ctx.rotate(-0.06);
    ctx.fillStyle = NOIR; ctx.fillRect(-W, -40 * u, W * 2, 80 * u); ctx.fillStyle = '#ffe14a'; ctx.fillRect(-W, -40 * u, W * 2, 5 * u); ctx.fillRect(-W, 35 * u, W * 2, 5 * u);
    ctx.scale(e, e); titre(bandeauEtape.txt, 0, 0, 34 * u, '#fff', 'center', W * 0.8); ctx.restore();
    if (t > 8 && t < 120) bd(bandeauEtape.nous ? 'ÉTAPE GAGNÉE!!' : 'ÉTAPE PERDUE…', W / 2, H * 0.4 + 62 * u, 26 * u * elastique(Math.min(1, (t - 8) / 16)), bandeauEtape.nous ? '#b6ff4a' : '#ff5a6e', 0.04); }
}

// ---------- 🏖️ SABLE & CONTOURS ENCRÉS DE LA MAP ----------
function dessinerSable(x, y, px, py) {
  const T = TUILE, c = (map.def.sable && /^#[0-9a-f]{6}$/i.test(map.def.sable)) ? map.def.sable : '#f4d68e', v = t => tuile(x + t[0], y + t[1]) === 'S';
  ctx.fillStyle = (x + y) % 2 ? c : ombrer(c, 0.05); ctx.fillRect(px, py, T, T);
  ctx.strokeStyle = ombrer(c, -0.2); ctx.lineWidth = 2; ctx.lineCap = 'round'; // vaguelettes de sable
  for (let k = 0; k < 2; k++) { const ox = px + 10 + alea(x * 5 + y * 3 + k) * 34, oy = py + 16 + k * 26 + alea(x + y * 11 + k) * 6; ctx.beginPath(); ctx.arc(ox, oy, 9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  ctx.fillStyle = ombrer(c, -0.28); for (let k = 0; k < 4; k++) ctx.fillRect(px + alea(x * 13 + y * 7 + k) * 60, py + alea(x * 3 + y * 17 + k) * 60, 3, 3);
  ctx.strokeStyle = 'rgba(11,6,32,.35)'; ctx.lineWidth = 3; ctx.beginPath();
  if (!v([0, -1])) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); } if (!v([0, 1])) { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
  if (!v([-1, 0])) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); } if (!v([1, 0])) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); } ctx.stroke();
}
function encreEau(x, y, px, py) { // contour d'encre au bord de l'eau : lisible et "manga"
  const T = TUILE, e = (a, b) => tuile(x + a, y + b) !== 'W';
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; // reflets qui ondulent
  for (let k = 0; k < 2; k++) { const ox = px + ((temps * 0.4 + alea(x * 7 + y * 3 + k) * 64) % 54) + 5, oy = py + 18 + k * 26; ctx.beginPath(); ctx.moveTo(ox - 8, oy); ctx.quadraticCurveTo(ox, oy - 5, ox + 8, oy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(11,6,32,.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
  if (e(0, -1)) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); } if (e(0, 1)) { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
  if (e(-1, 0)) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); } if (e(1, 0)) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); } ctx.stroke();
}

// ---------- 🎨 ICÔNES D'ÉLÉMENTS dessinées (remplacent les emojis 🌍💨💧🔥) ----------
function iconeElement(k, x, y, s) {
  const el = (CONFIG.elements || {})[k] || {}, c = el.couleur || '#888', r = s * 0.55;
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(s * 0.05, s * 0.08, r, 0, 7); ctx.fillStyle = NOIR; ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, ombrer(c, 0.35)); g.addColorStop(1, ombrer(c, -0.25));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.strokeStyle = NOIR; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = NOIR; ctx.lineWidth = Math.max(1.2, s * 0.06); const q = s * 0.3;
  ctx.beginPath();
  if (k === 'terre') { ctx.moveTo(-q * 1.2, q * 0.8); ctx.lineTo(-q * 0.4, -q * 0.6); ctx.lineTo(0, -q * 0.1); ctx.lineTo(q * 0.4, -q); ctx.lineTo(q * 1.2, q * 0.8); ctx.closePath(); ctx.fillStyle = '#e8d2b0'; ctx.fill(); ctx.stroke(); }
  else if (k === 'eau') { ctx.moveTo(0, -q * 1.15); ctx.bezierCurveTo(q * 0.9, -q * 0.1, q * 0.9, q * 0.95, 0, q * 0.95); ctx.bezierCurveTo(-q * 0.9, q * 0.95, -q * 0.9, -q * 0.1, 0, -q * 1.15); ctx.fill(); ctx.stroke(); }
  else if (k === 'feu') { ctx.moveTo(0, -q * 1.2); ctx.bezierCurveTo(q * 0.4, -q * 0.5, q * 1.1, 0, q * 0.6, q * 0.9); ctx.quadraticCurveTo(0, q * 1.2, -q * 0.6, q * 0.9); ctx.bezierCurveTo(-q, q * 0.2, -q * 0.3, -q * 0.2, 0, -q * 1.2); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.stroke(); }
  else if (k === 'air') { ctx.lineWidth = Math.max(2, s * 0.1); ctx.strokeStyle = '#fff';
    ctx.moveTo(-q, -q * 0.4); ctx.lineTo(q * 0.5, -q * 0.4); ctx.arc(q * 0.5, -q * 0.75, q * 0.35, Math.PI / 2, -Math.PI * 0.6, true);
    ctx.moveTo(-q, q * 0.3); ctx.lineTo(q * 0.8, q * 0.3); ctx.arc(q * 0.8, q * 0.65, q * 0.35, -Math.PI / 2, Math.PI * 0.6); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.3, r * 0.15, -0.6, 0, 7); ctx.fill();
  ctx.restore();
}

// ---------- 🎞️ PROJECTILES DESSINÉS (contour noir, forme selon l'arme) ----------
function formeTir(p, s) {
  const a = p.arme, f = a.forme, c = p.sombre ? '#6a00a8' : a.couleur || '#fff';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = NOIR; ctx.lineWidth = 3;
  if (f === 'fleche') { ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.22, -s * 0.3); ctx.lineTo(s * 0.07, -s * 0.3); ctx.lineTo(s * 0.07, s * 0.55); ctx.lineTo(-s * 0.07, s * 0.55); ctx.lineTo(-s * 0.07, -s * 0.3); ctx.lineTo(-s * 0.22, -s * 0.3); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.quadraticCurveTo(k * s * 0.4, s * 0.6, k * s * 0.3, s * 0.95); ctx.stroke(); } }
  else if (f === 'rocher') { ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = i / 7 * Math.PI * 2, r = s * (0.36 + alea(i * 3.7) * 0.12); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fillStyle = '#9b7a55'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.12, s * 0.1, 0, 7); ctx.fill(); }
  else if (f === 'bulle') { const r = s * 0.36 * (1 + Math.sin(temps * 0.3) * 0.06); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = 'rgba(90,200,255,.6)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, 7); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, 7); ctx.fill(); }
  else if (f === 'feu') { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, s * (0.42 - i * 0.12) * (1 + Math.sin(temps * 0.5 + i) * 0.08), 0, 7); ctx.fillStyle = ['#ff3b00', '#ffb000', '#fff3b0'][i]; ctx.fill(); if (!i) ctx.stroke(); } }
  else { ctx.beginPath(); ctx.arc(0, 0, s / 3, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.stroke(); }
}

// ---------- 📖 ÉCRAN PERSOS : cases de BD ----------
function caseBD(p, x, y, w, h, vue, choisi, k) {
  const u = U(), el = elemDe(p), c = (el && el.couleur) || p.couleur || '#5a4dff', sk = (k % 2 ? 1 : -1) * 6 * u, pop = vue ? 1.04 : 1;
  const chemin = () => { ctx.beginPath(); ctx.moveTo(x + Math.max(0, sk), y); ctx.lineTo(x + w, y + (k % 3 ? 4 * u : 0)); ctx.lineTo(x + w - Math.max(0, -sk), y + h); ctx.lineTo(x, y + h - (k % 2 ? 5 * u : 0)); ctx.closePath(); };
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-x - w / 2, -y - h / 2);
  ctx.save(); ctx.translate(5 * u, 6 * u); chemin(); ctx.fillStyle = NOIR; ctx.fill(); ctx.restore();
  ctx.save(); chemin(); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, ombrer(c, 0.35)); g.addColorStop(1, ombrer(c, -0.4)); ctx.fillStyle = g; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  rayons(x + w / 2, y + h * 0.45, temps * 0.004 * (k % 2 ? 1 : -1), '#fff', vue ? 0.3 : 0.14, 14); trame(0.1, '#000');
  const im = carteDe(p); if (pret(im)) { const s = Math.min(w * 1.1, h * 0.98); ctx.drawImage(im, x + w / 2 - s / 2, y + h * 0.93 - s + Math.sin(temps * 0.05 + k) * 2 * u, s, s); }
  ctx.fillStyle = NOIR; ctx.fillRect(x - 5, y + h - 30 * u, w + 10, 30 * u); ctx.fillStyle = c; ctx.fillRect(x - 5, y + h - 30 * u, w + 10, 3 * u);
  ctx.restore();
  chemin(); ctx.lineJoin = 'round'; ctx.lineWidth = (vue ? 5 : 3.5) * u; ctx.strokeStyle = vue ? '#ffe14a' : NOIR; ctx.stroke(); if (vue) { ctx.lineWidth = 1.5 * u; ctx.strokeStyle = NOIR; ctx.stroke(); }
  titre(p.nom, x + w / 2, y + h - 15 * u, 18 * u, '#fff', 'center', w - 14 * u);
  if (ELEM_DEF[cleElem(p)]) iconeElement(cleElem(p), x + 19 * u, y + 19 * u, 22 * u);
  texte('Niv.' + niveauDe(p), x + w - 24 * u, y + 17 * u, 11 * u, '#ffe14a');
  if (choisi) { ctx.save(); ctx.translate(x + w - 20 * u, y + h - 46 * u); ctx.rotate(0.2); eclat(0, 0, 14 * u, 8, '#b6ff4a', 1, NOIR, 2 * u); ctx.restore(); texte('✔', x + w - 20 * u, y + h - 46 * u, 12 * u, '#fff'); }
  ctx.restore();
}

// ---------- 🗺️ APERÇU DES MAPS façon manga ----------
function miniMap(def) {
  def = styliser(def); const cle = 'bd' + def.nom + def.theme + def.grille.join('|'); if (cacheMini[cle]) return cacheMini[cle];
  const g = def.grille, T = 12, L = Math.max(...g.map(r => r.length)), c = document.createElement('canvas'); c.width = L * T; c.height = g.length * T;
  const x = c.getContext('2d'), hx = h => /^#[0-9a-f]{6}$/i.test(h || ''), h1 = hx(def.herbe1) ? def.herbe1 : '#5cc24a', mur = hx(def.mur) ? def.mur : '#c98a4b', eau = hx(def.eau) ? def.eau : '#3aa6e0', sable = hx(def.sable) ? def.sable : '#f4d68e';
  const t = (i, j) => (g[j] || '')[i] || '#';
  g.forEach((r, j) => [...r].forEach((ch, i) => { const X = i * T, Y = j * T; x.fillStyle = ch === 'S' ? sable : ch === 'W' ? eau : ((i + j) % 2 ? h1 : ombrer(h1, 0.07)); x.fillRect(X, Y, T, T);
    if (ch === 'W') { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; x.beginPath(); x.arc(X + T / 2, Y + T * 0.75, T * 0.3, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); }
    if (ch === 'Z') { x.fillStyle = 'rgba(255,225,74,.45)'; x.fillRect(X, Y, T, T); x.strokeStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(X, Y + T); x.lineTo(X + T, Y); x.stroke(); } }));
  x.strokeStyle = NOIR; x.lineWidth = 1.5; // bords de l'eau à l'encre
  g.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== 'W') return; const X = i * T, Y = j * T; x.beginPath();
    if (t(i, j - 1) !== 'W') { x.moveTo(X, Y); x.lineTo(X + T, Y); } if (t(i, j + 1) !== 'W') { x.moveTo(X, Y + T); x.lineTo(X + T, Y + T); }
    if (t(i - 1, j) !== 'W') { x.moveTo(X, Y); x.lineTo(X, Y + T); } if (t(i + 1, j) !== 'W') { x.moveTo(X + T, Y); x.lineTo(X + T, Y + T); } x.stroke(); }));
  g.forEach((r, j) => [...r].forEach((ch, i) => { const X = i * T, Y = j * T, m = T / 2; x.lineJoin = 'round'; x.lineWidth = 1.5; x.strokeStyle = NOIR;
    if (ch === '#') { x.fillStyle = mur; x.fillRect(X + 0.5, Y + 0.5, T - 1, T - 1); x.fillStyle = ombrer(mur, -0.3); x.fillRect(X + 0.5, Y + T - 4, T - 1, 3.5); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(X + 2, Y + 2, T - 4, 2); x.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1); }
    else if (ch === 'B') { x.fillStyle = def.buisson || '#2fae4a'; x.beginPath(); x.arc(X + m, Y + m, m * 0.95, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(X + m - 2, Y + m - 2, 2, 0, 7); x.fill(); }
    else if (ch === 'C') { x.fillStyle = '#ffd23f'; x.fillRect(X + 2, Y + 3, T - 4, T - 5); x.strokeRect(X + 2, Y + 3, T - 4, T - 5); }
    else if (ch === 'T') { x.fillStyle = '#b57bff'; x.beginPath(); x.moveTo(X + m, Y + 1); x.lineTo(X + T - 2, Y + m); x.lineTo(X + m, Y + T - 1); x.lineTo(X + 2, Y + m); x.closePath(); x.fill(); x.stroke(); }
    else if (ch >= '1' && ch <= '4') { x.fillStyle = EQ_COUL[ch - 1]; x.beginPath(); x.arc(X + m, Y + m, m * 0.8, 0, 7); x.fill(); x.lineWidth = 2; x.strokeStyle = '#fff'; x.stroke(); }
    else if ((ch >= '5' && ch <= '8') || ch === 'N') { x.fillStyle = ch === 'N' ? '#ffd23f' : EQ_COUL[ch - 5]; x.beginPath(); x.moveTo(X + m, Y + 1); x.lineTo(X + T - 2, Y + m); x.lineTo(X + m, Y + T - 1); x.lineTo(X + 2, Y + m); x.closePath(); x.fill(); x.stroke(); }
    else if (ch === 'P' || ch === 'E') { x.fillStyle = ch === 'P' ? '#1e90ff' : '#ff2d55'; x.beginPath(); x.arc(X + m, Y + m, m * 0.8, 0, 7); x.fill(); x.lineWidth = 2; x.strokeStyle = '#fff'; x.stroke(); } }));
  return cacheMini[cle] = c;
}
function dessinerMiniMap(def, x, y, w, h) {
  const m = miniMap(def), k = Math.min(w / m.width, h / m.height), mw = m.width * k, mh = m.height * k, X = x + (w - mw) / 2, Y = y + (h - mh) / 2;
  rect(X + 4, Y + 5, mw, mh, 6, NOIR); ctx.save(); ctx.beginPath(); ctx.roundRect(X, Y, mw, mh, 6); ctx.clip(); ctx.drawImage(m, X, Y, mw, mh); trame(0.05, '#fff'); ctx.restore();
  rect(X, Y, mw, mh, 6, null, NOIR, 3);
}

// ---------- 🎁 RÉCOMPENSES : paliers selon le total de victoires ----------
async function reclamer(i) {
  const r = (CONFIG.recompenses || [])[i]; if (!r || !db || (mesStats.recompenses || []).includes(i) || (mesStats.victoires || 0) < r.victoires) return;
  const inc = firebase.firestore.FieldValue.increment, ess = {}, maj = { recompenses: firebase.firestore.FieldValue.arrayUnion(i) };
  if (r.type === 'jetons') maj.jetons = inc(+r.quantite || 1);
  else if (r.type === 'avatar') { const ok = avatarsDebloques(), dispo = libAvatars().filter(a => !ok.has(a.cle)).sort(() => Math.random() - 0.5).slice(0, +r.quantite || 1).map(a => a.cle); if (dispo.length) maj.avatars = firebase.firestore.FieldValue.arrayUnion(...dispo); }
  else { (r.element === 'tous' ? Object.keys(CONFIG.elements) : [r.element]).forEach(k => ess[k] = inc(+r.quantite || 0)); maj.essences = ess; }
  try { await db.collection('joueurs').doc(user.uid).set(maj, { merge: true }); notif('🎁 Récompense récupérée !'); vagues.push({ x: W / 2, y: H / 2, t: temps }); }
  catch (e) { notif('Impossible : ' + e.message); }
}
const nbRecompenses = () => (CONFIG.recompenses || []).filter((r, i) => (mesStats.victoires || 0) >= r.victoires && !(mesStats.recompenses || []).includes(i)).length;
function menuRecompenses() {
  const u = U(), top = barreHaut('RÉCOMPENSES', true), l = CONFIG.recompenses || [], v = mesStats.victoires || 0, pris = mesStats.recompenses || [];
  const par = Math.max(1, Math.min(5, Math.floor((W - 40 * u) / (150 * u)))), pages = Math.max(1, Math.ceil(l.length / par)); pageMenu = Math.min(pageMenu, pages - 1);
  const cw = (W - 40 * u) / par - 14 * u, ch = Math.min(H - top - 110 * u, cw * 1.5), y = top + 44 * u;
  titre(v + ' victoires au total', W / 2, top + 20 * u, 24 * u, '#ffe14a');
  l.slice(pageMenu * par, pageMenu * par + par).forEach((r, k) => {
    const i = pageMenu * par + k, x = 20 * u + k * (cw + 14 * u) + 7 * u, ok = v >= r.victoires, deja = pris.includes(i), el = CONFIG.elements[r.element], c = deja ? '#8b8fa8' : ok ? (el ? el.couleur : '#ffb300') : '#3a2d9c';
    ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.rotate((k % 2 ? 1 : -1) * 0.02 + (ok && !deja ? Math.sin(temps * 0.08 + k) * 0.015 : 0)); ctx.translate(-x - cw / 2, -y - ch / 2);
    rect(x + 5 * u, y + 6 * u, cw, ch, 16 * u, NOIR); const g = ctx.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, ombrer(c, 0.3)); g.addColorStop(1, ombrer(c, -0.35)); rect(x, y, cw, ch, 16 * u, g);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 16 * u); ctx.clip(); if (ok && !deja) rayons(x + cw / 2, y + ch * 0.4, temps * 0.01, '#fff', 0.22, 14); trame(0.1, '#000'); ctx.restore();
    rect(x, y, cw, ch, 16 * u, null, NOIR, 3.5 * u);
    titre('🏆 ' + r.victoires, x + cw / 2, y + 20 * u, 20 * u, '#fff');
    const cy = y + ch * 0.42, sz = Math.min(cw * 0.42, ch * 0.3);
    if (r.type === 'jetons') titre('🎟️', x + cw / 2, cy, sz, '#fff'); else if (r.type === 'avatar') titre('🖼️', x + cw / 2, cy, sz, '#fff'); else if (el) iconeElement(r.element, x + cw / 2, cy, sz); else Object.keys(ELEM_DEF).forEach((kk, n) => iconeElement(kk, x + cw / 2 + (n % 2 ? 1 : -1) * sz * 0.33, cy + (n < 2 ? -1 : 1) * sz * 0.33, sz * 0.55));
    titre('+' + r.quantite, x + cw / 2, cy + sz * 0.72, 26 * u, '#ffe14a'); texte(r.type === 'jetons' ? 'Jetons perso' : r.type === 'avatar' ? 'Photo de profil' : el ? 'Essence ' + el.nom : 'Toutes les essences', x + cw / 2, cy + sz * 0.72 + 22 * u, 11 * u, '#fff', 'center', cw - 10 * u);
    const by = y + ch - 44 * u;
    if (deja) titre('✔ Récupéré', x + cw / 2, by + 17 * u, 16 * u, '#fff');
    else if (ok) { boutonJeu(x + 10 * u, by, cw - 20 * u, 34 * u, '#b6ff4a', '#1fc46b', () => reclamer(i)); titre('Récupérer', x + cw / 2, by + 17 * u, 16 * u, '#fff', 'center', cw - 30 * u); }
    else texte('🔒 encore ' + (r.victoires - v) + ' victoire' + (r.victoires - v > 1 ? 's' : ''), x + cw / 2, by + 17 * u, 11 * u, 'rgba(255,255,255,.75)', 'center', cw - 12 * u);
    ctx.restore();
  });
  if (pages > 1) {
    bouton3D(20 * u, H - 44 * u, 60 * u, 32 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + pages - 1) % pages); texte('◀', 50 * u, H - 28 * u, 14 * u, '#fff');
    texte((pageMenu + 1) + ' / ' + pages, W / 2, H - 28 * u, 13 * u, '#fff');
    bouton3D(W - 80 * u, H - 44 * u, 60 * u, 32 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + 1) % pages); texte('▶', W - 50 * u, H - 28 * u, 14 * u, '#fff');
  }
}
const bossBase = d => (d && Object.values(CONFIG.bosses).find(b => b.nom === d.nom)) || d; // modèle 3D partagé par tous les boss du même type


// ---------- ⌨️ COMMANDES CLAVIER (réglables par chaque joueur, onglet Commandes) ----------
const TOUCHES_DEF = { haut: 'z', bas: 's', gauche: 'q', droite: 'd', auto: ' ', action: 'e', super: 'r' };
const NOM_TOUCHE = { haut: 'Avancer', bas: 'Reculer', gauche: 'Aller à gauche', droite: 'Aller à droite', auto: 'Tir automatique', action: 'Action d\'élément', super: 'Super (vers la souris)' };
const FLECHES = { haut: 'arrowup', bas: 'arrowdown', gauche: 'arrowleft', droite: 'arrowright' };
let mesTouches = { ...TOUCHES_DEF }, toucheAttendue = null, souris = null;
try { Object.assign(mesTouches, JSON.parse(localStorage.getItem('bastoryTouches') || '{}')); } catch (e) {}
const appuye = a => !!(touches[mesTouches[a]] || touches[FLECHES[a]]);
const libTouche = k => ({ ' ': 'ESPACE', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', shift: 'MAJ', control: 'CTRL', enter: 'ENTRÉE', tab: 'TAB', alt: 'ALT' })[k] || String(k).toUpperCase();
function sauverTouches() {
  try { localStorage.setItem('bastoryTouches', JSON.stringify(mesTouches)); } catch (e) {}
  if (db && user) db.collection('joueurs').doc(user.uid).set({ touches: mesTouches }, { merge: true }).catch(() => {});
}
function menuCommandes() {
  if (mobile) return menuHud(); // 📱 sur mobile : placement des boutons (pas de clavier)
  const u = U(), top = barreHaut('COMMANDES', true), l = Object.keys(TOUCHES_DEF), w = Math.min(580 * u, W - 40 * u), x = (W - w) / 2, lh = Math.min(46 * u, (H - top - 90 * u) / l.length);
  l.forEach((a, i) => {
    const y = top + 10 * u + i * lh, h = lh - 6 * u, att = toucheAttendue === a, kw = Math.min(170 * u, w * 0.4);
    verre(x, y, w, h, 12 * u, att ? 'rgba(255,225,74,.35)' : null); texte(NOM_TOUCHE[a], x + 16 * u, y + h / 2, 14 * u, '#fff', 'left', w - kw - 30 * u);
    bouton3D(x + w - kw - 6 * u, y + 3 * u, kw, h - 8 * u, att ? '#ff5ab4' : '#ffd23f', att ? '#c2185b' : '#ff8a1f', () => toucheAttendue = att ? null : a);
    titre(att ? 'Appuie sur une touche…' : libTouche(mesTouches[a]) + (FLECHES[a] ? '  ou  ' + libTouche(FLECHES[a]) : ''), x + w - kw / 2 - 6 * u, y + h / 2 - 3 * u, 15 * u, '#fff', 'center', kw - 12 * u);
  });
  const by = H - 50 * u;
  bouton3D(x, by, 150 * u, 38 * u, '#8e7bff', '#5b3fd6', () => { mesTouches = { ...TOUCHES_DEF }; toucheAttendue = null; sauverTouches(); }); titre('Par défaut', x + 75 * u, by + 17 * u, 16 * u, '#fff');
  bouton3D(x + 160 * u, by, 170 * u, 38 * u, '#b6ff4a', '#1fc46b', () => { vueMode = ({ '3d': '25', '25': '2d', '2d': '3d' })[vueMode]; vue25 = vueMode === '25'; try { localStorage.setItem('bastoryVue', vueMode); } catch (e) {} });
  titre('Vue : ' + NOM_VUE[vueMode], x + 245 * u, by + 17 * u, 16 * u, '#fff');
  bouton3D(x + 340 * u, by, 190 * u, 38 * u, '#5ff0ff', '#1e7bff', () => allerA('hud')); titre('📱 Placer les boutons', x + 435 * u, by + 17 * u, 14 * u, '#fff', 'center', 180 * u);
}
const angleSouris = () => { if (!souris || !moi) return moi ? moi.angle : 0; const m = versMonde(souris.x, souris.y); return Math.atan2(m.y - moi.y, m.x - moi.x); };
function angleAuto() { // ennemi visible le plus proche (sinon devant soi)
  let c = null, dm = 1e9;
  for (const e of [...bosses.filter(b => b.pv > 0 && !(b.def.cristal && b.eq === moi.eq)), ...joueurs().filter(j => j.eq !== moi.eq && j.pv > 0 && visible(j))]) { const d = Math.hypot(e.x - moi.x, e.y - moi.y); if (d < dm) { dm = d; c = e; } }
  return c ? Math.atan2(c.y - moi.y, c.x - moi.x) : moi.angle;
}
const joyS = { actif: false }; // 🎯 viser le super en glissant depuis son bouton
function viseeSuper() { // 🎯 flèche de visée du super, dessinée sous le perso (repère du monde)
  if (!joyS.actif || !moi) return; const v = vec(joyS); if (v.d < 15) return;
  ctx.save(); ctx.translate(moi.x, moi.y); ctx.rotate(v.a); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = NOIR; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(moi.r, -14); ctx.lineTo(260, -26); ctx.lineTo(292, 0); ctx.lineTo(260, 26); ctx.lineTo(moi.r, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}


// ---------- 🎥 FAUSSE PERSPECTIVE 2,5D (le bas de l'écran, plus proche, est agrandi) ----------
const PERSP = 0.24; let persp = null, vueMode = '3d'; // '3d' = vraie 3D • '25' = fausse perspective • '2d' = vue du dessus
try { vueMode = ({ '0': '2d', '1': '25' })[localStorage.getItem('bastoryVue')] || localStorage.getItem('bastoryVue') || '3d'; } catch (e) {}
let vue25 = vueMode === '25';
const NOM_VUE = { '3d': '3D', '25': '2,5D', '2d': '2D' };
function perspective25D() {
  const cw = canvas.width, ch = canvas.height;
  if (!persp || persp.width !== cw || persp.height !== ch) { persp = document.createElement('canvas'); persp.width = cw; persp.height = ch; }
  const p = persp.getContext('2d'); p.clearRect(0, 0, cw, ch); p.drawImage(canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const a = PERSP, sy = y => H / a * Math.log(1 + a * y / H), b = 3; // chaque bande horizontale est élargie et compressée selon sa profondeur
  for (let y = 0; y < H; y += b) { const k = 1 + a * Math.min(1, (y + b / 2) / H), w = cw * k, s0 = sy(y), s1 = sy(Math.min(H, y + b));
    ctx.drawImage(persp, 0, s0 * dpr, cw, Math.max(1, (s1 - s0) * dpr), (cw - w) / 2, y * dpr, w, b * dpr + 1); }
}
function ondeMarteau(p) { // 🔨 onde de choc du marteau de Rokh qui fend le sol
  const r = 18 + Math.sin(temps * 0.6) * 3, a = Math.atan2(p.vy || 0, p.vx || 1);
  ellipse(p.x, p.y + 4, r * 1.6, r * 0.7, 'rgba(90,60,30,.35)');
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.lineJoin = 'round';
  ctx.fillStyle = '#e8c38a'; ctx.strokeStyle = NOIR; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-6, 0, 26, -1.1, 1.1); ctx.arc(-14, 0, 20, 1.0, -1.0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) { const b = (temps * 3 + i * 17) % 30; ctx.fillStyle = '#9b7a55'; ctx.fillRect(-10 - i * 4, -18 + i * 11 - b * 0.6, 7, 7); ctx.strokeRect(-10 - i * 4, -18 + i * 11 - b * 0.6, 7, 7); }
  ctx.restore();
}


// ---------- 🌳 DÉCOR AUTOUR DE LA MAP + OMBRES PORTÉES + LUMIÈRE (volume façon dessin animé) ----------
function propDecor(type, teinte) { // accessoires dessinés avec volume : arbre, caisse, tonneau (mis en cache)
  const k = 'prop' + type + teinte; if (cacheGfx[k]) return cacheGfx[k];
  const c = document.createElement('canvas'); c.width = 110; c.height = 130; const x = c.getContext('2d'); x.lineJoin = 'round'; x.lineWidth = 3.5; x.strokeStyle = NOIR;
  x.fillStyle = 'rgba(20,10,40,.28)'; x.beginPath(); x.ellipse(62, 118, 40, 12, 0, 0, 7); x.fill(); // ombre au sol
  if (type === 0) { // arbre
    x.fillStyle = '#8a5a2b'; x.fillRect(48, 70, 16, 48); x.strokeRect(48, 70, 16, 48);
    for (const [cx, cy, r, col] of [[40, 62, 28, ombrer(teinte, -0.25)], [72, 60, 28, ombrer(teinte, -0.25)], [55, 38, 34, teinte]]) { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(45, 26, 11, 0, 7); x.fill();
  } else if (type === 1) { // caisse colorée
    x.fillStyle = ombrer(teinte, 0.35); x.beginPath(); x.moveTo(20, 50); x.lineTo(84, 50); x.lineTo(94, 38); x.lineTo(30, 38); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = ombrer(teinte, -0.3); x.beginPath(); x.moveTo(84, 50); x.lineTo(94, 38); x.lineTo(94, 100); x.lineTo(84, 112); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = teinte; x.fillRect(20, 50, 64, 62); x.strokeRect(20, 50, 64, 62);
    x.strokeStyle = ombrer(teinte, -0.35); x.lineWidth = 3; x.beginPath(); x.moveTo(24, 54); x.lineTo(80, 108); x.moveTo(80, 54); x.lineTo(24, 108); x.stroke();
  } else { // tonneau
    x.fillStyle = teinte; x.fillRect(28, 50, 56, 60); x.strokeRect(28, 50, 56, 60);
    x.fillStyle = ombrer(teinte, -0.3); x.fillRect(70, 50, 14, 60);
    x.fillStyle = '#5a3a1a'; x.fillRect(28, 62, 56, 6); x.fillRect(28, 94, 56, 6);
    x.fillStyle = ombrer(teinte, 0.3); x.beginPath(); x.ellipse(56, 50, 28, 10, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#5ff0ff'; x.beginPath(); x.ellipse(56, 50, 18, 6, 0, 0, 7); x.fill();
  }
  return cacheGfx[k] = c;
}
function decorExterieur(T, vw, vh) { // hors du terrain : herbe sombre + accessoires (on voit que la map est dans un monde)
  const ux0 = Math.floor((cam.x - vw) / T) - 1, ux1 = Math.ceil((cam.x + vw) / T) + 1, uy0 = Math.floor((cam.y - vh) / T) - 1, uy1 = Math.ceil((cam.y + vh) / T) + 2;
  const vert = /^#[0-9a-f]{6}$/i.test(map.def.herbe1 || '') ? map.def.herbe1 : '#5fd14a', COUL = ['#ff9a4a', '#5ac8fa', '#8e7bff', '#ffd23f', '#ff5a8a'];
  ctx.fillStyle = ombrer(vert, -0.28); ctx.fillRect(ux0 * T, uy0 * T, (ux1 - ux0) * T, (uy1 - uy0) * T);
  for (let y = uy0; y < uy1; y++) for (let x = ux0; x < ux1; x++) {
    if (x >= 0 && y >= 0 && x < map.l && y < map.h) continue;
    const a = alea(x * 31.7 + y * 17.3); if (a > 0.42) continue;
    const t = a < 0.22 ? 0 : a < 0.33 ? 1 : 2, im = propDecor(t, t === 0 ? ombrer(vert, 0.05) : COUL[Math.floor(alea(x + y * 3.1) * COUL.length)]);
    ctx.drawImage(im, x * T - 23, y * T - 66);
  }
}
function ombresPortees(tuiles, T) { // ombres des blocs et buissons vers le bas-droite (une seule forme = pas de double ombre)
  ctx.beginPath(); tuiles((c, x, y, px, py) => { if (bloqueTir(c)) ctx.rect(px + 14, py + 8, T, T); }); ctx.fillStyle = 'rgba(25,15,60,.26)'; ctx.fill();
  ctx.beginPath(); tuiles((c, x, y, px, py) => { if (c === 'B') ctx.rect(px + 10, py + 10, T - 4, T - 6); }); ctx.fillStyle = 'rgba(25,15,60,.14)'; ctx.fill();
}
function lumiereSol(T) { // taches de soleil et zones d'ombre douces sur le sol
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 8; i++) { const x = alea(i * 5.1 + 3) * map.l * T, y = alea(i * 2.7 + 9) * map.h * T, r = 260 + alea(i) * 260, cl = i % 3 ? 'rgba(255,245,200,.55)' : 'rgba(20,30,90,.45)';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, cl); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
}

function dessinerZone() { // 🎯 zone carrée (celle des cases) : remplissage animé, contour qui défile, jauge et étincelles
  if (obj() !== 'zone' || !map.z) return; const z = centreZone(); if (!z) return;
  const eqC = typeof zoneControle === 'number' ? zoneControle : null, col = eqC === null ? (zoneControle === 'conteste' ? '#ffd23f' : '#ffffff') : eqC === moi.eq ? '#5ac8fa' : '#ff5a6e';
  const tz = (+mode.tempsZone || 30) * 60, p = Math.min(1, (zoneProg[eqC === null ? moi.eq : eqC] || 0) / tz), pul = 0.5 + 0.5 * Math.sin(temps * 0.08);
  const b = z.b, x = b.x0 * TUILE, y = b.y0 * TUILE, w = (b.x1 - b.x0 + 1) * TUILE, h = (b.y1 - b.y0 + 1) * TUILE;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = 0.18 + 0.1 * pul; ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.16; ctx.strokeStyle = col; ctx.lineWidth = 16; // rayures qui défilent
  for (let d = -h; d < w + h; d += 46) { ctx.beginPath(); ctx.moveTo(x + d + (temps % 46), y); ctx.lineTo(x + d + (temps % 46) - h, y + h); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
  ctx.lineJoin = 'round'; ctx.strokeStyle = NOIR; ctx.lineWidth = 9; ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.setLineDash([30, 20]); ctx.lineDashOffset = -temps * 1.2; ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  const per = (w + h) * 2; ctx.lineWidth = 9; ctx.lineCap = 'butt'; ctx.setLineDash([per * p, per]); ctx.lineDashOffset = 0; ctx.globalAlpha = 0.95; ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); ctx.globalAlpha = 1; // jauge de capture
  for (let i = 0; i < 8; i++) { const t2 = (temps * 2 + i * 55) % 160, sx = x + alea(i * 3.1 + Math.floor((temps + i * 55) / 160)) * w;
    ctx.globalAlpha = 0.7 * (1 - t2 / 160); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, y + h - t2 * (h / 160), 5, 0, 7); ctx.fill(); } // étincelles qui montent
  ctx.globalAlpha = 1;
  if (zoneControle === 'conteste') bd('CONTESTÉE!', z.x, y - 22, 26, '#ffd23f', Math.sin(temps * 0.2) * 0.05);
  else if (eqC !== null) bd(eqC === moi.eq ? 'À NOUS!' : 'À EUX!', z.x, y - 22, 22, col, 0);
}
let fissuresSol = []; // 🔨 craquelures laissées au sol par le marteau
function dessinerFissuresSol() {
  fissuresSol = fissuresSol.filter(f => temps - f.t < 150);
  for (const f of fissuresSol) { const a = Math.min(1, (150 - (temps - f.t)) / 40), k = Math.min(1, (temps - f.t) / 6);
    ctx.save(); ctx.globalAlpha = a; ellipse(f.x, f.y, 70 * k, 40 * k, 'rgba(90,55,25,.35)'); ctx.strokeStyle = '#2a1608'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 9; i++) { let an = i / 9 * Math.PI * 2 + alea(f.g + i), x = f.x, y = f.y; const L = (60 + alea(f.g + i * 3) * 70) * k; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 1; s <= 4; s++) { an += (alea(f.g + i * 7 + s) - 0.5) * 0.9; x += Math.cos(an) * L / 4; y += Math.sin(an) * L / 4 * 0.7; ctx.lineTo(x, y); ctx.lineWidth = 5 - s; } ctx.stroke(); }
    ctx.restore(); }
}

// ---------- 👫 AMIS : demandes, acceptation, recherche par pseudo, journal de combat ----------
let mesAmis = {}, demandesAmis = {}, amisOnglet = 'amis', rechercheAmis = null, demandesEnvoyees = {};
const nomAmi = v => typeof v === 'string' ? v : (v && v.nom) || 'Joueur';
function ecouterAmis() {
  if (!rtdb || !user) return;
  rtdb.ref('amis/' + user.uid).on('value', s => { mesAmis = s.val() || {}; if (!mesAmis._init) initAmis(); });
  rtdb.ref('demandes/' + user.uid).on('value', s => demandesAmis = s.val() || {});
}
async function initAmis() { // les joueurs inscrits avant cette mise à jour sont tous amis entre eux
  const cree = Date.parse((user.metadata || {}).creationTime || '') || Date.now(), maj = { _init: true };
  if (cree < Date.parse('2026-09-24T00:00:00Z') && db) { try { (await db.collection('joueurs').get()).forEach(d => { if (d.id !== user.uid) maj[d.id] = d.data().pseudo || 'Joueur'; }); } catch (e) {} }
  rtdb.ref('amis/' + user.uid).update(maj);
}
function demanderAmi(uid, nom) { if (!rtdb || uid === user.uid || mesAmis[uid]) return; rtdb.ref(`demandes/${uid}/${user.uid}`).set({ nom: nomJoueur(), t: firebase.database.ServerValue.TIMESTAMP }); demandesEnvoyees[uid] = true; notif('Demande envoyée à ' + nom); }
function accepterAmi(uid, nom) { rtdb.ref(`amis/${user.uid}/${uid}`).set(nom); rtdb.ref(`amis/${uid}/${user.uid}`).set(nomJoueur()); rtdb.ref(`demandes/${user.uid}/${uid}`).remove(); notif('🤝 ' + nom + ' est ton ami !'); }
const refuserAmi = uid => rtdb.ref(`demandes/${user.uid}/${uid}`).remove();
const retirerAmi = uid => { rtdb.ref(`amis/${user.uid}/${uid}`).remove(); rtdb.ref(`amis/${uid}/${user.uid}`).remove(); };
async function chercherAmi() {
  const q = (prompt('Pseudo à rechercher :') || '').trim(); if (!q || !db) return;
  rechercheAmis = { q, l: null }; amisOnglet = 'recherche';
  try { const r = await db.collection('joueurs').orderBy('pseudo').startAt(q).endAt(q + '\uf8ff').limit(8).get(); rechercheAmis.l = r.docs.filter(d => d.id !== user.uid).map(d => ({ uid: d.id, nom: d.data().pseudo || 'Joueur' })); }
  catch (e) { rechercheAmis.l = []; notif('Recherche impossible : ' + e.message); }
}


// ---------- 🖼️ PHOTOS DE PROFIL (4 par perso / boss, créées automatiquement) & 🔓 PERSOS À DÉBLOQUER ----------
const estDebloque = p => p.deBase !== false || (mesStats.persosDebloques || []).includes(cleP(p));
function bboxImage(im) { // zone réellement dessinée d'un portrait (pour bien centrer)
  if (im._bb) return im._bb; const c = document.createElement('canvas'), w = c.width = im.width, h = c.height = im.height, x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 2) for (let i = 0; i < w; i += 2) if (d[(y * w + i) * 4 + 3] > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let sx = 0, n = 0; for (let y = y0; y < y0 + (y1 - y0) * 0.3; y += 2) for (let i = x0; i <= x1; i += 2) if (d[(y * w + i) * 4 + 3] > 40) { sx += i; n++; } // centre de la tête
  return im._bb = x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, hx: n ? sx / n : (x0 + x1) / 2 } : { x: 0, y: 0, w, h, hx: w / 2 };
}
const libAvatars = () => [...CONFIG.persos.map(p => ['p', p]), ...Object.values(CONFIG.bosses).filter(b => !b.cristal).map(b => ['b', b])].flatMap(([t, p]) => [0, 1, 2, 3].map(v => ({ cle: t + ':' + p.nom + ':' + v, p, v })));
const avatarsDebloques = () => new Set([...CONFIG.persos.filter(estDebloque).map(p => 'p:' + p.nom + ':0'), ...(mesStats.avatars || [])]);
function avatarPerso(p, v = 0) { // 4 styles : en pied • gros plan • gros plan miroir sur rayons • en pied halo sombre
  const im = carteDe(p), bp = baseDe(p); if (!pret(im) || (bp.modele && !visages3D.get(bp))) return null; const cache = im._av || (im._av = {}); if (cache[v]) return cache[v];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), el = elemDe(p), col = /^#[0-9a-f]{6}$/i.test((el && el.couleur) || p.couleur || '') ? (el && el.couleur) || p.couleur : '#5a4dff', bb = bboxImage(im);
  const g = x.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S * 0.7);
  if (v === 3) { g.addColorStop(0, ombrer(col, 0.1)); g.addColorStop(1, '#140c3a'); } else { g.addColorStop(0, ombrer(col, 0.45)); g.addColorStop(1, ombrer(col, -0.35)); }
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  if (v === 2) { x.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S); x.lineTo(S / 2 + Math.cos(a + 0.26) * S, S / 2 + Math.sin(a + 0.26) * S); x.fill(); } }
  const gros = v === 1 || v === 2, cw = gros ? Math.min(bb.w, bb.h * 0.58) : bb.w, ch = gros ? cw : bb.h, sx = gros ? Math.max(0, Math.min(im.width - cw, bb.hx - cw / 2)) : bb.x, sy = gros ? Math.max(0, bb.y - cw * 0.05) : bb.y, k2 = (S * (gros ? 0.98 : 0.84)) / Math.max(cw, ch);
  x.save(); if (v === 2) { x.translate(S, 0); x.scale(-1, 1); }
  x.drawImage(im, sx, sy, cw, ch, S / 2 - cw * k2 / 2, S / 2 - ch * k2 / 2 + (gros ? S * 0.04 : 0), cw * k2, ch * k2); x.restore();
  return cache[v] = c;
}
function monAvatar() { const a = mesStats.avatar; if (a && a.d) { const i = img(a.d); if (pret(i)) return i; }
  const l = a && a.cle && libAvatars().find(o => o.cle === a.cle); return l ? avatarPerso(l.p, l.v) : avatarPerso(selPerso(), 1); }
function dessinerAvatar(im, x, y, r, col = '#fff') { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); if (im && pret(im)) ctx.drawImage(im, x - r, y - r, r * 2, r * 2); else { ctx.fillStyle = '#3a2d9c'; ctx.fillRect(x - r, y - r, r * 2, r * 2); } ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = col; ctx.stroke(); }
const sauverAvatar = a => { if (db && user) db.collection('joueurs').doc(user.uid).set({ avatar: a }, { merge: true }).then(() => notif('🖼️ Photo de profil changée')).catch(e => notif('Impossible : ' + e.message)); };
function importerAvatar() { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
  f.onchange = async () => { const fi = f.files[0]; if (!fi) return; const im = new Image(); im.src = URL.createObjectURL(fi); await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'), k = Math.max(192 / im.width, 192 / im.height); x.drawImage(im, 96 - im.width * k / 2, 96 - im.height * k / 2, im.width * k, im.height * k);
    sauverAvatar({ d: c.toDataURL('image/jpeg', 0.85) }); }; f.click(); }
function menuAvatar() { // 🖼️ choisir sa photo de profil
  const u = U(), top = barreHaut('PHOTO DE PROFIL', true), l = libAvatars(), ok = avatarsDebloques(), s = 74 * u, cols = Math.max(4, Math.floor((W - 40 * u) / (s + 12 * u))), par = cols * Math.max(1, Math.floor((H - top - 110 * u) / (s + 12 * u))), pages = Math.ceil(l.length / par);
  pageMenu = Math.min(pageMenu, pages - 1);
  bouton3D(20 * u, top + 8 * u, 230 * u, 40 * u, '#5ff0ff', '#1e7bff', importerAvatar); titre('📷 Importer ma photo', 135 * u, top + 27 * u, 15 * u, '#fff');
  texte(ok.size + ' / ' + l.length + ' débloquées • gagne-en dans les Récompenses', 270 * u, top + 28 * u, 12 * u, '#ffe14a', 'left');
  l.slice(pageMenu * par, pageMenu * par + par).forEach((a, i) => { const x = 20 * u + (i % cols) * (s + 12 * u) + s / 2, y = top + 64 * u + Math.floor(i / cols) * (s + 12 * u) + s / 2, dispo = ok.has(a.cle), sel = (mesStats.avatar || {}).cle === a.cle;
    ctx.save(); if (!dispo) ctx.globalAlpha = 0.35; dessinerAvatar(avatarPerso(a.p, a.v), x, y, s / 2, sel ? '#ffe14a' : '#fff'); ctx.restore();
    if (!dispo) texte('🔒', x, y, 20 * u, '#fff'); else zones.push({ x: x - s / 2, y: y - s / 2, w: s, h: s, action: () => sauverAvatar({ cle: a.cle }) }); });
  if (pages > 1) { bouton3D(20 * u, H - 44 * u, 60 * u, 32 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + pages - 1) % pages); texte('◀', 50 * u, H - 28 * u, 14 * u, '#fff');
    texte((pageMenu + 1) + ' / ' + pages, W / 2, H - 28 * u, 13 * u, '#fff'); bouton3D(W - 80 * u, H - 44 * u, 60 * u, 32 * u, '#8e7bff', '#5b3fd6', () => pageMenu = (pageMenu + 1) % pages); texte('▶', W - 50 * u, H - 28 * u, 14 * u, '#fff'); }
}
async function debloquerPerso(p) { const c = +p.coutJetons || 3; if ((mesStats.jetons || 0) < c) return notif('Il te faut ' + c + ' 🎟️ jetons perso (Récompenses)');
  try { await db.collection('joueurs').doc(user.uid).set({ jetons: firebase.firestore.FieldValue.increment(-c), persosDebloques: firebase.firestore.FieldValue.arrayUnion(cleP(p)), avatars: firebase.firestore.FieldValue.arrayUnion('p:' + p.nom + ':0') }, { merge: true }); notif('🔓 ' + p.nom + ' débloqué !'); vagues.push({ x: W / 2, y: H / 2, t: temps }); }
  catch (e) { notif('Impossible : ' + e.message); } }


// ---------- 🤖 DÉPLACEMENT MALIN DES BOTS (contourne les murs) & OBJECTIFS ----------
function allerVers(j, tx, ty, v) {
  let a = Math.atan2(ty - j.y, tx - j.x);
  if (j.detourT > temps) a = j.detourA;
  else { const d = j.r + 30, px = j.x + Math.cos(a) * d, py = j.y + Math.sin(a) * d;
    if (!libre(px, py, j.r, j.dep)) { // un mur devant : on tente à gauche, sinon à droite
      const g = libre(j.x + Math.cos(a - 1.1) * d, j.y + Math.sin(a - 1.1) * d, j.r, j.dep);
      a += g ? -1.1 : 1.1; j.detourA = a; j.detourT = temps + 24; } }
  const ax = j.x, ay = j.y;
  deplacer(j, Math.cos(a) * v, Math.sin(a) * v); j.marche += v; tourner(j, a, 0.15);
  if (Math.hypot(j.x - ax, j.y - ay) < v * 0.35) { // toujours coincé : grand contournement
    if ((j.coince = (j.coince || 0) + 1) > 10) { j.detourA = a + (Math.random() < 0.5 ? 1 : -1) * (1.4 + Math.random()); j.detourT = temps + 50; j.coince = 0; }
  } else j.coince = 0;
}
const centreZone = () => { if (map.zc === undefined) { let sx = 0, sy = 0, n = 0, b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    map.g.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'Z') { sx += x; sy += y; n++; b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); } }));
    map.zc = n ? { x: (sx / n + 0.5) * TUILE, y: (sy / n + 0.5) * TUILE, r: Math.sqrt(n) * TUILE * 0.55, b } : null; } return map.zc; };
function butObjectif(j) { // 🎯 ce que le bot doit faire selon le mode
  const o = obj();
  if (o === 'zone') return centreZone();
  if (o === 'bloc') {
    const cr = bosses.filter(b => b.def.cristal && b.pv > 0), mien = cr.find(b => b.eq === j.eq);
    const adv = cr.filter(b => b.eq !== j.eq).sort((a, b) => Math.hypot(a.x - j.x, a.y - j.y) - Math.hypot(b.x - j.x, b.y - j.y))[0];
    if (j.defenseur === undefined) j.defenseur = Math.random() < 0.4; // certains défendent, les autres attaquent
    if (j.defenseur && mien) { const men = joueurs().find(o2 => o2.eq !== j.eq && o2.pv > 0 && Math.hypot(o2.x - mien.x, o2.y - mien.y) < 420); return men || mien; }
    if (adv) return adv;
  }
  return null;
}

// ---------- 12c. GRAPHISMES : textures & sprites pré-calculés (rapides) ----------
const cacheGfx = {};
function ombrer(hex, k) { // éclaircit (k>0) ou assombrit (k<0) une couleur #rrggbb
  const n = parseInt((hex || '#888888').slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c + (k > 0 ? (255 - c) * k : c * k))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function alea(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); } // hasard reproductible
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
function dessinerCristal(b) { // 💎 cristal flottant aux couleurs de son équipe
  const col = b.eq === -1 ? '#b57bff' : b.eq === -2 ? '#ffd23f' : b.eq === moi.eq ? '#5ac8fa' : '#ff5a6e', f = Math.sin(temps * 0.06) * 6, y = b.y - 30 + f;
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
  const s = secousse; secousse = secousse < 0.3 ? 0 : secousse * 0.85, sx = (Math.random() - 0.5) * s, sy = (Math.random() - 0.5) * s;
  aff3 = vueMode === '3d' && typeof Rendu3D !== 'undefined' ? Rendu3D.rendre(sx, sy) : null; const v3 = !!aff3; // 🎥 vraie 3D
  if (v3) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } else { if (typeof Rendu3D !== 'undefined') Rendu3D.cacher(); ecran(); ctx.fillStyle = '#16351f'; ctx.fillRect(0, 0, W, H); }
  monde(sx, sy);
  const T = TUILE, d = map.def, vw = W / zoom / 2 + T, vh = H / zoom / 2 + T * 2;
  const x0 = Math.max(0, Math.floor((cam.x - vw) / T)), x1 = Math.min(map.l - 1, Math.ceil((cam.x + vw) / T));
  const y0 = Math.max(0, Math.floor((cam.y - vh) / T)), y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh) / T));
  const tuiles = f => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(tuile(x, y), x, y, x * T, y * T); };

  if (!v3) { decorExterieur(T, vw, vh);
  ctx.fillStyle = motifHerbe(d); ctx.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T); // herbe texturée
  lumiereSol(T); }
  if (!v3) tuiles((c, x, y, px, py) => { if (c === '.' && alea(x * 97 + y * 13) < 0.16) ctx.drawImage(spriteDeco(Math.floor(alea(x + y * 7) * 4)), px + alea(x * 3 + y) * 30, py + alea(y * 5 + x) * 30); }); // fleurs & cailloux
  tuiles((c, x, y, px, py) => { // eau : dégradé, reflets animés et écume sur les bords
    if (c === 'Z') { // 🎯 zone
      const col = zoneControle === moi.eq ? '90,200,255' : typeof zoneControle === 'number' ? '255,90,90' : zoneControle ? '255,210,63' : '255,255,255';
      ctx.fillStyle = `rgba(${col},${0.16 + 0.06 * Math.sin(temps * 0.08)})`; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 3; ctx.beginPath();
      if (tuile(x, y - 1) !== 'Z') { ctx.moveTo(px, py); ctx.lineTo(px + T, py); } if (tuile(x, y + 1) !== 'Z') { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
      if (tuile(x - 1, y) !== 'Z') { ctx.moveTo(px, py); ctx.lineTo(px, py + T); } if (tuile(x + 1, y) !== 'Z') { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
      ctx.stroke(); return;
    }
    if (c !== 'W' || v3) return;
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
  if (!v3) { tuiles((c, x, y, px, py) => { if (c === 'S') dessinerSable(x, y, px, py); else if (c === 'W') encreEau(x, y, px, py); }); // 🏖️ sable + bords d'eau encrés
  ombresPortees(tuiles, T); }
  if (!v3) tuiles((c, x, y, px, py) => { if (bloqueTir(c)) ctx.drawImage(spriteOmbre(), px - 6, py - 2); }); // ombres douces
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
  dessinerZone(); dessinerFissuresSol(); dessinerTresors();
  const objs = []; // tri par profondeur = effet 3D
  if (!v3) tuiles((c, x, y, px, py) => { if (c === '#') objs.push([(y + 1) * T - 1, () => { // les murs qui sortent du sol montent
                                   const f = levees[x + ',' + y] !== undefined ? Math.min(1, (temps - levees[x + ',' + y]) / 12) : 1;
                                   ctx.save(); ctx.translate(0, (1 - f) * 40); mur(px, py); fissures(x, y, px, py); ctx.restore(); }]);
                                 if (c === 'C') objs.push([(y + 1) * T - 1, () => { coffre(px, py); fissures(x, y, px, py); }]); });
  if (!v3) dessinerNuages();
  for (const j of joueurs()) if (visible(j) && (j.pv > 0 || ((obtenir3D(j.perso) || {}).spec || { lignes: {} }).lignes.mort))
    objs.push([j.y + j.r * 0.5, () => { aura(j); dessinerEntite(j, img(j.perso.image), j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.r * 3.3); }]);
  for (const b of bosses) if (b.pv > 0) objs.push([b.y + b.r * 0.5, () => b.def.cristal ? (aff3 && Rendu3D.gere(b) ? null : dessinerCristal(b)) : dessinerEntite(b, img(b.def.image), '#ff7b1a', b.r * 3.4)]);
  for (const p of projectiles) if (p.type !== 'lob' && p.type !== 'terrain') objs.push([p.y, () => dessinerProjectile(p)]);
  objs.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());

  if (!v3) tuiles((c, x, y, px, py) => { if (c === 'B') buisson(px, py); });
  for (const p of projectiles) if (p.type === 'lob') dessinerProjectile(p);
  bullesElem(); dessinerEffets();
  for (const j of joueurs()) if (j.pv > 0 && visible(j)) barreVie(j, j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.nom);
  for (const b of bosses) if (b.pv > 0) barreVie(b, '#ff7b1a');
  if (!v3) for (let k = 0; k < 5; k++) { // ombres de nuages qui glissent sur la map
    const nx = ((alea(k) * map.l * T + temps * (0.25 + k * 0.05)) % (map.l * T + 600)) - 300, ny = alea(k + 20) * map.h * T;
    const gn = ctx.createRadialGradient(nx, ny, 0, nx, ny, 260); gn.addColorStop(0, 'rgba(10,20,40,.12)'); gn.addColorStop(1, 'rgba(10,20,40,0)'); ctx.fillStyle = gn; ctx.fillRect(nx - 260, ny - 260, 520, 520);
  }
  if (vue25 && !v3) perspective25D();
  ecran(); ctx.fillStyle = vignette(); ctx.fillRect(0, 0, W, H); // vignette cinéma
  const lum = ctx.createLinearGradient(0, 0, W, H); lum.addColorStop(0, 'rgba(255,225,160,.08)'); lum.addColorStop(1, 'rgba(60,90,200,.08)'); ctx.fillStyle = lum; ctx.fillRect(0, 0, W, H); // lumière chaude / ombre froide
  zoneSure(dessinerHUD);
  chocManga();
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
let visee3D = null;
function dessinerVisee() {
  visee3D = null; // 🎯 visée de l'attaque principale : trajectoire (tir droit) ou zone d'impact (tir en cloche)
  if (!moi || moi.pv <= 0 || etat !== 'JEU') return;
  let a, f;
  if (joyD.actif) { const v = vec(joyD); if (v.d < 12) return; a = v.a; f = Math.min(1, v.d / 60); }
  else if (!mobile && souris) { const m = versMonde(souris.x, souris.y); a = Math.atan2(m.y - moi.y, m.x - moi.x); f = Math.min(1, Math.hypot(m.x - moi.x, m.y - moi.y) / moi.perso.portee); }
  else return;
  const P = moi.perso.portee, A = moi.arme || {}, lob = A.type === 'lob', pul = 0.5 + 0.5 * Math.sin(temps * 0.15);
  if (aff3) { visee3D = { a, f, lob, P, R: +A.rayon || 70, c: A.couleur || '#ffe14a' }; return; } // 🎯 visée en 3D
  ctx.save(); ctx.translate(moi.x, moi.y); ctx.rotate(a); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lob) { const d = Math.max(60, P * f), R = +A.rayon || 70;
    ctx.setLineDash([10, 12]); ctx.lineDashOffset = -temps; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(moi.r, 0); ctx.lineTo(d - R, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(d, 0, R, 0, 7); ctx.fillStyle = `rgba(255,225,74,${0.18 + 0.1 * pul})`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = NOIR; ctx.stroke();
    ctx.beginPath(); ctx.arc(d, 0, R * (0.3 + 0.2 * pul), 0, 7); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; ctx.stroke(); }
  else { const L = P, g = ctx.createLinearGradient(moi.r, 0, L, 0); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,.08)');
    ctx.beginPath(); ctx.moveTo(moi.r, -10); ctx.lineTo(L, -16); ctx.lineTo(L, 16); ctx.lineTo(moi.r, 10); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(11,6,32,.55)'; ctx.stroke();
    ctx.fillStyle = '#ffe14a'; for (let i = 0; i < 4; i++) { const x = moi.r + 30 + ((temps * 3 + i * (L / 4)) % (L - moi.r - 30)); ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + 12, 0); ctx.lineTo(x, 8); ctx.lineTo(x + 5, 0); ctx.closePath(); ctx.fill(); } }
  ctx.restore();
}
function barreVie(e, couleur, nom) { // pastille nom + barre de vie + munitions, toujours AU-DESSUS du perso
  const w = Math.max(64, e.r * 2.3), top = e.topT >= temps - 1 ? e.topY : e.y - e.r * 1.7, x = e.x - w / 2, y = top - 14;
  if (nom) { ctx.font = '700 11px Fredoka, system-ui, sans-serif'; const tw = Math.min(150, ctx.measureText(nom).width + 18);
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
function dessinerHUD() {
  zones = []; hudExtra(); hudElem();
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
  }
  dessinerJoystick(joyG, '#ffffff');
  dessinerJoystick(joyD, '#ffb000'); if (joyS.actif) dessinerJoystick(joyS, '#ffe14a'); ecran();
  if (!mobile) texte(`${['haut', 'gauche', 'bas', 'droite'].map(a => libTouche(mesTouches[a])).join('')}/flèches : bouger • Clic : tirer • ${libTouche(mesTouches.auto)} : tir auto • ${libTouche(mesTouches.action)} : action • ${libTouche(mesTouches.super)} : super • Échap : quitter`, W / 2, H - 16, 12, '#fff');
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
if (document.fonts) ['40px Bangers', '600 20px Fredoka'].forEach(f => document.fonts.load(f).catch(() => {}));
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
    quitterSalle(); etat = 'MENU'; modeIndex = p.sig ? Math.max(0, modes().findIndex(m => signature(m) === p.sig)) : p.mode; chercherPartie({ rejoindre: p.salle });
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
  const lx = x0 + gw + 16 * u, lw = W - lx - 20 * u, enL = new Set(enLigneListe.map(j => j.uid)), nd = Object.keys(demandesAmis).length, tw = (lw - 30 * u) / 4;
  [['amis', 'Amis'], ['demandes', 'Demandes' + (nd ? ' (' + nd + ')' : '')], ['journal', 'Journal'], ['recherche', '🔍 Rechercher']].forEach(([k, t], i) => { const x = lx + i * (tw + 10 * u), on = amisOnglet === k;
    bouton3D(x, y0, tw, 36 * u, on ? '#ffe14a' : '#6a5cff', on ? '#ff8a1f' : '#3a2d9c', () => { amisOnglet = k; if (k === 'recherche') chercherAmi(); }); titre(t, x + tw / 2, y0 + 17 * u, 14 * u, '#fff', 'center', tw - 10 * u); });
  let la = [];
  if (amisOnglet === 'amis') la = Object.entries(mesAmis).filter(([k]) => k !== '_init').map(([uid, v]) => ({ uid, nom: nomAmi(v), en: enL.has(uid) })).sort((a, b) => b.en - a.en);
  else if (amisOnglet === 'demandes') la = Object.entries(demandesAmis).map(([uid, v]) => ({ uid, nom: nomAmi(v), dem: true }));
  else if (amisOnglet === 'journal') { try { JSON.parse(localStorage.getItem('bastoryJournal') || '[]').forEach(c => c.j.forEach(j => { if (!la.some(x => x.uid === j.uid)) la.push({ ...j, en: enL.has(j.uid), info: (c.r === 'VICTOIRE' ? '🏆 ' : c.r === 'DEFAITE' ? '💀 ' : '🤝 ') + c.mode + (j.allie ? ' • allié' : ' • adversaire') + ' • ' + new Date(c.t).toLocaleDateString() }); })); } catch (e) {} }
  else la = (rechercheAmis && rechercheAmis.l) || [];
  const vide = { amis: 'Pas encore d\'amis : recherche un pseudo ou ajoute tes adversaires depuis le Journal', demandes: 'Aucune demande en attente', journal: 'Aucun combat en ligne pour l\'instant', recherche: rechercheAmis && !rechercheAmis.l ? 'Recherche…' : 'Aucun joueur trouvé' };
  if (!la.length) return texte(vide[amisOnglet], lx + lw / 2, y0 + 90 * u, 14 * u, 'rgba(255,255,255,.75)', 'center', lw - 20 * u);
  const rh = 54 * u, nb = Math.max(1, Math.floor((h - 50 * u) / (rh + 8 * u)));
  la.slice(0, nb).forEach((j, i) => {
    const y = y0 + 48 * u + i * (rh + 8 * u), bw = 120 * u, bx = lx + lw - bw - 12 * u, by = y + 9 * u, bh = rh - 18 * u; verre(lx, y, lw, rh, 16 * u);
    avatarLettre(j.nom, lx + 32 * u, y + rh / 2, 18 * u); texte(j.nom, lx + 60 * u, y + rh / 2 - (j.info ? 8 * u : 0), 15 * u, '#fff', 'left', lw - 320 * u);
    if (j.info) texte(j.info, lx + 60 * u, y + rh / 2 + 10 * u, 10 * u, 'rgba(255,255,255,.65)', 'left', lw - 320 * u);
    if (j.en) { ctx.beginPath(); ctx.arc(lx + 46 * u, y + rh / 2 + 12 * u, 5 * u, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill(); }
    const B = (x, t, c1, c2, f) => { bouton3D(x, by, bw, bh, c1, c2, f); texte(t, x + bw / 2, y + rh / 2, 13 * u, '#fff', 'center', bw - 8 * u); };
    if (j.dem) { B(bx - bw - 8 * u, 'Accepter', '#34d399', '#1f9d5a', () => accepterAmi(j.uid, j.nom)); B(bx, 'Refuser', '#ff6b61', '#d93a30', () => refuserAmi(j.uid)); }
    else if (mesAmis[j.uid]) {
      if (groupe.membres[j.uid] || groupe.chef === j.uid) texte('✔ Dans ton groupe', bx + bw, y + rh / 2, 12 * u, '#34d399', 'right');
      else if (j.en && !(invitesEnvoyees[j.uid] && temps - invitesEnvoyees[j.uid] < 1800)) B(bx, 'Inviter', '#3a9bff', '#0a6cff', () => inviter(j.uid));
      else texte(j.en ? 'Invitation envoyée…' : 'Hors ligne', bx + bw, y + rh / 2, 12 * u, 'rgba(255,255,255,.6)', 'right');
      if (amisOnglet === 'amis') { bouton3D(bx - 50 * u, by, 40 * u, bh, '#8b8fa8', '#5d6778', () => { if (confirm('Retirer ' + j.nom + ' de tes amis ?')) retirerAmi(j.uid); }); texte('✕', bx - 30 * u, y + rh / 2, 14 * u, '#fff'); }
    }
    else if (demandesEnvoyees[j.uid]) texte('Demande envoyée', bx + bw, y + rh / 2, 12 * u, 'rgba(255,255,255,.6)', 'right');
    else B(bx, '➕ Ajouter', '#ffd23f', '#ff8a1f', () => demanderAmi(j.uid, j.nom));
  });
}

// ---------- 14b. MENU PRINCIPAL (style arcade) ----------
// Écrans : accueil • persos • modes • classement • pouvoirs
let ecranMenu = 'accueil', persoVue = 0, pageMenu = 0, mesStats = { points: 0, victoires: 0, parties: 0 }, classement = null, classementT = -9999;
const cacheMini = {};
const U = () => Math.max(0.6, Math.min(1.35, Math.min(W / 900, H / 440)));   // échelle de l'interface selon l'écran
const selPerso = () => CONFIG.persos[persoIndex] || CONFIG.persos[0];
const modesStyle = m => m.type === 'solo' ? ['🧍', '#4cd964', '#1f9d3a', 'Solo'] : m.equipes === 'coop' ? ['🤝', '#5ac8fa', '#1d74c9', 'Coop']
  : nbEquipes(m) ? ['⚔️', '#ff9f43', '#d35400', nbEquipes(m) + ' équipes'] : ['👥', '#ff6b6b', '#c0392b', 'Chacun pour soi'];
function emoji(t, x, y, taille) { // les emojis d'éléments sont remplacés par des icônes dessinées
  const k = Object.keys(ELEM_DEF).find(k => ((CONFIG.elements || {})[k] || {}).icone === t); if (k) return iconeElement(k, x, y, taille);
  ctx.font = `${taille}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
let transT = -99, vagues = [];
function allerA(e) { ecranMenu = e; pageMenu = 0; transT = temps; }
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
    dessinerAvatar(monAvatar(), 33 * u, 30 * u, 17 * u); zones.push({ x: 12 * u, y: 9 * u, w: 230 * u, h: 42 * u, action: () => allerA('avatar') });
    texte(nomJoueur(), 58 * u, 23 * u, 14 * u, '#fff', 'left', 175 * u);
    texte(mesStats.victoires + ' victoires • ' + mesStats.parties + ' parties', 58 * u, 39 * u, 10 * u, 'rgba(255,255,255,.65)', 'left');
    zones.push({ x: 12 * u, y: 9 * u, w: 230 * u, h: 42 * u, action: () => ouvrirProfil(auth, p => db && db.collection('joueurs').doc(user.uid).set({ pseudo: p }, { merge: true })) });
  }
  pastille(W - 356 * u, 12 * u, 124 * u, 'trophee', mesStats.points + ' pts', null, '#ffd400'); zones.push({ x: W - 356 * u, y: 12 * u, w: 124 * u, h: 34 * u, action: () => allerA('classement') });
  pastille(W - 224 * u, 12 * u, 118 * u, '●', enLigne + ' en ligne'); zones.push({ x: W - 224 * u, y: 12 * u, w: 118 * u, h: 34 * u, action: () => allerA('amis') });
  ctx.beginPath(); ctx.arc(W - 224 * u + 19 * u, 29 * u, 5 * u, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill();
  if (estAdmin(user)) { verre(W - 98 * u, 12 * u, 36 * u, 34 * u, 17 * u); icone('reglages', W - 80 * u, 29 * u, 18 * u); // ⚙️ visible seulement pour les admins
    zones.push({ x: W - 98 * u, y: 12 * u, w: 36 * u, h: 34 * u, action: () => location.href = 'admin.html' }); }
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
  ({ accueil: menuAccueil, persos: menuPersos, modes: menuModes, classement: menuClassement, pouvoirs: menuPouvoirs, amis: menuAmis, recompenses: menuRecompenses, commandes: menuCommandes, hud: menuHud, avatar: menuAvatar })[ecranMenu]();
  const kt = Math.min(1, (temps - transT) / 14); if (kt < 1) { ctx.fillStyle = `rgba(5,7,15,${(1 - kt) * 0.9})`; ctx.fillRect(-100, -100, W + 200, H + 200); } // fondu entre écrans
  dessinerVagues(); dessinerNotif();
  if (invitations.length) modaleInvitation();
}

// --- Accueil (style jeux récents : héros éclairé, navigation latérale, lobby d'équipe, gros bouton JOUER)
function menuAccueil() {
  const u = U(), p = selPerso(), a = CONFIG.armes[p.arme] || {}, m = modeChoisi(), [, c1, c2, lab] = modesStyle(m), multi = m.type === 'multi';
  const top = barreHaut();
  // navigation à gauche
  const nav = [['perso', 'Persos', 'persos', '#5ac8fa', '#2f6bff'], ['amis', 'Amis', 'amis', '#4ade80', '#059669'], ['classement', 'Classement', 'classement', '#ffc24b', '#ff7a00'], ['eclair', 'Pouvoirs', 'pouvoirs', '#ff7ac0', '#b43cff'], ['trophee', 'Récompenses', 'recompenses', '#ffe14a', '#ff8a1f'], ['reglages', 'Commandes', 'commandes', '#5ff0ff', '#1e7bff']];
  nav.forEach(([ic, t, e, a1, a2], k) => {
    const y = top + 14 * u + k * 52 * u, w = 158 * u;
    boutonJeu(14 * u, y, w, 42 * u, a1, a2, () => allerA(e));
    icone(ic, 40 * u, y + 21 * u, 20 * u); titre(t, 58 * u, y + 22 * u, 20 * u, '#fff', 'left', w - 80 * u);
    if (e === 'amis' && Object.keys(demandesAmis).length) { ctx.save(); ctx.translate(w - 6 * u, y + 4 * u); eclat(0, 0, 11 * u, 8, '#ff2d55', 2, NOIR, 2 * u); ctx.restore(); texte(String(Object.keys(demandesAmis).length), w - 6 * u, y + 5 * u, 11 * u, '#fff'); }
    if (e === 'recompenses' && nbRecompenses()) { ctx.save(); ctx.translate(w - 6 * u, y + 4 * u); eclat(0, 0, 11 * u, 8, '#ff2d55', 2, NOIR, 2 * u); ctx.restore(); texte(String(nbRecompenses()), w - 6 * u, y + 5 * u, 11 * u, '#fff'); }
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
    const T = Math.round(Math.min(720, taille * 1.35 * dpr)), c = vh.rendre(heroAngle, T, ...animMenu(vh, p)), D = taille * 0.82 * Math.min(1, 0.72 + 0.2 * Math.min(1.4, +p.modeleEchelle || 1)) / Math.max(0.2, (vh.bas - vh.haut) || 0.7);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, cx - D / 2, sol - 4 * u - vh.bas * D, D, D);
  } else if (pret(im)) ctx.drawImage(im, cx - taille / 2, cy - taille / 2 - 14 * u + b, taille, taille);
  heroZone = { x: cx - taille / 2, y: cy - taille / 2, w: taille, h: taille };
  const ny = Math.min(H - 64 * u, sol + 34 * u), sp = (mesStats.persos || {})[cleP(p)] || {};
  titre(p.nom, cx, ny, 46 * u, '#fff', 'center', Math.max(160 * u, taille * 1.1));
  const lw = Math.min(taille, 220 * u); rect(cx - lw / 2, ny + 22 * u, lw, 3 * u, 2, p.couleur);
  const elA = elemDe(p), infos = [['eclair', (elA ? elA.icone + ' ' : '') + 'Niv. ' + niveauDe(p)], ['coeur', statsNiveau(p, niveauDe(p)).pvMax], ['cible', a.nom || p.arme], ['trophee', (sp.points || 0) + ' pts']];
  ctx.font = `700 ${12 * u}px Fredoka, system-ui, sans-serif`; // infos centrées, espacées selon leur longueur réelle
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
    if (mb) { if (mb.moi) dessinerAvatar(monAvatar(), sx, sy, r); else avatarLettre(mb.nom, sx, sy, r); }
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
  heroZone = null; persoVue = persoVue % n;
  { // grand perso au centre
  const p = CONFIG.persos[persoVue], el = elemDe(p), c = (el && el.couleur) || p.couleur || '#5a4dff', cx = x0 + zoneW / 2, sol = y0 + zoneH - 84 * u, taille = Math.min(zoneH * 0.9, zoneW * 0.75);
  const off = (1 - sortir(Math.min(1, (temps - persoAnim.t) / 14))) * persoAnim.d * 140 * u;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, zoneW, zoneH); ctx.clip(); rayons(cx, sol - taille * 0.45, temps * 0.004, ombrer(c, 0.35), 0.3, 16);
  const hg = ctx.createRadialGradient(cx, sol - taille * 0.4, 0, cx, sol - taille * 0.4, taille * 0.6); hg.addColorStop(0, c + '88'); hg.addColorStop(1, c + '00'); ctx.fillStyle = hg; ctx.fillRect(x0, y0, zoneW, zoneH); ctx.restore();
  ctx.save(); ctx.translate(cx, sol); ctx.scale(1, 0.26); const og = ctx.createRadialGradient(0, 0, 0, 0, 0, taille * 0.4); og.addColorStop(0, 'rgba(0,0,0,.5)'); og.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, taille * 0.4, 0, 7); ctx.fill(); ctx.restore();
  const vh = vitrineHero(p), gris = !estDebloque(p); if (gris) ctx.filter = 'grayscale(1) brightness(.55)';
  if (vh) { const T = Math.round(Math.min(720, taille * 1.3 * dpr)), im3 = vh.rendre(heroAngle, T, ...animMenu(vh, p)), D = taille * 0.95 * Math.min(1, 0.72 + 0.2 * Math.min(1.4, +p.modeleEchelle || 1)) / Math.max(0.2, (vh.bas - vh.haut) || 0.7);
    ctx.drawImage(im3, cx - D / 2 + off, sol - 4 * u - vh.bas * D, D, D); }
  else { const im = carteDe(p); if (pret(im)) ctx.drawImage(im, cx - taille / 2 + off, sol - taille, taille, taille); }
  ctx.filter = 'none'; if (gris) { titre('🔒 ' + (+p.coutJetons || 3) + ' 🎟️', cx, sol - taille * 0.45, 34 * u, '#ffe14a'); texte('Tu as ' + (mesStats.jetons || 0) + ' 🎟️ jetons perso', cx, sol - taille * 0.45 + 30 * u, 13 * u, '#fff'); }
  titre(p.nom, cx + off * 0.5, sol + 24 * u, 40 * u, '#fff', 'center', zoneW - 120 * u);
  elementsDe(p).forEach((k, n) => iconeElement(k, cx - 70 * u - n * 24 * u, sol + 56 * u, 20 * u)); // tous ses éléments
  if (p.description) texte(p.description, cx, sol - taille * 0.95 + 8 * u, 13 * u, '#fff', 'center', zoneW - 140 * u); // 📝 description du perso et de ses attaques
  texte('Niveau ' + niveauDe(p) + (persoVue === persoIndex ? '  •  ✔ Choisi' : ''), cx + 10 * u, sol + 56 * u, 13 * u, persoVue === persoIndex ? '#b6ff4a' : '#ffe14a');
  [[-1, 'retour', x0 + 34 * u], [1, 'suite', x0 + zoneW - 34 * u]].forEach(([d, ic, fx]) => { bouton3D(fx - 26 * u, y0 + zoneH / 2 - 26 * u, 52 * u, 52 * u, '#ffe14a', '#ff8a1f', () => changerPerso(d), 26 * u); icone(ic, fx, y0 + zoneH / 2 - 2 * u, 24 * u); });
  CONFIG.persos.forEach((_, k) => { ctx.beginPath(); ctx.arc(cx + (k - (n - 1) / 2) * 16 * u, y0 + 30 * u, (k === persoVue ? 5 : 3.5) * u, 0, 7); ctx.fillStyle = k === persoVue ? '#ffe14a' : 'rgba(255,255,255,.55)'; ctx.fill(); });
  }

  // fiche du perso
  const p = CONFIG.persos[persoVue] || selPerso(), a = CONFIG.armes[p.arme] || {}, px = W - panW - 14 * u, py = y0, ph = H - py - 14 * u;
  verre(px, py, panW, ph, 18 * u); rect(px, py, panW, 6 * u, 3 * u, p.couleur);
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
  if (epF) texte(`${epF.icone} ${epF.nom} • Niveau ${niveauDe(p)} • ${({ vol: 'vole au-dessus des blocs', saut: 'saute par-dessus les murs', nage: 'se déplace sur l\'eau', feu: 'laisse une traînée de feu', brise: 'brise les blocs', sol: '' })[epF.capacite] || ''}`, px + panW / 2, py + is + 2 * u, 11 * u, epF.couleur, 'center', panW - 20 * u);
  const ie = ELEM_DEF[cleElem(p)] && { ...ELEM_DEF[cleElem(p)], ...epF }; if (ie) texte(`⭐ Super : ${ie.superNom}  •  🎮 Action : ${ie.actionNom}`, px + panW / 2, py + is + 16 * u, 11 * u, '#ffe14a', 'center', panW - 20 * u);
  texte(`🏆 ${sp.points || 0} pts  •  ⭐ ${sp.victoires || 0} victoires  •  🎮 ${sp.parties || 0} parties`, px + panW / 2, py + is + 30 * u, 11 * u, '#ffe8a3');
  const sy = py + is + 46 * u, pas = Math.min(24 * u, (ph - is - 162 * u) / st.length);
  st.forEach((s, k) => statBarre(px + 12 * u, sy + k * pas, panW - 24 * u, ...s));
  const choisi = persoVue === persoIndex, bh = 44 * u, bw = (panW - 50 * u) / 2, by = py + ph - bh - 12 * u, ep = elemDe(p), nvP = niveauDe(p), maxN = +(CONFIG.progression || {}).niveauMax || 10;
  if (ep) { bouton3D(px + 20 * u, by, bw, bh, nvP >= maxN ? '#9aa5b8' : ep.couleur, nvP >= maxN ? '#5d6778' : ombrer(ep.couleur, -0.35), () => evoluer(p));
    texte(nvP >= maxN ? 'Niveau max' : `Évoluer • ${coutNiveau(nvP)} ${ep.icone}`, px + 20 * u + bw / 2, by + bh / 2, 13 * u, '#fff', 'center', bw - 12 * u); }
  const verrou = !estDebloque(p);
  bouton3D(ep ? px + 30 * u + bw : px + 20 * u, by, ep ? bw : panW - 40 * u, bh, verrou ? '#ffd23f' : choisi ? '#9aa5b8' : '#4cd964', verrou ? '#ff8a1f' : choisi ? '#5d6778' : '#1f9d3a', verrou ? () => debloquerPerso(p) : choisi ? null : () => { persoIndex = persoVue; allerA('accueil'); });
  texte(verrou ? '🔓 ' + (+p.coutJetons || 3) + ' 🎟️' : choisi ? '✔ Choisi' : 'Choisir', (ep ? px + 30 * u + bw * 1.5 : px + panW / 2), by + bh / 2, 15 * u, '#fff');
  // porte-monnaie d'essences
  const els = Object.entries(CONFIG.elements || {}), pw = (panW - 40 * u - (els.length - 1) * 6 * u) / Math.max(1, els.length);
  els.forEach(([k, e2], n) => { const ex = px + 20 * u + n * (pw + 6 * u); verre(ex, by - 36 * u, pw, 26 * u, 13 * u); texte(e2.icone + ' ' + ((mesStats.essences || {})[k] || 0), ex + pw / 2, by - 23 * u, 12 * u, '#fff', 'center', pw - 8 * u); }); // essences
}

// --- Modes de jeu + choix de la map
const mapsActives = () => { const l = CONFIG.maps.map((m, i) => i).filter(i => CONFIG.maps[i].actif !== false); return l.length ? l : CONFIG.maps.map((m, i) => i); }; // maps cochées dans l'admin
let modeAnim = { t: -99, d: 0 }, glisse = null, persoAnim = { t: -99, d: 0 };
const changerPerso = d => { const n = CONFIG.persos.length; persoVue = ((persoVue % n) + d + n) % n; persoAnim = { t: temps, d }; };
const changerMode = d => { const n = modes().length; modeIndex = ((modeIndex % n) + d + n) % n; modeAnim = { t: temps, d }; };
const changerMap = d => { const n = mapsActives().length; mapIndex = ((mapIndex % n) + d + n) % n; };
function carteMode(md, x, y, w, h, sel, grand) { // case de BD d'un mode (mini-map du terrain en fond)
  const u = U(), [, c1, c2, lab] = modesStyle(md), r = 18 * u, s = grand ? 1.25 : 1;
  rect(x + 5 * u, y + 6 * u, w, h, r, NOIR);
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); rect(x, y, w, h, r, g);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  if (sel) rayons(x + w * 0.75, y + h * 0.5, temps * 0.006, '#fff', 0.16, 14);
  ctx.globalAlpha = 0.4; ctx.drawImage(miniMap(CONFIG.maps[mapChoisie(md)] || CONFIG.maps[0]), x + w * 0.48, y, w * 0.56, h); ctx.globalAlpha = 1;
  const fg = ctx.createLinearGradient(x, 0, x + w, 0); fg.addColorStop(0.4, c2); fg.addColorStop(0.85, c2 + '00'); ctx.fillStyle = fg; ctx.fillRect(x, y, w, h);
  trame(0.07, '#000'); ctx.restore();
  rect(x, y, w, h, r, null, sel ? '#ffe14a' : NOIR, (sel ? 4.5 : 3) * u);
  texte(lab.toUpperCase() + (md.type === 'multi' ? ' • EN LIGNE' : ' • SOLO'), x + 16 * u, y + 18 * u * s, 10 * u * s, '#fff', 'left', w - 60 * u);
  titre(md.nom, x + 16 * u, y + 44 * u * s, 24 * u * s, '#fff', 'left', w - 32 * u);
  lignes(md.description || '', w * 0.6, 11 * u * s).slice(0, grand ? 3 : h > 120 * u ? 2 : 1).forEach((l, j) => texte(l, x + 16 * u, y + (68 + j * 15) * u * s, 11 * u * s, '#fff', 'left', w * 0.6));
  const OBJ = { zone: 'Zone', bloc: 'Cristaux', tresor: 'Trésors', marathon: 'Marathon' };
  let ix = x + 16 * u; const iy = y + h - 18 * u * s;
  [['amis', md.type === 'multi' ? (md.joueursMin === md.joueursMax ? md.joueursMax : md.joueursMin + '-' + md.joueursMax) : '1'], ['trophee', '+' + md.pointsVictoire],
   OBJ[md.objectif] ? ['cible', OBJ[md.objectif]] : md.boss && md.nbBoss ? ['eclair', md.nbBoss + ' boss'] : null].filter(Boolean).forEach(([ic, v]) => {
    icone(ic, ix + 7 * u, iy, 13 * u * s, ic === 'trophee' ? '#ffe14a' : '#fff'); texte(String(v), ix + 18 * u * s, iy, 11 * u * s, '#fff', 'left');
    ctx.font = `600 ${11 * u * s}px Fredoka, system-ui`; ix += ctx.measureText(String(v)).width + 36 * u * s; });
  if (sel) { ctx.save(); ctx.translate(x + w - 22 * u, y + 22 * u); eclat(0, 0, 14 * u, 8, '#b6ff4a', 1, NOIR, 2 * u); ctx.restore(); texte('✔', x + w - 22 * u, y + 22 * u, 12 * u, '#fff'); }
}
function vignetteMap(i, x, y, w, h, sel) { // aperçu d'une map + son nom
  const def = CONFIG.maps[i]; dessinerMiniMap(def, x, y, w, h - 16 * U());
  texte(def.nom, x + w / 2, y + h - 6 * U(), 11 * U(), sel ? '#ffe14a' : '#fff', 'center', w);
  if (sel) rect(x - 3, y - 3, w + 6, h - 16 * U() + 6, 8, null, '#ffe14a', 3);
}
function menuModes() { // 🖥️ ordi : grille de cases • 📱 mobile : une grande case à la fois (flèches ou glisser)
  const u = U(), top = barreHaut('Modes de jeu', true), liste = modes(), m = modeChoisi(), act = mapsActives(), impose = m.map >= 0 && CONFIG.maps[m.map];
  if (mobile || H < 480) {
    const n = liste.length, i = modeIndex % n, cw = Math.min(W - 160 * u, 560 * u), ch = Math.min(H - top - 150 * u, 210 * u), y = top + 6 * u;
    const off = (1 - sortir(Math.min(1, (temps - modeAnim.t) / 12))) * modeAnim.d * 90 * u;
    carteMode(liste[i], W / 2 - cw / 2 + off, y, cw, ch, true, true);
    zones.push({ x: W / 2 - cw / 2, y, w: cw, h: ch, action: () => {} });
    [[-1, 'retour', W / 2 - cw / 2 - 40 * u], [1, 'suite', W / 2 + cw / 2 + 40 * u]].forEach(([d, ic, fx]) => {
      bouton3D(fx - 28 * u, y + ch / 2 - 28 * u, 56 * u, 56 * u, '#ffe14a', '#ff8a1f', () => changerMode(d), 28 * u); icone(ic, fx, y + ch / 2 - 2 * u, 26 * u); });
    liste.forEach((_, k) => { ctx.beginPath(); ctx.arc(W / 2 + (k - (n - 1) / 2) * 16 * u, y + ch + 16 * u, (k === i ? 5 : 3.5) * u, 0, 7); ctx.fillStyle = k === i ? '#ffe14a' : 'rgba(255,255,255,.55)'; ctx.fill(); });
    const my = y + ch + 30 * u, mh = H - my - 10 * u, bw = 130 * u;
    boutonJeu(W - 20 * u - bw, my + mh - 52 * u, bw, 48 * u, '#b6ff4a', '#1fc46b', () => allerA('accueil')); titre('OK !', W - 20 * u - bw / 2, my + mh - 29 * u, 24 * u, '#fff');
    if (impose) { texte('🗺️ Map : ' + CONFIG.maps[m.map].nom, 20 * u, my + mh / 2, 14 * u, '#fff', 'left', W - bw - 60 * u); return; }
    const mi = mapIndex % act.length, pw = Math.min((mh - 4 * u) * 1.5, W - bw - 180 * u), px = 20 * u + 56 * u;
    bouton3D(20 * u, my + mh / 2 - 22 * u, 44 * u, 44 * u, '#8e7bff', '#5b3fd6', () => changerMap(-1), 22 * u); icone('retour', 42 * u, my + mh / 2, 20 * u);
    vignetteMap(act[mi], px, my, pw, mh, true);
    bouton3D(px + pw + 12 * u, my + mh / 2 - 22 * u, 44 * u, 44 * u, '#8e7bff', '#5b3fd6', () => changerMap(1), 22 * u); icone('suite', px + pw + 34 * u, my + mh / 2, 20 * u);
    return;
  }
  const mapH = impose ? 40 * u : 130 * u, x0 = 20 * u, y0 = top + 14 * u, zoneW = W - 40 * u, gap = 16 * u, zoneH = H - y0 - mapH - 28 * u;
  const cols = Math.max(2, Math.min(4, Math.floor(zoneW / (240 * u)))), cw = (zoneW - (cols - 1) * gap) / cols, chh = Math.max(100 * u, Math.min(150 * u, zoneH));
  const rows = Math.max(1, Math.floor((zoneH + gap) / (chh + gap))), parPage = cols * rows, pages = Math.ceil(liste.length / parPage);
  pageMenu = Math.min(pageMenu, pages - 1);
  liste.slice(pageMenu * parPage, (pageMenu + 1) * parPage).forEach((md, k) => {
    const i = pageMenu * parPage + k, x = x0 + (k % cols) * (cw + gap), y = y0 + Math.floor(k / cols) * (chh + gap);
    carteMode(md, x, y, cw, chh, i === modeIndex % liste.length, false); zones.push({ x, y, w: cw, h: chh, action: () => modeIndex = i });
  });
  if (pages > 1) {
    const py = H - mapH - 58 * u, px = W - 104 * u;
    [[-1, 'retour'], [1, 'suite']].forEach(([d, ic], k) => { verre(px + k * 46 * u, py, 38 * u, 36 * u, 18 * u); icone(ic, px + k * 46 * u + 19 * u, py + 18 * u, 18 * u);
      zones.push({ x: px + k * 46 * u, y: py, w: 38 * u, h: 36 * u, action: () => pageMenu = (pageMenu + d + pages) % pages }); });
    texte((pageMenu + 1) + ' / ' + pages, px - 14 * u, py + 18 * u, 12 * u, '#fff', 'right');
  }
  const my = H - mapH - 14 * u;
  if (impose) { verre(x0, my, zoneW, mapH, mapH / 2); texte('🗺️ Map imposée par ce mode : ' + CONFIG.maps[m.map].nom, x0 + 20 * u, my + mapH / 2, 13 * u, '#fff', 'left', zoneW - 40 * u); return; }
  verre(x0, my, zoneW, mapH, 20 * u); titre('Map', x0 + 18 * u, my + 20 * u, 18 * u, '#fff', 'left');
  const th = mapH - 44 * u, tw = th * 1.5;
  act.forEach((mi, k) => { const x = x0 + 18 * u + k * (tw + 16 * u), y = my + 34 * u; if (x + tw > x0 + zoneW - 10 * u) return;
    vignetteMap(mi, x, y, tw, th, k === mapIndex % act.length); zones.push({ x, y, w: tw, h: th, action: () => mapIndex = k }); });
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
  ctx.fillStyle = aff3 ? 'rgba(20,0,50,.25)' : 'rgba(0,0,0,.75)'; ctx.fillRect(-100, -100, W + 200, H + 200);
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
  if (!aff3) G.forEach((c, i) => { // gagnants : rebondissent avec une couronne
    const x = W / 2 + (i - (G.length - 1) / 2) * tg * 1.15, y = cy + Math.sin(t * 0.12 + i) * 8 - Math.max(0, 25 - t) * 12;
    ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; ellipse(x, y, tg * 0.45, tg * 0.45, 'rgba(255,210,63,.35)'); ctx.restore();
    if (pret(c.im)) ctx.drawImage(c.im, x - tg / 2, y - tg / 2, tg, tg);
    ctx.save(); ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 18; icone('trophee', x, y - tg * 0.58 + Math.sin(t * 0.15) * 3, tg * 0.26, '#ffd400'); ctx.restore();
    texte(c.nom, x, y + tg * 0.6, 15, '#fff', 'center', tg * 1.1);
  });
  const tp = tg * 0.5, py = H * 0.74 + Math.min(t, 40) * 0.3;
  if (!aff3) P.forEach((c, i) => { // perdants : en gris, penchés
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
    const ey = y + (1 - elastique(Math.min(1, (t - 40) / 20))) * 90 * u; // les boutons arrivent en rebondissant
    boutonJeu(W / 2 - bw - 12 * u, ey, bw, bh, '#b6ff4a', '#1fc46b', () => { quitterSalle(); etat = 'MENU'; lancerPartie(); }); icone('retour', W / 2 - bw + 18 * u, ey + bh / 2, 18 * u, '#fff'); titre('Rejouer', W / 2 - bw / 2 - 2 * u, ey + bh / 2, 22 * u, '#fff');
    bouton3D(W / 2 + 12 * u, ey, bw, bh, '#8e7bff', '#5b3fd6', () => { quitterSalle(); etat = 'MENU'; allerA('accueil'); }); icone('carte', W / 2 + 42 * u, ey + bh / 2, 18 * u, '#fff'); titre('Menu', W / 2 + bw / 2 + 22 * u, ey + bh / 2, 22 * u, '#fff');
  }
  finManga();
}


// ---------- 16. ÉVÉNEMENTS DE PARTIE : intro, mort, réapparition, spectateur, poison, fumée ----------
let introT = 0, debutJeu = 0, kills = {}, nuages = [], dots = [], fantomes = [], suivi = null;
function animMort(e, im) {
  if (e.tresors && obj() === 'tresor' && moiOuBot(e)) lacherTresors(e);
  ono('K.O. !!', e.x, e.y - 30, 1.8, '#ff2d55'); choc = 1.3; flash = 0.6; // le perso tourne, rétrécit et s'envole en fondu
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
  if (obj() !== 'zone' || !map.z) return;
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
  if (obj() === 'zone') { // progression de la zone
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
if (!window._bastoryBoucle) { window._bastoryBoucle = true; boucle(); } // une seule boucle même si le script est chargé deux fois
// 📂 Nouveaux persos automatiques : tout fichier .glb déposé dans "modeles/" sur GitHub devient un perso jouable.
// Nom du fichier = nom du perso ; préfixe facultatif pour l'élément : "feu-dragon.glb", "eau-requin.glb"…
async function detecterModeles() {
  try {
    const hote = location.hostname.match(/^([^.]+)\.github\.io$/), depot = (CONFIG.app && CONFIG.app.depot) || (hote && hote[1] + '/' + location.pathname.split('/')[1]);
    if (!depot) return;
    const l = await (await fetch(`https://api.github.com/repos/${depot}/contents/modeles`)).json();
    if (!Array.isArray(l)) return;
    const ARME = { terre: 'rocher', air: 'vent', eau: 'trident', feu: 'boulefeu' };
    for (const f of l.filter(f => /^boss[-_ ].+\.glb$/i.test(f.name))) { // 👹 "boss-troll.glb" = modèle 3D d'un boss (jamais un perso)
      const chemin = 'modeles/' + f.name, id = f.name.replace(/^boss[-_ ]|\.glb$/gi, '').toLowerCase().replace(/\W/g, '');
      if (Object.values(CONFIG.bosses).some(b => b.modele === chemin)) continue;
      if (CONFIG.bosses[id]) CONFIG.bosses[id].modele = CONFIG.bosses[id].modele || chemin;
      else CONFIG.bosses[id] = { ...JSON.parse(JSON.stringify(Object.values(CONFIG.bosses)[0])), nom: id.toUpperCase(), modele: chemin, image: '', imageCarte: '' };
    }
    for (const f of l.filter(f => /\.glb$/i.test(f.name) && !/^boss[-_ ]/i.test(f.name))) {
      const chemin = 'modeles/' + f.name; if (CONFIG.persos.some(p => p.modele === chemin)) continue;
      const m = f.name.replace(/\.glb$/i, '').match(/^(terre|air|eau|feu)[-_ ](.+)$/i), element = m ? m[1].toLowerCase() : '', nom = (m ? m[2] : f.name.replace(/\.glb$/i, '')).replace(/[-_]+/g, ' ').toUpperCase().slice(0, 16);
      const el = (CONFIG.elements || {})[element] || {}, a = ARME[element] && CONFIG.armes[ARME[element]] ? ARME[element] : Object.keys(CONFIG.armes)[0];
      CONFIG.persos.push({ deBase: false, coutJetons: 3,  nom, element, modele: chemin, modeleEchelle: 1, modeleRotation: 0, couleur: el.couleur || '#8b5cf6', image: '', imageCarte: '', arme: a,
        pvMax: 5500, vitesse: 5, degats: 1400, portee: 400, delaiTir: 28, munitions: 3, recharge: 55 }); armePour(CONFIG, CONFIG.persos[CONFIG.persos.length - 1]);
    }
  } catch (e) { console.warn('Détection des modèles', e); }
}
detecterModeles().then(preparer3D); // détecte les nouveaux modèles, puis génère les persos 3D en arrière-plan
