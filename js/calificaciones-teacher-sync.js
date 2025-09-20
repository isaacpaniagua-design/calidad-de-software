// js/calificaciones-teacher-sync.js
// Sincroniza las capturas de calificaciones del docente con Firestore para que
// el alumno pueda consultarlas desde su sesión.

import { initFirebase, getDb } from './firebase.js';
import {
  getPrimaryDocId,
  buildCandidateDocIds,
} from './calificaciones-helpers.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

initFirebase();
const db = getDb();
const root = document.getElementById('calificaciones-root') || document.body;
const params = new URLSearchParams(location.search || '');
const GRUPO_ID = (root?.dataset?.grupo || params.get('grupo') || 'calidad-2025').trim();

const localSave = typeof window.saveStudentGrades === 'function'
  ? window.saveStudentGrades.bind(window)
  : null;
const localLoad = typeof window.loadStudentGrades === 'function'
  ? window.loadStudentGrades.bind(window)
  : null;
const localClear = typeof window.clearAllGrades === 'function'
  ? window.clearAllGrades.bind(window)
  : null;

if (!localSave || !localLoad) {
  console.warn('[calificaciones-teacher-sync] funciones base no disponibles');
}

function isTeacherRole() {
  try {
    const stored = (localStorage.getItem('qs_role') || 'estudiante').toLowerCase();
    if (stored === 'docente') return true;
  } catch (_) {}
  return document.documentElement.classList.contains('role-teacher');
}

function isTeacherUiEnabled() {
  try {
    var input = document.querySelector('.grade-input');
    if (input && !input.disabled && !input.readOnly) return true;
    var toolbar = document.querySelector('.teacher-only');
    if (toolbar) {
      var style = window.getComputedStyle ? getComputedStyle(toolbar) : null;
      if (style && style.display !== 'none' && style.visibility !== 'hidden') return true;
    }
  } catch (_) {}
  return false;
}

function shouldUseFirestore() {
  if (!db) return false;
  if (isTeacherRole()) return true;
  return isTeacherUiEnabled();
}

function detectUnidad(input) {
  const unit = input.closest('.unit-content');
  if (unit && /^unit([123])$/.test(unit.id)) {
    return Number(RegExp.$1);
  }
  if (input.closest('#project')) return 3;
  return null;
}

function inferTipo(nombre, unidad, isProject) {
  if (isProject) return 'Proyecto final';
  const lower = (nombre || '').toLowerCase();
  if (lower.includes('examen')) return 'Examen';
  if (lower.includes('participación')) return 'Participación';
  if (lower.includes('foro')) return 'Foro';
  if (lower.includes('taller')) return 'Taller';
  if (lower.includes('rúbrica')) return 'Rúbrica';
  if (unidad) return `Unidad ${unidad}`;
  return 'Actividad';
}

function getLabelText(input) {
  const container = input.closest('.grade-item');
  if (!container) return '';
  const heading = container.querySelector('h4, h5, strong');
  return heading ? heading.textContent.trim() : '';
}

const gradeInputs = Array.from(document.querySelectorAll('.grade-input'));
const projectInputs = Array.from(
  document.querySelectorAll('.project-grade-input')
);

const gradeMetas = gradeInputs.map((input, index) => {
  const unidad = detectUnidad(input);
  const nombre = getLabelText(input) || `Actividad ${index + 1}`;
  return {
    key: `g-${index}`,
    input,
    unidad,
    nombre,
    tipo: inferTipo(nombre, unidad, false),
    ponderacion: parseFloat(input.dataset.weight || input.getAttribute('data-weight')) || 0,
    maxPuntos: parseFloat(input.getAttribute('max')) || 10,
  };
});
const gradeMetaMap = new Map(gradeMetas.map((meta) => [meta.key, meta]));

const projectMetas = projectInputs.map((input, index) => {
  const nombre = getLabelText(input) || `Rúbrica ${index + 1}`;
  return {
    key: `p-${index}`,
    input,
    unidad: 3,
    nombre,
    tipo: inferTipo(nombre, 3, true),
    ponderacion: parseFloat(input.dataset.weight || input.getAttribute('data-weight')) || 0,
    maxPuntos: parseFloat(input.getAttribute('max')) || 10,
  };
});
const projectMetaMap = new Map(projectMetas.map((meta) => [meta.key, meta]));

function setInputValue(input, value) {
  if (value == null || value === '') {
    input.value = '';
    return;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    input.value = '';
    return;
  }
  input.value = String(num);
}

function resetInputs() {
  gradeMetas.forEach((meta) => {
    meta.input.value = '';
  });
  projectMetas.forEach((meta) => {
    meta.input.value = '';
  });
}

