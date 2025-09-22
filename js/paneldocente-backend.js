// js/paneldocente-backend.js
// Backend para paneldocente.html (docente). Firebase 10.12.3 · ES2015.

import { initFirebase, getDb, onAuth, isTeacherByDoc, isTeacherEmail } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

function $(sel, root){ return (root || document).querySelector(sel); }
function $id(id){ return document.getElementById(id); }
function ready(){ return new Promise(function(r){ if(/complete|interactive/.test(document.readyState)) r(); else document.addEventListener('DOMContentLoaded', r, {once:true}); }); }
function fmtDate(d){ try{ return d.toLocaleDateString(); }catch(e){ return '—'; } }
function toDate(v){
  if (v && typeof v.toDate==='function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v==='string') { var t=Date.parse(v); return isNaN(t)? null : new Date(t); }
  return null;
}
function clamp100(n){ n = Number(n)||0; if(n<0) return 0; if(n>100) return 100; return n; }
function toEscala5(p){ return (Number(p||0)*0.05).toFixed(1); }
var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
function escHtml(str){ return String(str==null? '': str).replace(/[&<>"']/g, function(ch){ return ESC_MAP[ch] || ch; }); }
function escAttr(str){ return escHtml(str); }
function updateSyncStamp(){ var now=new Date(); setText('pd-summary-sync', fmtDate(now)+' '+now.toLocaleTimeString()); }


function showStatusBanner(title, message, variant){
  var banner = $id('pd-status-banner');
  if (!banner) return;
  var titleEl = $id('pd-status-title');
  var msgEl = $id('pd-status-message');
  if (titleEl) titleEl.textContent = title || '';
  if (msgEl) msgEl.textContent = message || '';
  banner.setAttribute('data-variant', variant || 'info');
  banner.hidden = false;
}

function hideStatusBanner(){
  var banner = $id('pd-status-banner');
  if (banner) banner.hidden = true;
}

function setPanelLocked(root, locked){
  var target = root || $id('paneldocente-root');
  if (!target) return;
  if (locked) target.setAttribute('data-locked', 'true');
  else target.removeAttribute('data-locked');
}

async function computeTeacherState(user){
  var email = user && user.email ? user.email : '';
  var teacher = false;
  if (user && user.uid){
    try { teacher = await isTeacherByDoc(user.uid); }
    catch(_){ teacher = false; }
  }
  if (!teacher && email){
    try { teacher = isTeacherEmail(email); }
    catch(_){ teacher = false; }
  }
  return { user: user || null, email: email, isTeacher: !!teacher };
}


// ===== Cálculo de calificaciones =====
function inferUnidad(it){
  if (it.unidad!=null) return Number(it.unidad);
  var n = String(it.nombre||it.title||'').toLowerCase();
  if (/\bu1\b|unidad\s*1/.test(n)) return 1;
  if (/\bu2\b|unidad\s*2/.test(n)) return 2;
  if (/\bu3\b|unidad\s*3/.test(n)) return 3;
  return 0;
}
function resumenGlobal(items){
  var porc=0, pond=0;
  for (var i=0;i<items.length;i++){
    var it=items[i];
    var max=Number(it.maxPuntos)||0, pts=Number(it.puntos)||0, pnd=Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clamp100(porc), pondSum: clamp100(pond) };
}
function bucketsPorUnidad(items){
  var B={1:[],2:[],3:[]};
  for(var i=0;i<items.length;i++){ var u=inferUnidad(items[i]); if(u===1||u===2||u===3) B[u].push(items[i]); }
  return B;
}
function scoreUnidad(arr){ if(!arr.length) return 0; return resumenGlobal(arr).porcentaje; }
function final3040(u1,u2,u3){ return clamp100(u1*0.3 + u2*0.3 + u3*0.4); }

function computeMetricsFromItems(items){
  var b=bucketsPorUnidad(items);
  var u1=scoreUnidad(b[1]), u2=scoreUnidad(b[2]), u3=scoreUnidad(b[3]);
  return { u1:u1, u2:u2, u3:u3, finalPct: final3040(u1,u2,u3) };
}

// ===== Firestore =====
async function fetchStudents(db, grupoId){
  var out = []; var seen={};
  try{
    var s = await getDocs(query(collection(db, 'grupos/'+grupoId+'/members'), where('role','==','student')));
    s.forEach(function(d){ var m=d.data()||{}; var uid=d.id; if(!seen[uid]){ seen[uid]=1; out.push({uid:uid, displayName:m.displayName||m.nombre||'Alumno', email:m.email||'', matricula:m.matricula||null}); } });
  }catch(e){}
  if (!out.length){
    try{
      var s2 = await getDocs(query(collection(db, 'users'), where('role','==','student'), limit(300)));
      s2.forEach(function(d){ var m=d.data()||{}; var uid=d.id; if(!seen[uid]){ seen[uid]=1; out.push({uid:uid, displayName:m.displayName||m.nombre||'Alumno', email:m.email||'', matricula:m.matricula||null}); } });
    }catch(e){}
  }
  return out;
}
async function fetchCalifItems(db, grupoId, uid){
  try {
    var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'calificaciones', uid, 'items'), orderBy('fecha','asc')));
    var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
    return arr;
  } catch (e) {
    console.error('Error al obtener calificaciones para', uid, e);
    return [];
  }
}
async function fetchDeliverables(db, grupoId){
  try {
    var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'deliverables'), orderBy('dueAt','asc')));
    var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
    return arr;
  } catch (e) {
    console.error('Error al obtener entregables', e);
    return [];
  }
}
async function fetchExams(db, grupoId){
  try {
    var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'exams')));
    var map={}; snap.forEach(function(d){ map[d.id]=d.data(); });
    return map; // u1/u2
  } catch (e) {
    console.error('Error al obtener ligas de exámenes', e);
    return {};
  }
}
async function fetchGantt(db, grupoId){
  try {
    var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'gantt'), orderBy('startAt','asc')));
    var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
    return arr;
  } catch (e) {
    console.error('Error al obtener el cronograma', e);
    return [];
  }
}
async function getRubric(db, grupoId){
  try {
    var r = await getDoc(doc(db, 'grupos', grupoId, 'rubric', 'main'));
    return r.exists() ? r.data() : { content: '' };
  } catch (e) {
    console.error('Error al obtener la rúbrica', e);
    return { content: '' };
  }
}
async function saveRubric(db, grupoId, content){
  await setDoc(doc(db, 'grupos', grupoId, 'rubric', 'main'), { content: content, updatedAt: serverTimestamp() }, { merge: true });
}
async function createDeliverable(db, grupoId, payload){
  var ref = await addDoc(collection(db, 'grupos', grupoId, 'deliverables'), Object.assign({}, payload, { createdAt: serverTimestamp() }));
  return ref.id;
}
async function updateDeliverable(db, grupoId, id, patch){
  await updateDoc(doc(db, 'grupos', grupoId, 'deliverables', id), Object.assign({}, patch, { updatedAt: serverTimestamp() }));
}
async function deleteDeliverable(db, grupoId, id){
  await updateDoc(doc(db, 'grupos', grupoId, 'deliverables', id), { deleted: true, updatedAt: serverTimestamp() });
}

