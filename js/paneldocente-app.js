import {
  initFirebase,
  getDb,
  onAuth,
  signInWithGooglePotros,
  signOutCurrent,
  ensureTeacherAllowlistLoaded,
  ensureTeacherDocForUser,
  isTeacherByDoc,
  isTeacherEmail,
} from "./firebase.js";
import {
  observeAllStudentUploads,
  markStudentUploadAccepted,
  gradeStudentUpload,
  deleteStudentUpload,
} from "./student-uploads.js";

initFirebase();
const db = getDb();

const COLLECTION_KEYS = [
  "attendances",
  "courses",
  "forum_topics",
  "grupos",
  "materials",
  "studentUploads",
  "teachers",
];

const ROSTER_STORAGE_KEY = "qs_roster_cache";

const COLLECTION_LABELS = {
  attendances: "Asistencias",
  courses: "Cursos",
  forum_topics: "Temas del foro",
  grupos: "Grupos",
  materials: "Materiales",
  studentUploads: "Evidencias",
  teachers: "Docentes",
};

function createEmptyCollectionsState() {
  return COLLECTION_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

const state = {
  user: null,
  isTeacher: false,
  groupId: "calidad-2025",
  members: [],
  uploads: [],
  materials: [],
  activityLog: [],
  allowlist: [],
  collections: createEmptyCollectionsState(),
  grades: {},
  collectionLoading: {},
  unsub: {
    members: null,
    uploads: null,
    materials: null,
    grades: null,
  },
};

function normalizeEmail(value) {
  if (value == null) return "";
  try {
    return String(value).trim().toLowerCase();
  } catch (_err) {
    return "";
  }
}

function normalizeRosterStudent(student) {
  if (!student) return null;
  const email = normalizeEmail(student.email || "");
  const uid = student.uid ? String(student.uid) : "";
  const matricula = student.matricula || student.id || uid || email || "";
  const id = student.id || matricula || email || uid;
  if (!id && !email && !uid) return null;
  const name = student.name || student.displayName || student.nombre || "";
  const type = student.type || "student";
  return {
    uid,
    id,
    matricula: matricula || id,
    name: name || email || id || "Estudiante",
    email,
    type,
  };
}

function dedupeRosterEntries(list) {
  const order = [];
  const map = {};
  if (!Array.isArray(list)) return [];
  list.forEach((entry, index) => {
    if (!entry) return;
    const key =
      normalizeEmail(entry.email || "") ||
      (entry.id || entry.matricula || entry.uid || entry.name || `idx${index}`)
        .toString()
        .toLowerCase();
    if (!key) return;
    if (!map[key]) {
      map[key] = { ...entry };
      order.push(key);
    } else {
      const current = map[key];
      if (entry.uid && !current.uid) current.uid = entry.uid;
      if (entry.id && !current.id) current.id = entry.id;
      if (entry.matricula && !current.matricula)
        current.matricula = entry.matricula;
      if (entry.email && !current.email) current.email = entry.email;
      if (entry.type && !current.type) current.type = entry.type;
      if (
        entry.name &&
        (!current.name ||
          current.name === current.id ||
          current.name === current.email)
      ) {
        current.name = entry.name;
      }
    }
  });
  return order
    .map((key, index) => {
      const item = map[key];
      if (!item) return null;
      const copy = { ...item };
      if (!copy.id)
        copy.id =
          copy.matricula || copy.email || copy.uid || `student-${index}`;
      if (!copy.matricula) copy.matricula = copy.id;
      if (!copy.name) copy.name = copy.email || copy.id;
      if (!copy.type) copy.type = "student";
      return copy;
    })
    .filter(Boolean);
}

function emitRosterUpdate(detail) {
  if (typeof window === "undefined" || !window.dispatchEvent) return;
  try {
    window.dispatchEvent(new CustomEvent("qs:roster-updated", { detail }));
  } catch (_err) {
    if (
      typeof document !== "undefined" &&
      typeof document.createEvent === "function"
    ) {
      try {
        const ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("qs:roster-updated", false, false, detail);
        window.dispatchEvent(ev);
      } catch (_err2) {
        // ignore
      }
    }
  }
}

function syncRosterCacheFromMembers(members) {
  if (typeof window === "undefined") return;
  const list = Array.isArray(members) ? members : [];
  const normalized = list.map(normalizeRosterStudent).filter(Boolean);
  const deduped = dedupeRosterEntries(normalized);
  const payload = {
    updatedAt: new Date().toISOString(),
    students: deduped,
  };
  try {
    if (window.localStorage) {
      window.localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (_err) {}
  try {
    window.students = deduped.slice();
  } catch (_err2) {}
  emitRosterUpdate(payload);
  return payload;
}

const auth = {
  email: document.getElementById("pd-user-email"),
  signIn: document.getElementById("pd-sign-in"),
  signOut: document.getElementById("pd-sign-out"),
};

const banner = document.getElementById("pd-status-banner");
const groupSelect = document.getElementById("pd-group-select");
const overviewCounters = {
  members: document.getElementById("pd-count-members"),
  uploads: document.getElementById("pd-count-uploads"),
  pending: document.getElementById("pd-count-pending"),
  materials: document.getElementById("pd-count-materials"),
};
const activityLogEl = document.getElementById("pd-activity-log");
const refreshOverviewBtn = document.getElementById("pd-refresh-overview");

const memberForm = document.getElementById("pd-member-form");
const memberResetBtn = document.getElementById("pd-member-reset");
const memberDeleteBtn = document.getElementById("pd-member-delete");
const membersBody = document.getElementById("pd-members-body");

const uploadSearchInput = document.getElementById("pd-upload-search");
const uploadsList = document.getElementById("pd-uploads-list");
const refreshUploadsBtn = document.getElementById("pd-refresh-uploads");

const materialForm = document.getElementById("pd-material-form");
const materialsList = document.getElementById("pd-materials-list");

const bulkGradeForm = document.getElementById("pd-bulk-grade-form");
const selectAllCheckbox = document.getElementById("pd-select-all-students");

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener("change", (event) => {
    const isChecked = event.target.checked;
    const studentCheckboxes = membersBody.querySelectorAll(
      'input[name="student_select"]'
    );
    studentCheckboxes.forEach((checkbox) => {
      checkbox.checked = isChecked;
    });
  });
}

if (bulkGradeForm) {
  bulkGradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.isTeacher) {
      showBanner("Tu cuenta no tiene permisos para calificar.", "error");
      return;
    }

    const formData = new FormData(bulkGradeForm);
    const unit = formData.get("unit");
    const activity = formData.get("activity");
    const grade = Number(formData.get("grade"));

    if (
      !unit ||
      !activity ||
      !Number.isFinite(grade) ||
      grade < 0 ||
      grade > 100
    ) {
      showBanner(
        "Por favor, completa todos los campos del formulario de calificación masiva con valores válidos.",
        "error"
      );
      return;
    }

    const selectedCheckboxes = membersBody.querySelectorAll(
      'input[name="student_select"]:checked'
    );
    const selectedStudentIds = Array.from(selectedCheckboxes).map(
      (cb) => cb.value
    );

    if (selectedStudentIds.length === 0) {
      showBanner(
        "Selecciona al menos un alumno para aplicar la calificación.",
        "error"
      );
      return;
    }

    const statusEl = document.getElementById("pd-bulk-status");
    if (statusEl)
      statusEl.textContent = `Aplicando calificación a ${selectedStudentIds.length} alumnos...`;

    try {
      const { doc, updateDoc, serverTimestamp } = await getFirestore();
      const promises = selectedStudentIds.map((studentId) => {
        const gradeRef = doc(db, "grades", studentId);
        const path =
          activity === "projectFinal" ? "projectFinal" : `${unit}.${activity}`;
        return updateDoc(gradeRef, {
          [path]: grade,
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);

      showBanner(
        `Calificación masiva aplicada a ${selectedStudentIds.length} alumnos.`,
        "success"
      );
      if (statusEl)
        statusEl.textContent = `¡Calificación aplicada a ${selectedStudentIds.length} alumnos!`;
      appendActivity(
        `Calificación masiva: ${unit}.${activity} = ${grade} para ${selectedStudentIds.length} alumnos.`
      );
      logAdmin(
        `Calificación masiva aplicada a ${selectedStudentIds.length} alumnos.`
      );

      // Deseleccionar todo
      selectedCheckboxes.forEach((cb) => (cb.checked = false));
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      bulkGradeForm.reset();
      setTimeout(() => {
        if (statusEl) statusEl.textContent = "";
      }, 4000);
    } catch (error) {
      console.error("bulk grade error", error);
      showBanner(
        "Ocurrió un error al aplicar la calificación masiva.",
        "error"
      );
      if (statusEl) statusEl.textContent = "Error al aplicar la calificación.";
    }
  });
}

const allowlistForm = document.getElementById("pd-allowlist-form");
const allowlistViewBtn = document.getElementById("pd-load-allowlist");
const allowlistView = document.getElementById("pd-allowlist-view");
const adminLog = document.getElementById("pd-admin-log");

const datasetsPanel = document.querySelector('[data-view-panel="datasets"]');
const collectionListEls = {};
const collectionCountEls = {};
const collectionForms = {};

COLLECTION_KEYS.forEach((key) => {
  collectionListEls[key] = document.getElementById(`pd-collection-${key}`);
  collectionCountEls[key] = document.querySelector(
    `[data-collection-count="${key}"]`
  );
  collectionForms[key] = document.querySelector(
    `[data-collection-form="${key}"]`
  );
});

const viewButtons = document.querySelectorAll('[data-action="switch-view"]');
const viewPanels = document.querySelectorAll("[data-view-panel]");

const firestorePromise = import(
  "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"
);
async function getFirestore() {
  return firestorePromise;
}

function showBanner(message, type = "info") {
  if (!banner) return;
  if (!message) {
    banner.hidden = true;
    banner.textContent = "";
    banner.className = "pd-banner";
    return;
  }
  banner.hidden = false;
  banner.textContent = message;
  banner.className = `pd-banner ${type}`;
}

const htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => htmlEscapeMap[char] || char
  );
}

