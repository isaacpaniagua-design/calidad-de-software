// js/migracion.js

import { getDb } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();

async function getStudentsFromFile() {
    const response = await fetch('data/students.json'); 
    if (!response.ok) {
        throw new Error("No se pudo cargar el archivo data/students.json. Verifica que la ruta es correcta.");
    }
    const data = await response.json();
    return data.students; 
}

async function migrateStudents() {
  console.log("Iniciando migración de estudiantes a Firestore...");
  
  try {
    const studentsToMigrate = await getStudentsFromFile();
    if (!studentsToMigrate || !Array.isArray(studentsToMigrate)) {
        console.error("El archivo students.json está mal formado o no contiene un array de estudiantes.");
        return;
    }

    for (const student of studentsToMigrate) {
        // === INICIO DE LA CORRECCIÓN ===
        // Verificamos que el estudiante tenga un ID válido antes de continuar.
        if (!student || !student.id || typeof student.id !== 'string' || student.id.trim() === '') {
            console.warn("⚠️ Se omitió un registro de estudiante por no tener un ID válido:", student);
            continue; // Salta al siguiente estudiante en la lista
        }
        // === FIN DE LA CORRECCIÓN ===

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

    console.log("🎉 ¡Migración completada! Revisa la consola por si se omitió algún registro.");

  } catch (error) {
      console.error("❌ Ocurrió un error durante la migración:", error);
  }
}

// Llama a la función para iniciar el proceso
migrateStudents();
