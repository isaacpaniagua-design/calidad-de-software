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

const baseTeacherEmails = Array.isArray(allowedTeacherEmails)
  ? allowedTeacherEmails.map(normalizeEmail).filter(Boolean)
  : [];

const teacherAllowlistSet = new Set(baseTeacherEmails);
let teacherAllowlistLoaded = false;
let teacherAllowlistPromise = null;

async function fetchTeacherAllowlistFromFirestore() {
  const segments = (teacherAllowlistDocPath || "").split("/").filter(Boolean);
  if (segments.length < 2) return [];
  const db = getDb();
  const ref = doc(db, ...segments);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const raw = Array.isArray(data.emails) ? data.emails : [];
  return raw.map(normalizeEmail).filter(Boolean);
}

async function ensureTeacherAllowlistLoaded() {
  if (teacherAllowlistLoaded) return teacherAllowlistSet;
  if (!teacherAllowlistPromise) {
    teacherAllowlistPromise = (async () => {
      try {
        const dynamicEmails = await fetchTeacherAllowlistFromFirestore();
        dynamicEmails.forEach((email) => teacherAllowlistSet.add(email));
      } catch (error) {
        if (!isPermissionDenied(error)) {
          console.warn("No se pudo cargar la lista dinámica de docentes:", error);
        }
      } finally {
        teacherAllowlistLoaded = true;
      }
      return teacherAllowlistSet;
    })();
  }
  return teacherAllowlistPromise;
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

  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  try {
    const cred = GoogleAuthProvider.credentialFromResult(result);
    if (cred?.accessToken) driveAccessToken = cred.accessToken;
  } catch (_) {}
  if (!user?.email || !user.email.toLowerCase().endsWith(`@${allowedEmailDomain}`)) {
    await signOut(auth);
    throw new Error(`Solo se permite acceder con cuenta @${allowedEmailDomain}`);
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
    const result = await signInWithPopup(auth, provider);
    const cred = GoogleAuthProvider.credentialFromResult(result);
    driveAccessToken = cred?.accessToken || null;
    if (!driveAccessToken) throw new Error("No se pudo obtener token de Google Drive");
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
  const result = await signInWithPopup(auth, provider);
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
    const lower = (email || "").toLowerCase();
    const db = getDb();
    const ref = doc(collection(db, "teachers"), uid);
    try {
        const snap = await getDoc(ref);
        if (snap.exists()) return true;
        await ensureTeacherAllowlistLoaded();
        if (!isTeacherEmail(lower)) return false;
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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function saveTodayAttendance({ uid, name, email, type, manual = false }) {
    const db = getDb();
    const authInstance = getAuthInstance();
    const currentUser = authInstance?.currentUser || null;
    const normalizedUid = String(uid || "").trim();
    if (!normalizedUid) throw new Error("Identificador de usuario requerido");

    const date = todayKey();
    const attendanceId = `${date}_${normalizedUid}`;
    const ref = doc(collection(db, "attendances"), attendanceId);

    const existing = await getDoc(ref);
    if (existing.exists()) throw new Error("Ya tienes tu asistencia registrada para el dia de hoy");

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Correo electronico requerido");

    const createdByUid = String(currentUser?.uid || normalizedUid).trim();
    if (!createdByUid) throw new Error("Sesion invalida para registrar asistencia");

    const createdByEmail = String(currentUser?.email || normalizedEmail).trim().toLowerCase();
    const normalizedType = String(type || "student").trim();

    await setDoc(ref, {
        uid: normalizedUid,
        name,
        email: normalizedEmail,
        type: normalizedType,
        date,
        manual: !!manual,
        createdByUid: createdByUid,
        createdByEmail,
        timestamp: serverTimestamp(),
    });

    return { id: attendanceId, uid, name, email: normalizedEmail, type, date };
}

function subscribeTodayAttendance(cb, onError) {
  const db = getDb();
  const date = todayKey();
  const q = query(collection(db, "attendances"), where("date", "==", date));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            email: data.email,
            type: data.type,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
        };
    }).sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    cb(items);
  }, onError);
}

function subscribeTodayAttendanceByUser(email, cb, onError) {
  const db = getDb();
  const date = todayKey();
  const q = query(collection(db, "attendances"), where("date", "==", date), where("email", "==", (email || "").toLowerCase()));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            email: data.email,
            type: data.type,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
        };
    }).sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    cb(items);
  }, onError);
}

async function findStudentByEmail(email) {
  if (!email) return null;
  const db = getDb();
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("email", "==", email.toLowerCase()), limit(1));
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const studentDoc = querySnapshot.docs[0];
      return { id: studentDoc.id, data: studentDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error buscando estudiante por email:", error);
    return null;
  }
}

async function fetchAttendancesByDateRange(startDateStr, endDateStr) {
    const db = getDb();
    const qy = query(collection(db, "attendances"), where("date", ">=", startDateStr), where("date", "<=", endDateStr), orderBy("date", "asc"));
    const snap = await getDocs(qy);
    return snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            email: data.email,
            type: data.type,
            date: data.date,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
        };
    });
}

async function fetchAttendancesByDateRangeByUser(email, startDateStr, endDateStr) {
  const lowerEmail = (email || "").toLowerCase();
  const items = await fetchAttendancesByDateRange(startDateStr, endDateStr);
  return items.filter((item) => (item.email || "").toLowerCase() === lowerEmail);
}

function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(docSnap => {
        const d = docSnap.data();
        return { id: docSnap.id, ...d };
    });
    cb(items);
  });
}

function subscribeMyGrades(studentUid, cb, onError) {
  if (!studentUid) {
    if (onError) onError(new Error("UID de estudiante es requerido."));
    return () => {};
  }
  const db = getDb();
  const studentRef = doc(db, "grades", studentUid);
  return onSnapshot(studentRef, (docSnap) => {
    if (docSnap.exists()) {
      cb([{ id: docSnap.id, ...docSnap.data() }]);
    } else {
      cb([]);
    }
  }, (error) => {
    if (onError) onError(error);
  });
}

async function upsertStudentGrades(studentId, payload) {
    const db = getDb();
    const ref = doc(collection(db, "grades"), studentId);
    const existing = await getDoc(ref);
    const base = { ...(payload || {}), updatedAt: serverTimestamp() };
    if (!existing.exists()) base.createdAt = serverTimestamp();
    await setDoc(ref, base, { merge: true });
}

async function updateStudentGradePartial(studentId, path, value) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  await updateDoc(ref, { [path]: value, updatedAt: serverTimestamp() });
}

async function saveTestPlan(planId, planData) {
  const db = getDb();
  const planRef = doc(db, "planesDePrueba", planId);
  const dataToSave = { ...planData, lastModified: serverTimestamp() };
  return setDoc(planRef, dataToSave, { merge: true });
}

function subscribeMyActivities(studentId, cb) {
  if (!studentId) return () => {};
  const db = getDb();
  const activitiesRef = collection(db, 'grades', studentId, 'activities');
  const q = query(activitiesRef, orderBy('unit'));
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cb(activities);
  });
}

// --- BLOQUE DE EXPORTACIÓN ---
export {
  app,
  ensureTeacherAllowlistLoaded,
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
  fetchAttendancesByDateRange,
  fetchAttendancesByDateRangeByUser,
  subscribeGrades,
  subscribeMyGrades,
  upsertStudentGrades,
  updateStudentGradePartial,
  saveTestPlan,
  subscribeMyActivities
};