function safeStringify(value) {
  if (value === undefined) return "{}";
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_err) {
    return String(value ?? "{}");
  }
}

function isPermissionDenied(error) {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (code === "permission-denied" || code.endsWith("/permission-denied")) {
    return true;
  }
  const message = typeof error.message === "string" ? error.message : "";
  return /missing or insufficient permissions/i.test(message);
}

function getCollectionLabel(key) {
  return COLLECTION_LABELS[key] || key;
}

function setUserUI(user) {
  if (auth.email) {
    auth.email.textContent = user ? user.email || "Sin correo" : "";
  }
  if (auth.signIn) {
    auth.signIn.hidden = !!user;
  }
  if (auth.signOut) {
    auth.signOut.hidden = !user;
  }
}

function switchView(target) {
  viewButtons.forEach((btn) => {
    const isActive = btn.getAttribute("data-target") === target;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  viewPanels.forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.getAttribute("data-view-panel") === target
    );
  });
}

viewButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    switchView(target);
  });
});

function cleanupSubscriptions() {
  Object.keys(state.unsub).forEach((key) => {
    const fn = state.unsub[key];
    if (typeof fn === "function") {
      try {
        fn();
      } catch (err) {
        console.warn("unsubscribe", key, err);
      }
    }
    state.unsub[key] = null;
  });
}

