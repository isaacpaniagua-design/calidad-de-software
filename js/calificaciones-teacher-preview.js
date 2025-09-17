// js/calificaciones-teacher-preview.es2015.js
// Compat ES2015: llena #studentSelect si está vacío y pinta tabla qsp-*.

import { initFirebase, getDb } from './firebase.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

window.__teacherPreviewLoaded = true;

function $(s, r){ return (r || document).querySelector(s); }
function $id(id){ return document.getElementById(id); }
function ready(){
  return new Promise(function(resolve){
    if (document.readyState === "complete" || document.readyState === "interactive") resolve();
    else document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function fmtPct(n){ return (Number(n)||0).toFixed(2) + '%'; }
function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }

function resumenGlobal(items){
  var porc=0, pond=0;
  for (var i=0;i<items.length;i++){
    var it=items[i];
    var max=Number(it.maxPuntos)||0, pts=Number(it.puntos)||0, pnd=Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}

function ensureUI(root){
  if ($id('student-preview')) return;
  var wrap = document.createElement('section');
  wrap.id = 'student-preview';
  wrap.className = 'qsc-wrap qsc-compact';
  wrap.innerHTML = '\
    <h2 class="qsc-title" style="margin-bottom:10px">Vista de estudiante (preview docente)</h2>\
    <div class="qsc-kpis">\
      <div class="qsc-kpi"><span id="qsp-kpi-total">--%</span><small>Total</small></div>\
      <div class="qsc-kpi"><span id="qsp-kpi-items">0</span><small>Actividades</small></div>\
      <div class="qsc-kpi"><span id="qsp-kpi-pond">0%</span><small>Peso cubierto</small></div>\
    </div>\
    <div class="qsc-bar"><div id="qsp-bar-fill" class="qsc-bar-fill"></div></div>\
    <div class="qsc-table-wrap" style="margin-top:12px">\
      <table class="qsc-table">\
        <thead><tr>\
          <th>Actividad</th><th>Puntos</th><th>Máx</th>\
          <th>Ponderación</th><th>Aporta al final</th><th>Fecha</th>\
        </tr></thead>\
        <tbody id="qsp-tbody"><tr><td class="qsc-muted" colspan="6">Selecciona un alumno…</td></tr></tbody>\
      </table>\
    </div>';
  var anchor = root.querySelector('.qsc-wrap') || root;
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
}

function renderQsp(items){
  var tbody=$id('qsp-tbody'), kpiT=$id('qsp-kpi-total'), kpiI=$id('qsp-kpi-items'), kpiP=$id('qsp-kpi-pond'), bar=$id('qsp-bar-fill');
  var g = resumenGlobal(items);
  if(kpiT) kpiT.textContent = fmtPct(g.porcentaje);
  if(kpiI) kpiI.textContent = String(items.length);
  if(kpiP) kpiP.textContent = fmtPct(g.pondSum);
  if(bar) bar.style.width = g.porcentaje.toFixed(2) + '%';

  if (!tbody) return;
  tbody.innerHTML='';
  if(!items.length){ tbody.innerHTML = '<tr><td class="qsc-muted" colspan="6">Sin actividades registradas aún.</td></tr>'; return; }
  for (var i=0;i<items.length;i++){
    var it=items[i];
    var max=Number(it.maxPuntos)||0, pts=Number(it.puntos)||0, pnd=Number(it.ponderacion)||0;
    var aporta = max>0 ? (pts/max)*pnd : 0;
    var fecha = '—';
    try{
      var d = it.fecha && it.fecha.toDate ? it.fecha.toDate() : (it.fecha instanceof Date ? it.fecha : null);
      fecha = d ? d.toLocaleDateString() : '—';
    }catch(e){}
    tbody.insertAdjacentHTML('beforeend',
      '<tr>' +
        '<td>'+ (it.nombre||it.title||'Actividad') +'</td>' +
        '<td>'+ pts +'</td>' +
        '<td>'+ max +'</td>' +
        '<td>'+ pnd +'%</td>' +
        '<td>'+ (Number(aporta)||0).toFixed(2) +'%</td>' +
        '<td>'+ fecha +'</td>' +
      '</tr>');
  }
}

async function resolverUidPorMatricula(db, matricula){
  try{
    const s = await getDocs(query(collection(db,'users'), where('matricula','==', String(matricula))));
    if(!s.empty) return s.docs[0].id;
  }catch(e){ console.warn('[preview] resolverUidPorMatricula', e); }
  return null;
}
async function obtenerItemsAlumno(db, grupoId, uid){
  const base = collection(db,'grupos',grupoId,'calificaciones',uid,'items');
  const snap = await getDocs(query(base, orderBy('fecha','asc')));
  return snap.docs.map(d=>{ const o=d.data(); o.id=d.id; return o; });
}

async function fetchStudentList(db, grupoId){
  if (Array.isArray(window.students) && window.students.length){
    return window.students.map(function(s){ return { uid: s.uid||null, matricula: s.id||s.matricula||null, displayName: s.name||s.displayName||'Alumno', email: s.email||'' }; });
  }
  const out=[]; const seen={};
  function pushFrom(qSnap){
    qSnap.forEach(function(d){
      const m=d.data()||{}; const uid=d.id;
      const matricula=m.matricula||null;
      const displayName=m.displayName||m.nombre||'Alumno';
      const email=m.email||'';
      const key=uid||((matricula||'')+'|'+email);
      if(!seen[key]){ seen[key]=1; out.push({uid, matricula, displayName, email}); }
    });
  }
  try{
    let s = await getDocs(query(collection(db, 'courses/'+grupoId+'/members'), where('role','==','student'))); if(!s.empty) pushFrom(s);
    s = await getDocs(query(collection(db, 'grupos/'+grupoId+'/members'), where('role','==','student'))); if(!s.empty) pushFrom(s);
    if(!out.length){ s = await getDocs(query(collection(db,'users'), where('role','==','student'))); if(!s.empty) pushFrom(s); }
  }catch(e){}
  return out;
}

async function main(){
  await ready();
  initFirebase();
  const db = getDb();
  const root = $id('calificaciones-root') || document.body;
  const params = new URLSearchParams(location.search);
  const dataset = (root && root.dataset) ? root.dataset : {};
  const GRUPO_ID = ((dataset && dataset.grupo) ? dataset.grupo : (params.get('grupo') || 'calidad-2025')).trim();

  ensureUI(root);

  const sel = $id('studentSelect');
  if (sel){
    if (sel.options.length <= 1){
      sel.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
      const list = await fetchStudentList(db, GRUPO_ID);
      list.sort(function(a,b){ return (a.displayName||'').localeCompare(b.displayName||''); });
      for (var i=0;i<list.length;i++){
        const m = list[i];
        const opt = document.createElement('option');
        const label = m.displayName ? (m.displayName + ' · ' + (m.email||m.matricula||m.uid||'')) : (m.email||m.matricula||m.uid||'Alumno');
        opt.textContent = label;
        opt.value = m.matricula || m.uid || '';
        if (m.uid) opt.setAttribute('data-uid', m.uid);
        sel.appendChild(opt);
      }
    }

    sel.addEventListener('change', async function(){
      const matricula = sel.value;
      const opt = sel.selectedOptions && sel.selectedOptions[0];
      const dataUid = opt && opt.getAttribute('data-uid');
      const uid = dataUid || await resolverUidPorMatricula(db, matricula);
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