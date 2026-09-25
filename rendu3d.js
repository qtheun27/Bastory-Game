// =====================================================================
// 🎥 VRAIE 3D (Three.js) : terrain, blocs, herbes hautes, eau, persos et
// boss animés en direct, ombres portées, caméra penchée façon arène.
// Le jeu (règles, positions) ne change pas : ce module "filme" la partie.
// L'interface, les effets et les onomatopées restent dessinés par-dessus.
// =====================================================================
const Rendu3D = (() => {
  let R = null, scene, camera, soleil, ray, GRAD, groupe = null, carteCle = '', horloge = 0, echec = false, actif = false;
  const persos = new Map(), HM = 64, NOIR3 = 0x0b0620, texs = {}; let buissons = [];

  function init() {
    if (R || echec) return !!R;
    if (typeof THREE === 'undefined' || typeof Modele3D === 'undefined') { echec = true; return false; }
    try { R = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { echec = true; return false; }
    R.outputEncoding = THREE.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(R.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '0', display: 'none' });
    document.body.prepend(R.domElement); canvas.style.position = 'relative'; canvas.style.zIndex = '1'; // l'interface 2D passe devant
    scene = new THREE.Scene(); scene.background = new THREE.Color('#8fd3ff'); scene.fog = new THREE.Fog('#8fd3ff', 2600, 5200);
    camera = new THREE.PerspectiveCamera(34, 1, 10, 8000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4d8a, 0.42));
    soleil = new THREE.DirectionalLight(0xfff1d6, 0.62); soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.bias = -0.0006;
    Object.assign(soleil.shadow.camera, { left: -1300, right: 1300, top: 1300, bottom: -1300, near: 10, far: 4000 });
    scene.add(soleil, soleil.target);
    GRAD = new THREE.DataTexture(new Uint8Array([95, 95, 95, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
    ray = new THREE.Raycaster();
    return true;
  }
  const lin = c => new THREE.Color(/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888').convertSRGBToLinear();
  const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: lin(c), gradientMap: GRAD, ...o });
  const encre = (o = {}) => new THREE.MeshBasicMaterial({ color: NOIR3, side: THREE.BackSide, ...o }); // contour noir (coque inversée)
  function texMur(c, st) { // 🧱 texture dessinée selon l'ambiance : pierre, brique, grès, glace, bois
    const k = c + st; if (texs[k]) return texs[k]; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const clair = (bx, by, w, h) => { x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(bx + 4, by + 2, w - 8, 3); x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(bx + 3, by + h - 4, w - 6, 3); };
    x.fillStyle = ombrer(c, -0.4); x.fillRect(0, 0, 128, 128);
    if (st === 'bois') { for (let i = 0; i < 4; i++) { x.fillStyle = ombrer(c, (alea(i * 3.3) - 0.5) * 0.2); x.fillRect(i * 32 + 2, 0, 28, 128); x.fillStyle = 'rgba(0,0,0,.15)'; for (let n = 0; n < 3; n++) x.fillRect(i * 32 + 8 + n * 7, 10 + alea(i + n) * 90, 2, 20); x.fillStyle = '#3a2a1a'; x.fillRect(i * 32 + 14, 12, 4, 4); x.fillRect(i * 32 + 14, 110, 4, 4); } }
    else if (st === 'gres') { for (let r = 0; r < 5; r++) { x.fillStyle = ombrer(c, (r % 2 ? 0.08 : -0.05) + (alea(r) - 0.5) * 0.1); x.fillRect(0, r * 26 + 1, 128, 24); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 6; i++) { const px = alea(r * 7 + i) * 128; x.moveTo(px, r * 26 + 6); x.lineTo(px + 10, r * 26 + 14); } x.stroke(); clair(0, r * 26, 128, 26); } }
    else if (st === 'glace') { x.fillStyle = ombrer(c, 0.15); x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(10 + i * 40, 120); x.lineTo(40 + i * 40, 10); x.stroke(); } x.strokeStyle = ombrer(c, -0.3); x.lineWidth = 2; x.strokeRect(2, 2, 124, 124); }
    else if (st === 'pierre') { for (let n = 0; n < 9; n++) { const bx = (n % 3) * 43 + (alea(n) - 0.5) * 6, by = Math.floor(n / 3) * 43 + (alea(n + 9) - 0.5) * 6; x.fillStyle = ombrer(c, (alea(n * 5.1) - 0.5) * 0.25); x.beginPath(); x.roundRect(bx + 3, by + 3, 37, 37, 12); x.fill(); clair(bx, by, 43, 43); } }
    else for (let r = 0; r < 4; r++) for (let i = -1; i < 3; i++) { const bx = i * 64 + (r % 2) * 32, by = r * 32; x.fillStyle = ombrer(c, (alea(r * 5.3 + i * 2.1) - 0.5) * 0.2); x.beginPath(); x.roundRect(bx + 3, by + 3, 58, 26, 5); x.fill(); clair(bx, by, 64, 32); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return texs[k] = t;
  }
  let eauTex = null, eauMat = null, cristaux = new Map(), geoTir = null; const tirs = new Map(), eclats = [];
  let viseeG = null;
  function majVisee() { // 🎯 faisceau lumineux au sol + cercle d'impact animé (vue 3D)
    if (!viseeG) { viseeG = new THREE.Group(); viseeG.visible = false;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d'), g = x.createLinearGradient(0, 64, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      const fais = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      fais.rotation.x = -Math.PI / 2; fais.position.y = 3; viseeG.add(fais);
      const an = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      an.rotation.x = -Math.PI / 2; an.position.y = 4; viseeG.add(an);
      const pl = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
      pl.rotation.x = -Math.PI / 2; pl.position.y = 3.5; viseeG.add(pl); scene.add(viseeG);
    }
    const v = typeof visee3D !== 'undefined' && visee3D; viseeG.visible = !!v && !!moi && moi.pv > 0; if (!viseeG.visible) return;
    const [fais, an, pl] = viseeG.children, c = lin(v.c), pulse = 0.5 + 0.5 * Math.sin(temps * 0.15), d = v.lob ? Math.max(60, v.P * v.f) : v.P;
    viseeG.position.set(moi.x, 0, moi.y); viseeG.rotation.y = -v.a;
    fais.material.color = c; fais.scale.set(v.lob ? Math.max(20, d - v.R) : d, v.lob ? 26 : 74, 1); fais.position.set(v.lob ? (moi.r + d - v.R) / 2 : (moi.r + d) / 2, 3, 0);
    fais.material.opacity = 0.35 + 0.2 * pulse;
    const R2 = v.lob ? v.R : 40; an.material.color = c; an.scale.setScalar(R2 * (v.lob ? 1 : 0.6) * (1 + pulse * 0.06)); an.position.set(v.lob ? d : d, 4, 0);
    pl.material.color = c; pl.scale.setScalar(R2 * (v.lob ? 0.95 : 0.55)); pl.position.copy(an.position); pl.position.y = 3.5;
  }
  function majTirs() { // 🎯 projectiles en vraie 3D : flèche, rocher, bulle, boule de feu… + éclair de départ
    if (!geoTir) geoTir = { fleche: new THREE.ConeGeometry(6, 36, 6), rocher: new THREE.DodecahedronGeometry(13, 0), bulle: new THREE.SphereGeometry(14, 16, 12), feu: new THREE.SphereGeometry(13, 14, 10), base: new THREE.SphereGeometry(10, 12, 8), eclat: new THREE.SphereGeometry(1, 10, 8),
      etoile: new THREE.OctahedronGeometry(13, 0), lame: new THREE.TorusGeometry(13, 3.5, 6, 18), cristal: new THREE.OctahedronGeometry(10, 0).scale(0.7, 1.6, 0.7) };
    const vus = new Set(projectiles);
    for (const [p, m] of tirs) if (!vus.has(p)) { // 💥 impact : éclat 3D qui grossit et s'efface
      scene.remove(m); tirs.delete(p); (m.userData.trainee || []).forEach(t => { scene.remove(t); t.material.dispose(); });
      if (reglage('impact3D', 1) > 0 && eclats.length < 30) { const b = new THREE.Mesh(geoTir.eclat, new THREE.MeshBasicMaterial({ color: m.userData.c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); b.position.copy(m.position); b.userData.t0 = temps; scene.add(b); eclats.push(b); }
    }
    for (let i = eclats.length - 1; i >= 0; i--) { const b = eclats[i], k = (temps - b.userData.t0) / 12; if (k >= 1) { scene.remove(b); b.material.dispose(); eclats.splice(i, 1); } else { b.scale.setScalar((10 + k * 40) * reglage('impact3D', 1)); b.material.opacity = 0.9 * (1 - k); } }
    for (const p of projectiles) {
      const a = p.arme || {}; if (a.forme === 'onde') continue; // l'onde du marteau reste dessinée au sol
      const f = geoTir[a.forme] ? a.forme : 'base'; let m = tirs.get(p);
      if (!m) { const c = p.sombre ? '#6a00a8' : a.couleur || '#ffffff'; m = new THREE.Group();
        const coeur = new THREE.Mesh(geoTir[f], f === 'bulle' ? toon(c, { transparent: true, opacity: 0.65 }) : toon(c, { emissive: lin(c), emissiveIntensity: f === 'feu' ? 1 : 0.4 })); coeur.castShadow = true; m.add(coeur);
        const e = new THREE.Mesh(geoTir[f], encre()); e.scale.setScalar(1.2); m.add(e);
        if (reglage('haloTirs', 1) > 0) { const g = new THREE.Mesh(geoTir.base, new THREE.MeshBasicMaterial({ color: lin(c).lerp(new THREE.Color(1, 1, 1), 0.3), transparent: true, opacity: 0.35 * reglage('haloTirs', 1), blending: THREE.AdditiveBlending, depthWrite: false })); g.scale.setScalar(2.2); g.userData.halo = true; m.add(g); } // ✨ halo lumineux
        if (f === 'feu') { const h = new THREE.Mesh(geoTir.feu, new THREE.MeshBasicMaterial({ color: 0xfff3b0 })); h.scale.setScalar(0.55); m.add(h); }
        const fl = new THREE.Mesh(geoTir.eclat, new THREE.MeshBasicMaterial({ color: lin(c).lerp(new THREE.Color(1, 1, 1), 0.6), transparent: true, opacity: 1, depthWrite: false })); fl.userData.t0 = temps; m.userData.flash = fl; scene.add(fl);
        m.userData.c = lin(c).lerp(new THREE.Color(1, 1, 1), 0.4); m.userData.trainee = []; m.userData.hist = [];
        for (let i = 0, n = Math.round(reglage('traineeTirs', 6)); i < n; i++) { const t = new THREE.Mesh(geoTir.base, new THREE.MeshBasicMaterial({ color: m.userData.c, transparent: true, opacity: 0.5 * (1 - i / n), blending: THREE.AdditiveBlending, depthWrite: false })); t.visible = false; scene.add(t); m.userData.trainee.push(t); } // ☄️ traînée
        fl.position.set(p.x, 30, p.y); m.scale.setScalar(Math.max(0.7, (a.taille || 16) / 16)); scene.add(m); tirs.set(p, m); }
      const ang = Math.atan2(p.vy || 0, p.vx || 1); m.position.set(p.x, 26 + (p.z || 0), p.y);
      if (f === 'fleche' || f === 'cristal') m.rotation.set(0, -ang, -Math.PI / 2); else if (f === 'lame') m.rotation.set(Math.PI / 2, 0, temps * 0.7); else if (f === 'etoile') m.rotation.set(temps * 0.1, temps * 0.35, 0); else m.rotation.set(temps * 0.2, temps * 0.15, 0);
      const H = m.userData.hist, T = m.userData.trainee; H.unshift(m.position.clone()); if (H.length > T.length * 2 + 2) H.pop();
      T.forEach((t, i) => { const q = H[(i + 1) * 2]; t.visible = !!q; if (q) { t.position.copy(q); t.scale.setScalar(m.scale.x * (1 - i / T.length) * 0.9); } });
      if (f === 'bulle' || f === 'feu') m.children[0].scale.setScalar(1 + Math.sin(temps * 0.4) * 0.08);
      const fl = m.userData.flash; if (fl) { const k = temps - fl.userData.t0; if (k > 8) { scene.remove(fl); m.userData.flash = null; } else { fl.scale.setScalar(8 + k * 5); fl.material.opacity = 1 - k / 8; } } // 💥 éclair de tir
    }
  }
  function construire() { // 🧱 la map en 3D (reconstruite seulement si une case change : bloc cassé, buisson brûlé…)
    const cle = map.g.join(''); if (cle === carteCle) return; carteCle = cle;
    for (const [, m] of cristaux) scene.remove(m); cristaux.clear();
    if (groupe) { scene.remove(groupe); groupe.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    groupe = new THREE.Group(); scene.add(groupe);
    const T = TUILE, d = map.def, th = themeDe(d), hx = h => /^#[0-9a-f]{6}$/i.test(h || ''), h1 = hx(d.herbe1) ? d.herbe1 : '#5fd14a', sab = hx(d.sable) ? d.sable : '#f4d68e';
    scene.background.set(th.ciel); scene.fog.color.set(th.ciel);
    const k = 16, c = document.createElement('canvas'); c.width = map.l * k; c.height = map.h * k; const x = c.getContext('2d');
    map.g.forEach((r, j) => [...r].forEach((t, i) => { // sol peint case par case (dalles biseautées)
      x.fillStyle = t === 'S' ? ((i + j) % 2 ? sab : ombrer(sab, 0.05)) : ((i + j) % 2 ? h1 : ombrer(h1, 0.08)); x.fillRect(i * k, j * k, k, k);
      if (th.solStyle === 'pave' && t !== 'S') { x.fillStyle = ombrer(h1, -0.18); x.fillRect(i * k + k / 2, j * k, 1, k); x.fillRect(i * k, j * k + k / 2, k, 1); } // pavés de ville
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(i * k, j * k, k, 1); x.fillRect(i * k, j * k, 1, k);
      x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(i * k, j * k + k - 1, k, 1); x.fillRect(i * k + k - 1, j * k, 1, k); }));
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(map.l * T, map.h * T), toon('#ffffff', { map: tex })); sol.rotation.x = -Math.PI / 2; sol.position.set(map.l * T / 2, 0, map.h * T / 2); sol.receiveShadow = true; groupe.add(sol);
    const ext = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), toon(th.ext)); ext.rotation.x = -Math.PI / 2; ext.position.set(map.l * T / 2, -3, map.h * T / 2); ext.receiveShadow = true; groupe.add(ext);
    const murs = {}, buis = [], eau = [], coffres = [];
    map.g.forEach((r, j) => [...r].forEach((t, i) => { const p = [i * T + T / 2, j * T + T / 2];
      if (t === '#') { const ci = couleurMur(i * T, j * T); (murs[ci] = murs[ci] || []).push(p); }
      else if (t === 'C') coffres.push(p); else if (t === 'B') buis.push(p); else if (t === 'W') eau.push(p); }));
    const inst = (geo, mat, l, y, ombre, f) => { if (!l.length) return; const m = new THREE.InstancedMesh(geo, mat, l.length), o = new THREE.Object3D();
      l.forEach((p, n) => { o.position.set(p[0], y, p[1]); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); if (f) f(o, p, n); o.updateMatrix(); m.setMatrixAt(n, o.matrix); });
      m.castShadow = ombre; m.receiveShadow = true; groupe.add(m); return m; };
    const PAL = [d.mur || '#c9a27a', ...(d.palette || ['#5ac8fa', '#8e7bff', '#ff9a4a', '#6fd46a'])];
    Object.entries(murs).forEach(([ci, l]) => { const c0 = PAL[ci % PAL.length];
      inst(new THREE.BoxGeometry(T, HM, T), toon('#ffffff', { map: texMur(c0, th.murStyle) }), l, HM / 2, true);
      inst(new THREE.BoxGeometry(T - 6, 7, T - 6), toon(ombrer(c0, 0.35)), l, HM + 3, true);     // dalle du dessus
      inst(new THREE.BoxGeometry(T - 22, 3, T - 22), toon(ombrer(c0, 0.55)), l, HM + 7, false);  // reflet
      inst(new THREE.BoxGeometry(T + 5, HM + 5, T + 5), encre(), l, HM / 2, false); });
    const CL = T - 16, CP = T - 26, CH = 30, couv = new THREE.CylinderGeometry(CP / 2, CP / 2, CL, 14, 1, false, 0, Math.PI), rotC = o => { o.rotation.set(0, 0, Math.PI / 2); };
    inst(new THREE.BoxGeometry(CL, CH, CP), toon(th.coffre), coffres, CH / 2, true);                                   // caisse
    inst(couv, toon(ombrer(th.coffre, 0.15)), coffres, CH, true, rotC);                                              // couvercle bombé
    inst(new THREE.BoxGeometry(8, CH + 2, CP + 2), toon('#ffd23f'), coffres, CH / 2, false, o => o.position.x -= CL * 0.3); // ferrures
    inst(new THREE.BoxGeometry(8, CH + 2, CP + 2), toon('#ffd23f'), coffres, CH / 2, false, o => o.position.x += CL * 0.3);
    inst(new THREE.BoxGeometry(10, 12, 4), toon('#ffe14a', { emissive: lin('#ffb000'), emissiveIntensity: 0.3 }), coffres, CH - 4, false, o => o.position.z += CP / 2 + 1); // serrure
    inst(new THREE.BoxGeometry(CL + 5, CH + 5, CP + 5), encre(), coffres, CH / 2, false);
    inst(new THREE.CylinderGeometry(CP / 2 + 3, CP / 2 + 3, CL + 5, 14, 1, false, 0, Math.PI), encre(), coffres, CH, false, rotC);
    { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x2 = cv.getContext('2d'), ce = d.eau || '#3aa6e0';
      x2.fillStyle = ce; x2.fillRect(0, 0, 128, 128); x2.fillStyle = ombrer(ce, th.lave ? 0.25 : -0.08); for (let n = 0; n < 5; n++) { x2.beginPath(); x2.arc(alea(n * 3) * 128, alea(n * 7) * 128, 18 + alea(n) * 16, 0, 7); x2.fill(); }
      x2.strokeStyle = th.lave ? '#ffe14a' : 'rgba(255,255,255,.9)'; x2.lineWidth = 4; x2.lineCap = 'round';
      for (let n = 0; n < 5; n++) { const ox = alea(n * 5.3) * 100 + 4, oy = alea(n * 2.1) * 110 + 8; x2.beginPath(); x2.moveTo(ox, oy); x2.quadraticCurveTo(ox + 10, oy - 7, ox + 20, oy); x2.stroke(); }
      eauTex = new THREE.CanvasTexture(cv); eauTex.encoding = THREE.sRGBEncoding; eauTex.wrapS = eauTex.wrapT = THREE.RepeatWrapping; }
    eauMat = toon('#ffffff', { map: eauTex, transparent: !th.lave, opacity: th.lave ? 1 : 0.92, emissive: lin(th.lave ? '#ff4a00' : '#000000'), emissiveIntensity: th.lave ? 0.8 : 0 });
    inst(new THREE.BoxGeometry(T, 6, T), eauMat, eau, 1, false); // 🌊 eau (ou lave) qui ondule
    // 🌿 buissons : touffes arrondies + brins + petites fleurs, qui deviennent transparents quand on s'approche
    buissons = []; const vert = d.buisson || '#2fae4a', GS = new THREE.IcosahedronGeometry(1, 1), GC = new THREE.ConeGeometry(1, 1, 5), GF = new THREE.SphereGeometry(4, 6, 4);
    const GB = new THREE.BoxGeometry(1, 1, 1), GY = new THREE.CylinderGeometry(1, 1, 1, 8);
    buis.forEach((p, n) => { // 🌿 buisson selon l'ambiance : touffe, haie taillée, cactus, sapin enneigé
      const g = new THREE.Group(), m1 = toon(ombrer(vert, -0.15), { transparent: true }), m2 = toon(ombrer(vert, 0.12), { transparent: true }), me = encre({ transparent: true }), mf = toon(n % 2 ? '#ffe14a' : '#ff8ac0', { transparent: true }), neige = toon('#ffffff', { transparent: true });
      const ajout = (geo, mat, sx, sy, sz, x, y, z, contour = true) => { const b = new THREE.Mesh(geo, mat); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; g.add(b);
        if (contour) { const e = new THREE.Mesh(geo, me); e.scale.set(sx + 3, sy + 3, sz + 3); e.position.copy(b.position); e.rotation.copy(b.rotation); g.add(e); } return b; };
      const st = th.buissonStyle;
      if (st === 'haie') { ajout(GB, m1, T - 8, 44, T - 8, 0, 22, 0); for (let i = 0; i < 4; i++) ajout(GS, m2, 12, 9, 12, (i % 2 - 0.5) * 26, 46, (Math.floor(i / 2) - 0.5) * 26, false); if (n % 3 === 0) ajout(GF, mf, 1, 1, 1, 10, 50, 8, false); }
      else if (st === 'cactus') { ajout(GY, m2, 11, 62, 11, 0, 31, 0); ajout(GY, m2, 7, 26, 7, 16, 36, 0).rotation.z = -0.5; ajout(GY, m2, 7, 22, 7, -15, 28, 4).rotation.z = 0.6; ajout(GS, m1, 16, 8, 16, 0, 4, 0, false); if (n % 2) ajout(GF, mf, 1, 1, 1, 0, 64, 0, false); }
      else if (st === 'sapin') { for (let i = 0; i < 3; i++) { ajout(GC, m1, 30 - i * 8, 30, 30 - i * 8, 0, 22 + i * 18, 0); ajout(GC, neige, 12 - i * 3, 10, 12 - i * 3, 0, 34 + i * 18, 0, false); } ajout(GY, toon('#6b4a2b'), 5, 14, 5, 0, 5, 0, false); }
      else { for (let i = 0; i < 3; i++) { const r = 20 + alea(p[0] * 0.3 + i * 5) * 8; ajout(GS, i ? m2 : m1, r, r * 0.95, r, (alea(p[1] + i * 3.7) - 0.5) * 30, r * 0.75, (alea(p[0] + i * 9.1) - 0.5) * 30); }
        for (let i = 0; i < 5; i++) { const h = 40 + alea(p[0] + i * 1.3) * 26; ajout(GC, m2, 5, h, 5, (alea(p[1] * 2 + i) - 0.5) * 44, h / 2 + 10, (alea(p[0] * 2 + i) - 0.5) * 44, false).rotation.z = (alea(i + p[0]) - 0.5) * 0.5; }
        if (alea(p[0] * 7 + p[1]) < 0.5) ajout(GF, mf, 1, 1, 1, 8, 44, 10, false); }
      g.position.set(p[0], 0, p[1]); groupe.add(g); buissons.push({ x: p[0], y: p[1], g, mats: [m1, m2, me, mf, neige], op: 1 });
    });
  }

  async function charger(e, p) { // modèle animé du perso / boss (+ contour encré)
    const o = { attente: true }; persos.set(e, o);
    try {
      const m = await Modele3D.instance(p); if (!m) return;
      const k = m.racine.children[0].scale.x || 1, ep = (0.022 / k).toFixed(5), aHull = [];
      m.racine.traverse(x => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; aHull.push(x); } });
      for (const x of aHull) { // coque noire légèrement gonflée = trait d'encre
        const mat = new THREE.MeshBasicMaterial({ color: NOIR3, side: THREE.BackSide, skinning: !!x.isSkinnedMesh });
        mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normal * ' + ep + ';'); };
        mat.customProgramCacheKey = () => 'encre' + ep; // une épaisseur par modèle
        const h = x.isSkinnedMesh ? new THREE.SkinnedMesh(x.geometry, mat) : new THREE.Mesh(x.geometry, mat);
        if (x.isSkinnedMesh) h.bind(x.skeleton, x.bindMatrix); h.frustumCulled = false; h.position.copy(x.position); h.quaternion.copy(x.quaternion); h.scale.copy(x.scale); x.parent.add(h);
      }
      Object.assign(o, m, { attente: false }); scene.add(m.racine);
    } catch (err) { console.warn('3D', p.nom, err); }
  }
  const modeleDe = e => { const p = e.def ? (e.def.cristal ? null : bossBase(e.def)) : baseDe(e.perso); return p && p.modele ? p : null; };
  function majPersos(dt, aff) {
    const la = new Set([...joueurs(), ...bosses]);
    for (const [e, o] of persos) if (!la.has(e)) { if (o.racine) scene.remove(o.racine); persos.delete(e); }
    const vent = 0.03 + Math.max(0, Math.sin(temps * 0.008)) * 0.13; // 🍃 brise permanente + rafales
    if (eauTex) { eauTex.offset.set((temps * 0.004) % 1, Math.sin(temps * 0.02) * 0.08); if (eauMat && eauMat.emissiveIntensity) eauMat.emissiveIntensity = 0.7 + Math.sin(temps * 0.06) * 0.3; } // courant + lave qui pulse
    for (const b of buissons) { b.g.rotation.z = Math.sin(temps * 0.07 + b.x * 0.013) * vent; b.g.rotation.x = Math.cos(temps * 0.06 + b.y * 0.011) * vent * 0.7; const sq = 1 + Math.sin(temps * 0.09 + b.x) * vent * 0.4; b.g.scale.set(1, sq, 1); // 👀 transparence des buissons proches
      const cible = moi && Math.hypot(b.x - moi.x, b.y - moi.y) < 110 ? 0.3 : 1; if (Math.abs(b.op - cible) < 0.01) continue;
      b.op += (cible - b.op) * 0.25; b.mats.forEach(m => { m.opacity = b.op; m.depthWrite = b.op > 0.95; });
    }
    for (const [b, m] of cristaux) if (!la.has(b) || b.pv <= 0) { scene.remove(m); cristaux.delete(b); }
    for (const b of bosses) if (b.def.cristal && b.pv > 0) { // 💎 cristal 3D qui flotte et tourne, couleur de l'équipe
      let m = cristaux.get(b);
      if (!m) { const c = b.eq === -1 ? '#b57bff' : b.eq === -2 ? '#ffd23f' : b.eq === moi.eq ? '#5ac8fa' : '#ff5a6e', geo = new THREE.OctahedronGeometry(1, 0);
        m = new THREE.Group(); const k = new THREE.Mesh(geo, toon(c, { emissive: lin(c), emissiveIntensity: 0.35 })); k.scale.set(26, 44, 26); k.castShadow = true; m.add(k);
        const e2 = new THREE.Mesh(geo, encre()); e2.scale.set(29, 48, 29); m.add(e2); const socle = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 12, 8), toon('#6b6f86')); socle.position.y = -52; m.add(socle);
        scene.add(m); cristaux.set(b, m); }
      m.position.set(b.x, 64 + Math.sin(temps * 0.05) * 6, b.y); m.children[0].rotation.y = m.children[1].rotation.y = temps * 0.02;
      const s = 1 + (b.flash > 0 ? 0.12 : 0); m.scale.setScalar(s);
      const pied = projeter(b.x, b.y, 0), tete = projeter(b.x, b.y, 130); b.topY = b.y + (tete[1] - pied[1]) / aff[3]; b.topT = temps;
    }
    for (const e of la) {
      const p = modeleDe(e); if (!p) continue;
      const o = persos.get(e); if (!o) { charger(e, p); continue; } if (!o.racine) continue;
      if (e.pv <= 0) o.mortT = o.mortT || temps; else o.mortT = 0;
      o.racine.visible = e.pv > 0 ? (e.def ? true : visible(e)) : true; // un perso mort reste au sol
      const cache = e.pv > 0 && !e.def && tuileA(e.x, e.y) === 'B'; // 🌿 caché dans un buisson : translucide (invisible pour les autres)
      if (cache !== o.cache) { o.cache = cache; o.racine.traverse(x => { if (x.material) { x.material.transparent = cache; x.material.opacity = cache ? 0.45 : 1; } }); }
      const ech = e.r * 1.95 * (+(e.def && e.def.modeleEchelle) || +p.modeleEchelle || 1); // même règle pour tous : taille (rayon) × échelle du modèle
      const saut = e.dash && e.dash.saut && temps < e.dash.fin, alt = saut ? Math.sin((1 - (e.dash.fin - temps) / e.dash.duree) * Math.PI) * 80 : (e.alt || 0);
      const pas = Math.abs((e.marche || 0) - (o.marcheP || 0)); const dep = Math.min(12, Math.hypot(e.x - (o.px ?? e.x), e.y - (o.py ?? e.y))); o.px = e.x; o.py = e.y; if (pas > 0.05) o.marcheT = temps; o.pas = (o.pas ?? dep) * 0.85 + dep * 0.15; // 🚶 vitesse réelle (lissée)
      const ta = e.anim && e.anim.n === 'attaque' ? temps - e.anim.t : 99, tt = (e.flash || 0) > 0 ? 8 - e.flash : 99, pu = reglage('rebondPerso', 1);
      const sq = pu * (ta < 8 ? Math.sin(ta / 8 * Math.PI) * 0.1 : 0), st = pu * (tt < 8 ? Math.sin(tt / 8 * Math.PI) * 0.12 : 0); // 💥 petit écrasement au tir, gonflement au coup reçu
      o.racine.scale.set(ech * (1 + sq * 0.6 + st * 0.5), ech * (1 - sq + st * 0.3), ech * (1 + sq * 0.6 + st * 0.5)); o.racine.position.set(e.x, alt, e.y);
      o.racine.rotation.y = Math.PI / 2 - (e.angle || 0) + (o.decalage || 0);
      let anim = 'repos';
      const fin = e.finAnim && etat !== 'JEU' && (e.def || p), nomFin = fin && (e.finAnim === 'victoire' ? fin.animVictoire || fin.animSuper : fin.animDefaite);
      if (fin) anim = nomFin && (o.parNom || {})[nomFin] ? nomFin : e.finAnim === 'victoire' && o.anims.saut ? 'saut' : 'repos'; // 🕺 fin de partie : danse du gagnant, pose du perdant (debout, même s'il était KO)
      else if (e.pv <= 0) anim = 'mort';
      else if (saut) anim = o.anims.saut ? 'saut' : 'marche';
      else if (e.anim && temps - e.anim.t < (DUREE_ANIM[e.anim.n] || 40) && (o.anims[e.anim.n] || (o.parNom || {})[e.anim.n])) anim = e.anim.n;
      else if (temps - (o.marcheT || -99) < 12) anim = 'marche'; // garde la marche entre deux positions reçues du réseau (plus de saccades)
      o.marcheP = e.marche;
      const clip = o.anims[anim] || (o.parNom || {})[anim] || o.anims.repos || Object.values(o.parNom || {})[0]; // jamais de pose en T : au pire la 1re animation du modèle
      if (clip && o.clip !== clip) {
        const a = o.mixer.clipAction(clip); a.reset(); a.setLoop(anim === 'repos' || anim === 'marche' || fin ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true;
        if (o.action && o.action !== a) a.crossFadeFrom(o.action, 0.12, false); a.play(); o.action = a; o.clip = clip;
      }
      const fl = (e.flash || 0) > 0 || (e.touche && temps - e.touche < 6); if (fl !== o.flash) { o.flash = fl; o.racine.traverse(x => { if (x.material && x.material.emissive) x.material.emissive.setRGB(fl ? 0.6 : 0, fl ? 0.6 : 0, fl ? 0.6 : 0); }); } // éclair blanc du coup reçu
      if (o.action) o.action.timeScale = anim === 'marche' ? Math.max(0.6, Math.min(1.8, (o.pas || 2.6) / Math.max(0.5, reglage('pasMarche', 2.6)))) : 1; // pas calés sur la vitesse : plus de glissade
      o.mixer.update(dt);
      if (o.hanches && anim === 'marche') { o.hanches.position.x = o.repos.x; o.hanches.position.z = o.repos.z; } // pas de glissade
      const pied = projeter(e.x, e.y, 0), tete = projeter(e.x, e.y, ech * 2.05); // barre de vie juste au-dessus de la tête
      e.topY = e.y + (tete[1] - pied[1]) / aff[3]; e.topT = temps;
    }
  }
  function projeter(x, z, y = 0) { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
  function rendre(sx, sy) { // 📸 une image de la partie ; renvoie la transformation sol→écran pour dessiner l'interface par-dessus
    if (!init()) return null; actif = true; construire();
    const c = R.domElement, pr = Math.min(dpr, 1.5);
    if (c._w !== W || c._h !== H || c._p !== pr) { R.setPixelRatio(pr); R.setSize(W, H); c._w = W; c._h = H; c._p = pr; }
    c.style.display = 'block';
    const fin = (etat === 'VICTOIRE' || etat === 'DEFAITE' || etat === 'EGALITE') && moi, cible = fin ? new THREE.Vector3(moi.x, 40, moi.y) : new THREE.Vector3(cam.x + sx, 0, cam.y + sy);
    let dist = H / zoom / 0.62; camera.aspect = W / H; camera.updateProjectionMatrix();
    if (fin) { const t = Math.min(1, (temps - (finInfo ? finInfo.t0 : temps)) / 60), e = 1 - Math.pow(1 - t, 3), a = temps * 0.004; dist *= 1 - e * 0.62; // 🎬 zoom cinéma
      camera.position.set(cible.x + Math.sin(a) * dist * 0.53 * e, dist * 0.85 - e * 60, cible.z + Math.cos(a) * dist * 0.53); }
    else camera.position.set(cible.x, dist * 0.85, cible.z + dist * 0.53);
    camera.lookAt(cible); camera.updateMatrixWorld();
    soleil.position.set(cible.x - 700, 1600, cible.z - 600); soleil.target.position.copy(cible);
    const c0 = fin ? { x: moi.x, z: moi.y } : cible, a = projeter(c0.x, c0.z), b = projeter(c0.x + 100, c0.z), d = projeter(c0.x, c0.z + 100);
    const aff = [(b[0] - a[0]) / 100, (b[1] - a[1]) / 100, (d[0] - a[0]) / 100, (d[1] - a[1]) / 100];
    aff.push(a[0] - c0.x * aff[0] - c0.z * aff[2], a[1] - c0.x * aff[1] - c0.z * aff[3]);
    const t = performance.now(); majPersos(Math.min(0.05, (t - (horloge || t)) / 1000), aff); horloge = t;
    majTirs(); majVisee(); R.render(scene, camera);
    return aff;
  }
  function versMonde(sx, sy) { // écran → sol (rayon depuis la caméra)
    ray.setFromCamera({ x: sx / W * 2 - 1, y: -(sy / H) * 2 + 1 }, camera);
    const o = ray.ray.origin, v = ray.ray.direction, t = -o.y / v.y; return { x: o.x + v.x * t, y: o.z + v.z * t };
  }
  const gere = e => { if (!actif) return false; if (e.def && e.def.cristal) return cristaux.has(e); const o = persos.get(e); return !!(o && o.racine); };
  const cacher = () => { if (R && actif) { R.domElement.style.display = 'none'; actif = false; } };
  return { rendre, versMonde, gere, cacher, dispo: () => init() };
})();
