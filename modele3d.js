// =====================================================================
// 🧍 PERSOS 3D — vrais modèles .glb (générés avec Meshy / Tripo)
// Le modèle est chargé, mis à l'échelle, animé (repos / marche) et rendu
// en haute définition : planche de sprites pour le jeu (rapide sur mobile)
// et rendu en direct pour le menu et l'admin (rotation au doigt).
// =====================================================================
const Modele3D = (() => {
  const DIRS = 16, S = 224, MARCHE = 6;           // 16 directions, 1 pose de repos + 6 poses de marche
  let rendu = null, scene = null, camera = null, loader = null;
  const fichiers = {};                            // cache des fichiers .glb téléchargés
  const dispo = () => typeof THREE !== 'undefined' && !!THREE.GLTFLoader;

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setClearColor(0x000000, 0); rendu.outputEncoding = THREE.sRGBEncoding;
    rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    const ciel = new THREE.Scene(), gc = document.createElement('canvas'); gc.width = 2; gc.height = 64; // lumière d'environnement douce
    const gx = gc.getContext('2d'), gg = gx.createLinearGradient(0, 0, 0, 64); gg.addColorStop(0, '#eaf6ff'); gg.addColorStop(0.5, '#aab7d4'); gg.addColorStop(1, '#3b3450');
    gx.fillStyle = gg; gx.fillRect(0, 0, 2, 64);
    ciel.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(rendu); scene.environment = pm.fromScene(ciel, 0.04).texture; pm.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b4070, 0.5));
    const soleil = new THREE.DirectionalLight(0xfff1dc, 1.5); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0x8fd3ff, 0.8); contre.position.set(3, 2, -3); scene.add(contre);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60); camera.position.set(0, 4.3, 4.0); camera.lookAt(0, 0.95, 0); // vue 3/4 du dessus
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
    const boite = new THREE.Box3().setFromObject(obj), taille = boite.getSize(new THREE.Vector3()), centre = boite.getCenter(new THREE.Vector3());
    const k = 2 / Math.max(0.01, taille.y) * (+p.modeleEchelle || 1);
    obj.scale.setScalar(k); obj.position.set(-centre.x * k, -boite.min.y * k, -centre.z * k);
    obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 1; } });
    const mixer = new THREE.AnimationMixer(obj), clips = gltf.animations || [];
    const trouver = (nom, motif) => clips.find(c => nom && c.name === nom) || clips.find(c => motif.test(c.name));
    const anims = {
      repos: trouver(p.animRepos, /idle|stand|repos|breath/i),
      marche: trouver(p.animMarche, /walk|run|marche|move|fly|swim/i),
      attaque: trouver(p.animAttaque, /attack|shoot|cast|throw|attaque|punch/i)
    };
    return { racine, mixer, anims, decalage: (+p.modeleRotation || 0) * Math.PI / 180, liberer: () => obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }) };
  }
  function poser(m, anim, t) { // place le modèle à l'instant t d'une animation
    m.mixer.stopAllAction();
    const clip = m.anims[anim] || m.anims.repos;
    if (clip) { const a = m.mixer.clipAction(clip); a.reset(); a.play(); m.mixer.setTime(t * clip.duration); }
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
    const face = document.createElement('canvas'); face.width = face.height = S; face.getContext('2d').drawImage(planche, 4 * S, 0, S, S, 0, 0, S, S);
    const cad = cadrage(face); m.liberer();
    return { planche, S, DIRS, POSES: MARCHE + 1, MARCHE, haut: cad.haut, bas: cad.bas, face };
  }
  async function visage(p) { // image de face (cartes, portraits)
    const m = await charger(p); if (!m) return null;
    const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(photo(m, Math.PI / 2, 'repos', 0, S), 0, 0);
    m.liberer(); return c;
  }
  async function vitrine(p) { // rendu en direct (menu) : animation de repos + rotation au doigt
    const m = await charger(p); if (!m) return null;
    const c = document.createElement('canvas');
    return {
      rendre(angle, taille, t = 0) {
        c.width = c.height = taille; const x = c.getContext('2d'); x.clearRect(0, 0, taille, taille); x.drawImage(photo(m, angle, 'repos', t % 1, taille), 0, 0);
        if (!this.haut) { const cad = cadrage(c); this.haut = cad.haut / taille; this.bas = cad.bas / taille; } return c;
      },
      liberer: () => m.liberer()
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
  return { dispo, generer, visage, vitrine, apercu };
})();
