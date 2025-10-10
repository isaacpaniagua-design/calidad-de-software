// js/migracion.js

import { getDb } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();

// Función para obtener los estudiantes del archivo JSON local
async function getStudentsFromFile() {
    // Ruta correcta relativa al archivo migracion.html (que estará en la raíz)
    const response = await fetch('data/students.json'); 
    
    if (!response.ok) {
        throw new Error("No se pudo cargar el archivo data/students.json. Asegúrate de que el archivo está en la carpeta 'data'.");
    }
    const data = await response.json();
    return data.students; 
}

// Función para subir los datos a Firestore
async function migrateStudents() {
  console.log("Iniciando migración de estudiantes a Firestore...");
  
  try {
    const studentsToMigrate = await getStudentsFromFile();
    if (!studentsToMigrate || studentsToMigrate.length === 0) {
        console.error("La lista de estudiantes en students.json está vacía o no se encontró.");
        return;
    }

    for (const student of studentsToMigrate) {
        // Usaremos el 'id' del estudiante como ID del documento en la colección 'students'
        const studentDocRef = doc(db, "students", student.id);
        
        const studentData = {
          name: student.name,
          email: student.email,
          matricula: student.id,
          type: "student"
        };
        
        await setDoc(studentDocRef, studentData);
        console.log(`✅ Estudiante migrado con éxito: ${student.name} (${student.id})`);
    }

    console.log("🎉 ¡Migración completada! Todos los estudiantes están seguros en Firestore.");

  } catch (error) {
      console.error("❌ Ocurrió un error durante la migración:", error);
  }
}

// Llama a la función para iniciar el proceso
migrateStudents();
