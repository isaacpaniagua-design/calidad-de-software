// js/calificaciones-backend.js
import { initFirebase, getDb, onAuth } from './firebase.js';
import { buildCandidateDocIds } from './calificaciones-helpers.js';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $id = (id) => document.getElementById(id);

function ready() {
  return new Promise((resolve) => {
    if (/complete|interactive/.test(document.readyState)) resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });
}

function clampPct(n) {
  n = Number(n) || 0;
  return Math.max(0, Math.min(100, n));
}
function fmtPct(n) {
  return (Number(n) || 0).toFixed(2) + '%';
}
function escPct(n) {
  if (n == null) return '-';
  const x = Number(n) || 0;
  if (x >= 90) return 'A';
  if (x >= 80) return 'B';
  if (x >= 70) return 'C';
  if (x >= 60) return 'D';
  return 'F';
}

function inferUnidad(it) {
  if (it && it.unidad != null) return Number(it.unidad);
  const n = String((it && (it.nombre || it.title)) || '').toLowerCase();
  if (/u(?:nidad)?\s*1/.test(n)) return 1;
  if (/u(?:nidad)?\s*2/.test(n)) return 2;
  if (/u(?:nidad)?\s*3/.test(n)) return 3;
  return 0;
}

function normalizeItems(source) {
  const out = [];
  if (!Array.isArray(source)) return out;
  for (let i = 0; i < source.length; i++) {
    const it = source[i] || {};
    const normalizedMaxRaw = Number(it.maxPuntos);
    const normalizedMax = Number.isFinite(normalizedMaxRaw) ? normalizedMaxRaw : 0;
    const normalizedPointsRaw = Number(it.puntos);
    const normalizedPoints = Number.isFinite(normalizedPointsRaw) ? normalizedPointsRaw : 0;
    const maxForRatio = normalizedMax > 0 ? normalizedMax : 0;
    const clampedNormalizedPoints =
      maxForRatio > 0 ? Math.max(0, Math.min(normalizedPoints, maxForRatio)) : Math.max(0, normalizedPoints);
    const normalizedRatio = maxForRatio > 0 ? clampedNormalizedPoints / maxForRatio : 0;

    const rawMaxValue = it.rawMaxPuntos;
    const rawPointsValue = it.rawPuntos;
    const hasRawMax = rawMaxValue !== undefined && rawMaxValue !== null && rawMaxValue !== '';
    const hasRawPoints = rawPointsValue !== undefined && rawPointsValue !== null && rawPointsValue !== '';
    const rawMax = hasRawMax ? Number(rawMaxValue) : NaN;
    const rawPoints = hasRawPoints ? Number(rawPointsValue) : NaN;

    let displayMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;
    if (displayMax == null) displayMax = maxForRatio > 0 ? maxForRatio : 10;

    let displayPoints;
    if (Number.isFinite(rawPoints)) displayPoints = rawPoints;
    else displayPoints = normalizedRatio * displayMax;
    if (displayMax > 0) displayPoints = Math.max(0, Math.min(displayPoints, displayMax));
    else displayPoints = Math.max(0, displayPoints);

    const estaCalificado = hasRawPoints
      ? true
      : (it.puntos !== undefined && it.puntos !== null && it.puntos !== '');

    out.push(Object.assign({}, it, {
      normalizedRatio: Math.max(0, Math.min(normalizedRatio, 1)),
      normalizedMax: Number(maxForRatio.toFixed(3)),
      normalizedPuntos: Number(clampedNormalizedPoints.toFixed(3)),
      displayMax: Number(displayMax.toFixed(2)),
      displayPuntos: Number(displayPoints.toFixed(2)),
      estaCalificado: !!estaCalificado,
    }));
  }
  return out;
}

