// 👤 Fenêtre "Mon profil" (pseudo, email, mot de passe) — partagée par le jeu et l'admin
function ouvrirProfil(auth, apres) {
  const u = auth.currentUser; if (!u) return;
  let f = document.getElementById('profil');
  if (!f) {
    f = document.createElement('div'); f.id = 'profil';
    f.innerHTML = `<style>
      #profil{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,6,30,.85);font-family:Arial,sans-serif;touch-action:auto}
      #profil form{background:#2a2250;color:#fff;padding:22px;border-radius:16px;width:min(360px,92vw);display:flex;flex-direction:column;gap:8px}
      #profil h2{margin:0 0 6px;color:#ffd23f;text-align:center} #profil label{font-size:13px;display:flex;flex-direction:column;gap:4px}
      #profil input{padding:10px;border-radius:8px;border:0;font-size:15px;user-select:text;-webkit-user-select:text}
      #profil button{padding:10px;border-radius:8px;border:0;font-weight:900;cursor:pointer;background:#ffd23f}
      #profil button.sec{background:#443a7a;color:#fff} #pfMsg{font-size:13px;min-height:16px;text-align:center}</style>
      <form id="pfForm"><h2>👤 Mon profil</h2>
      <label>Pseudo (visible par tous)<input id="pfPseudo" maxlength="16" required></label>
      <div id="pfMail"><label>Email<input id="pfEmail" type="email"></label>
      <label>Nouveau mot de passe<input id="pfMdp" type="password" placeholder="vide = inchangé" autocomplete="new-password"></label>
      <label>Mot de passe actuel<input id="pfActuel" type="password" placeholder="requis pour changer email ou mot de passe" autocomplete="current-password"></label></div>
      <button type="submit">Enregistrer</button><button type="button" class="sec" id="pfFermer">Fermer</button><div id="pfMsg"></div></form>`;
    document.body.append(f);
    f.querySelector('#pfFermer').onclick = () => f.style.display = 'none';
  }
  const $p = id => f.querySelector('#' + id), msg = (t, ok) => { $p('pfMsg').textContent = t; $p('pfMsg').style.color = ok ? '#7dff9c' : '#ffb3b3'; };
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
