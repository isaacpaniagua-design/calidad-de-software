// js/calificaciones-teacher-preview.js
// Vista de estudiante para preview docente: llena #studentSelect si está vacío y pinta la tabla de preview.

import { getDb } from './firebase.js';
import { buildCandidateDocIds } from './calificaciones-helpers.js';
import { getDocs, query, collection, where } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const $id = (id) => document.getElementById(id);

/**
 * Función principal que se llamará desde calificaciones-backend.js una vez que el usuario esté autenticado como docente.
 */
function initTeacherPreview(user, claims) {
  // Si no es un docente, no hacemos nada en este script.
  if (!claims || claims.role !== 'docente') {
    return;
  }
  
  console.log('[calificaciones-teacher-preview] Inicializado para docente.');
  
  const sel = $id('studentSelect'); // El dropdown principal de estudiantes
  const selPreview = $id('qsp-student-select'); // El dropdown de la vista previa
  
  if (sel && selPreview) {
    // Sincroniza el dropdown de la vista previa cuando cambia el principal
    sel.addEventListener('change', () => {
      selPreview.value = sel.value;
      selPreview.dispatchEvent(new Event('change')); // Dispara el evento para cargar la tabla
    });
    
    // Configura el listener para el dropdown de la vista previa
    setupPreviewDropdown(selPreview);
  }
}

// Hacemos la función de inicialización accesible globalmente
window.initTeacherPreview = initTeacherPreview;


// --- Lógica interna del Módulo ---

/**
 * Configura los eventos para el dropdown de la vista previa del docente.
 */
function setupPreviewDropdown(sel) {
  const db = getDb();
  
  sel.addEventListener('change', async () => {
    const matricula = sel.value;
    const opt = sel.selectedOptions[0];
    
    // Construye el perfil del estudiante seleccionado para la consulta
    const profile = {
      uid: opt?.dataset?.uid || await resolverUidPorMatricula(db, matricula),
      email: opt?.dataset?.email || null,
      matricula: opt?.dataset?.matricula || matricula || null,
    };

    const tbody = $id('qsp-tbody');
    if (!profile.uid && !profile.email && !profile.matricula) {
      tbody.innerHTML = '<tr><td class="qsc-muted" colspan="6">No se encontró información para la selección.</td></tr>';
      return;
    }

    try {
      tbody.innerHTML = '<tr><td class="qsc-muted" colspan="6">Cargando...</td></tr>';
      const items = await obtenerItemsAlumno(db, 'calidad-de-software-v2', profile);
      renderItems(items);
    } catch (err) {
      console.error("[teacher-preview] Error obteniendo items de alumno:", err);
      tbody.innerHTML = '<tr><td class="qsc-muted" colspan="6">Error al cargar las calificaciones.</td></tr>';
    }
  });
}

/**
 * Obtiene las calificaciones de un alumno específico.
 */
async function obtenerItemsAlumno(db, grupoId, profile) {
    if (!grupoId || !profile) return [];
    const candidateIds = buildCandidateDocIds(profile);
    if (!candidateIds.length) return [];

    const q = query(
        collection(db, 'calificaciones'),
        where('grupoId', '==', grupoId),
        where('alumnoId', 'in', candidateIds)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({...d.data(), id: d.id }));
}

/**
 * Renderiza la tabla de calificaciones en la vista previa.
 */
function renderItems(items) {
  const tbody = $id('qsp-tbody');
  if (!items || !items.length) {
    tbody.innerHTML = '<tr><td class="qsc-muted" colspan="6">Sin actividades registradas aún.</td></tr>';
    return;
  }
  
  // Lógica de renderizado (tomada de tu archivo original)
  const resumen = resumenGlobal(items);
  $id('qsc-kpi-total-preview').textContent = fmtPct(resumen.porcentaje);
  $id('qsc-kpi-pond-preview').textContent = fmtPct(resumen.pondSum);
  $id('qsc-kpi-items-preview').textContent = items.length;
  $id('qsc-bar-fill-preview').style.width = fmtPct(resumen.porcentaje);

  let html = '';
  for (const it of items) {
    const max = Number(it.maxPuntos) || 0;
    const pts = Number(it.puntos) || 0;
    const pnd = Number(it.ponderacion) || 0;
    const porc = max > 0 ? (pts / max) * 100 : 0;
    const status = porc > 1 ? 'done' : 'pending';
    const unidad = inferUnidad(it) || '-';

    html += `
      <tr>
        <td class="qsc-cell-main">
          <span class="qsc-status qsc-status--${status}"></span>
          <span>${it.actividad || 'Actividad'}</span>
        </td>
        <td>${it.tipo || 'Tarea'}</td>
        <td style="text-align:center;">${unidad}</td>
        <td style="text-align:right;">${(it.puntos || 0).toFixed(1)}</td>
        <td style="text-align:right;">${(it.maxPuntos || 0).toFixed(1)}</td>
        <td style="text-align:right;">${fmtPct(pnd)}</td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

// --- Funciones de Ayuda (Helper) ---

async function resolverUidPorMatricula(db, matricula) {
    if (!matricula) return null;
    try {
        const q = query(collection(db, 'students'), where('matricula', '==', matricula));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].id; // El ID del documento del estudiante es el UID
    } catch (e) {
        return null;
    }
}

function resumenGlobal(items) {
    let porc = 0, pond = 0;
    for (const it of items) {
        const max = Number(it.maxPuntos) || 0, pts = Number(it.puntos) || 0, pnd = Number(it.ponderacion) || 0;
        if (max > 0) porc += (pts / max) * pnd;
        pond += pnd;
    }
    return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}

function fmtPct(n) { return (Number(n) || 0).toFixed(2) + '%'; }
function clampPct(n) { n = Number(n) || 0; return Math.max(0, Math.min(100, n)); }
function inferUnidad(it) {
  if (it && it.unidad != null) return Number(it.unidad);
  const n = String(it.actividad || '').trim().charAt(0);
  if (n >= '1' && n <= '6') return Number(n);
  return null;
}
