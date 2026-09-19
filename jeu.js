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
  if (!cacheImg[src]) { const i = new Image(); i.src = src; cacheImg[src] = i; }
  return cacheImg[src];
}
const pret = i => i && i.complete && i.naturalWidth > 0;
function blanc(i) { // silhouette blanche pour le flash quand on est touché
  if (!cacheBlanc.has(i)) {
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
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
function redim() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  zoom = Math.max(0.55, Math.min(1.3, Math.min(W, H * 1.7) / (TUILE * 15)));
}
addEventListener('resize', redim); redim();
const ecran = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
const carteDe = p => img(p.imageCarte || p.image);   // image "carte" (menu, fin) sinon image du jeu
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
  if (u) { if (etat === 'AUTH') etat = 'MENU'; ecouterPoints(); } else { quitterSalle(); etat = 'AUTH'; }
});

// ---------- 6. MAP & COLLISIONS ----------
// '.' herbe  '#' mur  'B' buisson  'W' eau  'P' départ joueur (2 pour le 1V1)  'E' départ boss  'C' coffre mystère
function chargerMap(def) {
  const l = Math.max(...def.grille.map(r => r.length));
  const g = def.grille.map(r => r.padEnd(l, '.'));
  const m = { def, g, l, h: g.length, j: [], b: [] };
  g.forEach((r, y) => { for (let x = 0; x < l; x++) { if (r[x] === 'P') m.j.push({ x, y }); if (r[x] === 'E') m.b.push({ x, y }); } });
  return m;
}
const tuile = (tx, ty) => (!map || tx < 0 || ty < 0 || tx >= map.l || ty >= map.h) ? '#' : map.g[ty][tx];
const tuileA = (x, y) => tuile(Math.floor(x / TUILE), Math.floor(y / TUILE));
const bloque = c => c === '#' || c === 'W' || c === 'C';
function libre(x, y, r) {
  const k = r * 0.75;
  return ![[-k, -k], [k, -k], [-k, k], [k, k], [0, -k], [0, k], [-k, 0], [k, 0]].some(([a, b]) => bloque(tuileA(x + a, y + b)));
}
function deplacer(e, dx, dy) { if (libre(e.x + dx, e.y, e.r)) e.x += dx; if (libre(e.x, e.y + dy, e.r)) e.y += dy; }
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
function creerJoueur(pi, x, y, uid, nom, eq) {
  const p = CONFIG.persos[pi] || CONFIG.persos[0];
  return { uid, nom, eq, perso: p, arme: CONFIG.armes[p.arme] || Object.values(CONFIG.armes)[0], x, y, tx: x, ty: y, r: 26,
           pv: p.pvMax, pvMax: p.pvMax, angle: 0, recharge: 0, mun: +p.munitions || 3, flash: 0, marche: 0, kx: 0, ky: 0, cache: false, bonus: {}, bo: [] };
}
function creerBoss(id, x, y, i) {
  const ids = Object.keys(CONFIG.bosses);
  if (!CONFIG.bosses[id]) id = ids[Math.floor(Math.random() * ids.length)]; // 'aleatoire' ou inconnu
  const d = CONFIG.bosses[id];
  return { i, id, def: d, x, y, tx: x, ty: y, r: d.taille || 48, pv: d.pvMax, pvMax: d.pvMax, angle: Math.PI, recharge: 60,
           flash: 0, marche: 0, kx: 0, ky: 0, charge: 0, chargeMax: 1, rage: false, cx: x, cy: y, fx: x, fy: y };
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
    const eq = mode.equipes === 'deux' ? k % 2 : mode.equipes === 'coop' ? 0 : k;
    const j = creerJoueur(d.p, sp.x, sp.y, d.uid, d.nom, eq);
    places.push(j);
    if (d.uid === user.uid) moi = j; else autres[d.uid] = j;
  });
  hote = liste[0].uid === user.uid;
  const pvp = new Set(places.map(j => j.eq)).size > 1;
  bosses = [];
  if (hote && mode.boss && mode.nbBoss > 0) for (let i = 0; i < Math.min(10, mode.nbBoss); i++) {
    const e = !pvp && map.b[i] ? { x: c(map.b[i].x), y: c(map.b[i].y) } : caseLibre(places);
    bosses.push(creerBoss(mode.typeBoss, e.x, e.y, i));
  }
  projectiles = []; particules = []; textes = []; ondes = []; objets = []; degatsTuiles = {};
  cam.x = moi.x; cam.y = moi.y; finDans = 0; resultat = ''; messageFin = ''; finInfo = null;
  joyG.actif = joyD.actif = false;
  etat = 'JEU';
}
function verifierFin() {
  if (resultat) return;
  const tous = [moi, ...Object.values(autres)], vivant = j => j.pv > 0 && !j.parti;
  const allies = tous.filter(j => j.eq === moi.eq), ennemis = tous.filter(j => j.eq !== moi.eq);
  if (ennemis.length) {
    if (!ennemis.some(vivant)) finir('VICTOIRE', ennemis.length > 1 ? 'Équipe adverse éliminée' : 'Tu as battu ' + ennemis[0].nom);
    else if (!allies.some(vivant)) finir('DEFAITE', ennemis.filter(vivant).map(j => j.nom).join(', ') + ' gagne');
  } else if (!allies.some(vivant)) finir('DEFAITE', '');
  else if (bosses.length && bosses.every(b => b.pv <= 0)) finir('VICTOIRE', bosses.length > 1 ? 'Tous les boss sont vaincus' : '');
}
function finir(r, msg) {
  if (resultat) return;
  resultat = r; messageFin = msg || ''; finDans = 70; envoyerEtat(true);
  const tous = [moi, ...Object.values(autres)], ennemis = tous.filter(j => j.eq !== moi.eq), allies = tous.filter(j => j.eq === moi.eq);
  const [g, p] = ennemis.length ? (r === 'VICTOIRE' ? [allies, ennemis] : [ennemis, allies]) : (r === 'VICTOIRE' ? [allies, bosses] : [bosses, allies]);
  const carte = e => e.def ? { im: img(e.def.imageCarte || e.def.image), nom: e.def.nom } : { im: carteDe(e.perso), nom: e.nom };
  const uniques = l => l.filter((e, i) => !e.def || l.findIndex(o => o.id === e.id) === i).slice(0, 5).map(carte);
  finInfo = { gagnants: uniques(g), perdants: uniques(p), points: +(r === 'VICTOIRE' ? mode.pointsVictoire : mode.pointsDefaite) || 0, t0: temps + 70 };
  if (db && user) {
    const inc = firebase.firestore.FieldValue.increment;
    db.collection('joueurs').doc(user.uid).set({ pseudo: nomJoueur(), points: inc(finInfo.points), parties: inc(1), victoires: inc(r === 'VICTOIRE' ? 1 : 0) }, { merge: true }).catch(e => console.warn(e));
  }
}
function ecouterPoints() { if (db && user) db.collection('joueurs').doc(user.uid).onSnapshot(d => mesPoints = (d.data() || {}).points || 0, () => {}); }

