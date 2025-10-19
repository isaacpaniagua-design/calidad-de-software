import { initFirebase, getDb, getStorageInstance } from "./firebase.js";
import { notifyTeacherAboutStudentUpload } from "./email-notifications.js";
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
    if (!uploadId) return;
    const resolvedGrade = clampGrade(options.grade);
    const profile = buildStudentProfile(
        options.upload?.student || {},
        options.student || {},
        options.rosterStudent || {}
    );
    const docId = getPrimaryDocId(profile);
    if (!docId) return;
    const targetGroupId = sanitizeGroupId(options.groupId);
    const calificacionesRef = doc(db, "grupos", targetGroupId, "calificaciones", docId);

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
    const maxPoints = extractMaxPoints(options.upload);
    const newItem = {
        key: itemKey,
        nombre: resolveItemNombre(options.upload),
        tipo: resolveItemTipo(options.upload),
        unidad: extractUnidad(options.upload),
        ponderacion: extractPonderacion(options.upload, options.rosterStudent, options.deliverable),
        maxPuntos: Number(maxPoints.toFixed(3)),
        puntos: Number(resolvedGrade.toFixed(3)),
        rawPuntos: Number(resolvedGrade.toFixed(2)),
        rawMaxPuntos: Number(maxPoints.toFixed(3)),
        fecha: serverTimestamp(),
        fuente: "student-upload",
        uploadId,
    };
    if (options.feedback) newItem.feedback = String(options.feedback).trim();
    if (options.upload?.fileUrl) newItem.evidenciaUrl = options.upload.fileUrl;
    if (options.upload?.title) newItem.referencia = options.upload.title;
    
    if (options.teacherInfo && typeof options.teacherInfo === "object") {
        const reviewer = options.teacherInfo.displayName || options.teacherInfo.email || options.teacherInfo.uid || "";
        if (reviewer) newItem.calificadoPor = reviewer;
    }

    let updated = false;
    for (let i = 0; i < existingItems.length; i++) {
        if (existingItems[i] && existingItems[i].key === itemKey) {
            existingItems[i] = { ...existingItems[i], ...newItem };
            updated = true;
            break;
        }
    }
    if (!updated) {
        existingItems.push(newItem);
    }
    
    const payload = {
        items: existingItems,
        studentId: profile.studentId || profile.id || existingData.studentId || null,
        studentName: profile.name || profile.displayName || existingData.studentName || null,
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
  } else {
    console.error(`${context}:error`, error);
  }
}