function appendActivity(message) {
  const stamp = new Date().toLocaleTimeString();
  state.activityLog.unshift(`[${stamp}] ${message}`);
  state.activityLog = state.activityLog.slice(0, 50);
  renderActivityLog();
}

const adminLogEl = adminLog;

function logAdmin(message) {
  if (!adminLogEl) return;
  const stamp = new Date().toLocaleTimeString();
  const previous = adminLogEl.textContent ? "\n" + adminLogEl.textContent : "";
  adminLogEl.textContent = `[${stamp}] ${message}` + previous;
}

function renderActivityLog() {
  if (!activityLogEl) return;
  if (!state.activityLog.length) {
    activityLogEl.textContent = "Sin actividad reciente.";
    return;
  }
  activityLogEl.textContent = state.activityLog.join("\n");
}

function renderOverview() {
  if (overviewCounters.members) {
    overviewCounters.members.textContent = state.members.length.toString();
  }
  const totalUploads = state.uploads.length;
  const pendingUploads = state.uploads.filter(
    (u) => !u.status || u.status === "enviado"
  ).length;
  if (overviewCounters.uploads) {
    overviewCounters.uploads.textContent = totalUploads.toString();
  }
  if (overviewCounters.pending) {
    overviewCounters.pending.textContent = pendingUploads.toString();
  }
  if (overviewCounters.materials) {
    overviewCounters.materials.textContent = state.materials.length.toString();
  }
}

function calculateFinalGrade(grades) {
  if (!grades) return 0;

  const weights = {
    unit1: 0.2,
    unit2: 0.2,
    unit3: 0.2,
    projectFinal: 0.4,
  };

  const unitWeights = {
    participation: 0.1,
    assignments: 0.25,
    classwork: 0.25,
    exam: 0.4,
  };

  const calculateUnitGrade = (unit) => {
    if (!unit) return 0;
    let total = 0;
    for (const activity in unitWeights) {
      if (typeof unit[activity] === "number") {
        total += unit[activity] * unitWeights[activity];
      }
    }
    return total;
  };

  const u1 = calculateUnitGrade(grades.unit1);
  const u2 = calculateUnitGrade(grades.unit2);
  const u3 = calculateUnitGrade(grades.unit3);
  const pf = grades.projectFinal || 0;

  const finalGrade =
    u1 * weights.unit1 * 10 +
    u2 * weights.unit2 * 10 +
    u3 * weights.unit3 * 10 +
    pf * weights.projectFinal;

  return Math.round(finalGrade);
}

function renderMembers() {
  if (!membersBody) return;
  if (!state.members.length) {
    membersBody.innerHTML =
      '<tr><td colspan="11" class="pd-empty">Sin alumnos registrados.</td></tr>';
    return;
  }
  membersBody.innerHTML = state.members
    .map((member) => {
      const memberId = member.uid || member.id || member.matricula || "";
      const updated = member.updatedAt
        ? new Date(member.updatedAt).toLocaleString()
        : "--";

      const grades = state.grades[memberId] || {};

      const calculateUnitGrade = (unit) => {
        if (!unit) return null;
        const unitWeights = {
          participation: 0.1,
          assignments: 0.4,
          classwork: 0.2,
          exam: 0.3,
        };
        let total = 0;
        let activitiesCount = 0;
        for (const activity in unit) {
          if (typeof unit[activity] === "number" && unitWeights[activity]) {
            total += unit[activity] * unitWeights[activity];
            activitiesCount++;
          }
        }
        return activitiesCount > 0 ? total : null;
      };

      const u1 = grades.unit1
        ? Math.round(calculateUnitGrade(grades.unit1) * 10)
        : "--";
      const u2 = grades.unit2
        ? Math.round(calculateUnitGrade(grades.unit2) * 10)
        : "--";
      const u3 = grades.unit3
        ? Math.round(calculateUnitGrade(grades.unit3) * 10)
        : "--";

      const pf = grades.projectFinal ?? "--";
      const cf = calculateFinalGrade(grades) || "--";

      return `
        <tr data-member-id="${memberId}">
          <td><input type="checkbox" name="student_select" value="${memberId}" /></td>
          <td>${member.displayName || member.nombre || "Sin nombre"}</td>
          <td>${member.matricula || "--"}</td>
          <td>${u1}</td>
          <td>${u2}</td>
          <td>${u3}</td>
          <td>${pf}</td>
          <td>${cf}</td>
          <td>${member.email || "--"}</td>
          <td>${member.uid || "--"}</td>
          <td>${updated}</td>
        </tr>
      `;
    })
    .join("");
}

