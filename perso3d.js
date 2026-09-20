// =====================================================================
// 🧍 PERSOS 3D v3 — un seul squelette d'animation (hanches, épaules, cou,
// queue, pattes supplémentaires) ; chaque perso MÉLANGE jusqu'à 3 animaux :
// la tête, le corps, les membres et la queue peuvent venir d'espèces différentes.
// Rendu réaliste : éclairage d'environnement, tone mapping cinéma, pelage en relief.
// =====================================================================
const Perso3D = (() => {
  const DIRS = 16, POSES = 4, S = 256;
  let rendu = null, scene = null, camera = null, bosse = null;

  // 🐾 Catalogue d'espèces : [nom, catégorie, couleurs (corps, clair, accent), caractéristiques]
  const E = (nom, cat, couleurs, f = {}) => Object.assign({ nom, cat, couleurs, oreilles: 'rondes', museau: 'court', queue: 'courte', yeux: 'normal', motif: 'ventre', matiere: 'fourrure' }, f);
  const ESPECES = {
    chat: E('Chat', 'Mammifères', ['#f4a261', '#fde8cf', '#c8553d'], { tete: 1.1, oreilles: 'pointues', queue: 'longue', moustaches: true }),
    chien: E('Chien', 'Mammifères', ['#c68b59', '#f3e0c6', '#5b3a29'], { oreilles: 'tombantes', museau: 'long', motif: 'taches' }),
    loup: E('Loup', 'Mammifères', ['#7d8590', '#e6e8eb', '#3b3f45'], { oreilles: 'pointues', museau: 'long', queue: 'touffue' }),
    renard: E('Renard', 'Mammifères', ['#ef7a2a', '#fff4e8', '#2f2420'], { oreilles: 'pointues', museau: 'long', queue: 'touffue', membresFonces: true }),
    lapin: E('Lapin', 'Mammifères', ['#f4f4f6', '#ffd6e0', '#f7a8c0'], { tete: 1.12, jambesL: 0.85, oreilles: 'lapin', queue: 'pompon' }),
    ours: E('Ours', 'Mammifères', ['#8b5a2b', '#dcb68a', '#4a2f17'], { corpsL: 1.25, corpsH: 1.1, queue: 'pompon' }),
    panda: E('Panda', 'Mammifères', ['#f6f6f6', '#f6f6f6', '#1d1d22'], { corpsL: 1.2, queue: 'pompon', motif: 'panda', membresFonces: true }),
    koala: E('Koala', 'Mammifères', ['#9aa0a8', '#e9ebee', '#3a3d42'], { oreilles: 'touffues', museau: 'nez', queue: 'aucune' }),
    tigre: E('Tigre', 'Mammifères', ['#f39c12', '#fff1d6', '#1f1f1f'], { corpsL: 1.1, queue: 'longue', moustaches: true, motif: 'rayures' }),
    lion: E('Lion', 'Mammifères', ['#e1a95f', '#f7e1b5', '#8e4a17'], { corpsL: 1.15, queue: 'longue', criniere: true }),
    zebre: E('Zèbre', 'Mammifères', ['#f5f5f5', '#ffffff', '#1a1a1a'], { oreilles: 'pointues', museau: 'long', motif: 'rayures', criniere: true }),
    cheval: E('Cheval', 'Mammifères', ['#8b5a3c', '#d9b99b', '#2e1d12'], { oreilles: 'pointues', museau: 'long', queue: 'touffue', criniere: true, cou: 1.3 }),
    vache: E('Vache', 'Mammifères', ['#f5f5f5', '#ffc9c9', '#1d1d1d'], { oreilles: 'cornes', museau: 'large', motif: 'taches', corpsL: 1.25 }),
    mouton: E('Mouton', 'Mammifères', ['#f3efe6', '#3a3230', '#2a2320'], { oreilles: 'tombantes', laine: true, queue: 'pompon', motif: 'uni' }),
    chevre: E('Chèvre', 'Mammifères', ['#e8e2d6', '#f8f4ec', '#6b5a48'], { oreilles: 'cornes', museau: 'long', barbiche: true }),
    cerf: E('Cerf', 'Mammifères', ['#a0673a', '#f1dcc0', '#4a2f17'], { oreilles: 'bois', museau: 'long', queue: 'pompon', motif: 'taches', cou: 1.2 }),
    girafe: E('Girafe', 'Mammifères', ['#f2c46d', '#fbe7b8', '#9a5a1f'], { oreilles: 'cornes', museau: 'long', motif: 'taches', cou: 2.0 }),
    elephant: E('Éléphant', 'Mammifères', ['#9ea3ab', '#c9cdd3', '#6e737b'], { oreilles: 'elephant', museau: 'trompe', corpsL: 1.35, corpsH: 1.15, motif: 'uni', matiere: 'peau' }),
    rhino: E('Rhinocéros', 'Mammifères', ['#8d9199', '#b8bcc2', '#5c6068'], { oreilles: 'petites', museau: 'large', cornenez: true, corpsL: 1.3, motif: 'uni', matiere: 'peau' }),
    hippo: E('Hippopotame', 'Mammifères', ['#8f7fa3', '#e7b7c2', '#5d5170'], { oreilles: 'petites', museau: 'large', corpsL: 1.4, motif: 'ventre', matiere: 'peau' }),
    cochon: E('Cochon', 'Mammifères', ['#ffb6c1', '#ffd9e0', '#e57f95'], { corpsL: 1.2, oreilles: 'pointues', museau: 'groin', queue: 'courte', motif: 'uni', matiere: 'peau' }),
    souris: E('Souris', 'Mammifères', ['#a4a4ae', '#ffd6e0', '#6d6d75'], { tete: 1.15, corpsL: 0.9, oreilles: 'grandes', queue: 'fine', moustaches: true }),
    ecureuil: E('Écureuil', 'Mammifères', ['#c0662b', '#f7dcc0', '#7a3d14'], { oreilles: 'pointues', queue: 'geante', moustaches: true }),
    raton: E('Raton laveur', 'Mammifères', ['#8a8d93', '#e8e8ea', '#26282c'], { oreilles: 'pointues', museau: 'long', queue: 'annelee', motif: 'masque' }),
    herisson: E('Hérisson', 'Mammifères', ['#8a6a4a', '#f0dcc4', '#3b2a1c'], { oreilles: 'petites', museau: 'long', queue: 'aucune', piquants: true }),
    singe: E('Singe', 'Mammifères', ['#7b4b2a', '#e8c39e', '#4a2c17'], { brasL: 1.3, queue: 'longue' }),
    gorille: E('Gorille', 'Mammifères', ['#2f3136', '#6b6e75', '#18191c'], { brasL: 1.45, corpsL: 1.35, corpsH: 1.2, oreilles: 'petites', queue: 'aucune', matiere: 'fourrure' }),
    kangourou: E('Kangourou', 'Mammifères', ['#c98b55', '#f2d6b6', '#7a4a24'], { oreilles: 'pointues', museau: 'long', queue: 'longue', jambesL: 1.25, brasL: 0.7 }),
    chauvesouris: E('Chauve-souris', 'Mammifères', ['#3f3446', '#6d5a78', '#1d1822'], { oreilles: 'grandes', ailes: 'membrane', queue: 'aucune' }),
    paresseux: E('Paresseux', 'Mammifères', ['#a58e6f', '#e2d4bd', '#5a4a35'], { brasL: 1.35, oreilles: 'aucune', motif: 'masque', queue: 'aucune' }),
    aigle: E('Aigle', 'Oiseaux', ['#6b4a2e', '#ffffff', '#f5b700'], { oreilles: 'aucune', museau: 'bec_crochu', ailes: 'plumes', queue: 'plumes', matiere: 'plumes' }),
    hibou: E('Hibou', 'Oiseaux', ['#8d6e63', '#efe6dd', '#ffb300'], { oreilles: 'plumes', museau: 'bec', yeux: 'grands', queue: 'aucune', ailes: 'plumes', matiere: 'plumes' }),
    perroquet: E('Perroquet', 'Oiseaux', ['#e53935', '#43a047', '#fdd835'], { oreilles: 'aucune', museau: 'bec_crochu', ailes: 'plumes', queue: 'plumes', motif: 'uni', matiere: 'plumes' }),
    pingouin: E('Pingouin', 'Oiseaux', ['#1f2a44', '#ffffff', '#ff9f1c'], { brasL: 0.8, jambesL: 0.6, oreilles: 'aucune', museau: 'bec', matiere: 'plumes' }),
    canard: E('Canard', 'Oiseaux', ['#f7f3e8', '#ffffff', '#ff9800'], { oreilles: 'aucune', museau: 'bec_plat', queue: 'courte', ailes: 'plumes', matiere: 'plumes' }),
    poule: E('Poule', 'Oiseaux', ['#fafafa', '#ffffff', '#e53935'], { oreilles: 'aucune', museau: 'bec', crete: true, ailes: 'plumes', queue: 'plumes', matiere: 'plumes' }),
    flamant: E('Flamant rose', 'Oiseaux', ['#ff8fb1', '#ffc1d6', '#222222'], { oreilles: 'aucune', museau: 'bec_crochu', jambesL: 1.5, jambesE: 0.6, cou: 1.6, ailes: 'plumes', matiere: 'plumes' }),
    dragon: E('Dragon', 'Reptiles', ['#27ae60', '#f7dc6f', '#145a32'], { oreilles: 'cornes', museau: 'long', queue: 'dragon', ailes: 'membrane', pics: true, matiere: 'ecailles' }),
    crocodile: E('Crocodile', 'Reptiles', ['#4f7a3a', '#c9d6a3', '#2c4a20'], { oreilles: 'aucune', museau: 'plat_long', queue: 'dragon', pics: true, jambesL: 0.7, matiere: 'ecailles' }),
    tortue: E('Tortue', 'Reptiles', ['#7cb342', '#d7e8b0', '#6d4c41'], { oreilles: 'aucune', museau: 'aucun', carapace: true, queue: 'courte', jambesL: 0.7, matiere: 'ecailles' }),
    lezard: E('Lézard', 'Reptiles', ['#26a69a', '#b2dfdb', '#00695c'], { oreilles: 'aucune', museau: 'long', queue: 'dragon', motif: 'taches', matiere: 'ecailles' }),
    grenouille: E('Grenouille', 'Reptiles', ['#6ab04c', '#d9f7b0', '#2d6a1f'], { tete: 1.22, jambesL: 0.7, oreilles: 'aucune', museau: 'aucun', yeux: 'globuleux', queue: 'aucune', motif: 'taches', matiere: 'peau' }),
    requin: E('Requin', 'Aquatiques', ['#607d8b', '#eceff1', '#37474f'], { oreilles: 'aucune', museau: 'long', aileron: true, queue: 'nageoire', matiere: 'peau' }),
    dauphin: E('Dauphin', 'Aquatiques', ['#5c9ccf', '#e3f2fd', '#2f6a9a'], { oreilles: 'aucune', museau: 'bec_plat', aileron: true, queue: 'nageoire', matiere: 'peau' }),
    pieuvre: E('Pieuvre', 'Aquatiques', ['#e56b6f', '#f7c1c3', '#9b2c35'], { tete: 1.35, oreilles: 'aucune', museau: 'aucun', queue: 'aucune', motif: 'taches', matiere: 'peau' }),
    abeille: E('Abeille', 'Insectes', ['#f9c80e', '#1d1d1d', '#1d1d1d'], { oreilles: 'antennes', museau: 'aucun', yeux: 'composes', ailes: 'insecte', abdomen: true, queue: 'dard', motif: 'anneaux', pattes: 6, membresFonces: true, matiere: 'chitine' }),
    fourmi: E('Fourmi', 'Insectes', ['#8b2e16', '#a8412a', '#3b1206'], { oreilles: 'antennes', museau: 'mandibules', yeux: 'composes', abdomen: true, queue: 'aucune', pattes: 6, motif: 'uni', matiere: 'chitine' }),
    coccinelle: E('Coccinelle', 'Insectes', ['#e53935', '#1d1d1d', '#1d1d1d'], { oreilles: 'antennes', museau: 'aucun', yeux: 'composes', carapace: 'elytres', queue: 'aucune', pattes: 6, motif: 'points', membresFonces: true, matiere: 'chitine' }),
    papillon: E('Papillon', 'Insectes', ['#6a4c93', '#ffca3a', '#1d1d1d'], { oreilles: 'antennes', museau: 'aucun', yeux: 'composes', ailes: 'papillon', queue: 'aucune', pattes: 6, membresFonces: true, matiere: 'chitine' }),
    scarabee: E('Scarabée', 'Insectes', ['#1b5e20', '#4caf50', '#0b2e10'], { oreilles: 'antennes', museau: 'mandibules', yeux: 'composes', carapace: 'elytres', cornenez: true, queue: 'aucune', pattes: 6, motif: 'uni', matiere: 'chitine' }),
    araignee: E('Araignée', 'Insectes', ['#3a2a4a', '#6b4c7a', '#1a1022'], { oreilles: 'aucune', museau: 'mandibules', yeux: 'composes', abdomen: true, queue: 'aucune', pattes: 8, motif: 'taches', matiere: 'chitine' }),
    libellule: E('Libellule', 'Insectes', ['#00acc1', '#b2ebf2', '#006064'], { oreilles: 'antennes', museau: 'aucun', yeux: 'composes', ailes: 'insecte', queue: 'fine', pattes: 6, motif: 'uni', matiere: 'chitine' }),
    mante: E('Mante religieuse', 'Insectes', ['#7cb342', '#c5e1a5', '#33691e'], { oreilles: 'antennes', museau: 'aucun', yeux: 'composes', brasL: 1.4, cou: 1.4, ailes: 'insecte', pattes: 6, motif: 'uni', matiere: 'chitine' }),
    escargot: E('Escargot', 'Insectes', ['#c8b39a', '#f0e4d4', '#a0522d'], { oreilles: 'antennes', museau: 'aucun', coquille: true, queue: 'aucune', jambesL: 0.6, motif: 'uni', matiere: 'peau' }),
    licorne: E('Licorne', 'Fantastiques', ['#ffffff', '#f8c8ff', '#b388ff'], { oreilles: 'pointues', museau: 'long', queue: 'touffue', corne: true, criniere: true, motif: 'uni' })
  };
  const PARTIES = { tete: 'Tête', corps: 'Corps', membres: 'Bras & jambes', queue: 'Queue & dos' };
  const TENUES = { aucune: 'Aucune', chapeau: 'Chapeau de magicien', casquette: 'Casquette', couronne: 'Couronne', casque: 'Casque', cape: 'Cape',
                   armure: 'Armure', echarpe: 'Écharpe', lunettes: 'Lunettes', sac: 'Sac à dos', ceinture: 'Ceinture', noeud: 'Nœud papillon' };
  const dispo = () => typeof THREE !== 'undefined';

  function initialiser() {
    if (rendu || !dispo()) return !!rendu;
    const c = document.createElement('canvas'); c.width = c.height = S;
    rendu = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    rendu.setPixelRatio(1); rendu.setClearColor(0x000000, 0); rendu.outputEncoding = THREE.sRGBEncoding;
    rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.15;   // rendu "cinéma"
    scene = new THREE.Scene();
    // éclairage d'environnement (reflets doux et réalistes) calculé depuis un petit ciel dégradé
    const ciel = new THREE.Scene(), gc = document.createElement('canvas'); gc.width = 2; gc.height = 64; const gx = gc.getContext('2d'), gg = gx.createLinearGradient(0, 0, 0, 64);
    gg.addColorStop(0, '#dff1ff'); gg.addColorStop(0.5, '#a9b8d6'); gg.addColorStop(1, '#3b3450'); gx.fillStyle = gg; gx.fillRect(0, 0, 2, 64);
    ciel.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(rendu); scene.environment = pm.fromScene(ciel, 0.04).texture; pm.dispose();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 4.3, 4.0); camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b4070, 0.55));
    const soleil = new THREE.DirectionalLight(0xfff1dc, 1.6); soleil.position.set(-2, 5, 3); scene.add(soleil);
    const contre = new THREE.DirectionalLight(0x8fd3ff, 0.9); contre.position.set(3, 2, -3); scene.add(contre);
    // relief du pelage / des écailles (petite texture de bruit)
    const nc = document.createElement('canvas'); nc.width = nc.height = 128; const nx = nc.getContext('2d'), id = nx.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) { const v = 110 + Math.random() * 145; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    nx.putImageData(id, 0, 0); bosse = new THREE.CanvasTexture(nc); bosse.wrapS = bosse.wrapT = THREE.RepeatWrapping; bosse.repeat.set(4, 4);
    return true;
  }

  function palette(src) { // couleurs dominantes d'une image
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
  const hasard = n => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };
  function textureMotif(motif, base, accent) { // motifs peints sur le pelage
    if (!['rayures', 'taches', 'anneaux', 'points'].includes(motif)) return null;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 512, 256); x.fillStyle = accent;
    if (motif === 'rayures') for (let i = 0; i < 14; i++) { const cx = i * 512 / 14 + 10; x.beginPath(); x.moveTo(cx, 20);
      for (let yy = 20; yy <= 236; yy += 12) x.lineTo(cx + Math.sin(yy * 0.05 + i) * 6 + 6, yy); for (let yy = 236; yy >= 20; yy -= 12) x.lineTo(cx + Math.sin(yy * 0.05 + i) * 6, yy); x.fill(); }
    if (motif === 'anneaux') for (let i = 0; i < 4; i++) x.fillRect(0, 40 + i * 48, 512, 22);
    if (motif === 'taches' || motif === 'points') for (let i = 0; i < (motif === 'points' ? 9 : 22); i++) { const r = motif === 'points' ? 22 : 10 + hasard(i + 9) * 18;
      x.beginPath(); x.ellipse(hasard(i) * 512, 40 + hasard(i + 50) * 170, r, motif === 'points' ? r * 0.8 : 8 + hasard(i + 3) * 12, hasard(i + 7) * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }

  // 🦴 Construction du perso (mélange d'espèces partie par partie)
  function construire(p, pal, couleurArme) {
    const esp = [p.t3Espece, p.t3Espece2 || p.t3Espece, p.t3Espece3 || p.t3Espece].map(k => ESPECES[k] || ESPECES.chat);
    const part = k => esp[Math.max(0, Math.min(2, (+p['t3Part' + k] || 1) - 1))];            // espèce utilisée pour une partie
    const ET = part('Tete'), EC = part('Corps'), EM = part('Membres'), EQ = part('Queue');
    const v = (k, def) => { const x = p[k]; return x === undefined || x === '' || x === null || x === 'auto' ? def : x; };
    const coul = (e, i) => v('t3Couleur' + (i + 1), p.t3CouleursImage && pal ? pal[i] : e.couleurs[i]);
    const m = k => +v(k, 1) || 1;
    const T = m('t3Taille'), tR = 0.36 * m('t3Tete') * (ET.tete || 1), cL = 0.72 * m('t3CorpsL') * (EC.corpsL || 1), cH = 0.8 * m('t3CorpsH') * (EC.corpsH || 1);
    const bL = 0.5 * m('t3BrasL') * (EM.brasL || 1), bE = 0.11 * m('t3BrasE') * (EM.brasE || 1), jL = 0.55 * m('t3JambesL') * (EM.jambesL || 1), jE = 0.13 * m('t3JambesE') * (EM.jambesE || 1);
    const oreilles = v('t3Oreilles', ET.oreilles), queue = v('t3Queue', EQ.queue), motif = v('t3Motif', EC.motif), museau = v('t3Museau', ET.museau), yeux = v('t3Yeux', ET.yeux);
    const tenues = [p.t3Tenue1, p.t3Tenue2, p.t3Tenue3].filter(t => t && t !== 'aucune'), cT = v('t3CouleurTenue', '#e63946');
    const [h1, h2, h3] = [0, 1, 2].map(i => coul(ET, i)), [b1, b2, b3] = [0, 1, 2].map(i => coul(EC, i)), [m1, m2, m3] = [0, 1, 2].map(i => coul(EM, i)), [q1, q2, q3] = [0, 1, 2].map(i => coul(EQ, i));
    const g = new THREE.Group(), os = { pattes: [] }, contour = new THREE.MeshBasicMaterial({ color: 0x120e22, side: THREE.BackSide });
    const MAT = { fourrure: { roughness: 0.82, bumpScale: 0.012 }, plumes: { roughness: 0.7, bumpScale: 0.008 }, peau: { roughness: 0.55, bumpScale: 0.004 },
                  ecailles: { roughness: 0.4, bumpScale: 0.02, metalness: 0.08 }, chitine: { roughness: 0.22, metalness: 0.15, bumpScale: 0.002 } };
    const mat = (c, matiere, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c).convertSRGBToLinear(), envMapIntensity: 0.9, bumpMap: bosse }, MAT[matiere] || MAT.peau, o));
    const lisse = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.35, metalness: 0.05 }, o));
    const metal = c => lisse(c, { metalness: 0.75, roughness: 0.25 });
    const piece = (geo, ma, parent, x, y, z, sx = 1, sy = 1, sz = 1, trait = true) => {
      const me = new THREE.Mesh(geo, ma); me.position.set(x, y, z); me.scale.set(sx, sy, sz); parent.add(me);
      if (trait) { const ct = new THREE.Mesh(geo, contour); ct.scale.setScalar(1.035); me.add(ct); } return me;
    };
    const sph = new THREE.SphereGeometry(0.5, 40, 28), demi = new THREE.SphereGeometry(0.5, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 24), cone = new THREE.ConeGeometry(0.5, 1, 24), boite = new THREE.BoxGeometry(1, 1, 1), tore = new THREE.TorusGeometry(0.5, 0.12, 14, 36);
    const verre = lisse('#e8f6ff', { transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide });
    const MM = EM.matiere, MC = EC.matiere, MT = ET.matiere, fonceM = EM.membresFonces;

    // jambes (+ pattes supplémentaires pour insectes et araignées)
    const jambe = (x, z, nom, echelle = 1, rot = 0) => {
      const h = new THREE.Group(); h.position.set(x, jL, z); h.rotation.z = rot; g.add(h);
      piece(cyl, mat(fonceM ? m3 : m1, MM), h, 0, -jL * echelle / 2, 0, jE * 2 * echelle, jL * echelle, jE * 2 * echelle);
      piece(sph, mat(fonceM ? m3 : m2, MM), h, 0, -jL * echelle, 0.05, jE * 2.7, jE * 1.6, jE * 3.5);
      if (nom) os[nom] = h; else os.pattes.push(h); return h;
    };
    jambe(-cL * 0.25, 0, 'jambeG'); jambe(cL * 0.25, 0, 'jambeD');
    const nbP = EM.pattes || 4;
    if (nbP > 4) [-1, 1].forEach(s => { for (let k = 0; k < (nbP - 4) / 2; k++) jambe(s * cL * 0.52, -0.1 - k * 0.18, null, 0.9, s * 0.55); });
    const buste = new THREE.Group(); buste.position.y = jL; g.add(buste); os.buste = buste;
    const texC = textureMotif(motif, b1, b3), texT = textureMotif(motif === 'points' ? 'uni' : motif, h1, h3);
    piece(sph, texC ? mat('#ffffff', MC, { map: texC }) : mat(b1, MC), buste, 0, cH / 2, 0, cL, cH, cL * 0.82);
    if (['ventre', 'panda', 'masque'].includes(motif) || EC.membresFonces) piece(sph, mat(b2, MC), buste, 0, cH * 0.42, cL * 0.3, cL * 0.6, cH * 0.58, cL * 0.32, false);
    if (EC.abdomen) { const a = texC ? mat('#ffffff', MC, { map: texC }) : mat(b1, MC); piece(sph, a, buste, 0, cH * 0.35, -cL * 0.7, cL * 0.8, cH * 0.75, cL * 0.95); }
    if (EC.laine) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, hh = 0.2 + (i % 4) * 0.2; piece(sph, mat(b1, 'fourrure'), buste, Math.cos(a) * cL * 0.45, cH * hh + 0.1, Math.sin(a) * cL * 0.38, cL * 0.38, cL * 0.38, cL * 0.38); }
    // bras (pivot épaule)
    [-1, 1].forEach(s => {
      const e = new THREE.Group(); e.position.set(s * (cL * 0.5 + bE * 0.5), cH * 0.78, 0); buste.add(e);
      piece(cyl, mat(fonceM ? m3 : m1, MM), e, 0, -bL / 2, 0, bE * 2, bL, bE * 2);
      piece(sph, mat(fonceM ? m3 : m2, MM), e, 0, -bL, 0, bE * 2.7, bE * 2.7, bE * 2.7);
      if (s > 0 && couleurArme) piece(boite, metal(couleurArme), e, 0, -bL - bE * 1.2, bE * 2.2, bE * 1.5, bE * 1.5, bE * 5);
      os[s < 0 ? 'brasG' : 'brasD'] = e;
    });
    // cou + tête
    const cou = (ET.cou || 1) * (EC.cou || 1) > 1 ? ((ET.cou || 1) * (EC.cou || 1) - 1) * 0.35 : 0;
    if (cou) piece(cyl, mat(b1, MC), buste, 0, cH + cou / 2, 0.05, cL * 0.32, cou + tR * 0.4, cL * 0.32);
    const t = new THREE.Group(); t.position.set(0, cH + tR * 0.8 + cou, cou * 0.2); buste.add(t); os.tete = t;
    piece(sph, texT ? mat('#ffffff', MT, { map: texT }) : mat(h1, MT), t, 0, 0, 0, tR * 2, tR * 1.9, tR * 1.9);
    const blanc = lisse('#ffffff', { roughness: 0.08 }), noir = lisse('#0b0b16', { roughness: 0.05 });
    if (motif === 'masque') piece(sph, mat(h3, MT), t, 0, tR * 0.12, tR * 0.72, tR * 1.5, tR * 0.5, tR * 0.5, false);
    [-1, 1].forEach(s => { // yeux : sclère, iris coloré, pupille, reflet
      if (yeux === 'composes') { piece(sph, lisse('#1a1a24', { roughness: 0.1, metalness: 0.3 }), t, s * tR * 0.55, tR * 0.15, tR * 0.62, tR * 0.7, tR * 0.8, tR * 0.6, false); piece(sph, blanc, t, s * tR * 0.5, tR * 0.35, tR * 0.9, tR * 0.12, tR * 0.12, tR * 0.06, false); return; }
      const ty = yeux === 'grands' ? 0.75 : yeux === 'globuleux' ? 0.6 : 0.52, oy = yeux === 'globuleux' ? tR * 0.85 : tR * 0.12, oz = yeux === 'globuleux' ? tR * 0.35 : tR * 0.8;
      if (motif === 'panda') piece(sph, mat('#1d1d22', MT), t, s * tR * 0.4, oy, oz - 0.02, tR * 0.75, tR * 0.85, tR * 0.4, false);
      piece(sph, blanc, t, s * tR * 0.4, oy, oz, tR * ty, tR * ty, tR * ty * 0.9, yeux === 'globuleux');
      piece(sph, lisse(ET.cat === 'Oiseaux' ? '#ffb300' : '#6b4a2a', { roughness: 0.1 }), t, s * tR * 0.39, oy + tR * 0.01, oz + tR * ty * 0.38, tR * ty * 0.62, tR * ty * 0.62, tR * ty * 0.3, false);
      piece(sph, noir, t, s * tR * 0.38, oy + tR * 0.02, oz + tR * ty * 0.46, tR * ty * 0.34, tR * ty * 0.34, tR * ty * 0.22, false);
      piece(sph, blanc, t, s * tR * 0.33, oy + tR * 0.12, oz + tR * ty * 0.56, tR * 0.08, tR * 0.08, tR * 0.04, false);
    });
    // museau, bec, trompe…
    const nez = z => piece(sph, noir, t, 0, -tR * 0.12, z, tR * 0.22, tR * 0.16, tR * 0.14, false);
    if (museau === 'court' || museau === 'nez') { piece(sph, mat(h2, MT), t, 0, -tR * 0.3, tR * 0.78, tR * 0.9, tR * 0.6, tR * 0.5); nez(tR * (museau === 'nez' ? 1.05 : 1.02)); if (museau === 'nez') t.children[t.children.length - 1].scale.set(tR * 0.5, tR * 0.4, tR * 0.3); }
    if (museau === 'long') { piece(sph, mat(h2, MT), t, 0, -tR * 0.3, tR * 0.95, tR * 0.8, tR * 0.55, tR * 1.0); nez(tR * 1.44); }
    if (museau === 'large') { piece(sph, mat(h2, MT), t, 0, -tR * 0.35, tR * 0.85, tR * 1.3, tR * 0.75, tR * 0.8); [-1, 1].forEach(s => piece(sph, noir, t, s * tR * 0.25, -tR * 0.3, tR * 1.23, tR * 0.14, tR * 0.14, tR * 0.06, false)); }
    if (museau === 'plat_long') { piece(sph, mat(h1, MT), t, 0, -tR * 0.3, tR * 1.3, tR * 0.9, tR * 0.4, tR * 1.9); for (let i = 0; i < 5; i++) [-1, 1].forEach(s => piece(cone, blanc, t, s * tR * 0.38, -tR * 0.5, tR * (0.9 + i * 0.3), 0.03, 0.06, 0.03, false)); }
    if (museau === 'bec' || museau === 'bec_crochu' || museau === 'bec_plat') { const b = piece(museau === 'bec_plat' ? sph : cone, lisse(h3), t, 0, -tR * 0.2, tR * 1.0, tR * (museau === 'bec_plat' ? 0.9 : 0.45), tR * (museau === 'bec_plat' ? 0.25 : 0.6), tR * (museau === 'bec_plat' ? 0.9 : 0.35)); if (museau !== 'bec_plat') b.rotation.x = Math.PI / 2 + (museau === 'bec_crochu' ? 0.45 : 0); }
    if (museau === 'groin') { const gr = piece(cyl, mat(h3, MT), t, 0, -tR * 0.25, tR * 0.95, tR * 0.6, tR * 0.3, tR * 0.45); gr.rotation.x = Math.PI / 2; [-1, 1].forEach(s => piece(sph, noir, t, s * tR * 0.12, -tR * 0.25, tR * 1.1, tR * 0.1, tR * 0.14, tR * 0.05, false)); }
    if (museau === 'trompe') { for (let i = 0; i < 5; i++) piece(sph, mat(h1, MT), t, 0, -tR * (0.3 + i * 0.28), tR * (0.9 + i * 0.12 - i * i * 0.03), tR * (0.5 - i * 0.05), tR * 0.45, tR * (0.5 - i * 0.05)); }
    if (museau === 'mandibules') [-1, 1].forEach(s => { const md = piece(cone, lisse(h3), t, s * tR * 0.25, -tR * 0.45, tR * 0.85, tR * 0.18, tR * 0.5, tR * 0.18); md.rotation.x = Math.PI / 2; md.rotation.z = -s * 0.5; });
    if (ET.moustaches) [-1, 1].forEach(s => [-0.12, 0, 0.12].forEach(d => { const w = piece(cyl, noir, t, s * tR * 0.75, -tR * 0.25 + d * tR, tR * 0.85, 0.01, tR * 0.7, 0.01, false); w.rotation.z = Math.PI / 2 + s * d * 2; }));
    if (ET.barbiche) piece(cone, mat(h2, MT), t, 0, -tR * 0.85, tR * 0.8, tR * 0.2, tR * 0.4, tR * 0.2).rotation.x = Math.PI;
    if (ET.crete) for (let i = 0; i < 3; i++) piece(sph, lisse(h3), t, 0, tR * (0.95 + (i === 1 ? 0.12 : 0)), tR * (0.25 - i * 0.25), tR * 0.2, tR * 0.35, tR * 0.2);
    if (ET.cornenez) { const c = piece(cone, lisse('#e9e2d0'), t, 0, tR * 0.05, tR * 1.15, tR * 0.3, tR * 0.8, tR * 0.3); c.rotation.x = 0.9; }
    // oreilles, cornes, bois, antennes
    [-1, 1].forEach(s => {
      const oc = ET.membresFonces ? h3 : h1;
      if (oreilles === 'pointues') { const o = piece(cone, mat(oc, MT), t, s * tR * 0.6, tR * 0.95, 0, tR * 0.5, tR * 0.75, tR * 0.3); o.rotation.z = -s * 0.3; piece(cone, mat(h2, MT), o, 0, -0.05, 0.12, 0.6, 0.7, 0.5, false); }
      if (oreilles === 'rondes' || oreilles === 'petites') { const r = oreilles === 'petites' ? 0.3 : 0.55; piece(sph, mat(oc, MT), t, s * tR * 0.72, tR * 0.78, 0, tR * r, tR * r, tR * 0.28); }
      if (oreilles === 'touffues') piece(sph, mat(h2, 'fourrure'), t, s * tR * 0.95, tR * 0.55, 0, tR * 0.75, tR * 0.75, tR * 0.35);
      if (oreilles === 'grandes') piece(sph, mat(h1, MT), t, s * tR * 0.9, tR * 0.75, -tR * 0.1, tR * 0.95, tR * 0.95, tR * 0.2);
      if (oreilles === 'elephant') { const o = piece(sph, mat(h1, MT), t, s * tR * 1.15, tR * 0.1, -tR * 0.1, tR * 0.25, tR * 1.6, tR * 1.3); o.rotation.y = s * 0.3; }
      if (oreilles === 'lapin') { const o = piece(sph, mat(h1, MT), t, s * tR * 0.38, tR * 1.45, -tR * 0.1, tR * 0.42, tR * 1.5, tR * 0.28); o.rotation.z = -s * 0.15; piece(sph, mat(h3, MT), o, 0, 0, 0.3, 0.55, 0.8, 0.4, false); }
      if (oreilles === 'tombantes') { const o = piece(sph, mat(h3, MT), t, s * tR * 0.92, -tR * 0.05, 0, tR * 0.35, tR * 0.95, tR * 0.3); o.rotation.z = s * 0.25; }
      if (oreilles === 'cornes') { const o = piece(cone, lisse('#efe6cc'), t, s * tR * 0.5, tR * 0.95, -tR * 0.1, tR * 0.3, tR * 0.9, tR * 0.3); o.rotation.z = -s * 0.45; o.rotation.x = -0.35; }
      if (oreilles === 'plumes') { const o = piece(cone, mat(h1, 'plumes'), t, s * tR * 0.62, tR * 0.9, 0, tR * 0.35, tR * 0.55, tR * 0.2); o.rotation.z = -s * 0.5; }
      if (oreilles === 'bois') { const b = new THREE.Group(); b.position.set(s * tR * 0.45, tR * 0.9, -tR * 0.1); b.rotation.z = -s * 0.35; t.add(b);
        const bm = lisse('#8a6a48', { roughness: 0.7 }); piece(cyl, bm, b, 0, tR * 0.6, 0, 0.05, tR * 1.2, 0.05); [0.4, 0.8].forEach((h, k) => { const r = piece(cyl, bm, b, s * tR * 0.2, tR * (0.3 + h), 0, 0.04, tR * 0.55, 0.04); r.rotation.z = -s * (0.9 + k * 0.2); }); }
      if (oreilles === 'antennes') { const a = piece(cyl, lisse(h3), t, s * tR * 0.3, tR * 1.2, tR * 0.2, 0.025, tR * 1.0, 0.025); a.rotation.z = -s * 0.35; a.rotation.x = 0.3; piece(sph, lisse(h3), a, 0, 0.5, 0, 3, 0.12, 3, false); }
    });
    if (ET.corne) { const c = piece(cone, metal('#ffd54a'), t, 0, tR * 1.05, tR * 0.35, tR * 0.28, tR * 0.9, tR * 0.28); c.rotation.x = 0.35; }
    if (ET.criniere) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; piece(sph, mat(h3, 'fourrure'), t, Math.cos(a) * tR * 0.95, Math.sin(a) * tR * 0.9, -tR * 0.25, tR * 0.5, tR * 0.5, tR * 0.4); }
    // queue & dos
    const q = new THREE.Group(); q.position.set(0, cH * 0.3, -cL * (EC.abdomen ? 1.1 : 0.38)); buste.add(q); os.queue = q;
    const MQ = EQ.matiere;
    if (queue === 'longue' || queue === 'fine') { const w = queue === 'fine' ? 0.05 : 0.09; piece(cyl, mat(queue === 'fine' ? q3 : q1, MQ), q, 0, 0.3, -0.25, w, 0.8, w).rotation.x = -0.9; }
    if (queue === 'touffue' || queue === 'geante') { const k = queue === 'geante' ? 1.6 : 1; const qq = piece(sph, mat(q1, 'fourrure'), q, 0, 0.25 * k, -0.35, 0.35 * k, 0.8 * k, 0.35 * k); qq.rotation.x = -0.9 + (k > 1 ? 0.5 : 0); piece(sph, mat(q2, 'fourrure'), qq, 0, 0.42, 0, 0.7, 0.35, 0.7, false); }
    if (queue === 'annelee') for (let i = 0; i < 5; i++) piece(sph, mat(i % 2 ? q3 : q1, MQ), q, 0, 0.08 + i * 0.12, -0.2 - i * 0.12, 0.2, 0.2, 0.2);
    if (queue === 'pompon') piece(sph, mat(q2, 'fourrure'), q, 0, 0, -0.08, 0.3, 0.3, 0.3);
    if (queue === 'courte') piece(cone, mat(q1, MQ), q, 0, 0.05, -0.15, 0.18, 0.35, 0.18).rotation.x = -1.2;
    if (queue === 'dragon') piece(cone, mat(q1, MQ), q, 0, 0.1, -0.5, 0.3, 1.1, 0.3).rotation.x = -1.35;
    if (queue === 'plumes') for (let i = -1; i <= 1; i++) { const f = piece(sph, mat(i ? q1 : q3, 'plumes'), q, i * 0.1, 0.05, -0.3, 0.12, 0.05, 0.55); f.rotation.y = i * 0.35; }
    if (queue === 'nageoire') { piece(cone, mat(q1, MQ), q, 0, 0.05, -0.3, 0.2, 0.5, 0.2).rotation.x = -1.4; piece(sph, mat(q1, MQ), q, 0, 0.05, -0.6, 0.6, 0.08, 0.25); }
    if (queue === 'dard') piece(cone, lisse(q3), q, 0, -0.05, -0.25, 0.08, 0.3, 0.08).rotation.x = -1.6;
    const ailes = EQ.ailes || EC.ailes;
    if (ailes) [-1, 1].forEach(s => {
      const a = new THREE.Group(); a.position.set(s * cL * 0.3, cH * 0.75, -cL * 0.35); a.rotation.z = s * 0.45; a.rotation.y = s * 0.5; buste.add(a); os['aile' + s] = a;
      if (ailes === 'plumes') piece(sph, mat(b2, 'plumes'), a, s * 0.2, 0, 0, 0.14, cH * 0.75, cL * 0.75);
      if (ailes === 'membrane') { piece(sph, mat(b3, MC, { side: THREE.DoubleSide }), a, s * 0.35, 0.1, 0, 0.9, cH * 0.7, 0.05); }
      if (ailes === 'insecte') [0, 1].forEach(k => piece(sph, verre, a, s * 0.35, 0.15 - k * 0.3, 0, 0.9, 0.35, 0.03, false));
      if (ailes === 'papillon') { const cp = textureMotif('points', b1, b2); [0, 1].forEach(k => piece(sph, lisse('#ffffff', { map: cp, side: THREE.DoubleSide }), a, s * 0.45, 0.25 - k * 0.5, 0, 1.0, 0.6 - k * 0.15, 0.03)); }
    });
    if (EQ.pics || EC.pics) for (let i = 0; i < 4; i++) piece(cone, mat(b3, 'ecailles'), buste, 0, cH * (0.95 - i * 0.22), -cL * 0.4 + i * 0.02, 0.12, 0.2, 0.12).rotation.x = -0.6;
    if (EQ.piquants || EC.piquants) for (let i = 0; i < 26; i++) { const a = hasard(i) * Math.PI - Math.PI / 2, h = 0.15 + hasard(i + 40) * 0.8; const pq = piece(cone, mat(b3, 'fourrure'), buste, Math.sin(a) * cL * 0.45, cH * h, -Math.cos(a) * cL * 0.35 - 0.05, 0.08, 0.3, 0.08, false); pq.rotation.x = -1.1 - hasard(i + 9) * 0.4; pq.rotation.z = Math.sin(a) * 0.6; }
    if (EQ.aileron || EC.aileron) piece(cone, mat(b1, 'peau'), buste, 0, cH * 1.0, -cL * 0.35, 0.08, 0.45, 0.35).rotation.x = -0.35;
    const carap = EQ.carapace || EC.carapace;
    if (carap === true) { piece(demi, mat(b3, 'ecailles', { map: textureMotif('taches', b3, b1) }), buste, 0, cH * 0.35, -cL * 0.08, cL * 1.2, cH * 1.1, cL * 1.15); }
    if (carap === 'elytres') { const tx = motif === 'points' ? textureMotif('points', b1, b3) : null; [-1, 1].forEach(s => piece(sph, lisse(tx ? '#ffffff' : b1, { map: tx, roughness: 0.15, metalness: 0.1 }), buste, s * cL * 0.22, cH * 0.55, -cL * 0.25, cL * 0.55, cH * 0.85, cL * 0.75)); }
    if (EQ.coquille || EC.coquille) { const c = piece(tore, mat(b3, 'peau'), buste, 0, cH * 0.7, -cL * 0.45, cL * 0.9, cL * 0.9, cL * 1.4); c.rotation.y = Math.PI / 2; piece(sph, mat(b3, 'peau'), buste, 0, cH * 0.7, -cL * 0.45, cL * 0.55, cL * 0.9, cL * 0.9); }
    // 👕 habillage (tenues)
    const tenue = nom => {
      const mt = lisse(cT, { roughness: 0.6 });
      if (nom === 'chapeau') { piece(cyl, mt, t, 0, tR * 0.85, 0, tR * 2.3, 0.04, tR * 2.3); const c = piece(cone, mt, t, 0, tR * 1.5, 0, tR * 1.3, tR * 1.4, tR * 1.3); c.rotation.z = 0.15; piece(sph, metal('#ffd54a'), c, 0.1, 0, 0.45, 0.15, 0.15, 0.15, false); }
      if (nom === 'casquette') { piece(demi, mt, t, 0, tR * 0.35, 0, tR * 2.05, tR * 1.9, tR * 2.0); piece(boite, mt, t, 0, tR * 0.38, tR * 1.05, tR * 1.2, 0.04, tR * 0.9); }
      if (nom === 'couronne') { piece(new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true), metal('#ffd54a'), t, 0, tR * 0.95, 0, tR * 1.3, tR * 0.4, tR * 1.3, false); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; piece(cone, metal('#ffd54a'), t, Math.cos(a) * tR * 0.62, tR * 1.3, Math.sin(a) * tR * 0.62, tR * 0.22, tR * 0.35, tR * 0.22, false); piece(sph, lisse(['#e53935', '#1e88e5', '#43a047'][i % 3], { roughness: 0.05 }), t, Math.cos(a) * tR * 0.66, tR * 0.95, Math.sin(a) * tR * 0.66, tR * 0.12, tR * 0.12, tR * 0.12, false); } }
      if (nom === 'casque') { piece(demi, metal(cT), t, 0, tR * 0.1, 0, tR * 2.2, tR * 2.1, tR * 2.1); piece(boite, metal('#dfe6ee'), t, 0, tR * 1.05, 0, 0.06, tR * 0.5, tR * 1.4); }
      if (nom === 'cape') { const c = piece(boite, lisse(cT, { side: THREE.DoubleSide, roughness: 0.7 }), buste, 0, cH * 0.45, -cL * 0.45, cL * 1.1, cH * 0.95, 0.04); c.rotation.x = 0.18; os.cape = c; }
      if (nom === 'armure') { piece(sph, metal(cT), buste, 0, cH * 0.62, 0.02, cL * 1.08, cH * 0.62, cL * 0.9); [-1, 1].forEach(s => piece(sph, metal(cT), buste, s * cL * 0.5, cH * 0.82, 0, cL * 0.42, cL * 0.3, cL * 0.42)); }
      if (nom === 'echarpe') { const e = piece(tore, mt, buste, 0, cH * 0.95, 0, cL * 0.72, cL * 0.72, cL * 0.72); e.rotation.x = Math.PI / 2; piece(boite, mt, buste, cL * 0.2, cH * 0.72, cL * 0.38, 0.12, cH * 0.35, 0.05).rotation.z = 0.2; }
      if (nom === 'lunettes') { [-1, 1].forEach(s => { const l = piece(tore, lisse('#1d1d22'), t, s * tR * 0.4, tR * 0.12, tR * 0.98, tR * 0.62, tR * 0.62, tR * 0.62, false); piece(new THREE.CircleGeometry(0.42, 24), verre, l, 0, 0, 0.01, 1, 1, 1, false); }); piece(boite, lisse('#1d1d22'), t, 0, tR * 0.14, tR * 1.0, tR * 0.3, 0.03, 0.03, false); }
      if (nom === 'sac') { piece(boite, mt, buste, 0, cH * 0.5, -cL * 0.48, cL * 0.75, cH * 0.6, cL * 0.35); piece(boite, mt, buste, 0, cH * 0.42, -cL * 0.68, cL * 0.5, cH * 0.25, 0.08); }
      if (nom === 'ceinture') { const c = piece(tore, lisse('#3b2a1a'), buste, 0, cH * 0.2, 0, cL * 0.95, cL * 0.95, cL * 0.6, false); c.rotation.x = Math.PI / 2; piece(boite, metal('#ffd54a'), buste, 0, cH * 0.2, cL * 0.42, 0.14, 0.1, 0.04, false); }
      if (nom === 'noeud') [-1, 1].forEach(s => piece(cone, mt, buste, s * 0.08, cH * 0.9, cL * 0.38, 0.12, 0.16, 0.08).rotation.z = s * Math.PI / 2);
    };
    tenues.forEach(tenue);
    g.scale.setScalar(T);
    return { g, os, liberer: () => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }) };
  }

  function poser(m, phase) { // la même animation pour tous (marche, balancier, queue, ailes)
    const a = Math.sin(phase * Math.PI * 2);
    m.os.jambeG.rotation.x = a * 0.6; m.os.jambeD.rotation.x = -a * 0.6;
    m.os.pattes.forEach((pt, i) => pt.rotation.x = (i % 2 ? a : -a) * 0.45);
    m.os.brasG.rotation.x = -a * 0.7; m.os.brasD.rotation.x = a * 0.7;
    m.os.buste.position.y = m.os.jambeG.position.y + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.05;
    m.os.queue.rotation.y = a * 0.4; m.os.tete.rotation.z = a * 0.04;
    if (m.os['aile-1']) { m.os['aile-1'].rotation.z = -0.45 - a * 0.25; m.os['aile1'].rotation.z = 0.45 + a * 0.25; }
    if (m.os.cape) m.os.cape.rotation.x = 0.18 + Math.abs(a) * 0.12;
  }
  function photo(m, angle, phase, taille) {
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
  function cadrage(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let haut = c.height, bas = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 30) { if (y < haut) haut = y; if (y > bas) bas = y; }
    return bas > haut ? { haut, bas } : { haut: 0, bas: c.height };
  }
  async function generer(p, couleurArme, skin) { // planche : 16 directions × 4 poses
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const planche = document.createElement('canvas'); planche.width = S * DIRS; planche.height = S * POSES; const x = planche.getContext('2d');
    for (let po = 0; po < POSES; po++) for (let d = 0; d < DIRS; d++) x.drawImage(photo(m, d / DIRS * Math.PI * 2, po / POSES, S), d * S, po * S);
    const face = document.createElement('canvas'); face.width = face.height = S; face.getContext('2d').drawImage(planche, 4 * S, 0, S, S, 0, 0, S, S);
    const cad = cadrage(face); m.liberer();
    return { planche, S, DIRS, POSES, haut: cad.haut, bas: cad.bas, face };
  }
  async function visage(p, couleurArme, skin) {
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(photo(m, Math.PI / 2, 0, S), 0, 0);
    m.liberer(); return c;
  }
  async function vitrine(p, couleurArme, skin) { // modèle gardé en mémoire, rendu à la demande (rotation au doigt)
    const m = await modele(p, couleurArme, skin); if (!m) return null;
    const c = document.createElement('canvas'); let dernier = null;
    return {
      rendre(angle, taille, phase = 0) {
        const cle = angle.toFixed(3) + taille + phase; if (cle === dernier) return c; dernier = cle;
        c.width = c.height = taille; const x = c.getContext('2d'); x.clearRect(0, 0, taille, taille); x.drawImage(photo(m, angle, phase, taille), 0, 0);
        if (!this.haut) { const cad = cadrage(c); this.haut = cad.haut / taille; this.bas = cad.bas / taille; } return c;
      },
      liberer: () => m.liberer()
    };
  }
  async function apercu(p, couleurArme, canvas, skin) { // aperçu qu'on fait tourner à la souris / au doigt
    const angle = canvas._angle === undefined ? Math.PI / 2 : canvas._angle;
    if (canvas._vue) canvas._vue.liberer();
    const vue = canvas._vue = await vitrine(p, couleurArme, skin); if (!vue) return;
    canvas._angle = angle; let glisse = null;
    const dessiner = () => { const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(vue.rendre(canvas._angle, canvas.width), 0, 0); };
    canvas.onpointerdown = e => { glisse = e.clientX; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (glisse === null) return; canvas._angle -= (e.clientX - glisse) * 0.015; glisse = e.clientX; dessiner(); };
    canvas.onpointerup = () => glisse = null;
    canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
    dessiner();
  }
  return { generer, visage, vitrine, apercu, dispo, ESPECES, TENUES, PARTIES };
})();