function sanitizeLabelKey(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getInputLabel(input) {
  if (!input) return '';
  const container = input.closest('.grade-item, .rubric-item');
  if (!container) return '';
  const heading = container.querySelector('h1, h2, h3, h4, h5, h6, strong');
  return heading ? heading.textContent.trim() : '';
}

function decimalsForInput(input) {
  if (!input) return 2;
  const stepAttr = input.getAttribute('step');
  if (!stepAttr || stepAttr === 'any') return 2;
  const str = String(stepAttr).trim();
  if (!str) return 2;
  if (str.includes('.')) {
    const decimals = str.split('.')[1].replace(/[^0-9]/g, '').length;
    return Math.min(decimals || 1, 4);
  }
  return 0;
}

function clampForInput(input, value) {
  if (!input || !Number.isFinite(value)) return value;
  const maxAttr = Number(input.getAttribute('max'));
  const minAttr = Number(input.getAttribute('min'));
  let result = value;
  if (Number.isFinite(maxAttr)) result = Math.min(result, maxAttr);
  if (Number.isFinite(minAttr)) result = Math.max(result, minAttr);
  return result;
}

function syncGradeInputsFromItems(items) {
  const gradeInputs = Array.from(document.querySelectorAll('.grade-input'));
  const projectInputs = Array.from(document.querySelectorAll('.project-grade-input'));
  if (!gradeInputs.length && !projectInputs.length) return;

  const byKey = new Map();
  const byLabel = new Map();
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') continue;
      if (item.key) {
        const keyStr = String(item.key);
        if (keyStr) byKey.set(keyStr, item);
      }
      const labelKey = sanitizeLabelKey(item.nombre || item.title || item.descripcion || item.key);
      if (labelKey && !byLabel.has(labelKey)) {
        byLabel.set(labelKey, item);
      }
    }
  }

  function assignValue(input, index, prefix) {
    if (!input) return;
    const key = `${prefix}${index}`;
    let item = byKey.get(key);
    if (!item) {
      const label = getInputLabel(input);
      if (label) {
        const labelKey = sanitizeLabelKey(label);
        if (labelKey) item = byLabel.get(labelKey) || null;
      }
    }
    if (!item || !item.estaCalificado) {
      input.value = '';
      return;
    }
    let value = Number(item.displayPuntos);
    if (!Number.isFinite(value) && item.rawPuntos != null) {
      const raw = Number(item.rawPuntos);
      if (Number.isFinite(raw)) value = raw;
    }
    if (!Number.isFinite(value)) {
      input.value = '';
      return;
    }
    const clamped = clampForInput(input, value);
    const decimals = decimalsForInput(input);
    const digits = Number.isFinite(decimals) ? Math.max(0, Math.min(decimals, 3)) : 2;
    input.value = clamped.toFixed(digits);
  }

  for (let i = 0; i < gradeInputs.length; i++) {
    assignValue(gradeInputs[i], i, 'g-');
  }
  for (let i = 0; i < projectInputs.length; i++) {
    assignValue(projectInputs[i], i, 'p-');
  }

  if (typeof window.calculateProjectGrades === 'function') {
    try {
      window.calculateProjectGrades();
    } catch (err) {
      console.warn('[calificaciones-backend] calculateProjectGrades()', err);
    }
  }
  if (typeof window.calculateGrades === 'function') {
    try {
      window.calculateGrades();
    } catch (err) {
      console.warn('[calificaciones-backend] calculateGrades()', err);
    }
  }
}

function weightedTotals(items) {
  let avance = 0;
  let ponderacion = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const peso = Number(it.ponderacion);
    const ratio = Number(it.normalizedRatio);
    if (!Number.isFinite(peso) || peso <= 0) continue;
    if (!Number.isFinite(ratio)) continue;
    const safeRatio = Math.max(0, Math.min(ratio, 1));
    avance += safeRatio * peso;
    ponderacion += peso;
  }
  return { avance, ponderacion };
}

function resumenGlobal(items) {
  const totals = weightedTotals(items);
  return {
    porcentaje: clampPct(totals.avance),
    pondSum: Math.max(0, Math.min(totals.ponderacion, 100)),
    avance: totals.avance,
  };
}

