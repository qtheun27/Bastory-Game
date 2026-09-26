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
  // ✨ blancs éclatants : les zones très claires de la texture gardent leur blanc au lieu d'être grisées par l'ombrage (réglage admin « eclatBlancs »)
  const BLANC = { uBlK: { value: 0.7 } }, majBlanc = () => { BLANC.uBlK.value = Math.max(0, Math.min(1, typeof reglage === 'function' ? +reglage('eclatBlancs', 0.7) : 0.7)); };
  function blancs(sh) { majBlanc(); Object.assign(sh.uniforms, BLANC); sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uBlK;\nvoid main() {')
    .replace('#include <tonemapping_fragment>', 'float blc = smoothstep(0.45, 0.9, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) * uBlK;\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, max(gl_FragColor.rgb, diffuseColor.rgb * 1.02), blc);\n#include <tonemapping_fragment>'); }
  const avecBlancs = m => { m.onBeforeCompile = blancs; m.customProgramCacheKey = () => 'blanc'; return m; };
  const toon = (m, skin) => avecBlancs(new THREE.MeshToonMaterial({ map: aplat(m.map) || null, color: m.color || new THREE.Color(0xffffff), gradientMap: GRAD, transparent: !!m.transparent, opacity: m.opacity === undefined ? 1 : m.opacity, alphaTest: m.alphaTest || 0, side: m.side === undefined ? THREE.FrontSide : m.side, skinning: skin, morphTargets: !!m.morphTargets })); // ombrage doux, couleurs d'origine
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
      releve: trouver(p.animReleve, /stand.?up|get.?up|revive|rise|power.?up/i),
      chute: trouver(p.animChute, /fall|skydiv|parachut|chute/i) // 🪂 animation de chute (parachute du début de partie)
    };
    if (!anims.attaque) anims.attaque = clips.find(c => c !== anims.repos && c !== anims.marche && !/idle|walk|run|dead|death|die|hit|hurt|react|stand|breath|t-?pose|fly|hover/i.test(c.name)); // repli : 1re animation « d'action »
    let hanches = null; obj.traverse(o => { if (!hanches && o.isBone && /hips|pelvis/i.test(o.name)) hanches = o; });
    const parNom = Object.fromEntries(clips.map(c => [c.name, c]));
    return { racine, mixer, anims, parNom, clips: clips.map(c => c.name), hanches, repos: hanches && hanches.position.clone(), decalage: (+p.modeleRotation || 0) * Math.PI / 180, liberer: () => clonable || obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }) };
  }
  function poser(m, anim, t) { // place le modèle à l'instant t d'une animation
    m.mixer.stopAllAction();
    const clip = m.anims[anim] || (m.parNom || {})[anim] || m.anims.repos; // clé (repos, attaque…) ou nom exact d'animation
    if (clip) { const a = m.mixer.clipAction(clip); a.reset(); a.play(); m.mixer.setTime(Math.min(t, 0.999) * clip.duration);
      if (m.hanches) { m.hanches.position.x = m.repos.x; m.hanches.position.z = m.repos.z; } } // le perso reste sur place (pas de glissade)
    else m.racine.position.y = anim === 'marche' ? Math.abs(Math.sin(t * Math.PI * 2)) * 0.06 : 0; // pas d'animation : petit rebond
  }
  function photo(m, angle, anim, t, taille, zoom = 1, face = false) {
    rendu.setSize(taille, taille, false); if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
    if (face) camera.position.set(0, 0.75, 7.3); else camera.position.set(0, 5.6, 5.4); camera.lookAt(0, face ? 1.05 : 1.15, 0); // face = vue droite, un peu par en dessous (effet de grandeur)
    m.racine.rotation.y = Math.PI / 2 - angle + m.decalage; poser(m, anim, t);
    tic(); scene.add(m.racine); rendu.render(scene, camera); scene.remove(m.racine);
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
      a: k => !!(m.anims[k] || m.parNom[k]), liberer: () => m.liberer(),
      teinte(skin) { const c = skin ? skin.cle + (skin.style || '') + (skin.couleur1 || '') + (skin.couleur2 || '') + (skin.lueur || '') + (skin.force ?? '') : ''; if (this.skin !== c) { this.skin = c; appliquerSkin(m.racine, skin); this.fait = 0; } }
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
  // 🎨 SKINS : transforment vraiment le perso (or, ombre, glace, lave, bonbon, galaxie…) grâce à un petit shader ajouté aux matériaux
  const UT = { value: 0 }, STYLES = { teinte: 0, dore: 1, ombre: 2, lave: 3, bonbon: 4, galaxie: 5, glace: 6 };
  const tic = () => { UT.value = performance.now() / 1000; majBlanc(); }; // horloge des skins animés (lave qui coule, étoiles…)
  const coul = c => new THREE.Color(c || '#ffffff').convertSRGBToLinear();
  const VERT = ['#include <common>', '#include <common>\nvarying vec3 vPS;', '#include <begin_vertex>', '#include <begin_vertex>\nvPS = position;'];
  const FRAG_TETE = `#include <common>
    uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uRim; uniform float uStyle; uniform float uForce; uniform float uT; uniform float uEch; varying vec3 vPS;
    float hsk(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`;
  const FRAG_COULEUR = `#include <map_fragment>
    vec3 skEm = vec3(0.0); float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); vec3 pp = vPS * uEch; vec3 base = uC1 * (0.35 + 0.9 * lum);
    if (uStyle > 0.5 && uStyle < 1.5) { base = mix(uC1, uC2, smoothstep(0.05, 0.75, lum)); skEm = uC2 * 0.35 * smoothstep(0.93, 1.0, fract(pp.y * 1.2 - uT * 0.35)); }            // or + reflet qui passe
    else if (uStyle < 2.5 && uStyle > 1.5) { base = mix(uC1, uC2, lum * 0.6); }                                                                                                          // ombre
    else if (uStyle < 3.5 && uStyle > 2.5) { float f = 0.5 + 0.5 * sin(pp.x * 17.0 + sin(pp.y * 13.0 + uT * 1.3) * 2.2 + pp.z * 11.0 - uT * 1.8) * (0.75 + 0.25 * sin(pp.y * 23.0 + pp.x * 5.0)); float c = smoothstep(0.72, 0.95, f);
      base = mix(uC1 * (0.5 + 0.5 * lum), uC2, c); skEm = uC2 * c * 1.3; }                                                                                                                 // lave qui coule
    else if (uStyle < 4.5 && uStyle > 3.5) { float r = step(0.5, fract((pp.x + pp.y * 0.9 + pp.z * 0.3) * 3.5)); base = mix(uC1, uC2, r) * (0.7 + 0.45 * lum); }                    // sucre d'orge
    else if (uStyle < 5.5 && uStyle > 4.5) { float n = hsk(floor(pp * 38.0)), st = step(0.982, n) * (0.55 + 0.45 * sin(uT * 3.0 + n * 60.0));
      base = mix(uC1, uC2, 0.5 + 0.5 * sin(pp.y * 3.0 + pp.x * 2.0 + uT * 0.4)) * (0.6 + 0.5 * lum); skEm = vec3(st) + uC2 * 0.12; }                                              // galaxie
    else if (uStyle > 5.5) { base = mix(uC1, uC2, smoothstep(0.1, 0.9, lum)); diffuseColor.a *= 0.82; skEm = uC2 * 0.18; }                                                         // glace translucide
    diffuseColor.rgb = mix(diffuseColor.rgb, base, uForce);`;
  const FRAG_LUEUR = `#include <emissivemap_fragment>
    float rim = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0); totalEmissiveRadiance += (skEm + uRim * pow(rim, 2.2)) * uForce;`;
  function appliquerSkin(racine, skin) {
    racine.traverse(o => { const ms = o.isMesh && o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (m.side === THREE.BackSide && m.color) { if (!m.userData.c0) m.userData.c0 = m.color.clone(); m.color.copy(m.userData.c0); if (skin && skin.contour) m.color.copy(coul(skin.contour)); continue; } // trait d'encre
        if (!m.isMeshToonMaterial && !m.isMeshStandardMaterial) continue;
        if (m.userData.t0 === undefined) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity; }
        const st = skin ? STYLES[skin.style] ?? 0 : -1;
        if (st < 0) { if (m.userData.sk) { avecBlancs(m); m.transparent = m.userData.t0; m.userData.sk = null; m.needsUpdate = true; } continue; }
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const U = { uC1: { value: coul(skin.couleur1) }, uC2: { value: coul(skin.couleur2) }, uRim: { value: coul(skin.lueur || '#000000') }, uStyle: { value: st },
          uForce: { value: Math.max(0, Math.min(1, skin.force === undefined ? 0.9 : +skin.force)) }, uT: UT, uEch: { value: 1 / Math.max(1e-4, o.geometry.boundingSphere.radius) } };
        const cle = 'skin' + st; m.userData.sk = U; m.transparent = st === 6 ? true : m.userData.t0;
        m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace(VERT[0], VERT[1]).replace(VERT[2], VERT[3]);
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', FRAG_TETE).replace('#include <map_fragment>', FRAG_COULEUR).replace('#include <emissivemap_fragment>', FRAG_LUEUR); blancs(sh); };
        m.customProgramCacheKey = () => cle; m.needsUpdate = true;
      } });
  }
  const teinter = appliquerSkin; // (ancien nom)
  async function listeAnims(p) { const m = await charger(p); if (!m) return []; m.liberer(); return m.clips; } // noms des animations d'un modèle (admin)
  return { majBlanc, dispo, generer, visage, vitrine, apercu, decor, instance: charger, listeAnims, teinter, tic }; // instance = modèle animé pour la vraie 3D
})();
