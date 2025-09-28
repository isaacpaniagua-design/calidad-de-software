// js/paneldocente-backend.js
// Backend para paneldocente.html (docente). Firebase 10.12.3 · ES2015.

import { initFirebase, getDb, onAuth, isTeacherByDoc, isTeacherEmail, ensureTeacherAllowlistLoaded } from './firebase.js';
import { initializeFileViewer, openFileViewer } from './file-viewer.js';
import {
  observeAllStudentUploads,
  markStudentUploadAccepted,
  gradeStudentUpload,
} from './student-uploads.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
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

function formatSize(bytes){
  var numeric = Number(bytes);
  if (!numeric || isNaN(numeric)) return '';
  var units = ['B','KB','MB','GB','TB'];
  var value = numeric;
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1){
    value = value / 1024;
    unitIndex += 1;
  }
  var precision = (value >= 10 || unitIndex === 0) ? 0 : 1;
  return value.toFixed(precision) + ' ' + units[unitIndex];
}

var ROSTER_STORAGE_KEY = 'qs_roster_cache';

function normalizeRosterStudent(student){
  if (!student) return null;
  var email = (student.email || '').toLowerCase();
  var uid = student.uid ? String(student.uid) : '';
  var matricula = student.matricula || student.id || uid || email || '';
  var id = student.id || matricula || email || uid;
  if (!id && !email && !uid) return null;
  var name = student.displayName || student.nombre || student.name || '';
  var type = student.type || 'student';
  return {
    uid: uid,
    id: id,
    matricula: matricula || id,
    name: name || email || id || 'Estudiante',
    email: email,
    type: type,
  };
}

function dedupeRosterEntries(list){
  var order = [];
  var map = {};
  if (!Array.isArray(list)) return [];
  for (var i=0; i<list.length; i++){
    var entry = list[i];
    if (!entry) continue;
    var key = (entry.email || entry.id || entry.matricula || entry.uid || entry.name || ('idx'+i)).toLowerCase();
    if (!map[key]){
      map[key] = Object.assign({}, entry);
      order.push(key);
    } else {
      var current = map[key];
      if (entry.uid && !current.uid) current.uid = entry.uid;
      if (entry.id && !current.id) current.id = entry.id;
      if (entry.matricula && !current.matricula) current.matricula = entry.matricula;
      if (entry.email && !current.email) current.email = entry.email;
      if (entry.type && !current.type) current.type = entry.type;
      if (entry.name && (!current.name || current.name === current.id || current.name === current.email)){
        current.name = entry.name;
      }
    }
  }
  var out = [];
  for (var j=0; j<order.length; j++){
    var item = map[order[j]];
    if (!item) continue;
    if (!item.id) item.id = item.matricula || item.email || item.uid || ('student-' + j);
    if (!item.matricula) item.matricula = item.id;
    if (!item.name) item.name = item.email || item.id;
    if (!item.type) item.type = 'student';
    out.push(item);
  }
  return out;
}

function emitRosterUpdate(detail){
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  try {
    window.dispatchEvent(new CustomEvent('qs:roster-updated', { detail: detail }));
  } catch (_err) {
    if (typeof document !== 'undefined' && typeof document.createEvent === 'function'){
      try {
        var ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('qs:roster-updated', false, false, detail);
        window.dispatchEvent(ev);
      } catch (__err) {}
    }
  }
}