// ===== Render =====
function setText(id, value){ var el=$id(id); if(el) el.textContent = String(value); }
function renderSummaryStats(students, metrics){
  setText('pd-summary-total-students', students.length);
  var finals=[], k; for(k in metrics){ if (metrics[k] && !isNaN(metrics[k].finalPct)) finals.push(metrics[k].finalPct); }
  var avg = finals.length ? finals.reduce(function(a,b){return a+b;},0)/finals.length : 0;
  setText('pd-summary-avg-final', toEscala5(avg));
}

function renderDeliverablesList(arr){
  var tbody = $id('pd-deliverables-tbody'); if (!tbody) return;
  tbody.innerHTML='';
  var countActive = 0;
  if (!Array.isArray(arr) || !arr.length){
    setText('pd-summary-active-deliverables', 0);
    tbody.innerHTML = '<tr><td colspan="6" class="pd-empty">Sin entregables.</td></tr>';
    return;
  }
  for (var i=0;i<arr.length;i++){
    var d = arr[i];
    var due = toDate(d.dueAt);
    var dueTxt = due ? fmtDate(due) : '—';
    var w = (d.weight!=null) ? (d.weight+'%') : '—';
    if (!d.deleted) countActive++;
    var deleted = d.deleted ? ' (eliminado)' : '';
    var row = '\
      <tr data-id="'+ escAttr(d.id) +'">\
        <td>'+ escHtml(d.title||'Entregable') + deleted +'</td>\
        <td>'+ escHtml(d.description||'—') +'</td>\
        <td style="text-align:center">'+ escHtml(d.unidad||'—') +'</td>\
        <td style="text-align:right">'+ escHtml(w) +'</td>\
        <td style="text-align:center">'+ escHtml(dueTxt) +'</td>\
        <td style="text-align:right"><button class="pd-deliv-edit pd-action-btn">Editar</button> <button class="pd-deliv-del pd-action-btn">Eliminar</button></td>\
      </tr>';
    tbody.insertAdjacentHTML('beforeend', row);
  }
  setText('pd-summary-active-deliverables', countActive);
}

