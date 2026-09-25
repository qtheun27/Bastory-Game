// 🔊 SONS & MUSIQUE — tout est synthétisé (aucun fichier à télécharger), style cartoon / manga
// Son.jouer('tir', volume) • Son.musique('menu' | 'jeu' | null) • Son.regler({ sons, musique })
const Son = (() => {
  let ac = null, sortie = null, busSons = null, busMus = null, bruit = null;
  const pref = { sons: true, musique: true }; try { Object.assign(pref, JSON.parse(localStorage.getItem('bastorySon') || '{}')); } catch (e) {}
  const volApp = k => { const a = (typeof CONFIG !== 'undefined' && CONFIG.app) || {}, v = a[k]; return v === undefined || v === '' || isNaN(+v) ? 1 : Math.max(0, +v); };
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); sortie = ac.createDynamicsCompressor(); sortie.connect(ac.destination);
    busSons = ac.createGain(); busSons.connect(sortie); busMus = ac.createGain(); busMus.connect(sortie); appliquer();
    const n = ac.sampleRate; bruit = ac.createBuffer(1, n, n); const d = bruit.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function appliquer() { if (!ac) return; busSons.gain.value = pref.sons ? 0.55 * volApp('volumeSons') : 0; busMus.gain.value = pref.musique ? 0.16 * volApp('volumeMusique') : 0; }
  const debloquer = () => { if (!init()) return; if (ac.state === 'suspended') ac.resume(); if (voulue && !courante) musique(voulue); }; // les navigateurs exigent un 1er geste
  ['pointerdown', 'touchstart', 'keydown'].forEach(e => addEventListener(e, debloquer, { passive: true }));

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
    if (!pref.sons || !ac || ac.state !== 'running' || v <= 0.02) return; const f = SONS[nom]; if (!f) return;
    const t = ac.currentTime; if (derniers[nom] && t - derniers[nom] < 0.035) return; derniers[nom] = t; // pas 20 fois le même son d'un coup
    try { f(t + 0.005, Math.min(1, v)); } catch (e) {}
  }
  // 🎵 musique : petite boucle chiptune (menus : posée • partie : plus rapide)
  const MUS = {
    menu: { bpm: 104, gamme: [0, 3, 5, 7, 10], racine: 57, basse: [0, 0, 5, 5, 3, 3, 7, 7], motif: [0, 2, 4, 2, 3, 4, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0] },
    jeu: { bpm: 138, gamme: [0, 2, 3, 5, 7, 8, 10], racine: 52, basse: [0, 0, 3, 3, 5, 5, 4, 4], motif: [0, 2, 4, 6, 4, 2, 5, 4, 0, 2, 4, 2, 1, 2, 3, 4] }
  };
  let courante = null, voulue = null, pas = 0, prochain = 0, minuteur = null;
  function planifier() {
    if (!courante || !ac) return; const m = MUS[courante], d = 60 / m.bpm / 2;
    while (prochain < ac.currentTime + 0.25) {
      const i = pas % 16, mes = Math.floor(pas / 16) % 8, b = m.basse[mes], deg = m.motif[i], n = m.racine + 12 + m.gamme[(deg + b) % m.gamme.length] + (deg + b >= m.gamme.length ? 12 : 0);
      if (i % 2 === 0) osc('triangle', note(m.racine - 12 + b), note(m.racine - 12 + b), prochain, d * 1.8, 0.5, busMus);   // basse
      if (i % 4 !== 3 || mes % 2) osc('square', note(n), note(n), prochain, d * 0.9, 0.22, busMus);                        // mélodie
      if (courante === 'jeu' && i % 4 === 0) souffle(prochain, 0.08, 0.5, 120, 60, 'lowpass', 0.7, busMus);                // grosse caisse
      if (courante === 'jeu' && i % 2 === 1) souffle(prochain, 0.03, 0.15, 8000, 6000, 'highpass', 0.7, busMus);            // charleston
      prochain += d; pas++;
    }
  }
  function musique(nom) {
    voulue = nom; if (!ac || ac.state !== 'running') return; if (nom === courante) return;
    courante = nom; pas = 0; prochain = ac.currentTime + 0.1; clearInterval(minuteur); if (nom) minuteur = setInterval(planifier, 90);
  }
  function regler(p) { Object.assign(pref, p); try { localStorage.setItem('bastorySon', JSON.stringify(pref)); } catch (e) {} appliquer(); }
  return { jouer, musique, regler, pref, appliquer };
})();
