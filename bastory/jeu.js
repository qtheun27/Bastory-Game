// =====================================================================
// 🎮 BASTORY GAME — MOTEUR
// Les données (persos, armes, boss, maps) sont dans config.js
// et se modifient sans code via admin.html.
// =====================================================================

// ---------- 1. CONFIG ----------
const CLE_CONFIG = 'bastory_config';
const CONFIG_LOCALE = (() => { try { return localStorage.getItem(CLE_CONFIG); } catch (e) { return null; } })();
const CONFIG = CONFIG_LOCALE ? JSON.parse(CONFIG_LOCALE) : JSON.parse(JSON.stringify(CONFIG_PAR_DEFAUT));
const TUILE = 64, HAUT_MUR = 28;

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
img(CONFIG.boss.image);

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
let etat = 'MENU', mapIndex = 0, map = null, perso = null, arme = null;
let joueur = null, boss = null, projectiles = [], particules = [], textes = [], ondes = [];
let cam = { x: 0, y: 0 }, secousse = 0, temps = 0, finDans = 0, resultat = '', zones = [];

// ---------- 5. MAP & COLLISIONS ----------
// Légende : '.' herbe  '#' mur  'B' buisson  'W' eau  'P' départ joueur  'E' départ boss
function chargerMap(def) {
  const l = Math.max(...def.grille.map(r => r.length));
  const g = def.grille.map(r => r.padEnd(l, '.'));
  const m = { def, g, l, h: g.length, j: { x: 2, y: 2 }, b: { x: l - 3, y: g.length - 3 } };
  g.forEach((r, y) => { for (let x = 0; x < l; x++) { if (r[x] === 'P') m.j = { x, y }; if (r[x] === 'E') m.b = { x, y }; } });
  return m;
}
const tuile = (tx, ty) => (!map || tx < 0 || ty < 0 || tx >= map.l || ty >= map.h) ? '#' : map.g[ty][tx];
const tuileA = (x, y) => tuile(Math.floor(x / TUILE), Math.floor(y / TUILE));
const bloque = c => c === '#' || c === 'W';
function libre(x, y, r) {
  const k = r * 0.75;
  return ![[-k, -k], [k, -k], [-k, k], [k, k], [0, -k], [0, k], [-k, 0], [k, 0]].some(([a, b]) => bloque(tuileA(x + a, y + b)));
}
function deplacer(e, dx, dy) {
  if (libre(e.x + dx, e.y, e.r)) e.x += dx;
  if (libre(e.x, e.y + dy, e.r)) e.y += dy;
}
function tourner(e, a, k) {
  let d = a - e.angle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  e.angle += d * k;
}

// ---------- 6. LANCEMENT ----------
function lancer(p) {
  perso = p;
  arme = CONFIG.armes[p.arme] || Object.values(CONFIG.armes)[0];
  map = chargerMap(CONFIG.maps[mapIndex] || CONFIG.maps[0]);
  const B = CONFIG.boss, c = t => (t + 0.5) * TUILE;
  joueur = { x: c(map.j.x), y: c(map.j.y), r: 26, pv: p.pvMax, pvMax: p.pvMax, angle: 0, recharge: 0, flash: 0, marche: 0, kx: 0, ky: 0, cache: false };
  boss = { x: c(map.b.x), y: c(map.b.y), r: B.taille || 48, pv: B.pvMax, pvMax: B.pvMax, angle: Math.PI, recharge: 60, flash: 0, marche: 0, kx: 0, ky: 0, charge: 0, chargeMax: 1, rage: false };
  boss.cx = joueur.x; boss.cy = joueur.y;
  projectiles = []; particules = []; textes = []; ondes = [];
  cam.x = joueur.x; cam.y = joueur.y; finDans = 0; resultat = '';
  joyG.actif = joyD.actif = false;
  etat = 'JEU';
}

