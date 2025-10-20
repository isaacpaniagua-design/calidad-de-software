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

/**
 * Registra un callback que se ejecuta cuando el estado de autenticación cambia.
 * @param {function} callback El callback a ejecutar con el objeto de usuario.
 */
export function onAuth(callback) {
  return onAuthStateChanged(getAuthInstance(), callback);
}

/**
 * Inicia el flujo de inicio de sesión con Google, restringido a cuentas @potros.itson.edu.mx.
 */
export async function signInWithGooglePotros() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: "potros.itson.edu.mx", // Forza el dominio de @potros
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

/**
 * Cierra la sesión del usuario actual.
 */
export async function signOutCurrent() {
  try {
    await signOut(getAuthInstance());
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

/**
 * Verifica si un correo electrónico pertenece a la lista de docentes permitidos.
 * @param {string} email El correo a verificar.
 * @returns {boolean}
 */
export function isTeacherEmail(email) {
  if (!email) return false;
  return allowedTeacherEmails.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

/**
 * Esta función es un placeholder. En el futuro, podría cargar la lista de
 * profesores desde Firestore para mayor flexibilidad.
 */
export function ensureTeacherAllowlistLoaded() {
  // Por ahora, no hace nada porque la lista es estática desde firebase-config.js
  return Promise.resolve();
}


// Inicializar Firebase tan pronto como este módulo se cargue.
initFirebase();
