// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  collectionGroup,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
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
let driveAccessToken = null;

function isPermissionDenied(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "permission-denied") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /missing or insufficient permissions/i.test(message);
}

function initFirebaseInternal() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
}

function getAuthInstance() {
  if (!auth) initFirebaseInternal();
  return auth;
}

function getDb() {
  if (!db) initFirebaseInternal();
  return db;
}

function getStorageInstance() {
  if (!useStorage) return null;
  if (!storage) initFirebaseInternal();
  return storage;
}

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

function isLikelyIdentityNetworkIssue(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "auth/network-request-failed") return true;
  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";
  return /identitytoolkit|network|err_connection/.test(message);
}

function createFriendlyIdentityNetworkError(error) {
  const friendly = new Error(
    "No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet."
  );
  friendly.code = "auth/network-request-failed";
  friendly.cause = error;
  return friendly;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms || 0));
}

async function signInWithPopupSafe(
  authInstance,
  provider,
  { retries = 1 } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await signInWithPopup(authInstance, provider);
    } catch (error) {
      const isNetworkIssue = isLikelyIdentityNetworkIssue(error);
      if (isNetworkIssue && attempt < retries) {
        await wait(400 * (attempt + 1));
        continue;
      }
      if (isNetworkIssue) throw createFriendlyIdentityNetworkError(error);
      throw error;
    }
  }
  throw new Error("No se pudo completar la autenticación.");
}

const baseTeacherEmails = (allowedTeacherEmails || [])
  .map(normalizeEmail)
  .filter(Boolean);
const teacherAllowlistSet = new Set(baseTeacherEmails);
let teacherAllowlistLoaded = false;
let teacherAllowlistPromise = null;

