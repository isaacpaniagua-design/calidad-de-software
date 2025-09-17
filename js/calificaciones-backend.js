// js/calificaciones-backend.js
// Integra Firebase para calcular calificaciones por alumno SIN alterar tu UI.
// Requiere que en la página exista window.firebaseConfig y los IDs usados en calificaciones.html.
// Escucha auth y, si hay sesión, llena: #finalGrade, #unit1Grade, #unit2Grade, #unit3Grade, #progressPercent, #progressBar.
// Si eliges un alumno en #studentSelect, intenta resolver su UID buscando en /users por campo 'matricula'.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Utilidades DOM seguras
const $id = (s) => document.getElementById(s);
const exists = (id) => !!$id(id);

// Espera a que exista window.firebaseConfig y el DOM
function ready() {
  return new Promise((resolve) => {
    if (document.readyState === "complete" || document.readyState === "interactive") resolve();
    else document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}
function waitConfig(maxMs = 4000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (window.firebaseConfig?.apiKey) return resolve(true);
      if (performance.now() - t0 > maxMs) return resolve(false);
      setTimeout(tick, 60);
    };
    tick();
  });
}

// Inferencias suaves desde item Firestore
function inferUnidad(it) {
  if (it.unidad != null) return Number(it.unidad);
  const n = String(it.nombre || "").toLowerCase();
  if (/\bu1\b|unidad\s*1/.test(n)) return 1;
  if (/\bu2\b|unidad\s*2/.test(n)) return 2;
  if (/\bu3\b|unidad\s*3/.test(n)) return 3;
  return 0;
}
function clampPct(n){ return Math.max(0, Math.min(100, Number(n)||0)); }

// Cálculo por unidad normalizando por ponderación interna de esa unidad
function calcularUnidades(items) {
  const buckets = {1:[],2:[],3:[]};
  for (const it of items) {
    const u = inferUnidad(it);
    if (u===1||u===2||u===3) buckets[u].push(it);
  }
  function unitScore(arr){
    if (!arr.length) return { score:0, pond:0 };
    let raw=0, pondSum=0;
    for (const it of arr){
      const max = Number(it.maxPuntos)||0;
      const pts = Number(it.puntos)||0;
      const pond = Number(it.ponderacion)||0;
      if (max>0) raw += (pts/max)*pond;
      pondSum += pond;
    }
    const scorePct = pondSum>0 ? (raw/pondSum)*100 : 0;
    return { score: clampPct(scorePct), pond: clampPct(pondSum) };
  }
  const u1 = unitScore(buckets[1]);
  const u2 = unitScore(buckets[2]);
  const u3 = unitScore(buckets[3]);
  return { u1, u2, u3 };
}

// Final 30/30/40
function calcularFinalPct(u1Pct, u2Pct, u3Pct){
  return clampPct(u1Pct*0.3 + u2Pct*0.3 + u3Pct*0.4);
}

// Escribe en la UI del HTML existente (0–5)
function pintarUI({u1Pct,u2Pct,u3Pct,finalPct}){
  if (exists("unit1Grade")) $id("unit1Grade").textContent = (u1Pct*0.05).toFixed(1); // % a 0–5
  if (exists("unit2Grade")) $id("unit2Grade").textContent = (u2Pct*0.05).toFixed(1);
  if (exists("unit3Grade")) $id("unit3Grade").textContent = (u3Pct*0.05).toFixed(1);
  if (exists("finalGrade"))  $id("finalGrade").textContent  = (finalPct*0.05).toFixed(1);

  const progress = Math.min(100, Math.max(0, finalPct)); // %
  if (exists("progressPercent")) $id("progressPercent").textContent = progress.toFixed(0) + "%";
  if (exists("progressBar")) {
    const bar = $id("progressBar");
    bar.style.width = progress + "%";
    bar.className = "h-3 rounded-full progress-bar"; // limpia clases previas
    if (finalPct >= 90) bar.classList.add("bg-gradient-to-r","from-green-500","to-green-600");
    else if (finalPct >= 70) bar.classList.add("bg-gradient-to-r","from-yellow-500","to-yellow-600");
    else if (finalPct >= 60) bar.classList.add("bg-gradient-to-r","from-orange-500","to-orange-600");
    else bar.classList.add("bg-gradient-to-r","from-red-500","to-red-600");
  }
}

// Obtiene items Firestore: grupos/{GRUPO_ID}/calificaciones/{uid}/items
async function obtenerItemsAlumno(db, grupoId, uid){
  const ref = collection(db, "grupos", grupoId, "calificaciones", uid, "items");
  const snap = await getDocs(query(ref, orderBy("fecha","asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Intenta mapear matrícula -> uid en /users (campo 'matricula')
async function resolverUidPorMatricula(db, matricula){
  try{
    const q = query(collection(db,"users"), where("matricula","==", String(matricula)));
    const s = await getDocs(q);
    if (!s.empty) return s.docs[0].id;
  }catch(_){}
  return null;
}

async function main(){
  await ready();
  const cfgOk = await waitConfig();
  if (!cfgOk) { console.warn("[calificaciones-backend] Falta window.firebaseConfig"); return; }

  const app = getApps().length ? getApp() : initializeApp(window.firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Determina grupo
  const root = document.getElementById("calificaciones-root");
  const params = new URLSearchParams(location.search);
  const GRUPO_ID = (root?.dataset?.grupo || params.get("grupo") || "calidad-2025").trim();

  // Si cambias el alumno en el selector, intenta cargar por matrícula
  const sel = $id("studentSelect");
  if (sel) {
    sel.addEventListener("change", async () => {
      const matricula = sel.value;
      if (!matricula) return;
      const uid = await resolverUidPorMatricula(db, matricula);
      if (!uid) return; // si no hay mapping, no forzamos nada (deja la lógica localStorage existente)
      const items = await obtenerItemsAlumno(db, GRUPO_ID, uid);
      const { u1, u2, u3 } = calcularUnidades(items);
      const finalPct = calcularFinalPct(u1.score, u2.score, u3.score);
      pintarUI({ u1Pct:u1.score, u2Pct:u2.score, u3Pct:u3.score, finalPct });
    });
  }

  // Si hay sesión, carga automáticamente para el usuario logueado
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try{
      const items = await obtenerItemsAlumno(db, GRUPO_ID, user.uid);
      const { u1, u2, u3 } = calcularUnidades(items);
      const finalPct = calcularFinalPct(u1.score, u2.score, u3.score);
      pintarUI({ u1Pct:u1.score, u2Pct:u2.score, u3Pct:u3.score, finalPct });
    }catch(err){
      console.error("[calificaciones-backend] Error cargando items:", err);
    }
  });
}

main().catch(console.error);
