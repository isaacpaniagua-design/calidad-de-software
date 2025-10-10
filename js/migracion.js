// js/migracion.js

// Asegúrate de que firebase.js y firebase-config.js se carguen antes que este script.
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from './firebase.js'; // Importa la app de Firebase ya inicializada

const db = getFirestore(app);

// Función para obtener los estudiantes del archivo JSON
async function getStudentsFromFile() {
    const response = await fetch('../data/students.json');
    if (!response.ok) {
        throw new Error("No se pudo cargar el archivo students.json");
    }
    const data = await response.json();
    return data.students; // Asumiendo que el JSON tiene una clave "students"
}

// Función para subir los datos a Firestore
async function migrateStudents() {
  console.log("Iniciando migración de estudiantes...");
  const studentsToMigrate = await getStudentsFromFile();

  if (!studentsToMigrate || studentsToMigrate.length === 0) {
      console.error("No hay estudiantes para migrar.");
      return;
  }

  for (const student of studentsToMigrate) {
    try {
      // Usaremos el 'id' del estudiante como ID del documento
      const studentDocRef = doc(db, "students", student.id);
      
      const studentData = {
        name: student.name,
        email: student.email,
        matricula: student.id,
        type: "student"
      };
      
      await setDoc(studentDocRef, studentData);
      console.log(`✅ Estudiante migrado: ${student.name} (${student.id})`);
    } catch (error) {
      console.error(`❌ Error migrando a ${student.name}:`, error);
    }
  }

  console.log("¡Migración completada!");
}

// Llama a la función para iniciar el proceso
migrateStudents();
