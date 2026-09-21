// =====================================================================
// 🧍 PERSOS 3D — vrais modèles .glb (générés avec Meshy / Tripo)
// Le modèle est chargé, mis à l'échelle, animé (repos / marche) et rendu
// en cel-shading (couleurs en aplats + contour noir façon manga) :
// planche de sprites pour le jeu (rapide sur mobile) et rendu en direct pour le menu, l'intro et l'admin.
// =====================================================================
const Modele3D = (() => {
  const DIRS = 16, S = 224, MARCHE = 6;           // 16 directions, 1 pose de repos + 6 poses de marche
  let rendu = null, scene = null, camera = null, loader = null;
  const fichiers = {};                            // cache des fichiers .glb téléchargés
  const dispo = () => typeof THREE !== 'undefined' && !!THREE.GLTFLoader;
  let GRAD = null; // 3 tons : ombre / mi-ton / lumière (rendu "anime")
  const toon = (m, skin) => new THREE.MeshToonMaterial({ map: m.map || null, color: m.color || new THREE.Color(0xffffff), emissive: m.emissive || new THREE.Color(0), emissiveMap: m.emissiveMap || null,
    gradientMap: GRAD, transparent: !!m.transparent, opacity: m.opacity === undefined ? 1 : m.opacity, alphaTest: m.alphaTest || 0, side: m.side === undefined ? THREE.FrontSide : m.side, skinning: skin, morphTargets: !!m.morphTargets });
  function contour(src, ep, cache = {}) { // ✒️ contour noir : silhouette élargie dessinée sous l'image
    const w = src.width, h = src.height;
    for (const k of ['sil', 'out']) { if (!cache[k]) cache[k] = document.createElement('canvas'); if (cache[k].width !== w || cache[k].height !== h) { cache[k].width = w; cache[k].height = h; } }
    const s = cache.sil.getContext('2d'), o = cache.out.getContext('2d');
    s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, w, h); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#0b0620'; s.fillRect(0, 0, w, h);
    o.clearRect(0, 0, w, h); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; o.drawImage(cache.sil, Math.cos(a) * ep, Math.sin(a) * ep); }
    o.drawImage(src, 0, 0); return cache.out;
  }

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setClearColor(0x000000, 0); rendu.outputEncoding = THREE.sRGBEncoding;
    GRAD = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fd0, 0.85));
    const soleil = new THREE.DirectionalLight(0xfff4e0, 1.25); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0x9fe3ff, 0.55); contre.position.set(3, 2, -3); scene.add(contre);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60); camera.position.set(0, 5.3, 4.9); camera.lookAt(0, 0.9, 0); // vue 3/4 du dessus (avec de la marge pour les grands gestes)
    loader = new THREE.GLTFLoader();
    return true;
  }

  // Charge un modèle (le fichier est téléchargé une seule fois, chaque perso obtient sa propre copie animable)
  async function charger(p) {
    if (!p || !p.modele || !initialiser()) return null;
    if (!fichiers[p.modele]) fichiers[p.modele] = fetch(p.modele).then(r => { if (!r.ok) throw new Error('Modèle introuvable : ' + p.modele); return r.arrayBuffer(); });
    const buf = await fichiers[p.modele];
    const gltf = await new Promise((ok, ko) => loader.parse(buf.slice(0), '', ok, ko));
    const racine = new THREE.Group(), obj = gltf.scene; racine.add(obj);
    // mise à l'échelle automatique : le perso mesure ~2 unités, pieds au sol, centré
    obj.updateMatrixWorld(true);
    let boite = new THREE.Box3(); const v = new THREE.Vector3();
    obj.traverse(o => { if (o.isBone) boite.expandByPoint(o.getWorldPosition(v)); }); // modèle animé : on mesure le squelette (la géométrie brute n'est pas à l'échelle)
    if (boite.isEmpty()) boite = new THREE.Box3().setFromObject(obj);
    else { const h = boite.max.y - boite.min.y; boite.max.y += h * 0.12; boite.min.y -= h * 0.04; } // sommet de la tête et plante des pieds
    const taille = boite.getSize(new THREE.Vector3()), centre = boite.getCenter(new THREE.Vector3());
    const k = 2 / Math.max(0.01, taille.y); // taille normalisée ; la taille voulue (modeleEchelle) est appliquée à l'affichage
    obj.scale.setScalar(k); obj.position.set(-centre.x * k, -boite.min.y * k, -centre.z * k);
    obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material = Array.isArray(o.material) ? o.material.map(m => toon(m, !!o.isSkinnedMesh)) : toon(o.material, !!o.isSkinnedMesh); } });
    const mixer = new THREE.AnimationMixer(obj), clips = gltf.animations || [];
    // choix des animations : nom donné dans l'admin, sinon détection automatique (par ordre de préférence)
    const trouver = (nom, ...motifs) => clips.find(c => nom && c.name === nom) || motifs.map(m => clips.find(c => m.test(c.name))).find(Boolean);
    const anims = {
      repos: trouver(p.animRepos, /idle/i, /breath|repos/i),
      marche: trouver(p.animMarche, /walk(?!.*inplace)/i, /walk/i, /run|marche|move|fly|swim/i),
      attaque: trouver(p.animAttaque, /attack|swing|smash|punch|slash|shoot|cast|throw/i),
      touche: trouver(p.animTouche, /hit|hurt|react|damage|impact/i),
      mort: trouver(p.animMort, /dead|death|dying|die/i),
      releve: trouver(p.animReleve, /stand.?up|get.?up|revive|rise|power.?up/i)
    };
    let hanches = null; obj.traverse(o => { if (!hanches && o.isBone && /hips|pelvis/i.test(o.name)) hanches = o; });
    return { racine, mixer, anims, hanches, repos: hanches && hanches.position.clone(), decalage: (+p.modeleRotation || 0) * Math.PI / 180, liberer: () => obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }) };
  }
  function poser(m, anim, t) { // place le modèle à l'instant t d'une animation
    m.mixer.stopAllAction();
    const clip = m.anims[anim] || m.anims.repos;
    if (clip) { const a = m.mixer.clipAction(clip); a.reset(); a.play(); m.mixer.setTime(Math.min(t, 0.999) * clip.duration);
      if (m.hanches) { m.hanches.position.x = m.repos.x; m.hanches.position.z = m.repos.z; } } // le perso reste sur place (pas de glissade)
    else m.racine.position.y = anim === 'marche' ? Math.abs(Math.sin(t * Math.PI * 2)) * 0.06 : 0; // pas d'animation : petit rebond
  }
  function photo(m, angle, anim, t, taille) {
    rendu.setSize(taille, taille, false);
    m.racine.rotation.y = Math.PI / 2 - angle + m.decalage; poser(m, anim, t);
    scene.add(m.racine); rendu.render(scene, camera); scene.remove(m.racine);
    return rendu.domElement;
  }
  function cadrage(c) { // hauteur réelle du perso dans l'image (pour l'afficher à la bonne taille)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let haut = c.height, bas = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 30) { if (y < haut) haut = y; if (y > bas) bas = y; }
    return bas > haut ? { haut, bas } : { haut: 0, bas: c.height };
  }

  // 🎞️ planche pour le jeu : ligne 0 = repos, lignes 1..6 = marche ; 16 colonnes = directions
  async function generer(p) {
    const m = await charger(p); if (!m) return null;
    const planche = document.createElement('canvas'); planche.width = S * DIRS; planche.height = S * (MARCHE + 1);
    const x = planche.getContext('2d');
    for (let d = 0; d < DIRS; d++) {
      const a = d / DIRS * Math.PI * 2;
      x.drawImage(photo(m, a, 'repos', 0, S), d * S, 0);
      for (let f = 0; f < MARCHE; f++) x.drawImage(photo(m, a, 'marche', f / MARCHE, S), d * S, (f + 1) * S);
    }
    const net = contour(planche, 3); x.clearRect(0, 0, planche.width, planche.height); x.drawImage(net, 0, 0);
    const face = document.createElement('canvas'); face.width = face.height = S; face.getContext('2d').drawImage(planche, 4 * S, 0, S, S, 0, 0, S, S);
    const cad = cadrage(face);
    // 🎬 animations spéciales (attaque, coup reçu, mort, relevé) : 8 directions, taille réduite pour ménager la mémoire
    const S2 = 160, D2 = 8, NB = { attaque: 5, touche: 3, mort: 6, releve: 5 }, lignes = {}, liste = Object.keys(NB).filter(k => m.anims[k]);
    let spec = null;
    if (liste.length) {
      const total = liste.reduce((t, k) => t + NB[k], 0), c2 = document.createElement('canvas'); c2.width = S2 * D2; c2.height = S2 * total; const x2 = c2.getContext('2d');
      let ligne = 0;
      for (const k of liste) { lignes[k] = [ligne, NB[k]];
        for (let f = 0; f < NB[k]; f++, ligne++) for (let d = 0; d < D2; d++) x2.drawImage(photo(m, d / D2 * Math.PI * 2, k, f / (NB[k] - 1), S2), d * S2, ligne * S2); }
      spec = { planche: contour(c2, 2.5), S: S2, DIRS: D2, lignes };
    }
    m.liberer();
    return { planche, S, DIRS, POSES: MARCHE + 1, MARCHE, haut: cad.haut, bas: cad.bas, face, spec };
  }
  async function visage(p) { // image de face (cartes, portraits)
    const m = await charger(p); if (!m) return null;
    const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(contour(photo(m, Math.PI / 2, 'repos', 0, S), 3), 0, 0);
    m.liberer(); return c;
  }
  async function vitrine(p) { // rendu en direct (menu) : animation de repos + rotation au doigt
    const m = await charger(p); if (!m) return null;
    const c = document.createElement('canvas'), cache = {};
    return {
      rendre(angle, taille, t = 0, anim = 'repos') {
        c.width = c.height = taille; const x = c.getContext('2d'); x.clearRect(0, 0, taille, taille); x.drawImage(contour(photo(m, angle, anim, t % 1, taille), Math.max(2, taille / 90), cache), 0, 0);
        if (!this.haut) { const cad = cadrage(c); this.haut = cad.haut / taille; this.bas = cad.bas / taille; } return c;
      },
      a: k => !!m.anims[k], liberer: () => m.liberer()
    };
  }
  async function apercu(p, canvas) { // aperçu admin qu'on fait tourner à la souris / au doigt
    if (canvas._vue) { canvas._vue.liberer(); cancelAnimationFrame(canvas._boucle); }
    let vue; try { vue = canvas._vue = await vitrine(p); } catch (e) { vue = null; }
    const x = canvas.getContext('2d');
    if (!vue) { x.clearRect(0, 0, canvas.width, canvas.height); x.fillStyle = '#fff'; x.font = '14px Inter, sans-serif'; x.textAlign = 'center'; x.fillText(p.modele ? 'Modèle introuvable' : 'Aucun modèle .glb', canvas.width / 2, canvas.height / 2); return; }
    let angle = Math.PI / 2, glisse = null, t = 0;
    canvas.onpointerdown = e => { glisse = e.clientX; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (glisse !== null) { angle -= (e.clientX - glisse) * 0.015; glisse = e.clientX; } };
    canvas.onpointerup = () => glisse = null; canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
    const boucle = () => { t += 1 / 120; x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(vue.rendre(angle, canvas.width, t), 0, 0); canvas._boucle = requestAnimationFrame(boucle); };
    boucle();
  }
  // 🗺️ DÉCOR 3D : murs en pierre, coffres et buissons rendus en 3D (même lumière que les persos), en 3 variantes
  async function decor(d) {
    if (!initialiser()) return null;
    const A = 40 * Math.PI / 180, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    cam.position.set(0, 10 * Math.cos(A), 10 * Math.sin(A)); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0);
    const h = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const tex = (base, taches, n) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${h(i + n) > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + h(i + 7 + n) * 0.1})`; x.fillRect(h(i * 3 + n) * 256, h(i * 7 + n) * 256, 2 + h(i + 1) * 5, 2 + h(i + 2) * 5); }
      for (let i = 0; i < taches; i++) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(h(i + n) * 256, h(i + 50 + n) * 256); x.lineTo(h(i + 9 + n) * 256, h(i + 60 + n) * 256); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
    const couleur = c => new THREE.Color(c).convertSRGBToLinear();
    // cadrage : 1 case = 1,306 × 1 unités ; le dessus mesure 64 px, la face avant 28 px (comme le reste de la map)
    const photo = (obj, l, r, b, t, px) => {
      cam.left = l; cam.right = r; cam.bottom = b; cam.top = t; cam.updateProjectionMatrix();
      const W2 = Math.round((r - l) * 49 * px), H2 = Math.round((t - b) * 83.55 * px); rendu.setSize(W2, H2, false);
      scene.add(obj); rendu.render(scene, cam); scene.remove(obj);
      const c = document.createElement('canvas'); c.width = W2; c.height = H2; c.getContext('2d').drawImage(rendu.domElement, 0, 0); return c;
    };
    const bloc = (seed, coffre) => {
      const g = new THREE.BoxGeometry(1.306, 0.52, 1, 10, 4, 8), p = g.attributes.position, v = new THREE.Vector3();
      if (!coffre) for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = Math.round(v.x * 97 + v.y * 53 + v.z * 71 + seed * 13);
        const f = 0.025 + h(k) * 0.05; v.x *= 1 + (Math.abs(v.x) > 0.6 ? f * 0.3 : 0); v.y += v.y > 0.2 ? h(k + 3) * 0.05 - 0.02 : 0; v.z *= 1 + (Math.abs(v.z) > 0.45 ? f * 0.4 : 0); p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); g.translate(0, 0.26, 0);
      const o = new THREE.Group();
      o.add(new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: tex(coffre ? '#c98a45' : d.mur || '#b3a390', coffre ? 0 : 6, seed * 100), gradientMap: GRAD })));
      if (coffre) { const or = new THREE.MeshToonMaterial({ color: couleur('#ffd23f'), gradientMap: GRAD });
        [[0, 0.26, 0, 1.33, 0.1, 1.02], [0, 0.26, 0, 0.18, 0.54, 1.02]].forEach(([x, y, z, a, b2, c2]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b2, c2), or); m.position.set(x, y, z); o.add(m); }); }
      return contour(photo(o, -0.713, 0.713, -0.443, 0.777, 2), 2.5);
    };
    const buisson = seed => {
      const o = new THREE.Group(), mats = [d.buissonFonce || '#1f7a35', d.buisson || '#2fae4a'].map(c => new THREE.MeshToonMaterial({ color: couleur(c), gradientMap: GRAD }));
      for (let i = 0; i < 14; i++) { const r = 0.2 + h(i + seed * 20) * 0.16, geo = new THREE.IcosahedronGeometry(r, 2), p = geo.attributes.position, v = new THREE.Vector3();
        for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); v.multiplyScalar(1 + (h(Math.round(v.x * 60 + v.y * 70 + v.z * 80) + i) - 0.5) * 0.25); p.setXYZ(k, v.x, v.y, v.z); } geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mats[i < 6 ? 0 : 1]), a = h(i + seed) * Math.PI * 2, dist = i < 6 ? 0.35 : 0.18 * h(i + 3);
        m.position.set(Math.cos(a) * dist * 1.3, (i < 6 ? 0.2 : 0.42) + h(i + 5) * 0.12, Math.sin(a) * dist); o.add(m); }
      return contour(photo(o, -0.85, 0.85, -0.6, 1.0, 2), 2.5);
    };
    const res = { murs: [1, 2, 3].map(n => bloc(n, false)), coffre: bloc(9, true), buissons: [1, 2, 3].map(buisson) };
    return res;
  }
  return { dispo, generer, visage, vitrine, apercu, decor };
})();
