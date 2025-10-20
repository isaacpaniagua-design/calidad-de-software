// En: js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

let app;
let auth;
let db;
let storage;

// Lista de callbacks a ejecutar cuando Firebase esté listo.
const onReadyCallbacks = new Set();

/**
 * Ejecuta un callback cuando la inicialización de Firebase se ha completado.
 * @param {function} callback La función a ejecutar.
 */
export function onFirebaseReady(callback) {
  if (app) {
    callback();
  } else {
    onReadyCallbacks.add(callback);
  }
}

export function ensureTeacherAllowlistLoaded() {
  // TODO: Implementar la lógica para cargar la lista de profesores permitidos.
  console.log("ensureTeacherAllowlistLoaded");
}

/**
 * Inicializa la aplicación Firebase y los servicios principales.
 * Esta función es segura para ser llamada múltiples veces.
 */
export function initFirebase() {
  if (app) return; // Si ya está inicializado, no hacer nada.

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Ejecutar todos los callbacks pendientes.
    onReadyCallbacks.forEach(cb => cb());
    onReadyCallbacks.clear();

  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
}

// --- Getters para acceder a los servicios de Firebase ---

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

// Inicializar Firebase tan pronto como este módulo se cargue.
initFirebase();