function renderStudentsTable(students, metrics){
  var tbody = $id('pd-students-tbody'); if (!tbody) return;
  tbody.innerHTML='';
  if (!students.length){ tbody.innerHTML = '<tr><td colspan="7" class="pd-empty">Sin estudiantes.</td></tr>'; return; }
  for (var i=0;i<students.length;i++){
    var s = students[i];
    var m = metrics[s.uid] || { u1:0,u2:0,u3:0, finalPct:0 };
    var row = '\
      <tr>\
        <td style="text-align:center"><input type="checkbox" class="pd-student-check" data-email="'+ escAttr(s.email||'') +'" aria-label="Seleccionar estudiante" /></td>\
        <td>'+ escHtml(s.displayName||'Alumno') +'</td>\
        <td>'+ escHtml(s.email||'') +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u1)) +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u2)) +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u3)) +'</td>\
        <td style="text-align:right; font-weight:700">'+ escHtml(toEscala5(m.finalPct)) +'</td>\
      </tr>';
    tbody.insertAdjacentHTML('beforeend', row);
  }
}

function renderExams(exams){
  var u1 = exams['u1'] || exams['unidad1'];
  var u2 = exams['u2'] || exams['unidad2'];
  var a1 = $id('pd-exam-u1-link');
  var a2 = $id('pd-exam-u2-link');
  if (a1 && u1 && u1.url) { a1.href = u1.url; a1.removeAttribute('aria-disabled'); }
  if (a2 && u2 && u2.url) { a2.href = u2.url; a2.removeAttribute('aria-disabled'); }
}

function renderGanttTable(rows){
  var ganttTbody = $id('pd-gantt-tbody');
  if (!ganttTbody) return;
  ganttTbody.innerHTML='';
  if (!Array.isArray(rows) || !rows.length){
    ganttTbody.innerHTML = '<tr><td colspan="5" class="pd-empty">Sin actividades programadas.</td></tr>';
    return;
  }
  for (var i=0;i<rows.length;i++){
    var t = rows[i] || {};
    var s = toDate(t.startAt);
    var e = toDate(t.endAt);
    var row='\
      <tr>\
        <td>'+ escHtml(t.title||'Tarea') +'</td>\
        <td>'+ escHtml(s?fmtDate(s):'—') +'</td>\
        <td>'+ escHtml(e?fmtDate(e):'—') +'</td>\
        <td>'+ escHtml(t.owner||'—') +'</td>\
        <td>'+ escHtml(t.status||'pendiente') +'</td>\
      </tr>';
    ganttTbody.insertAdjacentHTML('beforeend', row);
  }
}

async function populateAssignments(db, grupoId){
  var asgTbody = $id('pd-assignments-tbody');
  if (!asgTbody) return;
  try {
    var asnap = await getDocs(query(collection(db, 'grupos', grupoId, 'assignments'), orderBy('unidad','asc')));
    asgTbody.innerHTML='';
    if (asnap.empty){
      asgTbody.innerHTML = '<tr><td colspan="5" class="pd-empty">Sin asignaciones.</td></tr>';
      return;
    }
    asnap.forEach(function(d){
      var a = d.data() || {};
      var row='\
        <tr>\
          <td>'+ escHtml(a.title||'Asignación') +'</td>\
          <td style="text-align:center">'+ escHtml(a.unidad||'—') +'</td>\
          <td style="text-align:right">'+ ((a.ponderacion!=null)? escHtml(a.ponderacion+'%') : '—') +'</td>\
          <td>'+ escHtml(a.calItemKey||'—') +'</td>\
          <td>'+ escHtml(a.description||'—') +'</td>\
        </tr>';
      asgTbody.insertAdjacentHTML('beforeend', row);
    });
  } catch (e) {
    console.error('Error al obtener asignaciones', e);
    asgTbody.innerHTML = '<tr><td colspan="5" class="pd-empty">No fue posible cargar las asignaciones.</td></tr>';
  }
}

