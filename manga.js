// =====================================================================
// 💥 BASTORY — THÈME "MANGA COMIQUE" (chargé APRÈS jeu.js)
// Remplace le style "liquid glass" par un univers dessiné, coloré et
// exagéré (arcade × One Piece × Nicky Larson) : contours noirs,
// trames, rayons, lignes de vitesse, onomatopées, intro de match épique.
// Aucune règle du jeu n'est modifiée : uniquement le dessin.
// =====================================================================
(() => {
  const NOIR = '#0b0620', POLICE_BD = 'Bangers, "Luckiest Guy", Impact, sans-serif', POLICE = 'Fredoka, "Baloo 2", Inter, system-ui, sans-serif';
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
  window.MangaFX = { trame, rayons, lignesVitesse, eclat, bd };

  // ---------- TYPOGRAPHIE : textes contourés façon arcade ----------
  window.texte = function (t, x, y, taille, couleur, align = 'center', maxW) {
    t = String(t); const f = s => `600 ${s}px ${POLICE}`; ctx.font = f(taille);
    if (maxW && ctx.measureText(t).width > maxW) { taille = Math.max(7, taille * maxW / ctx.measureText(t).width); ctx.font = f(taille); }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(2, taille * 0.26); ctx.strokeStyle = NOIR; ctx.strokeText(t, x, y + taille * 0.09); ctx.strokeText(t, x, y);
    ctx.fillStyle = couleur; ctx.fillText(t, x, y);
  };
  window.titre = function (t, x, y, taille, couleur, align = 'center', maxW) {
    t = String(t).toUpperCase(); taille *= 1.1; const f = s => `${s}px ${POLICE_BD}`; ctx.font = f(taille);
    if (maxW && ctx.measureText(t).width > maxW) { taille = Math.max(8, taille * maxW / ctx.measureText(t).width); ctx.font = f(taille); }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2; const ep = Math.max(3, taille * 0.17);
    ctx.lineWidth = ep; ctx.strokeStyle = NOIR; ctx.fillStyle = NOIR;
    ctx.strokeText(t, x + taille * 0.05, y + taille * 0.09); ctx.fillText(t, x + taille * 0.05, y + taille * 0.09); // ombre dure
    ctx.strokeText(t, x, y); ctx.fillStyle = couleur; ctx.fillText(t, x, y);
    if (taille > 22) { ctx.save(); ctx.beginPath(); ctx.rect(x - 4000, y - taille, 8000, taille * 0.5); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText(t, x, y); ctx.restore(); }
  };

  // ---------- PANNEAUX & BOUTONS DESSINÉS ----------
  window.verre = function (x, y, w, h, r, teinte) { // case de manga : fond encre, contour noir épais, ombre dure
    const u = U();
    rect(x + 3 * u, y + 4 * u, w, h, r, 'rgba(11,6,32,.55)');
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a2d9c'); g.addColorStop(1, '#1d1558');
    rect(x, y, w, h, r, g); if (teinte) rect(x, y, w, h, r, teinte);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, Math.min(h * 0.42, 14 * u + h * 0.2)); ctx.restore();
    rect(x, y, w, h, r, null, NOIR, Math.max(2, 2.8 * u));
    rect(x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, Math.max(0, r - 2.5 * u), null, 'rgba(255,255,255,.22)', 1);
  };
  function boutonBD(x, y, w, h, c1, c2, r, brillant) {
    const u = U(), p = 5 * u;
    rect(x, y + p, w, h, r, NOIR);                                           // épaisseur du bouton
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    rect(x, y, w, h, r, g);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + h * 0.72, w, h);  // ombre dessinée du bas
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 3 * u, w - 12 * u, h * 0.3, h * 0.15); ctx.fill();
    if (brillant) { const q = ((temps * 6) % (w * 3)) - w * 0.5; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x + q, y); ctx.lineTo(x + q + 22 * u, y); ctx.lineTo(x + q - 8 * u, y + h); ctx.lineTo(x + q - 30 * u, y + h); ctx.fill(); }
    ctx.restore();
    rect(x, y, w, h, r, null, NOIR, Math.max(2.5, 3.2 * u));
  }
  window.bouton3D = function (x, y, w, h, c1, c2, action, r) { const u = U(); boutonBD(x, y, w, h, c1, c2, r || Math.min(h / 2, 14 * u), false); if (action) zones.push({ x, y, w, h, action }); };
  window.boutonJeu = function (x, y, w, h, c1, c2, action) {
    const u = U(), r = Math.min(h / 2, 22 * u);
    boutonBD(x, y, w, h, c1, c2, r, true);
    const s = 7 * u * (1 + 0.35 * Math.sin(temps * 0.15)); // petite étincelle qui pulse
    ctx.save(); ctx.translate(x + w - 10 * u, y + 6 * u); ctx.rotate(temps * 0.05); ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.3 : s, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore();
    if (action) zones.push({ x, y, w, h, action });
  };
  window.bouton = function (x, y, w, h, txt, fond, action, taille = 14) {
    rect(x, y + 4, w, h, 12, NOIR); rect(x, y, w, h, 12, fond, NOIR, 3); texte(txt, x + w / 2, y + h / 2, taille, '#fff');
    if (action) zones.push({ x, y, w, h, action });
  };

  // ---------- FONDS DES MENUS : ciel manga lumineux ----------
  const DECO = ['DON!', 'BAM!', 'ZUUUN', 'GOGOGO', 'PAF!', 'BOOM!', 'WAAH!'];
  window.fond = function () {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#18b8ff'); g.addColorStop(0.55, '#5a4dff'); g.addColorStop(1, '#ff3d9a');
    ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
    rayons(W * 0.5, H * 0.38, temps * 0.0025, '#ffffff', 0.11, 20);
    const s = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, Math.max(W, H) * 0.45); s.addColorStop(0, 'rgba(255,245,180,.55)'); s.addColorStop(1, 'rgba(255,245,180,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
    trame(0.07);
    const u = U(); ctx.save(); ctx.globalAlpha = 0.13; // onomatopées géantes qui dérivent en fond
    DECO.forEach((t, i) => { const x = (((hasard(i) + temps * 0.00025 * (1 + i % 3)) % 1.3) - 0.15) * W, y = H * (0.12 + hasard(i + 4) * 0.8);
      bd(t, x, y + Math.sin(temps * 0.02 + i) * 6, (50 + hasard(i + 2) * 50) * u, '#fff', -0.25 + hasard(i + 8) * 0.5, null); });
    ctx.restore();
  };
  window.vignette = function () {
    const k = 'vm' + W + 'x' + H; if (cacheGfx[k]) return cacheGfx[k];
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,0,70,.32)'); return cacheGfx[k] = g;
  };

  // ---------- SOL DES MAPS : herbe cartoon (aplats + touffes contourées) ----------
  window.motifHerbe = function (d) {
    const k = 'toon' + d.herbe1 + d.herbe2; if (cacheGfx[k]) return cacheGfx[k];
    const c1 = /^#[0-9a-f]{6}$/i.test(d.herbe1 || '') ? d.herbe1 : '#5fd14a', T = 64, N = T * 2;
    const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    for (let i = 0; i < 4; i++) { x.fillStyle = (i === 0 || i === 3) ? ombrer(c1, 0.07) : c1; x.fillRect((i % 2) * T, Math.floor(i / 2) * T, T, T); } // damier doux
    const fonce = ombrer(c1, -0.3), clair = ombrer(c1, 0.35);
    for (let i = 0; i < 14; i++) { // touffes d'herbe dessinées
      const px = hasard(i * 3) * N, py = hasard(i * 5 + 1) * N, s = 5 + hasard(i + 2) * 5;
      for (const [ox, oy] of [[0, 0], [N, 0], [0, N], [-N, 0], [0, -N]]) {
        x.beginPath(); x.moveTo(px + ox - s, py + oy); x.lineTo(px + ox - s * 0.6, py + oy - s * 1.3); x.lineTo(px + ox - s * 0.1, py + oy - s * 0.2); x.lineTo(px + ox + s * 0.3, py + oy - s * 1.6); x.lineTo(px + ox + s * 0.5, py + oy - s * 0.2); x.lineTo(px + ox + s, py + oy - s * 1.1); x.lineTo(px + ox + s * 1.1, py + oy); x.closePath();
        x.fillStyle = fonce; x.fill(); x.lineWidth = 1.5; x.strokeStyle = ombrer(c1, -0.5); x.stroke();
      }
    }
    x.fillStyle = clair; for (let i = 0; i < 22; i++) { x.globalAlpha = 0.5; x.beginPath(); x.arc(hasard(i * 7 + 3) * N, hasard(i * 11 + 2) * N, 1.5 + hasard(i) * 2, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    return cacheGfx[k] = ctx.createPattern(c, 'repeat');
  };

  // ---------- ONOMATOPÉES EN JEU ----------
  const ONO = { explosion: ['DOKAAN!', 'KABOOM!', 'BOOM!!'], entaille: ['ZASH!', 'SHLAK!'], etincelle: ['PAF!', 'TCHAK!', 'POK!'], foudre: ['BZZZT!', 'ZAAAP!'],
    glace: ['KRAAK!', 'CLING!'], poison: ['BLURP!', 'GLOUB!'], feu: ['FWOOSH!', 'BRAOOO!'], etoiles: ['PING!', 'TWINK!'], vortex: ['FWIIII!', 'WHOOSH!'],
    eclaboussure: ['SPLASH!', 'PLOUF!'], impact: ['BAM!!', 'DOOOM!', 'GADOOM!'] };
  const COULEURS = ['#ffe14a', '#ff5ab4', '#5ff0ff', '#ff8a1f', '#b6ff4a'];
  let onos = [], choc = 0, flash = 0;
  function ono(txt, x, y, gros = 1, couleur) {
    if (onos.length > 7) onos.shift();
    onos.push({ txt, x: x + (Math.random() - 0.5) * 30, y: y - 20, vie: 1, gros, c: couleur || COULEURS[Math.floor(Math.random() * COULEURS.length)], rot: (Math.random() - 0.5) * 0.6, seed: Math.random() * 6 });
  }
  window.MangaFX.ono = ono;
  const _effet = window.effet;
  window.effet = function (type, x, y, couleur, rayon, angle) {
    _effet(type, x, y, couleur, rayon, angle);
    const l = ONO[type]; if (!l) return;
    const fort = type === 'explosion' || type === 'impact' || type === 'foudre';
    if (fort || Math.random() < 0.55) ono(l[Math.floor(Math.random() * l.length)], x, y, fort ? 1.25 : 0.85);
    if (fort) { choc = Math.max(choc, 0.8); flash = Math.max(flash, 0.35); }
  };
  const _animMort = window.animMort;
  window.animMort = function (e, im) { _animMort(e, im); ono('K.O. !!', e.x, e.y - 30, 1.8, '#ff2d55'); choc = 1.3; flash = 0.6; };
  const _dessinerEffets = window.dessinerEffets;
  window.dessinerEffets = function () { // appelé dans le repère du monde
    _dessinerEffets();
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
  };
  const _dessinerJeu = window.dessinerJeu;
  window.dessinerJeu = function () { // image "choc" manga par-dessus le jeu
    _dessinerJeu();
    if (choc > 0.03 || flash > 0.03) {
      ecran();
      if (flash > 0.03) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); flash *= 0.7; }
      if (choc > 0.03) { lignesVitesse(W / 2, H / 2, Math.min(W, H) * 0.42, 38, Math.min(0.55, choc * 0.5)); choc *= 0.88; }
    }
  };

  // ---------- 🎬 INTRO DE MATCH : chaque combattant en grand, puis VS, puis 3-2-1 ----------
  let intro = null;
  const SHOW = 74, VS = 95, CD = 100;
  function bossPourIntro() {
    const b = bosses.find(b => b.def && !b.def.cristal); if (b) return b.def;
    const id = (mode.typesBoss || []).find(id => CONFIG.bosses[id]); return CONFIG.bosses[id] || Object.values(CONFIG.bosses).find(b => !b.cristal) || { nom: 'BOSS' };
  }
  function preparerIntro() {
    if (intro) intro.vedettes.forEach(v => v.vue && v.vue.liberer());
    const tous = [moi, ...Object.values(autres)], amis = tous.filter(j => j.eq === moi.eq), ennemis = tous.filter(j => j.eq !== moi.eq);
    const fiche = (j, cote) => ({ p: baseDe(j.perso), im: carteDe(j.perso), nom: j.nom, sous: (baseDe(j.perso) || {}).nom || '', c: cote < 0 ? (j === moi ? '#1e90ff' : '#1fc46b') : '#ff2d55', cote, vue: null });
    const liste = [fiche(moi, -1), ...ennemis.map(j => fiche(j, 1))];
    if (mode.boss && mode.nbBoss > 0) { const d = bossPourIntro(); liste.push({ im: img(d.imageCarte || d.image), nom: d.nom || 'BOSS', sous: 'BOSS', c: '#ff8a00', cote: 1 }); }
    liste.push(...amis.filter(j => j !== moi).map(j => fiche(j, -1)));
    const vedettes = liste.slice(0, 4);
    intro = { cle: introT, vedettes, gauche: [...amis.map(j => fiche(j, -1))], droite: liste.filter(v => v.cote > 0) };
    intro.total = vedettes.length * SHOW + VS + CD; // même durée chez tous les joueurs (ne dépend que de la partie)
    vedettes.forEach(v => { if (v.p && v.p.modele && ok3D()) Modele3D.vitrine(v.p).then(x => { if (intro && intro.vedettes.includes(v)) v.vue = x; else if (x) x.liberer(); }).catch(() => {}); });
  }
  const PHRASES = ['DOGOGOGO', 'ZUDOOON!!', 'BAKOOM!!', 'GOGOGO…'];
  function introVedette(v, l, i) {
    const u = U(), e = sortir(l / 14), k = elastique(Math.min(1, l / 18)), fin = Math.max(0, (l - (SHOW - 10)) / 10), gauche = v.cote < 0;
    ctx.fillStyle = v.c; ctx.fillRect(-50, -50, W + 100, H + 100);
    rayons(W * (gauche ? 0.32 : 0.68), H * 0.55, temps * 0.01 * (gauche ? 1 : -1), '#ffffff', 0.2, 16);
    trame(0.12, '#000'); lignesHoriz(0.35, '#fff', gauche ? 1 : -1);
    // "ゴゴゴ" qui tremblent derrière
    ctx.save(); ctx.globalAlpha = 0.5; for (let n = 0; n < 4; n++) bd(PHRASES[0].slice(0, 2 + n % 3), W * (gauche ? 0.1 : 0.9) + (Math.random() - 0.5) * 4, H * (0.18 + n * 0.2), 40 * u, '#2a0d4a', -0.2, null); ctx.restore();
    // le personnage en GRAND, avec son animation d'attaque
    const cx = W * (gauche ? 0.33 : 0.67) - v.cote * (1 - e) * W * 0.7, sc = 1.35 - 0.35 * k;
    ctx.save(); ctx.translate(cx, H); ctx.scale(sc, sc);
    if (v.vue) {
      const D = H * 1.02, T = Math.round(Math.min(760, D * Math.min(2, window.devicePixelRatio || 1))), anim = v.vue.a && v.vue.a('attaque') ? 'attaque' : 'repos';
      const c = v.vue.rendre(Math.PI / 2 + (gauche ? -0.45 : 0.45), T, (l / 42) % 1, anim), taille = D * 0.9 / Math.max(0.3, (v.vue.bas - v.vue.haut) || 0.7);
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
    const col = (l2, cote) => { const s = Math.min(118 * u, (H - 120 * u) / Math.max(1, l2.length) / 1.3);
      l2.forEach((c, i) => { const x = W / 2 + cote * (W * 0.27 + dx), y = H / 2 + (i - (l2.length - 1) / 2) * s * 1.35 + 12 * u;
        ctx.save(); ctx.translate(x, y); ctx.rotate(cote * -0.05 + Math.sin(temps * 0.1 + i) * 0.02);
        rect(-s / 2 + 5 * u, -s * 0.55 + 6 * u, s, s * 1.2, 16 * u, NOIR); rect(-s / 2, -s * 0.55, s, s * 1.2, 16 * u, '#fff', NOIR, 4 * u);
        rect(-s / 2 + 5 * u, -s * 0.5, s - 10 * u, s * 0.86, 12 * u, c.c);
        if (pret(c.im)) ctx.drawImage(c.im, -s * 0.44, -s * 0.52, s * 0.88, s * 0.88);
        ctx.restore(); texte(c.nom, x, y + s * 0.5, 13 * u, '#fff', 'center', s - 8 * u); }); };
    col(intro.gauche, -1); if (intro.droite.length) col(intro.droite, 1);
    ctx.save(); ctx.translate(W / 2 + (Math.random() - 0.5) * 6 * (1 - k * 0.7), H / 2 + 12 * u); ctx.scale(k, k);
    eclat(0, 0, 62 * u, 12, '#ffe14a', 2, NOIR, 5 * u); bd('VS', 0, 4 * u, 78 * u, '#ff2d55', -0.08); ctx.restore();
    if (l > 30) bd('BAKOOOM!!', W / 2, H - 34 * u, 34 * u * elastique(Math.min(1, (l - 30) / 14)), '#fff', -0.05);
  }
  function introDecompte(l) {
    const u = U(), n = Math.floor(l / 25), f = (l % 25) / 25, go = n >= 3, cx = W / 2, cy = H / 2;
    ctx.fillStyle = 'rgba(20,0,40,.28)'; ctx.fillRect(-50, -50, W + 100, H + 100);
    const k = elastique(Math.min(1, f * 2.2));
    if (!go) {
      lignesVitesse(cx, cy, 120 * u, 26, 0.3);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((n - 1) * 0.12);
      eclat(0, 0, 70 * u, 10, ['#ff2d55', '#ff8a1f', '#ffe14a'][n], n + 3, NOIR, 5 * u); bd(String(3 - n), 0, 6 * u, 96 * u, '#fff', 0, NOIR); ctx.restore();
      bd(['TIC!', 'TAC!', 'TOC!'][n], cx + 110 * u, cy - 70 * u, 26 * u * k, '#5ff0ff', 0.3);
    } else {
      const kg = elastique(Math.min(1, f * 1.6));
      rayons(cx, cy, temps * 0.03, '#ffe14a', 0.35 * (1 - f), 22); lignesVitesse(cx, cy, 90 * u, 44, 0.45 * (1 - f));
      if (f < 0.12) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, W, H); }
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 3); ctx.translate(cx, cy); ctx.scale(kg * (1 + f * 0.3), kg * (1 + f * 0.3));
      bd('GO !!', 0, 0, 120 * u, '#b6ff4a', -0.08); ctx.restore();
    }
  }
  window.dessinerIntro = function () {
    if (!intro || intro.cle !== introT) preparerIntro();
    const t = temps - introT, nV = intro.vedettes.length * SHOW;
    if (t < nV) introVedette(intro.vedettes[Math.floor(t / SHOW)], t % SHOW, Math.floor(t / SHOW));
    else if (t < nV + VS) introVS(t - nV);
    else introDecompte(t - nV - VS);
  };
  window.boucle = function () { // identique au moteur, mais avec la durée de la nouvelle intro
    if (etat === 'AUTH' || etat === 'MENU') { temps++; zoneSure(dessinerMenu); }
    else if (etat === 'ATTENTE') { temps++; zoneSure(dessinerAttente); rafraichirAttente(); }
    else if (etat === 'INTRO') {
      temps++; majEffets(); dessinerJeu(); zoneSure(dessinerIntro);
      if (intro && intro.cle === introT && temps - introT > intro.total) { etat = 'JEU'; debutJeu = temps; intro.vedettes.forEach(v => v.vue && v.vue.liberer()); intro.vedettes.forEach(v => v.vue = null); ono('FIGHT!!', moi.x, moi.y - 60, 1.6, '#ffe14a'); }
    }
    else { if (etat === 'JEU') maj(); else temps++; dessinerJeu(); if (etat !== 'JEU') zoneSure(dessinerFin); }
    requestAnimationFrame(boucle);
  };

  // ---------- FIN DE PARTIE : YATTA ! / GAAAN… ----------
  const _dessinerFin = window.dessinerFin;
  window.dessinerFin = function () {
    _dessinerFin();
    const u = U(), t = temps - (finInfo ? finInfo.t0 : temps), vic = etat === 'VICTOIRE';
    if (t < 12) return;
    const k = elastique(Math.min(1, (t - 12) / 20)), txt = vic ? 'YATTAAA!!' : etat === 'EGALITE' ? 'HEIN ?!' : 'GAAAN…';
    ctx.save(); ctx.translate(W * 0.13, H * 0.2); ctx.rotate(-0.18); ctx.scale(k, k); eclat(0, 0, 52 * u, 11, vic ? '#ffe14a' : '#9fb4ff', 4, NOIR, 4 * u); bd(txt, 0, 0, 30 * u, vic ? '#ff2d55' : '#fff'); ctx.restore();
    if (vic) { ctx.save(); ctx.translate(W * 0.87, H * 0.78); ctx.rotate(0.16); ctx.scale(k, k); bd('WAHAHA!', 0, 0, 30 * u, '#5ff0ff'); ctx.restore(); }
    else if (etat === 'DEFAITE') { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 5; i++) { const x = W * (0.8 + i * 0.03), y = ((t * 2 + i * 60) % (H * 0.6)) + H * 0.1; ctx.fillStyle = '#9fb4ff'; ctx.fillRect(x, y, 2 * u, 40 * u); } ctx.restore(); } // "traits de déprime"
  };
})();
