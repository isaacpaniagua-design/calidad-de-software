// js/index-student-uploads.js
import { onAuth, getDb, getAuthInstance } from "./firebase.js";
// --- IMPORTACIONES ---
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import { observeStudentUploads, createStudentUpload } from "./student-uploads.js";
import { courseActivities, getActivityById, findActivityByTitle } from "./course-activities.js";

// ¡CORRECCIÓN CLAVE!
// Importamos la configuración desde la fuente única en lugar de declararla aquí.
// Esto resuelve el error "Unexpected token 'export'".
import { driveFolderId, allowedEmailDomain } from "./firebase-config.js";

// ============================================================================
// Toda tu lógica original se mantiene intacta desde aquí hacia abajo.
// ============================================================================

initializeFileViewer();

const activitySelect = document.getElementById("studentUploadTitle");
const typeSelect = document.getElementById("studentUploadType");
const descriptionInput = document.getElementById("studentUploadDescription");
const statusEl = document.getElementById("studentUploadStatus");
const listEl = document.getElementById("studentUploadList");
const emptyEl = document.getElementById("studentUploadEmpty");
const countEl = document.querySelector("[data-upload-count]");
const resetBtn = document.getElementById("studentUploadReset");
const form = document.getElementById("studentUploadForm");

const typeLabels = {
  activity: "Actividad",
  homework: "Tarea",
  evidence: "Evidencia",
};

const statusLabels = {
  enviado: "Enviado",
  aceptado: "Aceptado",
  calificado: "Calificado",
  rechazado: "Rechazado",
};

const knownStatuses = new Map();
let statusesInitialized = false;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

let widget = null;
let currentUser = null;
let unsubscribe = null;
let submitting = false;
let justSubmitted = false;
let submissionTimer = null;

function populateActivitySelect() {
  if (!activitySelect) return;
  activitySelect.innerHTML = `<option value="">Selecciona una actividad...</option>`;
  courseActivities.forEach((activity) => {
    const option = document.createElement("option");
    option.value = activity.id;
    option.textContent = activity.title;
    activitySelect.appendChild(option);
  });
}

function updateStatus(message, { isError = false, autoClear = 0 } = {}) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.className = isError ? "status-message is-error" : "status-message";
  statusEl.hidden = !message;
  if (autoClear > 0) {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        updateStatus("");
      }
    }, autoClear);
  }
}

function renderUploads(items) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    if (countEl) countEl.textContent = "0";
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (countEl) countEl.textContent = String(items.length);

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "upload-item";
    li.dataset.id = item.id;
    li.dataset.status = item.status || "enviado";

    const title = item.title || "Entrega sin título";
    const type = typeLabels[item.kind] || "Archivo";
    const status = statusLabels[item.status] || "Enviado";
    const date = item.submittedAt?.toDate ? dateFormatter.format(item.submittedAt.toDate()) : "Fecha desconocida";
    const grade = item.grade !== null && typeof item.grade !== "undefined" ? `Calificación: ${item.grade}` : "";

    li.innerHTML = `
      <div class="upload-item__meta">
        <span class="upload-item__type">${type}</span>
        <span class="upload-item__date">${date}</span>
      </div>
      <strong class="upload-item__title">${title}</strong>
      <div class="upload-item__status">
        <span class="badge status--${item.status || "enviado"}">${status}</span>
        ${grade ? `<span class="upload-item__grade">${grade}</span>` : ""}
      </div>
      <div class="upload-item__actions">
        ${item.fileUrl ? `<button type="button" class="btn-link" data-action="view">Ver archivo</button>` : ""}
        ${item.teacherFeedback ? `<button type="button" class="btn-link" data-action="feedback">Ver retroalimentación</button>` : ""}
      </div>
    `;

    li.querySelector('[data-action="view"]')?.addEventListener("click", () => {
      openFileViewer({ url: item.fileUrl, name: item.fileName });
    });

    li.querySelector('[data-action="feedback"]')?.addEventListener("click", () => {
      alert(`Retroalimentación:\n\n${item.teacherFeedback}`);
    });

    listEl.appendChild(li);
  });
}

