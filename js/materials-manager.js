// js/materials-manager.js

// Importamos la configuración que ya tienes y las herramientas de Firebase
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Inicializamos Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const materialsCollection = collection(db, "materials");

/**
 * Obtiene todos los materiales de la base de datos, ordenados por fecha de creación.
 * @returns {Promise<Array>} Una promesa que se resuelve con un array de objetos de materiales.
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
 * @param {object} materialData - El objeto con los datos del material.
 * @returns {Promise<object>} Una promesa que se resuelve con el documento guardado.
 */
export async function saveMaterial(materialData) {
  console.log("Guardando material en Firestore:", materialData);
  const docRef = await addDoc(materialsCollection, materialData);
  return { id: docRef.id, ...materialData };
}

/**
 * Elimina un material de la base de datos usando su ID.
 * @param {string} id - El ID del documento a eliminar.
 * @returns {Promise<void>}
 */
export async function deleteMaterial(id) {
  console.log("Eliminando material de Firestore:", id);
  const materialDoc = doc(db, "materials", id);
  await deleteDoc(materialDoc);
}

/**
 * Actualiza el título y la descripción de un material.
 * @param {string} id - El ID del material a actualizar.
 * @param {string} newTitle - El nuevo título.
 * @param {string} newDescription - La nueva descripción.
 * @returns {Promise<void>}
 */
export async function updateMaterial(id, newTitle, newDescription) {
  console.log("Actualizando material en Firestore:", id);
  const materialDoc = doc(db, "materials", id);
  await updateDoc(materialDoc, {
    title: newTitle,
    description: newDescription,
  });
}

/**
 * Incrementa el contador de descargas de un material en 1.
 * @param {string} id - El ID del material.
 * @returns {Promise<void>}
 */
export async function incrementDownloads(id) {
  console.log("Incrementando descargas para:", id);
  const materialDoc = doc(db, "materials", id);
  await updateDoc(materialDoc, {
    downloads: increment(1),
  });
}
