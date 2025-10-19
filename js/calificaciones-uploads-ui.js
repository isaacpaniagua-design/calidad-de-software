import { initFirebase } from "./firebase.js";
import { useStorage } from "./firebase-config.js";
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import {
  createStudentUpload,
  observeStudentUploads,
  observeStudentUploadsByEmail,
  deleteStudentUpload,
} from "./student-uploads.js";
import {
  getActivityById,
  findActivityByTitle,
} from "./course-activities.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// La inicialización de Firebase se mueve al orquestador principal
initializeFileViewer();

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const gradeItemSelector = "#calificaciones-root .grade-item";
const displays = new Map();
const studentUidCache = new Map();
let unsubscribeUploads = null;
let currentProfileKey = null;
let currentStudentProfile = null;
let authUser = null;
let uiReady = false;
let hiddenFileInput = null;
let pendingUploadEntry = null;
let storageAvailabilityChecked = false;
let storageAvailable = false;
let uploadcareAvailabilityChecked = false;
let uploadcareAvailable = false;
let teacherRoleDetected = false;

function isTeacherUploadingForAnotherStudent(profile) {
  if (!teacherRoleDetected) return false;
  if (!profile || !profile.uid) return false;
  if (!authUser || !authUser.uid) return false;
  return profile.uid !== authUser.uid;
}

function elementSignalsTeacherRole(el) {
  if (!el) return false;
  if (el.dataset && el.dataset.role === "teacher") return true;
  if (el.dataset && el.dataset.roleFlag === "teacher") return true;
  if (el.classList && (el.classList.contains("teacher-yes") || el.classList.contains("role-teacher"))) {
    return true;
  }
  return false;
}

function hasVisibleTeacherMarkers() {
  const teacherSelectors = ".teacher-only,.docente-only,[data-role='teacher'],[data-role-flag='teacher']";
  const elements = document.querySelectorAll(teacherSelectors);
  for (const el of elements) {
    if (!el) continue;
    if (elementSignalsTeacherRole(el)) return true;
    if (el.hasAttribute("hidden")) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (el.classList && el.classList.contains("hidden")) continue;
    return true;
  }
  return false;
}

function detectTeacherRoleFromDom() {
  const root = document.documentElement;
  if (elementSignalsTeacherRole(root)) return true;
  if (root?.dataset?.role === "teacher") return true;
  const body = document.body;
  if (elementSignalsTeacherRole(body)) return true;
  if (body?.dataset?.role === "teacher") return true;
  if (hasVisibleTeacherMarkers()) return true;
  try {
    const stored = localStorage.getItem("qs_role");
    if (stored && stored.toLowerCase() === "docente") return true;
  } catch (_) {}
  return false;
}

function updateTeacherRoleFlag() {
  const detected = detectTeacherRoleFromDom();
  if (detected === teacherRoleDetected) return;
  teacherRoleDetected = detected;
  updateUploadButtonsState(currentStudentProfile);
}

const teacherRoleObserver =
  typeof MutationObserver === "function"
    ? new MutationObserver(() => updateTeacherRoleFlag())
    : null;

if (teacherRoleObserver) {
  teacherRoleObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-role", "data-role-flag"],
  });
  const attachBodyObserver = () => {
    const body = document.body;
    if (!body) return;
    teacherRoleObserver.observe(body, {
      attributes: true,
      attributeFilter: ["class", "data-role", "data-role-flag", "hidden", "aria-hidden"],
      subtree: true,
    });
  };
  if (document.body) {
    attachBodyObserver();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        attachBodyObserver();
        updateTeacherRoleFlag();
      },
      { once: true }
    );
  }
} else {
  document.addEventListener("DOMContentLoaded", updateTeacherRoleFlag, {
    once: true,
  });
}

updateTeacherRoleFlag();

function isStorageAvailable() {
  if (!useStorage) return false;
  if (!storageAvailabilityChecked) {
    storageAvailable = Boolean(getStorageInstance());
    storageAvailabilityChecked = true;
  }
  return storageAvailable;
}

function isUploadcareAvailable() {
  if (!uploadcareAvailabilityChecked) {
    uploadcareAvailable =
      typeof uploadcare !== "undefined" &&
      uploadcare !== null &&
      typeof uploadcare.fileFrom === "function";
    uploadcareAvailabilityChecked = true;
  }
  if (!uploadcareAvailable) {
    uploadcareAvailabilityChecked = false;
  }
  return uploadcareAvailable;
}