function bucketsPorUnidad(items) {
  const B = { 1: [], 2: [], 3: [] };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const u = inferUnidad(it);
    if (u === 1 || u === 2 || u === 3) B[u].push(it);
  }
  return B;
}
function scoreUnidad(arr) {
  if (!arr.length) return { aporte: 0, ponderacion: 0 };
  const totals = weightedTotals(arr);
  return {
    aporte: Math.max(0, Math.min(totals.avance, totals.ponderacion || totals.avance)),
    ponderacion: totals.ponderacion,
  };
}

function final3040(u1, u2, u3, extra = 0) {
  const total = (u1?.aporte || 0) + (u2?.aporte || 0) + (u3?.aporte || 0) + (Number(extra) || 0);
  return clampPct(total);
}

function renderAlumno(items) {
  const normalized = normalizeItems(items || []);
  syncGradeInputsFromItems(normalized);
  const tbody = $id('qsc-tbody');
  const kpiTotal = $id('qsc-kpi-total');
  const kpiItems = $id('qsc-kpi-items');
  const kpiPond = $id('qsc-kpi-pond');
  const bar = $id('qsc-bar-fill');

  const stats = resumenGlobal(normalized);
  if (kpiTotal) kpiTotal.textContent = fmtPct(stats.porcentaje);
  if (kpiItems) kpiItems.textContent = String(normalized.length);
  if (kpiPond) kpiPond.textContent = fmtPct(stats.pondSum);
  if (bar) bar.style.width = stats.porcentaje.toFixed(2) + '%';

  if (tbody) {
    tbody.innerHTML = '';
    if (!normalized.length) {
      tbody.innerHTML = '<tr><td class="qsc-muted" colspan="10">Sin actividades registradas aun.</td></tr>';
    } else {
      for (let i = 0; i < normalized.length; i++) {
        const it = normalized[i] || {};
        const tipo = it.tipo || it.category || '-';
        const uni = ((it.unidad !== undefined && it.unidad !== null) ? it.unidad : inferUnidad(it)) || '-';
        const max = Number(it.displayMax) || 0;
        const rawPts = Number(it.displayPuntos);
        const hasDisplayPts = !Number.isNaN(rawPts);
        const calificada = Boolean(it.estaCalificado);
        const ptsText = calificada && hasDisplayPts ? rawPts.toFixed(2) : '-';
        const pnd = Number(it.ponderacion) || 0;
        const ratio = Number(it.normalizedRatio) || 0;
        const aporta = ratio * pnd;
        const escala = calificada && max > 0 ? escPct(100 * ratio) : '-';
        const statusBadge = calificada
          ? '<span class="qsc-status qsc-status--done">Calificada</span>'
          : '<span class="qsc-status qsc-status--pending">Pendiente</span>';
        let fecha = '-';
        try {
          const f = it.fecha;
          if (f && typeof f.toDate === 'function') fecha = f.toDate().toLocaleDateString();
          else if (f instanceof Date) fecha = f.toLocaleDateString();
        } catch (_) {}
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>
              <div class="qsc-cell-main">
                <span>${it.nombre || it.title || 'Actividad'}</span>
                ${statusBadge}
              </div>
            </td>
            <td>${tipo}</td>
            <td>${uni}</td>
            <td style="text-align:right">${ptsText}</td>
            <td style="text-align:right">${max ? max.toFixed(2) : '-'}</td>
            <td style="text-align:right">${pnd}%</td>
            <td style="text-align:right">${fmtPct(aporta)}</td>
            <td style="text-align:center">${escala}</td>
            <td style="text-align:center">${fecha}</td>
          </tr>`);
      }
    }
  }

  const buckets = bucketsPorUnidad(normalized);
  const unidad1 = scoreUnidad(buckets[1]);
  const unidad2 = scoreUnidad(buckets[2]);
  const unidad3 = scoreUnidad(buckets[3]);

  const aporteU1 = Number.isFinite(unidad1.aporte) ? unidad1.aporte : 0;
  const aporteU2 = Number.isFinite(unidad2.aporte) ? unidad2.aporte : 0;
  const aporteU3 = Number.isFinite(unidad3.aporte) ? unidad3.aporte : 0;
  const totalUnits = aporteU1 + aporteU2 + aporteU3;
  const globalAvance = Number.isFinite(stats.avance) ? stats.avance : (Number.isFinite(stats.porcentaje) ? stats.porcentaje : 0);
  const extras = Math.max(0, globalAvance - totalUnits);
  const finalPct = final3040(unidad1, unidad2, unidad3, extras);
  const finalValor = Number.isFinite(finalPct) ? finalPct : 0;

  if ($id('unit1Grade')) $id('unit1Grade').textContent = aporteU1.toFixed(1);
  if ($id('unit2Grade')) $id('unit2Grade').textContent = aporteU2.toFixed(1);
  if ($id('unit3Grade')) $id('unit3Grade').textContent = aporteU3.toFixed(1);
  if ($id('finalGrade')) $id('finalGrade').textContent = finalValor.toFixed(1);

  if ($id('progressPercent')) $id('progressPercent').textContent = String(Math.round(finalValor)) + '%';
  const pbar = $id('progressBar');
  if (pbar) {
    const pct = Math.max(0, Math.min(finalValor, 100));
    pbar.style.width = pct.toFixed(2) + '%';
    pbar.className = 'h-3 rounded-full progress-bar';
    if (finalValor >= 90) pbar.classList.add('bg-gradient-to-r','from-green-500','to-green-600');
    else if (finalValor >= 70) pbar.classList.add('bg-gradient-to-r','from-yellow-500','to-yellow-600');
    else if (finalValor >= 60) pbar.classList.add('bg-gradient-to-r','from-orange-500','to-orange-600');
    else pbar.classList.add('bg-gradient-to-r','from-red-500','to-red-600');
  }
}

function setStatusMessage(message) {
  const el = $id('qsc-msg');
  if (!el) return;
  el.textContent = message ? String(message) : '';
}

async function obtenerItemsAlumno(db, grupoId, profile){
  const candidates = buildCandidateDocIds(profile);
  for (let i = 0; i < candidates.length; i++) {
    try {
      const ref = doc(db, 'grupos', grupoId, 'calificaciones', candidates[i]);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (Array.isArray(data.items)) {
          return data.items.map((item) => Object.assign({}, item));
        }
      }
    } catch (err) {
      console.warn('[calificaciones-backend] obtenerItemsAlumno(doc)', err);
    }
  }

  const uid = profile && profile.uid ? profile.uid : null;
  if (!uid) return [];
  try {
    const calificacionRef = doc(db, 'grupos', grupoId, 'calificaciones', uid);
    const base = collection(calificacionRef, 'items');
    const snap = await getDocs(query(base, orderBy('fecha','asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[calificaciones-backend] obtenerItemsAlumno(legacy)', err);
    return [];
  }
}

async function main(){
  await ready();
  initFirebase();
  const db = getDb();
  const root = $id('calificaciones-root') || document.body;
  const params = new URLSearchParams(location.search);
  const dataset = root && root.dataset ? root.dataset : {};
  const grupoAttr = dataset && dataset.grupo ? dataset.grupo : null;
  const GRUPO_ID = (grupoAttr || params.get('grupo') || 'calidad-2025').trim();

  onAuth(async (user) => {
    if (!user) {
      renderAlumno([]);
      setStatusMessage('Inicia sesion con tu correo @potros.itson.edu.mx para ver tu progreso.');
      return;
    }
    try {
      const items = await obtenerItemsAlumno(db, GRUPO_ID, {
        uid: user.uid,
        email: user.email || null,
      });
      renderAlumno(items);
      setStatusMessage(items && items.length ? '' : 'Sin actividades registradas aun.');
    } catch (error) {
      console.error('[calificaciones-backend] error', error);
      renderAlumno([]);
      if (error && (error.code === 'permission-denied' || error.code === 'firestore/permission-denied')) {
        setStatusMessage('Tu cuenta no tiene permisos para consultar las calificaciones en linea. Contacta al docente para habilitar el acceso.');
      } else {
        setStatusMessage('No se pudieron cargar tus calificaciones. Intenta nuevamente mas tarde.');
      }
    }
  });
}

main().catch(console.error);
