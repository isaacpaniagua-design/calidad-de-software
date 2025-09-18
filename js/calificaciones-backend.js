// js/calificaciones-backend.js
// Backend para calificaciones.html: usa firebase.js (modular 10.12.x) y pinta la vista de alumno
// sin tocar tu diseño. Calcula KPIs, tabla "Mis calificaciones" y escala 0–5.

import { initFirebase, getDb, getAuthInstance, onAuth } from './firebase.js';

const $ = (s, r=document)=>r.querySelector(s);
const $id = (id)=>document.getElementById(id);

function ready(){ return new Promise(r=>{
  if(/complete|interactive/.test(document.readyState)) r();
  else document.addEventListener('DOMContentLoaded', r, {once:true});
});}

function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }
function fmtPct(n){ return (Number(n)||0).toFixed(2) + '%'; }
function escPct(n){ if(n==null) return '—'; const x=Number(n)||0; if(x>=90) return 'A'; if(x>=80) return 'B'; if(x>=70) return 'C'; if(x>=60) return 'D'; return 'F'; }

// === Inference helpers ===
function inferUnidad(it){
  if (it.unidad!=null) return Number(it.unidad);
  const n = String(it.nombre||it.title||'').toLowerCase();
  if (/\bu1\b|unidad\s*1/.test(n)) return 1;
  if (/\bu2\b|unidad\s*2/.test(n)) return 2;
  if (/\bu3\b|unidad\s*3/.test(n)) return 3;
  return 0;
}
function resumenGlobal(items){
  let porc=0, pond=0;
  for(const it of items){
    const max=Number(it.maxPuntos)||0;
    const pts=Number(it.puntos)||0;
    const pnd=Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}
function bucketsPorUnidad(items){
  const B={1:[],2:[],3:[]};
  for(const it of items){ const u=inferUnidad(it); if(u===1||u===2||u===3) B[u].push(it); }
  return B;
}
function scoreUnidad(arr){ if(!arr.length) return 0; return resumenGlobal(arr).porcentaje; }
function final3040(u1,u2,u3){ return clampPct(u1*0.3 + u2*0.3 + u3*0.4); }

// === Render alumno ===
function renderAlumno(items){
  // KPIs y barra (sección "Mis calificaciones")
  const tbody = $id('qsc-tbody');
  const kpiTotal = $id('qsc-kpi-total');
  const kpiItems = $id('qsc-kpi-items');
  const kpiPond  = $id('qsc-kpi-pond');
  const bar      = $id('qsc-bar-fill');

  const { porcentaje, pondSum } = resumenGlobal(items);
  if (kpiTotal) kpiTotal.textContent = fmtPct(porcentaje);
  if (kpiItems) kpiItems.textContent = String(items.length);
  if (kpiPond)  kpiPond.textContent  = fmtPct(pondSum);
  if (bar) bar.style.width = porcentaje.toFixed(2) + '%';

  if (tbody){
    tbody.innerHTML = '';
    if (!items.length){
      tbody.innerHTML = `<tr><td class="qsc-muted" colspan="9">Sin actividades registradas aún.</td></tr>`;
    } else {
      for(const it of items){
        const tipo = it.tipo || it.category || '—';
        // Evitar el uso de nullish coalescing (??) para compatibilidad con navegadores
        // que no soportan esa sintaxis. Preferimos la propiedad "unidad" si existe
        // (no es null ni undefined); de lo contrario, inferimos la unidad a partir del nombre.
        const uni  = ((it.unidad !== undefined && it.unidad !== null) ? it.unidad : inferUnidad(it)) || '—';
        const max  = Number(it.maxPuntos)||0;
        const pts  = Number(it.puntos)||0;
        const pnd  = Number(it.ponderacion)||0;
        const aporta = max>0 ? (pts/max)*pnd : 0;
        const escala = max>0 ? escPct(100*(pts/max)) : '—';
        // Evitar optional chaining (?.) por compatibilidad. Convertimos la fecha
        // a Date sólo si el objeto tiene un método toDate; de lo contrario,
        // utilizamos el objeto si ya es una instancia de Date.
        const fecha = (()=>{
          try {
            let d = null;
            const f = it.fecha;
            if (f && typeof f.toDate === 'function') {
              d = f.toDate();
            } else if (f instanceof Date) {
              d = f;
            }
            return d ? d.toLocaleDateString() : '—';
          } catch (_){
            return '—';
          }
        })();
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${it.nombre || it.title || 'Actividad'}</td>
            <td>${tipo}</td>
            <td>${uni}</td>
            <td style="text-align:right">${pts}</td>
            <td style="text-align:right">${max}</td>
            <td style="text-align:right">${pnd}%</td>
            <td style="text-align:right">${fmtPct(aporta)}</td>
            <td style="text-align:center">${escala}</td>
            <td style="text-align:center">${fecha}</td>
          </tr>`);
      }
    }
  }

  // Escala 0–5 para KPIs superiores
  const B = bucketsPorUnidad(items);
  const u1 = scoreUnidad(B[1]);
  const u2 = scoreUnidad(B[2]);
  const u3 = scoreUnidad(B[3]);
  const fin = final3040(u1,u2,u3);
  const to5 = p => (p*0.05).toFixed(1);

  if ($id('unit1Grade')) $id('unit1Grade').textContent = to5(u1);
  if ($id('unit2Grade')) $id('unit2Grade').textContent = to5(u2);
  if ($id('unit3Grade')) $id('unit3Grade').textContent = to5(u3);
  if ($id('finalGrade'))  $id('finalGrade').textContent  = to5(fin);

  if ($id('progressPercent')) $id('progressPercent').textContent = String(Math.round(fin)) + '%';
  if ($id('progressBar')){
    const bar = $id('progressBar');
    bar.style.width = fin + '%';
    bar.className = 'h-3 rounded-full progress-bar';
    if (fin >= 90) bar.classList.add('bg-gradient-to-r','from-green-500','to-green-600');
    else if (fin >= 70) bar.classList.add('bg-gradient-to-r','from-yellow-500','to-yellow-600');
    else if (fin >= 60) bar.classList.add('bg-gradient-to-r','from-orange-500','to-orange-600');
    else bar.classList.add('bg-gradient-to-r','from-red-500','to-red-600');
  }
}

// === Firestore ===
async function obtenerItemsAlumno(db, grupoId, uid){
  // Estructura actual: grupos/{grupo}/calificaciones/{uid}/items
  // Importar los módulos de Firestore usando la misma versión que firebase.js (10.12.3).
  // Para evitar conflictos entre versiones, importamos doc() además de collection().
  const { collection, doc, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
  // En lugar de pasar todos los segmentos de la ruta a collection(), creamos primero
  // una referencia al documento (grupos/{grupo}/calificaciones/{uid}) y luego
  // obtenemos la subcolección 'items' de esa referencia. Esto evita errores del tipo
  // "Expected first argument to collection() to be a CollectionReference...".
  const calificacionRef = doc(db, 'grupos', grupoId, 'calificaciones', uid);
  const base = collection(calificacionRef, 'items');
  const snap = await getDocs(query(base, orderBy('fecha','asc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function main(){
  await ready();
  initFirebase();
  const db = getDb();
  const root = $id('calificaciones-root') || document.body;
  const params = new URLSearchParams(location.search);
  // Determinar el ID del grupo de forma segura, evitando optional chaining que puede
  // generar errores de sintaxis en navegadores antiguos. Usamos el dataset si existe,
  // de lo contrario consultamos los parámetros de la URL y finalmente un valor por defecto.
  let grupoIdVal = 'calidad-2025';
  if (root && root.dataset && root.dataset.grupo) {
    grupoIdVal = root.dataset.grupo;
  } else {
    const p = params.get('grupo');
    if (p) grupoIdVal = p;
  }
  const GRUPO_ID = String(grupoIdVal).trim();

  // Carga automática para el usuario autenticado (si lo hay)
  onAuth(async (user)=>{
    if (!user) return;
    try{
      const items = await obtenerItemsAlumno(db, GRUPO_ID, user.uid);
      renderAlumno(items);
    }catch(e){
      console.error('[calificaciones-backend] error', e);
    }
  });
}

main().catch(console.error);
