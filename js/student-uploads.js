import { initFirebase, getDb } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

initFirebase();
const db = getDb();
const uploadsCollection = collection(db, "studentUploads");

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
      email: payload.student.email || "",
      displayName: payload.student.displayName || "",
    },
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.extra && typeof payload.extra === "object") {
    submission.extra = payload.extra;
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
      console.error("observeStudentUploads:error", error);
      if (typeof onError === "function") onError(error);
    }
  );
}
