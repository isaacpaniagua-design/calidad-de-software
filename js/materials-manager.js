// js/materials-manager.js

// --- CAMBIO IMPORTANTE ---
// Ya no inicializamos Firebase aquí. En su lugar, importamos la conexión a la BD
// y las funciones que tu archivo firebase.js ya nos ofrece.
import { getDb } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  orderBy,
  query,
  serverTimestamp, // Importamos serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Obtenemos la instancia ÚNICA de la base de datos
const db = getDb();
const materialsCollection = collection(db, "materials");

/**
 * Obtiene todos los materiales de la base de datos, ordenados por fecha de creación.
 */
export async function getMaterials() {
  console.log("Cargando materiales desde Firestore...");
  const q = query(materialsCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const materials = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  console.log("Materiales cargados:", materials);
  return materials;
}

/**
 * Guarda un nuevo objeto de material en la base de datos.
 */
export async function saveMaterial(materialData) {
  console.log("Guardando material en Firestore:", materialData);

  // --- CAMBIO IMPORTANTE ---
  // Añadimos el serverTimestamp() aquí para que Firestore ponga la fecha correcta.
  const dataWithTimestamp = {
    ...materialData,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(materialsCollection, dataWithTimestamp);
  return { id: docRef.id, ...dataWithTimestamp };
}

/**
 * Elimina un material de la base de datos usando su ID.
 */
export async function deleteMaterial(id) {
  console.log("Eliminando material de Firestore:", id);
  const materialDoc = doc(db, "materials", id);
  await deleteDoc(materialDoc);
}

/**
 * Actualiza el título y la descripción de un material.
 */
export async function updateMaterial(id, newTitle, newDescription) {
  console.log("Actualizando material en Firestore:", id);
  const materialDoc = doc(db, "materials", id);
  await updateDoc(materialDoc, {
    title: newTitle,
    description: newDescription,
    updatedAt: serverTimestamp(), // También actualizamos la fecha de modificación
  });
}

/**
 * Incrementa el contador de descargas de un material en 1.
 */
export async function incrementDownloads(id) {
  console.log("Incrementando descargas para:", id);
  const materialDoc = doc(db, "materials", id);
  await updateDoc(materialDoc, {
    downloads: increment(1),
  });
}