function resolveUploadStorageInfo(upload = {}) {
  const extra = upload && typeof upload === "object" ? upload.extra || {} : {};
  const storagePath = extra.storagePath || extra.path || upload.storagePath || upload.path || null;
  const backend = extra.uploadBackend || extra.backend || upload.uploadBackend || upload.backend || null;
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

// --- FUNCIONES PÚBLICAS (SIN 'export' INDIVIDUAL) ---

async function createStudentUpload(payload = {}) {
  if (!payload.student || !payload.student.uid) {
    throw new Error("Falta el identificador del estudiante");
  }

  const emailRaw = payload.student.email ? String(payload.student.email).trim() : "";
  const emailLower = emailRaw ? emailRaw.toLowerCase() : "";

  const submission = {
    title: (payload.title || "").trim() || "Entrega sin título",
    description: (payload.description || "").trim(),
    kind: (payload.kind || "activity").trim(),
    fileUrl: payload.fileUrl || "",
    fileName: payload.fileName || "",
    fileSize: typeof payload.fileSize === "number" && !Number.isNaN(payload.fileSize) ? payload.fileSize : null,
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

  if (payload.extra && typeof payload.extra === "object") {
    submission.extra = { ...payload.extra };
  }

  const ref = await addDoc(uploadsCollection, submission);
  notifyTeacherAboutStudentUpload({ submissionId: ref.id, submission }).catch(
    (error) => console.warn("[student-uploads] notifyTeacherAboutStudentUpload", error)
  );
  return { id: ref.id };
}

function observeStudentUploads(uid, onChange, onError) {
  if (!uid) {
    if (typeof onChange === "function") onChange([]);
    return () => {};
  }
  const q = query(uploadsCollection, where("student.uid", "==", uid), orderBy("submittedAt", "desc"));
  return onSnapshot(q,
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

function observeStudentUploadsByEmail(email, onChange, onError) {
    const raw = typeof email === "string" ? email.trim() : "";
    if (!raw) {
        if (typeof onChange === "function") onChange([]);
        return () => {};
    }

    const q = query(uploadsCollection, where("student.emailLower", "==", raw.toLowerCase()), orderBy("submittedAt", "desc"));

    return onSnapshot(q,
        (snapshot) => {
            const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            if (typeof onChange === "function") onChange(items);
        },
        (error) => {
            logSnapshotError("observeStudentUploadsByEmail", error);
            if (typeof onError === "function") onError(error);
        }
    );
}

function observeAllStudentUploads(onChange, onError) {
  const q = query(uploadsCollection, orderBy("submittedAt", "desc"));
  return onSnapshot(q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
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
  return { uid, email, displayName };
}

async function markStudentUploadAccepted(uploadId, teacher = {}) {
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

async function gradeStudentUpload(uploadId, options = {}) {
  if (!uploadId) throw new Error("Falta el identificador de la entrega");
  const grade = Number(options.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
    throw new Error("La calificación debe ser un número entre 0 y 100");
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

async function deleteStudentUpload(uploadOrId) {
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

// --- FUNCIÓN DE INICIALIZACIÓN ---

function initStudentUploads(user, claims) {
    if (!user || !claims) return;
    
    if (claims.role === 'docente') {
        observeAllStudentUploads(
            (items) => { /* Lógica de UI para el docente */ },
            (error) => { logSnapshotError('init:observeAllStudentUploads', error); }
        );
    } else {
        observeStudentUploads(
            user.uid,
            (items) => { /* Lógica de UI para el estudiante */ },
            (error) => { logSnapshotError('init:observeStudentUploads', error); }
        );
    }
}

// --- BLOQUE ÚNICO DE EXPORTACIÓN ---
export {
  createStudentUpload,
  observeStudentUploads,
  observeStudentUploadsByEmail,
  observeAllStudentUploads,
  markStudentUploadAccepted,
  gradeStudentUpload,
  deleteStudentUpload,
  initStudentUploads
};

/**
 * Obtiene y muestra el historial de entregas del estudiante desde Firestore.
 * @param {string} studentUid - El UID de autenticación del estudiante.
 */
async function displaySubmissionHistory(studentUid) {
    const historyContainer = document.getElementById('submission-history-container');
    if (!historyContainer) {
        console.error("El contenedor del historial de entregas no se encontró en el DOM.");
        return;
    }

    try {
        // Referencia a la colección 'student_uploads'
        const uploadsRef = collection(db, 'student_uploads');

        // Creamos la consulta: buscar documentos donde el campo anidado 'student.uid' coincida.
        // Ordenamos por 'createdAt' en orden descendente para mostrar lo más nuevo primero.
        const q = query(uploadsRef, where("student.uid", "==", studentUid), orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<p class="text-gray-500">Aún no has realizado ninguna entrega.</p>';
            return;
        }

        // Si hay documentos, construimos el HTML
        let historyHtml = '<ul class="divide-y divide-gray-200">';
        querySnapshot.forEach((doc) => {
            const upload = doc.data();
            // El timestamp se llama 'createdAt' en tu colección
            const submissionDate = upload.createdAt?.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) || 'Fecha no disponible';

            historyHtml += `
                <li class="py-3 sm:py-4">
                    <div class="flex items-center space-x-4">
                        <div class="flex-shrink-0">
                            <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">
                                ${upload.fileName || 'Nombre de archivo no disponible'}
                            </p>
                            <p class="text-sm text-gray-500 truncate">
                                Entregado: ${submissionDate}
                            </p>
                        </div>
                        <div class="inline-flex items-center text-base font-semibold text-gray-900">
                            <a href="${upload.fileUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                                Ver Archivo
                            </a>
                        </div>
                    </div>
                </li>
            `;
        });
        historyHtml += '</ul>';

        historyContainer.innerHTML = historyHtml;

    } catch (error) {
        console.error("Error al obtener el historial de entregas:", error);
        historyContainer.innerHTML = '<p class="text-red-600">No se pudo cargar el historial. Intenta recargar la página.</p>';
    }
}
