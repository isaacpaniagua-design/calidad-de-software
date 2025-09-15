import { initFirebase, onAuth, getAuthInstance, signInWithGooglePotros, signOutCurrent, isTeacherEmail, isTeacherByDoc, ensureTeacherDocForUser, subscribeForumTopics, createForumTopic, subscribeForumReplies, addForumReply, updateForumTopic, deleteForumTopic, deleteForumReply } from './firebase.js';

initFirebase();

let currentUser = null;
let isTeacher = false;
let topicsCache = [];
let currentTopicId = null;
let unsubscribeReplies = null;
let unsubscribeTopics = null;

const el = (id) => document.getElementById(id);

const userRoleEl = el('userRole');
const userNameEl = el('userName');
const adminPanel = el('adminPanel');
const authBtn = el('authBtn');
const topicsList = el('topicsList');

function formatWhen(ts){
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? new Intl.DateTimeFormat('es-MX', { dateStyle:'medium', timeStyle:'short' }).format(d) : '';
  } catch(_) { return ''; }
}

function timeAgo(dateLike){
  const d = dateLike?.toDate ? dateLike.toDate() : (dateLike instanceof Date ? dateLike : null);
  const now = new Date();
  const ms = d ? (now - d) : 0;
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return 'hace un momento';
  if (mins === 1) return 'hace 1 minuto';
  if (mins < 60) return `hace ${mins} minutos`;
  const hrs = Math.floor(mins/60);
  if (hrs === 1) return 'hace 1 hora';
  if (hrs < 24) return `hace ${hrs} horas`;
  const days = Math.floor(hrs/24);
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

function renderLoading(){
  if (!topicsList) return;
  topicsList.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'p-6 text-gray-500';
  div.textContent = 'Cargando temas…';
  topicsList.appendChild(div);
}

function renderSignedOutState(){
  if (!topicsList) return;
  topicsList.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'p-6 text-gray-500';
  div.textContent = 'Inicia sesión con tu cuenta @potros.itson.edu.mx para ver los temas.';
  topicsList.appendChild(div);
}

onAuth(async user => {
  currentUser = user || null;
  const email = user?.email || '';
  isTeacher = false;
  if (user?.uid) {
    try { isTeacher = await isTeacherByDoc(user.uid); } catch(_) {}
  }
  if (!isTeacher) {
    isTeacher = isTeacherEmail(email);
  }
  if (!isTeacher && user?.uid && isTeacherEmail(email)) {
    try {
      const ok = await ensureTeacherDocForUser({ uid: user.uid, email, displayName: user.displayName });
      if (ok) isTeacher = true;
    } catch(_) {}
  }
  if (userRoleEl) userRoleEl.textContent = user ? (isTeacher ? 'Docente' : 'Estudiante') : 'No autenticado';
  if (userNameEl) userNameEl.textContent = user?.displayName || (user?.email || '-') || '-';
  if (adminPanel) adminPanel.style.display = (user && isTeacher) ? 'block' : 'none';
  if (authBtn) authBtn.textContent = user ? 'Cerrar sesión' : 'Iniciar sesión';

  const isPotros = !!email && /@potros\.itson\.edu\.mx$/i.test(email);
  if (unsubscribeTopics) { try{ unsubscribeTopics(); } catch(_){} unsubscribeTopics = null; }
  if (user && isPotros) {
    renderLoading();
    unsubscribeTopics = subscribeForumTopics(
      (items) => { topicsCache = items; renderTopics(items); showDebug('Temas cargados', 'ok'); },
      (err) => {
        const code = (err && (err.code||err.message||'')).toString();
        if (/permission-denied/i.test(code)) {
          showDebug('Permisos insuficientes. Verifica teachers/{uid} y reglas.', 'warn');
        } else if (/failed-precondition|index/i.test(code)) {
          showDebug('Se requiere índice compuesto (updatedAt, createdAt). Crea el índice en Firestore.', 'warn');
        } else {
          showDebug('Error suscripción temas: ' + code, 'error');
        }
      }
    );
  } else {
    renderSignedOutState();
  }
});

if (authBtn) authBtn.addEventListener('click', async () => {
  const auth = getAuthInstance();
  if (auth?.currentUser) {
    await signOutCurrent();
  } else {
    try { await signInWithGooglePotros(); } catch(e){ alert(e.message || e); }
  }
});

function renderTopics(items){
  if (!topicsList) return;
  topicsList.innerHTML = '';
  if (!items || !items.length){
    const div = document.createElement('div');
    div.className = 'p-6 text-gray-500';
    div.textContent = 'Aún no hay temas creados';
    topicsList.appendChild(div);
    return;
  }
  items.forEach(t => {
    const row = document.createElement('div');
    row.className = 'p-6 hover:bg-gray-50 transition-colors cursor-pointer';
    row.addEventListener('click', () => window.openTopic(t.id));
    const replies = Number.isFinite(t.repliesCount) ? t.repliesCount : (t.repliesCount || 0);
    const rel = timeAgo(t.updatedAt || t.createdAt);
    row.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center space-x-3 mb-2">
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">${t.category || 'General'}</span>
            <span class="text-xs text-gray-500">${rel}</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">${t.title || ''}</h3>
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">${t.content || ''}</p>
          <div class="flex items-center space-x-4 text-sm text-gray-500">
            <span>👤 ${t.authorName || t.authorEmail || 'Desconocido'}</span>
            <span>💬 ${replies} respuestas</span>
          </div>
        </div>
        <div class="ml-4"><div class="w-3 h-3 bg-green-400 rounded-full"></div></div>
      </div>
    `;
    topicsList.appendChild(row);
  });
}

// Debug banner
function ensureDebugBanner(){
  let bar = document.getElementById('forum-debug');
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = 'forum-debug';
  bar.style.position = 'fixed';
  bar.style.right = '10px';
  bar.style.bottom = '10px';
  bar.style.zIndex = '10000';
  bar.style.maxWidth = '320px';
  bar.style.background = 'rgba(17,24,39,.95)';
  bar.style.color = '#fff';
  bar.style.padding = '8px 10px';
  bar.style.borderRadius = '8px';
  bar.style.fontSize = '12px';
  bar.style.boxShadow = '0 6px 18px rgba(0,0,0,.25)';
  bar.style.display = 'none';
  document.body.appendChild(bar);
  return bar;
}

function showDebug(msg, level){
  const bar = ensureDebugBanner();
  bar.textContent = (level ? '['+level+'] ' : '') + (msg||'');
  bar.style.display = 'block';
  if (level === 'ok') {
    setTimeout(() => { try { bar.style.display = 'none'; } catch(_){} }, 3000);
  }
}

// Create topic for teacher
window.createTopic = async function(){
  if (!currentUser) { alert('Inicia sesión con tu cuenta @potros'); return; }
  if (!isTeacher) { alert('Solo el docente puede crear temas'); return; }
  const title = el('topicTitle')?.value?.trim();
  const category = el('topicCategory')?.value;
  const content = el('topicContent')?.value?.trim();
  if (!title || !content){ alert('Completa título y contenido'); return; }
  try{
    await createForumTopic({ title, category, content, authorName: currentUser.displayName || null, authorEmail: currentUser.email });
    if (el('topicTitle')) el('topicTitle').value = '';
    if (el('topicContent')) el('topicContent').value = '';
    showDebug('Tema creado', 'ok');
  } catch(e){ alert(e.message || e); }
}

// Modal related
const modal = el('topicModal');
const modalTitle = el('modalTitle');
const modalCategory = el('modalCategory');
const modalContent = el('modalContent');
const responsesList = el('responsesList');
const responseText = el('responseText');

function ensureHeaderControls(){
  const header = modal?.querySelector('.bg-gradient-to-r.from-indigo-600.to-purple-600') || modal?.querySelector('.bg-gradient-to-r');
  if (!header) return { editBtn: null, delBtn: null };
  let editBtn = header.querySelector('[data-role="edit-topic"]');
  let delBtn = header.querySelector('[data-role="delete-topic"]');
  if (!editBtn){
    editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'hidden bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded';
    editBtn.setAttribute('data-role','edit-topic');
    header.insertBefore(editBtn, header.lastElementChild);
  }
  if (!delBtn){
    delBtn = document.createElement('button');
    delBtn.textContent = 'Eliminar';
    delBtn.className = 'hidden bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded ml-2';
    delBtn.setAttribute('data-role','delete-topic');
    header.insertBefore(delBtn, header.lastElementChild);
  }
  return { editBtn, delBtn };
}

let editArea;
function ensureEditArea(){
  if (editArea) return editArea;
  editArea = document.createElement('div');
  editArea.className = 'hidden mt-3';
  editArea.innerHTML = `
    <textarea rows="4" class="w-full px-3 py-2 border rounded" data-role="edit-text"></textarea>
    <div class="mt-2 flex gap-2">
      <button class="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded" data-role="save">Guardar</button>
      <button class="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1 rounded" data-role="cancel">Cancelar</button>
    </div>
  `;
  modalContent?.parentElement?.appendChild(editArea);
  return editArea;
}

window.openTopic = function(topicId){
  const t = topicsCache.find(x => x.id === topicId);
  if (!t || !modal) return;
  currentTopicId = topicId;
  if (modalTitle) modalTitle.textContent = t.title || '';
  if (modalCategory) modalCategory.textContent = t.category || 'General';
  if (modalContent) modalContent.textContent = t.content || '';
  // Update meta row (category, author, time)
  if (modalCategory && modalCategory.parentElement) {
    const author = t.authorName || t.authorEmail || 'Desconocido';
    const when = timeAgo(t.updatedAt || t.createdAt);
    modalCategory.parentElement.innerHTML = `
      <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium" id="modalCategory">${t.category || 'General'}</span>
      <span class="text-sm text-gray-600">${author}</span>
      <span class="text-xs text-gray-500">Actualizado ${when}</span>
    `;
  }

  const { editBtn, delBtn } = ensureHeaderControls();
  if (currentUser && isTeacher) {
    if (editBtn) editBtn.classList.remove('hidden');
    if (delBtn) delBtn.classList.remove('hidden');
  } else {
    if (editBtn) editBtn.classList.add('hidden');
    if (delBtn) delBtn.classList.add('hidden');
  }
  if (editBtn && delBtn){
    editBtn.onclick = () => {
      const area = ensureEditArea();
      const ta = area.querySelector('[data-role="edit-text"]');
      ta.value = t.content || '';
      area.classList.remove('hidden');
    };
    delBtn.onclick = async () => {
      if (!confirm('¿Eliminar este tema y sus respuestas?')) return;
      try { await deleteForumTopic(currentTopicId); modal.classList.add('hidden'); } catch(e){ alert(e.message || e); }
    };
  }
  const area = ensureEditArea();
  const btnSave = area.querySelector('[data-role="save"]');
  const btnCancel = area.querySelector('[data-role="cancel"]');
  btnSave.onclick = async () => {
    if (!currentUser || !isTeacher) { alert('Solo el docente puede editar'); return; }
    const newText = area.querySelector('[data-role="edit-text"]').value.trim();
    if (!newText) { alert('Contenido no puede estar vacío'); return; }
    try{ await updateForumTopic(currentTopicId, { content: newText }); modalContent.textContent = newText; area.classList.add('hidden'); } catch(e){ alert(e.message || e); }
  };
  btnCancel.onclick = () => area.classList.add('hidden');

  if (typeof unsubscribeReplies === 'function') unsubscribeReplies();
  if (responsesList) responsesList.innerHTML = '';
  unsubscribeReplies = subscribeForumReplies(topicId, (items) => {
    if (!responsesList) return;
    responsesList.innerHTML = '';
    items.forEach(r => {
      const div = document.createElement('div');
      div.className = 'border-l-4 border-green-400 pl-4 py-2';
      const canDel = !!currentUser && (isTeacher || ((r.authorEmail||'').toLowerCase() === (currentUser.email||'').toLowerCase()));
      const delBtn = canDel ? '<button data-role="del-reply" class="text-xs text-red-600 hover:text-red-700 ml-2">Eliminar</button>' : '';
      div.innerHTML = `
        <div class="flex items-center space-x-2 mb-2">
          <span class="font-medium text-gray-800">${r.authorName || r.authorEmail || 'Anónimo'}</span>
          <span class="text-xs text-gray-500">${timeAgo(r.createdAt)}</span>
          ${delBtn}
        </div>
        <p class="text-gray-700">${r.text || ''}</p>
      `;
      if (canDel) {
        const btn = div.querySelector('[data-role="del-reply"]');
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('¿Eliminar esta respuesta?')) return;
          try { await deleteForumReply(topicId, r.id); } catch(e){ alert(e.message || e); }
        });
      }
      responsesList.appendChild(div);
    });
  });

  modal.classList.remove('hidden');
}

window.closeTopic = function(){
  if (modal) modal.classList.add('hidden');
  if (responseText) responseText.value = '';
}

window.addResponse = async function(){
  if (!currentUser) { alert('Inicia sesión para responder'); return; }
  const txt = responseText?.value?.trim();
  if (!txt) { alert('Escribe tu respuesta'); return; }
  try{
    await addForumReply(currentTopicId, { text: txt, authorName: currentUser.displayName || null, authorEmail: currentUser.email });
    if (responseText) responseText.value = '';
  } catch(e){ alert(e.message || e); }
}
