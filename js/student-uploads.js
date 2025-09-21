import { onAuth } from "./firebase.js";
import {
  observeStudentUploads,
  createStudentUpload,
} from "./student-uploads.js";

const titleInput = document.getElementById("studentUploadTitle");
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

function ensureWidget() {
  if (widget || typeof uploadcare === "undefined") return;
  try {
    widget = uploadcare.Widget("#studentUploadFile");
  } catch (error) {
    console.error("No se pudo inicializar el widget de Uploadcare", error);
    setStatus(
      "No se pudo inicializar el selector de archivos. Recarga la página e inténtalo de nuevo.",
      "error"
    );
  }
}

function setStatus(message, variant = "info") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.remove("is-info", "is-success", "is-error", "is-warning");
  if (message) {
    statusEl.hidden = false;
    const className = variant ? `is-${variant}` : "is-info";
    statusEl.classList.add(className);
  } else {
    statusEl.hidden = true;
  }
}

function setSubmittingState(isSubmitting) {
  submitting = isSubmitting;
  if (form) {
    form.classList.toggle("is-submitting", isSubmitting);
    const submitBtn = form.querySelector("[type='submit']");
    if (submitBtn) submitBtn.disabled = isSubmitting;
  }
  if (resetBtn) resetBtn.disabled = isSubmitting;
}

function resetForm() {
  if (form) form.reset();
  if (widget) {
    try {
      widget.value(null);
    } catch (error) {
      console.warn("No se pudo limpiar el widget", error);
    }
  }
}

function formatSize(bytes) {
  const numeric = Number(bytes);
  if (!numeric || Number.isNaN(numeric)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = numeric;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function renderList(items) {
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    emptyEl.hidden = false;
    if (countEl) countEl.textContent = "0";
    return;
  }

  emptyEl.hidden = true;
  if (countEl) countEl.textContent = String(items.length);

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "student-uploads__item";

    const header = document.createElement("div");
    header.className = "student-uploads__item-header";

    const titleEl = document.createElement("div");
    titleEl.className = "student-uploads__item-title";
    titleEl.textContent = item.title || "Entrega sin título";

    const chip = document.createElement("span");
    chip.className = "student-uploads__item-chip";
    chip.textContent = typeLabels[item.kind] || "Entrega";

    header.appendChild(titleEl);
    header.appendChild(chip);
    li.appendChild(header);

    const submittedDate =
      item?.submittedAt && typeof item.submittedAt.toDate === "function"
        ? item.submittedAt.toDate()
        : item?.submittedAt
        ? new Date(item.submittedAt)
        : null;
    const dateValid = submittedDate && !Number.isNaN(submittedDate.getTime());
    const sizeText = formatSize(item.fileSize);

    const meta = document.createElement("div");
    meta.className = "student-uploads__item-meta";
    const metaParts = [];
    if (dateValid) metaParts.push(`Enviado el ${dateFormatter.format(submittedDate)}`);
    if (sizeText) metaParts.push(sizeText);
    if (item.fileName) metaParts.push(item.fileName);
    meta.textContent = metaParts.join(" · ") || "Entrega sincronizada";
    li.appendChild(meta);

    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "student-uploads__item-description";
      desc.textContent = item.description;
      li.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "student-uploads__item-actions";
    const link = document.createElement("a");
    link.className = "student-uploads__item-link";
    if (item.fileUrl) {
      link.href = item.fileUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Abrir archivo";
    } else {
      link.setAttribute("aria-disabled", "true");
      link.textContent = "Archivo no disponible";
    }
    actions.appendChild(link);
    li.appendChild(actions);

    listEl.appendChild(li);
  });
}

if (form) {
  onAuth((user) => {
    currentUser = user;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!user) {
      renderList([]);
      setStatus("Inicia sesión para subir tus actividades y tareas.", "info");
      setSubmittingState(false);
      return;
    }

    ensureWidget();
    setStatus(
      "Selecciona un archivo y completa los campos para registrar tu entrega.",
      "info"
    );

    unsubscribe = observeStudentUploads(
      user.uid,
      (items) => {
        renderList(items);
        if (!submitting && !justSubmitted) {
          setStatus(
            items.length
              ? "Tus entregas se sincronizan en tiempo real."
              : "Aún no registras entregas. Usa el formulario para subir la primera.",
            items.length ? "success" : "info"
          );
        }
      },
      () => {
        setStatus("No pudimos cargar tus entregas. Intenta actualizar la página.", "error");
      }
    );
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!currentUser) {
      setStatus("Debes iniciar sesión para subir tus actividades.", "error");
      return;
    }

    ensureWidget();
    if (!widget) {
      setStatus(
        "El componente de carga no está disponible. Recarga la página e inténtalo nuevamente.",
        "error"
      );
      return;
    }

    const title = titleInput.value.trim();
    const kind = typeSelect.value;
    const description = descriptionInput.value.trim();

    if (!title) {
      setStatus("Indica un título para identificar tu entrega.", "warning");
      titleInput.focus();
      return;
    }

    const fileInfo = widget.value();
    if (!fileInfo) {
      setStatus("Selecciona un archivo para subir.", "warning");
      return;
    }

    setSubmittingState(true);
    setStatus("Subiendo tu entrega, espera un momento...", "info");

    try {
      fileInfo.done(async (file) => {
        try {
          await createStudentUpload({
            title,
            description,
            kind,
            fileUrl: file.cdnUrl || file.originalUrl || "",
            fileName: file.name || file.originalFilename || "Archivo sin nombre",
            fileSize: file.size || file.originalFileSize || null,
            mimeType:
              file.mimeType ||
              (file.contentInfo && file.contentInfo.mime) ||
              "",
            student: {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
            },
          });

          if (submissionTimer) window.clearTimeout(submissionTimer);
          justSubmitted = true;
          setStatus("Entrega registrada correctamente.", "success");
          submissionTimer = window.setTimeout(() => {
            justSubmitted = false;
            submissionTimer = null;
          }, 4000);
          resetForm();
        } catch (error) {
          console.error("createStudentUpload:error", error);
          setStatus(
            error?.message || "No se pudo registrar la entrega. Intenta nuevamente.",
            "error"
          );
        } finally {
          setSubmittingState(false);
        }
      });
    } catch (error) {
      console.error("Uploadcare value error", error);
      setStatus("No se pudo procesar el archivo seleccionado.", "error");
      setSubmittingState(false);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", (event) => {
      event.preventDefault();
      if (submitting) return;
      resetForm();
      setStatus("Formulario listo para una nueva entrega.", "info");
    });
  }
}
