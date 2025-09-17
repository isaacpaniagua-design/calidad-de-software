// calificaciones.module.js
// Monta la UI dentro de #calificaciones-root sin alterar tu layout global.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const root = document.getElementById("calificaciones-root");
if (!root) {
  console.warn("[calificaciones] No existe #calificaciones-root");
}

// ==== estilos locales, encapsulados por id ====
const style = document.createElement("style");
style.textContent = `
#calificaciones-root { color:#e6edf3; }
#calificaciones-root .qs-card { background:rgba(6,10,25,.55); border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px; margin:12px 0; }
#calificaciones-root h1, 
#calificaciones-root h2, 
#calificaciones-root h3 { margin:0 0 8px; color:#fff; font-weight:700; }
#calificaciones-root .muted{ color:#8aa0b6; font-size:12px; }
#calificaciones-root .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
#calificaciones-root input, 
#calificaciones-root select, 
#calificaciones-root button{ font-size:14px; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.2); background:#0f1730; color:#e6edf3; }
#calificaciones-root button{ cursor:pointer; }
#calificaciones-root .w-160{ width:160px; }
#calificaciones-root .grid{ display:grid; gap:10px; grid-template-columns: 1fr 1fr; }
#calificaciones-root table{ width:100%; border-collapse:collapse; font-size:14px; }
#calificaciones-root th, 
#calificaciones-root td{ border-bottom:1px dashed rgba(255,255,255,.09); padding:8px 6px; vertical-align:middle; }
#calificaciones-root th{ text-align:left; color:#cfe0ff; }
#calificaciones-root .center{ text-align:center; }
#calificaciones-root .right{ text-align:right; }
#calificaciones-root .pill{ padding:2px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.2); font-size:12px; display:inline-block; }
#calificaciones-root .small{ font-size:12px; }
#calificaciones-root .footerline{ display:flex; gap:12px; align-items:center; }
#calificaciones-root .barWrap{ flex:1; height:8px; background:#0c152d; border-radius:999px; overflow:hidden; }
#calificaciones-root .bar{ height:100%; background:linear-gradient(90deg,#5fb0ff,#9f78ff); width:0%; transition:width .4s ease; }
`;
document.head.appendChild(style);

// ==== plantilla mínima ====
root.innerHTML = `
  <section class="qs-card">
    <div class="row" style="justify-content:space-between">
      <div class="row">
        <h1 style="margin-right:12px">Calificaciones · Plataforma QS</h1>
        <span id="roleTag" class="pill">No autenticado</span>
        <span id="userInfo" class="muted"></span>
      </div>
      <div class="row">
        <label for="courseId" class="muted">courseId</label>
        <input id="courseId" class="w-160" value="calidad-2025"/>
        <button id="btnInit">Inicializar</button>
        <button id="btnLogin">Entrar</button>
        <button id="btnLogout">Salir</button>
      </div>
    </div>
    <div class="muted">Usa la misma Config Firebase guardada en admin_seed_gradeitems.html</div>
  </section>

  <section id="panelStudent" class="qs-card" style="display:none">
    <h2>Mi vista de alumno</h2>
    <div class="muted">Tus calificaciones por ítem, promedios por unidad y promedio final.</div>
    <div id="studSummary" class="grid"></div>
    <div id="studTables"></div>
  </section>

  <section id="panelTeacher" class="qs-card" style="display:none">
    <h2>Panel docente</h2>
    <div class="grid">
      <div>
        <label>Alumno</label><br/>
        <select id="studentSelect" class="w-160"></select>
      </div>
      <div>
        <label>Acciones</label><br/>
        <div class="row">
          <button id="btnLoadStudent">Cargar alumno</button>
          <button id="btnSaveAll">Guardar todo</button>
          <button id="btnRefresh">Refrescar</button>
        </div>
      </div>
    </div>

    <div class="qs-card">
      <h3>Participación por unidad</h3>
      <table>
        <thead><tr><th>Unidad</th><th>Participación (0–100)</th></tr></thead>
        <tbody>
          <tr><td>Unidad 1</td><td><input id="pU1" type="number" min="0" max="100" style="width:90px"/></td></tr>
          <tr><td>Unidad 2</td><td><input id="pU2" type="number" min="0" max="100" style="width:90px"/></td></tr>
          <tr><td>Unidad 3</td><td><input id="pU3" type="number" min="0" max="100" style="width:90px"/></td></tr>
        </tbody>
      </table>
    </div>

    <div class="qs-card">
      <h3>Ítems evaluables</h3>
      <div class="muted small">Edita “Puntos obtenidos”. Blur o “Guardar todo” escribe en Firestore.</div>
      <div id="teachTables"></div>
    </div>

    <div class="qs-card">
      <h3>Promedios</h3>
      <div id="teachSummary" class="grid"></div>
    </div>
  </section>

  <div class="footerline">
    <div class="muted small" id="status">Listo.</div>
    <div class="barWrap"><div class="bar" id="bar"></div></div>
  </div>
`;