function syncRosterCache(students){
  if (typeof window === 'undefined') return [];
  var list = Array.isArray(students) ? students : [];
  var normalized = [];
  for (var i=0; i<list.length; i++){
    var item = normalizeRosterStudent(list[i]);
    if (item) normalized.push(item);
  }
  var deduped = dedupeRosterEntries(normalized);
  var payload = {
    updatedAt: new Date().toISOString(),
    students: deduped,
  };
  try {
    if (window.localStorage) window.localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {}
  try {
    window.students = deduped.slice();
  } catch (_err2) {}
  emitRosterUpdate(payload);
  return deduped;
}

var UPLOAD_KIND_LABELS = {
  activity: 'Actividad',
  homework: 'Tarea',
  evidence: 'Evidencia',
};

var UPLOAD_KIND_TITLES = {
  activity: 'Actividades',
  homework: 'Tareas',
  evidence: 'Evidencias',
  other: 'Otros envíos',
};

var UPLOAD_KIND_ORDER = ['activity', 'homework', 'evidence', 'other'];

function normalizeKind(value){
  var key = (value == null ? '' : String(value)).toLowerCase().trim();
  if (key === 'activity' || key === 'homework' || key === 'evidence') return key;
  return 'other';
}

function getKindTitle(key){
  return UPLOAD_KIND_TITLES[key] || 'Otros envíos';
}

function countUploadsByKind(list){
  var counts = { activity: 0, homework: 0, evidence: 0, other: 0, total: 0 };
  if (!Array.isArray(list)) return counts;
  for (var i=0;i<list.length;i++){
    var kindKey = normalizeKind(list[i] && list[i].kind);
    if (!counts.hasOwnProperty(kindKey)) counts[kindKey] = 0;
    counts[kindKey] += 1;
    counts.total += 1;
  }
  return counts;
}

function groupUploadsByKind(list){
  var groups = { activity: [], homework: [], evidence: [], other: [] };
  if (Array.isArray(list)){
    for (var i=0;i<list.length;i++){
      var upload = list[i];
      var key = normalizeKind(upload && upload.kind);
      if (!groups[key]) groups[key] = [];
      groups[key].push(upload);
    }
  }
  var sections = [];
  for (var j=0;j<UPLOAD_KIND_ORDER.length;j++){
    var key = UPLOAD_KIND_ORDER[j];
    var arr = groups[key] || [];
    if (!arr.length) continue;
    sections.push({ key: key, title: getKindTitle(key), uploads: arr });
  }
  return sections;
}

var UPLOAD_STATUS_LABELS = {
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  calificado: 'Calificado',
  rechazado: 'Rechazado',
};

function normalizeStatus(value){
  var status = value == null ? 'enviado' : String(value);
  status = status.toLowerCase().trim();
  if (!UPLOAD_STATUS_LABELS[status]) return 'enviado';
  return status;
}

function formatDateTime(value){
  var date = toDate(value);
  if (!date) return '';
  var result = fmtDate(date);
  try {
    var time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (time) result += ' · ' + time;
  } catch (_err) {}
  return result;
}

function formatReviewInfo(upload){
  if (!upload) return '';
  var reviewer = upload.gradedBy || upload.reviewedBy || null;
  var parts = [];
  if (reviewer && (reviewer.displayName || reviewer.email)){
    parts.push('por ' + (reviewer.displayName || reviewer.email));
  }
  var when = toDate(upload.gradedAt || upload.acceptedAt || upload.reviewedAt || upload.updatedAt);
  if (when){
    try {
      var tm = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push('el ' + fmtDate(when) + ' · ' + tm);
    } catch (_err) {
      parts.push('el ' + fmtDate(when));
    }
  }
  if (!parts.length) return '';
  return 'Revisado ' + parts.join(' ');
}

function countPendingUploads(list){
  if (!Array.isArray(list)) return 0;
  var pending = 0;
  for (var i=0;i<list.length;i++){
    var status = normalizeStatus(list[i] && list[i].status);
    if (status !== 'calificado') pending += 1;
  }
  return pending;
}

function getUploadStudentEntries(state){
  var entries = [];
  var grouped = state && state.uploadGroups ? state.uploadGroups : {};
  var students = state && state.students ? state.students : [];
  var seen = {};
  for (var i=0;i<students.length;i++){
    var stu = students[i] || {};
    var uid = stu.uid || '';
    var group = grouped[uid] || { uploads: [] };
    entries.push({
      uid: uid,
      displayName: stu.displayName || stu.nombre || 'Alumno',
      email: stu.email || '',
      uploads: group.uploads || [],
      pending: countPendingUploads(group.uploads || []),
    });
    if (uid) seen[uid] = true;
  }
  var keys = Object.keys(grouped);
  for (var j=0;j<keys.length;j++){
    var uidKey = keys[j];
    if (seen[uidKey]) continue;
    var g = grouped[uidKey] || {};
    var info = g.student || {};
    entries.push({
      uid: uidKey,
      displayName: info.displayName || info.nombre || info.email || 'Estudiante',
      email: info.email || '',
      uploads: g.uploads || [],
      pending: countPendingUploads(g.uploads || []),
    });
  }
  entries.sort(function(a,b){
    var an = a.displayName || '';
    var bn = b.displayName || '';
    return an.localeCompare(bn, 'es', { sensitivity: 'base' });
  });
  return entries;
}

function ensureUploadSelection(state, entries){
  var list = entries || getUploadStudentEntries(state);
  if (state.selectedUploadStudent){
    for (var i=0;i<list.length;i++){
      if (list[i].uid === state.selectedUploadStudent) return list;
    }
  }
  var choice = null;
  for (var j=0;j<list.length;j++){
    if (list[j].pending > 0){ choice = list[j]; break; }
  }
  if (!choice && list.length){
    for (var k=0;k<list.length;k++){
      if ((list[k].uploads || []).length){ choice = list[k]; break; }
    }
  }
  if (!choice && list.length) choice = list[0];
  state.selectedUploadStudent = choice ? choice.uid : null;
  return list;
}


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
  await ensureTeacherAllowlistLoaded();
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

// ===== Student fallback (sin Firebase) =====
var STUDENT_FALLBACK_KEY = 'pd_student_fallback_data';
var STUDENT_FALLBACK_CACHE = null;
var STUDENT_FALLBACK_ACTIVE = false;

function cloneStudentEntry(entry){
  if (!entry) return { uid: '', displayName: 'Alumno', email: '', matricula: null };
  return {
    uid: entry.uid || '',
    displayName: entry.displayName || 'Alumno',
    email: entry.email || '',
    matricula: entry.matricula != null ? entry.matricula : null,
  };
}

function clampMetricValue(value){
  return clamp100(Number(value || 0));
}

function normalizeMetricEntry(entry){
  entry = entry || {};
  var u1 = clampMetricValue(entry.u1 != null ? entry.u1 : entry.unidad1);
  var u2 = clampMetricValue(entry.u2 != null ? entry.u2 : entry.unidad2);
  var u3 = clampMetricValue(entry.u3 != null ? entry.u3 : entry.unidad3);
  var finalPct = clampMetricValue(entry.finalPct != null ? entry.finalPct : (entry.final != null ? entry.final : final3040(u1, u2, u3)));
  return { u1: u1, u2: u2, u3: u3, finalPct: finalPct };
}

function cloneMetrics(metrics){
  var out = {};
  for (var key in metrics){
    if (Object.prototype.hasOwnProperty.call(metrics, key)){
      out[key] = normalizeMetricEntry(metrics[key]);
    }
  }
  return out;
}

function sortFallbackStudents(list){
  list.sort(function(a, b){
    var rawA = a && a.displayName ? a.displayName : '';
    var rawB = b && b.displayName ? b.displayName : '';
    var nameA;
    var nameB;
    try { nameA = rawA.toLocaleLowerCase('es-MX'); }
    catch (_errA){ nameA = rawA.toLowerCase(); }
    try { nameB = rawB.toLocaleLowerCase('es-MX'); }
    catch (_errB){ nameB = rawB.toLowerCase(); }
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

function normalizeFallbackSource(data){
  var list = [];
  var metrics = {};
  var students = data && Array.isArray(data.students) ? data.students : [];
  for (var i=0; i<students.length; i++){
    var src = students[i] || {};
    var uid = String(src.uid || src.id || src.matricula || ('fallback-' + i)).trim();
    if (!uid) uid = 'fallback-' + i;
    var displayName = src.displayName || src.nombre || src.name || ('Estudiante ' + (i+1));
    var email = src.email || src.correo || '';
    var matricula = src.matricula != null ? String(src.matricula) : (src.id != null ? String(src.id) : null);
    list.push({ uid: uid, displayName: displayName, email: email, matricula: matricula });

    var grades = src.grades || src.calificaciones || {};
    if (grades && (grades.u1 != null || grades.u2 != null || grades.u3 != null || grades.unidad1 != null || grades.unidad2 != null || grades.unidad3 != null)){
      metrics[uid] = normalizeMetricEntry(grades);
    }
  }

  var metricEntries = data && data.metrics ? data.metrics : {};
  for (var key in metricEntries){
    if (Object.prototype.hasOwnProperty.call(metricEntries, key)){
      metrics[key] = normalizeMetricEntry(metricEntries[key]);
    }
  }

  for (var j=0; j<list.length; j++){
    var stu = list[j];
    if (!metrics[stu.uid]){
      metrics[stu.uid] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
    }
  }

  sortFallbackStudents(list);
  return { students: list, metrics: metrics };
}

function setFallbackCache(data){
  STUDENT_FALLBACK_CACHE = {
    students: (data.students || []).map(cloneStudentEntry),
    metrics: cloneMetrics(data.metrics || {}),
  };
}

function cloneFallbackData(){
  if (!STUDENT_FALLBACK_CACHE){
    return { students: [], metrics: {} };
  }
  return {
    students: STUDENT_FALLBACK_CACHE.students.map(cloneStudentEntry),
    metrics: cloneMetrics(STUDENT_FALLBACK_CACHE.metrics),
  };
}

function readFallbackStorage(){
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    var raw = window.localStorage.getItem(STUDENT_FALLBACK_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return normalizeFallbackSource(parsed);
  } catch (_err) {
    return null;
  }
}

function persistFallbackData(){
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!STUDENT_FALLBACK_CACHE) return;
  try {
    var payload = {
      students: STUDENT_FALLBACK_CACHE.students,
      metrics: STUDENT_FALLBACK_CACHE.metrics,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STUDENT_FALLBACK_KEY, JSON.stringify(payload));
  } catch (_err) {}
}

async function ensureStudentFallbackLoaded(){
  if (STUDENT_FALLBACK_CACHE) return;
  var stored = readFallbackStorage();
  if (stored){
    setFallbackCache(stored);
    return;
  }
  try {
    var res = await fetch('./data/students.json', { cache: 'no-store' });
    if (!res || !res.ok){
      throw new Error('Respuesta inválida al cargar base local de estudiantes');
    }
    var json = await res.json();
    setFallbackCache(normalizeFallbackSource(json));
  } catch (err) {
    console.error('No se pudo cargar la base local de estudiantes', err);
    setFallbackCache({ students: [], metrics: {} });
  }
}

async function loadStudentFallbackData(){
  await ensureStudentFallbackLoaded();
  return cloneFallbackData();
}

function mutateFallbackData(mutator){
  if (!STUDENT_FALLBACK_CACHE) return;
  try {
    mutator(STUDENT_FALLBACK_CACHE);
  } catch (err) {
    console.error('No se pudo actualizar la base local de estudiantes', err);
  }
  sortFallbackStudents(STUDENT_FALLBACK_CACHE.students);
  persistFallbackData();
}

function generateFallbackId(){
  return 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function markStudentFallbackActive(flag){
  STUDENT_FALLBACK_ACTIVE = !!flag;
}

function isStudentFallbackActive(){
  return !!STUDENT_FALLBACK_ACTIVE;
}

function sanitizeStudentInput(data){
  data = data || {};
  return {
    displayName: (data.displayName || data.nombre || '').trim(),
    email: (data.email || '').trim(),
    matricula: data.matricula != null && String(data.matricula).trim() !== '' ? String(data.matricula).trim() : null,
  };
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

function normalizeStudentPayload(data, opts){
  data = data || {};
  var name = data.displayName || data.nombre || '';
  var payload = {
    displayName: name,
    nombre: name,
    email: data.email || '',
    matricula: data.matricula ? data.matricula : null,
    role: 'student',
    updatedAt: serverTimestamp(),
  };
  if (opts && opts.includeCreatedAt){
    payload.createdAt = serverTimestamp();
  }
  if (data.uid){
    payload.uid = data.uid;
  }
  return payload;
}

async function createGroupStudent(db, grupoId, data){
  if (isStudentFallbackActive()){
    await ensureStudentFallbackLoaded();
    var clean = sanitizeStudentInput(data);
    var docId = data && data.uid ? String(data.uid).trim() : '';
    if (!docId) docId = generateFallbackId();
    var newStudent = {
      uid: docId,
      displayName: clean.displayName || 'Alumno',
      email: clean.email || '',
      matricula: clean.matricula,
    };
    mutateFallbackData(function(cache){
      var list = cache.students;
      var replaced = false;
      for (var i=0; i<list.length; i++){
        if (list[i] && list[i].uid === docId){
          list[i] = newStudent;
          replaced = true;
          break;
        }
      }
      if (!replaced){
        list.push(newStudent);
      }
      if (!cache.metrics[docId]){
        cache.metrics[docId] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
      }
    });
    return docId;
  }

  var membersCol = collection(db, 'grupos', grupoId, 'members');
  var docIdFs = data && data.uid ? String(data.uid).trim() : '';
  if (docIdFs){
    var payloadExisting = normalizeStudentPayload(Object.assign({}, data, { uid: docIdFs }), { includeCreatedAt: true });
    await setDoc(doc(membersCol, docIdFs), payloadExisting);
    return docIdFs;
  }
  var newRef = doc(membersCol);
  var payload = normalizeStudentPayload(Object.assign({}, data, { uid: newRef.id }), { includeCreatedAt: true });
  await setDoc(newRef, payload);
  return newRef.id;
}

async function updateGroupStudent(db, grupoId, uid, data){
  if (!uid){ throw new Error('Identificador no válido'); }
  if (isStudentFallbackActive()){
    await ensureStudentFallbackLoaded();
    var clean = sanitizeStudentInput(data);
    mutateFallbackData(function(cache){
      for (var i=0; i<cache.students.length; i++){
        if (cache.students[i] && cache.students[i].uid === uid){
          cache.students[i] = Object.assign({}, cache.students[i], {
            displayName: clean.displayName || cache.students[i].displayName || 'Alumno',
            email: clean.email || cache.students[i].email || '',
            matricula: clean.matricula != null ? clean.matricula : cache.students[i].matricula,
          });
          return;
        }
      }
      cache.students.push({
        uid: uid,
        displayName: clean.displayName || 'Alumno',
        email: clean.email || '',
        matricula: clean.matricula,
      });
      if (!cache.metrics[uid]){
        cache.metrics[uid] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
      }
    });
    return;
  }
  var payload = normalizeStudentPayload(Object.assign({}, data, { uid: uid }), {});
  await updateDoc(doc(db, 'grupos', grupoId, 'members', uid), payload);
}

async function deleteGroupStudent(db, grupoId, uid){
  if (!uid){ throw new Error('Identificador no válido'); }
  if (isStudentFallbackActive()){
    await ensureStudentFallbackLoaded();
    mutateFallbackData(function(cache){
      cache.students = cache.students.filter(function(stu){ return !stu || stu.uid !== uid; });
      if (cache.metrics && cache.metrics[uid]){
        delete cache.metrics[uid];
      }
    });
    return;
  }
  await deleteDoc(doc(db, 'grupos', grupoId, 'members', uid));
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

function rebuildStudentIndex(state){
  var list = state && Array.isArray(state.students) ? state.students : [];
  var index = {};
  for (var i=0; i<list.length; i++){
    var stu = list[i];
    if (stu && stu.uid){
      index[stu.uid] = stu;
    }
  }
  state.studentIndex = index;
  return index;
}

function ensureMetricsForStudents(state){
  var metrics = state && state.metrics ? state.metrics : {};
  var list = state && Array.isArray(state.students) ? state.students : [];
  var next = {};
  for (var i=0; i<list.length; i++){
    var stu = list[i];
    var uid = stu && stu.uid ? stu.uid : '';
    if (!uid) continue;
    next[uid] = metrics[uid] || { u1: 0, u2: 0, u3: 0, finalPct: 0 };
  }
  state.metrics = next;
  return next;
}

async function reloadStudents(db, grupoId, state){
  if (isStudentFallbackActive() || (state && state.isUsingStudentFallback)){
    await ensureStudentFallbackLoaded();
    var fallback = cloneFallbackData();
    state.students = fallback.students;
    state.metrics = fallback.metrics;
    state.isUsingStudentFallback = true;
    rebuildStudentIndex(state);
    syncRosterCache(state.students);
    ensureMetricsForStudents(state);
    renderSummaryStats(state.students, state.metrics);
    renderStudentsTable(state.students, state.metrics);
    handleUploadsSnapshot(state, state.uploads);
    return;
  }

  state.students = await fetchStudents(db, grupoId);
  state.isUsingStudentFallback = false;
  rebuildStudentIndex(state);
  syncRosterCache(state.students);
  ensureMetricsForStudents(state);
  renderSummaryStats(state.students, state.metrics);
  renderStudentsTable(state.students, state.metrics);
  handleUploadsSnapshot(state, state.uploads);
}

// ===== Render =====
function setText(id, value){ var el=$id(id); if(el) el.textContent = String(value); }
function renderSummaryStats(students, metrics){
  var list = Array.isArray(students) ? students : [];
  setText('pd-summary-total-students', list.length);
  var finals = [];
  for (var i=0; i<list.length; i++){
    var stu = list[i];
    if (!stu || !stu.uid) continue;
    var m = metrics && metrics[stu.uid] ? metrics[stu.uid] : null;
    if (m && !isNaN(m.finalPct)) finals.push(m.finalPct);
  }
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
  var list = Array.isArray(students) ? students : [];
  if (!list.length){ tbody.innerHTML = '<tr><td colspan="8" class="pd-empty">Sin estudiantes.</td></tr>'; return; }
  for (var i=0;i<list.length;i++){
    var s = list[i] || {};
    var uid = s.uid || '';
    var m = metrics[s.uid] || { u1:0,u2:0,u3:0, finalPct:0 };
    var row = '\
      <tr data-id="'+ escAttr(uid) +'">\
        <td style="text-align:center"><input type="checkbox" class="pd-student-check" data-email="'+ escAttr(s.email||'') +'" aria-label="Seleccionar estudiante" /></td>\
        <td>'+ escHtml(s.displayName||'Alumno') +'</td>\
        <td>'+ escHtml(s.email||'') +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u1)) +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u2)) +'</td>\
        <td style="text-align:right">'+ escHtml(toEscala5(m.u3)) +'</td>\
        <td style="text-align:right; font-weight:700">'+ escHtml(toEscala5(m.finalPct)) +'</td>\
        <td>\
          <div class="pd-student-actions">\
            <button type="button" class="pd-action-btn pd-student-edit">Editar</button>\
            <button type="button" class="pd-action-btn pd-student-delete">Eliminar</button>\
          </div>\
        </td>\
      </tr>';
    tbody.insertAdjacentHTML('beforeend', row);
  }
}

function renderUploadStudentsList(state, providedEntries){
  var listEl = $id('pd-upload-student-list');
  var emptyEl = $id('pd-upload-empty');
  if (!listEl) return;
  var entries = providedEntries || getUploadStudentEntries(state);
  if (!entries.length){
    listEl.innerHTML='';
    listEl.hidden = true;
    if (emptyEl){
      emptyEl.hidden = false;
      emptyEl.textContent = 'No hay evidencias registradas todavía.';
    }
    return;
  }
  listEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;

  var html='';
  for (var i=0;i<entries.length;i++){
    var entry = entries[i];
    var pressed = state.selectedUploadStudent === entry.uid ? 'true' : 'false';
    var breakdown = countUploadsByKind(entry.uploads);
    html += '\
      <li class="pd-uploads__student">\
        <button type="button" data-uid="'+ escAttr(entry.uid||'') +'" aria-pressed="'+ pressed +'">\
          <span class="pd-uploads__student-name">'+ escHtml(entry.displayName || entry.email || 'Estudiante') +'</span>';
    if (entry.email){
      html += '<span class="pd-uploads__student-email">'+ escHtml(entry.email) +'</span>';
    }
    html += '<span class="pd-uploads__student-counts">\
        <span class="pd-uploads__student-count" title="Total de entregas">'+ escHtml(String((entry.uploads||[]).length)) +'</span>';
    if (entry.pending > 0){
      html += '<span class="pd-uploads__student-pending">'+ escHtml(entry.pending===1 ? '1 pendiente' : entry.pending + ' pendientes') +'</span>';
    }
    html += '</span>\
          ';
    if (breakdown.total > 0){
      html += '<span class="pd-uploads__student-breakdown">';
      if (breakdown.activity > 0){
        html += '<span class="pd-uploads__student-chip" title="Actividades">A: '+ escHtml(String(breakdown.activity)) +'</span>';
      }
      if (breakdown.homework > 0){
        html += '<span class="pd-uploads__student-chip" title="Tareas">T: '+ escHtml(String(breakdown.homework)) +'</span>';
      }
      if (breakdown.evidence > 0){
        html += '<span class="pd-uploads__student-chip" title="Evidencias">E: '+ escHtml(String(breakdown.evidence)) +'</span>';
      }
      if (breakdown.other > 0){
        html += '<span class="pd-uploads__student-chip" title="Otros envíos">O: '+ escHtml(String(breakdown.other)) +'</span>';
      }
      html += '</span>';
    }
    html += '\
        </button>\
      </li>';
  }
  listEl.innerHTML = html;
}

function buildUploadCard(upload){
  if (!upload) return '';
  var status = normalizeStatus(upload.status);
  var statusClass = 'pd-uploads__item-status--' + status;
  if (!UPLOAD_STATUS_LABELS[status]){
    status = 'enviado';
    statusClass = 'pd-uploads__item-status--enviado';
  }
  var statusLabel = UPLOAD_STATUS_LABELS[status] || 'Enviado';
  var kind = UPLOAD_KIND_LABELS[(upload.kind || '').toLowerCase()] || 'Entrega';
  var metaParts = [];
  var submittedTxt = formatDateTime(upload.submittedAt || upload.createdAt || upload.updatedAt);
  if (submittedTxt) metaParts.push('Enviado: ' + submittedTxt);
  if (upload.fileName) metaParts.push(upload.fileName);
  var sizeTxt = formatSize(upload.fileSize);
  if (sizeTxt) metaParts.push(sizeTxt);
  var description = (upload.description || '').trim();
  var hasGrade = typeof upload.grade === 'number' && !isNaN(upload.grade);
  var gradeTxt = hasGrade ? 'Calificación: ' + upload.grade + ' / 100' : 'Sin calificación registrada';
  var reviewInfo = formatReviewInfo(upload);

  var html = '\
    <article class="pd-uploads__item" data-id="'+ escAttr(upload.id||'') +'">\
      <header class="pd-uploads__item-header">\
        <div class="pd-uploads__item-heading">\
          <h4>'+ escHtml(upload.title || 'Entrega sin título') +'</h4>\
          <span class="pd-uploads__item-chip">'+ escHtml(kind) +'</span>\
        </div>\
        <span class="pd-uploads__item-status '+ escAttr(statusClass) +'">'+ escHtml(statusLabel) +'</span>\
      </header>';

  if (metaParts.length){
    html += '<p class="pd-uploads__item-meta">'+ escHtml(metaParts.join(' · ')) +'</p>';
  }
  if (description){
    html += '<p class="pd-uploads__item-description">'+ escHtml(description) +'</p>';
  }
  if (gradeTxt){
    var gradeClass = hasGrade ? 'pd-uploads__item-grade' : 'pd-uploads__item-grade pd-uploads__item-grade--pending';
    html += '<p class="'+ gradeClass +'">'+ escHtml(gradeTxt) +'</p>';
  }
  if (upload.teacherFeedback){
    html += '<p class="pd-uploads__item-feedback"><strong>Comentarios:</strong> '+ escHtml(upload.teacherFeedback) +'</p>';
  }
  if (reviewInfo){
    html += '<p class="pd-uploads__item-reviewer">'+ escHtml(reviewInfo) +'</p>';
  }

  html += '<div class="pd-uploads__item-actions">';
  if (upload.fileUrl){
    var fileUrlAttr = escAttr(upload.fileUrl);
    var fileTitleAttr = escAttr(upload.title || 'Entrega sin título');
    var fileNameAttr = escAttr(upload.fileName || '');
    html += '<button type="button" class="pd-action-btn pd-uploads__action" data-action="preview" data-file-url="'+ fileUrlAttr +'" data-file-title="'+ fileTitleAttr +'" data-file-name="'+ fileNameAttr +'">Visualizar</button>';
    html += '<a class="pd-action-btn" href="'+ fileUrlAttr +'" target="_blank" rel="noopener">Abrir en pestaña nueva</a>';
  } else {
    html += '<span class="pd-uploads__item-link-disabled">Archivo no disponible</span>';
  }
  var disableAccept = status === 'aceptado' || status === 'calificado';
  html += '<button type="button" class="pd-action-btn pd-uploads__action" data-action="accept"'+ (disableAccept ? ' disabled' : '') +'>Marcar como aceptada</button>';
  var gradeLabel = hasGrade ? 'Actualizar calificación' : 'Registrar calificación';
  html += '<button type="button" class="pd-action-btn pd-uploads__action" data-action="grade">'+ escHtml(gradeLabel) +'</button>';
  html += '</div>';

  html += '</article>';
  return html;
}

function renderUploadDetail(state, providedEntries){
  var container = $id('pd-upload-detail');
  if (!container) return;
  var entries = providedEntries || getUploadStudentEntries(state);
  var uid = state.selectedUploadStudent;
  container.innerHTML='';
  if (!uid){
    container.insertAdjacentHTML('beforeend', '<p class="pd-empty">Selecciona un estudiante para revisar sus evidencias.</p>');
    return;
  }
  var grouped = state.uploadGroups || {};
  var group = grouped[uid] || null;
  var info = (state.studentIndex && state.studentIndex[uid]) || (group && group.student) || {};
  var header = '\
    <div class="pd-uploads__detail-header">\
      <h3>'+ escHtml(info.displayName || info.nombre || info.email || 'Estudiante') +'</h3>';
  if (info.email){
    header += '<span>'+ escHtml(info.email) +'</span>';
  }
  header += '</div>';
  container.insertAdjacentHTML('beforeend', header);

  if (!group || !group.uploads || !group.uploads.length){
    container.insertAdjacentHTML('beforeend', '<p class="pd-empty">Este estudiante aún no registra entregas.</p>');
    return;
  }

  var sections = groupUploadsByKind(group.uploads);
  for (var si=0; si<sections.length; si++){
    var section = sections[si];
    var count = section.uploads.length;
    var badge = count === 1 ? '1 entrega' : count + ' entregas';
    var secHtml = '\
      <section class="pd-uploads__kind-section" data-kind="'+ escAttr(section.key) +'">\
        <header class="pd-uploads__kind-header">\
          <h4 class="pd-uploads__kind-heading">'+ escHtml(section.title) +'</h4>\
          <span class="pd-uploads__kind-badge">'+ escHtml(badge) +'</span>\
        </header>\
        <div class="pd-uploads__kind-list">';
    for (var ui=0; ui<section.uploads.length; ui++){
      secHtml += buildUploadCard(section.uploads[ui]);
    }
    secHtml += '</div>\
      </section>';
    container.insertAdjacentHTML('beforeend', secHtml);
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

function clearUploadsState(state){
  if (!state) return;
  state.uploads = [];
  state.uploadGroups = {};
  state.uploadIndex = {};
  state.selectedUploadStudent = null;
  renderUploadStudentsList(state, []);
  renderUploadDetail(state, []);
}

function handleUploadsSnapshot(state, items){
  if (!state) return;
  var docs = Array.isArray(items) ? items.slice() : [];
  state.uploads = docs;
  var grouped = {};
  var index = {};
  for (var i=0;i<docs.length;i++){
    var upload = docs[i];
    if (!upload || !upload.id) continue;
    index[upload.id] = upload;
    var uid = (upload.student && upload.student.uid) ? upload.student.uid : '__sinuid__';
    if (!grouped[uid]) grouped[uid] = { uploads: [], student: upload.student || null };
    grouped[uid].uploads.push(upload);
    if (!grouped[uid].student && upload.student) grouped[uid].student = upload.student;
  }
  var keys = Object.keys(grouped);
  for (var j=0;j<keys.length;j++){
    var arr = grouped[keys[j]].uploads || [];
    arr.sort(function(a,b){
      var ad = toDate(a && (a.submittedAt || a.gradedAt || a.acceptedAt || a.updatedAt));
      var bd = toDate(b && (b.submittedAt || b.gradedAt || b.acceptedAt || b.updatedAt));
      var at = ad ? ad.getTime() : 0;
      var bt = bd ? bd.getTime() : 0;
      return bt - at;
    });
  }
  state.uploadGroups = grouped;
  state.uploadIndex = index;
  var entries = getUploadStudentEntries(state);
  entries = ensureUploadSelection(state, entries);
  renderUploadStudentsList(state, entries);
  renderUploadDetail(state, entries);
}

function bindUploadStudentList(state){
  var listEl = $id('pd-upload-student-list');
  if (!listEl || listEl.__pdBound) return;
  listEl.__pdBound = true;
  listEl.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-uid]') : null;
    if (!btn) return;
    var uid = btn.getAttribute('data-uid');
    if (!uid || state.selectedUploadStudent === uid) return;
    state.selectedUploadStudent = uid;
    var entries = getUploadStudentEntries(state);
    renderUploadStudentsList(state, entries);
    renderUploadDetail(state, entries);
  });
}

function bindUploadDetail(state){
  var container = $id('pd-upload-detail');
  if (!container || container.__pdBound) return;
  container.__pdBound = true;
  container.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var item = btn.closest ? btn.closest('.pd-uploads__item') : null;
    var uploadId = item ? item.getAttribute('data-id') : null;
    if (!uploadId) return;
    if (action === 'preview'){
      var url = btn.getAttribute('data-file-url');
      if (!url) return;
      var title = btn.getAttribute('data-file-title') || 'Entrega';
      var fileName = btn.getAttribute('data-file-name') || '';
      openFileViewer(url, { title: title, downloadUrl: url, fileName: fileName });
      return;
    }
    if (action === 'accept'){
      handleAcceptAction(state, uploadId, btn);
    } else if (action === 'grade'){
      handleGradeAction(state, uploadId, btn);
    }
  });
}

