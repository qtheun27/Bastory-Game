// =====================================================================
// 🧍 PERSOS 3D — un squelette unique, paramétrable depuis l'admin
// Chaque perso = même squelette (tête, corps, bras, jambes, oreilles…)
// avec ses propres proportions ; les couleurs (skin) sont tirées de son image.
// Le modèle est rendu une fois en 16 directions × 4 poses de marche
// (planche de sprites) : le jeu reste rapide, même sur mobile.
// =====================================================================
const Perso3D = (() => {
  const DIRS = 16, POSES = 4, S = 160; // taille d'une vignette
  let rendu = null, scene = null, camera = null;

  // Valeurs par défaut du squelette (modifiables dans l'admin)
  const DEFAUT = { t3Taille: 1, t3Tete: 1, t3CorpsL: 1, t3CorpsH: 1, t3BrasL: 1, t3BrasE: 1, t3JambesL: 1, t3JambesE: 1,
                   t3Oreilles: 'aucune', t3Queue: false, t3Couleur1: '', t3Couleur2: '', t3Couleur3: '', t3Skin: '' };
  const param = (p, k) => { const v = p[k]; return v === undefined || v === '' || v === null ? DEFAUT[k] : v; };
  const dispo = () => typeof THREE !== 'undefined';

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setSize(S, S, false); rendu.setClearColor(0x000000, 0);
    rendu.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);           // vue 3/4 du dessus (style arcade)
    camera.position.set(0, 4.3, 4.0); camera.lookAt(0, 0.9, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4a7a, 0.95));
    const soleil = new THREE.DirectionalLight(0xffffff, 0.9); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0x9ad7ff, 0.45); contre.position.set(3, 2, -3); scene.add(contre);
    return true;
  }

  // 🎨 Skin : extrait les couleurs dominantes de l'image du perso
  function palette(src) {
    return new Promise(ok => {
      if (!src) return ok(['#5ac8fa', '#3478f6', '#ffd23f']);
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d');
          x.drawImage(i, 0, 0, 40, 40); const d = x.getImageData(0, 0, 40, 40).data, seaux = {};
          for (let k = 0; k < d.length; k += 4) {
            if (d[k + 3] < 140) continue;                                   // ignore le fond transparent
            const r = d[k], g = d[k + 1], b = d[k + 2], lum = (r + g + b) / 3;
            if (lum < 28 || lum > 238) continue;                            // ignore contours noirs et reflets blancs
            const cle = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
            (seaux[cle] = seaux[cle] || { n: 0, r: 0, g: 0, b: 0 }); seaux[cle].n++; seaux[cle].r += r; seaux[cle].g += g; seaux[cle].b += b;
          }
          const l = Object.values(seaux).sort((a, b) => b.n - a.n).map(s => [s.r / s.n, s.g / s.n, s.b / s.n]), choix = [];
          for (const c2 of l) { if (choix.every(c1 => Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]) > 70)) choix.push(c2); if (choix.length === 3) break; }
          while (choix.length < 3) choix.push(choix[0] ? choix[0].map(v => v * 0.7) : [90, 200, 250]);
          ok(choix.map(c3 => '#' + c3.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')));
        } catch (e) { ok(['#5ac8fa', '#3478f6', '#ffd23f']); }
      };
      i.onerror = () => ok(['#5ac8fa', '#3478f6', '#ffd23f']);
      i.src = src;
    });
  }

  // 🦴 Construit le squelette 3D avec les proportions du perso
  function construire(p, pal, couleurArme) {
    const g = new THREE.Group(), os = {};
    const c1 = param(p, 't3Couleur1') || pal[0], c2 = param(p, 't3Couleur2') || pal[1], c3 = param(p, 't3Couleur3') || pal[2];
    const mat = c => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.45, metalness: 0.05 });
    const contour = new THREE.MeshBasicMaterial({ color: 0x14102a, side: THREE.BackSide });
    const piece = (geo, m, parent, x, y, z, sx = 1, sy = 1, sz = 1) => { // pièce + contour cartoon
      const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); parent.add(me);
      const ct = new THREE.Mesh(geo, contour); ct.scale.setScalar(1.08); me.add(ct); return me;
    };
    const sph = new THREE.SphereGeometry(0.5, 24, 18), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16), cone = new THREE.ConeGeometry(0.5, 1, 16);
    const T = +param(p, 't3Taille'), jL = 0.55 * param(p, 't3JambesL'), jE = 0.13 * param(p, 't3JambesE'), cL = 0.72 * param(p, 't3CorpsL'), cH = 0.8 * param(p, 't3CorpsH');
    const bL = 0.5 * param(p, 't3BrasL'), bE = 0.11 * param(p, 't3BrasE'), tR = 0.36 * param(p, 't3Tete');
    // jambes (pivot à la hanche pour la marche)
    [-1, 1].forEach(s => {
      const hanche = new THREE.Group(); hanche.position.set(s * cL * 0.25, jL, 0); g.add(hanche);
      piece(cyl, mat(c3), hanche, 0, -jL / 2, 0, jE * 2, jL, jE * 2);
      piece(sph, mat(c2), hanche, 0, -jL, 0.05, jE * 2.6, jE * 1.6, jE * 3.4);
      os[s < 0 ? 'jambeG' : 'jambeD'] = hanche;
    });
    const buste = new THREE.Group(); buste.position.y = jL; g.add(buste); os.buste = buste;
    piece(sph, mat(c1), buste, 0, cH / 2, 0, cL, cH, cL * 0.82);                    // corps
    piece(sph, mat(c2), buste, 0, cH * 0.42, cL * 0.3, cL * 0.55, cH * 0.5, cL * 0.3); // ventre
    // bras (pivot à l'épaule)
    [-1, 1].forEach(s => {
      const epaule = new THREE.Group(); epaule.position.set(s * (cL * 0.5 + bE * 0.6), cH * 0.78, 0); buste.add(epaule);
      piece(cyl, mat(c1), epaule, 0, -bL / 2, 0, bE * 2, bL, bE * 2);
      piece(sph, mat(c3), epaule, 0, -bL, 0, bE * 2.6, bE * 2.6, bE * 2.6);
      if (s > 0 && couleurArme) piece(new THREE.BoxGeometry(1, 1, 1), mat(couleurArme), epaule, 0, -bL - bE * 1.2, bE * 2.2, bE * 1.6, bE * 1.6, bE * 5);
      os[s < 0 ? 'brasG' : 'brasD'] = epaule;
    });
    // tête + visage
    const tete = new THREE.Group(); tete.position.y = cH + tR * 0.8; buste.add(tete); os.tete = tete;
    piece(sph, mat(c1), tete, 0, 0, 0, tR * 2, tR * 1.9, tR * 1.9);
    [-1, 1].forEach(s => {
      const oeil = new THREE.Mesh(sph, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })); oeil.position.set(s * tR * 0.38, tR * 0.12, tR * 0.8); oeil.scale.setScalar(tR * 0.55); tete.add(oeil);
      const pup = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0x111122 })); pup.position.set(s * tR * 0.36, tR * 0.12, tR * 1.04); pup.scale.setScalar(tR * 0.28); tete.add(pup);
    });
    const oreilles = param(p, 't3Oreilles');
    if (oreilles !== 'aucune') [-1, 1].forEach(s => {
      if (oreilles === 'rondes') piece(sph, mat(c2), tete, s * tR * 0.75, tR * 0.8, 0, tR * 0.6, tR * 0.6, tR * 0.3);
      else { const o = piece(cone, mat(oreilles === 'cornes' ? '#f1e6c8' : c2), tete, s * tR * 0.62, tR * 0.95, 0, tR * 0.45, tR * (oreilles === 'cornes' ? 0.9 : 1.1), tR * 0.3); o.rotation.z = -s * 0.35; }
    });
    if (param(p, 't3Queue')) { const q = piece(cone, mat(c2), buste, 0, cH * 0.3, -cL * 0.5, 0.18, 0.7, 0.18); q.rotation.x = -1.1; }
    g.scale.setScalar(T);
    return { g, os };
  }

  function poser(m, phase) { // pose de marche (phase 0..1)
    const a = Math.sin(phase * Math.PI * 2);
    m.os.jambeG.rotation.x = a * 0.6; m.os.jambeD.rotation.x = -a * 0.6;
    m.os.brasG.rotation.x = -a * 0.7; m.os.brasD.rotation.x = a * 0.7;
    m.os.buste.position.y = m.os.jambeG.position.y + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.05;
  }

  function vider() { while (scene.children.length > 3) { const o = scene.children[3]; scene.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); } }

  // 🎞️ Planche de sprites : 16 directions (colonnes) × 4 poses (lignes)
  async function generer(p, couleurArme, skinSrc) {
    if (!initialiser()) return null;
    const pal = await palette(skinSrc || param(p, 't3Skin') || p.imageCarte || p.image);
    vider();
    const m = construire(p, pal, couleurArme); scene.add(m.g);
    const planche = document.createElement('canvas'); planche.width = S * DIRS; planche.height = S * POSES;
    const x = planche.getContext('2d');
    for (let po = 0; po < POSES; po++) for (let d = 0; d < DIRS; d++) {
      const angle = d / DIRS * Math.PI * 2;          // angle du jeu (0 = droite, π/2 = bas de l'écran)
      m.g.rotation.y = Math.PI / 2 - angle;           // le modèle regarde dans la direction du déplacement
      poser(m, po / POSES);
      rendu.render(scene, camera); x.drawImage(rendu.domElement, d * S, po * S);
    }
    vider();
    // cadrage automatique : hauteur réelle du modèle dans la vignette (pour l'afficher à la bonne taille)
    const px = x.getImageData(0, 0, S * DIRS, S).data; let haut = S, bas = 0;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S * DIRS; xx += 2) if (px[(yy * S * DIRS + xx) * 4 + 3] > 30) { if (yy < haut) haut = yy; if (yy > bas) bas = yy; }
    if (bas <= haut) { haut = 0; bas = S; }
    return { planche, S, DIRS, POSES, haut, bas, face: extraire(planche, 4, 0) };
  }
  function extraire(pl, d, po) { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(pl, d * S, po * S, S, S, 0, 0, S, S); return c; }

  // Aperçu tournant pour l'admin
  async function apercu(p, couleurArme, canvas, skinSrc) {
    const sp = await generer(p, couleurArme, skinSrc);
    if (!sp) { const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height); x.fillStyle = '#fff'; x.fillText('3D indisponible', 10, 20); return; }
    cancelAnimationFrame(canvas._anim); let t = 0;
    const boucle = () => {
      const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height);
      const d = Math.floor(t / 8) % DIRS, po = Math.floor(t / 6) % POSES; t++;
      x.drawImage(sp.planche, d * S, po * S, S, S, 0, 0, canvas.width, canvas.height);
      canvas._anim = requestAnimationFrame(boucle);
    };
    boucle();
  }
  return { generer, apercu, dispo, DEFAUT };
})();
