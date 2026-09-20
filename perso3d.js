// =====================================================================
// 🧍 PERSOS 3D — même squelette d'animation pour tous (hanches, épaules,
// cou, queue), mais chaque perso a sa MORPHOLOGIE (espèce animale) et son
// HABILLAGE (tenues, motifs, couleurs). Rendu haute définition.
// =====================================================================
const Perso3D = (() => {
  const DIRS = 16, POSES = 4, S = 256;
  let rendu = null, scene = null, camera = null;

  // 🐾 Espèces disponibles (morphologie + couleurs de base)
  const ESPECES = {
    chat:       { nom: 'Chat', couleurs: ['#f4a261', '#fde8cf', '#c8553d'], tete: 1.1, oreilles: 'pointues', museau: 'court', queue: 'longue', moustaches: true, motif: 'ventre' },
    chien:      { nom: 'Chien', couleurs: ['#c68b59', '#f3e0c6', '#5b3a29'], oreilles: 'tombantes', museau: 'long', queue: 'courte', motif: 'taches' },
    lapin:      { nom: 'Lapin', couleurs: ['#f4f4f6', '#ffd6e0', '#f7a8c0'], tete: 1.12, jambesL: 0.85, oreilles: 'lapin', museau: 'court', queue: 'pompon', motif: 'ventre' },
    ours:       { nom: 'Ours', couleurs: ['#8b5a2b', '#dcb68a', '#4a2f17'], corpsL: 1.25, corpsH: 1.1, oreilles: 'rondes', museau: 'court', queue: 'pompon', motif: 'ventre' },
    panda:      { nom: 'Panda', couleurs: ['#f6f6f6', '#f6f6f6', '#1d1d22'], corpsL: 1.2, oreilles: 'rondes', museau: 'court', queue: 'pompon', motif: 'panda', membresFonces: true },
    renard:     { nom: 'Renard', couleurs: ['#ef7a2a', '#fff4e8', '#2f2420'], oreilles: 'pointues', museau: 'long', queue: 'touffue', motif: 'ventre', membresFonces: true },
    tigre:      { nom: 'Tigre', couleurs: ['#f39c12', '#fff1d6', '#1f1f1f'], corpsL: 1.1, oreilles: 'rondes', museau: 'court', queue: 'longue', moustaches: true, motif: 'rayures' },
    lion:       { nom: 'Lion', couleurs: ['#e1a95f', '#f7e1b5', '#8e4a17'], corpsL: 1.15, oreilles: 'rondes', museau: 'court', queue: 'longue', criniere: true, motif: 'ventre' },
    grenouille: { nom: 'Grenouille', couleurs: ['#6ab04c', '#d9f7b0', '#2d6a1f'], tete: 1.22, jambesL: 0.7, oreilles: 'aucune', museau: 'aucun', yeux: 'globuleux', queue: 'aucune', motif: 'taches' },
    pingouin:   { nom: 'Pingouin', couleurs: ['#1f2a44', '#ffffff', '#ff9f1c'], brasL: 0.8, jambesL: 0.6, oreilles: 'aucune', museau: 'bec', queue: 'courte', motif: 'ventre' },
    hibou:      { nom: 'Hibou', couleurs: ['#8d6e63', '#efe6dd', '#ffb300'], oreilles: 'plumes', museau: 'bec', yeux: 'grands', queue: 'aucune', ailes: true, motif: 'ventre' },
    dragon:     { nom: 'Dragon', couleurs: ['#27ae60', '#f7dc6f', '#145a32'], oreilles: 'cornes', museau: 'long', queue: 'dragon', ailes: true, pics: true, motif: 'ventre' },
    licorne:    { nom: 'Licorne', couleurs: ['#ffffff', '#f8c8ff', '#b388ff'], oreilles: 'pointues', museau: 'long', queue: 'touffue', corne: true, criniere: true, motif: 'uni' },
    cochon:     { nom: 'Cochon', couleurs: ['#ffb6c1', '#ffd9e0', '#e57f95'], corpsL: 1.2, oreilles: 'pointues', museau: 'groin', queue: 'courte', motif: 'uni' },
    souris:     { nom: 'Souris', couleurs: ['#a4a4ae', '#ffd6e0', '#6d6d75'], tete: 1.15, corpsL: 0.9, oreilles: 'grandes', museau: 'court', queue: 'fine', moustaches: true, motif: 'ventre' },
    singe:      { nom: 'Singe', couleurs: ['#7b4b2a', '#e8c39e', '#4a2c17'], brasL: 1.3, oreilles: 'rondes', museau: 'court', queue: 'longue', motif: 'ventre' }
  };
  const TENUES = { aucune: 'Aucune', chapeau: 'Chapeau de magicien', casquette: 'Casquette', couronne: 'Couronne', casque: 'Casque', cape: 'Cape',
                   armure: 'Armure', echarpe: 'Écharpe', lunettes: 'Lunettes', sac: 'Sac à dos', ceinture: 'Ceinture', noeud: 'Nœud papillon' };
  const dispo = () => typeof THREE !== 'undefined';

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setClearColor(0x000000, 0); rendu.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 4.3, 4.0); camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b4070, 0.9));
    const soleil = new THREE.DirectionalLight(0xfff4e0, 1.0); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0x8fd3ff, 0.55); contre.position.set(3, 2, -3); scene.add(contre);
    return true;
  }

  // 🎨 couleurs dominantes d'une image (option « couleurs de l'image »)
  function palette(src) {
    return new Promise(ok => {
      if (!src) return ok(null);
      const i = new Image(); if (!src.startsWith('data:')) i.crossOrigin = 'anonymous';
      i.onload = () => { try {
        const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 40, 40);
        const d = x.getImageData(0, 0, 40, 40).data, seaux = {};
        for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 140) continue; const l = (d[k] + d[k + 1] + d[k + 2]) / 3; if (l < 28 || l > 238) continue;
          const cle = (d[k] >> 5) + ',' + (d[k + 1] >> 5) + ',' + (d[k + 2] >> 5); const s = seaux[cle] = seaux[cle] || [0, 0, 0, 0]; s[0]++; s[1] += d[k]; s[2] += d[k + 1]; s[3] += d[k + 2]; }
        const l = Object.values(seaux).sort((a, b) => b[0] - a[0]).map(s => [s[1] / s[0], s[2] / s[0], s[3] / s[0]]), ch = [];
        for (const c2 of l) { if (ch.every(c1 => Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]) > 70)) ch.push(c2); if (ch.length === 3) break; }
        if (!ch.length) return ok(null); while (ch.length < 3) ch.push(ch[0].map(v => v * 0.7));
        ok(ch.map(c3 => '#' + c3.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')));
      } catch (e) { ok(null); } };
      i.onerror = () => ok(null); i.src = src;
    });
  }
  function hasard(n) { const x = Math.sin(n * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); }
  function textureMotif(motif, base, accent) { // rayures / taches peintes sur le pelage
    if (motif !== 'rayures' && motif !== 'taches') return null;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 512, 256); x.fillStyle = accent;
    if (motif === 'rayures') for (let i = 0; i < 14; i++) { const cx = i * 512 / 14 + 10; x.beginPath(); x.moveTo(cx, 20);
      for (let yy = 20; yy <= 236; yy += 12) x.lineTo(cx + Math.sin(yy * 0.05 + i) * 6 + 6, yy); for (let yy = 236; yy >= 20; yy -= 12) x.lineTo(cx + Math.sin(yy * 0.05 + i) * 6, yy); x.fill(); }
    else for (let i = 0; i < 22; i++) { x.beginPath(); x.ellipse(hasard(i) * 512, 30 + hasard(i + 50) * 196, 10 + hasard(i + 9) * 18, 8 + hasard(i + 3) * 12, hasard(i + 7) * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }

  // 🦴 Construction : squelette commun + morphologie de l'espèce + habillage
  function construire(p, pal, couleurArme) {
    const E = ESPECES[p.t3Espece] || ESPECES.chat;
    const v = (k, def) => { const x = p[k]; return x === undefined || x === '' || x === null || x === 'auto' ? def : x; };
    const [c1, c2, c3] = [0, 1, 2].map(i => v('t3Couleur' + (i + 1), p.t3CouleursImage && pal ? pal[i] : E.couleurs[i]));
    const m = k => +v(k, 1) || 1;
    const T = m('t3Taille'), tR = 0.36 * m('t3Tete') * (E.tete || 1), cL = 0.72 * m('t3CorpsL') * (E.corpsL || 1), cH = 0.8 * m('t3CorpsH') * (E.corpsH || 1);
    const bL = 0.5 * m('t3BrasL') * (E.brasL || 1), bE = 0.11 * m('t3BrasE'), jL = 0.55 * m('t3JambesL') * (E.jambesL || 1), jE = 0.13 * m('t3JambesE');
    const oreilles = v('t3Oreilles', E.oreilles), queue = v('t3Queue', E.queue), motif = v('t3Motif', E.motif || 'uni'), museau = v('t3Museau', E.museau);
    const tenues = [p.t3Tenue1, p.t3Tenue2, p.t3Tenue3].filter(t => t && t !== 'aucune'), cT = v('t3CouleurTenue', '#e63946');
    const tex = textureMotif(motif, c1, c3), membres = E.membresFonces ? c3 : c1;

    const g = new THREE.Group(), os = {}, contour = new THREE.MeshBasicMaterial({ color: 0x15112b, side: THREE.BackSide });
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.5, metalness: 0.02 }, o));
    const piece = (geo, ma, parent, x, y, z, sx = 1, sy = 1, sz = 1, trait = true) => {
      const me = new THREE.Mesh(geo, ma); me.position.set(x, y, z); me.scale.set(sx, sy, sz); parent.add(me);
      if (trait) { const ct = new THREE.Mesh(geo, contour); ct.scale.setScalar(1.07); me.add(ct); } return me;
    };
    const sph = new THREE.SphereGeometry(0.5, 32, 24), demi = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20), cone = new THREE.ConeGeometry(0.5, 1, 20), boite = new THREE.BoxGeometry(1, 1, 1), tore = new THREE.TorusGeometry(0.5, 0.12, 12, 32);
    const metal = c => mat(c, { metalness: 0.55, roughness: 0.28 });

    // jambes (pivot hanche)
    [-1, 1].forEach(s => {
      const h = new THREE.Group(); h.position.set(s * cL * 0.25, jL, 0); g.add(h);
      piece(cyl, mat(membres), h, 0, -jL / 2, 0, jE * 2, jL, jE * 2);
      piece(sph, mat(E.membresFonces ? c3 : c2), h, 0, -jL, 0.05, jE * 2.7, jE * 1.6, jE * 3.5);
      os[s < 0 ? 'jambeG' : 'jambeD'] = h;
    });
    const buste = new THREE.Group(); buste.position.y = jL; g.add(buste); os.buste = buste;
    piece(sph, tex ? mat('#ffffff', { map: tex }) : mat(c1), buste, 0, cH / 2, 0, cL, cH, cL * 0.82);
    if (motif === 'ventre' || motif === 'panda' || E.membresFonces) piece(sph, mat(c2), buste, 0, cH * 0.42, cL * 0.3, cL * 0.6, cH * 0.58, cL * 0.32, false);
    // bras (pivot épaule)
    [-1, 1].forEach(s => {
      const e = new THREE.Group(); e.position.set(s * (cL * 0.5 + bE * 0.5), cH * 0.78, 0); buste.add(e);
      piece(cyl, mat(membres), e, 0, -bL / 2, 0, bE * 2, bL, bE * 2);
      piece(sph, mat(E.membresFonces ? c3 : c2), e, 0, -bL, 0, bE * 2.7, bE * 2.7, bE * 2.7);
      if (s > 0 && couleurArme) piece(boite, metal(couleurArme), e, 0, -bL - bE * 1.2, bE * 2.2, bE * 1.5, bE * 1.5, bE * 5);
      os[s < 0 ? 'brasG' : 'brasD'] = e;
    });
    // tête
    const t = new THREE.Group(); t.position.y = cH + tR * 0.8; buste.add(t); os.tete = t;
    piece(sph, tex ? mat('#ffffff', { map: tex }) : mat(c1), t, 0, 0, 0, tR * 2, tR * 1.9, tR * 1.9);
    const blanc = mat('#ffffff', { roughness: 0.15 }), noir = new THREE.MeshBasicMaterial({ color: 0x0d0d1a });
    const yeux = v('t3Yeux', E.yeux || 'normal'), ty = yeux === 'grands' ? 0.75 : yeux === 'globuleux' ? 0.6 : 0.55;
    [-1, 1].forEach(s => {
      const oy = yeux === 'globuleux' ? tR * 0.85 : tR * 0.12, oz = yeux === 'globuleux' ? tR * 0.35 : tR * 0.8;
      if (motif === 'panda') piece(sph, mat('#1d1d22'), t, s * tR * 0.4, oy, oz - 0.02, tR * 0.75, tR * 0.85, tR * 0.4, false);
      piece(sph, blanc, t, s * tR * 0.4, oy, oz, tR * ty, tR * ty, tR * ty * 0.9, yeux === 'globuleux');
      piece(sph, noir, t, s * tR * 0.38, oy + tR * 0.02, oz + tR * ty * 0.42, tR * ty * 0.5, tR * ty * 0.5, tR * ty * 0.3, false);
      piece(sph, blanc, t, s * tR * 0.34, oy + tR * 0.12, oz + tR * ty * 0.55, tR * 0.09, tR * 0.09, tR * 0.05, false); // reflet dans l'œil
    });
    // museau / bec / groin
    if (museau === 'court') { piece(sph, mat(c2), t, 0, -tR * 0.3, tR * 0.78, tR * 0.9, tR * 0.6, tR * 0.5); piece(sph, noir, t, 0, -tR * 0.12, tR * 1.02, tR * 0.22, tR * 0.16, tR * 0.14, false); }
    if (museau === 'long') { piece(sph, mat(c2), t, 0, -tR * 0.3, tR * 0.95, tR * 0.8, tR * 0.55, tR * 1.0); piece(sph, noir, t, 0, -tR * 0.18, tR * 1.44, tR * 0.24, tR * 0.18, tR * 0.16, false); }
    if (museau === 'bec') { const b = piece(cone, mat(c3), t, 0, -tR * 0.2, tR * 1.0, tR * 0.45, tR * 0.6, tR * 0.35); b.rotation.x = Math.PI / 2; }
    if (museau === 'groin') { const gr = piece(cyl, mat(c3), t, 0, -tR * 0.25, tR * 0.95, tR * 0.6, tR * 0.3, tR * 0.45); gr.rotation.x = Math.PI / 2; [-1, 1].forEach(s => piece(sph, noir, t, s * tR * 0.12, -tR * 0.25, tR * 1.1, tR * 0.1, tR * 0.14, tR * 0.05, false)); }
    if (E.moustaches) [-1, 1].forEach(s => [-0.12, 0, 0.12].forEach(d => { const w = piece(cyl, noir, t, s * tR * 0.75, -tR * 0.25 + d * tR, tR * 0.85, 0.012, tR * 0.7, 0.012, false); w.rotation.z = Math.PI / 2 + s * d * 2; }));
    // oreilles
    [-1, 1].forEach(s => {
      if (oreilles === 'pointues') { const o = piece(cone, mat(E.membresFonces ? c3 : c1), t, s * tR * 0.6, tR * 0.95, 0, tR * 0.5, tR * 0.75, tR * 0.3); o.rotation.z = -s * 0.3; piece(cone, mat(c2), o, 0, -0.05, 0.12, 0.6, 0.7, 0.5, false); }
      if (oreilles === 'rondes') piece(sph, mat(E.membresFonces ? c3 : c1), t, s * tR * 0.72, tR * 0.78, 0, tR * 0.55, tR * 0.55, tR * 0.28);
      if (oreilles === 'grandes') piece(sph, mat(c1), t, s * tR * 0.9, tR * 0.75, -tR * 0.1, tR * 0.95, tR * 0.95, tR * 0.2);
      if (oreilles === 'lapin') { const o = piece(sph, mat(c1), t, s * tR * 0.38, tR * 1.45, -tR * 0.1, tR * 0.42, tR * 1.5, tR * 0.28); o.rotation.z = -s * 0.15; piece(sph, mat(c3), o, 0, 0, 0.3, 0.55, 0.8, 0.4, false); }
      if (oreilles === 'tombantes') { const o = piece(sph, mat(c3), t, s * tR * 0.92, -tR * 0.05, 0, tR * 0.35, tR * 0.95, tR * 0.3); o.rotation.z = s * 0.25; }
      if (oreilles === 'cornes') { const o = piece(cone, mat('#f1e6c8'), t, s * tR * 0.5, tR * 0.95, -tR * 0.1, tR * 0.3, tR * 0.9, tR * 0.3); o.rotation.z = -s * 0.45; o.rotation.x = -0.35; }
      if (oreilles === 'plumes') { const o = piece(cone, mat(c1), t, s * tR * 0.62, tR * 0.9, 0, tR * 0.35, tR * 0.55, tR * 0.2); o.rotation.z = -s * 0.5; }
    });
    if (E.corne) { const c = piece(cone, metal('#ffd54a'), t, 0, tR * 1.05, tR * 0.35, tR * 0.28, tR * 0.9, tR * 0.28); c.rotation.x = 0.35; }
    if (E.criniere) for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; piece(sph, mat(c3), t, Math.cos(a) * tR * 0.95, Math.sin(a) * tR * 0.9, -tR * 0.25, tR * 0.5, tR * 0.5, tR * 0.4); }
    // queue (pivot)
    const q = new THREE.Group(); q.position.set(0, cH * 0.3, -cL * 0.38); buste.add(q); os.queue = q;
    if (queue === 'longue' || queue === 'fine') { const w = queue === 'fine' ? 0.05 : 0.09; const qq = piece(cyl, mat(queue === 'fine' ? c3 : c1), q, 0, 0.3, -0.25, w, 0.8, w); qq.rotation.x = -0.9; }
    if (queue === 'touffue') { const qq = piece(sph, mat(c1), q, 0, 0.25, -0.35, 0.35, 0.8, 0.35); qq.rotation.x = -0.9; piece(sph, mat(c2), qq, 0, 0.42, 0, 0.7, 0.35, 0.7, false); }
    if (queue === 'pompon') piece(sph, mat(c2), q, 0, 0, -0.08, 0.3, 0.3, 0.3);
    if (queue === 'courte') { const qq = piece(cone, mat(c1), q, 0, 0.05, -0.15, 0.18, 0.35, 0.18); qq.rotation.x = -1.2; }
    if (queue === 'dragon') { const qq = piece(cone, mat(c1), q, 0, 0.1, -0.5, 0.3, 1.1, 0.3); qq.rotation.x = -1.35; }
    if (E.ailes) [-1, 1].forEach(s => { const a = piece(sph, mat(E.pics ? c3 : c2), buste, s * cL * 0.45, cH * 0.65, -cL * 0.35, 0.12, cH * 0.7, cL * 0.7); a.rotation.z = s * 0.5; a.rotation.y = s * 0.4; });
    if (E.pics) for (let i = 0; i < 4; i++) piece(cone, mat(c3), buste, 0, cH * (0.95 - i * 0.22), -cL * 0.4 + i * 0.02, 0.12, 0.2, 0.12).rotation.x = -0.6;
    // 👕 habillage
    const tenue = (nom) => {
      if (nom === 'chapeau') { piece(cyl, mat(cT), t, 0, tR * 0.85, 0, tR * 2.3, 0.04, tR * 2.3); const c = piece(cone, mat(cT), t, 0, tR * 1.5, 0, tR * 1.3, tR * 1.4, tR * 1.3); c.rotation.z = 0.15; piece(sph, metal('#ffd54a'), c, 0.1, 0, 0.45, 0.15, 0.15, 0.15, false); }
      if (nom === 'casquette') { piece(demi, mat(cT), t, 0, tR * 0.35, 0, tR * 2.05, tR * 1.9, tR * 2.0); piece(boite, mat(cT), t, 0, tR * 0.38, tR * 1.05, tR * 1.2, 0.04, tR * 0.9); }
      if (nom === 'couronne') { piece(new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true), metal('#ffd54a'), t, 0, tR * 0.95, 0, tR * 1.3, tR * 0.4, tR * 1.3, false); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; piece(cone, metal('#ffd54a'), t, Math.cos(a) * tR * 0.62, tR * 1.3, Math.sin(a) * tR * 0.62, tR * 0.22, tR * 0.35, tR * 0.22, false); } }
      if (nom === 'casque') { piece(demi, metal(cT), t, 0, tR * 0.1, 0, tR * 2.2, tR * 2.1, tR * 2.1); piece(boite, metal('#dfe6ee'), t, 0, tR * 1.05, 0, 0.06, tR * 0.5, tR * 1.4); }
      if (nom === 'cape') { const c = piece(boite, mat(cT, { side: THREE.DoubleSide }), buste, 0, cH * 0.45, -cL * 0.45, cL * 1.1, cH * 0.95, 0.04); c.rotation.x = 0.18; }
      if (nom === 'armure') { piece(sph, metal(cT), buste, 0, cH * 0.62, 0.02, cL * 1.08, cH * 0.62, cL * 0.9); [-1, 1].forEach(s => piece(sph, metal(cT), buste, s * cL * 0.5, cH * 0.82, 0, cL * 0.42, cL * 0.3, cL * 0.42)); }
      if (nom === 'echarpe') { const e = piece(tore, mat(cT), buste, 0, cH * 0.95, 0, cL * 0.72, cL * 0.72, cL * 0.72); e.rotation.x = Math.PI / 2; const b = piece(boite, mat(cT), buste, cL * 0.2, cH * 0.72, cL * 0.38, 0.12, cH * 0.35, 0.05); b.rotation.z = 0.2; }
      if (nom === 'lunettes') { [-1, 1].forEach(s => { const l = piece(tore, mat('#1d1d22'), t, s * tR * 0.4, tR * 0.12, tR * 0.98, tR * 0.62, tR * 0.62, tR * 0.62, false); piece(new THREE.CircleGeometry(0.42, 24), mat('#8fd3ff', { transparent: true, opacity: 0.35 }), l, 0, 0, 0.01, 1, 1, 1, false); }); piece(boite, mat('#1d1d22'), t, 0, tR * 0.14, tR * 1.0, tR * 0.3, 0.03, 0.03, false); }
      if (nom === 'sac') { piece(boite, mat(cT), buste, 0, cH * 0.5, -cL * 0.48, cL * 0.75, cH * 0.6, cL * 0.35); piece(boite, mat(cT), buste, 0, cH * 0.42, -cL * 0.68, cL * 0.5, cH * 0.25, 0.08); }
      if (nom === 'ceinture') { const c = piece(tore, mat('#3b2a1a'), buste, 0, cH * 0.2, 0, cL * 0.95, cL * 0.95, cL * 0.6, false); c.rotation.x = Math.PI / 2; piece(boite, metal('#ffd54a'), buste, 0, cH * 0.2, cL * 0.42, 0.14, 0.1, 0.04, false); }
      if (nom === 'noeud') [-1, 1].forEach(s => { const n = piece(cone, mat(cT), buste, s * 0.08, cH * 0.9, cL * 0.38, 0.12, 0.16, 0.08); n.rotation.z = s * Math.PI / 2; });
    };
    tenues.forEach(tenue);
    g.scale.setScalar(T);
    return { g, os, liberer: () => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }) };
  }

  function poser(m, phase) { // même animation de marche pour tous les persos
    const a = Math.sin(phase * Math.PI * 2);
    m.os.jambeG.rotation.x = a * 0.6; m.os.jambeD.rotation.x = -a * 0.6;
    m.os.brasG.rotation.x = -a * 0.7; m.os.brasD.rotation.x = a * 0.7;
    m.os.buste.position.y = m.os.jambeG.position.y + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.05;
    m.os.queue.rotation.y = a * 0.4; m.os.tete.rotation.z = a * 0.04;
  }
  function photo(m, angle, phase, taille) { // rend le modèle vu sous un angle donné
    rendu.setSize(taille, taille, false);
    m.g.rotation.y = Math.PI / 2 - angle; poser(m, phase);
    scene.add(m.g); rendu.render(scene, camera); scene.remove(m.g);
    return rendu.domElement;
  }
  async function modele(p, couleurArme, skin) {
    if (!initialiser()) return null;
    const pal = p.t3CouleursImage ? await palette(skin || p.t3Skin || p.imageCarte || p.image) : null;
    return construire(p, pal, couleurArme);
  }
  function cadrage(c) { // hauteur réelle du modèle dans l'image
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let haut = c.height, bas = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 30) { if (y < haut) haut = y; if (y > bas) bas = y; }
    return bas > haut ? { haut, bas } : { haut: 0, bas: c.height };
  }

  // 🎞️ planche de sprites : 16 directions × 4 poses (haute définition)
  async function generer(p, couleurArme, skin) {
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const planche = document.createElement('canvas'); planche.width = S * DIRS; planche.height = S * POSES;
    const x = planche.getContext('2d');
    for (let po = 0; po < POSES; po++) for (let d = 0; d < DIRS; d++) x.drawImage(photo(m, d / DIRS * Math.PI * 2, po / POSES, S), d * S, po * S);
    const face = document.createElement('canvas'); face.width = face.height = S; face.getContext('2d').drawImage(planche, 4 * S, 0, S, S, 0, 0, S, S);
    const cad = cadrage(face); m.liberer();
    return { planche, S, DIRS, POSES, haut: cad.haut, bas: cad.bas, face };
  }
  async function visage(p, couleurArme, skin) { // une seule image de face (cartes, portraits)
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(photo(m, Math.PI / 2, 0, S), 0, 0);
    m.liberer(); return c;
  }
  // Vue "vitrine" : modèle gardé en mémoire, rendu à la demande sous n'importe quel angle (rotation au doigt)
  async function vitrine(p, couleurArme, skin) {
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const c = document.createElement('canvas'); let dernier = null;
    return {
      rendre(angle, taille) {
        const cle = angle.toFixed(3) + taille; if (cle === dernier) return c; dernier = cle;
        c.width = c.height = taille; const x = c.getContext('2d'); x.clearRect(0, 0, taille, taille); x.drawImage(photo(m, angle, 0, taille), 0, 0);
        if (!this.haut) { const cad = cadrage(c); this.haut = cad.haut / taille; this.bas = cad.bas / taille; } return c;
      },
      liberer: () => m.liberer()
    };
  }
  // Aperçu admin : on fait tourner le perso en glissant dessus
  async function apercu(p, couleurArme, canvas, skin) {
    if (canvas._vue) canvas._vue.liberer();
    const vue = canvas._vue = await vitrine(p, couleurArme, skin); if (!vue) return;
    let angle = Math.PI / 2, glisse = null;
    const dessiner = () => { const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(vue.rendre(angle, canvas.width), 0, 0); };
    canvas.onpointerdown = e => { glisse = e.clientX; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (glisse === null) return; angle -= (e.clientX - glisse) * 0.015; glisse = e.clientX; dessiner(); };
    canvas.onpointerup = () => glisse = null;
    canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
    dessiner();
  }
  return { generer, visage, vitrine, apercu, dispo, ESPECES, TENUES };
})();