function handleUploadsSnapshot(items) {
  if (!statusesInitialized) {
    items.forEach(item => knownStatuses.set(item.id, item.status));
    statusesInitialized = true;
  } else {
    items.forEach(item => {
      const prevStatus = knownStatuses.get(item.id);
      if (prevStatus && prevStatus !== item.status) {
        const title = item.title || "Tu entrega";
        const statusLabel = statusLabels[item.status] || item.status;
        showToast(`El estado de "${title}" cambió a: ${statusLabel}`);
      }
      knownStatuses.set(item.id, item.status);
    });
  }
  renderUploads(items);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-visible");
  }, 10);
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (submitting || !currentUser) return;

  const title = activitySelect.value ? getActivityById(activitySelect.value)?.title : "Entrega personalizada";
  const kind = typeSelect.value;
  const description = descriptionInput.value;
  const file = widget?.getFile();

  if (!title || !kind) {
    updateStatus("Por favor, selecciona una actividad y un tipo.", { isError: true, autoClear: 3000 });
    return;
  }
  if (!file) {
    updateStatus("Por favor, selecciona un archivo para subir.", { isError: true, autoClear: 3000 });
    return;
  }

  submitting = true;
  updateStatus("Subiendo archivo, por favor espera...");
  form.classList.add("is-submitting");

  createStudentUpload({
    file: file.fileInfo,
    title,
    kind,
    description,
    student: {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
    },
    onProgress: (progress) => {
      updateStatus(`Subiendo... ${progress.toFixed(0)}%`);
    }
  })
  .then(() => {
    justSubmitted = true;
    updateStatus("¡Archivo subido con éxito!", { autoClear: 4000 });
    form.reset();
    widget.clearAll();
    
    clearTimeout(submissionTimer);
    submissionTimer = setTimeout(() => {
      justSubmitted = false;
    }, 2000);
  })
  .catch((error) => {
    console.error("Error al subir archivo:", error);
    updateStatus(`Error al subir: ${error.message}`, { isError: true, autoClear: 5000 });
  })
  .finally(() => {
    submitting = false;
    form.classList.remove("is-submitting");
  });
}

onAuth(user => {
  currentUser = user;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (user) {
    document.body.classList.remove("is-logged-out");
    unsubscribe = observeStudentUploads(user.uid, handleUploadsSnapshot);
  } else {
    document.body.classList.add("is-logged-out");
    renderUploads([]);
  }
});

if (form) {
  form.addEventListener("submit", handleFormSubmit);
}

if (resetBtn) {
  resetBtn.addEventListener("click", (event) => {
    event.preventDefault();
    if (confirm("¿Estás seguro de que quieres limpiar el formulario?")) {
      form.reset();
      widget?.clearAll();
      updateStatus("");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.uploadcare) {
    widget = uploadcare.Widget("[role=uploadcare-uploader]");
  }
  populateActivitySelect();
});

export async function uploadMaterialToDrive({
  file,
  title,
  category,
  description,
  ownerEmail,
  folderId = driveFolderId,
  onProgress,
}) {
  if (!file) throw new Error("Archivo requerido para subir a Drive.");

  async function getFirebaseCore() {
    return await import('./firebase.js');
  }

  const { getAuthInstance, GoogleAuthProvider, signInWithPopupSafe } = await getFirebaseCore();
  
  async function getDriveAccessTokenInteractive() {
    const auth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: allowedEmailDomain });
    provider.addScope("https://www.googleapis.com/auth/drive.file");

    const result = await signInWithPopupSafe(auth, provider, { retries: 1 });
    const cred = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = cred?.accessToken || null;
    
    if (!accessToken) {
      throw new Error("No se pudo obtener el token de acceso de Google Drive.");
    }
    return accessToken;
  }

  const token = await getDriveAccessTokenInteractive();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const metadata = {
    name: safeName,
    parents: folderId ? [folderId] : undefined,
    description: description || undefined,
  };

  const boundary = `-------driveFormBoundary${Math.random().toString(16).slice(2)}`;
  const delimiter = `--${boundary}\r\n`;
  const closeDelim = `--${boundary}--`;

  const body = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n',
    delimiter,
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    '\r\n',
    closeDelim,
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink`;

  const uploadResponse = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", `multipart/related; boundary=${boundary}`);
    
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
    }
    
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Error subiendo a Drive (${xhr.status}): ${xhr.responseText}`));
        }
      }
    };
    xhr.send(body);
  });

  if (uploadResponse?.id) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadResponse.id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch (permError) {
      console.warn("No se pudo establecer el permiso público en el archivo de Drive:", permError);
    }
  }

  const db = getDb();
  const auth = getAuthInstance();
  const url = uploadResponse?.webViewLink || `https://drive.google.com/file/d/${uploadResponse.id}/view`;
  
  const docRef = await addDoc(collection(db, "materials"), {
    title,
    category,
    description,
    url,
    path: null,
    ownerEmail: ownerEmail?.toLowerCase() || auth?.currentUser?.email?.toLowerCase() || null,
    createdAt: serverTimestamp(),
    downloads: 0,
    storage: 'drive',
  });

  return { id: docRef.id, url };
}