function renderUploads(filterText = "") {
  if (!uploadsList) return;
  const search = filterText.trim().toLowerCase();
  let items = state.uploads.filter((upload) => {
    const groupId = upload.extra?.groupId || upload.extra?.grupoId || null;
    if (!groupId) return true;
    return groupId === state.groupId;
  });
  if (search) {
    items = items.filter((upload) => {
      const haystack = [
        upload.student?.displayName,
        upload.student?.email,
        upload.fileName,
        upload.title,
        upload.extra?.activityId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }
  if (!items.length) {
    uploadsList.innerHTML =
      '<p class="pd-empty">Sin evidencias registradas.</p>';
    return;
  }
  uploadsList.innerHTML = items
    .map((upload) => {
      const status = upload.status || "enviado";
      const submitted = upload.submittedAt
        ? new Date(upload.submittedAt).toLocaleString()
        : "Sin fecha";
      const name =
        upload.student?.displayName || upload.student?.email || "Alumno";
      const fileLink = upload.fileUrl
        ? `<a href="${upload.fileUrl}" target="_blank" rel="noopener">${
            upload.fileName || "Ver evidencia"
          }</a>`
        : "Sin archivo";
      return `
        <article class="pd-upload-card" data-upload-id="${upload.id}">
          <div><strong>${name}</strong> &middot; <span class="pd-muted">${status}</span></div>
          <div class="pd-upload-meta">
            <span>Evidencia: ${fileLink}</span>
            <span>Registrado: ${submitted}</span>
            <span>Tipo: ${upload.kind || "evidence"}</span>
          </div>
          <div class="pd-upload-actions">
            <button type="button" class="pd-button secondary" data-action="accept" data-upload="${
              upload.id
            }">Marcar como revisado</button>
            <button type="button" class="pd-button secondary" data-action="grade" data-upload="${
              upload.id
            }">Calificar</button>
            <button type="button" class="pd-button danger" data-action="delete" data-upload="${
              upload.id
            }">Eliminar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMaterials() {
  if (!materialsList) return;
  if (!state.materials.length) {
    materialsList.innerHTML =
      '<p class="pd-empty">Aun no hay materiales registrados.</p>';
    return;
  }
  materialsList.innerHTML = state.materials
    .map((material) => {
      const created = material.createdAt
        ? new Date(material.createdAt).toLocaleString()
        : "--";
      const category = material.category
        ? `<span class="pd-muted">${material.category}</span>`
        : "";
      const description = material.description
        ? `<p class="pd-muted">${material.description}</p>`
        : "";
      return `
        <div class="pd-material-item" data-material-id="${material.id}">
          <div class="pd-flex">
            <strong>${material.title || "Recurso"}</strong>
            ${category}
          </div>
          ${description}
          <div class="pd-flex">
            <a class="pd-button secondary" href="${
              material.url || "#"
            }" target="_blank" rel="noopener">Abrir recurso</a>
            <button type="button" class="pd-button danger" data-action="delete-material" data-material="${
              material.id
            }">Eliminar</button>
            <span class="pd-muted">${created}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function setCollectionFormState(collection, doc = null) {
  const form = collectionForms[collection];
  if (!form) return;
  if (!doc) {
    form.reset();
    form.dataset.editing = "";
    return;
  }
  if (form.elements.docId) form.elements.docId.value = doc.id || "";
  if (form.elements.docData)
    form.elements.docData.value = safeStringify(doc.data);
  form.dataset.editing = doc.id || "";
}

function renderCollection(collection) {
  const container = collectionListEls[collection];
  if (!container) return;
  const items = state.collections[collection] || [];
  if (!items.length) {
    container.innerHTML =
      '<p class="pd-collection-empty">Sin datos cargados.</p>';
  } else {
    container.innerHTML = items
      .map((item) => {
        const preview = safeStringify(item.data);
        const truncated =
          preview.length > 1200 ? `${preview.slice(0, 1200)}\n...` : preview;
        const escapedId = escapeHtml(item.id);
        return `
          <article class="pd-collection-item" data-doc-id="${escapedId}">
            <div class="pd-collection-item__header">
              <span><strong>${escapedId}</strong></span>
              <div class="pd-collection__actions">
                <button
                  type="button"
                  class="pd-button secondary"
                  data-action="edit-doc"
                  data-collection="${collection}"
                  data-doc="${escapedId}"
                >Editar</button>
                <button
                  type="button"
                  class="pd-button danger"
                  data-action="delete-doc"
                  data-collection="${collection}"
                  data-doc="${escapedId}"
                >Eliminar</button>
              </div>
            </div>
            <pre class="pd-code">${escapeHtml(truncated)}</pre>
          </article>
        `;
      })
      .join("");
  }
  const countEl = collectionCountEls[collection];
  if (countEl) {
    countEl.textContent = items.length.toString();
  }
  const form = collectionForms[collection];
  if (form && form.dataset.editing) {
    const match = items.find((item) => item.id === form.dataset.editing);
    if (match && form.elements.docData) {
      form.elements.docData.value = safeStringify(match.data);
    }
  }
}

function renderAllCollections() {
  COLLECTION_KEYS.forEach((collection) => {
    renderCollection(collection);
  });
}

function resetAllCollectionForms() {
  COLLECTION_KEYS.forEach((collection) => {
    setCollectionFormState(collection, null);
  });
}

async function loadCollection(collection, options = {}) {
  if (!COLLECTION_KEYS.includes(collection)) return;
  if (!state.isTeacher) return;
  if (state.collectionLoading[collection]) return;
  const silent = !!options.silent;
  const announce = !!options.announce;
  const listEl = collectionListEls[collection];
  if (listEl && !silent) {
    listEl.innerHTML = '<p class="pd-collection-empty">Cargando datos...</p>';
  }
  state.collectionLoading[collection] = true;
  try {
    const firestore = await getFirestore();
    const ref = firestore.collection(db, collection);
    let snap;
    if (
      typeof firestore.query === "function" &&
      typeof firestore.limit === "function"
    ) {
      snap = await firestore.getDocs(firestore.query(ref, firestore.limit(50)));
    } else {
      snap = await firestore.getDocs(ref);
    }
    state.collections[collection] = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() || {},
    }));
    renderCollection(collection);
    if (announce) {
      showBanner(
        `Coleccion ${getCollectionLabel(collection)} actualizada.`,
        "success"
      );
    }
    logAdmin(
      `Coleccion ${collection} cargada (${state.collections[collection].length} documentos).`
    );
  } catch (error) {
    const permissionDenied = isPermissionDenied(error);
    state.collections[collection] = [];
    renderCollection(collection);
    if (permissionDenied) {
      console.warn(`load collection ${collection}: acceso denegado`, error);
      logAdmin(`Coleccion ${collection} sin permisos de lectura.`);
      if (!silent) {
        showBanner(
          `No tienes permisos para consultar la coleccion ${getCollectionLabel(
            collection
          )}.`,
          "warning"
        );
      }
      if (listEl) {
        listEl.innerHTML =
          '<p class="pd-collection-empty">Sin permisos para ver esta coleccion.</p>';
      }
    } else {
      console.error("load collection", collection, error);
      if (!silent) {
        showBanner(`No se pudo cargar la coleccion ${collection}.`, "error");
      }
      if (listEl) {
        listEl.innerHTML =
          '<p class="pd-collection-empty">Error al cargar los datos.</p>';
      }
    }
  } finally {
    state.collectionLoading[collection] = false;
  }
}

async function loadAllCollections(options = {}) {
  if (!state.isTeacher) return;
  const silent = options.silent ?? true;
  let hasError = false;
  await Promise.all(
    COLLECTION_KEYS.map((collection) =>
      loadCollection(collection, { silent, announce: false }).catch(() => {
        hasError = true;
      })
    )
  );
  if (options.announce) {
    if (hasError) {
      showBanner("Algunas colecciones no se pudieron actualizar.", "error");
    } else {
      showBanner("Colecciones actualizadas.", "success");
    }
  }
}

function setMemberForm(member = null) {
  if (!memberForm) return;
  memberForm.uid.value = member?.uid || "";
  memberForm.matricula.value = member?.matricula || "";
  memberForm.displayName.value = member?.displayName || member?.nombre || "";
  memberForm.email.value = member?.email || "";
  memberDeleteBtn.disabled = !member;
  memberForm.dataset.editing = member
    ? member.uid || member.id || member.matricula || ""
    : "";
}

if (membersBody)
  membersBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-member-id]");
    if (!row) return;
    const id = row.getAttribute("data-member-id");
    const member = state.members.find(
      (m) => (m.uid || m.id || m.matricula) === id
    );
    if (member) {
      setMemberForm(member);
    }
  });

