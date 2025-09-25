import { onAuth } from "./firebase.js";
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import {
  observeStudentUploads,
  createStudentUpload,
} from "./student-uploads.js";
import {
  courseActivities,
  getActivityById,
  findActivityByTitle,
} from "./course-activities.js";

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
  const selectedValue = activitySelect.value;
  activitySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = "Selecciona la actividad o asignación";
  activitySelect.appendChild(placeholder);

  courseActivities.forEach((unit) => {
    if (!unit || !Array.isArray(unit.items) || !unit.items.length) return;
    const group = document.createElement("optgroup");
    group.label = unit.unitLabel || unit.shortLabel || "Unidad";
    unit.items.forEach((item) => {
      if (!item || !item.id) return;
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.title || "Actividad";
      option.dataset.unitId = unit.unitId || "";
      option.dataset.unitLabel = unit.unitLabel || "";
      if (item.id === selectedValue) {
        option.selected = true;
        placeholder.selected = false;
      }
      group.appendChild(option);
    });
    activitySelect.appendChild(group);
  });
}

populateActivitySelect();

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
  if (activitySelect) {
    activitySelect.selectedIndex = 0;
  }
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

function normalizeStatus(status) {
  return (status || "enviado").toString().toLowerCase();
}

function notifyStatusChanges(items) {
  if (!Array.isArray(items)) {
    knownStatuses.clear();
    statusesInitialized = false;
    return false;
  }

  const ids = new Set();
  const notifications = [];

  items.forEach((item) => {
    if (!item || !item.id) return;
    const status = normalizeStatus(item.status);
    const previous = knownStatuses.get(item.id);
    if (
      statusesInitialized &&
      previous &&
      previous !== status &&
      (status === "aceptado" || status === "calificado")
    ) {
      notifications.push({ item, status });
    }
    knownStatuses.set(item.id, status);
    ids.add(item.id);
  });

  knownStatuses.forEach((_, key) => {
    if (!ids.has(key)) knownStatuses.delete(key);
  });

  statusesInitialized = true;

  if (!notifications.length) return false;

  const latest = notifications[notifications.length - 1];
  const title = latest.item?.title || "Entrega";
  let message = "";
  if (latest.status === "calificado") {
    const gradeText =
      typeof latest.item?.grade === "number" && !Number.isNaN(latest.item.grade)
        ? ` con calificación ${latest.item.grade}`
        : "";
    message = `🎉 Tu entrega "${title}" fue calificada${gradeText}`;
  } else {
    message = `✅ Tu entrega "${title}" fue aceptada`;
  }
  const reviewer = latest.item?.gradedBy || latest.item?.reviewedBy;
  const reviewerName = reviewer?.displayName || reviewer?.email || "";
  if (reviewerName) {
    message += ` por ${reviewerName}`;
  } else {
    message += " por tu docente";
  }
  message += ".";
  if (latest.status === "calificado" && latest.item?.teacherFeedback) {
    message += ` Comentarios del docente: "${latest.item.teacherFeedback}".`;
  }
  setStatus(message, "success");
  return true;
}

function renderList(items) {
  if (!listEl || !emptyEl) return false;
  const safeItems = Array.isArray(items) ? items : [];
  listEl.innerHTML = "";

  const notified = notifyStatusChanges(safeItems);

  if (safeItems.length === 0) {
    emptyEl.hidden = false;
    if (countEl) countEl.textContent = "0";
    return notified;
  }

  emptyEl.hidden = true;
  if (countEl) countEl.textContent = String(safeItems.length);

  safeItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "student-uploads__item";

    const activityInfo =
      getActivityById(item?.extra?.activityId) ||
      (item?.extra?.unitId
        ? findActivityByTitle(item?.title, item.extra.unitId)
        : null) ||
      findActivityByTitle(item?.title);

    const header = document.createElement("div");
    header.className = "student-uploads__item-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "student-uploads__item-heading";

    const titleEl = document.createElement("div");
    titleEl.className = "student-uploads__item-title";
    titleEl.textContent = activityInfo?.title || item.title || "Entrega sin título";

    const chip = document.createElement("span");
    chip.className = "student-uploads__item-chip";
    chip.textContent = typeLabels[item.kind] || "Entrega";

    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(chip);
    header.appendChild(titleWrap);

    const status = normalizeStatus(item.status);
    const statusBadge = document.createElement("span");
    statusBadge.className = `student-uploads__item-status student-uploads__item-status--${status}`;
    statusBadge.textContent = statusLabels[status] || statusLabels.enviado;
    header.appendChild(statusBadge);
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
    if (activityInfo?.unitLabel) metaParts.push(activityInfo.unitLabel);
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

    if (typeof item.grade === "number" && !Number.isNaN(item.grade)) {
      const gradeEl = document.createElement("div");
      gradeEl.className = "student-uploads__item-grade";
      gradeEl.textContent = `Calificación: ${item.grade} / 100`;
      li.appendChild(gradeEl);
    }

    if (item.teacherFeedback) {
      const feedbackEl = document.createElement("p");
      feedbackEl.className = "student-uploads__item-feedback";
      feedbackEl.textContent = `Comentarios del docente: ${item.teacherFeedback}`;
      li.appendChild(feedbackEl);
    }

    const actions = document.createElement("div");
    actions.className = "student-uploads__item-actions";
    if (item.fileUrl) {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "student-uploads__item-button";
      previewBtn.textContent = "Visualizar archivo";
      previewBtn.addEventListener("click", () => {
        openFileViewer(item.fileUrl, {
          title: activityInfo?.title || item.title || "Entrega sin título",
          downloadUrl: item.fileUrl,
          fileName: item.fileName || "",
        });
      });
      actions.appendChild(previewBtn);
    }

    const link = document.createElement("a");
    link.className = "student-uploads__item-link";
    if (item.fileUrl) {
      link.href = item.fileUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Abrir en pestaña nueva";
    } else {
      link.setAttribute("aria-disabled", "true");
      link.textContent = "Archivo no disponible";
    }
    actions.appendChild(link);
    li.appendChild(actions);

    listEl.appendChild(li);
  });

  return notified;
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
        const notified = renderList(items);
        if (!submitting && !justSubmitted && !notified) {
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

    const activityId = activitySelect ? activitySelect.value : "";
    const activityInfo = getActivityById(activityId);
    const kind = typeSelect.value;
    const description = descriptionInput.value.trim();

    if (!activityInfo) {
      setStatus("Selecciona una actividad para identificar tu entrega.", "warning");
      if (activitySelect) activitySelect.focus();
      return;
    }

    const title = activityInfo.title;

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
            extra: {
              activityId: activityInfo.id,
              unitId: activityInfo.unitId,
              unitLabel: activityInfo.unitLabel,
            },
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
