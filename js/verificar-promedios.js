// Script de verificación/corrección de promedios de unidad en Firestore
// Ejecutar en consola del navegador autenticado como docente

import { getDb } from "./js/firebase.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

async function verificarYCorregirPromedios() {
  const db = getDb();
  const gradesCol = collection(db, "grades");
  const snap = await getDocs(gradesCol);
  let actualizados = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    let update = {};
    // Verifica unit1
    if (
      !("unit1" in data) ||
      typeof data.unit1 !== "object" ||
      Object.keys(data.unit1).length === 0
    ) {
      update.unit1 = { average: 0 };
    }
    // Verifica unit2
    if (
      !("unit2" in data) ||
      typeof data.unit2 !== "object" ||
      Object.keys(data.unit2).length === 0
    ) {
      update.unit2 = { average: 0 };
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

verificarYCorregirPromedios();
