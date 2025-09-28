import { initFirebase, getDb } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

initFirebase();
const db = getDb();
const uploadsCollection = collection(db, "studentUploads");

function isPermissionDenied(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "permission-denied") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /missing or insufficient permissions/i.test(message);
}

function logSnapshotError(context, error) {
  if (isPermissionDenied(error)) {
    console.warn(`${context}:permission-denied`, error);
  } else {
    console.error(`${context}:error`, error);
  }
}

/**
 * Registra una entrega de estudiante.
 * @param {Object} payload
 * @param {Object} payload.student Información del estudiante autenticado.
 * @param {string} payload.student.uid Identificador del estudiante.
 * @param {string} [payload.student.email]
 * @param {string} [payload.student.displayName]
 * @param {string} payload.title Título de la entrega.
 * @param {string} [payload.description]
 * @param {string} [payload.kind]
 * @param {string} [payload.fileUrl]
 * @param {string} [payload.fileName]
 * @param {number} [payload.fileSize]
 * @param {string} [payload.mimeType]
 * @param {string} [payload.status]
 * @returns {Promise<{id: string}>}
 */
export async function createStudentUpload(payload = {}) {
  if (!payload.student || !payload.student.uid) {
    throw new Error("Falta el identificador del estudiante");
  }

  const emailRaw = payload.student.email ? String(payload.student.email).trim() : "";
  const emailLower = emailRaw ? emailRaw.toLowerCase() : "";

  let extraPayload = null;
  if (payload.extra && typeof payload.extra === "object") {
    extraPayload = { ...payload.extra };
  }

  const submission = {
    title: (payload.title || "").trim() || "Entrega sin título",
    description: (payload.description || "").trim(),
    kind: (payload.kind || "activity").trim(),
    fileUrl: payload.fileUrl || "",
    fileName: payload.fileName || "",
    fileSize:
      typeof payload.fileSize === "number" && !Number.isNaN(payload.fileSize)
        ? payload.fileSize
        : null,
    mimeType: payload.mimeType || "",
    status: payload.status || "enviado",
    student: {
      uid: payload.student.uid,
      email: emailRaw,
      emailLower,
      displayName: payload.student.displayName || "",
    },
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (extraPayload) {
    submission.extra = extraPayload;
  }

  const ref = await addDoc(uploadsCollection, submission);
  return { id: ref.id };
}

/**
 * Observa en tiempo real las entregas del estudiante.
 * @param {string} uid Identificador del estudiante.
 * @param {(items: Array<Object>) => void} onChange Callback con los registros.
 * @param {(error: Error) => void} [onError] Callback de error opcional.
 * @returns {() => void} Función para cancelar la suscripción.
 */
export function observeStudentUploads(uid, onChange, onError) {
  if (!uid) {
    if (typeof onChange === "function") onChange([]);
    return () => {};
  }

  const q = query(
    uploadsCollection,
    where("student.uid", "==", uid),
    orderBy("submittedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (typeof onChange === "function") onChange(items);
    },
    (error) => {
      logSnapshotError("observeStudentUploads", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

export function observeStudentUploadsByEmail(email, onChange, onError) {
  const raw = typeof email === "string" ? email.trim() : "";
  if (!raw) {
    if (typeof onChange === "function") onChange([]);
    return () => {};
  }

  const variants = [];
  const seen = new Set();

  const pushVariant = (field, value) => {
    if (!field || !value) return;
    const key = `${field}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ field, value, key });
  };

  pushVariant("student.email", raw);
  const lower = raw.toLowerCase();
  if (lower) {
    pushVariant("student.email", lower);
    pushVariant("student.emailLower", lower);
  }

  if (!variants.length) {
    if (typeof onChange === "function") onChange([]);
    return () => {};
  }

  const toTimestamp = (input) => {
    if (!input) return 0;
    if (typeof input.toMillis === "function") {
      try {
        return input.toMillis();
      } catch (_) {
        return 0;
      }
    }
    if (typeof input.toDate === "function") {
      try {
        const date = input.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime())
          ? date.getTime()
          : 0;
      } catch (_) {
        return 0;
      }
    }
    const date = input instanceof Date ? input : new Date(input);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  };

  const variantState = new Map();
  const unsubscribers = [];

  const emitCombined = () => {
    const combined = new Map();
    variantState.forEach((map) => {
      map.forEach((value, key) => {
        combined.set(key, value);
      });
    });
    const items = Array.from(combined.values());
    items.sort((a, b) => toTimestamp(b?.submittedAt) - toTimestamp(a?.submittedAt));
    if (typeof onChange === "function") onChange(items);
  };

  const handleError = (error) => {
    logSnapshotError("observeStudentUploadsByEmail", error);
    if (typeof onError === "function") onError(error);
  };

  variants.forEach(({ field, value, key }) => {
    try {
      const q = query(uploadsCollection, where(field, "==", value));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map();
          snapshot.docs.forEach((docSnap) => {
            map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          });
          variantState.set(key, map);
          emitCombined();
        },
        handleError
      );
      unsubscribers.push(unsubscribe);
    } catch (error) {
      handleError(error);
    }
  });

  return () => {
    while (unsubscribers.length) {
      const fn = unsubscribers.pop();
      if (typeof fn === "function") {
        try {
          fn();
        } catch (_) {}
      }
    }
    variantState.clear();
  };
}

/**
 * Observa todas las entregas registradas por los estudiantes.
 * Pensado para la vista de docentes.
 * @param {(items: Array<Object>) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export function observeAllStudentUploads(onChange, onError) {
  const q = query(uploadsCollection, orderBy("submittedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      if (typeof onChange === "function") onChange(items);
    },
    (error) => {
      logSnapshotError("observeAllStudentUploads", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

function buildTeacherInfo(teacher = {}) {
  if (!teacher || typeof teacher !== "object") return null;
  const uid = teacher.uid ? String(teacher.uid).trim() : "";
  const email = teacher.email ? String(teacher.email).trim() : "";
  const displayName = teacher.displayName ? String(teacher.displayName).trim() : "";
  if (!uid && !email && !displayName) return null;
  return {
    uid,
    email,
    displayName,
  };
}

/**
 * Marca una entrega como aceptada por el docente.
 * @param {string} uploadId
 * @param {{uid?: string, email?: string, displayName?: string}} [teacher]
 */
export async function markStudentUploadAccepted(uploadId, teacher = {}) {
  if (!uploadId) throw new Error("Falta el identificador de la entrega");
  const ref = doc(uploadsCollection, uploadId);
  const teacherInfo = buildTeacherInfo(teacher);
  const payload = {
    status: "aceptado",
    acceptedAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (teacherInfo) payload.reviewedBy = teacherInfo;
  await updateDoc(ref, payload);
}

/**
 * Registra o actualiza la calificación de una entrega.
 * @param {string} uploadId
 * @param {{
 *   grade: number,
 *   feedback?: string,
 *   teacher?: {uid?: string, email?: string, displayName?: string},
 * }} options
 */
export async function gradeStudentUpload(uploadId, options = {}) {
  if (!uploadId) throw new Error("Falta el identificador de la entrega");
  const grade = Number(options.grade);
  if (!Number.isFinite(grade)) {
    throw new Error("La calificación debe ser un número");
  }
  if (grade < 0 || grade > 100) {
    throw new Error("La calificación debe estar entre 0 y 100");
  }

  const teacherInfo = buildTeacherInfo(options.teacher);
  const feedback = options.feedback ? String(options.feedback).trim() : "";
  const ref = doc(uploadsCollection, uploadId);
  const payload = {
    status: "calificado",
    grade,
    teacherFeedback: feedback,
    gradedAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (teacherInfo) {
    payload.gradedBy = teacherInfo;
    payload.reviewedBy = teacherInfo;
  }

  await updateDoc(ref, payload);
}
