// js/calificaciones-teacher-sync.js
// Sincroniza las capturas de calificaciones del docente con Firestore para que
// el alumno pueda consultarlas desde su sesión.

import { initFirebase, getDb } from "./firebase.js";
import {
  getPrimaryDocId,
  buildCandidateDocIds,
} from "./calificaciones-helpers.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

initFirebase();
const db = getDb();
const root = document.getElementById("calificaciones-root") || document.body;
const params = new URLSearchParams(location.search || "");
const GRUPO_ID = (
  root?.dataset?.grupo ||
  params.get("grupo") ||
  "calidad-2025"
).trim();

let localSave = null;
let localLoad = null;
let localClear = null;

function initializeBaseFunctions() {
  localSave =
    typeof window.saveStudentGrades === "function"
      ? window.saveStudentGrades.bind(window)
      : null;
  localLoad =
    typeof window.loadStudentGrades === "function"
      ? window.loadStudentGrades.bind(window)
      : null;
  localClear =
    typeof window.clearAllGrades === "function"
      ? window.clearAllGrades.bind(window)
      : null;

  if (!localSave || !localLoad) {
    console.warn(
      "[calificaciones-teacher-sync] funciones base no disponibles. Asegúrate de que calificaciones.js se carga correctamente."
    );
  } else {
    patchFunctions();
  }
}

function isTeacherRole() {
  try {
    const stored = (
      localStorage.getItem("qs_role") || "estudiante"
    ).toLowerCase();
    if (stored === "docente") return true;
  } catch (_) {}
  return document.documentElement.classList.contains("role-teacher");
}

function isTeacherUiEnabled() {
  try {
    var input = document.querySelector(".grade-input");
    if (input && !input.disabled && !input.readOnly) return true;
    var toolbar = document.querySelector(".teacher-only");
    if (toolbar) {
      var style = window.getComputedStyle ? getComputedStyle(toolbar) : null;
      if (style && style.display !== "none" && style.visibility !== "hidden")
        return true;
    }
  } catch (_) {}
  return false;
}

function shouldUseFirestore() {
  if (!db) return false;
  if (isTeacherRole()) return true;
  return isTeacherUiEnabled();
}

function rosterStudents() {
  if (typeof window === "undefined") return [];
  const list = window.students;
  return Array.isArray(list) ? list : [];
}

function normalizeLower(value) {
  if (value == null) return "";
  try {
    return String(value).trim().toLowerCase();
  } catch (_) {
    return "";
  }
}

function resolveStudentProfile(profile = {}) {
  const initialUid = profile.uid ? String(profile.uid).trim() : "";
  const resolved = {
    id: profile.id || profile.studentId || profile.matricula || null,
    studentId: profile.studentId || profile.id || profile.matricula || null,
    matricula: profile.matricula || profile.studentId || profile.id || null,
    name: profile.name || profile.displayName || null,
    email: profile.email ? String(profile.email).trim() : null,
    uid: initialUid || null,
  };

  const roster = rosterStudents();
  const idCandidates = [profile.id, profile.studentId, profile.matricula]
    .map(normalizeLower)
    .filter(Boolean);
  const emailLower = normalizeLower(profile.email);
  let match = null;

  if (idCandidates.length) {
    match = roster.find((student) => {
      if (!student) return false;
      const studentIdLower = normalizeLower(student.id);
      const matriculaLower = normalizeLower(student.matricula);
      return idCandidates.some(
        (candidate) =>
          (studentIdLower && candidate === studentIdLower) ||
          (matriculaLower && candidate === matriculaLower)
      );
    });
  }

  if (!match && emailLower) {
    match = roster.find(
      (student) => normalizeLower(student && student.email) === emailLower
    );
  }

  if (match) {
    if (!resolved.uid && match.uid) {
      const matchUid = String(match.uid).trim();
      if (matchUid) resolved.uid = matchUid;
    }
    if (!resolved.email && match.email) {
      resolved.email = match.email;
    }
    if (!resolved.name) {
      resolved.name =
        match.displayName ||
        match.name ||
        match.nombre ||
        resolved.name ||
        null;
    }
    if (!resolved.studentId && (match.id || match.matricula)) {
      resolved.studentId = match.id || match.matricula;
    }
    if (!resolved.matricula && (match.matricula || match.id)) {
      resolved.matricula = match.matricula || match.id;
    }
  }

  if (!resolved.id && resolved.studentId) {
    resolved.id = resolved.studentId;
  }

  resolved.emailLower = normalizeLower(resolved.email) || null;

  return resolved;
}

function detectUnidad(input) {
  const unit = input.closest(".unit-content");
  if (unit && /^unit([123])$/.test(unit.id)) {
    return Number(RegExp.$1);
  }
  if (input.closest("#project")) return 3;
  return null;
}

