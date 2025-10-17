// js/materials-manager.js

// --- IMPORTACIONES UNIFICADAS ---

// Importaciones para la lógica de la interfaz y autenticación
import { getAuthInstance, uploadMaterial } from "./firebase-config.js";
import { uploadMaterialToDrive } from "./index-student-uploads.js";

// Importaciones directas de Firestore SDK (usadas en tus funciones)
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
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

// --- LÓGICA DE BASE DE DATOS (BASADA EN TU CÓDIGO) ---

// Inicializamos la instancia de Firestore una sola vez
const db = getFirestore();
const materialsCollection = collection(db, 'materials');

// Función para obtener todos los materiales de la colección
async function getMaterials() {
  console.log("Cargando materiales desde Firestore...");
  const q = query(materialsCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log("Materiales cargados:", materials);
  return materials;
}

// Función para eliminar un material por su ID
async function deleteMaterial(id) {
  console.log("Eliminando material de Firestore:", id);
  const materialDoc = doc(db, 'materials', id);
  await deleteDoc(materialDoc);
}

// Función para actualizar el título y descripción de un material
async function updateMaterial(id, newTitle, newDescription) {
    console.log("Actualizando material en Firestore:", id);
    const materialDoc = doc(db, 'materials', id);
    await updateDoc(materialDoc, {
        title: newTitle,
        description: newDescription,
        updatedAt: serverTimestamp()
    });
}

// Función para incrementar el contador de descargas
async function incrementDownloads(id) {
  console.log("Incrementando descargas para:", id);
  const materialDoc = doc(db, 'materials', id);
  await updateDoc(materialDoc, { downloads: increment(1) });
}

// --- LÓGICA DE LA INTERFAZ DE USUARIO (EVENT LISTENERS) ---

document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("upload-material-form");
  const uploadDriveBtn = document.getElementById("upload-drive-btn");
  const materialsList = document.getElementById("materials-list"); // Asumiendo que tienes un contenedor con este ID

  // Manejador para el botón de subida a Firebase Storage (el botón principal del form)
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = uploadForm.querySelector('button[type="submit"]');
      const spinner = submitBtn.querySelector(".spinner-border");
      
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const file = fileInput.files[0];

      if (!file) {
        alert("Por favor, selecciona un archivo.");
        return;
      }

      submitBtn.disabled = true;
      spinner.style.display = "inline-block";

      try {
        const user = getAuthInstance().currentUser;
        if (!user) throw new Error("Debes iniciar sesión para subir archivos.");

        await uploadMaterial({
          file,
          title: uploadForm.querySelector('input[name="title"]').value || file.name,
          category: uploadForm.querySelector('select[name="category"]').value,
          description: uploadForm.querySelector('textarea[name="description"]').value,
          ownerEmail: user.email,
        });

        alert("¡Material subido a Firebase con éxito!");
        uploadForm.reset();
        renderMaterials(); // Actualizamos la lista
      } catch (error) {
        console.error("Error al subir a Firebase:", error);
        alert(`Error: ${error.message}`);
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = "none";
      }
    });
  }

  // Manejador para el botón de subida a Google Drive
  if (uploadDriveBtn) {
    uploadDriveBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const spinner = uploadDriveBtn.querySelector(".spinner-border");
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const file = fileInput.files[0];

      if (!file) {
        alert("Por favor, selecciona un archivo.");
        return;
      }

      uploadDriveBtn.disabled = true;
      spinner.style.display = "inline-block";

      try {
        const user = getAuthInstance().currentUser;
        if (!user) throw new Error("Debes iniciar sesión para subir archivos.");

        await uploadMaterialToDrive({
          file,
          title: uploadForm.querySelector('input[name="title"]').value || file.name,
          category: uploadForm.querySelector('select[name="category"]').value,
          description: uploadForm.querySelector('textarea[name="description"]').value,
          ownerEmail: user.email,
        });

        alert("¡Material subido a Google Drive con éxito!");
        uploadForm.reset();
        renderMaterials(); // Actualizamos la lista
      } catch (error) {
        console.error("Error al subir a Google Drive:", error);
        alert(`Error al subir a Drive: ${error.message}`);
      } finally {
        uploadDriveBtn.disabled = false;
        spinner.style.display = "none";
      }
    });
  }

  // Función para renderizar la lista de materiales en la página
  async function renderMaterials() {
    if (!materialsList) return;
    
    materialsList.innerHTML = '<p>Cargando materiales...</p>';
    try {
      const materials = await getMaterials();
      if (materials.length === 0) {
        materialsList.innerHTML = '<p>No hay materiales disponibles.</p>';
        return;
      }
      // Aquí iría tu lógica para crear el HTML de cada material y mostrarlo
      // Por ejemplo:
      materialsList.innerHTML = materials.map(mat => `
        <div class="material-item">
          <h4>${mat.title}</h4>
          <p>${mat.description || 'Sin descripción'}</p>
          <a href="${mat.url}" target="_blank">Descargar</a>
        </div>
      `).join('');
    } catch (error) {
      console.error("Error al renderizar materiales:", error);
      materialsList.innerHTML = '<p class="text-danger">No se pudieron cargar los materiales.</p>';
    }
  }

  // Carga inicial de los materiales al entrar a la página
  renderMaterials();
});
