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
let auth;
let db;
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
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (!message && !code) return false;
  if (code === "auth/internal-error" && /identitytoolkit|network/.test(message)) {
    return true;
  }
  if (/identitytoolkit|accounts:lookup|accounts:sign/.test(message)) return true;
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

async function signInWithPopupSafe(authInstance, provider, { retries = 1 } = {}) {
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

export async function listTeacherNotificationEmails({ domainOnly = true } = {}) {
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
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
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

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Correo electronico requerido");
  }

  const createdByUid =
    typeof (currentUser?.uid || normalizedUid) === "string"
      ? (currentUser?.uid || normalizedUid)
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
export async function findStudentByEmail(email) {
  if (!email) return null;
  const db = getDb();
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("email", "==", email.toLowerCase()), limit(1));
  
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const studentDoc = querySnapshot.docs[0];
      return { id: studentDoc.id, data: studentDoc.data() }; // Devolvemos el ID del documento (ej. "00000099876")
    }
    return null;
  } catch (error) {
    console.error("Error buscando estudiante por email:", error);
    return null;
  }
}
export async function fetchAttendancesByDateRange(startDateStr, endDateStr) {
  const db = getDb();
  // startDateStr, endDateStr expected in 'YYYY-MM-DD'
  const qy = query(
    collection(db, "attendances"),
    where("date", ">=", startDateStr),
    where("date", "<=", endDateStr),
    orderBy("date", "asc")
  );
  const snap = await getDocs(qy);
  const items = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    items.push({
      id: docSnap.id,
      name: data.name,
      email: data.email,
      type: data.type,
      date: data.date,
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
    });
  });
  return items;
}

export async function fetchAttendancesByDateRangeByUser(
  email,
  startDateStr,
  endDateStr
) {
  const lowerEmail = (email || "").toLowerCase();
  const items = await fetchAttendancesByDateRange(startDateStr, endDateStr);
  return items.filter(
    (item) => (item.email || "").toLowerCase() === lowerEmail
  );
}

// ====== Calificaciones (Grades) ======
export function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        name: d.name,
        email: d.email,
        unit1: d.unit1 || {
          participation: 0,
          assignments: 0,
          classwork: 0,
          exam: 0,
        },
        unit2: d.unit2 || {
          participation: 0,
          assignments: 0,
          classwork: 0,
          exam: 0,
        },
        unit3: d.unit3 || {
          participation: 0,
          assignments: 0,
          classwork: 0,
          exam: 0,
        },
        projectFinal: d.projectFinal ?? 0,
      });
    });
    cb(items);
  });
}
/**
 * Se suscribe para obtener las calificaciones de UN SOLO estudiante en tiempo real.
 * @param {string} studentUid - El UID del estudiante logueado.
 * @param {function} cb - El callback que se ejecutará con los datos de las calificaciones.
 * @returns {import("firebase/firestore").Unsubscribe} - La función para cancelar la suscripción.
 */
/**
 * Se suscribe en tiempo real al documento de calificaciones de un estudiante.
 * @param {string} studentId - El ID del DOCUMENTO del estudiante.
 * @param {function} callback - Función que se ejecuta con los datos de las calificaciones.
 * @returns {function} - Función para cancelar la suscripción.
 */
/**
 * Se suscribe en tiempo real a las calificaciones del estudiante actual.
 * @param {string} userUid - El UID de autenticación del usuario.
 * @param {function} callback - Función que se ejecuta con los datos.
 * @returns {function} - Función para cancelar la suscripción.
 */
export function subscribeMyGrades(userUid, callback) {
  const gradesQuery = query(collection(db, 'grades'), where('authUid', '==', userUid));
  
  return onSnapshot(gradesQuery, (snapshot) => {
    if (snapshot.empty) {
      console.warn(`No se encontraron calificaciones para el usuario con UID: ${userUid}`);
      callback([]);
      return;
    }
    const gradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(gradesData);
  }, (error) => {
    console.error("Error al obtener mis calificaciones:", error);
    callback([]);
  });
}