function inferTipo(nombre, unidad, isProject) {
  if (isProject) return "Proyecto final";
  const lower = (nombre || "").toLowerCase();
  if (lower.includes("examen")) return "Examen";
  if (lower.includes("participación")) return "Participación";
  if (lower.includes("foro")) return "Foro";
  if (lower.includes("taller")) return "Taller";
  if (lower.includes("rúbrica")) return "Rúbrica";
  if (unidad) return `Unidad ${unidad}`;
  return "Actividad";
}

function getLabelText(input) {
  const container = input.closest(".grade-item");
  if (!container) return "";
  const heading = container.querySelector("h4, h5, strong");
  return heading ? heading.textContent.trim() : "";
}

const gradeInputs = Array.from(document.querySelectorAll(".grade-input"));
const projectInputs = Array.from(
  document.querySelectorAll(".project-grade-input")
);

const gradeMetas = gradeInputs.map((input, index) => {
  const unidad = detectUnidad(input);
  const nombre = getLabelText(input) || `Actividad ${index + 1}`;
  const inputMax = parseFloat(input.getAttribute("max")) || 10;
  return {
    key: `g-${index}`,
    input,
    unidad,
    nombre,
    tipo: inferTipo(nombre, unidad, false),
    ponderacion:
      parseFloat(input.dataset.weight || input.getAttribute("data-weight")) ||
      0,
    scale: 10,
    inputMax,
  };
});
const gradeMetaMap = new Map(gradeMetas.map((meta) => [meta.key, meta]));

const projectMetas = projectInputs.map((input, index) => {
  const nombre = getLabelText(input) || `Rúbrica ${index + 1}`;
  const inputMax = parseFloat(input.getAttribute("max")) || 10;
  return {
    key: `p-${index}`,
    input,
    unidad: 3,
    nombre,
    tipo: inferTipo(nombre, 3, true),
    ponderacion:
      parseFloat(input.dataset.weight || input.getAttribute("data-weight")) ||
      0,
    scale: 10,
    inputMax,
  };
});
const projectMetaMap = new Map(projectMetas.map((meta) => [meta.key, meta]));

function setInputValue(meta, item) {
  const input = meta && meta.input;
  if (!input) return;
  if (!item || (item.puntos == null && item.rawPuntos == null)) {
    input.value = "";
    return;
  }
  const scale = Number(meta.scale || 10) || 10;
  const inputMax = Number(meta.inputMax || scale) || scale;
  let rawValue = null;
  if (item.rawPuntos != null) {
    rawValue = Number(item.rawPuntos);
  } else {
    const normalized = Number(item.puntos) || 0;
    const clampedNormalized = Math.max(0, Math.min(normalized, scale));
    const ratio = scale > 0 ? clampedNormalized / scale : 0;
    rawValue = ratio * inputMax;
  }
  if (!Number.isFinite(rawValue)) {
    input.value = "";
    return;
  }
  input.value = String(Number(rawValue.toFixed(2)));
}

function resetInputs() {
  gradeMetas.forEach((meta) => {
    if (meta && meta.input) meta.input.value = "";
  });
  projectMetas.forEach((meta) => {
    if (meta && meta.input) meta.input.value = "";
  });
}

// Ya no se aplican items a inputs ni se recalculan localmente. Solo se sincronizan los datos calculados por actividades.js
function applyItemsToInputs(items) {
  // No hacer nada, los datos ya están calculados y sincronizados por actividades.js
}

function collectItemsForFirestore() {
  const items = [];
  for (let i = 0; i < gradeMetas.length; i++) {
    const meta = gradeMetas[i];
    if (!meta || !meta.input) continue;
    const raw = meta.input.value;
    if (raw === "" || raw == null) continue;
    const rawValue = Number(raw);
    if (!Number.isFinite(rawValue)) continue;
    const inputMax = Number(meta.inputMax || 10) || 10;
    const scale = Number(meta.scale || 10) || 10;
    const clampedRaw = Math.max(0, Math.min(rawValue, inputMax));
    const ratio = inputMax > 0 ? clampedRaw / inputMax : 0;
    const normalized = ratio * scale;
    items.push({
      key: meta.key,
      nombre: meta.nombre,
      tipo: meta.tipo,
      unidad: meta.unidad,
      ponderacion: meta.ponderacion,
      maxPuntos: scale,
      puntos: Number(normalized.toFixed(3)),
      rawPuntos: Number(clampedRaw.toFixed(2)),
      rawMaxPuntos: inputMax,
      fecha: null,
    });
  }
  for (let i = 0; i < projectMetas.length; i++) {
    const meta = projectMetas[i];
    if (!meta || !meta.input) continue;
    const raw = meta.input.value;
    if (raw === "" || raw == null) continue;
    const rawValue = Number(raw);
    if (!Number.isFinite(rawValue)) continue;
    const inputMax = Number(meta.inputMax || 10) || 10;
    const scale = Number(meta.scale || 10) || 10;
    const clampedRaw = Math.max(0, Math.min(rawValue, inputMax));
    const ratio = inputMax > 0 ? clampedRaw / inputMax : 0;
    const normalized = ratio * scale;
    items.push({
      key: meta.key,
      nombre: meta.nombre,
      tipo: meta.tipo,
      unidad: meta.unidad,
      ponderacion: meta.ponderacion,
      maxPuntos: scale,
      puntos: Number(normalized.toFixed(3)),
      rawPuntos: Number(clampedRaw.toFixed(2)),
      rawMaxPuntos: inputMax,
      fecha: null,
    });
  }
  return items;
}

