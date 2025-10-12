import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  firebaseConfig,
  allowedEmailDomain,
  useStorage,
  driveFolderId,
  allowedTeacherEmails,
  teacherAllowlistDocPath,
} from "./firebase-config.js";

function isPermissionDenied(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "permission-denied") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /missing or insufficient permissions/i.test(message);
}

let app;
let db;
let auth;
let storage;
let driveAccessToken = null;

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

function sanitizeFirestoreKey(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/[.#$/\[\]]/g, "_")
    .replace(/\s+/g, "_");
}

function isLikelyIdentityNetworkIssue(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "auth/network-request-failed") return true;
  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (!message && !code) return false;
  if (
    code === "auth/internal-error" &&
    /identitytoolkit|network/.test(message)
  ) {
    return true;
  }
  if (/identitytoolkit|accounts:lookup|accounts:sign/.test(message))
    return true;
  if (/err_connection_(?:closed|reset|aborted)/.test(message)) return true;
  if (/network\s?(?:error|request)/.test(message)) return true;
  return false;
}

function createFriendlyIdentityNetworkError(error) {
  const friendly = new Error(
    "No se pudo conectar con el servicio de autenticación de Google. Verifica tu conexión a internet y que el dominio identitytoolkit.googleapis.com no esté bloqueado."
  );
  friendly.code = "auth/network-request-failed";
  friendly.cause = error;
  return friendly;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)));
}

async function signInWithPopupSafe(
  authInstance,
  provider,
  { retries = 1 } = {}
) {
  const normalizedRetries = Number.isFinite(retries) ? Math.max(0, retries) : 0;
  for (let attempt = 0; attempt <= normalizedRetries; attempt++) {
    try {
      return await signInWithPopup(authInstance, provider);
    } catch (error) {
      const isNetworkIssue = isLikelyIdentityNetworkIssue(error);
      const hasNextAttempt = attempt < normalizedRetries;
      if (isNetworkIssue && hasNextAttempt) {
        await wait(400 * (attempt + 1));
        continue;
      }
      if (isNetworkIssue) {
        throw createFriendlyIdentityNetworkError(error);
      }
      throw error;
    }
  }
  const fallbackError = new Error("No se pudo completar la autenticación.");
  fallbackError.code = "auth/network-request-failed";
  throw fallbackError;
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

export async function listTeacherNotificationEmails({
  domainOnly = true,
} = {}) {
  try {
    await ensureTeacherAllowlistLoaded();
  } catch (error) {
    console.warn("listTeacherNotificationEmails:allowlist", error);
  }

  const normalizedDomain =
    typeof allowedEmailDomain === "string"
      ? allowedEmailDomain.trim().toLowerCase()
      : "";

  const emails = [];
  const seen = new Set();

  teacherAllowlistSet.forEach((email) => {
    if (!email || typeof email !== "string") return;
    const normalized = email.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    if (domainOnly && normalizedDomain) {
      const [, domain = ""] = normalized.split("@");
      if (!domain || domain !== normalizedDomain) {
        return;
      }
    }
    seen.add(normalized);
    emails.push(normalized);
  });

  return emails;
}

export function initFirebase() {
  if (app) {
    return;
  }
  app = initializeApp(window.firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getAuthInstance() {
  if (!auth) initFirebase();
  return auth;
}

export function getStorageInstance() {
  if (!storage) initFirebase();
  return storage;
}

export async function signInWithGooglePotros() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  // Sugerencia visual del dominio (no es seguridad)
  provider.setCustomParameters({ hd: allowedEmailDomain });
  // Permiso para subir a Google Drive (archivos creados por la app)
  try {
    provider.addScope("https://www.googleapis.com/auth/drive.file");
  } catch (_) {}

  try {
    const result = await signInWithPopupSafe(auth, provider, { retries: 1 });
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

export async function getDriveAccessTokenInteractive() {
  if (driveAccessToken) return driveAccessToken;
  // Intentar re-solicitar el token con alcance de Drive
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: allowedEmailDomain });
  try {
    provider.addScope("https://www.googleapis.com/auth/drive.file");
  } catch (_) {}
  const result = await signInWithPopupSafe(auth, provider, { retries: 1 });
  const cred = GoogleAuthProvider.credentialFromResult(result);
  driveAccessToken = cred?.accessToken || null;
  if (!driveAccessToken)
    throw new Error("No se pudo obtener token de Google Drive");
  return driveAccessToken;
}

export async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
  driveAccessToken = null;
}

// --- Autenticación con correo y contraseña ---
// Permite iniciar sesión con credenciales de email/password previamente
// registradas en Firebase Authentication. No realiza ninguna validación de
// dominio; se espera que el rol de docente o estudiante se determine después
// mediante isTeacherEmail/isTeacherByDoc.
export async function signInWithEmailPassword(email, password) {
  const auth = getAuthInstance();
  return signInWithEmailAndPassword(auth, email, password);
}

// --- Autenticación con Google sin restricción de dominio ---
// Permite iniciar sesión con cualquier cuenta de Google. Útil para pruebas con
// correos que no pertenecen al dominio institucional. Tras iniciar sesión, el
// rol de docente o estudiante se determinará mediante isTeacherEmail o
// isTeacherByDoc. No solicita permisos de Drive.
export async function signInWithGoogleOpen() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopupSafe(auth, provider, { retries: 1 });
  return result?.user || null;
}