export async function updateStudentGradePartial(studentId, path, value) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  const updates = { updatedAt: serverTimestamp() };

  if (path === 'email') {
    const trimmedEmail = typeof value === 'string' ? value.trim() : value;
    if (typeof trimmedEmail === 'string') {
      updates.email = trimmedEmail || null;
      updates.emailLower = trimmedEmail ? trimmedEmail.toLowerCase() : null;
    } else {
      updates.email = trimmedEmail ?? null;
      updates.emailLower = null;
    }
  } else if (path === 'uid') {
    const trimmedUid = typeof value === 'string' ? value.trim() : value;
    if (typeof trimmedUid === 'string') {
      const safeUid = trimmedUid.trim();
      updates.uid = safeUid || null;
    } else if (trimmedUid) {
      updates.uid = String(trimmedUid).trim() || null;
    } else {
      updates.uid = null;
    }
  } else {
    updates[path] = value;
  }

  await updateDoc(ref, updates);
}

// ====== Materiales (Storage + Firestore) ======
export async function uploadMaterial({
  file,
  title,
  category,
  description,
  ownerEmail,
  onProgress,
}) {
  if (!useStorage) {
    throw new Error(
      "Firebase Storage está deshabilitado. Usa addMaterialLink con un URL."
    );
  }
  if (!file) {
    throw new Error("Archivo requerido");
  }
  const st = getStorageInstance();
  if (!st) {
    throw new Error("Firebase Storage no está inicializado");
  }
  const db = getDb();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `materials/${ts}_${safeName}`;
  const ref = storageRef(st, path);

  const task = uploadBytesResumable(ref, file);
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      reject,
      async () => {
        const url = await getDownloadURL(ref);
        const auth = getAuthInstance();
        const docRef = await addDoc(collection(db, "materials"), {
          title,
          category,
          description,
          path,
          url,
          ownerEmail:
            ownerEmail?.toLowerCase() ||
            auth?.currentUser?.email?.toLowerCase() ||
            null,
          createdAt: serverTimestamp(),
          downloads: 0,
        });
        resolve({ id: docRef.id, title, category, description, path, url });
      }
    );
  });
}

export async function addMaterialLink({
  title,
  category,
  description,
  url,
  ownerEmail,
}) {
  const db = getDb();
  const auth = getAuthInstance();
  const docRef = await addDoc(collection(db, "materials"), {
    title,
    category,
    description,
    url,
    path: null,
    ownerEmail:
      ownerEmail?.toLowerCase() ||
      auth?.currentUser?.email?.toLowerCase() ||
      null,
    createdAt: serverTimestamp(),
    downloads: 0,
  });
  return { id: docRef.id, title, category, description, url };
}

export async function uploadMaterialToDrive({
  file,
  title,
  category,
  description,
  ownerEmail,
  folderId = driveFolderId,
  onProgress,
}) {
  if (!file) throw new Error("Archivo requerido");
  const token = await getDriveAccessTokenInteractive();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const metadata = {
    name: safeName,
    parents: folderId ? [folderId] : undefined,
    description: description || undefined,
  };
  const boundary =
    "-------driveFormBoundary" + Math.random().toString(16).slice(2);
  const delimiter = `--${boundary}\r\n`;
  const closeDelim = `--${boundary}--`;

  const body = new Blob(
    [
      delimiter,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      "\r\n",
      delimiter,
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
      file,
      "\r\n",
      closeDelim,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink";

  const uploadResponse = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader(
      "Content-Type",
      `multipart/related; boundary=${boundary}`
    );
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      };
    }
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({});
          }
        } else {
          reject(
            new Error(
              "Error subiendo a Drive (" + xhr.status + "): " + xhr.responseText
            )
          );
        }
      }
    };
    xhr.send(body);
  });

  const id = uploadResponse?.id;
  let url =
    uploadResponse?.webViewLink ||
    uploadResponse?.webContentLink ||
    (id ? `https://drive.google.com/file/d/${id}/view?usp=sharing` : null);

  // Intentar hacer el archivo accesible con enlace
  if (id) {
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
      );
    } catch (_) {}
  }

  const db = getDb();
  const auth = getAuthInstance();
  const docRef = await addDoc(collection(db, "materials"), {
    title,
    category,
    description,
    url,
    path: null,
    ownerEmail:
      ownerEmail?.toLowerCase() ||
      auth?.currentUser?.email?.toLowerCase() ||
      null,
    createdAt: serverTimestamp(),
    downloads: 0,
  });
  return { id: docRef.id, title, category, description, url };
}