// ===== Mailto =====
function openMailTo(list, subject, body){
  if (!list || !list.length) return;
  var emails = list.map(function(x){ return x.email; }).filter(Boolean);
  if (!emails.length) return;
  var mailto = 'mailto:'+ encodeURIComponent(emails.join(',')) +
    '?subject=' + encodeURIComponent(subject||'Recordatorio') +
    '&body=' + encodeURIComponent(body||'Hola, este es un recordatorio.');
  window.location.href = mailto;
}

function bindRubricSave(db, grupo){
  var btn = $id('pd-rubric-save');
  if (!btn || btn.__pdBound) return;
  btn.__pdBound = true;
  btn.addEventListener('click', async function(){
    var textarea = $id('pd-rubric-text');
    var val = textarea && textarea.value ? textarea.value : '';
    try {
      await saveRubric(db, grupo, val);
      alert('Rúbrica guardada.');
    } catch (err) {
      console.error('No se pudo guardar la rúbrica', err);
      alert('No se pudo guardar la rúbrica: ' + (err && err.message ? err.message : err));
    }
  });
}

function bindDeliverableForm(db, grupo, state){
  var form = $id('pd-new-deliverable-form');
  if (!form || form.__pdBound) return;
  form.__pdBound = true;
  form.addEventListener('submit', async function(ev){
    ev.preventDefault();
    var title = ($id('pd-deliv-title') && $id('pd-deliv-title').value) || '';
    var desc  = ($id('pd-deliv-desc') && $id('pd-deliv-desc').value) || '';
    var unidad= ($id('pd-deliv-unidad') && $id('pd-deliv-unidad').value) || '';
    var weight= Number(($id('pd-deliv-weight') && $id('pd-deliv-weight').value) || 0);
    var due   = toDate(($id('pd-deliv-due') && $id('pd-deliv-due').value) || '');
    var payload = { title:title, description:desc, unidad: unidad? Number(unidad):null, weight:weight };
    if (due) payload.dueAt = Timestamp.fromDate(due);
    try {
      await createDeliverable(db, grupo, payload);
      state.deliverables = await fetchDeliverables(db, grupo);
      renderDeliverablesList(state.deliverables);
      updateSyncStamp();
      if ($id('pd-deliv-title')) $id('pd-deliv-title').value='';
      if ($id('pd-deliv-desc')) $id('pd-deliv-desc').value='';
      if ($id('pd-deliv-unidad')) $id('pd-deliv-unidad').value='';
      if ($id('pd-deliv-weight')) $id('pd-deliv-weight').value='';
      if ($id('pd-deliv-due')) $id('pd-deliv-due').value='';
    } catch (err) {
      console.error('No se pudo crear el entregable', err);
      alert('No se pudo crear el entregable: ' + (err && err.message ? err.message : err));
    }
  });
}

function bindDeliverableTable(db, grupo, state){
  var delTbody = $id('pd-deliverables-tbody');
  if (!delTbody || delTbody.__pdBound) return;
  delTbody.__pdBound = true;
  delTbody.addEventListener('click', async function(ev){
    var btn = ev.target;
    var tr = btn && btn.closest ? btn.closest('tr[data-id]') : null;
    var id = tr ? tr.getAttribute('data-id') : null;
    if (!id) return;
    if (btn.classList.contains('pd-deliv-del')){
      if (!confirm('¿Eliminar entregable?')) return;
      try {
        await deleteDeliverable(db, grupo, id);
        state.deliverables = await fetchDeliverables(db, grupo);
        renderDeliverablesList(state.deliverables);
        updateSyncStamp();
      } catch (err) {
        console.error('No se pudo eliminar el entregable', err);
        alert('No se pudo eliminar el entregable: ' + (err && err.message ? err.message : err));
      }
    } else if (btn.classList.contains('pd-deliv-edit')){
      var firstCell = tr ? tr.querySelector('td') : null;
      var nuevo = prompt('Nuevo título:', firstCell ? firstCell.textContent : '');
      if (nuevo && nuevo.trim()){
        var trimmed = nuevo.trim();
        try {
          await updateDeliverable(db, grupo, id, { title: trimmed });
          if (firstCell) firstCell.textContent = trimmed;
          updateSyncStamp();
        } catch (err) {
          console.error('No se pudo actualizar el entregable', err);
          alert('No se pudo actualizar el entregable: ' + (err && err.message ? err.message : err));
        }
      }
    }
  });
}

