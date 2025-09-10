import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { firebaseConfig, allowedEmailDomain } from './firebase-config.js';

let app;
let auth;
let db;
let storage;

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
  if (!storage) initFirebase();
  return storage;
}

export async function signInWithGooglePotros() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  // Sugerencia visual del dominio (no es seguridad)
  provider.setCustomParameters({ hd: allowedEmailDomain });

  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  if (!user?.email || !user.email.toLowerCase().endsWith(`@${allowedEmailDomain}`)) {
    // Si el dominio no es válido, cerramos sesión y rechazamos
    await signOut(auth);
    throw new Error(`Solo se permite acceder con cuenta @${allowedEmailDomain}`);
  }

  return user;
}

export async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
}

export function onAuth(cb) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

function todayKey() {
  // YYYY-MM-DD en hora local
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function saveTodayAttendance({ uid, name, email, type }) {
  const db = getDb();
  const date = todayKey();
  const attendanceId = `${date}_${uid}`; // evita duplicados por día-usuario
  const ref = doc(collection(db, 'attendances'), attendanceId);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error('Ya tienes tu asistencia registrada para el día de hoy');
  }

  await setDoc(ref, {
    uid,
    name,
    email: email.toLowerCase(),
    type: type || 'student',
    date,
    timestamp: serverTimestamp()
  });

  return { id: attendanceId, uid, name, email, type, date };
}

export function subscribeTodayAttendance(cb) {
  const db = getDb();
  const date = todayKey();
  const q = query(
    collection(db, 'attendances'),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      items.push({
        id: docSnap.id,
        name: data.name,
        email: data.email,
        type: data.type,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
      });
    });
    cb(items);
  });
}

export async function fetchAttendancesByDateRange(startDateStr, endDateStr) {
  const db = getDb();
  // startDateStr, endDateStr expected in 'YYYY-MM-DD'
  const qy = query(
    collection(db, 'attendances'),
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr),
    orderBy('date', 'asc')
  );
  const snap = await (await import("https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js")).getDocs(qy);
  const items = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    items.push({
      id: docSnap.id,
      name: data.name,
      email: data.email,
      type: data.type,
      date: data.date,
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
    });
  });
  return items;
}

// ====== Calificaciones (Grades) ======
export function subscribeGrades(cb) {
  const db = getDb();
  const q = query(collection(db, 'grades'), orderBy('name'));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        name: d.name,
        email: d.email,
        unit1: d.unit1 || { participation: 0, assignments: 0, classwork: 0, exam: 0 },
        unit2: d.unit2 || { participation: 0, assignments: 0, classwork: 0, exam: 0 },
        unit3: d.unit3 || { participation: 0, assignments: 0, classwork: 0, exam: 0 },
        projectFinal: d.projectFinal ?? 0
      });
    });
    cb(items);
  });
}

export async function upsertStudentGrades(studentId, payload) {
  const db = getDb();
  const ref = doc(collection(db, 'grades'), studentId);
  const existing = await getDoc(ref);
  const base = { ...payload, updatedAt: serverTimestamp() };
  if (!existing.exists()) base.createdAt = serverTimestamp();
  await setDoc(ref, base, { merge: true });
}

export async function updateStudentGradePartial(studentId, path, value) {
  const db = getDb();
  const ref = doc(collection(db, 'grades'), studentId);
  await updateDoc(ref, { [path]: value, updatedAt: serverTimestamp() });
}

// ====== Materiales (Storage + Firestore) ======
export async function uploadMaterial({ file, title, category, description, ownerEmail, onProgress }) {
  const storage = getStorageInstance();
  const db = getDb();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `materials/${ts}_${safeName}`;
  const ref = storageRef(storage, path);

  const task = uploadBytesResumable(ref, file);
  return new Promise((resolve, reject) => {
    task.on('state_changed', (snap) => {
      const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
      if (onProgress) onProgress(progress);
    }, reject, async () => {
      const url = await getDownloadURL(ref);
      const docRef = await addDoc(collection(db, 'materials'), {
        title, category, description,
        path, url,
        ownerEmail: ownerEmail?.toLowerCase() || null,
        createdAt: serverTimestamp(),
        downloads: 0
      });
      resolve({ id: docRef.id, title, category, description, path, url });
    });
  });
}

export function subscribeMaterials(cb) {
  const db = getDb();
  const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      items.push({ id: docSnap.id, ...d });
    });
    cb(items);
  });
}

export async function deleteMaterialById(id) {
  const db = getDb();
  const st = getStorageInstance();
  const refDoc = doc(collection(db, 'materials'), id);
  const snap = await getDoc(refDoc);
  if (snap.exists()) {
    const data = snap.data();
    if (data.path) {
      const ref = storageRef(st, data.path);
      await deleteObject(ref).catch(() => {});
    }
  }
  await deleteDoc(refDoc);
}

export async function incrementMaterialDownloads(id) {
  const db = getDb();
  const refDoc = doc(collection(db, 'materials'), id);
  await updateDoc(refDoc, { downloads: increment(1) });
}

// ====== Grades range fetch by updatedAt ======
export async function fetchGradesByDateRange(startISO, endISO) {
  const db = getDb();
  const start = new Date(startISO);
  const end = new Date(endISO);
  // Ensure end includes the full day
  end.setHours(23,59,59,999);
  const qy = query(
    collection(db, 'grades'),
    where('updatedAt', '>=', start),
    where('updatedAt', '<=', end),
    orderBy('updatedAt', 'asc')
  );
  const snap = await getDocs(qy);
  const items = [];
  snap.forEach(docSnap => {
    const d = docSnap.data();
    items.push({ id: docSnap.id, ...d });
  });
  return items;
}
