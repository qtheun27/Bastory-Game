// =====================================================================
// 🎥 VRAIE 3D (Three.js) : terrain, blocs, herbes hautes, eau, persos et
// boss animés en direct, ombres portées, caméra penchée façon arène.
// Le jeu (règles, positions) ne change pas : ce module "filme" la partie.
// L'interface, les effets et les onomatopées restent dessinés par-dessus.
// =====================================================================
const Rendu3D = (() => {
  let R = null, scene, camera, soleil, ray, GRAD, groupe = null, carteCle = '', horloge = 0, echec = false, actif = false;
  const persos = new Map(), HM = 64, NOIR3 = 0x0b0620;

  function init() {
    if (R || echec) return !!R;
    if (typeof THREE === 'undefined' || typeof Modele3D === 'undefined') { echec = true; return false; }
    try { R = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { echec = true; return false; }
    R.outputEncoding = THREE.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(R.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '0', display: 'none' });
    document.body.prepend(R.domElement); canvas.style.position = 'relative'; canvas.style.zIndex = '1'; // l'interface 2D passe devant
    scene = new THREE.Scene(); scene.background = new THREE.Color('#8fd3ff'); scene.fog = new THREE.Fog('#8fd3ff', 2600, 5200);
    camera = new THREE.PerspectiveCamera(34, 1, 10, 8000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4d8a, 0.7));
    soleil = new THREE.DirectionalLight(0xfff1d6, 0.9); soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.bias = -0.0006;
    Object.assign(soleil.shadow.camera, { left: -1300, right: 1300, top: 1300, bottom: -1300, near: 10, far: 4000 });
    scene.add(soleil, soleil.target);
    GRAD = new THREE.DataTexture(new Uint8Array([95, 95, 95, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
    ray = new THREE.Raycaster();
    return true;
  }
  const lin = c => new THREE.Color(/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888').convertSRGBToLinear();
  const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: lin(c), gradientMap: GRAD, ...o });
  const encre = () => new THREE.MeshBasicMaterial({ color: NOIR3, side: THREE.BackSide }); // contour noir (coque inversée)

  function construire() { // 🧱 la map en 3D (reconstruite seulement si une case change : bloc cassé, buisson brûlé…)
    const cle = map.g.join(''); if (cle === carteCle) return; carteCle = cle;
    if (groupe) { scene.remove(groupe); groupe.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    groupe = new THREE.Group(); scene.add(groupe);
    const T = TUILE, d = map.def, hx = h => /^#[0-9a-f]{6}$/i.test(h || ''), h1 = hx(d.herbe1) ? d.herbe1 : '#5fd14a', sab = hx(d.sable) ? d.sable : '#f4d68e';
    const k = 16, c = document.createElement('canvas'); c.width = map.l * k; c.height = map.h * k; const x = c.getContext('2d');
    map.g.forEach((r, j) => [...r].forEach((t, i) => { // sol peint case par case (dalles biseautées)
      x.fillStyle = t === 'S' ? ((i + j) % 2 ? sab : ombrer(sab, 0.05)) : ((i + j) % 2 ? h1 : ombrer(h1, 0.08)); x.fillRect(i * k, j * k, k, k);
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(i * k, j * k, k, 1); x.fillRect(i * k, j * k, 1, k);
      x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(i * k, j * k + k - 1, k, 1); x.fillRect(i * k + k - 1, j * k, 1, k); }));
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(map.l * T, map.h * T), toon('#ffffff', { map: tex })); sol.rotation.x = -Math.PI / 2; sol.position.set(map.l * T / 2, 0, map.h * T / 2); sol.receiveShadow = true; groupe.add(sol);
    const ext = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), toon(ombrer(h1, -0.3))); ext.rotation.x = -Math.PI / 2; ext.position.set(map.l * T / 2, -3, map.h * T / 2); ext.receiveShadow = true; groupe.add(ext);
    const murs = {}, buis = [], eau = [], coffres = [];
    map.g.forEach((r, j) => [...r].forEach((t, i) => { const p = [i * T + T / 2, j * T + T / 2];
      if (t === '#') { const ci = couleurMur(i * T, j * T); (murs[ci] = murs[ci] || []).push(p); }
      else if (t === 'C') coffres.push(p); else if (t === 'B') buis.push(p); else if (t === 'W') eau.push(p); }));
    const inst = (geo, mat, l, y, ombre, f) => { if (!l.length) return; const m = new THREE.InstancedMesh(geo, mat, l.length), o = new THREE.Object3D();
      l.forEach((p, n) => { o.position.set(p[0], y, p[1]); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); if (f) f(o, p, n); o.updateMatrix(); m.setMatrixAt(n, o.matrix); });
      m.castShadow = ombre; m.receiveShadow = true; groupe.add(m); return m; };
    const PAL = [d.mur || '#c9a27a', ...(d.palette || ['#5ac8fa', '#8e7bff', '#ff9a4a', '#6fd46a'])];
    Object.entries(murs).forEach(([ci, l]) => { const c0 = PAL[ci % PAL.length];
      inst(new THREE.BoxGeometry(T, HM, T), toon(c0), l, HM / 2, true);
      inst(new THREE.BoxGeometry(T - 12, 5, T - 12), toon(ombrer(c0, 0.4)), l, HM + 2, false);    // dessus clair
      inst(new THREE.BoxGeometry(T + 5, HM + 5, T + 5), encre(), l, HM / 2, false); });
    inst(new THREE.BoxGeometry(T - 10, HM - 12, T - 10), toon('#c98a45'), coffres, (HM - 12) / 2, true);
    inst(new THREE.BoxGeometry(12, HM - 8, T - 6), toon('#ffd23f'), coffres, (HM - 12) / 2, false);
    inst(new THREE.BoxGeometry(T - 4, HM - 6, T - 4), encre(), coffres, (HM - 12) / 2, false);
    inst(new THREE.BoxGeometry(T, 6, T), toon(d.eau || '#3aa6e0', { transparent: true, opacity: 0.9 }), eau, 1, false);
    const brins = []; buis.forEach(p => { for (let i = 0; i < 16; i++) brins.push([p[0] + (alea(p[0] * 0.7 + i * 3.1) - 0.5) * T * 0.95, p[1] + (alea(p[1] * 0.9 + i * 7.3) - 0.5) * T * 0.95]); });
    const pose = (o, p) => { const h = 50 + alea(p[0] * 0.31 + p[1] * 0.17) * 40; o.scale.set(1, h, 1); o.position.y = h / 2; o.rotation.set((alea(p[0]) - 0.5) * 0.45, alea(p[1]) * 3, (alea(p[0] + p[1]) - 0.5) * 0.45); };
    inst(new THREE.ConeGeometry(10, 1, 4), toon(d.buisson || '#2fae4a'), brins, 0, true, pose);
    inst(new THREE.ConeGeometry(13, 1.08, 4), encre(), brins, 0, false, pose);
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
    for (const e of la) {
      const p = modeleDe(e); if (!p) continue;
      const o = persos.get(e); if (!o) { charger(e, p); continue; } if (!o.racine) continue;
      if (e.pv <= 0) o.mortT = o.mortT || temps; else o.mortT = 0;
      o.racine.visible = e.pv > 0 ? (e.def ? true : visible(e)) : temps - o.mortT < 110;
      const ech = (e.def ? e.r * 3.4 : e.r * 3.3) * 0.6 * (+p.modeleEchelle || 1);
      o.racine.scale.setScalar(ech); o.racine.position.set(e.x, e.alt || 0, e.y);
      o.racine.rotation.y = Math.PI / 2 - (e.angle || 0) + (o.decalage || 0);
      let anim = 'repos';
      if (e.pv <= 0) anim = 'mort';
      else if (e.anim && temps - e.anim.t < (DUREE_ANIM[e.anim.n] || 30) && o.anims[e.anim.n]) anim = e.anim.n;
      else if (Math.abs((e.marche || 0) - (o.marcheP || 0)) > 0.05) anim = 'marche';
      o.marcheP = e.marche;
      const clip = o.anims[anim] || o.anims.repos;
      if (clip && o.clip !== clip) {
        const a = o.mixer.clipAction(clip); a.reset(); a.setLoop(anim === 'repos' || anim === 'marche' ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true;
        if (o.action && o.action !== a) a.crossFadeFrom(o.action, 0.12, false); a.play(); o.action = a; o.clip = clip;
      }
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
    const cible = new THREE.Vector3(cam.x + sx, 0, cam.y + sy), dist = H / zoom / 0.62;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(cible.x, dist * 0.85, cible.z + dist * 0.53); camera.lookAt(cible); camera.updateMatrixWorld();
    soleil.position.set(cible.x - 700, 1600, cible.z - 600); soleil.target.position.copy(cible);
    const a = projeter(cible.x, cible.z), b = projeter(cible.x + 100, cible.z), d = projeter(cible.x, cible.z + 100);
    const aff = [(b[0] - a[0]) / 100, (b[1] - a[1]) / 100, (d[0] - a[0]) / 100, (d[1] - a[1]) / 100];
    aff.push(a[0] - cible.x * aff[0] - cible.z * aff[2] + sx * 0, a[1] - cible.x * aff[1] - cible.z * aff[3]);
    const t = performance.now(); majPersos(Math.min(0.05, (t - (horloge || t)) / 1000), aff); horloge = t;
    R.render(scene, camera);
    return aff;
  }
  function versMonde(sx, sy) { // écran → sol (rayon depuis la caméra)
    ray.setFromCamera({ x: sx / W * 2 - 1, y: -(sy / H) * 2 + 1 }, camera);
    const o = ray.ray.origin, v = ray.ray.direction, t = -o.y / v.y; return { x: o.x + v.x * t, y: o.z + v.z * t };
  }
  const gere = e => { const o = actif && persos.get(e); return !!(o && o.racine); };
  const cacher = () => { if (R && actif) { R.domElement.style.display = 'none'; actif = false; } };
  return { rendre, versMonde, gere, cacher, dispo: () => init() };
})();
