// 🔊 SONS & MUSIQUE — tout est synthétisé (aucun fichier à télécharger), style cartoon / manga
// Son.jouer('tir', volume) • Son.musique('menu' | 'jeu' | null) • Son.regler({ sons, musique })
const Son = (() => {
  let ac = null, sortie = null, busSons = null, busMus = null, busMusIn = null, bruit = null;
  const pref = { sons: true, musique: true }; try { Object.assign(pref, JSON.parse(localStorage.getItem('bastorySon') || '{}')); } catch (e) {}
  const volApp = k => { const a = (typeof CONFIG !== 'undefined' && CONFIG.app) || {}, v = a[k]; return v === undefined || v === '' || isNaN(+v) ? 1 : Math.max(0, +v); };
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); sortie = ac.createDynamicsCompressor(); sortie.connect(ac.destination);
    busSons = ac.createGain(); busSons.connect(sortie); busMus = ac.createGain(); busMus.connect(sortie);
    const echo = ac.createDelay(1), fb = ac.createGain(), fl = ac.createBiquadFilter(), mixE = ac.createGain(); echo.delayTime.value = 0.3; fb.gain.value = 0.28; fl.type = 'lowpass'; fl.frequency.value = 2600; mixE.gain.value = 0.22; // petit écho = son plus « produit »
    busMusIn = ac.createGain(); busMusIn.connect(busMus); busMusIn.connect(echo); echo.connect(fl); fl.connect(fb); fb.connect(echo); fl.connect(mixE); mixE.connect(busMus); appliquer();
    const n = ac.sampleRate; bruit = ac.createBuffer(1, n, n); const d = bruit.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function appliquer() { if (!ac) return; busSons.gain.value = pref.sons ? 0.55 * volApp('volumeSons') : 0; busMus.gain.value = pref.musique ? 0.3 * volApp('volumeMusique') : 0; if (fichier) fichier.volume = Math.min(1, (pref.musique ? 0.6 : 0) * volApp('volumeMusique')); }
  // 📱 iPhone : l'audio ne se débloque que pendant un vrai geste (appui relâché), et le bouton silencieux coupe le son du web
  // → on se déclare « lecture audio » (comme une appli de musique) et on joue un son muet en boucle pour garder le son actif
  let muet = null;
  function modeLecture() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!muet) { muet = document.createElement('audio'); muet.setAttribute('playsinline', ''); muet.setAttribute('x-webkit-airplay', 'deny'); muet.loop = true; muet.preload = 'auto';
      muet.src = 'data:audio/wav;base64,UklGRt0BAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YbkBAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA='; } // 40 ms de silence
    const p = muet.play(); if (p && p.catch) p.catch(() => {});
  }
  const debloquer = () => { if (!init()) return; modeLecture(); if (ac.state !== 'running') { const r = ac.resume(); if (r && r.then) r.then(() => { if (voulue && !courante) musique(voulue); }); }
    else if (voulue && !courante) musique(voulue);
    if (ac.state === 'running') ['touchend', 'click', 'pointerup', 'keydown', 'touchstart', 'pointerdown'].forEach(e => removeEventListener(e, debloquer, true)); }; // 1er geste
  ['touchend', 'click', 'pointerup', 'keydown', 'touchstart', 'pointerdown'].forEach(e => addEventListener(e, debloquer, true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume(); }); // retour dans l'appli

  // briques de base
  function osc(type, f0, f1, t, dur, v, dest = busSons) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function souffle(t, dur, v, f0, f1, type = 'bandpass', q = 1.2, dest = busSons) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = bruit; fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const note = n => 440 * Math.pow(2, (n - 69) / 12);
  const SONS = {
    tir: (t, v) => { osc('square', 1300, 320, t, 0.11, 0.22 * v); osc('triangle', 900, 240, t, 0.09, 0.2 * v); },                       // piou !
    lob: (t, v) => { osc('sine', 260, 720, t, 0.16, 0.35 * v); osc('triangle', 180, 420, t + 0.02, 0.12, 0.15 * v); },                 // boing (lancer)
    frappe: (t, v) => { osc('sine', 150, 45, t, 0.3, 0.7 * v); souffle(t, 0.25, 0.5 * v, 900, 120, 'lowpass', 0.7); },               // BOUM sourd du marteau
    retour: (t, v) => { souffle(t, 0.25, 0.35 * v, 600, 2400, 'bandpass', 3); },                                                          // whoosh
    impact: (t, v) => { souffle(t, 0.09, 0.5 * v, 2200, 500, 'bandpass', 1); osc('square', 220, 90, t, 0.07, 0.18 * v); },          // paf !
    explosion: (t, v) => { souffle(t, 0.55, 0.8 * v, 1400, 60, 'lowpass', 0.8); osc('sine', 110, 35, t, 0.45, 0.6 * v); },         // KABOOM
    aie: (t, v) => { osc('square', 320, 160, t, 0.12, 0.25 * v); },                                                                      // on est touché
    ko: (t, v) => { osc('sine', 1400, 180, t, 0.55, 0.3 * v); osc('square', 90, 60, t + 0.5, 0.12, 0.3 * v); souffle(t + 0.5, 0.2, 0.4 * v, 1200, 200); }, // sifflet qui descend + pof
    super: (t, v) => { [0, 4, 7, 12, 16].forEach((n, i) => osc('square', note(72 + n), note(72 + n), t + i * 0.05, 0.14, 0.16 * v)); souffle(t, 0.5, 0.2 * v, 3000, 8000, 'highpass', 0.5); },
    gadget: (t, v) => { [0, 7, 12].forEach((n, i) => osc('triangle', note(84 + n), note(84 + n), t + i * 0.04, 0.12, 0.2 * v)); },   // scintillement
    piece: (t, v) => { osc('square', note(88), note(88), t, 0.07, 0.18 * v); osc('square', note(95), note(95), t + 0.07, 0.22, 0.18 * v); }, // ka-ching
    bip: (t, v) => { osc('square', 880, 880, t, 0.12, 0.2 * v); },
    go: (t, v) => { [0, 4, 7, 12].forEach(n => osc('square', note(67 + n), note(67 + n), t, 0.45, 0.12 * v)); },
    clic: (t, v) => { osc('triangle', 1500, 900, t, 0.05, 0.15 * v); },
    victoire: (t, v) => { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.54], [84, 0.66]].forEach(([n, d]) => { osc('square', note(n), note(n), t + d, d > 0.6 ? 0.5 : 0.14, 0.18 * v); osc('triangle', note(n - 12), note(n - 12), t + d, 0.14, 0.15 * v); }); },
    defaite: (t, v) => { [[67, 0, 0.3], [66, 0.3, 0.3], [65, 0.6, 0.3], [64, 0.9, 0.9]].forEach(([n, d, du]) => osc('sawtooth', note(n - 12), note(n - 12) * (d > 0.8 ? 0.94 : 1), t + d, du, 0.18 * v)); } // trombone triste
  };
  const derniers = {};
  function jouer(nom, v = 1) {
    if (!pref.sons || !ac || v <= 0.02) return; if (ac.state !== 'running') { ac.resume(); return; } const f = SONS[nom]; if (!f) return;
    const t = ac.currentTime; if (derniers[nom] && t - derniers[nom] < 0.035) return; derniers[nom] = t; // pas 20 fois le même son d'un coup
    try { f(t + 0.005, Math.min(1, v)); } catch (e) {}
  }
  // 🎵 MUSIQUE : fichier MP3 choisi dans l'admin, sinon musique synthétisée (accords pop, nappe, arpèges, basse, batterie légère)
  const accord = (r, min) => [r, r + (min ? 3 : 4), r + 7];
  const MUS = {
    menu: { bpm: 96, swing: 0.08, prog: [[60, 0], [67, 0], [69, 1], [65, 0]], lead: [12, null, 14, 16, null, 14, 12, null, 11, null, 12, 14, null, 7, null, null] },          // Do – Sol – La m – Fa : joyeux, posé
    jeu: { bpm: 132, swing: 0, prog: [[57, 1], [53, 0], [60, 0], [55, 0]], lead: [12, 15, 17, 15, 19, null, 17, 15, 12, null, 15, 17, 19, 22, 19, 17] }                     // La m – Fa – Do – Sol : énergique
  };
  function voix(type, f, t, dur, v, att = 0.01, filtre = 0, det = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det; let dst = g;
    if (filtre) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = filtre; b.Q.value = 0.6; o.connect(b); b.connect(g); } else o.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(busMusIn); o.start(t); o.stop(t + dur + 0.05); return dst;
  }
  let courante = null, voulue = null, pas = 0, prochain = 0, minuteur = null, fichier = null;
  function planifier() {
    if (!courante || !ac) return; const m = MUS[courante], d = 60 / m.bpm / 4; // pas = double-croche
    while (prochain < ac.currentTime + 0.3) {
      const i = pas % 16, mes = Math.floor(pas / 16) % 4, [r, min] = m.prog[mes], ch = accord(r, min), t = prochain + (i % 2 ? m.swing * d * 2 : 0), jeu = courante === 'jeu';
      if (i === 0) ch.forEach((n, k) => { voix('sawtooth', note(n), t, d * 16, 0.035, 0.25, 1100, -7); voix('sawtooth', note(n), t, d * 16, 0.035, 0.25, 1100, 7); });   // nappe douce (2 voix désaccordées)
      if (jeu ? i % 2 === 0 : i % 4 === 0) voix('triangle', note(r - 24 + (i % 8 === 6 ? 7 : 0)), t, d * (jeu ? 1.8 : 3.5), 0.42, 0.005);                          // basse
      if (i % (jeu ? 1 : 2) === 0) voix('triangle', note(ch[(i >> (jeu ? 0 : 1)) % 3] + 12 + (i >= 8 ? 12 : 0)), t, d * 1.6, 0.07, 0.003, 3500);                    // arpège qui pétille
      const ld = m.lead[i]; if (ld !== null && (mes % 2 === 1 || jeu)) voix('square', note(r + ld), t, d * 1.9, 0.045, 0.01, 2400);                               // petite mélodie (1 mesure sur 2 dans les menus)
      if (i % 8 === 0 || (jeu && i % 8 === 6)) { voix('sine', 140, t, 0.16, 0.5, 0.002); }                                           // grosse caisse (douce)
      if (i % 8 === 4) souffle(t, 0.13, jeu ? 0.28 : 0.16, 2400, 1400, 'bandpass', 0.9, busMusIn);                                                                   // caisse claire
      if (jeu ? i % 2 === 1 : i % 4 === 2) souffle(t, 0.035, jeu ? 0.1 : 0.06, 9000, 7000, 'highpass', 0.7, busMusIn);                                              // charleston
      prochain += d; pas++;
    }
  }
  function urlMusique(nom) { const a = (typeof CONFIG !== 'undefined' && CONFIG.app) || {}; return (nom === 'jeu' ? a.musiqueJeu : a.musiqueMenu) || ''; }
  function musique(nom) {
    voulue = nom; if (!ac || ac.state !== 'running') return; const url = nom ? urlMusique(nom) : '';
    if (nom === courante && (!fichier || fichier.dataset.url === url)) return;
    courante = nom; clearInterval(minuteur); minuteur = null; if (fichier) { fichier.pause(); fichier = null; }
    if (!nom) return;
    if (url) { fichier = new Audio(url); fichier.dataset.url = url; fichier.loop = true; fichier.volume = Math.min(1, (pref.musique ? 0.6 : 0) * volApp('volumeMusique')); fichier.play().catch(() => {}); return; } // 🎧 ta musique
    pas = 0; prochain = ac.currentTime + 0.1; minuteur = setInterval(planifier, 100);
  }
  function regler(p) { Object.assign(pref, p); try { localStorage.setItem('bastorySon', JSON.stringify(pref)); } catch (e) {} appliquer(); }
  return { jouer, musique, regler, pref, appliquer, etat: () => ({ contexte: ac ? ac.state : 'aucun', musique: courante, sons: busSons ? busSons.gain.value : 0, volMusique: busMus ? busMus.gain.value : 0 }) };
})();
