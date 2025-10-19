// js/materials-manager.js

import { getDb } from './firebase.js'; 
import { 
  collection, getDocs, addDoc, doc, 
  deleteDoc, updateDoc, increment, orderBy, query, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const db = getDb();
const materialsCollection = collection(db, 'materials');

export async function getMaterials() {
  console.log("Cargando materiales desde Firestore...");
  const q = query(materialsCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log("Materiales cargados:", materials);
  return materials;
}

export async function saveMaterial(materialData) {
  console.log("Guardando material en Firestore:", materialData);
  const dataWithTimestamp = { ...materialData, createdAt: serverTimestamp() };
  const docRef = await addDoc(materialsCollection, dataWithTimestamp);
  return { id: docRef.id, ...dataWithTimestamp };
}

export async function deleteMaterial(id) {
  console.log("Eliminando material de Firestore:", id);
  const materialDoc = doc(db, 'materials', id);
  await deleteDoc(materialDoc);
}

export async function updateMaterial(id, newTitle, newDescription) {
    console.log("Actualizando material en Firestore:", id);
    const materialDoc = doc(db, 'materials', id);
    await updateDoc(materialDoc, {
        title: newTitle,
        description: newDescription,
        updatedAt: serverTimestamp()
    });
}

export async function incrementDownloads(id) {
  console.log("Incrementando descargas para:", id);
  const materialDoc = doc(db, 'materials', id);
  await updateDoc(materialDoc, { downloads: increment(1) });
}