if (memberForm)
  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.isTeacher) {
      showBanner(
        "Tu cuenta no tiene permisos para modificar alumnos.",
        "error"
      );
      return;
    }
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const matricula = (data.matricula || "").trim();
    const displayName = (data.displayName || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const uid = (data.uid || "").trim();
    if (!matricula || !displayName || !email) {
      showBanner("Completa nombre, matricula y correo.", "error");
      return;
    }
    const memberId = uid || matricula || email.replace(/[^a-z0-9]/gi, "-");
    if (!memberId) {
      showBanner(
        "No se pudo determinar un identificador para el alumno.",
        "error"
      );
      return;
    }
    try {
      const { doc, setDoc, serverTimestamp } = await getFirestore();
      const ref = doc(db, "grupos", state.groupId, "members", memberId);
      await setDoc(
        ref,
        {
          uid: uid || memberId,
          matricula,
          displayName,
          nombre: displayName,
          email,
          role: "student",
          updatedAt: serverTimestamp(),
          studentUid: uid || memberId,
        },
        { merge: true }
      );
      showBanner("Alumno guardado correctamente.", "success");
      appendActivity(`Alumno actualizado: ${displayName}`);
      logAdmin(`Alumno almacenado: ${displayName}`);
      setMemberForm(null);
    } catch (error) {
      console.error("save member", error);
      showBanner("Ocurrio un error al guardar al alumno.", "error");
    }
  });

if (memberResetBtn)
  memberResetBtn.addEventListener("click", () => {
    setMemberForm(null);
  });

if (memberDeleteBtn)
  memberDeleteBtn.addEventListener("click", async () => {
    if (!state.isTeacher) return;
    const editing = memberForm.dataset.editing;
    if (!editing) return;
    const confirmed = window.confirm(
      "Deseas eliminar al alumno seleccionado del grupo?"
    );
    if (!confirmed) return;
    try {
      const { doc, deleteDoc } = await getFirestore();
      await deleteDoc(doc(db, "grupos", state.groupId, "members", editing));
      showBanner("Alumno eliminado.", "success");
      appendActivity(`Alumno eliminado: ${editing}`);
      logAdmin(`Alumno eliminado: ${editing}`);
      setMemberForm(null);
    } catch (error) {
      console.error("delete member", error);
      showBanner("No se pudo eliminar al alumno.", "error");
    }
  });

if (uploadSearchInput)
  uploadSearchInput.addEventListener("input", (event) => {
    renderUploads(event.target.value);
  });

if (refreshUploadsBtn)
  refreshUploadsBtn.addEventListener("click", () => {
    renderUploads(uploadSearchInput.value || "");
    showBanner("Lista de evidencias actualizada.", "success");
  });