async function handleAcceptAction(state, uploadId, btn){
  var teacher = state && state.currentTeacher ? state.currentTeacher : null;
  if (!teacher){
    alert('No se pudo identificar al docente autenticado.');
    return;
  }
  if (btn && !btn.disabled) btn.disabled = true;
  try {
    await markStudentUploadAccepted(uploadId, teacher);
    alert('Entrega marcada como aceptada. El estudiante verá la actualización en su panel.');
    updateSyncStamp();
  } catch (err) {
    console.error('markStudentUploadAccepted:error', err);
    alert('No se pudo marcar la entrega como aceptada: ' + (err && err.message ? err.message : err));
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleGradeAction(state, uploadId, btn){
  var teacher = state && state.currentTeacher ? state.currentTeacher : null;
  if (!teacher){
    alert('No se pudo identificar al docente autenticado.');
    return;
  }
  var current = state && state.uploadIndex ? state.uploadIndex[uploadId] : null;
  var defaultGrade = (current && typeof current.grade === 'number' && !isNaN(current.grade)) ? String(current.grade) : '';
  var gradeInput = window.prompt('Calificación (0-100):', defaultGrade);
  if (gradeInput === null) return;
  var grade = Number(gradeInput);
  if (!isFinite(grade) || grade < 0 || grade > 100){
    alert('Ingresa una calificación numérica entre 0 y 100.');
    return;
  }
  var defaultFeedback = current && current.teacherFeedback ? current.teacherFeedback : '';
  var feedbackInput = window.prompt('Comentarios para el estudiante (opcional):', defaultFeedback);
  if (feedbackInput === null) feedbackInput = defaultFeedback;
  if (btn && !btn.disabled) btn.disabled = true;
  try {
    if (!current || normalizeStatus(current.status) === 'enviado'){
      await markStudentUploadAccepted(uploadId, teacher);
    }
    var rosterStudent = null;
    if (current && current.student && current.student.uid && state.studentIndex){
      rosterStudent = state.studentIndex[current.student.uid] || null;
    }
    var deliverable = null;
    var activityId = current && current.extra ? (current.extra.activityId || current.extra.deliverableId) : null;
    if (!activityId && current && current.extra && current.extra.assignmentId){
      activityId = current.extra.assignmentId;
    }
    if (activityId && Array.isArray(state.deliverables)){
      var targetId = String(activityId).trim();
      for (var di=0; di<state.deliverables.length; di++){
        var del = state.deliverables[di];
        if (!del) continue;
        var delId = del.id != null ? String(del.id).trim() : '';
        var delKey = del.calItemKey != null ? String(del.calItemKey).trim() : '';
        if ((delId && delId === targetId) || (delKey && delKey === targetId)){
          deliverable = del;
          break;
        }
      }
    }
    await gradeStudentUpload(uploadId, {
      grade: grade,
      feedback: feedbackInput,
      teacher: teacher,
      upload: current,
      student: current ? current.student : null,
      rosterStudent: rosterStudent,
      groupId: state.groupId || grupo,
      deliverable: deliverable,
    });
    alert('Calificación registrada. El estudiante recibirá la notificación en su panel.');
    updateSyncStamp();
  } catch (err) {
    console.error('gradeStudentUpload:error', err);
    alert('No se pudo registrar la calificación: ' + (err && err.message ? err.message : err));
  } finally {
    if (btn) btn.disabled = false;
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

function readStudentFormValues(){
  var nameInput = $id('pd-student-name');
  var emailInput = $id('pd-student-email');
  var matriculaInput = $id('pd-student-matricula');
  return {
    displayName: nameInput ? nameInput.value.trim() : '',
    email: emailInput ? emailInput.value.trim() : '',
    matricula: matriculaInput ? matriculaInput.value.trim() : '',
  };
}

function setStudentFormDisabled(form, disabled){
  if (!form) return;
  var controls = form.querySelectorAll('input, button, textarea, select');
  for (var i=0; i<controls.length; i++){
    controls[i].disabled = !!disabled;
  }
  if (disabled){
    form.setAttribute('aria-busy', 'true');
  } else {
    form.removeAttribute('aria-busy');
  }
}

function setStudentFormMode(form, state, mode, student){
  if (!form) return;
  var title = $id('pd-student-form-title');
  var submit = $id('pd-student-form-submit');
  var cancel = $id('pd-student-form-cancel');
  var nameInput = $id('pd-student-name');
  var emailInput = $id('pd-student-email');
  var matriculaInput = $id('pd-student-matricula');
  if (mode === 'edit' && student){
    var uid = student.uid || '';
    form.dataset.mode = 'edit';
    form.dataset.id = uid;
    if (title) title.textContent = 'Editar estudiante';
    if (submit) submit.textContent = 'Guardar cambios';
    if (cancel) cancel.hidden = false;
    if (nameInput) nameInput.value = student.displayName || student.nombre || '';
    if (emailInput) emailInput.value = student.email || '';
    if (matriculaInput) matriculaInput.value = student.matricula || '';
    state.editingStudentId = uid;
  } else {
    form.dataset.mode = 'create';
    form.dataset.id = '';
    if (title) title.textContent = 'Agregar estudiante';
    if (submit) submit.textContent = 'Agregar estudiante';
    if (cancel) cancel.hidden = true;
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (matriculaInput) matriculaInput.value = '';
    state.editingStudentId = null;
  }
}

function bindStudentsManager(db, grupo, state){
  var form = $id('pd-student-form');
  var cancelBtn = $id('pd-student-form-cancel');
  if (form && !form.__pdBound){
    form.__pdBound = true;
    setStudentFormMode(form, state, 'create');
    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      if (form.__pdBusy) return;
      var values = readStudentFormValues();
      if (!values.displayName){
        alert('Captura el nombre del estudiante.');
        return;
      }
      if (!values.email){
        alert('Captura el correo electrónico del estudiante.');
        return;
      }
      form.__pdBusy = true;
      setStudentFormDisabled(form, true);
      try {
        var payload = {
          displayName: values.displayName,
          email: values.email,
          matricula: values.matricula || null,
        };
        var mode = form.dataset.mode || 'create';
        if (mode === 'edit' && form.dataset.id){
          await updateGroupStudent(db, grupo, form.dataset.id, payload);
        } else {
          var newId = await createGroupStudent(db, grupo, payload);
          if (newId && !state.metrics[newId]){
            state.metrics[newId] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
          }
        }
        await reloadStudents(db, grupo, state);
        updateSyncStamp();
        setStudentFormMode(form, state, 'create');
      } catch (err) {
        console.error('No se pudo guardar el estudiante', err);
        alert('No se pudo guardar el estudiante: ' + (err && err.message ? err.message : err));
      } finally {
        form.__pdBusy = false;
        setStudentFormDisabled(form, false);
      }
    });
    if (cancelBtn && !cancelBtn.__pdBound){
      cancelBtn.__pdBound = true;
      cancelBtn.addEventListener('click', function(){
        setStudentFormMode(form, state, 'create');
      });
    }
  }

  var tbody = $id('pd-students-tbody');
  if (tbody && !tbody.__pdStudentsBound){
    tbody.__pdStudentsBound = true;
    tbody.addEventListener('click', async function(ev){
      var btn = ev.target;
      if (!btn || !btn.classList) return;
      if (btn.classList.contains('pd-student-edit')){
        var tr = btn.closest('tr[data-id]');
        if (!tr) return;
        var id = tr.getAttribute('data-id') || '';
        if (!id) return;
        var student = state.studentIndex[id] || null;
        if (!student){
          for (var i=0;i<state.students.length;i++){
            if (state.students[i] && state.students[i].uid === id){
              student = state.students[i];
              break;
            }
          }
        }
        if (!student) return;
        setStudentFormMode(form, state, 'edit', student);
        var nameInput = $id('pd-student-name');
        if (nameInput) nameInput.focus();
      } else if (btn.classList.contains('pd-student-delete')){
        var trDel = btn.closest('tr[data-id]');
        if (!trDel) return;
        var delId = trDel.getAttribute('data-id') || '';
        if (!delId) return;
        var studentDel = state.studentIndex[delId] || null;
        var label = studentDel ? (studentDel.displayName || studentDel.email || 'este estudiante') : 'este estudiante';
        if (!confirm('¿Eliminar a ' + label + '? Esta acción no se puede deshacer.')) return;
        var prevDisabled = btn.disabled;
        btn.disabled = true;
        try {
          await deleteGroupStudent(db, grupo, delId);
          delete state.metrics[delId];
          await reloadStudents(db, grupo, state);
          updateSyncStamp();
          if (state.editingStudentId === delId){
            setStudentFormMode(form, state, 'create');
          }
        } catch (err) {
          console.error('No se pudo eliminar al estudiante', err);
          alert('No se pudo eliminar al estudiante: ' + (err && err.message ? err.message : err));
        } finally {
          btn.disabled = prevDisabled;
        }
      }
    });
  }
}

async function loadDataForGroup(db, grupo, state){
  if (state) state.groupId = grupo;
  markStudentFallbackActive(false);
  state.isUsingStudentFallback = false;

  try {
    state.students = await fetchStudents(db, grupo);
  } catch (err) {
    console.error('No se pudieron obtener estudiantes desde Firebase', err);
    state.students = [];
  }

  if (!Array.isArray(state.students) || !state.students.length){
    var fallback = await loadStudentFallbackData();
    state.students = fallback.students;
    state.metrics = fallback.metrics;
    state.isUsingStudentFallback = true;
    markStudentFallbackActive(true);
    console.warn('Usando base de datos local de estudiantes (sin conexión a Firebase).');
  } else {
    state.metrics = {};
  }

  rebuildStudentIndex(state);
  syncRosterCache(state.students);

  if (!state.isUsingStudentFallback){
    var metrics = state.metrics;
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
  } else {
    ensureMetricsForStudents(state);
  }

  ensureMetricsForStudents(state);

  renderSummaryStats(state.students, state.metrics);
  state.deliverables = await fetchDeliverables(db, grupo);
  renderDeliverablesList(state.deliverables);
  var exams = await fetchExams(db, grupo);
  renderExams(exams);

  renderStudentsTable(state.students, state.metrics);

  handleUploadsSnapshot(state, state.uploads);

  updateSyncStamp();

  var rub = await getRubric(db, grupo);
  if ($id('pd-rubric-text')) $id('pd-rubric-text').value = rub && rub.content ? rub.content : '';


  bindRubricSave(db, grupo);
  bindDeliverableForm(db, grupo, state);
  bindDeliverableTable(db, grupo, state);
  bindReminder(state);
  bindStudentsManager(db, grupo, state);

  var gantt = await fetchGantt(db, grupo);
  renderGanttTable(gantt);
  await populateAssignments(db, grupo);
}


// ===== Main =====
async function main(){
  await ready();
  initializeFileViewer();
  initFirebase();
  var db = getDb();

  var root = $id('paneldocente-root') || document.body;
  var params = new URLSearchParams(location.search);
  var dataset = root && root.dataset ? root.dataset : {};
  var grupo = (dataset && dataset.grupo ? dataset.grupo : (params.get('grupo') || 'calidad-2025')).trim();

  var state = {
    students: [],
    deliverables: [],
    metrics: {},
    studentIndex: {},
    isUsingStudentFallback: false,
    uploads: [],
    uploadGroups: {},
    uploadIndex: {},
    selectedUploadStudent: null,
    unsubscribeUploads: null,
    currentTeacher: null,
    editingStudentId: null,
    groupId: grupo,
  };
  var isLoading = false;
  var hasLoaded = false;
  var lastLoadedUid = null;

  bindUploadStudentList(state);
  bindUploadDetail(state);

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
      if (state.unsubscribeUploads){ state.unsubscribeUploads(); state.unsubscribeUploads = null; }
      state.currentTeacher = null;
      clearUploadsState(state);
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
    state.currentTeacher = {
      uid: uid || '',
      email: user && user.email ? user.email : '',
      displayName: user && user.displayName ? user.displayName : '',
    };

    if (!state.unsubscribeUploads){
      state.unsubscribeUploads = observeAllStudentUploads(
        function(items){ handleUploadsSnapshot(state, items); },
        function(err){ console.error('observeAllStudentUploads:error', err); }
      );
    }

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