export function subscribeMaterials(cb) {
  const db = getDb();
  const q = query(collection(db, "materials"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({ id: docSnap.id, ...d });
    });
    cb(items);
  });
}

export async function deleteMaterialById(id) {
  const db = getDb();
  const refDoc = doc(collection(db, "materials"), id);
  const snap = await getDoc(refDoc);
  if (snap.exists()) {
    const data = snap.data();
    if (useStorage && data.path) {
      try {
        const st = getStorageInstance();
        if (st) {
          const ref = storageRef(st, data.path);
          await deleteObject(ref).catch(() => {});
        }
      } catch (_) {}
    }
  }
  await deleteDoc(refDoc);
}

export async function incrementMaterialDownloads(id) {
  const db = getDb();
  const refDoc = doc(collection(db, "materials"), id);
  await updateDoc(refDoc, { downloads: increment(1) });
}

// ====== Grades range fetch by updatedAt ======
export async function fetchGradesByDateRange(startISO, endISO) {
  const db = getDb();
  const start = new Date(startISO);
  const end = new Date(endISO);
  // Ensure end includes the full day
  end.setHours(23, 59, 59, 999);
  const qy = query(
    collection(db, "grades"),
    where("updatedAt", ">=", start),
    where("updatedAt", "<=", end),
    orderBy("updatedAt", "asc")
  );
  const snap = await getDocs(qy);
  const items = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    items.push({ id: docSnap.id, ...d });
  });
  return items;
}

// ====== Foro (Topics + Replies) ======
// Collection: forum_topics (doc fields: title, category, content, authorName, authorEmail, createdAt, updatedAt)
// Subcollection per topic: forum_topics/{topicId}/replies (doc fields: text, authorName, authorEmail, createdAt)

export function subscribeForumTopics(cb, onError) {
  const db = getDb();
  const qy = query(
    collection(db, "forum_topics"),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(
    qy,
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({ id: docSnap.id, ...d });
      });
      cb(items);
    },
    (err) => {
      if (onError)
        try {
          onError(err);
        } catch (_) {}
    }
  );
}

export async function createForumTopic({
  title,
  category,
  content,
  authorName,
  authorEmail,
}) {
  const db = getDb();
  if (!title || !content) throw new Error("T�tulo y contenido son requeridos");
  const docRef = await addDoc(collection(db, "forum_topics"), {
    title,
    category: category || "General",
    content,
    authorName: authorName || null,
    authorEmail: authorEmail || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    repliesCount: 0,
    lastReplyId: null,
    lastReplyText: null,
    lastReplyAuthorName: null,
    lastReplyAuthorEmail: null,
    lastReplyParentId: null,
    lastReplyCreatedAt: null,
  });
  return { id: docRef.id };
}

export async function updateForumTopic(topicId, updates) {
  const db = getDb();
  const ref = doc(collection(db, "forum_topics"), topicId);
  const payload = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
}

export async function deleteForumTopic(topicId) {
  const db = getDb();
  // Delete replies first (best-effort)
  try {
    const repliesCol = collection(db, "forum_topics", topicId, "replies");
    const snap = await getDocs(repliesCol);
    const dels = [];
    snap.forEach((r) => dels.push(deleteDoc(r.ref)));
    await Promise.allSettled(dels);
  } catch (_) {}
  // Then delete topic
  const ref = doc(collection(db, "forum_topics"), topicId);
  await deleteDoc(ref);
}

export function subscribeForumReplies(topicId, cb) {
  const db = getDb();
  const repliesCol = collection(db, "forum_topics", topicId, "replies");
  const qy = query(repliesCol, orderBy("createdAt", "asc"));
  return onSnapshot(qy, (snap) => {
    const items = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({ id: docSnap.id, ...d });
    });
    cb(items);
  });
}

export async function fetchForumRepliesCount(topicId) {
  if (!topicId) return 0;
  const db = getDb();
  try {
    const repliesCol = collection(db, "forum_topics", topicId, "replies");
    const snapshot = await getCountFromServer(repliesCol);
    const data = snapshot?.data ? snapshot.data() : null;
    const rawCount = data && typeof data.count !== "undefined" ? data.count : snapshot.count;
    const numeric = Number(rawCount);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.trunc(numeric));
  } catch (error) {
    console.error("fetchForumRepliesCount:error", error);
    return null;
  }
}

