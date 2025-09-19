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
  serverTimestamp,
  increment,
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
} from "./firebase-config.js";

let app;
let auth;
let db;
let storage;
let driveAccessToken = null;

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
    const result = await signInWithPopup(auth, provider);
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
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  driveAccessToken = cred?.accessToken || null;
  if (!driveAccessToken)
    throw new Error("No se pudo obtener token de Google Drive");
  return driveAccessToken;
}

export async function signOutCurrent() {
  const auth = getAuthInstance();
  await signOut(auth);
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
  const result = await signInWithPopup(auth, provider);
  return result?.user || null;
}

export function onAuth(cb) {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

// ====== Roles ======
export function isTeacherEmail(email) {
  if (!email) return false;
  const em = (email || "").toLowerCase().trim();
  return (
    Array.isArray(allowedTeacherEmails) &&
    allowedTeacherEmails.map((e) => (e || "").toLowerCase().trim()).includes(em)
  );
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
  if (!isTeacherEmail(lower)) return false;
  const db = getDb();
  const ref = doc(collection(db, "teachers"), uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: lower,
        name: displayName || null,
        createdAt: serverTimestamp(),
      });
    }
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
  const date = todayKey();
  const attendanceId = `${date}_${uid}`; // evita duplicados por dia-usuario
  const ref = doc(collection(db, "attendances"), attendanceId);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error("Ya tienes tu asistencia registrada para el dia de hoy");
  }

  const normalizedEmail = (email || "").toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Correo electronico requerido");
  }

  const createdByUid = currentUser?.uid || uid;
  const createdByEmail = (currentUser?.email || normalizedEmail).toLowerCase();

  await setDoc(ref, {
    uid,
    name,
    email: normalizedEmail,
    type: type || "student",
    date,
    manual: !!manual,
    createdByUid,
    createdByEmail,
    timestamp: serverTimestamp(),
  });

  return { id: attendanceId, uid, name, email: normalizedEmail, type, date };
}

export function subscribeTodayAttendance(cb) {
  const db = getDb();
  const date = todayKey();
  const q = query(
    collection(db, "attendances"),
    where("date", "==", date),
    orderBy("timestamp", "desc")
  );
  return onSnapshot(q, (snap) => {
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
    cb(items);
  });
}

export function subscribeTodayAttendanceByUser(email, cb) {
  const db = getDb();
  const date = todayKey();
  const q = query(
    collection(db, "attendances"),
    where("date", "==", date),
    where("email", "==", (email || "").toLowerCase()),
    orderBy("timestamp", "desc")
  );
  return onSnapshot(q, (snap) => {
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
    cb(items);
  });
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
  const snap = await (
    await import(
      "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"
    )
  ).getDocs(qy);
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
  const db = getDb();
  const qy = query(
    collection(db, "attendances"),
    where("email", "==", (email || "").toLowerCase()),
    where("date", ">=", startDateStr),
    where("date", "<=", endDateStr),
    orderBy("date", "asc")
  );
  const snap = await (
    await import(
      "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"
    )
  ).getDocs(qy);
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

export async function upsertStudentGrades(studentId, payload) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  const existing = await getDoc(ref);
  const base = { ...payload, updatedAt: serverTimestamp() };
  if (!existing.exists()) base.createdAt = serverTimestamp();
  await setDoc(ref, base, { merge: true });
}

export async function updateStudentGradePartial(studentId, path, value) {
  const db = getDb();
  const ref = doc(collection(db, "grades"), studentId);
  await updateDoc(ref, { [path]: value, updatedAt: serverTimestamp() });
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
  const st = getStorageInstance();
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
    ownerEmail: auth?.currentUser?.email?.toLowerCase() || null,
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
    orderBy("updatedAt", "desc"),
    orderBy("createdAt", "desc")
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

export async function addForumReply(
  topicId,
  { text, authorName, authorEmail }
) {
  const db = getDb();
  if (!topicId) throw new Error("topicId requerido");
  if (!text || !text.trim()) throw new Error("Texto requerido");
  const repliesCol = collection(db, "forum_topics", topicId, "replies");
  await addDoc(repliesCol, {
    text: text.trim(),
    authorName: authorName || null,
    authorEmail: authorEmail || null,
    createdAt: serverTimestamp(),
  });
  try {
    const topicRef = doc(collection(db, "forum_topics"), topicId);
    await updateDoc(topicRef, {
      repliesCount: increment(1),
      updatedAt: serverTimestamp(),
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
}
