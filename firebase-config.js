// 🔥 CONFIG FIREBASE — projet Bastory
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCGiwgv4bkh98IVIU0e76JMX-6KkFribDw",
  authDomain: "bastory.firebaseapp.com",
  projectId: "bastory",
  appId: "1:117772608488:web:18110d646891cc95233a5d",
  // ⚠️ Multijoueur : colle ici l'URL de ta Realtime Database (Console → Realtime Database, en haut de l'onglet Données)
  databaseURL: "https://bastory-default-rtdb.europe-west1.firebasedatabase.app"
};

// 🔐 Comptes autorisés dans l'espace admin (mêmes emails que dans les règles Firestore)
const ADMINS = ["q.theuninck@gmail.com", "h.theuninck@icloud.com", "isidorevancalemont@icloud.com"];
const estAdmin = u => !!u && ADMINS.includes((u.email || '').toLowerCase());
