// js/firebase.js
// Modular v10.12.3 · ES2015 · sin optional chaining

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Singleton
let _app = null;
let _auth = null;
let _db   = null;

// --- Init / getters ---
export function initFirebase(){
  if (!_app) {
    if (!window.firebaseConfig || !window.firebaseConfig.apiKey) {
      throw new Error("[firebase.js] Falta window.firebaseConfig");
    }
    _app = getApps().length ? getApp() : initializeApp(window.firebaseConfig);
    _auth = getAuth(_app);
    _db   = getFirestore(_app);
  }
  return _app;
}

export function getAuthInstance(){ return _auth; }
export function getDb(){ return _db; }

// Suscripción a auth
export function onAuth(cb){
  if (!_auth) initFirebase();
  return onAuthStateChanged(_auth, cb);
}

// --- Sign-in / Sign-out ---
export async function signInWithGooglePotros(){
  if (!_auth) initFirebase();
  const provider = new GoogleAuthProvider();
  // Nota: hostedDomain no se fuerza del lado cliente; se valida con isTeacherEmail
  const res = await signInWithPopup(_auth, provider);
  return res.user;
}

export async function signOutCurrent(){
  if (!_auth) initFirebase();
  return signOut(_auth);
}

// --- Utilidades de rol docente ---
export function isTeacherEmail(email){
  // Ajusta dominios según tu institución
  return /@potros\.itson\.edu\.mx$/.test(String(email||"")) || /@itson\.edu\.mx$/.test(String(email||""));
}

// Lee rol desde Firestore:
// 1) users/{uid}.role === 'teacher'
// 2) meta/roles/teachers/{uid} existe
export async function isTeacherByDoc(uid){
  if (!_db) initFirebase();
  try{
    const uref = doc(_db, "users", String(uid));
    const usnap = await getDoc(uref);
    if (usnap.exists() && String(usnap.data().role||"").toLowerCase() === "teacher") return true;

    const tref = doc(_db, "meta/roles/teachers", String(uid));
    const tsnap = await getDoc(tref);
    if (tsnap.exists()) return true;
  }catch(_){}
  return false;
}

// Si el correo es docente, asegura marcarlo en users/{uid} y espejo en meta/roles/teachers/{uid}
export async function ensureTeacherDocForUser(info){
  if (!_db) initFirebase();
  const uid = String(info && info.uid || "");
  if (!uid) return false;
  try{
    await setDoc(doc(_db, "users", uid), {
      uid: uid,
      email: info && info.email || null,
      displayName: info && info.displayName || null,
      role: "teacher",
      updatedAt: new Date()
    }, { merge: true });

    await setDoc(doc(_db, "meta/roles/teachers", uid), {
      uid: uid,
      email: info && info.email || null,
      at: new Date()
    }, { merge: true });

    return true;
  }catch(e){
    console.error("[firebase.js] ensureTeacherDocForUser", e);
    return false;
  }
}

// Auto-init por si alguien importa sin llamar initFirebase()
try{ initFirebase(); }catch(e){ /* window.firebaseConfig se define en el HTML */ }
