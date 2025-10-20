
// Importaciones del SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, getCountFromServer, collectionGroup, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";

// ¡IMPORTANTE! Importamos la configuración pura desde el archivo correcto.
import {
  firebaseConfig,
  allowedEmailDomain,
  useStorage,
  driveFolderId,
  allowedTeacherEmails,
  teacherAllowlistDocPath,
} from "./firebase-config.js";

// --- INICIO DE LA LÓGICA DE INICIALIZACIÓN SEGURA ---

let app;
let auth;
let db;
let storage;
let driveAccessToken = null;

// Cola de funciones a ejecutar cuando Firebase esté 100% listo
const onReadyCallbacks = [];
let isFirebaseReady = false;
let initialUser = undefined; // Usamos undefined para saber que aún no se ha comprobado

// Nueva función para scripts que necesitan ejecutarse UNA SOLA VEZ cuando todo esté listo.
export function onFirebaseReady(callback) {
  if (isFirebaseReady) {
    // Si ya está listo, ejecutar inmediatamente con el usuario inicial.
    callback(initialUser);
  } else {
    // Si no, añadir a la cola para ejecución futura.
    onReadyCallbacks.push(callback);
  }
}

// Función de inicialización principal (idempotente)
export function initFirebase() {
  if (app) return { app, auth, db }; // Si ya está inicializado, no hacer nada.

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (useStorage) {
    storage = getStorage(app);
  }

  // Conectar a emuladores si estamos en entorno de desarrollo
  try {
    if (window.__USE_EMULATORS__ || location.hostname === 'localhost') {
      connectAuthEmulator(auth, "http://localhost:9099");
      connectFirestoreEmulator(db, 'localhost', 8080);
      const funcs = getFunctions(app);
      connectFunctionsEmulator(funcs, 'localhost', 5001);
      console.info("Firebase conectado a emuladores locales.");
    }
  } catch (e) {
    console.warn("No se pudieron conectar los emuladores: ", e.message);
  }

  // onAuthStateChanged se usa para saber cuándo está lista la autenticación.
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    // La primera vez que esto se ejecuta, Firebase está "listo".
    if (initialUser === undefined) {
      initialUser = user;
      isFirebaseReady = true;
      // Ejecutar todas las funciones encoladas
      onReadyCallbacks.forEach(cb => {
        try {
          cb(user);
        } catch (error) {
          console.error("Error en un callback de onFirebaseReady:", error);
        }
      });
      // Limpiar la cola para no volver a ejecutar
      onReadyCallbacks.length = 0;
    }
  });

  return { app, auth, db };
}

export function getAuthInstance() {
  if (!auth) initFirebase();
  return auth;
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getStorageInstance() {
  if (!useStorage) return null;
  if (!storage) initFirebase();
  return storage;
}

// La función `onAuth` se mantiene para scripts que necesitan reaccionar
// a cambios de sesión EN TIEMPO REAL (login/logout), como auth-guard.js.
export function onAuth(cb) {
  const authInstance = getAuthInstance();
  return onAuthStateChanged(authInstance, cb);
}

// --- FIN DE LA LÓGICA DE INICIALIZACIÓN SEGURA ---


// --- COMIENZO DEL RESTO DE FUNCIONES ORIGINALES (AHORA SÍ) ---

function isPermissionDenied(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "permission-denied") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /missing or insufficient permissions/i.test(message);
}

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

function sanitizeFirestoreKey(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/[.#$/\[\]]/g, "_")
    .replace(/\s+/g, "_");
}


const baseTeacherEmails = Array.isArray(allowedTeacherEmails)
  ? allowedTeacherEmails.map(normalizeEmail).filter(Boolean)
  : [];

const teacherAllowlistSet = new Set(baseTeacherEmails);
let teacherAllowlistLoaded = false;
let teacherAllowlistPromise = null;

function getTeacherAllowlistPathSegments() {
  if (typeof teacherAllowlistDocPath !== "string") return [];
  return teacherAllowlistDocPath
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function fetchTeacherAllowlistFromFirestore() {
  const segments = getTeacherAllowlistPathSegments();
  if (segments.length < 2) return [];
  const db = getDb();
  const ref = doc(db, ...segments);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const raw = Array.isArray(data.emails) ? data.emails : [];
  return raw.map(normalizeEmail).filter(Boolean);
}

export async function ensureTeacherAllowlistLoaded() {
  if (teacherAllowlistLoaded) return teacherAllowlistSet;
  if (!teacherAllowlistPromise) {
    teacherAllowlistPromise = (async () => {
      try {
        // Espera a que Firebase esté listo antes de intentar leer la BD
        await new Promise(resolve => onFirebaseReady(resolve));
        const dynamicEmails = await fetchTeacherAllowlistFromFirestore();
        dynamicEmails.forEach((email) => teacherAllowlistSet.add(email));
      } catch (error) {
        if (!isPermissionDenied(error)) {
          console.warn(
            "No se pudo cargar la lista dinámica de docentes autorizados:",
            error
          );
        }
      } finally {
        teacherAllowlistLoaded = true;
      }
      return teacherAllowlistSet;
    })();
  }
  return teacherAllowlistPromise;
}


export async function signInWithGooglePotros() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: allowedEmailDomain });
  try {
    provider.addScope("https://www.googleapis.com/auth/drive.file");
  } catch (_) {}

  try {
    const result = await signInWithPopup(auth, provider, { retries: 1 });
    const user = result.user;
    try {
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (cred?.accessToken) driveAccessToken = cred.accessToken;
    } catch (_) {}
    if (
      !user?.email ||
      !user.email.toLowerCase().endsWith(`@${allowedEmailDomain}`)
    ) {
      await signOut(auth);
      throw new Error(
        `Solo se permite acceder con cuenta @${allowedEmailDomain}`
      );
    }
    return user;
  } catch (e) {
    if (e?.code === "auth/unauthorized-domain") {
      const host =
        typeof location !== "undefined" ? location.hostname : "(desconocido)";
      throw new Error(
        `Dominio no autorizado en Firebase Auth (${host}). Agrega este hostname en Firebase Console → Authentication → Settings → Authorized domains.`
      );
    }
    throw e;
  }
}

export async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
  driveAccessToken = null;
}


export function isTeacherEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return teacherAllowlistSet.has(normalized);
}

export async function isTeacherByDoc(uid) {
  if (!uid) return false;
  const db = getDb();
  try {
    const ref = doc(collection(db, "teachers"), uid);
    const snap = await getDoc(ref);
    return !!snap.exists();
  } catch (_) {
    return false;
  }
}

// El resto de las funciones que estaban en el archivo original...
export async function subscribeToStudentList(callback) {
  const db = getDb();
  const studentsCollection = collection(db, "students");
  const unsubscribe = onSnapshot(studentsCollection, (snapshot) => {
    const students = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(students);
  });
  return unsubscribe; 
}

export function getGradeForStudent(studentId, callback) {
  const db = getDb();
  const gradeDocRef = doc(db, "grades", studentId);
  const unsubscribe = onSnapshot(gradeDocRef, (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
  return unsubscribe; 
}

export function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({ id: docSnap.id, ...d });
    });
    cb(items);
  });
}

export { app };