function isUploadBackendAvailable() {
  return isUploadcareAvailable() || isStorageAvailable();
}

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    uploadcareAvailabilityChecked = false;
    updateUploadButtonsState(currentStudentProfile);
  });
}

function ready() {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") {
    try {
      return value.toMillis();
    } catch (_) {
      return 0;
    }
  }
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
    } catch (_) {
      return 0;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function setStatus(entry, text, { uploaded = false, title = "" } = {}) {
  if (!entry || !entry.statusEl) return;
  entry.statusEl.textContent = text;
  entry.statusEl.title = title;
  entry.statusEl.classList.toggle("upload-status--uploaded", Boolean(uploaded));
}

function updateEntryActions(entry) {
  if (!entry || !entry.deleteButton) return;
  const hasUpload = Boolean(entry.currentUpload && entry.currentUpload.fileUrl);
  const showDelete = teacherRoleDetected && hasUpload;
  entry.deleteButton.classList.toggle("upload-reset--hidden", !showDelete);
  entry.deleteButton.disabled = 
    !showDelete || entry.deletePending || entry.uploading;
  if (showDelete) {
    entry.deleteButton.title = entry.deletePending
      ? "Eliminando evidencia..."
      : "Eliminar la evidencia para esta actividad";
  } else {
    entry.deleteButton.title = "";
  }
}

function disableView(entry) {
  if (!entry || !entry.viewLink) return;
  entry.viewLink.setAttribute("aria-disabled", "true");
  entry.viewLink.removeAttribute("target");
  entry.viewLink.href = "#";
  entry.viewLink.dataset.url = "";
  entry.viewLink.dataset.filename = "";
}

function enableView(entry, url, fileName, title) {
  if (!entry || !entry.viewLink || !url) return;
  entry.viewLink.dataset.url = url;
  entry.viewLink.dataset.filename = fileName || "";
  entry.viewLink.href = url;
  entry.viewLink.target = "_blank";
  entry.viewLink.removeAttribute("aria-disabled");
  entry.viewLink.addEventListener("click", (event) => {
    if (!entry.viewLink.dataset.url) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    openFileViewer(entry.viewLink.dataset.url, {
      title: title || fileName || "Entrega",
      downloadUrl: entry.viewLink.dataset.url,
      fileName: entry.viewLink.dataset.filename || "",
    });
  });
}

function resetViewListener(entry) {
  if (!entry || !entry.viewLink) return;
  const clone = entry.viewLink.cloneNode(true);
  entry.viewLink.replaceWith(clone);
  entry.viewLink = clone;
}

function buildDisplayForItem(item) {
  if (!item || item.querySelector(".grade-actions")) return null;
  const gradeInput = item.querySelector(".grade-input, .project-grade-input");
  const heading = item.querySelector("h1, h2, h3, h4, h5, h6, strong");
  const unitEl = item.closest(".unit-content");
  const title = heading ? heading.textContent.trim() : "";
  const unitId = unitEl?.id || "";
  const activity = findActivityByTitle(title, unitId) || findActivityByTitle(title);

  const actions = document.createElement("div");
  actions.className = "grade-actions";

  if (gradeInput) {
    actions.appendChild(gradeInput);
  }

  const viewWrapper = document.createElement("div");
  viewWrapper.className = "upload-control";

  const buttonsWrapper = document.createElement("div");
  buttonsWrapper.className = "upload-control-buttons";

  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "upload-upload teacher-only";
  uploadButton.textContent = "Subir evidencia";
  uploadButton.disabled = true;
  buttonsWrapper.appendChild(uploadButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "upload-reset teacher-only upload-reset--hidden";
  deleteButton.textContent = "Eliminar evidencia";
  deleteButton.disabled = true;
  buttonsWrapper.appendChild(deleteButton);

  const viewLink = document.createElement("a");
  viewLink.className = "upload-trigger";
  viewLink.href = "#";
  viewLink.setAttribute("aria-disabled", "true");
  viewLink.textContent = "Visualizar entrega";

  buttonsWrapper.appendChild(viewLink);
  viewWrapper.appendChild(buttonsWrapper);


  if (gradeInput) {
    gradeInput.setAttribute("aria-describedby", statusId);
  }

  actions.appendChild(viewWrapper);
  item.appendChild(actions);

  const entry = {
    statusEl: status,
    viewLink,
    uploadButton,
    deleteButton,
    gradeInput,
    activity,
    item,
    statusId,
    title,
    uploading: false,
    deletePending: false,
    currentUpload: null,
  };

  if (!activity) {
    disableView(entry);
    uploadButton.disabled = true;
    uploadButton.title = "Actividad no vinculada";
  } else {
    resetViewListener(entry);
  }

  uploadButton.addEventListener("click", (event) => {
    event.preventDefault();
    handleUploadRequest(entry);
  });

  deleteButton.addEventListener("click", (event) => {
    event.preventDefault();
    handleDeleteRequest(entry);
  });

  updateEntryActions(entry);
  return entry;
}

function ensureDisplays() {
  const items = document.querySelectorAll(gradeItemSelector);
  items.forEach((item) => {
    const entry = buildDisplayForItem(item);
    if (!entry) return;
    const activity = entry.activity;
    if (!activity || !activity.id) {
      return;
    }
    const existing = displays.get(activity.id);
    if (!existing) {
      displays.set(activity.id, entry);
    }
  });
}

function mapUploadsByActivity(items) {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  items.forEach((item) => {
    if (!item) return;
    const baseActivity =
      getActivityById(item?.extra?.activityId) ||
      (item?.extra?.unitId ? findActivityByTitle(item.title, item.extra.unitId) : null) ||
      findActivityByTitle(item.title);
    if (!baseActivity || !baseActivity.id) return;
    const previous = map.get(baseActivity.id);
    if (!previous || toTimestamp(item.submittedAt) >= toTimestamp(previous.submittedAt)) {
      map.set(baseActivity.id, item);
    }
  });
  return map;
}

function updateDisplays(uploadMap) {
  displays.forEach((entry, activityId) => {
    const upload = uploadMap.get(activityId) || null;
    entry.currentUpload = upload || null;
    resetViewListener(entry);
    if (!upload || !upload.fileUrl) {
      entry.deletePending = false;
      disableView(entry);
      const text = entry.activity
        ? "Sin entrega registrada"
        : "Actividad no vinculada";
      setStatus(entry, text, { uploaded: false, title: "" });
      updateEntryActions(entry);
      return;
    }
    enableView(entry, upload.fileUrl, upload.fileName || "", entry.activity?.title || entry.title);
    const submitted = toTimestamp(upload.submittedAt);
    const submittedDate = submitted ? new Date(submitted) : null;
    const parts = [];
    if (upload.fileName) parts.push(upload.fileName);
    if (submittedDate && !Number.isNaN(submittedDate.getTime())) {
      parts.push(dateFormatter.format(submittedDate));
    }
    const statusText = parts.length ? parts.join(" · ") : "Entrega disponible";
    setStatus(entry, statusText, {
      uploaded: true,
      title: upload.fileName || "",
    });
    updateEntryActions(entry);
  });
  updateUploadButtonsState(currentStudentProfile);
}

function setupStudentUploadsView(user) {
    const listContainer = document.getElementById('studentUploadList');
    const countElement = document.querySelector('[data-upload-count]');
    const emptyElement = document.getElementById('studentUploadEmpty');
    const historyButton = document.getElementById('btn-ver-historial');
    const historyModal = document.getElementById('historialModal');
    const mainTitle = document.querySelector('.student-uploads__heading');

    // Ocultar elementos que ya no se usan en la vista de estudiante
    if (historyButton) historyButton.style.display = 'none';
    if (historyModal) historyModal.style.display = 'none';
    if (mainTitle) mainTitle.textContent = 'Historial Completo de Entregas';

    let unsubscribe = null;

    if (user) {
        if (unsubscribe) unsubscribe();
        unsubscribe = observeStudentUploads(
            user.uid,
            (uploads) => renderStudentHistory(uploads, listContainer, countElement, emptyElement),
            (error) => console.error("Error cargando historial de estudiante:", error)
        );
    } else {
        if (unsubscribe) unsubscribe();
        if (listContainer) listContainer.innerHTML = '';
        if (countElement) countElement.textContent = '0';
        if (emptyElement) emptyElement.hidden = false;
    }
}

function renderStudentHistory(uploads, listContainer, countElement, emptyElement) {
    if (!listContainer || !countElement || !emptyElement) return;

    const hasUploads = uploads.length > 0;
    emptyElement.hidden = hasUploads;
    countElement.textContent = uploads.length;

    if (!hasUploads) {
        listContainer.innerHTML = '';
        return;
    }

    const sortedUploads = [...uploads].sort((a, b) => (b.submittedAt?.toDate() || 0) - (a.submittedAt?.toDate() || 0));
    listContainer.innerHTML = sortedUploads.map(item => createStudentUploadItemHTML(item)).join('');
}

function createStudentUploadItemHTML(upload) {
    const submittedDate = upload.submittedAt?.toDate() ? new Date(upload.submittedAt.toDate()).toLocaleString('es-MX') : 'Fecha no disponible';
    const descriptionHTML = upload.description ? `<p class="student-uploads__item-description">${upload.description}</p>` : '';
    const status = upload.status || 'enviado';
    const activityTitle = upload.extra?.activityTitle || upload.title || 'Entrega sin título';
    const fileUrl = upload.fileUrl || '#';

    return `
        <li class="student-uploads__item">
            <div class="student-uploads__item-header">
                <div class="student-uploads__item-heading">
                    <span class="student-uploads__item-title">${activityTitle}</span>
                    <span class="student-uploads__item-chip">${upload.kind || 'Actividad'}</span>
                </div>
                <span class="student-uploads__item-status student-uploads__item-status--${status}">${status}</span>
            </div>
            <p class="student-uploads__item-meta">Enviado: ${submittedDate}</p>
            ${descriptionHTML}
            <div class="student-uploads__item-actions">
                <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="student-uploads__item-link">Ver Archivo en Drive</a>
            </div>
        </li>
    `;
}



function setLoadingState() {
  displays.forEach((entry) => {
    if (!entry.activity || !entry.statusEl) return;
    setStatus(entry, "Buscando entregas…", { uploaded: false, title: "" });
    disableView(entry);
  });
}

function setErrorState() {
  displays.forEach((entry) => {
    if (!entry.activity) return;
    setStatus(entry, "No fue posible cargar la entrega", { uploaded: false, title: "" });
    disableView(entry);
  });
}

function sanitizeFileName(name) {
  return String(name || "evidencia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140) || "evidencia";
}

function getUploadEligibility(profile) {
  if (!authUser) {
    return {
      allowed: false,
      reason: "Inicia sesión para subir evidencias.",
    };
  }
  if (!profile) {
    return {
      allowed: false,
      reason: "Selecciona un estudiante para subir evidencia.",
    };
  }
  if (!profile.uid) {
    return {
      allowed: false,
      reason: "No se pudo resolver el UID del estudiante en Firebase.",
    };
  }

  const sameStudent = profile.uid === authUser.uid;
  const teacherForAnother = isTeacherUploadingForAnotherStudent(profile);

  if (!teacherRoleDetected && !sameStudent) {
    return {
      allowed: false,
      reason:
        "Solo el personal docente puede subir evidencias pendientes para otros estudiantes. Inicia sesión con tu cuenta institucional o solicita permisos docentes.",
    };
  }

  if (teacherForAnother) {
    return {
      allowed: true,
      reason: "Subir evidencia como docente para el estudiante seleccionado.",
    };
  }

  return {
    allowed: true,
    reason: teacherRoleDetected
      ? "Subir evidencia con tu cuenta docente."
      : "Subir evidencia para esta actividad",
  };
}

function updateUploadButtonsState(profile) {
  const backendAvailable = isUploadBackendAvailable();
  displays.forEach((entry) => {
    if (!entry || !entry.uploadButton) return;
    const cannotUploadActivity = !entry.activity || !entry.activity.id;

    const eligibility = getUploadEligibility(profile);
    const disabled =
      entry.uploading ||
      cannotUploadActivity ||
      !backendAvailable ||
      !eligibility.allowed;
    entry.uploadButton.disabled = disabled;

    if (cannotUploadActivity) {
      entry.uploadButton.title = "Actividad no vinculada";
    } else if (!backendAvailable) {
      entry.uploadButton.title =
        "El almacenamiento de evidencias no está disponible.";
    } else if (entry.uploading) {
      entry.uploadButton.title = "Subiendo evidencia…";
    } else {
      entry.uploadButton.title = eligibility.reason;
    }
  });
}

function setCurrentProfile(profile) {
  if (!profile) {
    currentStudentProfile = null;
    updateUploadButtonsState(null);
    return;
  }
  const nameField = document.getElementById("studentName");
  const normalized = {
    uid: profile.uid ? String(profile.uid).trim() : "",
    email: profile.email ? String(profile.email).trim() : "",
    matricula: profile.matricula
      ? String(profile.matricula).trim()
      : profile.id
      ? String(profile.id).trim()
      : "",
    displayName:
      profile.displayName ||
      profile.name ||
      (nameField ? nameField.value.trim() : ""),
    id: profile.id ? String(profile.id).trim() : "",
  };
  currentStudentProfile = normalized;
  updateUploadButtonsState(currentStudentProfile);
}

function ensureFileInput() {
  if (hiddenFileInput) return hiddenFileInput;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "*/*";
  input.style.display = "none";
  input.className = "teacher-only";
  input.addEventListener("change", handleFileInputChange);
  document.body.appendChild(input);
  hiddenFileInput = input;
  return hiddenFileInput;
}

async function uploadEvidenceFile(file, studentUid) {
  const uploadedViaUploadcare = await tryUploadEvidenceWithUploadcare(file);
  if (uploadedViaUploadcare) {
    return uploadedViaUploadcare;
  }

  const storage = getStorageInstance();
  if (!storage) {
    throw new Error("El almacenamiento de evidencias no está disponible.");
  }
  const safeName = sanitizeFileName(file?.name || "evidencia");
  const path = `studentEvidence/${studentUid}/${Date.now()}_${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return { url, path, fileName: safeName, fileSize: file?.size || null, mimeType: file?.type || "" };
}

async function tryUploadEvidenceWithUploadcare(file) {
  if (!file) return null;
  const available = isUploadcareAvailable();
  if (!available) return null;
  try {
    const fileFrom = uploadcare.fileFrom("object", file);
    const info = await new Promise((resolve, reject) => {
      if (!fileFrom || typeof fileFrom.done !== "function") {
        reject(new Error("No se pudo inicializar la carga con Uploadcare."));
        return;
      }
      fileFrom.done(resolve).fail(reject);
    });
    if (!info) {
      throw new Error("Respuesta vacía al cargar el archivo con Uploadcare.");
    }
    const name =
      info.name ||
      info.originalFilename ||
      file.name ||
      info.filename ||
      "evidencia";
    const safeName = sanitizeFileName(name);
    const url = info.cdnUrl || info.originalUrl || "";
    if (!url) {
      throw new Error("Uploadcare no devolvió una URL pública.");
    }
    return {
      url,
      fileName: safeName,
      fileSize: info.size || info.originalFileSize || file.size || null,
      mimeType:
        info.mimeType ||
        (info.contentInfo && info.contentInfo.mime) ||
        file.type ||
        "",
      backend: "uploadcare",
    };
  } catch (error) {
    console.error("[calificaciones-uploads-ui] uploadcare", error);
    return null;
  }
}

async function tryGetDocId(db, id) {
  if (!db || !id) return "";
  try {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? snap.id || "" : "";
  } catch (error) {
    console.warn("[calificaciones-uploads-ui] resolver uid docId", error);
    return "";
  }
}

async function fetchUidFromFirestore(profile) {
  if (!profile) return "";
  const db = getDb();
  if (!db) return "";
  const cacheKey = `${profile.matricula || ""}|${
    (profile.email || "").toLowerCase()
  }`;
  if (cacheKey && studentUidCache.has(cacheKey)) {
    return studentUidCache.get(cacheKey) || "";
  }

  let uid = "";
  const matricula = profile.matricula ? String(profile.matricula).trim() : "";
  if (matricula) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("matricula", "==", matricula),
          limit(1)
        )
      );
      if (!snap.empty) {
        uid = snap.docs[0]?.id || "";
      }
    } catch (error) {
      console.warn("[calificaciones-uploads-ui] resolver uid matricula", error);
    }
  }

  const emailRaw = profile.email ? String(profile.email).trim() : "";
  const emailLower = emailRaw.toLowerCase();
  if (!uid && emailLower) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("emailLower", "==", emailLower),
          limit(1)
        )
      );
      if (!snap.empty) {
        uid = snap.docs[0]?.id || "";
      }
    } catch (error) {
      console.warn("[calificaciones-uploads-ui] resolver uid emailLower", error);
    }
  }

  if (!uid) {
    const profileId = profile.id ? String(profile.id).trim() : "";
    if (profileId) {
      uid = await tryGetDocId(db, profileId);
    }
  }

  if (!uid && profile && profile.uid) {
    uid = profile.uid;
  }

  if (cacheKey && uid) {
    studentUidCache.set(cacheKey, uid);
  }
  return uid || "";
}

async function ensureActiveProfileWithUid() {
  if (!currentStudentProfile) return null;
  if (currentStudentProfile.uid) return currentStudentProfile;
  const uid = await fetchUidFromFirestore(currentStudentProfile);
  if (!uid) return currentStudentProfile;
  currentStudentProfile = Object.assign({}, currentStudentProfile, {
    uid,
  });
  const cacheKey = `${currentStudentProfile.matricula || ""}|${
    (currentStudentProfile.email || "").toLowerCase()
  }`;
  if (cacheKey) {
    studentUidCache.set(cacheKey, uid);
  }
  updateUploadButtonsState(currentStudentProfile);
  return currentStudentProfile;
}

function handleUploadRequest(entry) {
  if (!entry || entry.uploading) return;
  if (!entry.activity || !entry.activity.id) {
    setStatus(entry, "Esta actividad no está vinculada a un registro.", {
      uploaded: false,
      title: "",
    });
    return;
  }
  const eligibility = getUploadEligibility(currentStudentProfile);
  if (!eligibility.allowed) {
    setStatus(entry, eligibility.reason, { uploaded: false, title: "" });
    return;
  }
  if (!isUploadBackendAvailable()) {
    setStatus(entry, "El almacenamiento de evidencias no está disponible.", {
      uploaded: false,
      title: "",
    });
    return;
  }
  const input = ensureFileInput();
  if (!input) {
    setStatus(entry, "La carga de archivos no está disponible.", {
      uploaded: false,
      title: "",
    });
    return;
  }
  pendingUploadEntry = entry;
  input.value = "";
  input.click();
}

async function handleDeleteRequest(entry) {
  if (!entry || entry.deletePending) return;
  if (!teacherRoleDetected) {
    setStatus(entry, "Solo el personal docente puede eliminar evidencias.", {
      uploaded: Boolean(entry.currentUpload && entry.currentUpload.fileUrl),
      title: entry.currentUpload?.fileName || "",
    });
    return;
  }
  const upload = entry.currentUpload;
  if (!upload || !upload.id) {
    setStatus(entry, "No hay evidencia para eliminar.", { uploaded: false, title: "" });
    return;
  }
  const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
    ? window.confirm("¿Eliminar la evidencia registrada para esta actividad?")
    : true;
  if (!confirmed) return;

  entry.deletePending = true;
  updateEntryActions(entry);
  setStatus(entry, "Eliminando evidencia...", { uploaded: false, title: "" });
  try {
    await deleteStudentUpload(upload);
    entry.currentUpload = null;
    disableView(entry);
    setStatus(entry, "Evidencia eliminada. Sincronizando...", { uploaded: false, title: "" });
  } catch (error) {
    console.error("[calificaciones-uploads-ui] eliminar evidencia", error);
    setStatus(entry, error?.message || "No se pudo eliminar la evidencia. Intenta nuevamente.", {
      uploaded: Boolean(upload.fileUrl),
      title: upload.fileName || "",
    });
    entry.currentUpload = upload;
  } finally {
    entry.deletePending = false;
    updateEntryActions(entry);
    updateUploadButtonsState(currentStudentProfile);
  }
}

async function handleFileInputChange(event) {
  const input = event?.target;
  const file = input?.files && input.files[0];
  const entry = pendingUploadEntry;
  pendingUploadEntry = null;
  if (!file || !entry) {
    if (input) input.value = "";
    return;
  }

  entry.uploading = true;
  updateUploadButtonsState(currentStudentProfile);

  try {
    const eligibility = getUploadEligibility(currentStudentProfile);
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason);
    }
    const profile = await ensureActiveProfileWithUid();
    if (!profile || !profile.uid) {
      throw new Error(
        "No se pudo identificar al estudiante seleccionado en la base de datos."
      );
    }

    if (!teacherRoleDetected && profile.uid !== authUser.uid) {
      throw new Error(
        "Las reglas de Firebase impiden subir evidencias para otro estudiante."
      );
    }

    const upload = await uploadEvidenceFile(file, profile.uid);

    const extra = {};
    if (entry.activity?.id) extra.activityId = entry.activity.id;
    if (entry.activity?.unitId) extra.unitId = entry.activity.unitId;
    if (entry.activity?.unitLabel) extra.unitLabel = entry.activity.unitLabel;
    extra.source = "calificaciones-teacher";
    if (upload.backend) extra.uploadBackend = upload.backend;
    if (upload.path) extra.storagePath = upload.path;
    extra.uploadedBy = {
      uid: authUser?.uid || '',
      email: authUser?.email || '',
      displayName: authUser?.displayName || '',
    };

    await createStudentUpload({
      title: entry.activity?.title || entry.title || "Evidencia",
      description: "Archivo registrado manualmente como evidencia complementaria.",
      kind: "evidence",
      fileUrl: upload.url,
      fileName: upload.fileName || file.name || "evidencia",
      fileSize: upload.fileSize || file.size || null,
      mimeType: upload.mimeType || file.type || "",
      extra,
      student: {
        uid: profile.uid,
        email: profile.email || "",
        displayName: profile.displayName || "",
      },
    });

    setStatus(entry, "Evidencia cargada. Sincronizando…", {
      uploaded: false,
      title: "",
    });
  } catch (error) {
    console.error("[calificaciones-uploads-ui] evidencia", error);
    const message =
      error?.message || "No se pudo cargar la evidencia. Intenta nuevamente.";
    setStatus(entry, message, { uploaded: false, title: "" });
  } finally {
    entry.uploading = false;
    updateUploadButtonsState(currentStudentProfile);
    if (hiddenFileInput) hiddenFileInput.value = "";
  }
}

function subscribeToProfile(profile) {
  setCurrentProfile(profile);
  if (!uiReady) return;
  const key = profile
    ? `${profile.uid || ""}|${(profile.email || "").toLowerCase()}`
    : "__none__";
  if (key === currentProfileKey) {
    updateUploadButtonsState(currentStudentProfile);
    return;
  }
  currentProfileKey = key;
  if (typeof unsubscribeUploads === "function") {
    try {
      unsubscribeUploads();
    } catch (_) {}
    unsubscribeUploads = null;
  }

  if (!profile || (!profile.uid && !profile.email)) {
    updateDisplays(new Map());
    return;
  }

  setLoadingState();

  const onChange = (items) => {
    updateDisplays(mapUploadsByActivity(items));
  };

  const onError = () => {
    setErrorState();
  };

  if (profile.uid) {
    unsubscribeUploads = observeStudentUploads(profile.uid, onChange, onError);
  } else if (profile.email) {
    unsubscribeUploads = observeStudentUploadsByEmail(profile.email, onChange, onError);
  }
}

function getSelectedStudentProfile() {
  const select = document.getElementById("studentSelect");
  if (!select || !select.value) return null;
  const option = select.selectedOptions && select.selectedOptions[0];
  const value = select.value;
  const email = option?.dataset?.email || option?.getAttribute("data-email") || "";
  const uid = option?.dataset?.uid || option?.getAttribute("data-uid") || "";
  const nameAttr = option?.dataset?.name || option?.getAttribute("data-name") || "";
  const matriculaAttr =
    option?.dataset?.matricula || option?.getAttribute("data-matricula") || value || "";
  
  const profile = {
    uid: uid,
    email: email,
    displayName: nameAttr || (option ? option.textContent.split(' - ')[1] : ''),
    matricula: matriculaAttr,
    id: value,
  };

  if (profile.uid || profile.email || profile.matricula) return profile;
  return null;
}


function handleStudentSelection() {
  const profile = getSelectedStudentProfile();
  if (profile) {
    subscribeToProfile(profile);
  } else if (authUser) {
    subscribeToProfile({ uid: authUser.uid, email: authUser.email || "" });
  } else {
    subscribeToProfile(null);
  }
}

async function main() {
  if (uiReady) return;
  await ready();
  ensureDisplays();
  uiReady = true;
  handleStudentSelection();

  const select = document.getElementById("studentSelect");
  if (select) {
    select.addEventListener("change", handleStudentSelection);
  }
}

export function initUploadsUI(user, claims) {
    if (!user || !claims) {
        return;
    }
    authUser = user;
    teacherRoleDetected = claims.role === 'docente';

    if (teacherRoleDetected) {
        // Lógica existente para el DOCENTE
        main().catch((error) => {
            console.error("[calificaciones-uploads-ui] Error en la inicialización (docente):", error);
            if (typeof setErrorState === 'function') {
                setErrorState();
            }
        });
    } else {
        // Nueva lógica para el ESTUDIANTE
        setupStudentUploadsView(user);
    }
}