// ---------- 7. CONTRÔLES ----------
const touches = {};
addEventListener('keydown', e => {
  touches[e.key.toLowerCase()] = true;
  if (e.key === ' ' && etat === 'JEU') tirerAuto();
  if (e.key === 'Escape') etat = 'MENU';
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
      if (etat === 'JEU') { const v = vec(joyD); v.d > 15 ? tirer(v.a, v.f) : tirerAuto(); } // tir au relâchement (petit tap = visée auto)
    }
  }
}
canvas.addEventListener('touchend', finTouche);
canvas.addEventListener('touchcancel', finTouche);
canvas.addEventListener('mousedown', e => {
  if (etat !== 'JEU') return clic(e.clientX, e.clientY);
  const m = versMonde(e.clientX, e.clientY), d = Math.hypot(m.x - joueur.x, m.y - joueur.y);
  tirer(Math.atan2(m.y - joueur.y, m.x - joueur.x), Math.min(1, d / perso.portee));
});
function clic(x, y) {
  if (etat === 'VICTOIRE' || etat === 'DEFAITE') { etat = 'MENU'; return; }
  const z = zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  if (z) z.action();
}

// ---------- 8. TIRS ----------
function tirer(angle, force = 1) {
  if (joueur.recharge > 0 || joueur.pv <= 0) return;
  joueur.recharge = perso.delaiTir;
  joueur.angle = angle;
  const v = arme.vitesse || 10;
  const p = { type: arme.type, arme, x: joueur.x, y: joueur.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, dist: 0, rot: 0, z: 0, vie: 0, retour: false, touches: new Set() };
  if (arme.type === 'lob') {
    const d = Math.max(80, perso.portee * force);
    Object.assign(p, { sx: joueur.x, sy: joueur.y, cx: joueur.x + Math.cos(angle) * d, cy: joueur.y + Math.sin(angle) * d, t: 0, duree: Math.max(18, d / v) });
  }
  projectiles.push(p);
}
function tirerAuto() {
  if (!joueur) return;
  if (boss.pv > 0) {
    const d = Math.hypot(boss.x - joueur.x, boss.y - joueur.y);
    tirer(Math.atan2(boss.y - joueur.y, boss.x - joueur.x), Math.min(1, d / perso.portee));
  } else tirer(joueur.angle, 1);
}

// ---------- 9. LOGIQUE ----------
function maj() {
  temps++;
  // Joueur
  let mx = 0, my = 0;
  if (touches.q || touches.a || touches.arrowleft) mx--;
  if (touches.d || touches.arrowright) mx++;
  if (touches.z || touches.w || touches.arrowup) my--;
  if (touches.s || touches.arrowdown) my++;
  const dk = Math.hypot(mx, my); if (dk) { mx /= dk; my /= dk; }
  if (joyG.actif) { const v = vec(joyG); if (v.d > 5) { mx = Math.cos(v.a) * v.f; my = Math.sin(v.a) * v.f; } }
  if (joueur.pv <= 0) mx = my = 0;
  deplacer(joueur, mx * perso.vitesse + joueur.kx, my * perso.vitesse + joueur.ky);
  joueur.kx *= 0.8; joueur.ky *= 0.8;
  if (mx || my) { joueur.marche += perso.vitesse; if (!joyD.actif) tourner(joueur, Math.atan2(my, mx), 0.25); }
  if (joyD.actif) { const v = vec(joyD); if (v.d > 15) tourner(joueur, v.a, 0.4); }
  if (joueur.recharge > 0) joueur.recharge--;
  if (joueur.flash > 0) joueur.flash--;
  joueur.cache = tuileA(joueur.x, joueur.y) === 'B';

  majBoss(); majProjectiles(); majEffets();

  // Caméra
  const vw = W / zoom, vh = H / zoom, cible = (p, v, m) => m <= v ? m / 2 : Math.max(v / 2, Math.min(m - v / 2, p));
  cam.x += (cible(joueur.x, vw, map.l * TUILE) - cam.x) * 0.12;
  cam.y += (cible(joueur.y, vh, map.h * TUILE) - cam.y) * 0.12;

  if (finDans > 0 && --finDans === 0) { etat = resultat; joyG.actif = joyD.actif = false; }
}