// ---------- 8. MULTIJOUEUR (Realtime Database) ----------
// Salle d'attente → départ quand le max est atteint (ou 10 s après avoir atteint le minimum).
// Chacun envoie sa position et gère ses PV ; l'hôte (1er joueur) fait vivre les boss.
async function chercherPartie() {
  if (!rtdb) return alert('Multijoueur indisponible : ajoute databaseURL dans firebase-config.js');
  mode = modeChoisi();
  const max = Math.max(2, +mode.joueursMax || 2), min = Math.min(max, Math.max(2, +mode.joueursMin || 2));
  const cle = 'attente/' + mode.nom.replace(/[.#$\[\]\/]/g, '_'), nouvelle = rtdb.ref('salles').push().key;
  etat = 'ATTENTE'; attente = { n: 1, min, max, reste: 0 };
  let pris = null;
  try {
    await rtdb.ref(cle).transaction(v => {
      if (v && v.salle && v.uid !== user.uid && Date.now() - v.t < 60000 && (v.n || 1) < max) { pris = v.salle; return (v.n || 1) + 1 >= max ? null : { ...v, n: (v.n || 1) + 1 }; }
      pris = null; return { uid: user.uid, salle: nouvelle, t: Date.now(), n: 1 };
    });
  } catch (e) { etat = 'MENU'; return alert('Erreur multijoueur : ' + e.message); }
  if (etat !== 'ATTENTE') return;
  const id = pris || nouvelle, s = salle = { id, ref: rtdb.ref('salles/' + id), cle, hote: !pris, uid: user.uid, debut: false, min, max, depuis: 0, js: {} };
  if (s.hote) { rtdb.ref(cle).onDisconnect().remove(); s.ref.onDisconnect().remove(); await s.ref.child('info').set({ map: mapChoisie(mode) }); }
  const moiRef = s.ref.child('joueurs/' + user.uid);
  moiRef.onDisconnect().remove();
  await moiRef.set({ nom: nomJoueur(), p: persoIndex, t: firebase.database.ServerValue.TIMESTAMP });
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
  s.ref.child('evts').on('child_added', snap => { const e = snap.val(); if (salle === s && etat === 'JEU' && e && e.de !== user.uid) recevoir(e); });
  s.ref.child('boss').on('value', snap => { if (salle === s && etat === 'JEU' && !hote) majBossDistants(snap.val() || []); });
}
function lancerSalle() {
  const s = salle; if (!s || s.debut) return; s.debut = true;
  rtdb.ref(s.cle).transaction(v => v && v.salle === s.id ? null : undefined).catch(() => {});
  const liste = Object.entries(s.js).sort((a, b) => (a[1].t || 0) - (b[1].t || 0)).map(([uid, d]) => ({ uid, nom: d.nom, p: d.p }));
  s.ref.child('info').once('value', i => s.ref.child('info/debut').set({ map: (i.val() || {}).map || 0, liste }));
}
function rafraichirAttente() {
  const s = salle; if (!s || !s.hote || s.debut) return;
  attente.reste = s.depuis ? Math.max(0, 10 - Math.floor((Date.now() - s.depuis) / 1000)) : 0;
  if (s.depuis && attente.reste === 0) lancerSalle();
  if (temps % 1200 === 0) rtdb.ref(s.cle).transaction(v => v && v.uid === user.uid ? { ...v, t: Date.now() } : undefined);
}
function quitterSalle() {
  const s = salle; salle = null;
  if (!s || !rtdb) return;
  const finie = etat !== 'JEU' || resultat;
  ['joueurs', 'evts', 'boss', 'info/debut'].forEach(k => s.ref.child(k).off());
  s.ref.child('joueurs/' + s.uid).remove().catch(() => {});
  rtdb.ref(s.cle).transaction(v => !v || v.salle !== s.id ? undefined : s.hote ? null : { ...v, n: Math.max(1, (v.n || 1) - 1) }).catch(() => {});
  if (s.hote && finie) setTimeout(() => s.ref.remove().catch(() => {}), 3000);
}
function envoyer(e) { if (salle) salle.ref.child('evts').push({ ...e, de: user.uid }); }
function envoyerEtat(force) {
  if (!salle || !moi || (!force && temps % 4)) return;
  salle.ref.child('joueurs/' + user.uid).update({ x: Math.round(moi.x), y: Math.round(moi.y), a: +moi.angle.toFixed(2), pv: Math.round(moi.pv), c: moi.cache, m: Math.round(moi.marche), bo: bonusActifs(moi).join(',') });
  if (hote && bosses.length) salle.ref.child('boss').set(bosses.map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), a: +b.angle.toFixed(2), pv: b.pv, ch: b.charge, cm: b.chargeMax, fx: Math.round(b.fx), fy: Math.round(b.fy), rg: b.rage })));
}
function majAutres(js) {
  for (const [uid, j] of Object.entries(autres)) {
    const d = js[uid];
    if (!d) { j.parti = true; j.pv = 0; continue; }
    if (d.x !== undefined) Object.assign(j, { tx: d.x, ty: d.y, angle: d.a, pv: d.pv, cache: d.c, marche: d.m, bo: d.bo ? d.bo.split(',') : [] });
  }
}
function majBossDistants(liste) {
  liste.forEach((d, i) => {
    const b = bosses[i] || (bosses[i] = creerBoss(d.id, d.x, d.y, i));
    Object.assign(b, { tx: d.x, ty: d.y, angle: d.a, charge: d.ch, chargeMax: d.cm || 1, fx: d.fx, fy: d.fy, rage: d.rg });
    if (b.pv > 0 && d.pv <= 0) mortBoss(b);
    b.pv = d.pv;
  });
}
function recevoir(e) {
  const j = autres[e.de];
  if (e.t === 'tir' && j) { j.angle = e.a; creerProjectile(j, e.a, e.f, e.x, e.y, e.d); }
  else if (e.t === 'db' && hote && bosses[e.i]) blesserBoss(bosses[e.i], e.deg);
  else if (e.t === 'fr') frappe(e, false);
  else if (e.t === 'ca') casser(e.tx, e.ty, e.o);
  else if (e.t === 'pr') objets = objets.filter(o => o.tx !== e.tx || o.ty !== e.ty);
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
const joyG = { actif: false }, joyD = { actif: false };
function vec(j) { const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy); return { dx, dy, d, f: Math.min(d / 60, 1), a: Math.atan2(dy, dx) }; }
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (etat !== 'JEU') { clic(t.clientX, t.clientY); continue; }
    const j = t.clientX < W / 2 ? joyG : joyD;
    if (!j.actif) Object.assign(j, { actif: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY });
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) for (const j of [joyG, joyD]) if (j.actif && j.id === t.identifier) { j.x = t.clientX; j.y = t.clientY; }
}, { passive: false });
function finTouche(e) {
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
canvas.addEventListener('mousedown', e => {
  if (etat !== 'JEU') return clic(e.clientX, e.clientY);
  const m = versMonde(e.clientX, e.clientY), d = Math.hypot(m.x - moi.x, m.y - moi.y);
  tirer(Math.atan2(m.y - moi.y, m.x - moi.x), Math.min(1, d / moi.perso.portee));
});
function clic(x, y) {
  if (etat === 'VICTOIRE' || etat === 'DEFAITE') { if (finInfo && temps - finInfo.t0 < 40) return; quitterSalle(); etat = 'MENU'; return; }
  const z = zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  if (z) z.action();
}

// ---------- 10. TIRS & DÉGÂTS ----------
function creerProjectile(j, angle, force, x, y, deg) {
  const a = j.arme, v = a.vitesse || 10;
  const p = { type: a.type, arme: a, perso: j.perso, deg: deg || j.perso.degats, de: j.uid, x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, dist: 0, rot: 0, z: 0, vie: 0, retour: false, touches: new Set() };
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
  const pr = p.de === moi.uid ? moi : autres[p.de], eq = pr ? pr.eq : -1;
  const l = bosses.filter(b => b.pv > 0).map(b => ({ e: b, k: 'b' + b.i }));
  for (const j of joueurs()) if (j.uid !== p.de && j.eq !== eq && j.pv > 0) l.push({ e: j, k: 'j' + j.uid });
  return l;
}
function majProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i], proprio = p.de === moi.uid ? moi : autres[p.de], mien = p.de === moi.uid;
    let fini = ++p.vie > 400 || !proprio;
    if (!fini && p.type === 'lob') {
      p.t++; const k = p.t / p.duree;
      p.x = p.sx + (p.cx - p.sx) * k; p.y = p.sy + (p.cy - p.sy) * k;
      p.z = Math.sin(k * Math.PI) * 110; p.rot += 0.2;
      if (k >= 1) { exploser(p); fini = true; }
    } else if (!fini) {
      if (p.retour) { const a = Math.atan2(proprio.y - p.y, proprio.x - p.x), v = (p.arme.vitesse || 10) * 1.1; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; }
      p.x += p.vx; p.y += p.vy; p.dist += Math.hypot(p.vx, p.vy);
      if (p.type === 'retour') p.rot += 0.45;
      const mur = bloqueTir(tuileA(p.x, p.y));
      if (mur && mien && !p.retour) abimerA(p.x, p.y, p.deg);
      if (p.type === 'retour') {
        if (!p.retour && (p.dist >= p.perso.portee || mur)) { p.retour = true; if (mur) effet('etincelle', p.x, p.y, '#ddd'); }
        if (p.retour && Math.hypot(p.x - proprio.x, p.y - proprio.y) < proprio.r) fini = true;
      } else if (mur || p.dist >= p.perso.portee) { effet('etincelle', p.x, p.y, p.arme.couleur); fini = true; }
      if (!fini) for (const c of cibles(p)) {
        const cle = (p.retour ? 'r' : 'a') + c.k;
        if (!p.touches.has(cle) && Math.hypot(p.x - c.e.x, p.y - c.e.y) < c.e.r + (p.arme.taille || 16)) {
          impact(c.e, p, p.x - p.vx * 3, p.y - p.vy * 3, true);
          if (p.type === 'retour') p.touches.add(cle); else { fini = true; break; }
        }
      }
    }
    if (fini) projectiles.splice(i, 1);
  }
}
function exploser(p) {
  const r = p.arme.rayon || 70;
  effet(p.arme.effet || 'explosion', p.x, p.y, p.arme.couleur, r);
  for (const c of cibles(p)) if (Math.hypot(p.x - c.e.x, p.y - c.e.y) < r + c.e.r * 0.6) impact(c.e, p, p.x, p.y, false);
  if (p.de === moi.uid) abimerZone(p.x, p.y, r, p.deg);
}
function impact(e, p, x, y, avecEffet) {
  const a = p.arme, deg = p.deg, ang = Math.atan2(e.y - y, e.x - x), kb = a.effet === 'explosion' ? 6 : 3;
  if (avecEffet) effet(a.effet, e.x, e.y - 10, a.couleur, 40, ang);
  if (e === moi) return toucherMoi(deg, x, y);
  e.flash = 8;
  texteFlottant('-' + deg, e.x, e.y - e.r * 1.4, a.couleur || '#fff');
  if (!e.def) return;                                 // autre joueur : il gère ses PV lui-même
  if (hote) { e.kx += Math.cos(ang) * kb; e.ky += Math.sin(ang) * kb; }
  if (p.de === moi.uid) hote ? blesserBoss(e, deg) : envoyer({ t: 'db', i: e.i, deg }); // les dégâts des invités passent par l'hôte
}
function toucherMoi(deg, x, y) {
  if (moi.pv <= 0) return;
  deg = Math.round(deg * bonus(moi, 'bouclier'));     // bouclier = dégâts réduits
  moi.pv = Math.max(0, moi.pv - deg); moi.flash = 8;
  const ang = Math.atan2(moi.y - y, moi.x - x);
  moi.kx += Math.cos(ang) * 14; moi.ky += Math.sin(ang) * 14;
  texteFlottant('-' + deg, moi.x, moi.y - 50, '#ff4d4d');
  if (moi.pv === 0) { effet('explosion', moi.x, moi.y, '#888', 60); envoyerEtat(true); }
}
function blesserBoss(b, deg) { if (b.pv <= 0) return; b.pv = Math.max(0, b.pv - deg); b.flash = 8; if (b.pv === 0) mortBoss(b); }
function mortBoss(b) { effet('explosion', b.x, b.y, '#7fbf3f', 130); secousse = 22; }
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
function activerPouvoir(id) {
  const p = CONFIG.pouvoirs[id]; if (!p) return;
  if (p.effet === 'soin') moi.pv = Math.min(moi.pvMax, moi.pv + moi.pvMax * (+p.valeur || 0.3));
  else moi.bonus[id] = temps + (+p.duree || 8) * 60;
  texteFlottant((p.icone || '✨') + ' ' + p.nom, moi.x, moi.y - 70, p.couleur || '#fff');
  effet('etincelle', moi.x, moi.y, p.couleur || '#fff');
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
  const vit = moi.perso.vitesse * bonus(moi, 'vitesse');
  deplacer(moi, mx * vit + moi.kx, my * vit + moi.ky);
  moi.kx *= 0.8; moi.ky *= 0.8;
  if (mx || my) { moi.marche += vit; if (!joyD.actif) tourner(moi, Math.atan2(my, mx), 0.25); }
  if (joyD.actif) { const v = vec(joyD); if (v.d > 15) tourner(moi, v.a, 0.4); }
  if (moi.recharge > 0) moi.recharge--;
  if (moi.flash > 0) moi.flash--;
  moi.mun = Math.min(+moi.perso.munitions || 3, moi.mun + 1 / (+moi.perso.recharge || 60)); // recharge des munitions
  moi.cache = tuileA(moi.x, moi.y) === 'B' || !!pouvoirActif(moi, 'invisible');
  for (const o of objets) if (moi.pv > 0 && Math.hypot(o.x - moi.x, o.y - moi.y) < 42) {
    objets = objets.filter(x => x !== o); envoyer({ t: 'pr', tx: o.tx, ty: o.ty }); activerPouvoir(o.id); break;
  }
  for (const j of Object.values(autres)) { j.x += (j.tx - j.x) * 0.35; j.y += (j.ty - j.y) * 0.35; if (j.flash > 0) j.flash--; }
  for (const b of bosses) {
    if (hote) iaBoss(b);
    else { b.x += (b.tx - b.x) * 0.3; b.y += (b.ty - b.y) * 0.3; if (b.flash > 0) b.flash--; }
  }
  majProjectiles(); majEffets();
  const vw = W / zoom, vh = H / zoom, cible = (p, v, m) => m <= v ? m / 2 : Math.max(v / 2, Math.min(m - v / 2, p));
  cam.x += (cible(moi.x, vw, map.l * TUILE) - cam.x) * 0.12;
  cam.y += (cible(moi.y, vh, map.h * TUILE) - cam.y) * 0.12;
  envoyerEtat(false);
  verifierFin();
  if (finDans > 0 && --finDans === 0) { etat = resultat; joyG.actif = joyD.actif = false; }
}
function iaBoss(b) {
  const D = b.def;
  if (b.flash > 0) b.flash--;
  deplacer(b, b.kx, b.ky); b.kx *= 0.8; b.ky *= 0.8;
  if (b.pv <= 0) return;
  let cible = null, dmin = 1e9;
  for (const j of joueurs()) if (j.pv > 0) {
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
  } else if (type === 'impact') {      // 🔨 massue du boss : onde de choc + poussière
    secousse = Math.max(secousse, 14);
    ondes.push({ x, y, r: 10, max: rayon * 1.2, c: couleur, vie: 1, ep: 14 });
    for (let i = 0; i < 22; i++) particule(x, y, ['#8b5a2b', '#a0835f', '#6b4a2b'][i % 3], rayon / 10, 12);
    for (let i = 0; i < 8; i++) particule(x, y, 'rgba(160,140,110,0.7)', rayon / 20, 20, 1.3, 'fumee');
  }
}