export function onAuth(cb) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

// ====== Roles ======
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

export async function ensureTeacherDocForUser({ uid, email, displayName }) {
  if (!uid || !email) return false;
  const lower = (email || "").toLowerCase();
  const db = getDb();
  const ref = doc(collection(db, "teachers"), uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return true;
    }
    await ensureTeacherAllowlistLoaded();
    if (!isTeacherEmail(lower)) {
      // No intentamos crear el documento si el correo no tiene privilegios de docente.
      return false;
    }
    await setDoc(ref, {
      email: lower,
      name: displayName || null,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (_) {
    return false;
  }
}

function todayKey() {
  // YYYY-MM-DD en hora local
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function saveTodayAttendance({
  uid,
  name,
  email,
  type,
  manual = false,
}) {
  const db = getDb();
  const authInstance = getAuthInstance();
  const currentUser = authInstance?.currentUser || null;
  const normalizedUid =
    typeof uid === "string" && uid.trim().length > 0
      ? uid.trim()
      : String(uid || "").trim();
  if (!normalizedUid) {
    throw new Error("Identificador de usuario requerido");
  }

  const date = todayKey();
  const attendanceId = `${date}_${normalizedUid}`; // evita duplicados por dia-usuario
  const ref = doc(collection(db, "attendances"), attendanceId);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error("Ya tienes tu asistencia registrada para el dia de hoy");
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Correo electronico requerido");
  }

  const createdByUid =
    typeof (currentUser?.uid || normalizedUid) === "string"
      ? currentUser?.uid || normalizedUid
      : String(currentUser?.uid || normalizedUid);
  const normalizedCreatedByUid = String(createdByUid || "").trim();
  if (!normalizedCreatedByUid) {
    throw new Error("Sesion invalida para registrar asistencia");
  }
  const createdByEmail = String(currentUser?.email || normalizedEmail)
    .trim()
    .toLowerCase();
  const normalizedType =
    typeof type === "string" && type.trim().length > 0
      ? type.trim()
      : "student";

  await setDoc(ref, {
    uid: normalizedUid,
    name,
    email: normalizedEmail,
    type: normalizedType,
    date,
    manual: !!manual,
    createdByUid: normalizedCreatedByUid,
    createdByEmail,
    timestamp: serverTimestamp(),
  });

  return { id: attendanceId, uid, name, email: normalizedEmail, type, date };
}

export function subscribeTodayAttendance(cb, onError) {
  const db = getDb();
  const date = todayKey();
  const q = query(collection(db, "attendances"), where("date", "==", date));
  return onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name,
          email: data.email,
          type: data.type,
          timestamp: data.timestamp?.toDate
            ? data.timestamp.toDate()
            : new Date(),
        });
      });
      items.sort((a, b) => {
        const timeA = a.timestamp?.getTime?.() || 0;
        const timeB = b.timestamp?.getTime?.() || 0;
        return timeB - timeA;
      });
      cb(items);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeTodayAttendanceByUser(email, cb, onError) {
  const db = getDb();
  const date = todayKey();
  const q = query(
    collection(db, "attendances"),
    where("date", "==", date),
    where("email", "==", (email || "").toLowerCase())
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name,
          email: data.email,
          type: data.type,
          timestamp: data.timestamp?.toDate
            ? data.timestamp.toDate()
            : new Date(),
        });
      });
      items.sort((a, b) => {
        const timeA = a.timestamp?.getTime?.() || 0;
        const timeB = b.timestamp?.getTime?.() || 0;
        return timeB - timeA;
      });
      cb(items);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