if (uploadsList)
  uploadsList.addEventListener("click", async (event) => {
    const action = event.target.getAttribute("data-action");
    if (!action) return;
    const uploadId = event.target.getAttribute("data-upload");
    const upload = state.uploads.find((item) => item.id === uploadId);
    if (!upload) return;
    if (action === "accept") {
      try {
        await markStudentUploadAccepted(uploadId, {
          uid: state.user?.uid || null,
          email: state.user?.email || null,
          displayName: state.user?.displayName || null,
        });
        showBanner("Evidencia marcada como revisada.", "success");
        appendActivity(
          `Evidencia revisada: ${
            upload.student?.displayName || upload.student?.email || uploadId
          }`
        );
        logAdmin(`Evidencia revisada: ${uploadId}`);
      } catch (error) {
        console.error("mark accepted", error);
        showBanner("No se pudo actualizar la evidencia.", "error");
      }
    }
    if (action === "grade") {
      const raw = window.prompt(
        "Calificacion (0 a 100)",
        upload.grade != null ? String(upload.grade) : ""
      );
      if (raw == null) return;
      const grade = Number(raw);
      if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
        showBanner("Ingresa un valor numerico entre 0 y 100.", "error");
        return;
      }
      try {
        await gradeStudentUpload(uploadId, {
          grade,
          upload,
          student: upload.student,
          groupId: state.groupId,
          teacher: {
            uid: state.user?.uid || null,
            email: state.user?.email || null,
            displayName: state.user?.displayName || null,
          },
        });
        showBanner("Calificacion registrada.", "success");
        appendActivity(
          `Calificacion guardada para ${
            upload.student?.displayName || upload.student?.email || uploadId
          }`
        );
        logAdmin(`Calificacion registrada: ${uploadId}`);
      } catch (error) {
        console.error("grade upload", error);
        showBanner("No se pudo registrar la calificacion.", "error");
      }
    }
    if (action === "delete") {
      const confirmed = window.confirm(
        "Deseas eliminar definitivamente esta evidencia? Se eliminara el archivo asociado."
      );
      if (!confirmed) return;
      try {
        await deleteStudentUpload(upload);
        showBanner("Evidencia eliminada.", "success");
        appendActivity(
          `Evidencia eliminada: ${
            upload.student?.displayName || upload.student?.email || uploadId
          }`
        );
        logAdmin(`Evidencia eliminada: ${uploadId}`);
      } catch (error) {
        console.error("delete upload", error);
        showBanner("No se pudo eliminar la evidencia.", "error");
      }
    }
  });

if (materialForm)
  materialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.isTeacher) {
      showBanner(
        "Tu cuenta no tiene permisos para publicar materiales.",
        "error"
      );
      return;
    }
    const data = Object.fromEntries(new FormData(materialForm).entries());
    if (!data.title || !data.url) {
      showBanner("Completa al menos el titulo y la URL.", "error");
      return;
    }
    try {
      const { collection, addDoc, serverTimestamp } = await getFirestore();
      await addDoc(collection(db, "materials"), {
        title: data.title,
        category: data.category || null,
        description: data.description || null,
        url: data.url,
        ownerEmail: state.user?.email || null,
        createdAt: serverTimestamp(),
      });
      materialForm.reset();
      showBanner("Material publicado.", "success");
      logAdmin(`Material publicado: ${data.title}`);
    } catch (error) {
      console.error("create material", error);
      showBanner("No se pudo publicar el material.", "error");
    }
  });

if (materialsList)
  materialsList.addEventListener("click", async (event) => {
    if (event.target.getAttribute("data-action") !== "delete-material") return;
    const id = event.target.getAttribute("data-material");
    if (!id) return;
    const confirmed = window.confirm(
      "Deseas eliminar este material del repositorio?"
    );
    if (!confirmed) return;
    try {
      const { doc, deleteDoc } = await getFirestore();
      await deleteDoc(doc(db, "materials", id));
      showBanner("Material eliminado.", "success");
      logAdmin(`Material eliminado: ${id}`);
    } catch (error) {
      console.error("delete material", error);
      showBanner("No se pudo eliminar el material.", "error");
    }
  });

if (allowlistForm)
  allowlistForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = (new FormData(allowlistForm).get("teacherEmail") || "")
      .trim()
      .toLowerCase();
    if (!email) {
      showBanner("Ingresa un correo institucional.", "error");
      return;
    }
    try {
      const { doc, setDoc, serverTimestamp, arrayUnion } = await getFirestore();
      await setDoc(
        doc(db, "config", "teacherAllowlist"),
        {
          emails: arrayUnion(email),
          updatedAt: serverTimestamp(),
          updatedByUid: state.user?.uid || null,
        },
        { merge: true }
      );
      allowlistForm.reset();
      showBanner("Correo agregado a la lista dinamica.", "success");
      appendActivity(`Correo autorizado: ${email}`);
      logAdmin(`Allowlist actualizado: ${email}`);
    } catch (error) {
      console.error("allowlist add", error);
      showBanner("No se pudo actualizar la lista dinamica.", "error");
    }
  });

if (allowlistViewBtn)
  allowlistViewBtn.addEventListener("click", async () => {
    try {
      const { doc, getDoc } = await getFirestore();
      const snap = await getDoc(doc(db, "config", "teacherAllowlist"));
      if (!snap.exists()) {
        allowlistView.value =
          "Documento config/teacherAllowlist no encontrado.";
        logAdmin("Lista dinamica vacia.");
        return;
      }
      const data = snap.data() || {};
      allowlistView.value = JSON.stringify(data, null, 2);
      logAdmin("Lista dinamica cargada.");
    } catch (error) {
      console.error("allowlist load", error);
      allowlistView.value = "Error al consultar la lista dinamica.";
      logAdmin("Error al consultar la lista dinamica.");
    }
  });