// ---------- 12b. DESSIN : outils ----------
function texte(t, x, y, taille, couleur, align = 'center') {
  ctx.font = `900 ${taille}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, taille / 6); ctx.strokeStyle = '#1a1030'; ctx.strokeText(t, x, y);
  ctx.fillStyle = couleur; ctx.fillText(t, x, y);
}
function rect(x, y, w, h, r, fill, stroke, ep = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = ep; ctx.stroke(); }
}
function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); }


function mur(px, py) {
  const T = TUILE, h = HAUT_MUR, d = map.def;
  ctx.fillStyle = d.murFace || '#8e5a2b'; ctx.fillRect(px, py + T - h, T, h);
  ctx.fillStyle = d.mur || '#c98a4b'; ctx.fillRect(px, py - h, T, T);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(px + 4, py - h + 4, T - 8, 6);
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(px + 8, py - h + T / 3); ctx.lineTo(px + T - 8, py - h + T / 3);
  ctx.moveTo(px + 8, py - h + 2 * T / 3); ctx.lineTo(px + T - 8, py - h + 2 * T / 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.strokeRect(px + 1.5, py - h + 1.5, T - 3, T + h - 3);
  ctx.beginPath(); ctx.moveTo(px, py + T - h); ctx.lineTo(px + T, py + T - h); ctx.stroke();
}


function dessinerEntite(e, im, anneau, taille) {
  if (e.rage) ellipse(e.x, e.y + e.r * 0.45, e.r * 1.5, e.r * 0.9, `rgba(255,0,0,${0.15 + 0.1 * Math.sin(temps * 0.2)})`);
  ellipse(e.x, e.y + e.r * 0.45, e.r * 1.05, e.r * 0.6, 'rgba(0,0,0,.28)');
  ctx.strokeStyle = anneau; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalAlpha = e.cache ? 0.5 : 1;
  ctx.translate(e.x, e.y - e.r * 0.3);
  ctx.rotate(e.angle + Math.PI / 2); // les images regardent vers le haut → on les tourne dans la direction du mouvement
  const gonfle = e.charge > 0 ? (1 - e.charge / e.chargeMax) * 0.15 : 0;
  const sz = taille * (1 + Math.sin(e.marche * 0.18) * 0.05 + gonfle);
  if (pret(im)) {
    ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz);
    if (e.flash > 0) { ctx.globalAlpha = (e.flash / 8) * 0.9; ctx.drawImage(blanc(im), -sz / 2, -sz / 2, sz, sz); }
  } else {
    ctx.fillStyle = anneau; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -e.r, 8, 16);
  }
  ctx.restore();
}


function dessinerProjectile(p) {
  const a = p.arme, im = img(a.image), s = (a.taille || 16) * 2.4;
  const k = 1 - p.z / 220;
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
  for (const p of particules) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.vie));
    if (p.forme === 'trait') {
      const a = p.a !== undefined ? p.a : Math.atan2(p.vy, p.vx), l = p.len / 2;
      ctx.strokeStyle = p.c; ctx.lineWidth = p.t * Math.max(0.2, p.vie); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); ctx.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); ctx.stroke();
    } else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 7); ctx.fill(); }
  }
  for (const t of textes) { ctx.globalAlpha = Math.max(0, t.vie); texte(t.txt, t.x, t.y, 22, t.c); }
  ctx.globalAlpha = 1;
}


function majEffets() {
  for (const p of particules) {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
    if (p.forme === 'fumee') { p.t *= 1.03; p.y -= 0.4; p.vie -= 0.025; } else p.vie -= p.forme === 'trait' && p.a !== undefined ? 0.06 : 0.04;
  }
  for (const o of ondes) { o.r += (o.max - o.r) * 0.25; o.vie -= 0.06; }
  for (const t of textes) { t.y -= 1; t.vie -= 0.02; }
  particules = particules.filter(p => p.vie > 0); ondes = ondes.filter(o => o.vie > 0); textes = textes.filter(t => t.vie > 0);
}

function texteFlottant(txt, x, y, c) { textes.push({ txt, x: x + (Math.random() - 0.5) * 20, y, c, vie: 1 }); }
// ---------- 13. DESSIN : monde ----------
function dessinerJeu() {
  ecran(); ctx.fillStyle = '#16351f'; ctx.fillRect(0, 0, W, H);
  const s = secousse; secousse = secousse < 0.3 ? 0 : secousse * 0.85;
  monde((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  const T = TUILE, d = map.def, vw = W / zoom / 2 + T, vh = H / zoom / 2 + T * 2;
  const x0 = Math.max(0, Math.floor((cam.x - vw) / T)), x1 = Math.min(map.l - 1, Math.ceil((cam.x + vw) / T));
  const y0 = Math.max(0, Math.floor((cam.y - vh) / T)), y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh) / T));
  const tuiles = f => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(tuile(x, y), x, y, x * T, y * T); };

  tuiles((c, x, y, px, py) => { // sol
    if (c === 'W') {
      ctx.fillStyle = d.eau || '#3aa6e0'; ctx.fillRect(px, py, T, T);
      if (tuile(x, y - 1) !== 'W') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, py, T, 10); }
      const o = Math.sin(temps * 0.05 + x + y) * 5;
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 12, py + 30 + o); ctx.quadraticCurveTo(px + 32, py + 22 + o, px + 52, py + 30 + o); ctx.stroke();
    } else {
      ctx.fillStyle = (x + y) % 2 ? d.herbe1 : d.herbe2; ctx.fillRect(px, py, T, T);
      if (((x * 73856093) ^ (y * 19349663)) % 5 === 0) {
        ctx.strokeStyle = 'rgba(0,60,0,.25)'; ctx.lineWidth = 3; ctx.beginPath();
        for (const k of [-6, 0, 6]) { ctx.moveTo(px + 32 + k, py + 40); ctx.lineTo(px + 32 + k * 1.5, py + 28); }
        ctx.stroke();
      }
    }
  });
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  tuiles((c, x, y, px, py) => { if (bloqueTir(c)) ctx.fillRect(px + 10, py + 10, T, T); });
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
  tuiles((c, x, y, px, py) => { if (c === '#') objs.push([(y + 1) * T - 1, () => { mur(px, py); fissures(x, y, px, py); }]);
                                 if (c === 'C') objs.push([(y + 1) * T - 1, () => { coffre(px, py); fissures(x, y, px, py); }]); });
  for (const j of joueurs()) if (visible(j) && (j.pv > 0 || j === moi))
    objs.push([j.y + j.r * 0.5, () => { aura(j); dessinerEntite(j, img(j.perso.image), j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.r * 2.9); }]);
  for (const b of bosses) if (b.pv > 0) objs.push([b.y + b.r * 0.5, () => dessinerEntite(b, img(b.def.image), '#ff7b1a', b.r * 2.9)]);
  for (const p of projectiles) if (p.type !== 'lob') objs.push([p.y, () => dessinerProjectile(p)]);
  objs.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());

  tuiles((c, x, y, px, py) => { if (c === 'B') buisson(px, py); });
  for (const p of projectiles) if (p.type === 'lob') dessinerProjectile(p);
  dessinerEffets();
  for (const j of joueurs()) if (j.pv > 0 && visible(j)) barreVie(j, j === moi ? '#3aa0ff' : j.eq === moi.eq ? '#2ecc71' : '#ff3b3b', j.nom);
  for (const b of bosses) if (b.pv > 0) barreVie(b, '#ff7b1a');
  ecran(); dessinerHUD();
}
function coffre(px, py) { // coffre mystère (contient souvent un super pouvoir)
  const T = TUILE, h = HAUT_MUR;
  ctx.fillStyle = '#8e5a2b'; ctx.fillRect(px + 4, py + T - h, T - 8, h);
  ctx.fillStyle = '#c98a4b'; ctx.fillRect(px + 4, py - h + 6, T - 8, T - 6);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(px + 4, py - h + 22, T - 8, 8); ctx.fillRect(px + T / 2 - 5, py - h + 6, 10, T - 6);
  ctx.strokeStyle = '#3a220c'; ctx.lineWidth = 3; ctx.strokeRect(px + 5.5, py - h + 7.5, T - 11, T + h - 13);
  ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❔', px + T / 2, py - h + 44 + Math.sin(temps * 0.1) * 2);
}
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
  const d = map.def, cx = px + 32, cy = py + 24, sw = Math.sin(temps * 0.04 + px * 0.1) * 2;
  ctx.globalAlpha = Math.hypot(moi.x - cx, moi.y - cy - 8) < 70 ? 0.45 : 1;
  ctx.fillStyle = d.buissonFonce || '#1f7a35';
  for (const [dx, dy, r] of [[-20, 8, 24], [20, 8, 24], [0, 16, 26], [0, -6, 24]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = d.buisson || '#2fae4a';
  for (const [dx, dy, r] of [[-14, 2, 18], [14, 2, 18], [0, -8, 18], [0, 10, 18]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  for (const [dx, dy] of [[-12, -4], [10, -12], [4, 6]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, 5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function dessinerVisee() {
  if (!joyD.actif) return;
  const v = vec(joyD); if (v.d < 15) return;
  const a = moi.arme, portee = moi.perso.portee;
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  if (a.type === 'lob') {
    const dist = Math.max(80, portee * v.f), tx = moi.x + Math.cos(v.a) * dist, ty = moi.y + Math.sin(v.a) * dist, R = a.rayon || 70;
    ctx.beginPath(); ctx.ellipse(tx, ty, R, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(moi.x, moi.y);
    ctx.quadraticCurveTo((moi.x + tx) / 2, (moi.y + ty) / 2 - dist * 0.35, tx, ty); ctx.stroke();
  } else { ctx.translate(moi.x, moi.y); ctx.rotate(v.a); ctx.beginPath(); ctx.roundRect(0, -16, portee, 32, 16); ctx.fill(); }
  ctx.restore();
}
function barreVie(e, couleur, nom) {
  const w = Math.max(56, e.r * 2.2), x = e.x - w / 2, y = e.y - e.r * 1.75 - 16;
  rect(x - 2, y - 2, w + 4, 12, 5, 'rgba(0,0,0,.6)');
  if (e.pv > 0) rect(x, y, w * e.pv / e.pvMax, 8, 4, couleur);
  texte(Math.ceil(e.pv) + (nom ? '  ' + nom : ''), e.x, y - 10, 13, '#fff');
  if (e === moi) { // munitions : une case par munition
    const n = +moi.perso.munitions || 3, sw = (w - (n - 1) * 3) / n, inf = pouvoirActif(moi, 'munitions');
    for (let i = 0; i < n; i++) {
      rect(x + i * (sw + 3), y + 12, sw, 7, 3, 'rgba(0,0,0,.6)');
      const f = inf ? 1 : Math.max(0, Math.min(1, moi.mun - i));
      if (f > 0) rect(x + i * (sw + 3), y + 12, sw * f, 7, 3, f === 1 ? (inf ? '#b67aff' : '#ffa31a') : '#8a5a10');
    }
  }
}

// ---------- 14. DESSIN : écrans ----------
function bouton(x, y, w, h, txt, fond, action, taille = 14) {
  rect(x, y, w, h, 12, fond, '#1a1030', 3); texte(txt, x + w / 2, y + h / 2, taille, '#fff');
  if (action) zones.push({ x, y, w, h, action });
}
function fond(c1, c2) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(temps * 0.002); ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -2000); ctx.lineTo(60, -2000); ctx.fill(); }
  ctx.restore();
}
function dessinerHUD() {
  const bw = Math.min(420, W * 0.5), bx = (W - bw) / 2;
  let y = 18;
  if (bosses.length) {
    const pv = bosses.reduce((s, b) => s + Math.max(0, b.pv), 0), max = bosses.reduce((s, b) => s + b.pvMax, 0);
    const titre = bosses.length > 1 ? `BOSS ${bosses.filter(b => b.pv > 0).length}/${bosses.length}` : bosses[0].def.nom;
    texte(titre + (bosses.some(b => b.rage && b.pv > 0) ? ' 😡' : ''), W / 2, y, 16, '#ffd23f');
    rect(bx - 3, y + 12, bw + 6, 20, 8, 'rgba(0,0,0,.6)');
    if (pv > 0) rect(bx, y + 15, bw * pv / max, 14, 6, '#ff7b1a');
    y += 44;
  }
  const tous = [moi, ...Object.values(autres)], viv = l => l.filter(j => j.pv > 0 && !j.parti).length;
  const al = tous.filter(j => j.eq === moi.eq), en = tous.filter(j => j.eq !== moi.eq);
  if (tous.length > 1) texte((al.length > 1 ? `🟢 Alliés ${viv(al)}/${al.length}   ` : '') + (en.length ? `⚔️ Ennemis ${viv(en)}/${en.length}` : ''), W / 2, y, 15, '#fff');
  ctx.beginPath(); ctx.arc(38, 38, 28, 0, 7); ctx.fillStyle = moi.perso.couleur; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#1a1030'; ctx.stroke();
  const im = carteDe(moi.perso); if (pret(im)) ctx.drawImage(im, 14, 14, 48, 48);
  texte(moi.nom, 74, 26, 16, '#fff', 'left');
  texte(Math.ceil(moi.pv) + ' PV', 74, 48, 13, '#8fd3ff', 'left');
  bonusActifs(moi).forEach((id, i) => { // super pouvoirs actifs + temps restant
    const p = CONFIG.pouvoirs[id], x = 14 + i * 50;
    rect(x, 74, 44, 44, 10, p.couleur || '#fff', '#1a1030', 3);
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.icone || '✨', x + 22, 92);
    texte(Math.ceil((moi.bonus[id] - temps) / 60) + 's', x + 22, 112, 11, '#fff');
  });
  dessinerJoystick(joyG, '#ffffff');
  dessinerJoystick(joyD, '#ffb000');
  if (!('ontouchstart' in window)) texte('ZQSD/flèches : bouger • Clic : tirer • Espace : tir auto • Échap : quitter', W / 2, H - 16, 12, '#fff');
}
function dessinerJoystick(j, c) {
  if (!j.actif) return;
  const v = vec(j), l = Math.min(v.d, 50);
  ctx.globalAlpha = 0.3; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(j.ox, j.oy, 55, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(j.ox + Math.cos(v.a) * l, j.oy + Math.sin(v.a) * l, 24, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
function dessinerMenu() {
  ecran(); zones = [];
  fond('#2b1d6b', '#0f5fa8');
  if (etat === 'AUTH') return;
  const m = modeChoisi();
  texte('BASTORY', W / 2, H * 0.08, Math.min(52, W / 11), '#ffd23f');
  texte('👤 ' + nomJoueur() + '   🏆 ' + mesPoints + ' pts', 12, 20, 13, '#fff', 'left');
  bouton(12, 34, 70, 26, 'Profil', 'rgba(0,0,0,.4)', () => ouvrirProfil(auth, p => db && db.collection('joueurs').doc(user.uid).set({ pseudo: p }, { merge: true })), 12);
  bouton(88, 34, 110, 26, 'Déconnexion', 'rgba(0,0,0,.4)', () => auth.signOut(), 12);
  bouton(W - 104, 10, 94, 32, '⚙️ Admin', 'rgba(0,0,0,.4)', () => location.href = 'admin.html', 13);
  const my = H * 0.08 + 30, multi = m.type === 'multi';
  bouton(W / 2 - 150, my, 300, 40, '🎮 ' + m.nom + (modes().length > 1 ? '  ▶' : ''), multi ? '#e74c3c' : '#27ae60', () => modeIndex = (modeIndex + 1) % modes().length, 16);
  const infos = [m.description, multi ? `👥 ${m.joueursMin === m.joueursMax ? m.joueursMax : m.joueursMin + '-' + m.joueursMax} joueurs` : '',
                 multi ? { deux: '2 équipes', coop: 'coopération', chacun: 'chacun pour soi' }[m.equipes] : '', m.boss && m.nbBoss > 0 ? m.nbBoss + ' boss' : '', `🏆 +${m.pointsVictoire}`];
  texte(infos.filter(Boolean).join('  •  '), W / 2, my + 54, 12, '#e8e0ff');

  const n = CONFIG.persos.length, gap = 14, cw = Math.min(200, (W - 30) / n - gap), y0 = my + 72, ch = Math.min(250, H - y0 - 76);
  const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
  CONFIG.persos.forEach((p, i) => {
    const x = x0 + i * (cw + gap), a = CONFIG.armes[p.arme] || {}, im = carteDe(p), is = Math.min(cw * 0.7, ch * 0.4);
    rect(x, y0, cw, ch, 18, p.couleur, '#1a1030', 4);
    rect(x + 6, y0 + 6, cw - 12, is + 10, 12, 'rgba(255,255,255,.2)');
    if (pret(im)) ctx.drawImage(im, x + cw / 2 - is / 2, y0 + 11 + Math.sin(temps * 0.05 + i) * 4, is, is);
    let y = y0 + is + 30;
    texte(p.nom, x + cw / 2, y, Math.min(20, cw / 7), '#fff');
    texte((a.nom || p.arme) + ' • ' + (p.munitions || 3) + ' mun.', x + cw / 2, y + 20, 11, '#ffe8a3');
    y += 36;
    for (const [lab, val] of [['PV', p.pvMax / 8000], ['VIT', p.vitesse / 8], ['DÉG', p.degats / 3000]]) {
      if (y + 10 > y0 + ch) break;
      texte(lab, x + 12, y + 4, 10, '#fff', 'left');
      rect(x + 44, y, cw - 56, 9, 4, 'rgba(0,0,0,.35)');
      rect(x + 44, y, (cw - 56) * Math.min(1, val), 9, 4, '#ffd23f');
      y += 16;
    }
    zones.push({ x, y: y0, w: cw, h: ch, action: () => { persoIndex = i; multi ? chercherPartie() : demarrer(mapChoisie(m), null); } });
  });
  const fixe = m.map >= 0 && CONFIG.maps[m.map];
  bouton(W / 2 - 140, y0 + ch + 12, 280, 38, '🗺️ ' + CONFIG.maps[mapChoisie(m)].nom + (fixe || CONFIG.maps.length < 2 ? '' : '  ▶'), '#d4a017',
         fixe ? null : () => mapIndex = (mapIndex + 1) % CONFIG.maps.length, 15);
  texte('Choisis ton perso pour jouer', W / 2, H - 12, 11, '#fff');
}
function dessinerAttente() {
  ecran(); zones = [];
  fond('#3b0d1f', '#2b1d6b');
  texte('⚔️ ' + (mode ? mode.nom : ''), W / 2, H * 0.25, 30, '#ffd23f');
  texte('Recherche de joueurs' + '.'.repeat(1 + Math.floor(temps / 30) % 3), W / 2, H * 0.42, 20, '#fff');
  texte(`👥 ${attente.n} / ${attente.max} joueurs` + (attente.min < attente.max ? `  (départ possible à ${attente.min})` : ''), W / 2, H * 0.5, 16, '#e8e0ff');
  if (attente.reste > 0) texte(`Départ dans ${attente.reste} s`, W / 2, H * 0.57, 18, '#9cff57');
  bouton(W / 2 - 90, H * 0.66, 180, 44, 'Annuler', '#e74c3c', () => { quitterSalle(); etat = 'MENU'; }, 16);
}
function dessinerFin() { // animation de victoire / défaite avec les gagnants et les perdants
  ecran();
  const t = Math.max(0, temps - (finInfo ? finInfo.t0 : temps)), vic = etat === 'VICTOIRE', G = finInfo ? finInfo.gagnants : [], P = finInfo ? finInfo.perdants : [];
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H);
  const cy = H * 0.42;
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(t * 0.01); ctx.fillStyle = vic ? 'rgba(255,210,63,.12)' : 'rgba(255,60,60,.08)';
  for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -1500); ctx.lineTo(40, -1500); ctx.fill(); }
  ctx.restore();
  if (vic) for (let i = 0; i < 70; i++) { // confettis
    const x = (i * 137.5 + Math.sin(t * 0.05 + i) * 30) % W, y = ((i * 53 + t * (2 + i % 4)) % (H + 40)) - 20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.1 + i); ctx.fillStyle = ['#ffd23f', '#ff5a8a', '#5ad1ff', '#9cff57', '#b67aff'][i % 5];
    ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  const sc = Math.min(1, t / 15) * (1 + Math.max(0, Math.sin(Math.min(t, 30) / 30 * Math.PI)) * 0.25);
  ctx.save(); ctx.translate(W / 2, H * 0.1); ctx.scale(sc, sc);
  texte(vic ? 'VICTOIRE !' : 'DÉFAITE...', 0, 0, Math.min(56, W / 9), vic ? '#ffd23f' : '#ff4d4d'); ctx.restore();
  const tg = Math.min(H * 0.26, 150, (W - 40) / Math.max(1, G.length) / 1.15);
  G.forEach((c, i) => { // gagnants : rebondissent avec une couronne
    const x = W / 2 + (i - (G.length - 1) / 2) * tg * 1.15, y = cy + Math.sin(t * 0.12 + i) * 8 - Math.max(0, 25 - t) * 12;
    ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; ellipse(x, y, tg * 0.45, tg * 0.45, 'rgba(255,210,63,.35)'); ctx.restore();
    if (pret(c.im)) ctx.drawImage(c.im, x - tg / 2, y - tg / 2, tg, tg);
    ctx.font = `${tg * 0.28}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👑', x, y - tg * 0.55 + Math.sin(t * 0.2) * 3);
    texte(c.nom, x, y + tg * 0.58, 15, '#ffd23f');
  });
  const tp = tg * 0.5, py = H * 0.74 + Math.min(t, 40) * 0.3;
  P.forEach((c, i) => { // perdants : en gris, penchés
    const x = W / 2 + (i - (P.length - 1) / 2) * tp * 1.3;
    ctx.save(); ctx.translate(x, py); ctx.rotate((i % 2 ? 1 : -1) * Math.min(0.35, t * 0.01)); ctx.globalAlpha = 0.8;
    ctx.filter = 'grayscale(1) brightness(.6)';
    if (pret(c.im)) ctx.drawImage(c.im, -tp / 2, -tp / 2, tp, tp);
    ctx.filter = 'none'; ctx.restore();
    texte('💀 ' + c.nom, x, py + tp * 0.62, 12, '#aaa');
  });
  if (messageFin) texte(messageFin, W / 2, H * 0.19, 16, '#fff');
  if (finInfo && t > 20) texte('+' + finInfo.points + ' 🏆', W / 2, H * 0.62 - Math.min(20, (t - 20)), 22, '#9cff57');
  if (t > 40) texte("Touchez l'écran pour revenir au menu", W / 2, H - 20, 14, '#ddd');
}

// ---------- 15. BOUCLE ----------
function boucle() {
  if (etat === 'AUTH' || etat === 'MENU') { temps++; dessinerMenu(); }
  else if (etat === 'ATTENTE') { temps++; dessinerAttente(); rafraichirAttente(); }
  else { if (etat === 'JEU') maj(); else temps++; dessinerJeu(); if (etat !== 'JEU') dessinerFin(); }
  requestAnimationFrame(boucle);
}
boucle();
