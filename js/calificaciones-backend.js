// js/calificaciones-backend.js
import { initFirebase, getDb, getAuthInstance, onAuth } from './firebase.js';
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
  if (/u1|unidad\s*1/.test(n)) return 1;
  if (/u2|unidad\s*2/.test(n)) return 2;
  if (/u3|unidad\s*3/.test(n)) return 3;
  return 0;
}

function normalizeItems(source) {
  const out = [];
  if (!Array.isArray(source)) return out;
  for (let i = 0; i < source.length; i++) {
    const it = source[i] || {};
    const rawMaxSource = (it.rawMaxPuntos !== undefined && it.rawMaxPuntos !== null) ? it.rawMaxPuntos : it.maxPuntos;
    const rawMax = Number(rawMaxSource) || 0;
    const storedMax = Number(it.maxPuntos) || 0;
    const storedPoints = Number(it.puntos) || 0;
    const rawPointsSource = (it.rawPuntos !== undefined && it.rawPuntos !== null) ? it.rawPuntos : it.puntos;
    const rawPoints = Number(rawPointsSource) || 0;

    const hasRaw = rawMax > 0;
    const baseMax = hasRaw ? rawMax : (storedMax > 0 ? storedMax : 10);

    const clampedRaw = baseMax > 0 ? Math.max(0, Math.min(rawPoints, baseMax)) : 0;
    let ratio;
    if (baseMax > 0) ratio = clampedRaw / baseMax;
    else if (storedMax > 0) ratio = Math.max(0, Math.min(storedPoints, storedMax)) / storedMax;
    else ratio = 0;

    ratio = Math.max(0, Math.min(ratio, 1));
    const normalizedMax = 10;
    const normalizedPoints = ratio * normalizedMax;
    const displayMax = baseMax;
    const displayPoints = ratio * displayMax;

    out.push(Object.assign({}, it, {
      normalizedRatio: ratio,
      maxPuntos: normalizedMax,
      puntos: Number(normalizedPoints.toFixed(3)),
      displayMax: Number(displayMax.toFixed(2)),
      displayPuntos: Number(displayPoints.toFixed(2)),
      estaCalificado: ratio > 0,
    }));
  }
  return out;
}

function resumenGlobal(items) {
  let porc = 0;
  let pond = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const ratio = Number(it.normalizedRatio) || 0;
    const pnd = Number(it.ponderacion) || 0;
    const safeRatio = Math.max(0, Math.min(ratio, 1));
    porc += safeRatio * pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
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
function scoreUnidad(arr) { if (!arr.length) return 0; return resumenGlobal(arr).porcentaje; }
function final3040(u1,u2,u3) { return clampPct(u1*0.3 + u2*0.3 + u3*0.4); }

function renderAlumno(items) {
  const normalized = normalizeItems(items || []);
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
        const pts = Number(it.displayPuntos) || 0;
        const pnd = Number(it.ponderacion) || 0;
        const ratio = Number(it.normalizedRatio) || 0;
        const aporta = ratio * pnd;
        const escala = max > 0 ? escPct(100 * ratio) : '-';
        const statusBadge = ratio > 0
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
            <td style="text-align:right">${pts.toFixed(2)}</td>
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
  const u1 = scoreUnidad(buckets[1]);
  const u2 = scoreUnidad(buckets[2]);
  const u3 = scoreUnidad(buckets[3]);
  const fin = final3040(u1, u2, u3);
  const to5 = (p) => (p * 0.05).toFixed(1);

  if ($id('unit1Grade')) $id('unit1Grade').textContent = to5(u1);
  if ($id('unit2Grade')) $id('unit2Grade').textContent = to5(u2);
  if ($id('unit3Grade')) $id('unit3Grade').textContent = to5(u3);
  if ($id('finalGrade')) $id('finalGrade').textContent = to5(fin);

  if ($id('progressPercent')) $id('progressPercent').textContent = String(Math.round(fin)) + '%';
  const pbar = $id('progressBar');
  if (pbar) {
    pbar.style.width = fin + '%';
    pbar.className = 'h-3 rounded-full progress-bar';
    if (fin >= 90) pbar.classList.add('bg-gradient-to-r','from-green-500','to-green-600');
    else if (fin >= 70) pbar.classList.add('bg-gradient-to-r','from-yellow-500','to-yellow-600');
    else if (fin >= 60) pbar.classList.add('bg-gradient-to-r','from-orange-500','to-orange-600');
    else pbar.classList.add('bg-gradient-to-r','from-red-500','to-red-600');
  }
}

function setStatusMessage(message) {
  const el = $id('qsc-msg');
  if (!el) return;
  el.textContent = message ? String(message) : '';
}

async function obtenerItemsAlumno(db, grupoId, profile){
  const { collection, doc, getDoc, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');

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