function majBoss() {
  const B = CONFIG.boss;
  if (boss.flash > 0) boss.flash--;
  deplacer(boss, boss.kx, boss.ky); boss.kx *= 0.8; boss.ky *= 0.8;
  if (boss.pv <= 0 || joueur.pv <= 0) return;
  const dj = Math.hypot(joueur.x - boss.x, joueur.y - boss.y);
  if (!joueur.cache || dj < 170) { boss.cx = joueur.x; boss.cy = joueur.y; } // caché dans un buisson = le boss perd ta trace
  boss.rage = boss.pv < boss.pvMax / 2;

  if (boss.charge > 0) { // préparation du coup de massue
    if (--boss.charge === 0) {
      effet('impact', boss.fx, boss.fy, '#f5deb3', B.rayonAttaque);
      if (Math.hypot(joueur.x - boss.fx, joueur.y - boss.fy) < B.rayonAttaque + joueur.r * 0.5) toucherJoueur(B.degats, boss.fx, boss.fy);
      boss.recharge = B.delaiAttaque;
    }
    return;
  }
  if (boss.recharge > 0) boss.recharge--;
  if (dj < boss.r + joueur.r + 30 && boss.recharge <= 0) {
    const a = Math.atan2(joueur.y - boss.y, joueur.x - boss.x);
    boss.angle = a; boss.chargeMax = boss.charge = boss.rage ? 24 : 36;
    boss.fx = boss.x + Math.cos(a) * boss.r * 1.1; boss.fy = boss.y + Math.sin(a) * boss.r * 1.1;
    return;
  }
  const dx = boss.cx - boss.x, dy = boss.cy - boss.y, d = Math.hypot(dx, dy);
  if (d > 8) {
    const v = B.vitesse * (boss.rage ? 1.4 : 1), ux = dx / d, uy = dy / d, x0 = boss.x, y0 = boss.y;
    deplacer(boss, ux * v, uy * v);
    if (Math.hypot(boss.x - x0, boss.y - y0) < v * 0.3) { const s = Math.floor(temps / 120) % 2 ? 1 : -1; deplacer(boss, -uy * v * s, ux * v * s); } // contourne les murs
    boss.marche += v; tourner(boss, Math.atan2(dy, dx), 0.08);
  }
}

function majProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; let fini = ++p.vie > 400;
    if (p.type === 'lob') { // la bombe passe au-dessus des murs
      p.t++; const k = p.t / p.duree;
      p.x = p.sx + (p.cx - p.sx) * k; p.y = p.sy + (p.cy - p.sy) * k;
      p.z = Math.sin(k * Math.PI) * 110; p.rot += 0.2;
      if (k >= 1) { exploser(p); fini = true; }
    } else {
      if (p.retour) {
        const a = Math.atan2(joueur.y - p.y, joueur.x - p.x), v = (p.arme.vitesse || 10) * 1.1;
        p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      }
      p.x += p.vx; p.y += p.vy; p.dist += Math.hypot(p.vx, p.vy);
      if (p.type === 'retour') p.rot += 0.45;
      const mur = tuileA(p.x, p.y) === '#';
      if (p.type === 'retour') {
        if (!p.retour && (p.dist >= perso.portee || mur)) { p.retour = true; if (mur) effet('etincelle', p.x, p.y, '#ddd'); }
        if (p.retour && Math.hypot(p.x - joueur.x, p.y - joueur.y) < joueur.r) fini = true;
      } else if (mur || p.dist >= perso.portee) { effet('etincelle', p.x, p.y, p.arme.couleur); fini = true; }
      const cle = p.retour ? 'r' : 'a'; // le boomerang peut toucher à l'aller ET au retour
      if (!fini && boss.pv > 0 && !p.touches.has(cle) && Math.hypot(p.x - boss.x, p.y - boss.y) < boss.r + (p.arme.taille || 16)) {
        toucherBoss(perso.degats, p.x - p.vx * 3, p.y - p.vy * 3, p.arme);
        if (p.type === 'retour') p.touches.add(cle); else fini = true;
      }
    }
    if (fini) projectiles.splice(i, 1);
  }
}