function buildProfile(studentId) {
  const nameEl = document.getElementById("studentName");
  const emailEl = document.getElementById("studentEmail");
  const select = document.getElementById("studentSelect");
  let option = select?.selectedOptions?.[0] || null;
  if (select && studentId) {
    const match = Array.from(select.options || []).find(
      (opt) => opt?.value === studentId
    );
    if (match) option = match;
  }
  const base = {
    id: studentId || null,
    studentId: studentId || null,
    matricula: studentId || null,
    name: nameEl ? nameEl.value || null : null,
    email: emailEl ? emailEl.value || null : null,
  };
  if (option?.dataset) {
    const optionEmail = option.dataset.email ? option.dataset.email.trim() : "";
    if (!base.email && optionEmail) {
      base.email = optionEmail;
    }
    const optionUid = option.dataset.uid ? option.dataset.uid.trim() : "";
    if (optionUid) {
      base.uid = optionUid;
    }
    if (!base.name && option.dataset.name) {
      base.name = option.dataset.name;
    }
    if (!base.matricula && option.dataset.matricula) {
      base.matricula = option.dataset.matricula;
    }
  }
  return resolveStudentProfile(base);
}

async function fetchRemoteItems(profile) {
  if (!shouldUseFirestore()) return null;
  const normalized = resolveStudentProfile(profile || {});
  const candidates = buildCandidateDocIds(normalized);
  if (!candidates.length) return null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      const ref = doc(db, "grupos", GRUPO_ID, "calificaciones", candidates[i]);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (Array.isArray(data.items)) return data.items;
        return [];
      }
    } catch (err) {
      console.warn("[calificaciones-teacher-sync] fetchRemoteItems", err);
    }
  }
  const uid = normalized && normalized.uid ? normalized.uid : null;
  if (!uid) return [];
  try {
    const calificacionRef = doc(db, "grupos", GRUPO_ID, "calificaciones", uid);
    const base = collection(calificacionRef, "items");
    const snap = await getDocs(query(base, orderBy("fecha", "asc")));
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn("[calificaciones-teacher-sync] fetchRemoteItems", err);
    return [];
  }
}

async function persistRemoteItems(profile, items) {
  if (!shouldUseFirestore()) return;
  const normalized = resolveStudentProfile(profile || {});
  const candidates = buildCandidateDocIds(normalized);
  let docId = getPrimaryDocId(normalized);
  if (!docId && candidates.length) {
    docId = candidates[0];
  }
  if (!docId) return;
  const lowerEmail =
    normalized.emailLower && normalized.emailLower.length
      ? normalized.emailLower
      : null;
  const studentUid = normalized.uid ? String(normalized.uid).trim() : null;
  const primaryId =
    normalized.studentId || normalized.id || normalized.matricula || null;

  const payload = {
    studentName:
      normalized.name ||
      existingData.studentName ||
      legacyBase.studentName ||
      null,
    studentEmail:
      normalized.email ||
      existingData.studentEmail ||
      legacyBase.studentEmail ||
      null,
    studentEmailLower: lowerEmail,
    studentUid:
      studentUid || existingData.studentUid || legacyBase.studentUid || null,
    updatedAt: serverTimestamp(),
  };

  if (!existingSnap || !existingSnap.exists()) {
    if (legacyBase.createdAt) {
      payload.createdAt = legacyBase.createdAt;
    } else if (!payload.createdAt) {
      payload.createdAt = serverTimestamp();
    }
  }

  try {
    await setDoc(calificacionesRef, payload, { merge: true });
  } catch (err) {
    console.error("[calificaciones-teacher-sync] persistRemoteItems", err);
    return;
  }

  if (legacyRef && legacyRef.id !== docId) {
    try {
      await deleteDoc(legacyRef);
    } catch (err) {
      console.warn("[calificaciones-teacher-sync] cleanup legacy doc", err);
    }
  }

  if (studentUid) {
    try {
      const memberRef = doc(db, "grupos", GRUPO_ID, "members", studentUid);
      const memberSnap = await getDoc(memberRef);
      const existingMember = memberSnap.exists() ? memberSnap.data() || {} : {};
      const memberDisplayName =
        normalized.name ||
        normalized.displayName ||
        existingMember.displayName ||
        existingMember.nombre ||
        normalized.email ||
        primaryId ||
        studentUid;
      const memberNombre =
        normalized.name || existingMember.nombre || memberDisplayName;
      const memberEmail = normalized.email || existingMember.email || "";
      const memberMatricula = primaryId || existingMember.matricula || "";
      const memberRole = existingMember.role || "student";
      const memberUpdatedAt = serverTimestamp();
      const memberPayload = {
        uid: studentUid,
        displayName: memberDisplayName,
        nombre: memberNombre,
        email: memberEmail,
        matricula: memberMatricula,
        role: memberRole,
        updatedAt: memberUpdatedAt,
        calificacionesDocId: docId,
        calificacionesDocPath: calificacionesRef.path,
        calificacionesSnapshot: payload.items,
        calificacionesUpdatedAt: serverTimestamp(),
      };
      if (!memberSnap.exists()) {
        memberPayload.createdAt = serverTimestamp();
      }
      await setDoc(memberRef, memberPayload, { merge: true });
    } catch (err) {
      console.warn("[calificaciones-teacher-sync] members", err);
    }
  }
}