export async function addForumReply(
  topicId,
  { text, authorName, authorEmail, parentId = null }
) {
  const db = getDb();
  if (!topicId) throw new Error("topicId requerido");
  if (!text || !text.trim()) throw new Error("Texto requerido");
  const trimmedText = text.trim();
  const repliesCol = collection(db, "forum_topics", topicId, "replies");
  const replyRef = await addDoc(repliesCol, {
    text: trimmedText,
    authorName: authorName || null,
    authorEmail: authorEmail || null,
    createdAt: serverTimestamp(),

    parentId: parentId || null,

    reactions: {
      like: 0,
    },
    reactionUsers: {
      like: {},
    },
  });
  try {
    const topicRef = doc(collection(db, "forum_topics"), topicId);
    await updateDoc(topicRef, {
      repliesCount: increment(1),
      updatedAt: serverTimestamp(),
      lastReplyId: replyRef.id,
      lastReplyText: trimmedText,
      lastReplyAuthorName: authorName || null,
      lastReplyAuthorEmail: authorEmail || null,
      lastReplyParentId: parentId || null,
      lastReplyCreatedAt: serverTimestamp(),
      lastReplyReactions: {
        like: 0,
      },
      lastReplyReactionUsers: {
        like: {},
      },
    });
  } catch (_) {}

  return { id: replyRef.id };
}

