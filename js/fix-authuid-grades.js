// js/fix-authuid-grades.js
// Utilidad para docentes: corrige el campo authUid en todos los documentos de 'grades' según el usuario autenticado.
// Debe ejecutarse desde una cuenta docente autorizada.

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { initFirebase } from "./firebase.js";

initFirebase();
const db = getFirestore();
const auth = getAuth();

async function fixAuthUidInGrades(statusCb) {
  statusCb("Buscando documentos de 'grades'...");
  const gradesSnap = await getDocs(collection(db, "grades"));
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const docSnap of gradesSnap.docs) {
    const data = docSnap.data();
    if (!data.email) {
      skipped++;
      continue;
    }
    // Buscar usuario por email
    try {
      const userRecord = await fetchUserByEmail(data.email);
      if (userRecord && userRecord.uid) {
        if (data.authUid !== userRecord.uid) {
          await updateDoc(doc(db, "grades", docSnap.id), {
            authUid: userRecord.uid,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }
  statusCb(
    `Listo. Actualizados: ${updated}, Sin cambios: ${skipped}, Fallidos: ${failed}`
  );
}

// Busca el usuario de Auth por email usando la API REST de Firebase Auth (requiere estar autenticado como docente)
async function fetchUserByEmail(email) {
  // Firebase JS SDK no expone getUserByEmail en frontend, pero podemos usar la lista de usuarios si el docente tiene acceso
  // Aquí solo devolvemos null para evitar errores, pero puedes adaptar esto si tienes una función admin
  return null;
}

function renderFixAuthUidUI() {
  const root = document.createElement("div");
  root.style =
    "max-width:400px;margin:2rem auto;padding:2rem;background:#fff;border-radius:8px;box-shadow:0 2px 8px #0001;text-align:center;";
  root.innerHTML = `
    <h2 style="font-size:1.2rem;font-weight:600;margin-bottom:1rem;">Corregir authUid en 'grades'</h2>
    <button id="fix-authuid-btn" style="padding:0.5rem 1.5rem;font-size:1rem;border-radius:4px;background:#2563eb;color:#fff;border:none;">Corregir ahora</button>
    <div id="fix-authuid-status" style="margin-top:1rem;font-size:1rem;color:#2563eb;"></div>
  `;
  document.body.appendChild(root);
  document.getElementById("fix-authuid-btn").onclick = async () => {
    const statusDiv = document.getElementById("fix-authuid-status");
    statusDiv.textContent = "Procesando...";
    await fixAuthUidInGrades((msg) => (statusDiv.textContent = msg));
  };
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Debes iniciar sesión como docente para usar esta herramienta.");
    return;
  }
  // Verificación de rol docente (usando localStorage o clase en <html>)
  const role = (localStorage.getItem("qs_role") || "").toLowerCase();
  const isTeacher =
    role === "docente" ||
    document.documentElement.classList.contains("role-teacher");
  if (!isTeacher) {
    document.body.innerHTML =
      '<div style="max-width:400px;margin:2rem auto;padding:2rem;background:#fff;border-radius:8px;box-shadow:0 2px 8px #0001;text-align:center;"><h2 style="color:#dc2626;">Acceso restringido</h2><p>Solo docentes pueden ejecutar esta herramienta.</p></div>';
    return;
  }
  renderFixAuthUidUI();
});