function getTeacherAllowlistPathSegments() {
  return (teacherAllowlistDocPath || "").split("/").filter(Boolean);
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

// --- FUNCIONES PARA EXPORTAR ---

async function ensureTeacherAllowlistLoaded() {
  if (teacherAllowlistLoaded) return teacherAllowlistSet;
  if (!teacherAllowlistPromise) {
    teacherAllowlistPromise = (async () => {
      try {
        const dynamicEmails = await fetchTeacherAllowlistFromFirestore();
        dynamicEmails.forEach((email) => teacherAllowlistSet.add(email));
      } catch (error) {
        if (!isPermissionDenied(error)) {
          console.warn(
            "No se pudo cargar la lista dinámica de docentes:",
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

async function listTeacherNotificationEmails({ domainOnly = true } = {}) {
  await ensureTeacherAllowlistLoaded();
  const normalizedDomain = (allowedEmailDomain || "").trim().toLowerCase();
  const emails = [];
  const seen = new Set();
  teacherAllowlistSet.forEach((email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    if (
      domainOnly &&
      normalizedDomain &&
      !normalized.endsWith(`@${normalizedDomain}`)
    )
      return;
    seen.add(normalized);
    emails.push(normalized);
  });
  return emails;
}

function initFirebase() {
  initFirebaseInternal();
  return { app, auth, db };
}

async function signInWithGooglePotros() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: allowedEmailDomain });
  try {
    provider.addScope("https://www.googleapis.com/auth/drive.file");
  } catch (_) {}

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
}

async function getDriveAccessTokenInteractive() {
  if (driveAccessToken) return driveAccessToken;
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

async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
  driveAccessToken = null;
}

async function signInWithEmailPassword(email, password) {
  const auth = getAuthInstance();
  return signInWithEmailAndPassword(auth, email, password);
}

async function signInWithGoogleOpen() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopupSafe(auth, provider, { retries: 1 });
  return result?.user || null;
}

function onAuth(cb) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

function isTeacherEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return teacherAllowlistSet.has(normalized);
}

async function isTeacherByDoc(uid) {
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

async function ensureTeacherDocForUser({ uid, email, displayName }) {
  if (!uid || !email) return false;
  const db = getDb();
  const ref = doc(collection(db, "teachers"), uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return true;
    await ensureTeacherAllowlistLoaded();
    if (!isTeacherEmail(email)) return false;
    await setDoc(ref, {
      email: normalizeEmail(email),
      name: displayName || null,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (_) {
    return false;
  }
}

function todayKey(date = new Date()) {
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

async function saveTodayAttendance({ uid, name, email, type, manual = false }) {
  const db = getDb();
  const date = todayKey();
  const attendanceId = `${date}_${uid}`;
  const ref = doc(collection(db, "attendances"), attendanceId);
  if ((await getDoc(ref)).exists())
    throw new Error("Ya tienes tu asistencia registrada para hoy");
  await setDoc(ref, {
    uid,
    name,
    email: normalizeEmail(email),
    type: type || "student",
    date,
    manual,
    createdByUid: getAuthInstance().currentUser?.uid || uid,
    createdByEmail: normalizeEmail(
      getAuthInstance().currentUser?.email || email
    ),
    timestamp: serverTimestamp(),
  });
  return { id: attendanceId, uid, name, email, type, date };
}

function subscribeTodayAttendance(cb, onError) {
  const db = getDb();
  const q = query(
    collection(db, "attendances"),
    where("date", "==", todayKey())
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

function subscribeTodayAttendanceByUser(email, cb, onError) {
  const db = getDb();
  const q = query(
    collection(db, "attendances"),
    where("date", "==", todayKey()),
    where("email", "==", normalizeEmail(email))
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

async function findStudentByEmail(email) {
  if (!email) return null;
  const db = getDb();
  const q = query(
    collection(db, "students"),
    where("email", "==", normalizeEmail(email)),
    limit(1)
  );
  try {
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const studentDoc = snap.docs[0];
    return { id: studentDoc.id, data: studentDoc.data() };
  } catch (error) {
    console.error("Error buscando estudiante por email:", error);
    return null;
  }
}

// NUEVA FUNCIÓN (SEGURA)
async function findStudentByUid(uid) {
  if (!uid) return null;
  const db = getDb();
  const q = query(
    collection(db, "students"),
    where("authUid", "==", uid),
    limit(1)
  );
  try {
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const studentDoc = snap.docs[0];
    return { id: studentDoc.id, ...studentDoc.data() };
  } catch (error) {
    console.error("Error buscando estudiante por UID:", error);
    return null;
  }
}

async function fetchAttendancesByDateRange(startDateStr, endDateStr) {
  const db = getDb();
  const q = query(
    collection(db, "attendances"),
    where("date", ">=", startDateStr),
    where("date", "<=", endDateStr),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchAttendancesByDateRangeByUser(
  email,
  startDateStr,
  endDateStr
) {
  const items = await fetchAttendancesByDateRange(startDateStr, endDateStr);
  return items.filter(
    (item) => normalizeEmail(item.email) === normalizeEmail(email)
  );
}

function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

function subscribeMyGrades(studentUid, cb, onError) {
  if (!studentUid) {
    if (onError) onError(new Error("UID de estudiante es requerido."));
    return () => {};
  }
  const db = getDb();
  return onSnapshot(
    doc(db, "grades", studentUid),
    (snap) => {
      cb(snap.exists() ? [{ id: snap.id, ...snap.data() }] : []);
    },
    onError
  );
}

async function upsertStudentGrades(studentId, payload) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  const data = { ...payload, updatedAt: serverTimestamp() };
  if (!(await getDoc(ref)).exists()) data.createdAt = serverTimestamp();
  await setDoc(ref, data, { merge: true });
}

async function updateStudentGradePartial(studentId, path, value) {
  const db = getDb();
  await updateDoc(doc(collection(db, "grades"), studentId), {
    [path]: value,
    updatedAt: serverTimestamp(),
  });
}

async function saveTestPlan(planId, planData) {
  const db = getDb();
  const ref = doc(db, "planesDePrueba", planId);
  await setDoc(
    ref,
    { ...planData, lastModified: serverTimestamp() },
    { merge: true }
  );
}

function subscribeMyActivities(studentId, cb) {
  if (!studentId) return () => {};
  const db = getDb();
  const q = query(
    collection(db, "grades", studentId, "activities"),
    orderBy("unit")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

async function fetchForumTopicSummary(topicId) {
  if (!topicId) return null;
  const db = getDb();
  const ref = doc(db, "forum_topics", topicId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title,
    authorEmail: data.authorEmail,
  };
}

async function fetchForumReply(topicId, replyId) {
  if (!topicId || !replyId) return null;
  const db = getDb();
  const ref = doc(db, "forum_topics", topicId, "replies", replyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
  };
}

function subscribeLatestForumReplies({ limit: queryLimit = 20 }, cb, onError) {
  const db = getDb();
  const q = query(
    collectionGroup(db, "replies"),
    orderBy("createdAt", "desc"),
    limit(queryLimit)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(items);
    },
    onError
  );
}

// --- BLOQUE ÚNICO DE EXPORTACIÓN ---
export {
  app,
  ensureTeacherAllowlistLoaded,
  listTeacherNotificationEmails,
  initFirebase,
  getAuthInstance,
  getDb,
  getStorageInstance,
  signInWithGooglePotros,
  getDriveAccessTokenInteractive,
  signOutCurrent,
  signInWithEmailPassword,
  signInWithGoogleOpen,
  onAuth,
  isTeacherEmail,
  isTeacherByDoc,
  ensureTeacherDocForUser,
  saveTodayAttendance,
  subscribeTodayAttendance,
  subscribeTodayAttendanceByUser,
  findStudentByEmail,
  findStudentByUid, // Exportamos la nueva función segura
  fetchAttendancesByDateRange,
  fetchAttendancesByDateRangeByUser,
  subscribeGrades,
  subscribeMyGrades,
  upsertStudentGrades,
  updateStudentGradePartial,
  saveTestPlan,
  subscribeMyActivities,
  fetchForumTopicSummary,
  fetchForumReply,
  subscribeLatestForumReplies,
  // No se exporta 'app' individualmente al final
};
