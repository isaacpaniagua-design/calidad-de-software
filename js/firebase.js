// En: js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { firebaseConfig, allowedTeacherEmails } from "./firebase-config.js";

let app;
let auth;
let db;
let storage;

const onReadyCallbacks = new Set();

export function onFirebaseReady(callback) {
  if (app) {
    callback();
  } else {
    onReadyCallbacks.add(callback);
  }
}

export function initFirebase() {
  if (app) return;

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    onReadyCallbacks.forEach(cb => cb());
    onReadyCallbacks.clear();
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
}

// --- Getters ---
export function getApp() {
  if (!app) throw new Error("Firebase no ha sido inicializado.");
  return app;
}

export function getAuthInstance() {
  if (!auth) throw new Error("Firebase Auth no ha sido inicializado.");
  return auth;
}

export function getDb() {
  if (!db) throw new Error("Firestore no ha sido inicializado.");
  return db;
}

export function getStorageInstance() {
  if (!storage) throw new Error("Firebase Storage no ha sido inicializado.");
  return storage;
}

// --- Auth Helpers ---

export function onAuth(callback) {
  return onAuthStateChanged(getAuthInstance(), callback);
}

export async function signInWithGooglePotros() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: "potros.itson.edu.mx",
  });
  try {
    await signInWithPopup(getAuthInstance(), provider);
  } catch (error) {
    console.error("Error en signInWithGooglePotros:", error);
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      alert(`Error al iniciar sesión: ${error.message}`);
    }
  }
}

export async function signInWithGoogleOpen() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(getAuthInstance(), provider);
    } catch (error) {
        console.error("Error en signInWithGoogleOpen:", error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            alert(`Error al iniciar sesión: ${error.message}`);
        }
    }
}

export async function signOutCurrent() {
  try {
    await signOut(getAuthInstance());
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

export function isTeacherEmail(email) {
  if (!email) return false;
  return allowedTeacherEmails.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

export function ensureTeacherAllowlistLoaded() {
  return Promise.resolve();
}

initFirebase();