// ==== estado, helpers ====
const cfg = JSON.parse(localStorage.getItem("firebaseConfigJSON") || "{}");
let app = null,
  auth = null,
  db = null,
  me = null,
  myRole = null;
const $ = (id) => document.getElementById(id);
const qs = (sel) => root.querySelector(sel);
const show = (sel, flag) => {
  qs(sel).style.display = flag ? "block" : "none";
};
function setStatus(msg, pct) {
  $("status").textContent = msg;
  if (typeof pct === "number") {
    $("bar").style.width = Math.max(0, Math.min(100, pct)) + "%";
  }
}
function coursePath() {
  return `courses/${$("courseId").value.trim()}`;
}

// ==== init/auth ====
$("btnInit").onclick = async () => {
  if (!cfg.apiKey) {
    setStatus(
      "Config Firebase no encontrada. Abre admin_seed_gradeitems.html y guarda la Config.",
      0
    );
    return;
  }
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  setStatus("SDK listo.", 5);
  onAuthStateChanged(auth, async (u) => {
    me = u || null;
    $("userInfo").textContent = me ? `${me.email}` : "";
    $("roleTag").textContent = me ? "Autenticado" : "No autenticado";
    await routeByRole();
  });
};
$("btnLogin").onclick = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};
$("btnLogout").onclick = async () => {
  await signOut(auth);
};

async function routeByRole() {
  if (!me) {
    show("#panelTeacher", false);
    show("#panelStudent", false);
    return;
  }
  const mref = doc(db, `${coursePath()}/members/${me.uid}`);
  const msnap = await getDoc(mref);
  myRole = msnap.exists() ? msnap.data().role || "student" : "student";
  $("roleTag").textContent = myRole.toUpperCase();
  if (myRole === "teacher") {
    show("#panelTeacher", true);
    show("#panelStudent", false);
    await populateStudentList();
  } else {
    show("#panelTeacher", false);
    show("#panelStudent", true);
    await loadStudentView(me.uid);
  }
}

// ==== datos ====
async function loadItems() {
  setStatus("Cargando items...", 20);
  const snap = await getDocs(collection(db, `${coursePath()}/gradeItems`));
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  items.sort(
    (a, b) =>
      a.unit - b.unit ||
      (a.order || 0) - (b.order || 0) ||
      a.id.localeCompare(b.id)
  );
  return items;
}
async function loadStudentData(studentId) {
  const gsnap = await getDocs(
    query(
      collection(db, `${coursePath()}/grades`),
      where("studentId", "==", studentId)
    )
  );
  const gradesMap = {};
  gsnap.forEach((d) => {
    const x = d.data();
    gradesMap[x.itemId] = { score: x.score, max: x.maxPoints };
  });
  const parts = {};
  for (const u of [1, 2, 3]) {
    const id = `${studentId}_U${u}`;
    const psnap = await getDoc(
      doc(db, `${coursePath()}/unitParticipation/${id}`)
    );
    parts[String(u)] = psnap.exists() ? psnap.data().score ?? null : null;
  }
  return { gradesMap, participation: parts };
}
function avgList(list) {
  if (!list.length) return null;
  const s = list.reduce((a, b) => a + b.s, 0);
  const m = list.reduce((a, b) => a + b.m, 0);
  if (m <= 0) return null;
  return Math.max(0, Math.min(100, (s / m) * 100));
}
function compute(items, gradesMap, participation) {
  const B = {
    1: { asg: [], act: [], ex: [], pro: [], part: participation["1"] },
    2: { asg: [], act: [], ex: [], pro: [], part: participation["2"] },
    3: { asg: [], act: [], ex: [], pro: [], part: participation["3"] },
  };
  for (const it of items) {
    const g = gradesMap[it.id];
    if (g && g.score != null) {
      const e = { s: g.score, m: g.max ?? it.maxPoints };
      if (it.category === "actividad") B[it.unit].act.push(e);
      else if (it.category === "asignacion") B[it.unit].asg.push(e);
      else if (it.category === "examen") B[it.unit].ex.push(e);
      else if (it.category === "proyecto") B[it.unit].pro.push(e);
    }
  }
  const W = { P: 0.1, Agn: 0.2, Act: 0.25, ExPro: 0.45 },
    U = {};
  for (const u of [1, 2, 3]) {
    const P = B[u].part,
      Agn = avgList(B[u].asg),
      Act = avgList(B[u].act),
      Ex = avgList(B[u].ex),
      Pro = avgList(B[u].pro),
      EP = u === 3 ? Pro : Ex;
    const parts = [
      P == null ? null : W.P * P,
      Agn == null ? null : W.Agn * Agn,
      Act == null ? null : W.Act * Act,
      EP == null ? null : W.ExPro * EP,
    ];
    U[u] = parts.some((x) => x === null)
      ? null
      : parts.reduce((a, b) => a + b, 0);
  }
  const final =
    U[1] == null || U[2] == null || U[3] == null
      ? null
      : 0.3 * U[1] + 0.3 * U[2] + 0.4 * U[3];
  return { U, final, B };
}

