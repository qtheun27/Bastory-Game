// 👤 Fenêtre "Mon profil" (pseudo, email, mot de passe) — partagée par le jeu et l'admin
function ouvrirProfil(auth, apres) {
  const u = auth.currentUser; if (!u) return;
  let f = document.getElementById('profil');
  if (!f) {
    f = document.createElement('div'); f.id = 'profil';
    f.innerHTML = `<style>
      #profil{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(20,0,40,.55);font-family:Fredoka,system-ui,sans-serif;touch-action:auto}
      #profil form{background:linear-gradient(180deg,#3a2d9c,#1d1558);border:4px solid #0b0620;color:#fff;padding:24px;border-radius:22px;width:min(370px,92vw);display:flex;flex-direction:column;gap:9px;box-shadow:9px 10px 0 #0b0620}
      #profil h2{margin:0 0 6px;text-align:center;font:400 34px Bangers,Impact,sans-serif;letter-spacing:1px;color:#ffe14a;text-shadow:-2px -2px 0 #0b0620,2px -2px 0 #0b0620,-2px 2px 0 #0b0620,2px 2px 0 #0b0620,0 -2px 0 #0b0620,0 2px 0 #0b0620,-2px 0 0 #0b0620,2px 0 0 #0b0620,4px 6px 0 #0b0620}
      #profil label{font-size:13px;font-weight:600;display:flex;flex-direction:column;gap:5px}
      #profil input{padding:11px 12px;border-radius:12px;border:3px solid #0b0620;background:#fff;color:#1a1030;font:600 15px Fredoka,system-ui,sans-serif;outline:none;user-select:text;-webkit-user-select:text}
      #profil button{padding:11px;border-radius:14px;border:3px solid #0b0620;cursor:pointer;color:#fff;font:400 20px Bangers,Impact,sans-serif;letter-spacing:1px;background:linear-gradient(180deg,#ffd23f,#ff8a1f);box-shadow:0 5px 0 #0b0620;text-shadow:-1px -1px 0 #0b0620,1px -1px 0 #0b0620,-1px 1px 0 #0b0620,1px 1px 0 #0b0620,0 3px 0 #0b0620;}
      #profil button:active{transform:translateY(4px);box-shadow:0 1px 0 #0b0620}
      #profil button.sec{background:linear-gradient(180deg,#5ff0ff,#1e7bff)} #pfMsg{font-size:13px;min-height:16px;text-align:center}</style>
      <form id="pfForm"><h2>👤 Mon profil</h2>
      <label>Pseudo (visible par tous)<input id="pfPseudo" maxlength="16" required></label>
      <div id="pfMail"><label>Email<input id="pfEmail" type="email"></label>
      <label>Nouveau mot de passe<input id="pfMdp" type="password" placeholder="vide = inchangé" autocomplete="new-password"></label>
      <label>Mot de passe actuel<input id="pfActuel" type="password" placeholder="requis pour changer email ou mot de passe" autocomplete="current-password"></label></div>
      <button type="submit">Enregistrer</button><button type="button" class="sec" id="pfFermer">Fermer</button><div id="pfMsg"></div></form>`;
    document.body.append(f);
    f.querySelector('#pfFermer').onclick = () => f.style.display = 'none';
  }
  const $p = id => f.querySelector('#' + id), msg = (t, ok) => { $p('pfMsg').textContent = t; $p('pfMsg').style.color = ok ? '#b6ff4a' : '#ffe14a'; };
  const google = u.providerData.some(p => p.providerId === 'google.com') && !u.providerData.some(p => p.providerId === 'password');
  $p('pfMail').style.display = google ? 'none' : '';
  $p('pfPseudo').value = u.displayName || ''; $p('pfEmail').value = u.email || ''; $p('pfMdp').value = $p('pfActuel').value = ''; msg('');
  f.style.display = 'flex';
  $p('pfForm').onsubmit = async e => {
    e.preventDefault(); msg('…', true);
    const pseudo = $p('pfPseudo').value.trim(), email = $p('pfEmail').value.trim(), mdp = $p('pfMdp').value, actuel = $p('pfActuel').value;
    const ERR = { 'auth/invalid-credential': 'Mot de passe actuel incorrect', 'auth/wrong-password': 'Mot de passe actuel incorrect', 'auth/weak-password': 'Nouveau mot de passe trop court (6 min.)', 'auth/invalid-email': 'Email mal formé', 'auth/email-already-in-use': 'Email déjà utilisé' };
    try {
      if (!pseudo) throw { message: 'Le pseudo est obligatoire' };
      const changeMail = !google && email && email !== u.email;
      if (changeMail || mdp) {
        if (!actuel) throw { message: 'Entre ton mot de passe actuel' };
        await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, actuel));
      }
      if (pseudo !== u.displayName) await u.updateProfile({ displayName: pseudo });
      if (mdp) await u.updatePassword(mdp);
      let t = '✔ Profil enregistré';
      if (changeMail) { await u.verifyBeforeUpdateEmail(email); t += ' — valide le lien envoyé à ' + email; }
      msg(t, true); if (apres) apres(pseudo);
    } catch (err) { msg(ERR[err.code] || err.message); }
  };
}
