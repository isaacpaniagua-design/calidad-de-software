import { onAuth } from "./firebase.js";
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import {
  observeStudentUploads,
  observeStudentUploadsByEmail,
} from "./student-uploads.js";
import {
  getActivityById,
  findActivityByTitle,
} from "./course-activities.js";

initializeFileViewer();

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const gradeItemSelector = "#calificaciones-root .grade-item";
const displays = new Map();
let unsubscribeUploads = null;
let currentProfileKey = null;
let authUser = null;
let uiReady = false;

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

  const viewLink = document.createElement("a");
  viewLink.className = "upload-trigger";
  viewLink.href = "#";
  viewLink.setAttribute("aria-disabled", "true");
  viewLink.textContent = "Visualizar entrega";

  buttonsWrapper.appendChild(viewLink);
  viewWrapper.appendChild(buttonsWrapper);

  const status = document.createElement("span");
  status.className = "upload-status";
  status.setAttribute("aria-live", "polite");
  status.textContent = activity ? "Sin entrega registrada" : "Actividad no vinculada";
  const statusId = `upload-status-${displays.size + 1}`;
  status.id = statusId;
  viewWrapper.appendChild(status);

  if (gradeInput) {
    gradeInput.setAttribute("aria-describedby", statusId);
  }

  actions.appendChild(viewWrapper);
  item.appendChild(actions);

  const entry = {
    statusEl: status,
    viewLink,
    gradeInput,
    activity,
    item,
    statusId,
    title,
  };

  if (!activity) {
    disableView(entry);
  } else {
    resetViewListener(entry);
  }

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
    resetViewListener(entry);
    if (!upload || !upload.fileUrl) {
      disableView(entry);
      const text = entry.activity
        ? "Sin entrega registrada"
        : "Actividad no vinculada";
      setStatus(entry, text, { uploaded: false, title: "" });
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
  });
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

function subscribeToProfile(profile) {
  if (!uiReady) return;
  const key = profile
    ? `${profile.uid || ""}|${(profile.email || "").toLowerCase()}`
    : "__none__";
  if (key === currentProfileKey) return;
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

function studentsArray() {
  return Array.isArray(window.students) ? window.students : [];
}

function extractEmail(text) {
  if (!text) return "";
  const match = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function getSelectedStudentProfile() {
  const select = document.getElementById("studentSelect");
  if (!select || !select.value) return null;
  const option = select.selectedOptions && select.selectedOptions[0];
  const value = select.value;
  const email = option?.dataset?.email || option?.getAttribute("data-email") || "";
  const uid = option?.dataset?.uid || option?.getAttribute("data-uid") || "";
  const list = studentsArray();
  const fallback = list.find(
    (student) => student && (student.id === value || student.uid === value)
  );
  const emailField = document.getElementById("studentEmail");
  const parsedEmail = email || fallback?.email || extractEmail(option?.textContent || "");
  const effectiveEmail = parsedEmail || (emailField ? emailField.value.trim() : "");
  const profile = {
    uid: uid || fallback?.uid || "",
    email: effectiveEmail,
  };
  if (profile.uid || profile.email) return profile;
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
  await ready();
  ensureDisplays();
  uiReady = true;
  handleStudentSelection();

  const select = document.getElementById("studentSelect");
  if (select) {
    select.addEventListener("change", handleStudentSelection);
  }
}

onAuth((user) => {
  authUser = user;
  if (!uiReady) return;
  if (!getSelectedStudentProfile()) {
    if (user) {
      subscribeToProfile({ uid: user.uid, email: user.email || "" });
    } else {
      subscribeToProfile(null);
    }
  }
});

main().catch((error) => {
  console.error("[calificaciones-uploads-ui]", error);
  setErrorState();
});
