// Script de verificación/corrección de promedios de unidad en Firestore (versión con cálculo real)
// Ejecutar en consola del navegador autenticado como docente

import { getDb } from "./js/firebase.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

function calcularPromedio(obj) {
  if (!obj || typeof obj !== "object") return 0;
  const vals = Object.values(obj).filter((v) => typeof v === "number");
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function verificarYCorregirPromediosReales() {
  const db = getDb();
  const gradesCol = collection(db, "grades");
  const snap = await getDocs(gradesCol);
  let actualizados = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    let update = {};
    // unit1
    if (
      !("unit1" in data) ||
      typeof data.unit1 !== "object" ||
      Object.keys(data.unit1).length === 0
    ) {
      update.unit1 = { average: 0 };
    } else if (!("average" in data.unit1)) {
      update.unit1 = { ...data.unit1, average: calcularPromedio(data.unit1) };
    }
    // unit2
    if (
      !("unit2" in data) ||
      typeof data.unit2 !== "object" ||
      Object.keys(data.unit2).length === 0
    ) {
      update.unit2 = { average: 0 };
    } else if (!("average" in data.unit2)) {
      update.unit2 = { ...data.unit2, average: calcularPromedio(data.unit2) };
    }
    if (Object.keys(update).length > 0) {
      await updateDoc(doc(db, "grades", docSnap.id), update);
      actualizados++;
      console.log(`Actualizado ${docSnap.id}:`, update);
    }
  }
  console.log(
    `Verificación/corrección terminada. Documentos actualizados: ${actualizados}`
  );
}

verificarYCorregirPromediosReales();