/**
 * Busca un documento de estudiante en la colección 'students' por su email.
 * @param {string} email El email del estudiante a buscar.
 * @returns {Promise<{id: string, data: object}|null>} El ID y datos del estudiante, o null si no se encuentra.
 */
export async function findStudentByUid(uid) {
  if (!uid) return null;
  try {
    const { collection, query, where, getDocs } = await getFirestore();
    const q = query(collection(db, "students"), where("authUid", "==", uid));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const studentDoc = querySnapshot.docs[0];
    return {
      id: studentDoc.id,
      ...studentDoc.data(),
    };
  } catch (error) {
    console.error("Error en findStudentByUid:", error);
    return null;
  }
}

/**
 * Busca un perfil de estudiante en la colección 'students' por su dirección de correo.
 * @param {string} email El correo electrónico del estudiante.
 * @returns {Promise<object|null>} El perfil del estudiante o null si no se encuentra.
 */
export async function findStudentByEmail(email) {
  if (!email) return null;
  try {
    const { collection, query, where, getDocs } = await getFirestore();
    const q = query(collection(db, "students"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn(
        `findStudentByEmail: No se encontró estudiante con email ${email}.`
      );
      return null;
    }
    // Se asume que solo hay un documento por email.
    const studentDoc = querySnapshot.docs[0];
    return {
      id: studentDoc.id, // El ID del documento (alfanumérico de Firestore)
      ...studentDoc.data(), // Contiene matrícula, uid (matrícula), etc.
    };
  } catch (error) {
    console.error("Error en findStudentByEmail:", error);
    if (error.code === "permission-denied") {
      console.error(
        "Error de permisos al buscar por email. Revisa las reglas de seguridad de Firestore para la colección 'students'."
      );
    }
    return null;
  }
}

export async function getStudentGradeItems(studentId) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    email: data.email || null,
    unit1: data.unit1 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    unit2: data.unit2 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    unit3: data.unit3 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    projectFinal: data.projectFinal ?? 0,
  };
}

// --- MÉTODOS PARA PLANES DE PRUEBA ---

/**
 * Guarda (crea o actualiza) un plan de pruebas en Firestore.
 * @param {string} planId El ID único del documento (del campo 'identificador').
 * @param {object} planData Objeto con todos los datos del formulario.
 * @returns {Promise<void>}
 */
export async function saveTestPlan(planId, planData) {
  const db = getDb();
  const planRef = doc(db, "planesDePrueba", planId);
  // Añadimos un timestamp para ordenar y saber cuándo se modificó por última vez
  const dataToSave = {
    ...planData,
    lastModified: serverTimestamp(),
  };
  return setDoc(planRef, dataToSave, { merge: true }); // merge:true es útil si quieres actualizar sin sobreescribir todo
}

export { app };

/**
 * Se suscribe para obtener las actividades de UN SOLO estudiante en tiempo real.
 * @param {string} studentId - El ID de matrícula del estudiante (ej. "00000249116").
 * @param {function} cb - El callback que se ejecutará con la lista de actividades.
 * @returns {import("firebase/firestore").Unsubscribe} - La función para cancelar la suscripción.
 */