// ==== alumno ====
async function loadStudentView(studentId) {
  const items = await loadItems();
  const { gradesMap, participation } = await loadStudentData(studentId);
  const { U, final } = compute(items, gradesMap, participation);
  qs("#panelStudent #studSummary").innerHTML = `
    <div><div class="muted">Unidad 1</div><div class="pill">${
      U[1] == null ? "—" : U[1].toFixed(2)
    }%</div></div>
    <div><div class="muted">Unidad 2</div><div class="pill">${
      U[2] == null ? "—" : U[2].toFixed(2)
    }%</div></div>
    <div><div class="muted">Unidad 3</div><div class="pill">${
      U[3] == null ? "—" : U[3].toFixed(2)
    }%</div></div>
    <div><div class="muted">Promedio final</div><div class="pill" style="border-color:#8ee6c7; color:#8ee6c7">${
      final == null ? "—" : final.toFixed(2)
    }%</div></div>`;
  qs("#panelStudent #studTables").innerHTML = renderUnitTables(
    items,
    gradesMap,
    false
  );
  setStatus("Alumno cargado.", 100);
}

// ==== docente ====
async function populateStudentList() {
  const sel = $("studentSelect");
  sel.innerHTML = "";
  const snap = await getDocs(
    query(
      collection(db, `${coursePath()}/members`),
      where("role", "==", "student")
    )
  );
  snap.forEach((d) => {
    const m = d.data();
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = m.displayName
      ? `${m.displayName} · ${m.email || d.id}`
      : m.email || d.id;
    sel.appendChild(o);
  });
}
$("btnLoadStudent").onclick = async () => {
  const uid = $("studentSelect").value;
  if (!uid) {
    alert("Selecciona un alumno.");
    return;
  }
  await loadTeacherFor(uid);
};
$("btnRefresh").onclick = async () => {
  const uid = $("studentSelect").value;
  if (uid) await loadTeacherFor(uid);
};
$("btnSaveAll").onclick = async () => {
  const uid = $("studentSelect").value;
  if (!uid) return;
  const inputs = Array.from(root.querySelectorAll("[data-grade-input='1']"));
  for (const el of inputs) {
    const score = el.value === "" ? null : Number(el.value);
    const itemId = el.getAttribute("data-item");
    await saveGrade(uid, itemId, score);
  }
  await loadTeacherFor(uid);
  setStatus("Cambios guardados.", 100);
};

async function loadTeacherFor(studentId) {
  const items = await loadItems();
  const { gradesMap, participation } = await loadStudentData(studentId);
  $("pU1").value = participation["1"] ?? "";
  $("pU2").value = participation["2"] ?? "";
  $("pU3").value = participation["3"] ?? "";
  $("pU1").onblur = () => saveParticipation(studentId, 1, $("pU1").value);
  $("pU2").onblur = () => saveParticipation(studentId, 2, $("pU2").value);
  $("pU3").onblur = () => saveParticipation(studentId, 3, $("pU3").value);
  qs("#teachTables").innerHTML = renderUnitTables(items, gradesMap, true);
  root.querySelectorAll("[data-grade-input='1']").forEach((inp) => {
    inp.addEventListener("blur", async (e) => {
      const score = e.target.value === "" ? null : Number(e.target.value);
      const itemId = e.target.getAttribute("data-item");
      await saveGrade(studentId, itemId, score);
    });
  });
  const { U, final } = compute(items, gradesMap, participation);
  qs("#teachSummary").innerHTML = `
    <div><div class="muted">Unidad 1</div><div class="pill">${
      U[1] == null ? "—" : U[1].toFixed(2)
    }%</div></div>
    <div><div class="muted">Unidad 2</div><div class="pill">${
      U[2] == null ? "—" : U[2].toFixed(2)
    }%</div></div>
    <div><div class="muted">Unidad 3</div><div class="pill">${
      U[3] == null ? "—" : U[3].toFixed(2)
    }%</div></div>
    <div><div class="muted">Promedio final</div><div class="pill" style="border-color:#8ee6c7; color:#8ee6c7">${
      final == null ? "—" : final.toFixed(2)
    }%</div></div>`;
  setStatus("Panel docente listo.", 100);
}

