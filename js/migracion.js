// js/migracion.js

// 1. Importamos la función getDb() de tu archivo firebase.js
import { getDb } from './firebase.js';
// 2. Importamos solo las funciones de Firestore que necesitamos
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// 3. Obtenemos la instancia de la base de datos llamando a la función.
//    Esta función se encargará de inicializar Firebase si es necesario.
const db = getDb();

// Función para obtener los estudiantes del archivo JSON local
async function getStudentsFromFile() {
    const response = await fetch('../data/students.json');
    if (!response.ok) {
        throw new Error("No se pudo cargar el archivo data/students.json. Verifica que la ruta es correcta.");
    }
    const data = await response.json();
    // Tu archivo JSON tiene la lista dentro de la clave "students"
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

    console.log("🎉 ¡Migración completada! Todos los estudiantes están en Firestore.");

  } catch (error) {
      console.error("❌ Ocurrió un error durante la migración:", error);
  }
}

// Llama a la función para iniciar el proceso
migrateStudents();