async function refreshTopicLastReply(topicId) {
  if (!topicId) return;
  const db = getDb();
  try {
    const topicRef = doc(collection(db, "forum_topics"), topicId);
    const repliesCol = collection(db, "forum_topics", topicId, "replies");
    const latestQuery = query(
      repliesCol,
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const latestSnap = await getDocs(latestQuery);
    if (latestSnap.empty) {
      await updateDoc(topicRef, {
        lastReplyId: null,
        lastReplyText: null,
        lastReplyAuthorName: null,
        lastReplyAuthorEmail: null,
        lastReplyParentId: null,
        lastReplyCreatedAt: null,
        lastReplyReactions: null,
        lastReplyReactionUsers: null,
      });
      return;
    }
    const latestDoc = latestSnap.docs[0];
    const latestData = latestDoc.data() || {};
    await updateDoc(topicRef, {
      lastReplyId: latestDoc.id,
      lastReplyText: latestData.text || null,
      lastReplyAuthorName: latestData.authorName || null,
      lastReplyAuthorEmail: latestData.authorEmail || null,
      lastReplyParentId: latestData.parentId || null,
      lastReplyCreatedAt: latestData.createdAt || null,
      lastReplyReactions: latestData.reactions || null,
      lastReplyReactionUsers: latestData.reactionUsers || null,
    });
  } catch (_) {}
}

export async function deleteForumReply(topicId, replyId) {
  const db = getDb();
  if (!topicId || !replyId) throw new Error("topicId y replyId requeridos");
  const ref = doc(collection(db, "forum_topics", topicId, "replies"), replyId);
  await deleteDoc(ref);
  try {
    const topicRef = doc(collection(db, "forum_topics"), topicId);
    await updateDoc(topicRef, {
      repliesCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (_) {}
  try {
    const repliesCol = collection(db, "forum_topics", topicId, "replies");
    const childrenQuery = query(repliesCol, where("parentId", "==", replyId));
    const childrenSnap = await getDocs(childrenQuery);
    const deletions = [];
    childrenSnap.forEach((childDoc) => {
      deletions.push(deleteForumReply(topicId, childDoc.id));
    });
    if (deletions.length) {
      await Promise.allSettled(deletions);
    }
  } catch (_) {}
  try {
    await refreshTopicLastReply(topicId);
  } catch (_) {}
}

export async function registerForumReplyReaction(
  topicId,
  replyId,
  reaction = "like",
  reactor = null
) {

  const db = getDb();
  if (!topicId || !replyId) {
    throw new Error("topicId y replyId requeridos");
  }
  if (!reaction) {
    throw new Error("Tipo de reacción requerido");
  }
  const ref = doc(collection(db, "forum_topics", topicId, "replies"), replyId);
  const fieldPath = `reactions.${reaction}`;
  const updates = {
    [fieldPath]: increment(1),
  };

  if (reactor && typeof reactor === "object") {
    const keyCandidate = sanitizeFirestoreKey(reactor.uid || reactor.email || "");
    if (keyCandidate) {
      const userField = `reactionUsers.${reaction}.${keyCandidate}`;
      updates[userField] = {
        uid: reactor.uid || null,
        email: reactor.email || null,
        name: reactor.name || null,
        reactedAt: serverTimestamp(),
      };
    }
  }

  await updateDoc(ref, updates);
}

export function subscribeLatestForumReplies(limitOrOptions, onChange, onError) {
  const db = getDb();
  let max = 25;
  if (typeof limitOrOptions === "number" && Number.isFinite(limitOrOptions)) {
    max = Math.max(1, Math.min(100, Math.trunc(limitOrOptions)));
  } else if (limitOrOptions && typeof limitOrOptions === "object") {
    const candidate = Number(limitOrOptions.limit);
    if (Number.isFinite(candidate) && candidate > 0) {
      max = Math.max(1, Math.min(100, Math.trunc(candidate)));
    }
  }

  const topicsCol = collection(db, "forum_topics");
  const qy = query(
    topicsCol,
    orderBy("lastReplyCreatedAt", "desc"),
    orderBy("updatedAt", "desc"),
    limit(max)
  );

  return onSnapshot(
    qy,
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const lastReplyId = data.lastReplyId || data.lastReply?.id || null;
        const createdAt =
          data.lastReplyCreatedAt || data.lastReply?.createdAt || null;
        if (!lastReplyId || !createdAt) {
          return;
        }
        const replyText = data.lastReplyText ?? data.lastReply?.text ?? "";
        const authorName =
          data.lastReplyAuthorName ?? data.lastReply?.authorName ?? null;
        const authorEmail =
          data.lastReplyAuthorEmail ?? data.lastReply?.authorEmail ?? null;
        const parentId =
          data.lastReplyParentId ?? data.lastReply?.parentId ?? null;
        const reactions =
          data.lastReplyReactions ?? data.lastReply?.reactions ?? null;
        const reactionUsers =
          data.lastReplyReactionUsers ?? data.lastReply?.reactionUsers ?? null;

        const payload = {
          id: lastReplyId,
          topicId: docSnap.id,
          topicPath: docSnap.ref.path,
          createdAt,
          text: typeof replyText === "string" ? replyText : "",
          authorName: authorName || null,
          authorEmail: authorEmail || null,
        };

        if (parentId) {
          payload.parentId = parentId;
        }

        if (reactions && typeof reactions === "object") {
          payload.reactions = reactions;
        }

        if (reactionUsers && typeof reactionUsers === "object") {
          payload.reactionUsers = reactionUsers;
        }

        items.push(payload);
      });
      if (typeof onChange === "function") {
        onChange(items);
      }
    },
    (error) => {

      if (isPermissionDenied(error)) {
        console.warn("subscribeLatestForumReplies:permission-denied", error);
      } else {
        console.error("subscribeLatestForumReplies:error", error);
      }

      if (typeof onError === "function") {
        try {
          onError(error);
        } catch (_) {}
      }
    }
  );
}

export async function fetchForumTopicSummary(topicId) {
  if (!topicId) return null;
  const db = getDb();
  try {
    const ref = doc(collection(db, "forum_topics"), topicId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return { id: snap.id, ...data };
  } catch (error) {
    console.error("fetchForumTopicSummary:error", error);
    return null;
  }
}

export async function fetchForumReply(topicId, replyId) {
  if (!topicId || !replyId) return null;
  const db = getDb();
  try {
    const ref = doc(collection(db, "forum_topics", topicId, "replies"), replyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return { id: snap.id, ...data };
  } catch (error) {
    console.error("fetchForumReply:error", error);
    return null;
  }
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
    lastModified: serverTimestamp() 
  };
  return setDoc(planRef, dataToSave, { merge: true }); // merge:true es útil si quieres actualizar sin sobreescribir todo
}



export { app };
