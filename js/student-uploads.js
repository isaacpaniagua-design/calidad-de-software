import { initFirebase, getDb, getStorageInstance } from "./firebase.js";
import { getPrimaryDocId } from "./calificaciones-helpers.js";
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
  getDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { ref as storageRef, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

initFirebase();
const db = getDb();
const uploadsCollection = collection(db, "studentUploads");

const DEFAULT_GROUP_ID = "calidad-2025";

const KIND_TO_LABEL = {
  activity: "Actividad",
  homework: "Tarea",
  evidence: "Evidencia",
};

function sanitizeGroupId(value) {
  if (!value) return DEFAULT_GROUP_ID;
  const trimmed = String(value).trim();
  return trimmed || DEFAULT_GROUP_ID;
}

function clampGrade(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return num;
}

function extractUnidad(upload = {}) {
  const extra = upload.extra || {};
  const direct =
    extra.unitId ?? extra.unidad ?? upload.unitId ?? upload.unidad ?? null;
  const numeric = Number(direct);
  if (Number.isFinite(numeric)) return numeric;
  const label =
    extra.unitLabel || extra.unidadLabel || upload.unitLabel || upload.title;
  if (label) {
    const match = String(label).match(/([123])/);
    if (match) return Number(match[1]);
  }
  return null;
}

function extractPonderacion(upload = {}, rosterStudent = {}, deliverable = {}) {
  const extra = upload.extra || {};
  const sources = [extra, upload, deliverable, rosterStudent];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source || typeof source !== "object") continue;
    const candidates = [
      source.ponderacion,
      source.weight,
      source.weightPct,
      source.weightPercentage,
      source.peso,
    ];
    for (let j = 0; j < candidates.length; j++) {
      const raw = candidates[j];
      if (raw == null) continue;
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

function extractMaxPoints(upload = {}) {
  const extra = upload.extra || {};
  const candidates = [
    extra.maxPoints,
    extra.maxPuntos,
    upload.maxPoints,
    upload.maxPuntos,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    if (raw == null) continue;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 100;
}

function resolveItemNombre(upload = {}, fallbackTitle = "") {
  const title =
    upload.title ||
    upload.description ||
    (upload.extra && upload.extra.activityTitle) ||
    fallbackTitle;
  const trimmed = title ? String(title).trim() : "";
  return trimmed || "Entrega";
}

function resolveItemTipo(upload = {}) {
  const key = (upload.kind || "").toLowerCase();
  return KIND_TO_LABEL[key] || "Entrega";
}

function buildStudentProfile(uploadStudent = {}, explicit = {}, roster = {}) {
  const profile = {
    uid: "",
    email: "",
    displayName: "",
    name: "",
    matricula: "",
    studentId: "",
    id: "",
  };
  const sources = [explicit, roster, uploadStudent];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source || typeof source !== "object") continue;
    if (!profile.uid && source.uid) profile.uid = String(source.uid).trim();
    const email = source.email || source.studentEmail;
    if (!profile.email && email) profile.email = String(email).trim();
    const matricula = source.matricula || source.studentId || source.id;
    if (!profile.matricula && matricula)
      profile.matricula = String(matricula).trim();
    const name =
      source.displayName || source.nombre || source.name || source.fullName;
    if (!profile.displayName && name)
      profile.displayName = String(name).trim();
    if (!profile.name && name) profile.name = String(name).trim();
  }
  if (!profile.studentId && profile.matricula)
    profile.studentId = profile.matricula;
  if (!profile.id)
    profile.id =
      profile.studentId || profile.matricula || profile.uid || profile.email || "";
  if (!profile.name) profile.name = profile.displayName || "";
  return profile;
}

async function syncUploadGradeWithCalificaciones(uploadId, options = {}) {
  const { upload, student, rosterStudent, grade, feedback, groupId, deliverable } =
    options;
  if (!uploadId) return;
  const resolvedGrade = clampGrade(grade);
  const profile = buildStudentProfile(
    upload?.student || {},
    student || {},
    rosterStudent || {}
  );
  const docId = getPrimaryDocId(profile);
  if (!docId) return;
  const targetGroupId = sanitizeGroupId(groupId);
  const calificacionesRef = doc(
    db,
    "grupos",
    targetGroupId,
    "calificaciones",
    docId
  );

  let existingData = {};
  let existingItems = [];
  try {
    const snapshot = await getDoc(calificacionesRef);
    if (snapshot.exists()) {
      existingData = snapshot.data() || {};
      if (Array.isArray(existingData.items)) {
        existingItems = existingData.items.slice();
      }
    }
  } catch (error) {
    console.error("gradeStudentUpload:calificaciones:getDoc", error);
  }

  const itemKey = `upload-${uploadId}`;
  const maxPoints = extractMaxPoints(upload);
  const puntos = Number(resolvedGrade.toFixed(3));
  const rawPuntos = Number(resolvedGrade.toFixed(2));
  const newItem = {
    key: itemKey,
    nombre: resolveItemNombre(upload),
    tipo: resolveItemTipo(upload),
    unidad: extractUnidad(upload),
    ponderacion: extractPonderacion(upload, rosterStudent, deliverable),
    maxPuntos: Number(maxPoints.toFixed(3)),
    puntos,
    rawPuntos,
    rawMaxPuntos: Number(maxPoints.toFixed(3)),
    fecha: serverTimestamp(),
    fuente: "student-upload",
    uploadId,
  };
  if (feedback) newItem.feedback = String(feedback).trim();
  if (upload?.fileUrl) newItem.evidenciaUrl = upload.fileUrl;
  if (upload?.title) newItem.referencia = upload.title;

  const teacherInfo = options.teacherInfo;
  if (teacherInfo && typeof teacherInfo === "object") {
    const reviewer =
      teacherInfo.displayName || teacherInfo.email || teacherInfo.uid || "";
    if (reviewer) newItem.calificadoPor = reviewer;
  }

  let updated = false;
  for (let i = 0; i < existingItems.length; i++) {
    const item = existingItems[i];
    if (item && item.key === itemKey) {
      existingItems[i] = Object.assign({}, item, newItem);
      updated = true;
      break;
    }
  }
  if (!updated) {
    existingItems.push(newItem);
  }

  const seenKeys = new Set();
  const deduped = [];
  for (let i = 0; i < existingItems.length; i++) {
    const item = existingItems[i];
    if (!item || typeof item !== "object") continue;
    const key = item.key || `idx-${i}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(item);
  }

  const payload = {
    items: deduped,
    studentId:
      profile.studentId || profile.id || existingData.studentId || null,
    studentName:
      profile.name || profile.displayName || existingData.studentName || null,
    studentEmail: profile.email || existingData.studentEmail || null,
    updatedAt: serverTimestamp(),
  };
  if (profile.uid) payload.studentUid = profile.uid;

  try {
    await setDoc(calificacionesRef, payload, { merge: true });
  } catch (error) {
    console.error("gradeStudentUpload:calificaciones:setDoc", error);
  }
}

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
function resolveUploadStorageInfo(upload = {}) {
  const extra = upload && typeof upload === "object" ? upload.extra || {} : {};
  const storagePath =
    extra.storagePath ||
    extra.path ||
    upload.storagePath ||
    upload.path ||
    null;
  const backend =
    extra.uploadBackend ||
    extra.backend ||
    upload.uploadBackend ||
    upload.backend ||
    null;
  return { storagePath: storagePath || null, backend: backend || null };
}

async function deleteUploadAssetIfNeeded(upload) {
  if (!upload || typeof upload !== "object") return false;
  const { storagePath, backend } = resolveUploadStorageInfo(upload);
  if (!storagePath || backend === "uploadcare") return false;
  try {
    const storage = getStorageInstance();
    if (!storage) return false;
    await deleteObject(storageRef(storage, storagePath));
    return true;
  } catch (error) {
    console.warn("deleteStudentUpload:storage", error);
    return false;
  }
}

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

  const pushVariant = (field, value, options = {}) => {
    if (!field || !value) return;
    const key = `${field}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    const variantOptions = {
      orderBySubmittedAt: Boolean(options.orderBySubmittedAt),
    };
    variants.push({ field, value, key, options: variantOptions });
  };

  pushVariant("student.email", raw);
  const lower = raw.toLowerCase();
  if (lower) {
    pushVariant("student.email", lower);
    // Usa el índice compuesto existente studentUploads: student.emailLower, submittedAt, __name__
    pushVariant("student.emailLower", lower, { orderBySubmittedAt: true });
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

  variants.forEach(({ field, value, key, options: variantOptions = {} }) => {
    try {
      const constraints = [where(field, "==", value)];
      if (variantOptions.orderBySubmittedAt) {
        constraints.push(orderBy("submittedAt", "desc"));
      }
      const q = query(uploadsCollection, ...constraints);
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

  try {
    await syncUploadGradeWithCalificaciones(uploadId, {
      upload: options.upload || null,
      student: options.student || null,
      rosterStudent: options.rosterStudent || null,
      grade,
      feedback,
      groupId: options.groupId,
      deliverable: options.deliverable || null,
      teacherInfo,
    });
  } catch (error) {
    console.error("gradeStudentUpload:sync", error);
  }
}

export async function deleteStudentUpload(uploadOrId) {
  const id = typeof uploadOrId === "string" ? uploadOrId : uploadOrId?.id;
  if (!id) throw new Error("Falta el identificador de la entrega");
  const ref = doc(uploadsCollection, id);
  let target = uploadOrId && typeof uploadOrId === "object" ? uploadOrId : null;
  if (!target || !target.extra) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        target = { id: snap.id, ...snap.data() };
      }
    } catch (error) {
      console.warn("deleteStudentUpload:getDoc", error);
    }
  }

  try {
    await deleteUploadAssetIfNeeded(target);
  } catch (_) {}

  await deleteDoc(ref);
}
