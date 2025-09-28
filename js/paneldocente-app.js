import {
  initFirebase,
  getDb,
  onAuth,
  signInWithGooglePotros,
  signOutCurrent,
  ensureTeacherAllowlistLoaded,
  ensureTeacherDocForUser,
  isTeacherByDoc,
  isTeacherEmail
} from "./firebase.js";
import {
  observeAllStudentUploads,
  markStudentUploadAccepted,
  gradeStudentUpload,
  deleteStudentUpload
} from "./student-uploads.js";

initFirebase();
const db = getDb();

const state = {
  user: null,
  isTeacher: false,
  groupId: "calidad-2025",
  members: [],
  uploads: [],
  materials: [],
  activityLog: [],
  allowlist: [],
  unsub: {
    members: null,
    uploads: null,
    materials: null
  }
};

const auth = {
  email: document.getElementById("pd-user-email"),
  signIn: document.getElementById("pd-sign-in"),
  signOut: document.getElementById("pd-sign-out")
};

const banner = document.getElementById("pd-status-banner");
const groupSelect = document.getElementById("pd-group-select");
const overviewCounters = {
  members: document.getElementById("pd-count-members"),
  uploads: document.getElementById("pd-count-uploads"),
  pending: document.getElementById("pd-count-pending"),
  materials: document.getElementById("pd-count-materials")
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

const allowlistForm = document.getElementById("pd-allowlist-form");
const allowlistViewBtn = document.getElementById("pd-load-allowlist");
const allowlistView = document.getElementById("pd-allowlist-view");
const adminLog = document.getElementById("pd-admin-log");

const viewButtons = document.querySelectorAll('[data-action="switch-view"]');
const viewPanels = document.querySelectorAll('[data-view-panel]');

const firestorePromise = import("https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js");
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

function setUserUI(user) {
  if (auth.email) {
    auth.email.textContent = user ? (user.email || "Sin correo") : "";
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
    panel.classList.toggle("active", panel.getAttribute("data-view-panel") === target);
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
  const previous = adminLogEl.textContent ? ("\n" + adminLogEl.textContent) : "";
  adminLogEl.textContent = `[${stamp}] ${message}` + previous;
}

function renderActivityLog() {
  if (!activityLogEl) return;
  if (!state.activityLog.length) {
    activityLogEl.textContent = "Sin actividad reciente.";
    return;
  }
  activityLogEl.textContent = state.activityLog.join("
");
}

function renderOverview() {
  if (overviewCounters.members) { overviewCounters.members.textContent = state.members.length.toString(); }
  const totalUploads = state.uploads.length;
  const pendingUploads = state.uploads.filter((u) => !u.status || u.status === "enviado").length;
  if (overviewCounters.uploads) { overviewCounters.uploads.textContent = totalUploads.toString(); }
  if (overviewCounters.pending) { overviewCounters.pending.textContent = pendingUploads.toString(); }
  if (overviewCounters.materials) { overviewCounters.materials.textContent = state.materials.length.toString(); }
}

function renderMembers() {
  if (!membersBody) return;
  if (!state.members.length) {
    membersBody.innerHTML = '<tr><td colspan="5" class="pd-empty">Sin alumnos registrados.</td></tr>';
    return;
  }
  membersBody.innerHTML = state.members
    .map((member) => {
      const updated = member.updatedAt ? new Date(member.updatedAt).toLocaleString() : "--";
      return `
        <tr data-member-id="${member.uid || member.id || member.matricula || ""}">
          <td>${member.displayName || member.nombre || "Sin nombre"}</td>
          <td>${member.matricula || "--"}</td>
          <td>${member.email || "--"}</td>
          <td>${member.uid || "--"}</td>
          <td>${updated}</td>
        </tr>
      `;
    })
    .join("
");
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
        upload.extra?.activityId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }
  if (!items.length) {
    uploadsList.innerHTML = '<p class="pd-empty">Sin evidencias registradas.</p>';
    return;
  }
  uploadsList.innerHTML = items
    .map((upload) => {
      const status = upload.status || "enviado";
      const submitted = upload.submittedAt
        ? new Date(upload.submittedAt).toLocaleString()
        : "Sin fecha";
      const name = upload.student?.displayName || upload.student?.email || "Alumno";
      const fileLink = upload.fileUrl
        ? `<a href="${upload.fileUrl}" target="_blank" rel="noopener">${upload.fileName || "Ver evidencia"}</a>`
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
            <button type="button" class="pd-button secondary" data-action="accept" data-upload="${upload.id}">Marcar como revisado</button>
            <button type="button" class="pd-button secondary" data-action="grade" data-upload="${upload.id}">Calificar</button>
            <button type="button" class="pd-button danger" data-action="delete" data-upload="${upload.id}">Eliminar</button>
          </div>
        </article>
      `;
    })
    .join("
");
}

function renderMaterials() {
  if (!materialsList) return;
  if (!state.materials.length) {
    materialsList.innerHTML = '<p class="pd-empty">Aun no hay materiales registrados.</p>';
    return;
  }
  materialsList.innerHTML = state.materials
    .map((material) => {
      const created = material.createdAt ? new Date(material.createdAt).toLocaleString() : "--";
      const category = material.category ? `<span class="pd-muted">${material.category}</span>` : "";
      const description = material.description ? `<p class="pd-muted">${material.description}</p>` : "";
      return `
        <div class="pd-material-item" data-material-id="${material.id}">
          <div class="pd-flex">
            <strong>${material.title || "Recurso"}</strong>
            ${category}
          </div>
          ${description}
          <div class="pd-flex">
            <a class="pd-button secondary" href="${material.url || "#"}" target="_blank" rel="noopener">Abrir recurso</a>
            <button type="button" class="pd-button danger" data-action="delete-material" data-material="${material.id}">Eliminar</button>
            <span class="pd-muted">${created}</span>
          </div>
        </div>
      `;
    })
    .join("
");
}

function setMemberForm(member = null) {
  if (!memberForm) return;
  memberForm.uid.value = member?.uid || "";
  memberForm.matricula.value = member?.matricula || "";
  memberForm.displayName.value = member?.displayName || member?.nombre || "";
  memberForm.email.value = member?.email || "";
  memberDeleteBtn.disabled = !member;
  memberForm.dataset.editing = member ? (member.uid || member.id || member.matricula || "") : "";
}

if (membersBody) membersBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-member-id]");
  if (!row) return;
  const id = row.getAttribute("data-member-id");
  const member = state.members.find((m) => (m.uid || m.id || m.matricula) === id);
  if (member) {
    setMemberForm(member);
  }
});

if (memberForm) memberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.isTeacher) {
    showBanner("Tu cuenta no tiene permisos para modificar alumnos.", "error");
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
    showBanner("No se pudo determinar un identificador para el alumno.", "error");
    return;
  }
  try {
    const { doc, setDoc, serverTimestamp } = await getFirestore();
    const ref = doc(db, "grupos", state.groupId, "members", memberId);
    await setDoc(ref, {
      uid: uid || memberId,
      matricula,
      displayName,
      nombre: displayName,
      email,
      role: "student",
      updatedAt: serverTimestamp(),
      studentUid: uid || memberId
    }, { merge: true });
    showBanner("Alumno guardado correctamente.", "success");
    appendActivity(`Alumno actualizado: ${displayName}`);
    logAdmin(`Alumno almacenado: ${displayName}`);
    setMemberForm(null);
  } catch (error) {
    console.error("save member", error);
    showBanner("Ocurrio un error al guardar al alumno.", "error");
  }
});

if (memberResetBtn) memberResetBtn.addEventListener("click", () => {
  setMemberForm(null);
});

if (memberDeleteBtn) memberDeleteBtn.addEventListener("click", async () => {
  if (!state.isTeacher) return;
  const editing = memberForm.dataset.editing;
  if (!editing) return;
  const confirmed = window.confirm("Deseas eliminar al alumno seleccionado del grupo?");
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

if (uploadSearchInput) uploadSearchInput.addEventListener("input", (event) => {
  renderUploads(event.target.value);
});

if (refreshUploadsBtn) refreshUploadsBtn.addEventListener("click", () => {
  renderUploads(uploadSearchInput.value || "");
  showBanner("Lista de evidencias actualizada.", "success");
});

if (uploadsList) uploadsList.addEventListener("click", async (event) => {
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
        displayName: state.user?.displayName || null
      });
      showBanner("Evidencia marcada como revisada.", "success");
      appendActivity(`Evidencia revisada: ${upload.student?.displayName || upload.student?.email || uploadId}`);
      logAdmin(`Evidencia revisada: ${uploadId}`);
    } catch (error) {
      console.error("mark accepted", error);
      showBanner("No se pudo actualizar la evidencia.", "error");
    }
  }
  if (action === "grade") {
    const raw = window.prompt("Calificacion (0 a 100)", upload.grade != null ? String(upload.grade) : "");
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
          displayName: state.user?.displayName || null
        }
      });
      showBanner("Calificacion registrada.", "success");
      appendActivity(`Calificacion guardada para ${upload.student?.displayName || upload.student?.email || uploadId}`);
      logAdmin(`Calificacion registrada: ${uploadId}`);
    } catch (error) {
      console.error("grade upload", error);
      showBanner("No se pudo registrar la calificacion.", "error");
    }
  }
  if (action === "delete") {
    const confirmed = window.confirm("Deseas eliminar definitivamente esta evidencia? Se eliminara el archivo asociado.");
    if (!confirmed) return;
    try {
      await deleteStudentUpload(upload);
      showBanner("Evidencia eliminada.", "success");
      appendActivity(`Evidencia eliminada: ${upload.student?.displayName || upload.student?.email || uploadId}`);
      logAdmin(`Evidencia eliminada: ${uploadId}`);
    } catch (error) {
      console.error("delete upload", error);
      showBanner("No se pudo eliminar la evidencia.", "error");
    }
  }
});

if (materialForm) materialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.isTeacher) {
    showBanner("Tu cuenta no tiene permisos para publicar materiales.", "error");
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
      createdAt: serverTimestamp()
    });
    materialForm.reset();
    showBanner("Material publicado.", "success");
    logAdmin(`Material publicado: ${data.title}`);
  } catch (error) {
    console.error("create material", error);
    showBanner("No se pudo publicar el material.", "error");
  }
});

if (materialsList) materialsList.addEventListener("click", async (event) => {
  if (event.target.getAttribute("data-action") !== "delete-material") return;
  const id = event.target.getAttribute("data-material");
  if (!id) return;
  const confirmed = window.confirm("Deseas eliminar este material del repositorio?");
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

if (allowlistForm) allowlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = (new FormData(allowlistForm).get("teacherEmail") || "").trim().toLowerCase();
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
        updatedByUid: state.user?.uid || null
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

if (allowlistViewBtn) allowlistViewBtn.addEventListener("click", async () => {
  try {
    const { doc, getDoc } = await getFirestore();
    const snap = await getDoc(doc(db, "config", "teacherAllowlist"));
    if (!snap.exists()) {
      allowlistView.value = "Documento config/teacherAllowlist no encontrado.";
      logAdmin('Lista dinamica vacia.');
      return;
    }
    const data = snap.data() || {};
    allowlistView.value = JSON.stringify(data, null, 2);
    logAdmin('Lista dinamica cargada.');
  } catch (error) {
    console.error("allowlist load", error);
    allowlistView.value = "Error al consultar la lista dinamica.";
    logAdmin('Error al consultar la lista dinamica.');
  }
});

if (refreshOverviewBtn) refreshOverviewBtn.addEventListener("click", () => {
  renderOverview();
  showBanner("Resumen actualizado.", "success");
});

async function loadGroupsOnce() {
  try {
    const { collection, getDocs, orderBy, query } = await getFirestore();
    const snap = await getDocs(query(collection(db, "grupos"), orderBy("nombre", "asc")));
    const options = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      options.push({ id: docSnap.id, nombre: data.nombre || docSnap.id });
    });
    if (!options.length) {
      options.push({ id: state.groupId, nombre: state.groupId });
    }
    groupSelect.innerHTML = options
      .map((option) => `<option value="${option.id}" ${option.id === state.groupId ? "selected" : ""}>${option.nombre}</option>`)
      .join("
");
  } catch (error) {
    console.error("load groups", error);
    groupSelect.innerHTML = `<option value="${state.groupId}" selected>${state.groupId}</option>`;
  }
}

if (groupSelect) groupSelect.addEventListener("change", (event) => {
  state.groupId = event.target.value || state.groupId;
  cleanupSubscriptions();
  subscribeMembers();
  subscribeUploads();
  renderOverview();
  showBanner(`Grupo activo: ${state.groupId}`, "info");
});

async function subscribeMembers() {
  if (!state.isTeacher) return;
  if (state.unsub.members) state.unsub.members();
  try {
    const { collection, doc, onSnapshot, orderBy, query } = await getFirestore();
    const q = query(collection(db, "grupos", state.groupId, "members"), orderBy("nombre", "asc"));
    state.unsub.members = onSnapshot(q, (snap) => {
      state.members = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          matricula: data.matricula || docSnap.id,
          displayName: data.displayName || data.nombre || docSnap.id,
          nombre: data.nombre || data.displayName || docSnap.id,
          email: data.email || "",
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null
        };
      });
      renderMembers();
      renderOverview();
    });
  } catch (error) {
    console.error("members snapshot", error);
    showBanner("No se pudieron cargar los alumnos del grupo.", "error");
  }
}

async function subscribeUploads() {
  if (state.unsub.uploads) state.unsub.uploads();
  state.unsub.uploads = observeAllStudentUploads((items) => {
    state.uploads = items.map((item) => {
      const submittedAt = item.submittedAt?.toDate ? item.submittedAt.toDate().toISOString() : item.submittedAt || null;
      return {
        ...item,
        submittedAt
      };
    });
    renderUploads(uploadSearchInput.value || "");
    renderOverview();
  }, (error) => {
    console.error("uploads", error);
    showBanner("No se pudieron cargar las evidencias.", "error");
  });
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
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
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

function stopAllSubscriptions() {
  cleanupSubscriptions();
  state.members = [];
  state.uploads = [];
  state.materials = [];
  renderMembers();
  renderUploads();
  renderMaterials();
  renderOverview();
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
        displayName: user.displayName
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
    showBanner("Inicia sesion con tu cuenta de docente para acceder al panel.", "info");
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
  renderOverview();
}

renderMembers();
renderUploads();
renderMaterials();
renderOverview();
renderActivityLog();

onAuth(handleAuth);

window.addEventListener("beforeunload", () => {
  cleanupSubscriptions();
});