if (datasetsPanel) {
  datasetsPanel.addEventListener("click", async (event) => {
    const action = event.target.getAttribute("data-action");
    if (!action) return;
    if (action === "refresh-all-collections") {
      if (!state.isTeacher) {
        showBanner(
          "Tu cuenta no tiene permisos para modificar las colecciones.",
          "error"
        );
        return;
      }
      await loadAllCollections({ silent: false, announce: true });
      return;
    }
    const collection = event.target.getAttribute("data-collection");
    if (!collection) {
      if (action === "reset-form") {
        event.preventDefault();
      }
      return;
    }
    if (action === "refresh-collection") {
      if (!state.isTeacher) {
        showBanner(
          "Tu cuenta no tiene permisos para modificar las colecciones.",
          "error"
        );
        return;
      }
      await loadCollection(collection, { silent: false, announce: true });
      return;
    }
    if (action === "reset-form") {
      setCollectionFormState(collection, null);
      showBanner(
        `Formulario de ${getCollectionLabel(collection)} reiniciado.`,
        "info"
      );
      return;
    }
    if (action === "edit-doc") {
      const docId = event.target.getAttribute("data-doc") || "";
      if (!docId) return;
      const match = (state.collections[collection] || []).find(
        (item) => item.id === docId
      );
      if (match) {
        setCollectionFormState(collection, match);
        showBanner(`Documento ${docId} listo para edicion.`, "info");
      } else {
        showBanner(
          `No se encontro el documento ${docId} en ${collection}.`,
          "error"
        );
      }
      return;
    }
    if (action === "delete-doc") {
      event.preventDefault();
      if (!state.isTeacher) {
        showBanner(
          "Tu cuenta no tiene permisos para modificar las colecciones.",
          "error"
        );
        return;
      }
      const form = collectionForms[collection];
      const targetId =
        event.target.getAttribute("data-doc") ||
        (form?.elements.docId?.value || "").trim();
      if (!targetId) {
        showBanner("Selecciona un documento para eliminar.", "error");
        return;
      }
      const confirmed = window.confirm(
        `Deseas eliminar el documento "${targetId}" de ${collection}?`
      );
      if (!confirmed) return;
      try {
        const { doc, deleteDoc } = await getFirestore();
        await deleteDoc(doc(db, collection, targetId));
        appendActivity(`Documento eliminado (${collection}): ${targetId}`);
        logAdmin(`Documento eliminado: ${collection}/${targetId}`);
        showBanner(`Documento eliminado de ${collection}.`, "success");
        setCollectionFormState(collection, null);
        await loadCollection(collection, { silent: true });
      } catch (error) {
        console.error("delete collection doc", collection, error);
        showBanner(
          `No se pudo eliminar el documento en ${collection}.`,
          "error"
        );
      }
    }
  });

  datasetsPanel.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-collection-form]");
    if (!form) return;
    event.preventDefault();
    const collection = form.getAttribute("data-collection-form");
    if (!collection) return;
    if (!state.isTeacher) {
      showBanner(
        "Tu cuenta no tiene permisos para modificar las colecciones.",
        "error"
      );
      return;
    }
    const docId = (form.elements.docId?.value || "").trim();
    const rawData = (form.elements.docData?.value || "").trim();
    if (!rawData) {
      showBanner("Ingresa los datos del documento en formato JSON.", "error");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(rawData);
    } catch (_error) {
      showBanner("El contenido debe ser un JSON valido.", "error");
      return;
    }
    try {
      const firestore = await getFirestore();
      if (docId) {
        const data = { ...payload };
        if (typeof firestore.serverTimestamp === "function") {
          data.updatedAt = firestore.serverTimestamp();
        } else {
          data.updatedAt = new Date().toISOString();
        }
        await firestore.setDoc(firestore.doc(db, collection, docId), data, {
          merge: true,
        });
        appendActivity(`Documento actualizado (${collection}): ${docId}`);
        logAdmin(`Documento actualizado: ${collection}/${docId}`);
        showBanner(
          `Documento ${docId} actualizado en ${collection}.`,
          "success"
        );
        form.dataset.editing = docId;
      } else {
        const data = { ...payload };
        if (typeof firestore.serverTimestamp === "function") {
          data.createdAt = firestore.serverTimestamp();
        } else {
          data.createdAt = new Date().toISOString();
        }
        const ref = await firestore.addDoc(
          firestore.collection(db, collection),
          data
        );
        appendActivity(`Documento creado (${collection}): ${ref.id}`);
        logAdmin(`Documento creado: ${collection}/${ref.id}`);
        showBanner(`Documento creado en ${collection}.`, "success");
        if (form.elements.docId) form.elements.docId.value = ref.id;
        form.dataset.editing = ref.id;
      }
      if (form.elements.docData) {
        form.elements.docData.value = safeStringify(payload);
      }
      await loadCollection(collection, { silent: true });
    } catch (error) {
      console.error("save collection doc", collection, error);
      showBanner(`No se pudo guardar el documento en ${collection}.`, "error");
    }
  });
}

if (refreshOverviewBtn)
  refreshOverviewBtn.addEventListener("click", () => {
    renderOverview();
    showBanner("Resumen actualizado.", "success");
  });

async function loadGroupsOnce() {
  try {
    const { collection, getDocs, orderBy, query } = await getFirestore();
    const snap = await getDocs(
      query(collection(db, "grupos"), orderBy("nombre", "asc"))
    );
    const options = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      options.push({ id: docSnap.id, nombre: data.nombre || docSnap.id });
    });
    if (!options.length) {
      options.push({ id: state.groupId, nombre: state.groupId });
    }
    groupSelect.innerHTML = options
      .map(
        (option) =>
          `<option value="${option.id}" ${
            option.id === state.groupId ? "selected" : ""
          }>${option.nombre}</option>`
      )
      .join("");
  } catch (error) {
    console.error("load groups", error);
    groupSelect.innerHTML = `<option value="${state.groupId}" selected>${state.groupId}</option>`;
  }
}