function exploser(p) {
  const r = p.arme.rayon || 70;
  effet(p.arme.effet || 'explosion', p.x, p.y, p.arme.couleur, r);
  if (boss.pv > 0 && Math.hypot(p.x - boss.x, p.y - boss.y) < r + boss.r * 0.6) toucherBoss(perso.degats, p.x, p.y, p.arme, false);
}
function toucherBoss(deg, x, y, a, avecEffet = true) {
  boss.pv = Math.max(0, boss.pv - deg); boss.flash = 8;
  const ang = Math.atan2(boss.y - y, boss.x - x), kb = a.effet === 'explosion' ? 6 : 3;
  if (avecEffet) effet(a.effet, boss.x, boss.y - 10, a.couleur, 40, ang);
  boss.kx += Math.cos(ang) * kb; boss.ky += Math.sin(ang) * kb;
  texteFlottant('-' + deg, boss.x, boss.y - boss.r * 1.4, a.couleur || '#fff');
  if (boss.pv === 0 && !resultat) { effet('explosion', boss.x, boss.y, '#7fbf3f', 130); secousse = 22; finDans = 80; resultat = 'VICTOIRE'; }
}
function toucherJoueur(deg, x, y) {
  joueur.pv = Math.max(0, joueur.pv - deg); joueur.flash = 8;
  const ang = Math.atan2(joueur.y - y, joueur.x - x);
  joueur.kx += Math.cos(ang) * 14; joueur.ky += Math.sin(ang) * 14;
  texteFlottant('-' + deg, joueur.x, joueur.y - 50, '#ff4d4d');
  if (joueur.pv === 0 && !resultat) { effet('explosion', joueur.x, joueur.y, '#888', 60); finDans = 70; resultat = 'DEFAITE'; }
}

// ---------- 10. EFFETS (animations d'impact différentes par arme) ----------
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
function texteFlottant(txt, x, y, c) { textes.push({ txt, x: x + (Math.random() - 0.5) * 20, y, c, vie: 1 }); }
function majEffets() {
  for (const p of particules) {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
    if (p.forme === 'fumee') { p.t *= 1.03; p.y -= 0.4; p.vie -= 0.025; } else p.vie -= p.forme === 'trait' && p.a !== undefined ? 0.06 : 0.04;
  }
  for (const o of ondes) { o.r += (o.max - o.r) * 0.25; o.vie -= 0.06; }
  for (const t of textes) { t.y -= 1; t.vie -= 0.02; }
  particules = particules.filter(p => p.vie > 0); ondes = ondes.filter(o => o.vie > 0); textes = textes.filter(t => t.vie > 0);
}

// ---------- 11. DESSIN : outils ----------
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

// ---------- 12. DESSIN : monde ----------
function dessinerJeu() {
  ecran(); ctx.fillStyle = '#16351f'; ctx.fillRect(0, 0, W, H);
  const s = secousse; secousse = secousse < 0.3 ? 0 : secousse * 0.85;
  monde((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);

  const T = TUILE, d = map.def, vw = W / zoom / 2 + T, vh = H / zoom / 2 + T * 2;
  const x0 = Math.max(0, Math.floor((cam.x - vw) / T)), x1 = Math.min(map.l - 1, Math.ceil((cam.x + vw) / T));
  const y0 = Math.max(0, Math.floor((cam.y - vh) / T)), y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh) / T));

  // Sol
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tuile(x, y), px = x * T, py = y * T;
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
  }
  // Ombres des murs
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tuile(x, y) === '#') ctx.fillRect(x * T + 10, y * T + 10, T, T);

  dessinerVisee();
  if (boss.charge > 0 && boss.pv > 0) { // zone rouge qui annonce le coup du boss
    const k = 1 - boss.charge / boss.chargeMax, R = CONFIG.boss.rayonAttaque;
    ellipse(boss.fx, boss.fy, R, R * 0.8, 'rgba(255,40,40,.2)');
    ellipse(boss.fx, boss.fy, R * k, R * 0.8 * k, 'rgba(255,40,40,.45)');
  }

  // Objets triés par profondeur (effet 3D)
  const objs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tuile(x, y) === '#') objs.push([(y + 1) * T - 1, () => mur(x * T, y * T)]);
  objs.push([joueur.y + joueur.r * 0.5, () => dessinerEntite(joueur, img(perso.image), '#3aa0ff', joueur.r * 2.9)]);
  if (boss.pv > 0) objs.push([boss.y + boss.r * 0.5, () => dessinerEntite(boss, img(CONFIG.boss.image), '#ff3b3b', boss.r * 2.9)]);
  for (const p of projectiles) if (p.type !== 'lob') objs.push([p.y, () => dessinerProjectile(p)]);
  objs.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());

  // Buissons (par-dessus, transparents quand on est dedans)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tuile(x, y) === 'B') buisson(x * T, y * T);
  for (const p of projectiles) if (p.type === 'lob') dessinerProjectile(p);

  dessinerEffets();
  barreVie(joueur, '#3aa0ff');
  if (boss.pv > 0) barreVie(boss, '#ff3b3b');

  ecran(); dessinerHUD();
}

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

