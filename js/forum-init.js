import { initFirebase, onAuth, getAuthInstance, signInWithGooglePotros, signOutCurrent, isTeacherEmail, isTeacherByDoc, ensureTeacherDocForUser, subscribeForumTopics, createForumTopic, subscribeForumReplies, addForumReply, updateForumTopic, deleteForumTopic } from './firebase.js';

initFirebase();

let currentUser = null;
let isTeacher = false;
let topicsCache = [];
let currentTopicId = null;
let unsubscribeReplies = null;

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

onAuth(async user => {
  currentUser = user || null;
  const email = user?.email || '';
  // Prefer teachers collection (server-authoritative), fallback to frontend list
  isTeacher = false;
  if (user?.uid) {
    try { isTeacher = await isTeacherByDoc(user.uid); } catch(_) {}
  }
  if (!isTeacher) {
    isTeacher = isTeacherEmail(email);
  }
  // Auto-provision teacher marker for designated teacher
  if (!isTeacher && user?.uid && isTeacherEmail(email)) {
    try {
      const ok = await ensureTeacherDocForUser({ uid: user.uid, email, displayName: user.displayName });
      if (ok) isTeacher = true;
    } catch(_) {}
  }
  if (userRoleEl) userRoleEl.textContent = user ? (isTeacher ? 'Docente' : 'Estudiante') : 'No autenticado';
  if (userNameEl) userNameEl.textContent = user?.displayName || (user?.email || '-') || '-';
  if (adminPanel) adminPanel.style.display = (user && isTeacher) ? 'block' : 'none';
  if (authBtn) authBtn.textContent = user ? 'Cerrar sesion' : 'Iniciar sesion';
});

if (authBtn) authBtn.addEventListener('click', async () => {
  const auth = getAuthInstance();
  if (auth?.currentUser) {
    await signOutCurrent();
  } else {
    try { await signInWithGooglePotros(); } catch(e){ alert(e.message || e); }
  }
});

// Subscribe topics and render
subscribeForumTopics((items) => {
  topicsCache = items;
  renderTopics(items);
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
    row.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center space-x-3 mb-2">
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">${t.category || 'General'}</span>
            <span class="text-xs text-gray-500">${formatWhen(t.createdAt) || ''}</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">${t.title || ''}</h3>
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">${t.content || ''}</p>
          <div class="flex items-center space-x-4 text-sm text-gray-500">
            <span>👤 ${t.authorName || t.authorEmail || 'Desconocido'}</span>
          </div>
        </div>
        <div class="ml-4"><div class="w-3 h-3 bg-green-400 rounded-full"></div></div>
      </div>
    `;
    topicsList.appendChild(row);
  });
}

// Create topic for teacher
window.createTopic = async function(){
  if (!currentUser) { alert('Inicia sesion con tu cuenta @potros'); return; }
  if (!isTeacher) { alert('Solo el docente puede crear temas'); return; }
  const title = el('topicTitle')?.value?.trim();
  const category = el('topicCategory')?.value;
  const content = el('topicContent')?.value?.trim();
  if (!title || !content){ alert('Completa titulo y contenido'); return; }
  try{
    await createForumTopic({ title, category, content, authorName: currentUser.displayName || null, authorEmail: currentUser.email });
    if (el('topicTitle')) el('topicTitle').value = '';
    if (el('topicContent')) el('topicContent').value = '';
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

  // teacher controls
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

  // replies
  if (typeof unsubscribeReplies === 'function') unsubscribeReplies();
  if (responsesList) responsesList.innerHTML = '';
  unsubscribeReplies = subscribeForumReplies(topicId, (items) => {
    if (!responsesList) return;
    responsesList.innerHTML = '';
    items.forEach(r => {
      const div = document.createElement('div');
      div.className = 'border-l-4 border-green-400 pl-4 py-2';
      div.innerHTML = `
        <div class="flex items-center space-x-2 mb-2">
          <span class="font-medium text-gray-800">${r.authorName || r.authorEmail || 'Anónimo'}</span>
          <span class="text-xs text-gray-500">${formatWhen(r.createdAt)}</span>
        </div>
        <p class="text-gray-700">${r.text || ''}</p>
      `;
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
  if (!currentUser) { alert('Inicia sesion para responder'); return; }
  const txt = responseText?.value?.trim();
  if (!txt) { alert('Escribe tu respuesta'); return; }
  try{
    await addForumReply(currentTopicId, { text: txt, authorName: currentUser.displayName || null, authorEmail: currentUser.email });
    if (responseText) responseText.value = '';
  } catch(e){ alert(e.message || e); }
}
