// js/calificaciones-backend.js
// Backend unificado para calificaciones.html sin tocar el diseño.
// - Si existen IDs tipo qsc-* (tabla "Mis calificaciones"), los llena.
// - Si existen #unit1Grade/#finalGrade y barra de progreso, también las llena.
// - Lee window.firebaseConfig, usa Firebase modular 10.12.4.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const $id = (id) => document.getElementById(id);

function domReady(){ return new Promise(r => {
  if (document.readyState === "complete" || document.readyState === "interactive") r(); else document.addEventListener("DOMContentLoaded", r, {once:true});
});}
function waitConfig(maxMs=4000){ return new Promise(res=>{
  const t0=performance.now(); (function tick(){ if (window.firebaseConfig?.apiKey) return res(true);
    if (performance.now()-t0>maxMs) return res(false); setTimeout(tick,60); })();
});}

function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }
function fmtPct(n){ return (Number(n)||0).toFixed(2) + "%"; }
function escPct(n){ if(n==null) return "—"; const x=Number(n)||0; if(x>=90) return "A"; if(x>=80) return "B"; if(x>=70) return "C"; if(x>=60) return "D"; return "F"; }

// Inferencias
function inferUnidad(it){
  if (it.unidad!=null) return Number(it.unidad);
  const n = String(it.nombre||it.title||"").toLowerCase();
  if (/\bu1\b|unidad\s*1/.test(n)) return 1;
  if (/\bu2\b|unidad\s*2/.test(n)) return 2;
  if (/\bu3\b|unidad\s*3/.test(n)) return 3;
  return 0;
}

// Agregados
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
function bucketsPorUnidad(items){
  const B={1:[],2:[],3:[]};
  for (const it of items){ const u=inferUnidad(it); if (u===1||u===2||u===3) B[u].push(it); }
  return B;
}
function scoreUnidad(arr){
  if(!arr.length) return 0;
  const { porcentaje } = resumenGlobal(arr);
  return porcentaje; // 0-100
}
function final3040(u1Pct,u2Pct,u3Pct){ return clampPct(u1Pct*0.3 + u2Pct*0.3 + u3Pct*0.4); }

// Renderiza tabla qsc-* si existe
function renderQsc(items){
  const tbody = $id("qsc-tbody");
  const kpiTotal = $id("qsc-kpi-total");
  const kpiItems = $id("qsc-kpi-items");
  const kpiPond  = $id("qsc-kpi-pond");
  const bar = $id("qsc-bar-fill");

  if (!tbody) return; // no tabla qsc en esta página

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
        <td>${fmtPct(aporta)}</td>
        <td>${fecha}</td>
      </tr>`);
  }
}

// Renderiza grados 0–5 y barra si existen esos IDs
function renderEscala5(items){
  const B = bucketsPorUnidad(items);
  const u1Pct = scoreUnidad(B[1]);
  const u2Pct = scoreUnidad(B[2]);
  const u3Pct = scoreUnidad(B[3]);
  const finPct= final3040(u1Pct,u2Pct,u3Pct);
  const to5 = (p)=> (p*0.05).toFixed(1);

  if ($id("unit1Grade")) $id("unit1Grade").textContent = to5(u1Pct);
  if ($id("unit2Grade")) $id("unit2Grade").textContent = to5(u2Pct);
  if ($id("unit3Grade")) $id("unit3Grade").textContent = to5(u3Pct);
  if ($id("finalGrade"))  $id("finalGrade").textContent  = to5(finPct);

  if ($id("progressPercent")) $id("progressPercent").textContent = String(Math.round(finPct)) + "%";
  if ($id("progressBar")){
    const bar = $id("progressBar");
    bar.style.width = finPct + "%";
    bar.className = "h-3 rounded-full progress-bar";
    if (finPct >= 90) bar.classList.add("bg-gradient-to-r","from-green-500","to-green-600");
    else if (finPct >= 70) bar.classList.add("bg-gradient-to-r","from-yellow-500","to-yellow-600");
    else if (finPct >= 60) bar.classList.add("bg-gradient-to-r","from-orange-500","to-orange-600");
    else bar.classList.add("bg-gradient-to-r","from-red-500","to-red-600");
  }
}

// Firestore
async function obtenerItemsAlumno(db, grupoId, uid){
  const base = collection(db, "grupos", grupoId, "calificaciones", uid, "items");
  const snap = await getDocs(query(base, orderBy("fecha","asc")));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}
async function resolverUidPorMatricula(db, matricula){
  try{
    const q = query(collection(db, "users"), where("matricula","==", String(matricula)));
    const s = await getDocs(q);
    if (!s.empty) return s.docs[0].id;
  }catch(_){}
  return null;
}

async function main(){
  await domReady();
  const cfgOk = await waitConfig();
  if (!cfgOk) { console.warn("[calificaciones-backend] Falta window.firebaseConfig"); return; }

  const app = getApps().length ? getApp() : initializeApp(window.firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const root = document.getElementById("calificaciones-root");
  const params = new URLSearchParams(location.search);
  const GRUPO_ID = (root?.dataset?.grupo || params.get("grupo") || "calidad-2025").trim();

  // Cambio por selector manual si existe
  const sel = $id("studentSelect");
  if (sel){
    sel.addEventListener("change", async () => {
      const matricula = sel.value;
      if (!matricula) return;
      const uid = await resolverUidPorMatricula(db, matricula);
      if (!uid) return;
      const items = await obtenerItemsAlumno(db, GRUPO_ID, uid);
      renderQsc(items);
      renderEscala5(items);
    });
  }

  // Auto para usuario logueado
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try{
      const items = await obtenerItemsAlumno(db, GRUPO_ID, user.uid);
      renderQsc(items);
      renderEscala5(items);
    }catch(err){
      console.error("[calificaciones-backend] Error:", err);
      const tb = $id("qsc-tbody");
      if (tb) tb.innerHTML = `<tr><td colspan="6">Error al cargar calificaciones.</td></tr>`;
    }
  });
}

main().catch(console.error);
