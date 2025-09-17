// js/paneldocente-backend.js
// Backend para paneldocente.html (docente). Firebase 10.12.3 · ES2015.

import { initFirebase, getDb, onAuth, isTeacherByDoc, isTeacherEmail } from './firebase.js';
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
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
  var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'calificaciones', uid, 'items'), orderBy('fecha','asc')));
  var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
  return arr;
}
async function fetchDeliverables(db, grupoId){
  var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'deliverables'), orderBy('dueAt','asc')));
  var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
  return arr;
}
async function fetchExams(db, grupoId){
  var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'exams')));
  var map={}; snap.forEach(function(d){ map[d.id]=d.data(); });
  return map; // u1/u2
}
async function fetchGantt(db, grupoId){
  var snap = await getDocs(query(collection(db, 'grupos', grupoId, 'gantt'), orderBy('startAt','asc')));
  var arr=[]; snap.forEach(function(d){ var o=d.data(); o.id=d.id; arr.push(o); });
  return arr;
}
async function getRubric(db, grupoId){
  var r = await getDoc(doc(db, 'grupos', grupoId, 'rubric', 'main'));
  return r.exists() ? r.data() : { content: '' };
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
  if (!arr.length){ tbody.innerHTML = '<tr><td colspan="6" class="qsc-muted">Sin entregables.</td></tr>'; return; }
  for (var i=0;i<arr.length;i++){
    var d = arr[i];
    var due = toDate(d.dueAt);
    var dueTxt = due ? fmtDate(due) : '—';
    var w = (d.weight!=null) ? (d.weight+'%') : '—';
    var deleted = d.deleted ? ' (eliminado)' : '';
    var row = '\
      <tr data-id="'+d.id+'">\
        <td>'+ (d.title||'Entregable') + deleted +'</td>\
        <td>'+ (d.description||'—') +'</td>\
        <td style="text-align:center">'+ (d.unidad||'—') +'</td>\
        <td style="text-align:right">'+ w +'</td>\
        <td style="text-align:center">'+ dueTxt +'</td>\
        <td style="text-align:right"><button class="pd-deliv-edit action-btn">Editar</button> <button class="pd-deliv-del action-btn">Eliminar</button></td>\
      </tr>';
    tbody.insertAdjacentHTML('beforeend', row);
  }
}

