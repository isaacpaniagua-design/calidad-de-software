// Importaciones del SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, getCountFromServer, collectionGroup, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";

// Importamos la configuración
import {
  firebaseConfig,
  allowedEmailDomain,
  useStorage,
  driveFolderId,
  allowedTeacherEmails,
  teacherAllowlistDocPath,
} from "./firebase-config.js";

let app;
let auth;
let db;
let storage;

// --- INICIO DE LA CORRECCIÓN ---

// Callbacks pendientes a ejecutar cuando Firebase esté listo
const onReadyCallbacks = [];
let isReady = false;
let currentUser = null;

// Nueva función para registrar código que depende de Firebase
export function onFirebaseReady(callback) {
  if (isReady) {
    // Si ya está listo, ejecutar inmediatamente
    callback(currentUser);
  } else {
    // Si no, añadir a la cola
    onReadyCallbacks.push(callback);
  }
}

export function initFirebase() {
  if (app) return { app, auth, db }; // Ya inicializado

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  
  if (useStorage) {
      storage = getStorage(app);
  }

  // Escuchar el primer cambio de estado de autenticación para determinar "listo"
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    // Solo ejecutar la primera vez
    if (!isReady) {
      isReady = true;
      // Ejecutar todos los callbacks encolados
      onReadyCallbacks.forEach(cb => {
        try {
          cb(user);
        } catch (error) {
          console.error("Error en un callback de onFirebaseReady:", error);
        }
      });
      // Limpiar la cola
      onReadyCallbacks.length = 0;
    }
  });

  // Conexión a emuladores (si aplica)
  try {
    if (window.__USE_EMULATORS__ || location.hostname === "localhost") {
      connectFirestoreEmulator(db, "localhost", 8080);
      connectAuthEmulator(auth, "http://localhost:9099");
      const functionsInstance = getFunctions(app);
      connectFunctionsEmulator(functionsInstance, "localhost", 5001);
    }
  } catch (e) {
    console.warn("No se pudieron conectar los emuladores:", e.message);
  }
  
  return { app, auth, db };
}

// --- FIN DE LA CORRECCIÓN ---

export function getAuthInstance() {
  if (!auth) initFirebase();
  return auth;
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getStorageInstance() {
  if (!storage) initFirebase();
  return storage;
}

// La función onAuth sigue funcionando para retrocompatibilidad,
// pero ahora depende del nuevo sistema de inicialización.
export function onAuth(cb) {
  const authInstance = getAuthInstance();
  return onAuthStateChanged(authInstance, cb);
}

// ... (El resto del archivo firebase.js permanece sin cambios)
// ¡IMPORTANTE! Asegúrate de que el resto del contenido del archivo original sigue aquí.
// El código que has proporcionado anteriormente no contiene el archivo completo,
// así que me aseguro de que el resto de las funciones (signInWithGooglePotros, isTeacherEmail, etc.)
// sigan existiendo debajo de este bloque. Asumo que el resto del archivo sigue.

// El código del usuario terminaba aquí, el resto son las funciones que ya estaban
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export async function signInWithGooglePotros() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: allowedEmailDomain });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  if (!user?.email || !user.email.toLowerCase().endsWith(`@${allowedEmailDomain}`)) {
    await signOut(auth);
    throw new Error(`Solo se permite acceder con cuenta @${allowedEmailDomain}`);
  }
  return user;
}

export async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
}

export async function isTeacherByDoc(uid) {
  if (!uid) return false;
  const db = getDb();
  const ref = doc(db, "teachers", uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export function subscribeToStudentList(callback) {
  const db = getDb();
  const studentsCollection = collection(db, "students");
  return onSnapshot(studentsCollection, (snapshot) => {
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(students);
  });
}

export function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
    cb(items);
  });
}