function bindReminder(state){
  var remindBtn = $id('pd-remind-selected');
  if (!remindBtn || remindBtn.__pdBound) return;
  remindBtn.__pdBound = true;
  remindBtn.addEventListener('click', function(){
    var checks = document.querySelectorAll('.pd-student-check:checked');
    var list = [];
    for (var i=0;i<checks.length;i++){
      var em = checks[i].getAttribute('data-email') || '';
      if (em) list.push({ email: em });
    }
    if (!list.length) list = state.students || [];
    openMailTo(list, 'Recordatorio del curso', 'Hola, este es un recordatorio del curso de Calidad.');
  });
}

async function loadDataForGroup(db, grupo, state){
  state.students = await fetchStudents(db, grupo);
  var metrics = {};
  state.metrics = metrics;
  var CONC=5, idx=0;
  async function nextBatch(){
    var batch=[];
    for (var k=0; k<CONC && idx<state.students.length; k++, idx++){
      (function(s){
        batch.push((async function(){
          try {
            var items = await fetchCalifItems(db, grupo, s.uid);
            metrics[s.uid] = computeMetricsFromItems(items);
          } catch (err) {
            console.error('No se pudieron calcular métricas para', s.uid, err);
            metrics[s.uid] = { u1:0, u2:0, u3:0, finalPct:0 };
          }
        })());
      })(state.students[idx]);
    }
    if (!batch.length) return;
    await Promise.all(batch);
    if (idx < state.students.length) return nextBatch();
  }
  await nextBatch();

  renderSummaryStats(state.students, metrics);
  state.deliverables = await fetchDeliverables(db, grupo);
  renderDeliverablesList(state.deliverables);
  var exams = await fetchExams(db, grupo);
  renderExams(exams);

  renderStudentsTable(state.students, metrics);

  updateSyncStamp();

  var rub = await getRubric(db, grupo);
  if ($id('pd-rubric-text')) $id('pd-rubric-text').value = rub && rub.content ? rub.content : '';


  bindRubricSave(db, grupo);
  bindDeliverableForm(db, grupo, state);
  bindDeliverableTable(db, grupo, state);
  bindReminder(state);

  var gantt = await fetchGantt(db, grupo);
  renderGanttTable(gantt);
  await populateAssignments(db, grupo);
}


// ===== Main =====
async function main(){
  await ready();
  initFirebase();
  var db = getDb();

  var root = $id('paneldocente-root') || document.body;
  var params = new URLSearchParams(location.search);
  var dataset = root && root.dataset ? root.dataset : {};
  var grupo = (dataset && dataset.grupo ? dataset.grupo : (params.get('grupo') || 'calidad-2025')).trim();

  var state = { students: [], deliverables: [], metrics: {} };
  var isLoading = false;
  var hasLoaded = false;
  var lastLoadedUid = null;

  setPanelLocked(root, true);
  showStatusBanner('Preparando panel…', 'Esperando autenticación.', 'info');

  onAuth(function(user){
    handleAuthChange(user).catch(function(err){ console.error(err); });
  });

  async function handleAuthChange(user){
    var info = await computeTeacherState(user);
    var body = document.body;
    if (body) {
      body.classList.toggle('teacher-yes', !!info.isTeacher);
      body.classList.toggle('teacher-no', !info.isTeacher);
    }


    if (!info.isTeacher){
      hasLoaded = false;
      lastLoadedUid = null;
      setPanelLocked(root, true);
      showStatusBanner(
        user ? 'Sin privilegios de docente' : 'Autenticación requerida',
        user
          ? 'Tu cuenta no tiene permisos para ver este panel. Solicita acceso al coordinador.'
          : 'Inicia sesión con tu cuenta institucional de docente para revisar este panel.',
        user ? 'warning' : 'info'
      );
      return;
    }

    var uid = user && user.uid ? user.uid : null;
    if (hasLoaded && lastLoadedUid === uid){
      hideStatusBanner();
      setPanelLocked(root, false);
      return;
    }

    if (isLoading) return;
    isLoading = true;
    showStatusBanner('Cargando información del grupo…', 'Obteniendo datos desde Firebase.', 'info');
    try {
      await loadDataForGroup(db, grupo, state);
      hideStatusBanner();
      setPanelLocked(root, false);
      hasLoaded = true;
      lastLoadedUid = uid;
    } catch (err) {
      console.error('No se pudo cargar la información del panel', err);
      showStatusBanner(
        'No se pudieron cargar los datos',
        'Verifica tu conexión o permisos e intenta nuevamente.',
        'error'
      );
      setPanelLocked(root, true);
      hasLoaded = false;
      lastLoadedUid = null;
    } finally {
      isLoading = false;

    }
  }
}

main().catch(console.error);
