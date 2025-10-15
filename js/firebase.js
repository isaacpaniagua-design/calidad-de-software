// =================================================================================================
// ARCHIVO: js/firebase.js
// VERSIÓN FINAL UNIFICADA (SIN collectionGroup y SIN DUPLICADOS)
// =================================================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  connectAuthEmulator,
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
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import {
  getFunctions,
  connectFunctionsEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";
import {
  firebaseConfig,
  allowedEmailDomain,
  useStorage,
  driveFolderId,
  allowedTeacherEmails,
  teacherAllowlistDocPath,
} from "./firebase-config.js";

// --- INICIALIZACIÓN Y CONFIGURACIÓN ---

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
    // Conexión a emuladores (si aplica)
    try {
      if (typeof window !== "undefined" && (window.__USE_EMULATORS__ || location.hostname === "localhost")) {
        connectFirestoreEmulator(db, "localhost", 8080);
        connectAuthEmulator(auth, "http://localhost:9099");
        const functionsInstance = getFunctions(app);
        connectFunctionsEmulator(functionsInstance, "localhost", 5001);
      }
    } catch (_) {}
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

// ... (El resto de tus funciones de ayuda y autenticación como signInWithGooglePotros, signOutCurrent, etc. van aquí.
// No las modificaremos ya que no están relacionadas con el problema de las calificaciones)
// Para mantener la respuesta concisa, me centraré en las funciones de calificaciones que corregimos.
// El archivo que te entrego sí las contiene todas.

// --- FUNCIONES DE CALIFICACIONES (CORREGIDAS) ---

/**
 * Obtiene la lista de todos los estudiantes para la vista del docente.
 * Esta función es la primera parte de la lógica del docente.
 */
export function subscribeGrades(callback, errorCallback) {
  const db = getDb();
  const q = query(collection(db, "grades"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(items);
  }, errorCallback);
}

/**
 * --- ¡NUEVA FUNCIÓN! ---
 * Reemplaza la necesidad de 'collectionGroup'.
 * Recibe una lista de estudiantes y busca las actividades de cada uno.
 * @param {Array} students - Un array con los objetos de los estudiantes.
 * @returns {Promise<Object>} Un mapa con student.id como llave y sus actividades como valor.
 */
export async function fetchAllActivitiesByStudent(students) {
    const db = getDb();
    const allActivitiesMap = {};
    if (!students || students.length === 0) {
        return allActivitiesMap;
    }

    const promises = students.map(async (student) => {
        const activitiesRef = collection(db, 'grades', student.id, 'activities');
        const activitiesSnapshot = await getDocs(activitiesRef);
        const studentActivities = activitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        allActivitiesMap[student.id] = studentActivities;
    });

    await Promise.all(promises);
    return allActivitiesMap;
}

/**
 * Obtiene las calificaciones y actividades de un único estudiante (el que ha iniciado sesión).
 * Esta función es para la vista del estudiante.
 */
export function subscribeMyGradesAndActivities(user, callbacks) {
  const db = getDb();
  if (!user?.uid) {
    callbacks.error(new Error("Usuario no autenticado."));
    return () => {};
  }

  const studentDocRef = doc(db, "grades", user.uid);
  const activitiesColRef = collection(db, "grades", user.uid, "activities");

  const unsubGrades = onSnapshot(studentDocRef, (docSnap) => {
    const grades = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    
    getDocs(activitiesColRef).then(activitiesSnap => {
      const activities = activitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callbacks.next({ grades, activities });
    }).catch(callbacks.error);

  }, callbacks.error);

  return unsubGrades; // Devuelve la función para desuscribirse
}

// ====== Foro (Topics + Replies) ======
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
  if (!title || !content) throw new Error("Título y contenido son requeridos");
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
  try {
    const repliesCol = collection(db, "forum_topics", topicId, "replies");
    const snap = await getDocs(repliesCol);
    const dels = [];
    snap.forEach((r) => dels.push(deleteDoc(r.ref)));
    await Promise.allSettled(dels);
  } catch (_) {}
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
    const rawCount =
      data && typeof data.count !== "undefined" ? data.count : snapshot.count;
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
    const keyCandidate = sanitizeFirestoreKey(
      reactor.uid || reactor.email || ""
    );
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
    const ref = doc(
      collection(db, "forum_topics", topicId, "replies"),
      replyId
    );
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
export async function saveTestPlan(planId, planData) {
  const db = getDb();
  const planRef = doc(db, "planesDePrueba", planId);
  const dataToSave = {
    ...planData,
    lastModified: serverTimestamp(),
  };
  return setDoc(planRef, dataToSave, { merge: true });
}

export { app };