function buisson(px, py) {
  const d = map.def, cx = px + 32, cy = py + 24, sw = Math.sin(temps * 0.04 + px * 0.1) * 2;
  ctx.globalAlpha = Math.hypot(joueur.x - cx, joueur.y - cy - 8) < 70 ? 0.45 : 1;
  ctx.fillStyle = d.buissonFonce || '#1f7a35';
  for (const [dx, dy, r] of [[-20, 8, 24], [20, 8, 24], [0, 16, 26], [0, -6, 24]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = d.buisson || '#2fae4a';
  for (const [dx, dy, r] of [[-14, 2, 18], [14, 2, 18], [0, -8, 18], [0, 10, 18]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  for (const [dx, dy] of [[-12, -4], [10, -12], [4, 6]]) { ctx.beginPath(); ctx.arc(cx + dx + sw, cy + dy, 5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
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

function dessinerVisee() {
  if (!joyD.actif) return;
  const v = vec(joyD); if (v.d < 15) return;
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  if (arme.type === 'lob') {
    const dist = Math.max(80, perso.portee * v.f), tx = joueur.x + Math.cos(v.a) * dist, ty = joueur.y + Math.sin(v.a) * dist, R = arme.rayon || 70;
    ctx.beginPath(); ctx.ellipse(tx, ty, R, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(joueur.x, joueur.y);
    ctx.quadraticCurveTo((joueur.x + tx) / 2, (joueur.y + ty) / 2 - dist * 0.35, tx, ty); ctx.stroke();
  } else {
    ctx.translate(joueur.x, joueur.y); ctx.rotate(v.a);
    ctx.beginPath(); ctx.roundRect(0, -16, perso.portee, 32, 16); ctx.fill();
  }
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

function barreVie(e, couleur) {
  const w = Math.max(56, e.r * 2.2), x = e.x - w / 2, y = e.y - e.r * 1.75 - 16;
  rect(x - 2, y - 2, w + 4, 12, 5, 'rgba(0,0,0,.6)');
  if (e.pv > 0) rect(x, y, w * e.pv / e.pvMax, 8, 4, couleur);
  texte(Math.ceil(e.pv), e.x, y - 10, 13, '#fff');
  if (e === joueur) {
    rect(x - 2, y + 12, w + 4, 7, 3, 'rgba(0,0,0,.6)');
    rect(x, y + 13, w * (1 - joueur.recharge / perso.delaiTir), 5, 2, '#ffa31a');
  }
}

// ---------- 13. DESSIN : interface ----------
function dessinerHUD() {
  const bw = Math.min(420, W * 0.5), bx = (W - bw) / 2;
  texte(CONFIG.boss.nom + (boss.rage ? ' 😡' : ''), W / 2, 18, 16, '#ffd23f');
  rect(bx - 3, 30, bw + 6, 20, 8, 'rgba(0,0,0,.6)');
  if (boss.pv > 0) rect(bx, 33, bw * boss.pv / boss.pvMax, 14, 6, '#ff3b3b');

  const im = img(perso.image);
  ctx.beginPath(); ctx.arc(38, 38, 28, 0, 7); ctx.fillStyle = perso.couleur; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#1a1030'; ctx.stroke();
  if (pret(im)) ctx.drawImage(im, 14, 14, 48, 48);
  texte(perso.nom, 74, 26, 16, '#fff', 'left');
  texte(Math.ceil(joueur.pv) + ' PV', 74, 48, 13, '#8fd3ff', 'left');

  dessinerJoystick(joyG, '#ffffff');
  dessinerJoystick(joyD, '#ffb000');
  if (!('ontouchstart' in window)) texte('ZQSD/flèches : bouger • Clic : tirer • Espace : tir auto • Échap : menu', W / 2, H - 16, 12, '#fff');
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
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1d6b'); g.addColorStop(1, '#0f5fa8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(temps * 0.002); ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -2000); ctx.lineTo(60, -2000); ctx.fill(); }
  ctx.restore();
  texte('BASTORY', W / 2, H * 0.11, Math.min(60, W / 10), '#ffd23f');

  const n = CONFIG.persos.length, gap = 14, cw = Math.min(210, (W - 30) / n - gap), ch = Math.min(280, H * 0.56);
  const y0 = H * 0.2, x0 = (W - (n * cw + (n - 1) * gap)) / 2;
  CONFIG.persos.forEach((p, i) => {
    const x = x0 + i * (cw + gap), a = CONFIG.armes[p.arme] || {}, im = img(p.image), is = Math.min(cw * 0.7, ch * 0.4);
    rect(x, y0, cw, ch, 18, p.couleur, '#1a1030', 4);
    rect(x + 6, y0 + 6, cw - 12, is + 10, 12, 'rgba(255,255,255,.2)');
    if (pret(im)) ctx.drawImage(im, x + cw / 2 - is / 2, y0 + 11 + Math.sin(temps * 0.05 + i) * 4, is, is);
    let y = y0 + is + 32;
    texte(p.nom, x + cw / 2, y, Math.min(22, cw / 7), '#fff');
    texte(a.nom || p.arme, x + cw / 2, y + 22, 12, '#ffe8a3');
    y += 38;
    for (const [lab, val] of [['PV', p.pvMax / 8000], ['VIT', p.vitesse / 8], ['DÉG', p.degats / 3000]]) {
      if (y + 10 > y0 + ch) break;
      texte(lab, x + 12, y + 4, 10, '#fff', 'left');
      rect(x + 44, y, cw - 56, 9, 4, 'rgba(0,0,0,.35)');
      rect(x + 44, y, (cw - 56) * Math.min(1, val), 9, 4, '#ffd23f');
      y += 16;
    }
    zones.push({ x, y: y0, w: cw, h: ch, action: () => lancer(p) });
  });

  const mb = { w: 280, h: 42 }; mb.x = W / 2 - mb.w / 2; mb.y = Math.min(H - 70, y0 + ch + 14);
  rect(mb.x, mb.y, mb.w, mb.h, 14, '#ffd23f', '#1a1030', 4);
  texte('🗺️ ' + (CONFIG.maps[mapIndex] || {}).nom + '  ▶', W / 2, mb.y + mb.h / 2, 16, '#fff');
  zones.push({ ...mb, action: () => mapIndex = (mapIndex + 1) % CONFIG.maps.length });

  rect(W - 104, 10, 94, 32, 10, 'rgba(0,0,0,.35)');
  texte('⚙️ Admin', W - 57, 26, 13, '#fff');
  zones.push({ x: W - 104, y: 10, w: 94, h: 32, action: () => location.href = 'admin.html' });
  if (CONFIG_LOCALE) texte('Config locale (admin) active', 10, 26, 11, '#9cff57', 'left');
  texte('Gauche : bouger • Droite : viser, relâcher pour tirer (tap = visée auto)', W / 2, H - 14, 11, '#fff');
}

function dessinerFin() {
  ecran();
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H);
  texte(etat === 'VICTOIRE' ? 'VICTOIRE !' : 'DÉFAITE...', W / 2, H / 2, Math.min(64, W / 8), etat === 'VICTOIRE' ? '#ffd23f' : '#ff4d4d');
  texte("Touchez l'écran pour revenir au menu", W / 2, H / 2 + 60, 18, '#fff');
}

// ---------- 14. BOUCLE ----------
function boucle() {
  if (etat === 'MENU') { temps++; dessinerMenu(); }
  else { if (etat === 'JEU') maj(); else temps++; dessinerJeu(); if (etat !== 'JEU') dessinerFin(); }
  requestAnimationFrame(boucle);
}
boucle();
