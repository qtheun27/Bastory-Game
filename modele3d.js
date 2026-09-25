// =====================================================================
// 🧍 PERSOS 3D — vrais modèles .glb (générés avec Meshy / Tripo)
// Le modèle est chargé, mis à l'échelle, animé (repos / marche) et rendu
// en cel-shading (couleurs en aplats + contour noir façon manga) :
// planche de sprites pour le jeu (rapide sur mobile) et rendu en direct pour le menu, l'intro et l'admin.
// =====================================================================
const Modele3D = (() => {
  const DIRS = 16, S = 224, MARCHE = 6;           // 16 directions, 1 pose de repos + 6 poses de marche
  let rendu = null, scene = null, camera = null, loader = null;
  const fichiers = {}, decodes = {};                            // cache des fichiers .glb téléchargés
  const dispo = () => typeof THREE !== 'undefined' && !!THREE.GLTFLoader;
  let GRAD = null; // 3 tons : ombre / mi-ton / lumière (rendu "anime")
  const aplats = new Map();
  function aplat(t) { if (t) { t.anisotropy = 8; t.needsUpdate = true; } return t; } // texture Meshy telle quelle (pleine résolution)
  const toon = (m, skin) => new THREE.MeshToonMaterial({ map: aplat(m.map) || null, color: m.color || new THREE.Color(0xffffff), gradientMap: GRAD, transparent: !!m.transparent, opacity: m.opacity === undefined ? 1 : m.opacity, alphaTest: m.alphaTest || 0, side: m.side === undefined ? THREE.FrontSide : m.side, skinning: skin, morphTargets: !!m.morphTargets }); // ombrage doux, couleurs d'origine
  function contour(src, ep, cache = {}) { // ✒️ contour noir : silhouette élargie dessinée sous l'image
    const w = src.width, h = src.height;
    for (const k of ['sil', 'out']) { if (!cache[k]) cache[k] = document.createElement('canvas'); if (cache[k].width !== w || cache[k].height !== h) { cache[k].width = w; cache[k].height = h; } }
    const s = cache.sil.getContext('2d'), o = cache.out.getContext('2d');
    s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, w, h); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#0b0620'; s.fillRect(0, 0, w, h);
    o.clearRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; o.drawImage(cache.sil, Math.cos(a) * ep, Math.sin(a) * ep); }
    o.drawImage(src, 0, 0); return cache.out;
  }

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setClearColor(0x000000, 0); rendu.outputEncoding = THREE.sRGBEncoding;
    GRAD = new THREE.DataTexture(new Uint8Array([160, 160, 160, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd0c8e8, 0.4));
    const soleil = new THREE.DirectionalLight(0xffffff, 0.62); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0xffffff, 0.12); contre.position.set(3, 2, -3); scene.add(contre);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60); camera.position.set(0, 5.6, 5.4); camera.lookAt(0, 1.15, 0); // vue 3/4 du dessus (avec de la marge pour les grands gestes)
    loader = new THREE.GLTFLoader();
    if (THREE.DRACOLoader) { const dr = new THREE.DRACOLoader(); dr.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/'); loader.setDRACOLoader(dr); } // modèles compressés (Meshy)
    return true;
  }

  // Charge un modèle (le fichier est téléchargé une seule fois, chaque perso obtient sa propre copie animable)
  async function charger(p) {
    if (!p || !p.modele || !initialiser()) return null;
    if (!fichiers[p.modele]) fichiers[p.modele] = fetch(p.modele).then(r => { if (!r.ok) throw new Error('Modèle introuvable : ' + p.modele); return r.arrayBuffer(); });
    const clonable = !!(THREE.SkeletonUtils && THREE.SkeletonUtils.clone);
    if (!clonable || !decodes[p.modele]) decodes[p.modele] = fichiers[p.modele].then(buf => new Promise((ok, ko) => loader.parse(buf.slice(0), '', ok, ko)));
    const gltf = await decodes[p.modele];
    const racine = new THREE.Group(), obj = clonable ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene; racine.add(obj);
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
    const VOL = /fly|flap|glide|hover|wing/i, air = p.element === 'air' && clips.some(c => VOL.test(c.name)); // 💨 perso volant : jamais d'animation de marche dans le vide
    const anims = {
      repos: trouver(p.animRepos, ...(air ? [VOL] : []), /idle/i, /breath|repos|look.?around/i, /baselayer|clip0/i),
      marche: air ? trouver(p.animMarche, VOL) : trouver(p.animMarche, /walk(?!.*inplace)/i, /walk/i, /run|marche|move|swim/i),
      attaque: trouver(p.animAttaque, /^(?!.*(react|hit|hurt)).*(attack|swing|smash|punch|slash|thrust|shoot|shot|cast|throw|bow|arch|spell|skill|strike|kick|combat|atk|magic)/i), // jamais une « réaction » au coup
      touche: trouver(p.animTouche, /hit|hurt|react|damage|impact/i),
      mort: trouver(p.animMort, /dead|death|dying|die/i),
      saut: trouver(p.animSaut, /jump|leap|hop|saut/i),
      releve: trouver(p.animReleve, /stand.?up|get.?up|revive|rise|power.?up/i)
    };
    if (!anims.attaque) anims.attaque = clips.find(c => c !== anims.repos && c !== anims.marche && !/idle|walk|run|dead|death|die|hit|hurt|react|stand|breath|t-?pose|fly|hover/i.test(c.name)); // repli : 1re animation « d'action »
    let hanches = null; obj.traverse(o => { if (!hanches && o.isBone && /hips|pelvis/i.test(o.name)) hanches = o; });
    const parNom = Object.fromEntries(clips.map(c => [c.name, c]));
    return { p, racine, mixer, anims, parNom, clips: clips.map(c => c.name), hanches, repos: hanches && hanches.position.clone(), decalage: (+p.modeleRotation || 0) * Math.PI / 180, liberer: () => clonable || obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }) };
  }
  function poser(m, anim, t) { // place le modèle à l'instant t d'une animation
    m.mixer.stopAllAction();
    if (procActif(m, m.p)) return animer(m, anim, t * 90, { phase: t * Math.PI * 2, danse: m.p.danseProc, force: +m.p.forceAnim || 1, nom: m.p.nom });
    const clip = m.anims[anim] || (m.parNom || {})[anim] || m.anims.repos; // clé (repos, attaque…) ou nom exact d'animation
    if (clip) { const a = m.mixer.clipAction(clip); a.reset(); a.play(); m.mixer.setTime(Math.min(t, 0.999) * clip.duration);
      if (m.hanches) { m.hanches.position.x = m.repos.x; m.hanches.position.z = m.repos.z; } } // le perso reste sur place (pas de glissade)
    else m.racine.position.y = anim === 'marche' ? Math.abs(Math.sin(t * Math.PI * 2)) * 0.06 : 0; // pas d'animation : petit rebond
  }
  function photo(m, angle, anim, t, taille, zoom = 1, face = false) {
    rendu.setSize(taille, taille, false); if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
    if (face) camera.position.set(0, 0.75, 7.3); else camera.position.set(0, 5.6, 5.4); camera.lookAt(0, face ? 1.05 : 1.15, 0); // face = vue droite, un peu par en dessous (effet de grandeur)
    m.racine.rotation.y = Math.PI / 2 - angle + m.decalage; poser(m, anim, t);
    scene.add(m.racine); rendu.render(scene, camera); scene.remove(m.racine);
    return rendu.domElement;
  }
  function bords(c0) { const c = document.createElement('canvas'); c.width = c0.width; c.height = c0.height; c.getContext('2d').drawImage(c0, 0, 0); // copie 2D de l'image WebGL
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height, a = (x, y) => d[(y * w + x) * 4 + 3] > 30; let t = false;
    for (let x = 0; x < w; x += 3) if (a(x, 1) || a(x, h - 2)) { t = true; break; } if (!t) for (let y = 0; y < h; y += 3) if (a(1, y) || a(w - 2, y)) { t = true; break; } return t; }
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
    const c = document.createElement('canvas'); c.width = c.height = 512; let z = 1; for (let n = 0; n < 5 && bords(photo(m, Math.PI / 2, 'repos', 0, 256, z, true)); n++) z *= 0.85; // recule tant que le perso est coupé
    c.getContext('2d').drawImage(contour(photo(m, Math.PI / 2, 'repos', 0, 512, z * 0.95, true), 5), 0, 0); // portrait HD
    m.liberer(); return c;
  }
  async function vitrine(p) { // rendu en direct (menu) : animation de repos + rotation au doigt
    const m = await charger(p); if (!m) return null;
    const c = document.createElement('canvas'), cache = {};
    return {
      rendre(angle, taille, t = 0, anim = 'repos') {
        const now = performance.now(); if (this.fait && now - this.fait < 33 && taille === this.taille && anim === this.anim && Math.abs(angle - this.angle) < 0.005) return c; // 30 images/s suffisent
        Object.assign(this, { fait: now, taille, anim, angle });
        c.width = c.height = taille; const x = c.getContext('2d'); x.clearRect(0, 0, taille, taille); x.drawImage(contour(photo(m, angle, anim, t % 1, taille, this.z || (this.z = (() => { let z = 1; for (let n = 0; n < 5 && bords(photo(m, Math.PI / 2, 'repos', 0, 200, z, true)); n++) z *= 0.85; return z * 0.93; })()), true), Math.max(2, taille / 90), cache), 0, 0);
        if (!this.haut) { const cad = cadrage(c); this.haut = cad.haut / taille; this.bas = cad.bas / taille; } return c;
      },
      a: k => !!(m.anims[k] || m.parNom[k]), liberer: () => m.liberer()
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
    const boucle = () => { if ((boucle.n = (boucle.n || 0) + 1) % 3) { canvas._boucle = requestAnimationFrame(boucle); return; } t += 1 / 40; x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(vue.rendre(angle, canvas.width, t), 0, 0); canvas._boucle = requestAnimationFrame(boucle); };
    boucle();
  }
  // 🗺️ DÉCOR 3D : murs en pierre, coffres et buissons rendus en 3D (même lumière que les persos), en 3 variantes
  async function decor(d) {
    if (!initialiser()) return null;
    const A = 40 * Math.PI / 180, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    cam.position.set(0, 10 * Math.cos(A), 10 * Math.sin(A)); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0);
    const h = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const tex = (base, taches, n) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(${h(i + n) > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + h(i + 7 + n) * 0.1})`; x.fillRect(h(i * 3 + n) * 256, h(i * 7 + n) * 256, 2 + h(i + 1) * 5, 2 + h(i + 2) * 5); }
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
    const bloc = (seed, coffre, teinte) => { // teinte : couleur du bloc (palette de la map)
      const g = new THREE.BoxGeometry(1.306, 0.52, 1, 10, 4, 8), p = g.attributes.position, v = new THREE.Vector3();
      if (!coffre) for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = Math.round(v.x * 97 + v.y * 53 + v.z * 71 + seed * 13);
        const f = 0.025 + h(k) * 0.05; v.x *= 1 + (Math.abs(v.x) > 0.6 ? f * 0.3 : 0); v.y += v.y > 0.2 ? h(k + 3) * 0.05 - 0.02 : 0; v.z *= 1 + (Math.abs(v.z) > 0.45 ? f * 0.4 : 0); p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); g.translate(0, 0.26, 0);
      const o = new THREE.Group();
      o.add(new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: tex(coffre ? '#c98a45' : teinte || d.mur || '#b3a390', coffre ? 0 : 6, seed * 100), gradientMap: GRAD })));
      if (coffre) { const or = new THREE.MeshToonMaterial({ color: couleur('#ffd23f'), gradientMap: GRAD });
        [[0, 0.26, 0, 1.33, 0.1, 1.02], [0, 0.26, 0, 0.18, 0.54, 1.02]].forEach(([x, y, z, a, b2, c2]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b2, c2), or); m.position.set(x, y, z); o.add(m); }); }
      if (!coffre) { const dessus = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.05, 0.86), new THREE.MeshToonMaterial({ color: couleur(teinte || d.mur || '#b3a390').lerp(new THREE.Color(1, 1, 1), 0.4), gradientMap: GRAD }));
        dessus.position.y = 0.545; o.add(dessus); } // liseré clair sur le dessus du bloc
      return contour(photo(o, -0.713, 0.713, -0.443, 0.777, 2), 3.5);
    };
    const buisson = seed => {
      const o = new THREE.Group(), mats = [d.buissonFonce || '#1f7a35', d.buisson || '#2fae4a'].map(c => new THREE.MeshToonMaterial({ color: couleur(c), gradientMap: GRAD }));
      for (let i = 0; i < 46; i++) { // 🌿 hautes herbes dessinées (brins en cône)
        const hg = 0.45 + h(i + seed * 20) * 0.4, b = new THREE.Mesh(new THREE.ConeGeometry(0.09 + h(i + 3) * 0.05, hg, 4), mats[i % 3 ? 1 : 0]);
        b.position.set((h(i * 3 + seed) - 0.5) * 1.25, hg / 2, (h(i * 7 + seed) - 0.5) * 0.95); b.rotation.set((h(i + 9) - 0.5) * 0.5, h(i) * 3, (h(i + 5) - 0.5) * 0.5); o.add(b);
      }
      const socle = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.95), mats[0]); socle.position.y = 0.1; o.add(socle);
      return contour(photo(o, -0.85, 0.85, -0.6, 1.0, 2), 3.5);
    };
    const PAL = [d.mur || '#b3a390', ...(d.palette || ['#5ac8fa', '#8e7bff', '#ff9a4a', '#6fd46a'])]; // 🎨 blocs colorés : 3 formes × chaque couleur
    const res = { murs: PAL.flatMap(c => [1, 2, 3].map(n => bloc(n, false, c))), coffre: bloc(9, true), buissons: [1, 2, 3].map(buisson) };
    return res;
  }
  // 🤸 ANIMATIONS CALCULÉES PAR LE JEU : un modèle déposé sans animation bouge quand même (squelette s'il en a un, sinon le corps entier)
  // Tout est calculé dans le repère du perso (haut = +Y, devant = +Z, côté = X) → marche avec n'importe quel squelette (Meshy, Mixamo…)
  const I = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const genre = n => /fore|lower.?arm|elbow/i.test(n) ? 'avant' : /up.?leg|thigh|upper.?leg/i.test(n) ? 'cuisse' : /calf|shin|lower.?leg|knee|(^|[^p])leg/i.test(n) ? 'tibia'
    : /arm/i.test(n) && !/hand|twist|roll|armature/i.test(n) ? 'bras' : /hips|pelvis/i.test(n) ? 'bassin' : /neck/i.test(n) ? 'cou' : /head/i.test(n) && !/end|top|nub/i.test(n) ? 'tete' : /spine|chest/i.test(n) ? 'dos' : null;
  function squelette(obj) { // os utiles + pose de repos
    obj.updateMatrixWorld(true);
    const rac = obj.parent, inv = rac ? rac.matrixWorld.clone().invert() : new THREE.Matrix4(), qR = new THREE.Quaternion(); if (rac) rac.getWorldQuaternion(qR); qR.invert();
    const pos = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), P = {}, os = new Map();
    obj.traverse(b => { if (!b.isBone) return; const g = genre(b.name); if (!g) return;
      const cote = ['bras', 'avant', 'cuisse', 'tibia'].includes(g) ? (pos(b).x >= 0 ? 'G' : 'D') : '', cle = g === 'dos' && P.dos ? 'poitrine' : g + cote;
      if (P[cle] && cle !== 'poitrine') return;
      const enf = b.children.find(x => x.isBone), dir = enf ? pos(enf).sub(pos(b)) : new THREE.Vector3(0, 1, 0);
      const r = { b, q: b.quaternion.clone(), qp: b.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(qR), dir: dir.lengthSq() > 1e-8 ? dir.normalize() : new THREE.Vector3(0, 1, 0), d: new THREE.Quaternion() };
      P[cle] = r; os.set(b, r); });
    for (const r of os.values()) { let a = r.b.parent; while (a && !os.has(a)) a = a.parent; r.anc = a ? os.get(a) : null; }
    return { P, liste: [...os.values()], y0: obj.position.y, z0: obj.position.z, r0: obj.rotation.clone(), os: os.size > 0 };
  }
  function orienter(S, cle, D) { const r = S.P[cle]; if (!r) return; const A = r.anc ? r.anc.d : I; r.b.quaternion.copy(A).multiply(r.qp).invert().multiply(D).multiply(r.qp).multiply(r.q); r.d.copy(D); r.fait = true; }
  const tourne = (S, cle, axe, a) => { const r = S.P[cle]; if (r) orienter(S, cle, new THREE.Quaternion().setFromAxisAngle(axe, a).multiply(r.fait ? r.d : r.anc ? r.anc.d : I)); }; // s'ajoute à la rotation déjà faite cette image
  const vise = (S, cle, v) => { const r = S.P[cle]; if (r) orienter(S, cle, new THREE.Quaternion().setFromUnitVectors(r.dir, v)); };
  const DANSES = ['fete', 'toupie', 'muscles', 'disco'];
  function animer(m, etat, f, o = {}) { // f = images (60/s) depuis le début de l'animation
    const obj = m.racine.children[0], S = m.sq || (m.sq = squelette(obj)), k = +o.force || 1, sin = Math.sin;
    const c01 = x => Math.max(0, Math.min(1, x)), doux = x => { x = c01(x); return x * x * (3 - 2 * x); }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    for (const r of S.liste) { r.b.quaternion.copy(r.q); r.d.identity(); r.fait = false; }
    let y = 0, rx = 0, ry = 0, rz = 0, z = 0, dos = 0, dosY = 0, dosZ = 0, tete = 0;
    const R = [0.38, -1, 0.06]; // bras au repos, le long du corps
    let bG = R, bD = R, aG = null, aD = null, cG = [0.05, -1, 0], cD = [0.05, -1, 0], tG = null, tD = null;
    const souffle = sin(f * 0.0698); // 1 respiration = 90 images (boucle parfaite dans les menus)
    if (etat === 'marche') {
      const ph = o.phase || f * 0.2, sw = sin(ph) * k; y = Math.abs(sin(ph)) * 0.07 * k; dos = 0.12; dosY = sw * 0.12; rz = sw * 0.035;
      cG = [0.05, -1, sw * 0.6]; cD = [0.05, -1, -sw * 0.6]; const tib = c => c[2] < 0 ? [0.03, -1, c[2] * 2.2] : [0.03, -1, c[2] * 0.4]; tG = tib(cG); tD = tib(cD);
      bG = [0.32, -1, -sw * 0.75]; bD = [0.32, -1, sw * 0.75]; aG = [0.28, -1, -sw * 0.6 + 0.45]; aD = [0.28, -1, sw * 0.6 + 0.45];
    } else if (etat === 'attaque' && o.type === 'frappe') { // 🔨 élan au-dessus de la tête → écrasement au sol → retour
      const du = Math.max(4, o.du || 16), H = [0.15, 1, -0.4], B = [0.1, -0.35, 1];
      if (f < du) { const p = doux(f / du); bG = bD = mix(R, H, p); dos = -0.3 * p; tete = -0.1 * p; y = 0.04 * p; }
      else if (f < du + 5) { const p = doux((f - du) / 5); bG = bD = mix(H, B, p); dos = -0.3 + 0.85 * p; y = -0.08 * p; z = 0.12 * p; }
      else { const p = doux((f - du - 5) / 18); bG = bD = mix(B, R, p); dos = 0.55 * (1 - p); y = -0.08 * (1 - p); z = 0.12 * (1 - p); }
      cG = [0.18, -1, 0.25]; cD = [0.18, -1, -0.2];
    } else if (etat === 'attaque' && o.type === 'lob') { // 🤾 lancer : armé en arrière → lancer vers l'avant
      const Ar = [0.35, 0.7, -0.8], Av = [0.15, 0.6, 1];
      if (f < 10) { const p = doux(f / 10); bD = mix(R, Ar, p); bG = mix(R, [0.45, -0.2, 0.8], p); dosY = 0.35 * p; dos = -0.1 * p; }
      else if (f < 16) { const p = doux((f - 10) / 6); bD = mix(Ar, Av, p); bG = mix([0.45, -0.2, 0.8], [0.5, -0.8, -0.2], p); dosY = 0.35 - 0.75 * p; dos = -0.1 + 0.35 * p; z = 0.06 * p; }
      else { const p = doux((f - 16) / 16); bD = mix(Av, R, p); bG = mix([0.5, -0.8, -0.2], R, p); dosY = -0.4 * (1 - p); dos = 0.25 * (1 - p); z = 0.06 * (1 - p); }
    } else if (etat === 'attaque') { // 🎯 tir : bras tendus vers la cible + recul
      const V2 = [0.12, 0.05, 1], p = f < 22 ? doux(f / 4) : 1 - doux((f - 22) / 10), rc = f > 3 && f < 12 ? sin((f - 3) / 9 * Math.PI) : 0;
      bG = mix(R, [0.2, 0, 1], p); bD = mix(R, V2, p); aG = aD = null; dos = -0.12 * rc * k; z = -0.05 * rc * k; tete = -0.05 * rc;
    } else if (etat === 'touche') { const p = 1 - doux(f / 22); dos = -0.35 * p * k; tete = -0.3 * p; bG = bD = mix(R, [0.9, 0.3, -0.3], p); z = -0.1 * p; rz = sin(f * 1.3) * 0.05 * p; }
    else if (etat === 'mort' || etat === 'releve') { const p = etat === 'mort' ? doux(f / 22) : 1 - doux(f / 40); rx = -1.45 * p; bG = bD = mix(R, [1, 0.1, 0], p); cG = cD = mix([0.05, -1, 0], [0.1, -1, 0.35], p); tete = -0.2 * p; }
    else if (etat === 'saut') { bG = bD = [0.6, 0.8, 0.1]; cG = cD = [0.05, -0.4, 0.9]; tG = tD = [0.05, -1, -0.3]; dos = 0.1; }
    else if (etat === 'defaite') { dos = 0.45; tete = 0.5; bG = bD = [0.12, -1, 0.35]; y = -0.03; rz = sin(f * 0.03) * 0.04; }
    else if (etat === 'victoire' || etat === 'super') { // 🕺 danses (réglables par perso)
      let d = o.danse && DANSES.includes(o.danse) ? o.danse : DANSES[[...String(o.nom || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % DANSES.length];
      if (etat === 'super') d = 'super';
      if (d === 'super') { const p = doux(f / 8); bG = bD = mix(R, [0.9, 1, 0.2], p); y = 0.18 * sin(Math.min(1, f / 24) * Math.PI); dos = -0.2 * p; tete = -0.2 * p; }
      else if (d === 'fete') { const h = Math.floor(f / 15) % 2, up = [0.35, 1, 0.15], bas = [0.5, -0.6, 0.45]; y = Math.abs(sin(f * 0.21)) * 0.22 * k; bG = h ? up : bas; bD = h ? bas : up; ry = sin(f * 0.105) * 0.25; dosZ = sin(f * 0.21) * 0.1; }
      else if (d === 'toupie') { ry = f * 0.18; bG = bD = [1, 0.25, 0]; y = Math.abs(sin(f * 0.36)) * 0.1 * k; cG = [0.3, -0.7, 0.3 + 0.3 * sin(f * 0.18)]; }
      else if (d === 'muscles') { bG = bD = [1, 0.35, 0]; aG = aD = [0.15, 1, 0.1]; dosZ = sin(f * 0.12) * 0.18 * k; y = Math.abs(sin(f * 0.24)) * 0.05; tete = sin(f * 0.24) * 0.12; }
      else { const p = (sin(f * 0.157) + 1) / 2, A = [0.6, 0.9, 0.3], Bb = [0.6, -0.9, 0.1]; bG = mix(A, Bb, p); bD = mix(Bb, A, p); dosZ = sin(f * 0.157) * 0.15 * k; cG = [0.1, -1, 0.15 * p]; cD = [0.1, -1, 0.15 * (1 - p)]; y = Math.abs(sin(f * 0.314)) * 0.04; }
    } else { dos = 0.03 * souffle; tete = 0.03 * souffle; bG = bD = [0.38, -1, 0.06 + 0.04 * souffle]; y = 0.01 * souffle; } // repos : respiration
    // corps entier (tous les modèles, même sans squelette)
    obj.position.y = S.y0 + y; obj.position.z = S.z0 + z; obj.rotation.set(S.r0.x + rx, S.r0.y + ry, S.r0.z + rz);
    if (!S.os) return;
    tourne(S, 'bassin', AY, dosY * 0.5); tourne(S, 'dos', AX, dos * 0.6); tourne(S, 'dos', AZ, dosZ); tourne(S, 'poitrine', AX, dos * 0.4); tourne(S, 'poitrine', AY, dosY * 0.5); tourne(S, 'tete', AX, tete); tourne(S, 'cou', AX, tete * 0.5);
    const V3 = (a, s) => new THREE.Vector3(a[0] * s, a[1], a[2]).normalize(), plie = a => [a[0], a[1], a[2] + 0.35];
    for (const [c, s, b, a, cu, ti] of [['G', 1, bG, aG, cG, tG], ['D', -1, bD, aD, cD, tD]]) {
      vise(S, 'bras' + c, V3(b, s)); vise(S, 'avant' + c, V3(a || plie(b), s)); vise(S, 'cuisse' + c, V3(cu, s)); vise(S, 'tibia' + c, V3(ti || cu, s));
    }
  }
  const procActif = (m, p) => !!m && ((p && p.animProc) === 'toujours' || ((p && p.animProc) !== 'jamais' && !(m.clips || []).length));
  async function listeAnims(p) { const m = await charger(p); if (!m) return []; m.liberer(); return m.clips; } // noms des animations d'un modèle (admin)
  return { dispo, generer, visage, vitrine, apercu, decor, instance: charger, listeAnims, animer, procActif }; // instance = modèle animé pour la vraie 3D
})();