function applyItemsToInputs(items) {
  resetInputs();
  if (!Array.isArray(items)) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') continue;
    const meta = gradeMetaMap.get(item.key) || projectMetaMap.get(item.key);
    if (!meta) continue;
    setInputValue(meta.input, item.puntos);
  }
  if (typeof window.calculateProjectGrades === 'function') {
    window.calculateProjectGrades();
  }
  if (typeof window.calculateGrades === 'function') {
    window.calculateGrades();
  }
}

function collectItemsForFirestore() {
  const items = [];
  for (let i = 0; i < gradeMetas.length; i++) {
    const meta = gradeMetas[i];
    const raw = meta.input.value;
    if (raw === '' || raw == null) continue;
    const puntos = Number(raw);
    if (!Number.isFinite(puntos)) continue;
    items.push({
      key: meta.key,
      nombre: meta.nombre,
      tipo: meta.tipo,
      unidad: meta.unidad,
      ponderacion: meta.ponderacion,
      maxPuntos: meta.maxPuntos,
      puntos,
      fecha: null,
    });
  }
  for (let i = 0; i < projectMetas.length; i++) {
    const meta = projectMetas[i];
    const raw = meta.input.value;
    if (raw === '' || raw == null) continue;
    const puntos = Number(raw);
    if (!Number.isFinite(puntos)) continue;
    items.push({
      key: meta.key,
      nombre: meta.nombre,
      tipo: meta.tipo,
      unidad: meta.unidad,
      ponderacion: meta.ponderacion,
      maxPuntos: meta.maxPuntos,
      puntos,
      fecha: null,
    });
  }
  return items;
}

function buildProfile(studentId) {
  const nameEl = document.getElementById('studentName');
  const emailEl = document.getElementById('studentEmail');
  return {
    id: studentId || null,
    studentId: studentId || null,
    matricula: studentId || null,
    name: nameEl ? nameEl.value || null : null,
    email: emailEl ? emailEl.value || null : null,
  };
}

async function fetchRemoteItems(profile) {
  if (!shouldUseFirestore()) return null;
  const candidates = buildCandidateDocIds(profile);
  if (!candidates.length) return null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      const ref = doc(db, 'grupos', GRUPO_ID, 'calificaciones', candidates[i]);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (Array.isArray(data.items)) return data.items;
        return [];
      }
    } catch (err) {
      console.warn('[calificaciones-teacher-sync] fetchRemoteItems', err);
    }
  }
  return null;
}

async function persistRemoteItems(profile, items) {
  if (!shouldUseFirestore()) return;
  const docId = getPrimaryDocId(profile);
  if (!docId) return;
  const payload = {
    items: Array.isArray(items) ? items : [],
    studentId: profile.studentId || null,
    studentName: profile.name || null,
    studentEmail: profile.email || null,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'grupos', GRUPO_ID, 'calificaciones', docId), payload, {
      merge: true,
    });
  } catch (err) {
    console.error('[calificaciones-teacher-sync] persistRemoteItems', err);
  }
}

const remoteSync = (() => {
  let timer = null;
  let lastProfile = null;
  return {
    schedule(profile) {
      if (!shouldUseFirestore()) return;
      lastProfile = Object.assign({}, profile);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const items = collectItemsForFirestore();
        persistRemoteItems(lastProfile, items).catch((err) => {
          console.error('[calificaciones-teacher-sync] scheduleSync', err);
        });
      }, 800);
    },
    async flush(profile) {
      if (!shouldUseFirestore()) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const target = profile || lastProfile;
      if (!target) return;
      const items = collectItemsForFirestore();
      await persistRemoteItems(target, items);
    },
  };
})();

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
        const activeId = document.getElementById('studentId')?.value || null;
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
        console.error('[calificaciones-teacher-sync] loadStudentGrades', err);
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

const flushButtons = ['calculateBtn', 'exportBtn'];
flushButtons.forEach((id) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const studentId = document.getElementById('studentId')?.value || null;
    if (!studentId) return;
    const profile = buildProfile(studentId);
    setTimeout(() => {
      remoteSync.flush(profile).catch((err) => {
        console.error('[calificaciones-teacher-sync] flush', err);
      });
    }, 0);
  });
});

const clearBtn = document.getElementById('clearBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    setTimeout(() => {
      const studentId = document.getElementById('studentId')?.value || null;
      if (!studentId) return;
      const profile = buildProfile(studentId);
      const hasValues = gradeMetas.some((meta) => meta.input.value !== '') ||
        projectMetas.some((meta) => meta.input.value !== '');
      if (hasValues) return;
      persistRemoteItems(profile, []).catch((err) => {
        console.error('[calificaciones-teacher-sync] clear', err);
      });
    }, 150);
  });
}