export function subscribeMyActivities(studentId, cb) {
  if (!studentId) return () => {};

  const db = getDb();
  const activitiesRef = collection(db, "grades", studentId, "activities");
  const q = query(activitiesRef, orderBy("unit")); // Ordenar por unidad

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    cb(activities);
  });
}

/**
 * Busca un documento de estudiante en la colección 'students' por su email.
 * @param {string} email El email del estudiante a buscar.
 * @returns {Promise<{id: string, data: object}|null>} El ID y datos del estudiante, o null si no se encuentra.
 */
export async function findStudentByUid(uid) {
  if (!uid) return null;
  try {
    const { collection, query, where, getDocs } = await getFirestore();
    const q = query(collection(db, "students"), where("authUid", "==", uid));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const studentDoc = querySnapshot.docs[0];
    return {
      id: studentDoc.id,
      ...studentDoc.data(),
    };
  } catch (error) {
    console.error("Error en findStudentByUid:", error);
    return null;
  }
}

/**
 * Busca un perfil de estudiante en la colección 'students' por su dirección de correo.
 * @param {string} email El correo electrónico del estudiante.
 * @returns {Promise<object|null>} El perfil del estudiante o null si no se encuentra.
 */
export async function findStudentByEmail(email) {
  if (!email) return null;
  try {
    const { collection, query, where, getDocs } = await getFirestore();
    const q = query(collection(db, "students"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn(
        `findStudentByEmail: No se encontró estudiante con email ${email}.`
      );
      return null;
    }
    // Se asume que solo hay un documento por email.
    const studentDoc = querySnapshot.docs[0];
    return {
      id: studentDoc.id, // El ID del documento (alfanumérico de Firestore)
      ...studentDoc.data(), // Contiene matrícula, uid (matrícula), etc.
    };
  } catch (error) {
    console.error("Error en findStudentByEmail:", error);
    if (error.code === "permission-denied") {
      console.error(
        "Error de permisos al buscar por email. Revisa las reglas de seguridad de Firestore para la colección 'students'."
      );
    }
    return null;
  }
}

export async function getStudentGradeItems(studentId) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    email: data.email || null,
    unit1: data.unit1 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    unit2: data.unit2 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    unit3: data.unit3 || {
      participation: 0,
      assignments: 0,
      classwork: 0,
      exam: 0,
    },
    projectFinal: data.projectFinal ?? 0,
  };
}

// --- MÉTODOS PARA PLANES DE PRUEBA ---

/**
 * Guarda (crea o actualiza) un plan de pruebas en Firestore.
 * @param {string} planId El ID único del documento (del campo 'identificador').
 * @param {object} planData Objeto con todos los datos del formulario.
 * @returns {Promise<void>}
 */
export async function saveTestPlan(planId, planData) {
  const db = getDb();
  const planRef = doc(db, "planesDePrueba", planId);
  // Añadimos un timestamp para ordenar y saber cuándo se modificó por última vez
  const dataToSave = {
    ...planData,
    lastModified: serverTimestamp(),
  };
  return setDoc(planRef, dataToSave, { merge: true }); // merge:true es útil si quieres actualizar sin sobreescribir todo
}

export { app };

/**
 * Se suscribe para obtener las actividades de UN SOLO estudiante en tiempo real.
 * @param {string} studentId - El ID de matrícula del estudiante (ej. "00000249116").
 * @param {function} cb - El callback que se ejecutará con la lista de actividades.
 * @returns {import("firebase/firestore").Unsubscribe} - La función para cancelar la suscripción.
 */
export function subscribeMyActivities(studentId, cb) {
  if (!studentId) return () => {};

  const db = getDb();
  const activitiesRef = collection(db, "grades", studentId, "activities");
  const q = query(activitiesRef, orderBy("unit")); // Ordenar por unidad

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    cb(activities);
  });
}
