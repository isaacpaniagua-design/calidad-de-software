// js/calificaciones-teacher-preview.js
// Vista de estudiante para preview docente: llena #studentSelect si está vacío y pinta tabla qsp-*.

import { initFirebase, getDb } from './firebase.js';

const $ = (s, r=document)=>r.querySelector(s);
const $id = (id)=>document.getElementById(id);
window.__teacherPreviewLoaded = true;

function ready(){ return new Promise(r=>{
  if(/complete|interactive/.test(document.readyState)) r();
  else document.addEventListener('DOMContentLoaded', r, {once:true});
});}

function fmtPct(n){ return (Number(n)||0).toFixed(2) + '%'; }
function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }

function resumenGlobal(items){
  let porc=0, pond=0;
  for(const it of items){
    const max=Number(it.maxPuntos)||0, pts=Number(it.puntos)||0, pnd=Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}

function ensureUI(root){
  if ($id('student-preview')) return;
  const wrap = document.createElement('section');
  wrap.id = 'student-preview';
  wrap.className = 'qsc-wrap qsc-compact';
  wrap.innerHTML = `
    <h2 class="qsc-title" style="margin-bottom:10px">Vista de estudiante (preview docente)</h2>
    <div class="qsc-kpis">
      <div class="qsc-kpi"><span id="qsp-kpi-total">--%</span><small>Total</small></div>
      <div class="qsc-kpi"><span id="qsp-kpi-items">0</span><small>Actividades</small></div>
      <div class="qsc-kpi"><span id="qsp-kpi-pond">0%</span><small>Peso cubierto</small></div>
    </div>
    <div class="qsc-bar"><div id="qsp-bar-fill" class="qsc-bar-fill"></div></div>
    <div class="qsc-table-wrap" style="margin-top:12px">
      <table class="qsc-table">
        <thead><tr>
          <th>Actividad</th><th>Puntos</th><th>Máx</th>
          <th>Ponderación</th><th>Aporta al final</th><th>Fecha</th>
        </tr></thead>
        <tbody id="qsp-tbody"><tr><td class="qsc-muted" colspan="6">Selecciona un alumno…</td></tr></tbody>
      </table>
    </div>`;
  const anchor = root.querySelector('.qsc-wrap') || root;
  anchor.after(wrap);
}

function renderQsp(items){
  const tbody=$id('qsp-tbody'), kpiT=$id('qsp-kpi-total'), kpiI=$id('qsp-kpi-items'), kpiP=$id('qsp-kpi-pond'), bar=$id('qsp-bar-fill');
  const { porcentaje, pondSum } = resumenGlobal(items);
  if(kpiT) kpiT.textContent = fmtPct(porcentaje);
  if(kpiI) kpiI.textContent = String(items.length);
  if(kpiP) kpiP.textContent = fmtPct(pondSum);
  if(bar) bar.style.width = porcentaje.toFixed(2) + '%';

  if (!tbody) return;
  tbody.innerHTML='';
  if(!items.length){ tbody.innerHTML = `<tr><td class="qsc-muted" colspan="6">Sin actividades registradas aún.</td></tr>`; return; }
  for(const it of items){
    const max=Number(it.maxPuntos)||0, pts=Number(it.puntos)||0, pnd=Number(it.ponderacion)||0;
    const aporta = max>0 ? (pts/max)*pnd : 0;
    const fecha = (()=>{ try{ const d = it.fecha?.toDate ? it.fecha.toDate() : (it.fecha instanceof Date ? it.fecha : null); return d? d.toLocaleDateString() : '—'; } catch(_){ return '—'; } })();
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${it.nombre||it.title||'Actividad'}</td>
        <td>${pts}</td>
        <td>${max}</td>
        <td>${pnd}%</td>
        <td>${(Number(aporta)||0).toFixed(2)}%</td>
        <td>${fecha}</td>
      </tr>`);
  }
}

// --- Firestore helpers
async function resolverUidPorMatricula(db, matricula){
  try{
  // Importar Firestore desde la misma versión que firebase.js (10.12.3) para evitar
  // incompatibilidades con las instancias de Firestore.
  const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    const s = await getDocs(query(collection(db,'users'), where('matricula','==', String(matricula))));
    if(!s.empty) return s.docs[0].id;
  }catch(e){ console.warn('[preview] resolverUidPorMatricula', e); }
  return null;
}
async function obtenerItemsAlumno(db, grupoId, uid){
  const { collection, doc, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
  // En lugar de pasar todos los segmentos a collection(), creamos una referencia al documento
  // grupos/{grupoId}/calificaciones/{uid} y luego obtenemos la subcolección 'items'. Esto
  // evita errores de versión al construir rutas anidadas directamente con collection().
  const calificacionRef = doc(db, 'grupos', grupoId, 'calificaciones', uid);
  const base = collection(calificacionRef, 'items');
  const snap = await getDocs(query(base, orderBy('fecha','asc')));
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}

async function fetchStudentList(db, grupoId){
  // 1) lista local si existe
  if (Array.isArray(window.students) && window.students.length){
    return window.students.map(s=>({ uid: s.uid||null, matricula: s.id||s.matricula||null, displayName: s.name||s.displayName||'Alumno', email: s.email||'' }));
  }
  // 2) Firestore: courses/grupos/users
  const out=[]; const seen=new Set();
  async function pushFrom(qSnap){
    qSnap.forEach(d=>{
      const m=d.data()||{}; const uid=d.id;
      const matricula=m.matricula||null;
      const displayName=m.displayName||m.nombre||'Alumno';
      const email=m.email||'';
      const key=uid||`${matricula}|${email}`;
      if(!seen.has(key)){ seen.add(key); out.push({uid, matricula, displayName, email}); }
    });
  }
  try{
    const { collection, doc, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    // Para evitar pasar rutas con barras ("/") a collection(), construimos una referencia
    // al documento y luego solicitamos la subcolección 'members'.
    let s;
    try {
      const courseRef = doc(db, 'courses', grupoId);
      const courseMembers = collection(courseRef, 'members');
      s = await getDocs(query(courseMembers, where('role','==','student')));
      if(!s.empty) await pushFrom(s);
    } catch (_){ /* ignorar */ }
    try {
      const grupoRef = doc(db, 'grupos', grupoId);
      const grupoMembers = collection(grupoRef, 'members');
      s = await getDocs(query(grupoMembers, where('role','==','student')));
      if(!s.empty) await pushFrom(s);
    } catch (_){ /* ignorar */ }
    if(!out.length){ s = await getDocs(query(collection(db,'users'), where('role','==','student'))); if(!s.empty) await pushFrom(s); }
  }catch(_){}
  return out;
}

async function main(){
  await ready();
  initFirebase();
  const db = getDb();
  const root = $id('calificaciones-root') || document.body;
  const params = new URLSearchParams(location.search);
  const GRUPO_ID = (root?.dataset?.grupo || params.get('grupo') || 'calidad-2025').trim();

  ensureUI(root);

  const sel = $id('studentSelect');
  if (sel){
    // Poblar si está vacío o solo tiene el placeholder
    if (sel.options.length <= 1){
      sel.innerHTML = `<option value="">-- Seleccione un estudiante --</option>`;
      const list = await fetchStudentList(db, GRUPO_ID);
      list.sort((a,b)=> (a.displayName||'').localeCompare(b.displayName||''));
      for(const m of list){
        const opt = document.createElement('option');
        opt.textContent = m.displayName ? `${m.displayName} · ${m.email||m.matricula||m.uid}` : (m.email||m.matricula||m.uid||'Alumno');
        opt.value = m.matricula || m.uid || '';
        if (m.uid) opt.dataset.uid = m.uid;
        sel.appendChild(opt);
      }
    }

    sel.addEventListener('change', async ()=>{
      const matricula = sel.value;
      const opt = sel.selectedOptions[0];
      const uid = opt?.dataset?.uid || await resolverUidPorMatricula(db, matricula);
      if(!uid){ $id('qsp-tbody').innerHTML='<tr><td class="qsc-muted" colspan="6">No se encontró UID para la selección.</td></tr>'; return; }
      try{
        const items = await obtenerItemsAlumno(db, GRUPO_ID, uid);
        renderQsp(items);
      }catch(e){
        console.error('[preview] obtenerItemsAlumno', e);
        $id('qsp-tbody').innerHTML='<tr><td class="qsc-muted" colspan="6">Error al cargar datos.</td></tr>';
      }
    });
  }
}

main().catch(console.error);
