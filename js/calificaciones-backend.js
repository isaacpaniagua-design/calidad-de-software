// js/calificaciones-backend.es2015.js
// Compat ES2015: sin optional chaining ni default params.

import { initFirebase, getDb, getAuthInstance, onAuth } from './firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function $(s, r){ return (r || document).querySelector(s); }
function $id(id){ return document.getElementById(id); }

function ready(){
  return new Promise(function(resolve){
    if (document.readyState === "complete" || document.readyState === "interactive") resolve();
    else document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function clampPct(n){ n = Number(n)||0; return Math.max(0, Math.min(100, n)); }
function fmtPct(n){ return (Number(n)||0).toFixed(2) + '%'; }
function escPct(n){ if(n==null) return '—'; var x=Number(n)||0; if(x>=90) return 'A'; if(x>=80) return 'B'; if(x>=70) return 'C'; if(x>=60) return 'D'; return 'F'; }

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
  for(var i=0;i<items.length;i++){
    var it=items[i];
    var max=Number(it.maxPuntos)||0;
    var pts=Number(it.puntos)||0;
    var pnd=Number(it.ponderacion)||0;
    if (max>0) porc += (pts/max)*pnd;
    pond += pnd;
  }
  return { porcentaje: clampPct(porc), pondSum: clampPct(pond) };
}
function bucketsPorUnidad(items){
  var B={1:[],2:[],3:[]};
  for(var i=0;i<items.length;i++){ var it=items[i]; var u=inferUnidad(it); if(u===1||u===2||u===3) B[u].push(it); }
  return B;
}
function scoreUnidad(arr){ if(!arr.length) return 0; return resumenGlobal(arr).porcentaje; }
function final3040(u1,u2,u3){ return clampPct(u1*0.3 + u2*0.3 + u3*0.4); }

function renderAlumno(items){
  var tbody = $id('qsc-tbody');
  var kpiTotal = $id('qsc-kpi-total');
  var kpiItems = $id('qsc-kpi-items');
  var kpiPond  = $id('qsc-kpi-pond');
  var bar      = $id('qsc-bar-fill');

  var rg = resumenGlobal(items);
  if (kpiTotal) kpiTotal.textContent = fmtPct(rg.porcentaje);
  if (kpiItems) kpiItems.textContent = String(items.length);
  if (kpiPond)  kpiPond.textContent  = fmtPct(rg.pondSum);
  if (bar) bar.style.width = rg.porcentaje.toFixed(2) + '%';

  if (tbody){
    tbody.innerHTML = '';
    if (!items.length){
      tbody.innerHTML = '<tr><td class="qsc-muted" colspan="9">Sin actividades registradas aún.</td></tr>';
    } else {
      for(var i=0;i<items.length;i++){
        var it=items[i];
        var tipo = it.tipo || it.category || '—';
        var uni  = (it.unidad!=null ? it.unidad : inferUnidad(it)) || '—';
        var max  = Number(it.maxPuntos)||0;
        var pts  = Number(it.puntos)||0;
        var pnd  = Number(it.ponderacion)||0;
        var aporta = max>0 ? (pts/max)*pnd : 0;
        var escala = max>0 ? escPct(100*(pts/max)) : '—';
        var fecha = '—';
        try{
          var d = it.fecha && it.fecha.toDate ? it.fecha.toDate() : (it.fecha instanceof Date ? it.fecha : null);
          fecha = d ? d.toLocaleDateString() : '—';
        }catch(e){}
        tbody.insertAdjacentHTML('beforeend',
          '<tr>' +
            '<td>'+ (it.nombre || it.title || 'Actividad') +'</td>' +
            '<td>'+ tipo +'</td>' +
            '<td>'+ uni +'</td>' +
            '<td style="text-align:right">'+ pts +'</td>' +
            '<td style="text-align:right">'+ max +'</td>' +
            '<td style="text-align:right">'+ pnd +'%</td>' +
            '<td style="text-align:right">'+ fmtPct(aporta) +'</td>' +
            '<td style="text-align:center">'+ escala +'</td>' +
            '<td style="text-align:center">'+ fecha +'</td>' +
          '</tr>');
      }
    }
  }

  var B = bucketsPorUnidad(items);
  var u1 = scoreUnidad(B[1]);
  var u2 = scoreUnidad(B[2]);
  var u3 = scoreUnidad(B[3]);
  var fin = final3040(u1,u2,u3);
  var to5 = function(p){ return (p*0.05).toFixed(1); };

  if ($id('unit1Grade')) $id('unit1Grade').textContent = to5(u1);
  if ($id('unit2Grade')) $id('unit2Grade').textContent = to5(u2);
  if ($id('unit3Grade')) $id('unit3Grade').textContent = to5(u3);
  if ($id('finalGrade'))  $id('finalGrade').textContent  = to5(fin);

  if ($id('progressPercent')) $id('progressPercent').textContent = String(Math.round(fin)) + '%';
  var pbar = $id('progressBar');
  if (pbar){
    pbar.style.width = fin + '%';
    pbar.className = 'h-3 rounded-full progress-bar';
    if (fin >= 90) pbar.classList.add('bg-gradient-to-r','from-green-500','to-green-600');
    else if (fin >= 70) pbar.classList.add('bg-gradient-to-r','from-yellow-500','to-yellow-600');
    else if (fin >= 60) pbar.classList.add('bg-gradient-to-r','from-orange-500','to-orange-600');
    else pbar.classList.add('bg-gradient-to-r','from-red-500','to-red-600');
  }
}

async function obtenerItemsAlumno(db, grupoId, uid){
  const base = collection(db, 'grupos', grupoId, 'calificaciones', uid, 'items');
  const snap = await getDocs(query(base, orderBy('fecha','asc')));
  return snap.docs.map(d => { const obj = d.data(); obj.id = d.id; return obj; });
}

async function main(){
  await ready();
  initFirebase();
  const db = getDb();
  const root = $id('calificaciones-root') || document.body;
  const params = new URLSearchParams(location.search);
  const dataset = (root && root.dataset) ? root.dataset : {};
  const grupoAttr = dataset && dataset.grupo ? dataset.grupo : null;
  const GRUPO_ID = (grupoAttr || params.get('grupo') || 'calidad-2025').trim();

  onAuth(async function(user){
    if (!user) return;
    try{
      const items = await obtenerItemsAlumno(db, GRUPO_ID, user.uid);
      renderAlumno(items);
    }catch(e){ console.error('[calificaciones-backend] error', e); }
  });
}

main().catch(console.error);