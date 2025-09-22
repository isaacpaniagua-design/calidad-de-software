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

    let displayPoints = Number.isFinite(rawPoints) ? rawPoints : NaN;
    if (Number.isFinite(displayPoints)) {
      if (displayMax > 0) displayPoints = Math.max(0, Math.min(displayPoints, displayMax));
      else displayPoints = Math.max(0, displayPoints);
    }

    const estaCalificado = Number.isFinite(rawPoints);

    out.push(Object.assign({}, it, {
      normalizedRatio: Math.max(0, Math.min(normalizedRatio, 1)),
      normalizedMax: Number(maxForRatio.toFixed(3)),
      normalizedPuntos: Number(clampedNormalizedPoints.toFixed(3)),
      displayMax: Number(displayMax.toFixed(2)),
      displayPuntos: Number.isFinite(displayPoints) ? Number(displayPoints.toFixed(2)) : NaN,
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

function hasNumericTextContent(el) {
  if (!el) return false;
  const text = el.textContent;
  if (typeof text !== 'string') return false;
  const parsed = parseFloat(text.replace(',', '.'));
  return Number.isFinite(parsed);
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
    const raw = Number(item.rawPuntos);
    let value = Number.isFinite(raw) ? raw : Number(item.displayPuntos);
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

function isProjectRubricItem(it) {
  if (!it || typeof it !== 'object') return false;
  const key = String(it.key || '');
  if (key.startsWith('p-')) return true;
  const tipo = String(it.tipo || '').toLowerCase();
  if (tipo === 'proyecto final') return true;
  const nombre = String(it.nombre || it.title || '').toLowerCase();
  if (!nombre) return false;
  if (nombre.includes('rúbrica') && nombre.includes('proyecto')) return true;
  return false;
}

function isProjectPhaseSummaryItem(it) {
  if (!it || typeof it !== 'object') return false;
  const nombre = String(it.nombre || it.title || '').toLowerCase();
  if (!nombre) return false;
  if (!nombre.includes('proyecto final')) return false;
  if (nombre.includes('rúbrica')) return false;
  if (nombre.includes('examen')) return false;
  return true;
}

function bucketsPorUnidad(items) {
  const B = { 1: [], 2: [], 3: [], unit3Rubric: [] };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const u = inferUnidad(it);
    if (u === 3 && isProjectRubricItem(it)) {
      B.unit3Rubric.push(it);
      continue;
    }
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
  const deliveryList = $id('activityDeliveryList');
  const pendingCountEl = $id('deliveryPendingCount');
  const completedCountEl = $id('deliveryCompletedCount');
  const completionPctEl = $id('deliveryCompletionPercent');

  const stats = resumenGlobal(normalized);
  if (kpiTotal) kpiTotal.textContent = fmtPct(stats.porcentaje);
  if (kpiItems) kpiItems.textContent = String(normalized.length);
  if (kpiPond) kpiPond.textContent = fmtPct(stats.pondSum);
  if (bar) bar.style.width = stats.porcentaje.toFixed(2) + '%';

  const deliveries = [];
  let pendingCount = 0;
  let completedCount = 0;
  const tableRows = [];

  if (!normalized.length) {
    tableRows.push('<tr><td class="qsc-muted" colspan="10">Sin actividades registradas aun.</td></tr>');
  } else {
    for (let i = 0; i < normalized.length; i++) {
      const it = normalized[i] || {};
      const nombre = it.nombre || it.title || 'Actividad';
      const tipo = it.tipo || it.category || '-';
      const uni = ((it.unidad !== undefined && it.unidad !== null) ? it.unidad : inferUnidad(it)) || '-';
      const max = Number(it.displayMax) || 0;
      const maxText = max ? max.toFixed(2) : '-';
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
      let fechaValue = Number.NaN;
      try {
        const f = it.fecha;
        if (f && typeof f.toDate === 'function') {
          const date = f.toDate();
          fecha = date.toLocaleDateString();
          fechaValue = date.getTime();
        } else if (f instanceof Date) {
          fecha = f.toLocaleDateString();
          fechaValue = f.getTime();
        } else if (typeof f === 'string') {
          const parsed = Date.parse(f);
          if (!Number.isNaN(parsed)) {
            const date = new Date(parsed);
            fecha = date.toLocaleDateString();
            fechaValue = parsed;
          }
        }
      } catch (_) {}
      tableRows.push(`
          <tr>
            <td>
              <div class="qsc-cell-main">
                <span>${nombre}</span>
                ${statusBadge}
              </div>
            </td>
            <td>${tipo}</td>
            <td>${uni}</td>
            <td style="text-align:right">${ptsText}</td>
            <td style="text-align:right">${maxText}</td>
            <td style="text-align:right">${pnd}%</td>
            <td style="text-align:right">${fmtPct(aporta)}</td>
            <td style="text-align:center">${escala}</td>
            <td style="text-align:center">${fecha}</td>
          </tr>`);
      if (calificada) completedCount++;
      else pendingCount++;
      deliveries.push({
        nombre,
        tipo,
        unidad: uni,
        ponderacion: pnd,
        aporta,
        calificada,
        hasDisplayPts,
        rawPoints: rawPts,
        max,
        escala,
        fecha,
        fechaValue,
      });
    }
  }

  if (tbody) {
    tbody.innerHTML = tableRows.join('');
  }

  if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);
  if (completedCountEl) completedCountEl.textContent = String(completedCount);
  const completionPct = normalized.length ? Math.round((completedCount / normalized.length) * 100) : 0;
  if (completionPctEl) completionPctEl.textContent = completionPct + '%';

  if (deliveryList) {
    if (!normalized.length) {
      deliveryList.innerHTML = '<li class="delivery-empty">Sin actividades registradas aun.</li>';
    } else {
      const sorted = deliveries.slice().sort((a, b) => {
        if (a.calificada !== b.calificada) return a.calificada ? 1 : -1;
        const timeA = Number.isFinite(a.fechaValue) ? a.fechaValue : Number.MAX_SAFE_INTEGER;
        const timeB = Number.isFinite(b.fechaValue) ? b.fechaValue : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
        const nameA = a.nombre || '';
        const nameB = b.nombre || '';
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });
      const fragments = [];
      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const metaParts = [];
        if (item.tipo && item.tipo !== '-') metaParts.push(item.tipo);
        if (item.unidad && item.unidad !== '-') metaParts.push('Unidad ' + item.unidad);
        if (Number(item.ponderacion)) metaParts.push('Peso ' + fmtPct(item.ponderacion));
        const meta = metaParts.join(' · ') || 'Sin detalles adicionales';
        const statusClass = item.calificada ? 'done' : 'pending';
        const statusText = item.calificada ? 'Entregada' : 'Pendiente';
        const fechaLabel = item.fecha !== '-' ? item.fecha : 'Sin fecha registrada';
        const maxDisplay = item.max > 0 ? item.max.toFixed(2) : '—';
        let scoreText;
        if (item.calificada && item.hasDisplayPts && Number.isFinite(item.rawPoints)) {
          const maxValue = item.max > 0 ? item.max.toFixed(2) : '--';
          scoreText = `${item.rawPoints.toFixed(2)} / ${maxValue} pts`;
        } else if (item.max > 0) {
          scoreText = `Máximo ${maxDisplay} pts`;
        } else {
          scoreText = 'Sin información de puntaje';
        }
        const extraSegments = [`<span class="delivery-score">${scoreText}</span>`];
        if (Number(item.ponderacion)) extraSegments.push(`<span>Peso: ${fmtPct(item.ponderacion)}</span>`);
        if (item.calificada && Number.isFinite(item.aporta) && item.aporta > 0.001) {
          extraSegments.push(`<span>Aporta: ${fmtPct(item.aporta)}</span>`);
        }
        if (item.escala && item.escala !== '-') {
          extraSegments.push(`<span>${item.calificada ? 'Escala' : 'Escala estimada'}: ${item.escala}</span>`);
        }
        fragments.push(`
          <li class="delivery-item ${item.calificada ? 'delivery-item--done' : 'delivery-item--pending'}">
            <div class="delivery-item-main">
              <div>
                <p class="delivery-item-title">${item.nombre}</p>
                <p class="delivery-item-meta">${meta}</p>
              </div>
              <div class="delivery-item-status">
                <span class="delivery-pill ${statusClass}">${statusText}</span>
                <span class="delivery-date">Entrega: ${fechaLabel}</span>
              </div>
            </div>
            <div class="delivery-item-extra">${extraSegments.join('')}</div>
          </li>`);
      }
      deliveryList.innerHTML = fragments.join('');
    }
  }

  const buckets = bucketsPorUnidad(normalized);
  const unidad1 = scoreUnidad(buckets[1] || []);
  const unidad2 = scoreUnidad(buckets[2] || []);
  const bucket3Items = Array.isArray(buckets[3]) ? buckets[3] : [];
  const unidad3Rubric = Array.isArray(buckets.unit3Rubric) ? buckets.unit3Rubric : [];
  const hasUnit3Summary = bucket3Items.some((item) => isProjectPhaseSummaryItem(item));

  let unidad3 = scoreUnidad(bucket3Items);
  if (!hasUnit3Summary && unidad3Rubric.length) {
    const rubricScore = scoreUnidad(unidad3Rubric);
    unidad3 = {
      aporte: (Number(unidad3.aporte) || 0) + (Number(rubricScore.aporte) || 0),
      ponderacion: (Number(unidad3.ponderacion) || 0) + (Number(rubricScore.ponderacion) || 0),
    };
  }

  const aporteU1 = Number.isFinite(unidad1.aporte) ? unidad1.aporte : 0;
  const aporteU2 = Number.isFinite(unidad2.aporte) ? unidad2.aporte : 0;
  const aporteU3 = Number.isFinite(unidad3.aporte) ? unidad3.aporte : 0;
  const totalUnits = aporteU1 + aporteU2 + aporteU3;
  const globalAvance = Number.isFinite(stats.avance)
    ? stats.avance
    : (Number.isFinite(stats.porcentaje) ? stats.porcentaje : 0);
  const rubricTotals = unidad3Rubric.length ? weightedTotals(unidad3Rubric) : { avance: 0 };
  const rubricAvance = Number.isFinite(rubricTotals.avance) ? rubricTotals.avance : 0;
  let extras = Number.isFinite(globalAvance) ? globalAvance - totalUnits : 0;
  if (hasUnit3Summary && rubricAvance > 0) extras -= rubricAvance;
  if (!Number.isFinite(extras)) extras = 0;
  if (extras < 0) extras = Math.abs(extras) < 1e-6 ? 0 : extras;
  const extrasClamped = extras > 0 ? extras : 0;
  const finalPct = final3040(unidad1, unidad2, unidad3, extrasClamped);
  const finalValor = Number.isFinite(finalPct) ? finalPct : 0;

  const hasTeacherCalculator = typeof window.calculateGrades === 'function';

  const unit1El = $id('unit1Grade');
  if (unit1El && (!hasTeacherCalculator || !hasNumericTextContent(unit1El))) {
    unit1El.textContent = aporteU1.toFixed(1);
  }
  const unit2El = $id('unit2Grade');
  if (unit2El && (!hasTeacherCalculator || !hasNumericTextContent(unit2El))) {
    unit2El.textContent = aporteU2.toFixed(1);
  }
  const unit3El = $id('unit3Grade');
  if (unit3El && (!hasTeacherCalculator || !hasNumericTextContent(unit3El))) {
    unit3El.textContent = aporteU3.toFixed(1);
  }
  const finalEl = $id('finalGrade');
  if (finalEl && (!hasTeacherCalculator || !hasNumericTextContent(finalEl))) {
    finalEl.textContent = finalValor.toFixed(1);
  }

  const progressEl = $id('progressPercent');
  if (progressEl && (!hasTeacherCalculator || !/\d/.test(progressEl.textContent || ''))) {
    progressEl.textContent = String(Math.round(finalValor)) + '%';
  }
  const pbar = $id('progressBar');
  if (pbar && (!hasTeacherCalculator || !pbar.style.width)) {
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
