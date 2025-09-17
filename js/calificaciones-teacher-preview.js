// js/calificaciones-teacher-preview.js
// Agrega una "Vista de estudiante" en calificaciones.html para el alumno seleccionado en #studentSelect.
// No modifica nav/footer ni estilos globales. Usa IDs con prefijo qsp- para evitar colisiones.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $id = (id) => document.getElementById(id);

function ready(){ return new Promise(r => {
  if (document.readyState === "complete" || document.readyState === "interactive") r();
  else document.addEventListener("DOMContentLoaded", r, { once: true });
});}
function waitConfig(maxMs=4000){ return new Promise(res=>{
  const t0=performance.now(); (function tick(){
    if (window.firebaseConfig?.apiKey) return res(true);
    if (performance.now()-t0>maxMs) return res(false);
    setTimeout(tick, 50);
  })();
});}

function fmtPct(n){ return (Number(n)||0).toFixed(2) + "%"; }
function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }

function resumenGlobal(items){
  let porc=0, pond=0;
  for (const it of items){
    const max = Number(it.maxPuntos)||0;
    const pts = Number(it.puntos)||0;
    const pnd = Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}

function renderQsp(items){
  const tbody = $id("qsp-tbody");
  const kpiTotal = $id("qsp-kpi-total");
  const kpiItems = $id("qsp-kpi-items");
  const kpiPond  = $id("qsp-kpi-pond");
  const bar = $id("qsp-bar-fill");

  const { porcentaje, pondSum } = resumenGlobal(items);
  if (kpiTotal) kpiTotal.textContent = fmtPct(porcentaje);
  if (kpiItems) kpiItems.textContent = String(items.length);
  if (kpiPond)  kpiPond.textContent  = fmtPct(pondSum);
  if (bar) bar.style.width = (porcentaje.toFixed(2) + "%");

  tbody.innerHTML = "";
  if (!items.length){
    tbody.innerHTML = `<tr><td class="qsc-muted" colspan="6">Sin actividades registradas aún.</td></tr>`;
    return;
  }
  for (const it of items){
    const max = Number(it.maxPuntos)||0;
    const pts = Number(it.puntos)||0;
    const pnd = Number(it.ponderacion)||0;
    const aporta = max>0 ? (pts/max)*pnd : 0;
    const fecha = (()=>{ try{ const d = it.fecha?.toDate ? it.fecha.toDate() : (it.fecha instanceof Date ? it.fecha : null); return d? d.toLocaleDateString() : "—"; }catch(_){return "—";} })();
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${it.nombre || it.title || "Actividad"}</td>
        <td>${pts}</td>
        <td>${max}</td>
        <td>${pnd}%</td>
        <td>${(Number(aporta)||0).toFixed(2)}%</td>
        <td>${fecha}</td>
      </tr>`);
  }
}

// Firestore helpers
async function resolverUidPorMatricula(db, matricula){
  try{
    const q = query(collection(db, "users"), where("matricula","==", String(matricula)));
    const s = await getDocs(q);
    if (!s.empty) return s.docs[0].id;
  }catch(_){}
  return null;
}
async function obtenerItemsAlumno(db, grupoId, uid){
  const base = collection(db, "grupos", grupoId, "calificaciones", uid, "items");
  const snap = await getDocs(query(base, orderBy("fecha","asc")));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

// UI bootstrap
function ensurePreviewUI(root){
  // Crea solo una vez
  if ($id("student-preview")) return $id("student-preview");
  const wrap = document.createElement("section");
  wrap.id = "student-preview";
  wrap.className = "qsc-wrap";
  wrap.innerHTML = `
    <h2 class="qsc-title">Vista de estudiante (preview docente)</h2>
    <div class="qsc-kpis">
      <div class="qsc-kpi"><span id="qsp-kpi-total">--%</span><small>Total</small></div>
      <div class="qsc-kpi"><span id="qsp-kpi-items">0</span><small>Actividades</small></div>
      <div class="qsc-kpi"><span id="qsp-kpi-pond">0%</span><small>Peso cubierto</small></div>
    </div>
    <div class="qsc-bar"><div id="qsp-bar-fill" class="qsc-bar-fill"></div></div>
    <div class="qsc-table-wrap">
      <table class="qsc-table">
        <thead><tr>
          <th>Actividad</th><th>Puntos</th><th>Máx</th>
          <th>Ponderación</th><th>Aporta al final</th><th>Fecha</th>
        </tr></thead>
        <tbody id="qsp-tbody"><tr><td class="qsc-muted" colspan="6">Selecciona un alumno…</td></tr></tbody>
      </table>
    </div>`;
  // Inserta después del bloque original de "Mis calificaciones" si existe, o al final del contenedor
  const anchor = root.querySelector(".qsc-wrap") || root;
  anchor.after(wrap);
  return wrap;
}

async function main(){
  await ready();
  const cfgOk = await waitConfig();
  if (!cfgOk) return console.warn("[teacher-preview] Falta window.firebaseConfig");

  const app = getApps().length ? getApp() : initializeApp(window.firebaseConfig);
  const db = getFirestore(app);

  const root = document.getElementById("calificaciones-root") || document.body;
  const params = new URLSearchParams(location.search);
  const GRUPO_ID = (root?.dataset?.grupo || params.get("grupo") || "calidad-2025").trim();

  const sel = $id("studentSelect");
  if (!sel) return; // No hay selector de alumno en esta página; no hacemos nada.

  ensurePreviewUI(root);

  sel.addEventListener("change", async ()=>{
    const matricula = sel.value;
    if (!matricula){ $id("qsp-tbody").innerHTML = '<tr><td class="qsc-muted" colspan="6">Selecciona un alumno…</td></tr>'; return; }
    const uid = await resolverUidPorMatricula(db, matricula);
    if (!uid){ $id("qsp-tbody").innerHTML = '<tr><td class="qsc-muted" colspan="6">No se encontró UID para la matrícula.</td></tr>'; return; }
    const items = await obtenerItemsAlumno(db, GRUPO_ID, uid);
    renderQsp(items);
  });
}

main().catch(console.error);