const remoteSync = (() => {
  let timer = null;
  let lastProfile = null;
  return {
    schedule(profile) {
      if (!shouldUseFirestore()) return;
      const normalizedProfile = resolveStudentProfile(profile || {});
      lastProfile = normalizedProfile;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const items = collectItemsForFirestore();
        persistRemoteItems(normalizedProfile, items).catch((err) => {
          console.error("[calificaciones-teacher-sync] scheduleSync", err);
        });
      }, 800);
    },
    async flush(profile) {
      if (!shouldUseFirestore()) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const targetProfile = profile
        ? resolveStudentProfile(profile)
        : lastProfile;
      if (!targetProfile) return;
      lastProfile = targetProfile;
      const items = collectItemsForFirestore();
      await persistRemoteItems(targetProfile, items);
    },
  };
})();

function patchFunctions() {
  if (localLoad) {
    window.loadStudentGrades = function patchedLoad(studentId) {
      const profile = buildProfile(studentId);
      if (!shouldUseFirestore()) {
        return localLoad(studentId);
      }
      fetchRemoteItems(profile)
        .then((items) => {
          if (items === null) {
            localLoad(studentId);
            return;
          }
          const activeId = document.getElementById("studentId")?.value || null;
          const targetId = profile.studentId || profile.id || null;
          if (targetId && activeId && targetId !== activeId) {
            return;
          }
          applyItemsToInputs(items);
          if (localSave && studentId) {
            localSave(studentId);
          }
        })
        .catch((err) => {
          console.error("[calificaciones-teacher-sync] loadStudentGrades", err);
          localLoad(studentId);
        });
    };
  }

  if (localSave) {
    window.saveStudentGrades = function patchedSave(studentId) {
      localSave(studentId);
      if (!studentId) return;
      const profile = buildProfile(studentId);
      remoteSync.schedule(profile);
    };
  }

  if (localClear) {
    window.clearAllGrades = function patchedClear() {
      localClear();
    };
  }
}

const flushButtons = ["calculateBtn", "exportBtn", "saveGradesBtn"];
flushButtons.forEach((id) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const studentId = document.getElementById("studentId")?.value || null;
    if (!studentId) return;
    const profile = buildProfile(studentId);
    setTimeout(() => {
      remoteSync.flush(profile).catch((err) => {
        console.error("[calificaciones-teacher-sync] flush", err);
      });
    }, 0);
  });
});

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    setTimeout(() => {
      const studentId = document.getElementById("studentId")?.value || null;
      if (!studentId) return;
      const profile = buildProfile(studentId);
      const hasValues =
        gradeMetas.some((meta) => meta.input.value !== "") ||
        projectMetas.some((meta) => meta.input.value !== "");
      if (hasValues) return;
      persistRemoteItems(profile, []).catch((err) => {
        console.error("[calificaciones-teacher-sync] clear", err);
      });
    }, 150);
  });
}

export function initTeacherSync(user, claims) {
  if (!claims || claims.role !== "docente") {
    return;
  }
  // Esperamos a que la página esté completamente cargada para asegurar que calificaciones.js exista
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initializeBaseFunctions);
  } else {
    initializeBaseFunctions();
  }
  console.log(
    "[calificaciones-teacher-sync] Modo docente activado. Sincronización en tiempo real iniciada."
  );
}