if (groupSelect)
  groupSelect.addEventListener("change", (event) => {
    state.groupId = event.target.value || state.groupId;
    cleanupSubscriptions();
    subscribeMembers({ reset: true });
    subscribeUploads();
    renderOverview();
    showBanner(`Grupo activo: ${state.groupId}`, "info");
  });

async function subscribeMembers(options = {}) {
  if (!state.isTeacher) return;
  const { reset = false } = options;
  if (state.unsub.members) state.unsub.members();
  if (reset) {
    state.members = [];
    renderMembers();
    renderOverview();
  }
  try {
    const { collection, onSnapshot, orderBy, query } = await getFirestore();
    const q = query(collection(db, "grades"), orderBy("name", "asc"));
    state.unsub.members = onSnapshot(q, (snap) => {
      state.members = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          matricula: data.matricula || docSnap.id,
          displayName: data.name || data.displayName || docSnap.id,
          nombre: data.name || data.displayName || docSnap.id,
          email: data.email || "",
          updatedAt: data.updatedAt
            ? data.updatedAt.toDate().toISOString()
            : null,
        };
      });
      renderMembers();
      renderOverview();
      syncRosterCacheFromMembers(state.members);
    });
  } catch (error) {
    console.error("members snapshot", error);
    showBanner("No se pudieron cargar los alumnos del grupo.", "error");
  }
}

async function subscribeUploads() {
  if (state.unsub.uploads) state.unsub.uploads();
  state.unsub.uploads = observeAllStudentUploads(
    (items) => {
      state.uploads = items.map((item) => {
        const submittedAt = item.submittedAt?.toDate
          ? item.submittedAt.toDate().toISOString()
          : item.submittedAt || null;
        return {
          ...item,
          submittedAt,
        };
      });
      renderUploads(uploadSearchInput.value || "");
      renderOverview();
    },
    (error) => {
      console.error("uploads", error);
      showBanner("No se pudieron cargar las evidencias.", "error");
    }
  );
}

async function subscribeMaterials() {
  if (state.unsub.materials) state.unsub.materials();
  try {
    const { collection, onSnapshot, orderBy, query } = await getFirestore();
    const q = query(collection(db, "materials"), orderBy("createdAt", "desc"));
    state.unsub.materials = onSnapshot(q, (snap) => {
      state.materials = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          title: data.title || "Recurso",
          category: data.category || null,
          description: data.description || null,
          url: data.url || "#",
          createdAt: data.createdAt
            ? data.createdAt.toDate().toISOString()
            : null,
        };
      });
      renderMaterials();
      renderOverview();
    });
  } catch (error) {
    console.error("materials snapshot", error);
    showBanner("No se pudieron cargar los materiales.", "error");
  }
}

async function subscribeGrades() {
  if (!state.isTeacher) return;
  if (state.unsub.grades) state.unsub.grades();

  try {
    const { collection, onSnapshot } = await getFirestore();
    const q = collection(db, "grades");
    state.unsub.grades = onSnapshot(q, (snap) => {
      snap.forEach((docSnap) => {
        state.grades[docSnap.id] = docSnap.data();
      });
      renderMembers();
    });
  } catch (error) {
    console.error("grades snapshot", error);
    showBanner("No se pudieron cargar las calificaciones.", "error");
  }
}

function stopAllSubscriptions() {
  cleanupSubscriptions();
  state.members = [];
  state.uploads = [];
  state.materials = [];
  state.collections = createEmptyCollectionsState();
  state.collectionLoading = {};
  renderMembers();
  renderUploads();
  renderMaterials();
  renderAllCollections();
  renderOverview();
  resetAllCollectionForms();
}

auth.signIn.addEventListener("click", async () => {
  try {
    await signInWithGooglePotros();
  } catch (error) {
    console.error("sign in", error);
    showBanner("No se pudo iniciar sesion.", "error");
  }
});

auth.signOut.addEventListener("click", async () => {
  try {
    await signOutCurrent();
  } catch (error) {
    console.error("sign out", error);
  }
});

async function ensureTeacher(user) {
  if (!user) return false;
  await ensureTeacherAllowlistLoaded();
  let teacher = false;
  try {
    teacher = await isTeacherByDoc(user.uid);
  } catch (_) {}
  if (!teacher && user.email && isTeacherEmail(user.email)) {
    try {
      teacher = await ensureTeacherDocForUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (_) {}
  }
  return teacher;
}

async function handleAuth(user) {
  stopAllSubscriptions();
  state.user = user;
  setUserUI(user);
  if (!user) {
    state.isTeacher = false;
    showBanner(
      "Inicia sesion con tu cuenta de docente para acceder al panel.",
      "info"
    );
    switchView("overview");
    return;
  }
  showBanner("Verificando permisos...", "info");
  const isTeacher = await ensureTeacher(user);
  state.isTeacher = !!isTeacher;
  if (!state.isTeacher) {
    showBanner("Tu cuenta no tiene permisos de docente.", "error");
    return;
  }
  showBanner("Bienvenido al panel docente.", "success");
  logAdmin(`Sesion docente activa: ${user.email || user.uid}`);
  await loadGroupsOnce();
  subscribeMembers();
  subscribeUploads();
  subscribeMaterials();
  subscribeGrades();
  await loadAllCollections({ silent: true });
  renderOverview();
}

renderMembers();
renderUploads();
renderMaterials();
renderAllCollections();
renderOverview();
renderActivityLog();

onAuth(handleAuth);

window.addEventListener("beforeunload", () => {
  cleanupSubscriptions();
});