function renderUnitTables(items, gradesMap, editable) {
  const byU = { 1: [], 2: [], 3: [] };
  items.forEach((it) => byU[it.unit].push(it));
  const block = (title, rows) =>
    rows
      ? `<tr><th colspan="5" style="padding-top:10px">${title}</th></tr>${rows}`
      : "";
  const row = (it) => {
    const g = gradesMap[it.id] || {};
    const score = g.score ?? "";
    const max = g.max ?? it.maxPoints;
    const pct =
      g.score == null || max == null
        ? ""
        : Math.round((g.score / max) * 1000) / 10 + "%";
    const input = editable
      ? `<input data-grade-input="1" data-item="${it.id}" type="number" min="0" max="${it.maxPoints}" style="width:90px" value="${score}"/>`
      : `<span>${score === "" ? "—" : score}</span>`;
    return `<tr><td class="small muted">${it.id}</td><td>${it.title}</td><td class="center">${it.maxPoints}</td><td class="center">${input}</td><td class="right">${pct}</td></tr>`;
  };
  function table(u) {
    const rowsAct = byU[u]
      .filter((x) => x.category === "actividad")
      .map(row)
      .join("");
    const rowsAsg = byU[u]
      .filter((x) => x.category === "asignacion")
      .map(row)
      .join("");
    const rowsEx = byU[u]
      .filter((x) => x.category === "examen")
      .map(row)
      .join("");
    const rowsPro = byU[u]
      .filter((x) => x.category === "proyecto")
      .map(row)
      .join("");
    return `<div class="qs-card"><h3>Unidad ${u}</h3><table>
      <thead><tr><th style="width:120px">Ítem</th><th>Título</th><th class="center" style="width:90px">Max</th><th class="center" style="width:140px">${
        editable ? "Puntos obtenidos" : "Puntos"
      }</th><th class="right" style="width:90px">% Ítem</th></tr></thead>
      <tbody>
        ${block(
          "Actividades",
          rowsAct ||
            '<tr><td colspan="5" class="muted small">Sin ítems</td></tr>'
        )}
        ${block(
          "Asignaciones",
          rowsAsg ||
            '<tr><td colspan="5" class="muted small">Sin ítems</td></tr>'
        )}
        ${
          u === 3
            ? block(
                "Proyecto final (avances)",
                rowsPro ||
                  '<tr><td colspan="5" class="muted small">Sin ítems</td></tr>'
              )
            : block(
                "Examen",
                rowsEx ||
                  '<tr><td colspan="5" class="muted small">Sin ítems</td></tr>'
              )
        }
      </tbody></table></div>`;
  }
  return table(1) + table(2) + table(3);
}

async function saveParticipation(studentId, unit, score) {
  const s = score === "" ? null : Math.max(0, Math.min(100, Number(score)));
  const ref = doc(
    db,
    `${coursePath()}/unitParticipation/${studentId}_U${unit}`
  );
  await setDoc(
    ref,
    { studentId, unit, score: s, updatedAt: new Date() },
    { merge: true }
  );
  setStatus(`Participación U${unit} guardada.`, 85);
}
async function saveGrade(studentId, itemId, score) {
  const itSnap = await getDoc(doc(db, `${coursePath()}/gradeItems/${itemId}`));
  if (!itSnap.exists()) {
    setStatus(`Item ${itemId} no existe`, 10);
    return;
  }
  const it = itSnap.data();
  const ref = doc(db, `${coursePath()}/grades/${studentId}_${itemId}`);
  await setDoc(
    ref,
    {
      courseId: $("courseId").value.trim(),
      studentId,
      itemId,
      unit: it.unit,
      category: it.category,
      score: score === null ? null : Number(score),
      maxPoints: it.maxPoints,
      gradedAt: new Date(),
    },
    { merge: true }
  );
  setStatus(`Guardado ${itemId}.`, 75);
}