function renderStudentsTable(students, metrics){
  var tbody = $id('pd-students-tbody'); if (!tbody) return;
  tbody.innerHTML='';
  if (!students.length){ tbody.innerHTML = '<tr><td colspan="6" class="qsc-muted">Sin estudiantes.</td></tr>'; return; }
  for (var i=0;i<students.length;i++){
    var s = students[i];
    var m = metrics[s.uid] || { u1:0,u2:0,u3:0, finalPct:0 };
    var row = '\
      <tr>\
        <td>'+(s.displayName||'Alumno')+'</td>\
        <td>'+(s.email||'')+'</td>\
        <td style="text-align:right">'+ toEscala5(m.u1) +'</td>\
        <td style="text-align:right">'+ toEscala5(m.u2) +'</td>\
        <td style="text-align:right">'+ toEscala5(m.u3) +'</td>\
        <td style="text-align:right; font-weight:700">'+ toEscala5(m.finalPct) +'</td>\
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

// ===== Main =====
async function main(){
  await ready();
  initFirebase();
  var db = getDb();

  var root = $id('paneldocente-root') || document.body;
  var params = new URLSearchParams(location.search);
  var dataset = root && root.dataset ? root.dataset : {};
  var grupo = (dataset && dataset.grupo ? dataset.grupo : (params.get('grupo') || 'calidad-2025')).trim();

  // Autorización mínima (para UI)
  var isTeacher = false;
  onAuth(async function(user){
    var email = user && user.email ? user.email : '';
    isTeacher = user && user.uid ? (await isTeacherByDoc(user.uid) || isTeacherEmail(email)) : false;
    var b = document.body;
    if (b) { b.classList.toggle('teacher-yes', !!isTeacher); b.classList.toggle('teacher-no', !isTeacher); }
  });

  // Datos base
  var students = await fetchStudents(db, grupo);

  // Métricas por alumno
  var metrics = {}; var CONC=5, idx=0;
  async function nextBatch(){
    var batch=[];
    for (var k=0; k<CONC && idx<students.length; k++, idx++){
      (function(s){
        batch.push((async function(){
          var items = await fetchCalifItems(db, grupo, s.uid);
          metrics[s.uid] = computeMetricsFromItems(items);
        })());
      })(students[idx]);
    }
    await Promise.all(batch);
    if (idx < students.length) return nextBatch();
  }
  await nextBatch();

  // Renderizado
  renderSummaryStats(students, metrics);
  var deliverables = await fetchDeliverables(db, grupo);
  renderDeliverablesList(deliverables);
  var exams = await fetchExams(db, grupo);
  renderExams(exams);
  renderStudentsTable(students, metrics);

  // Rúbrica
  var rub = await getRubric(db, grupo);
  if ($id('pd-rubric-text')) $id('pd-rubric-text').value = rub && rub.content ? rub.content : '';
  if ($id('pd-rubric-save')){
    $id('pd-rubric-save').addEventListener('click', async function(){
      var val = ($id('pd-rubric-text') && $id('pd-rubric-text').value) || '';
      await saveRubric(db, grupo, val);
      alert('Rúbrica guardada.');
    });
  }

  // CRUD entregables
  var form = $id('pd-new-deliverable-form');
  if (form){
    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      var title = ($id('pd-deliv-title') && $id('pd-deliv-title').value) || '';
      var desc  = ($id('pd-deliv-desc') && $id('pd-deliv-desc').value) || '';
      var unidad= ($id('pd-deliv-unidad') && $id('pd-deliv-unidad').value) || '';
      var weight= Number(($id('pd-deliv-weight') && $id('pd-deliv-weight').value) || 0);
      var due   = toDate(($id('pd-deliv-due') && $id('pd-deliv-due').value) || '');
      var payload = { title:title, description:desc, unidad: unidad? Number(unidad):null, weight:weight };
      if (due) payload.dueAt = Timestamp.fromDate(due);
      await createDeliverable(db, grupo, payload);
      deliverables = await fetchDeliverables(db, grupo);
      renderDeliverablesList(deliverables);
      if ($id('pd-deliv-title')) $id('pd-deliv-title').value='';
      if ($id('pd-deliv-desc')) $id('pd-deliv-desc').value='';
      if ($id('pd-deliv-unidad')) $id('pd-deliv-unidad').value='';
      if ($id('pd-deliv-weight')) $id('pd-deliv-weight').value='';
      if ($id('pd-deliv-due')) $id('pd-deliv-due').value='';
    });
  }

  var delTbody = $id('pd-deliverables-tbody');
  if (delTbody){
    delTbody.addEventListener('click', async function(ev){
      var btn = ev.target;
      var tr = btn && btn.closest ? btn.closest('tr[data-id]') : null;
      var id = tr ? tr.getAttribute('data-id') : null;
      if (!id) return;
      if (btn.classList.contains('pd-deliv-del')){
        if (!confirm('¿Eliminar entregable?')) return;
        await deleteDeliverable(db, grupo, id);
        deliverables = await fetchDeliverables(db, grupo);
        renderDeliverablesList(deliverables);
      } else if (btn.classList.contains('pd-deliv-edit')){
        var nuevo = prompt('Nuevo título:', tr.querySelector('td').textContent);
        if (nuevo){ await updateDeliverable(db, grupo, id, { title:nuevo }); tr.querySelector('td').textContent = nuevo; }
      }
    });
  }

  // Recordatorios manuales
  var remindBtn = $id('pd-remind-selected');
  if (remindBtn){
    remindBtn.addEventListener('click', function(){
      var checks = document.querySelectorAll('.pd-student-check:checked');
      var list = [];
      for (var i=0;i<checks.length;i++){ var em = checks[i].getAttribute('data-email') || ''; list.push({ email: em }); }
      if (!list.length) list = students;
      openMailTo(list, 'Recordatorio del curso', 'Hola, este es un recordatorio del curso de Calidad.');
    });
  }

  // Gantt
  var gantt = await fetchGantt(db, grupo);
  var ganttTbody = $id('pd-gantt-tbody');
  if (ganttTbody){
    ganttTbody.innerHTML='';
    for (var i=0;i<gantt.length;i++){
      var t = gantt[i];
      var s = toDate(t.startAt), e = toDate(t.endAt);
      var row = '\
        <tr>\
          <td>'+ (t.title||'Tarea') +'</td>\
          <td>'+ (s?fmtDate(s):'—') +'</td>\
          <td>'+ (e?fmtDate(e):'—') +'</td>\
          <td>'+ (t.owner||'—') +'</td>\
          <td>'+ (t.status||'pendiente') +'</td>\
        </tr>';
      ganttTbody.insertAdjacentHTML('beforeend', row);
    }
  }

  // Asignaciones (si existen)
  var asgTbody = $id('pd-assignments-tbody');
  if (asgTbody){
    var asnap = await getDocs(query(collection(db, 'grupos', grupo, 'assignments'), orderBy('unidad','asc')));
    asgTbody.innerHTML='';
    if (asnap.empty){ asgTbody.innerHTML = '<tr><td colspan="6" class="qsc-muted">Sin asignaciones.</td></tr>'; }
    else{
      asnap.forEach(function(d){
        var a = d.data(); var row='\
          <tr>\
            <td>'+ (a.title||'Asignación') +'</td>\
            <td style="text-align:center">'+ (a.unidad||'—') +'</td>\
            <td style="text-align:right">'+ ((a.ponderacion!=null)? (a.ponderacion+'%') : '—') +'</td>\
            <td>'+ (a.calItemKey||'—') +'</td>\
            <td>'+ (a.description||'—') +'</td>\
          </tr>';
        asgTbody.insertAdjacentHTML('beforeend', row);
      });
    }
  }
}

main().catch(console.error);
