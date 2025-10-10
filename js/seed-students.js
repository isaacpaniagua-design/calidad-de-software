// js/seed-students.js

// --- 1. CONFIGURACIÓN E IMPORTACIONES ---
// Se importan las funciones necesarias desde el SDK de Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-firestore.js";

// Tu configuración de Firebase (la tomé de tus archivos)
const firebaseConfig = {
    apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
    authDomain: "calidad-de-software-v2.firebaseapp.com",
    projectId: "calidad-de-software-v2",
    storageBucket: "calidad-de-software-v2.appspot.com",
    messagingSenderId: "220818066383",
    appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

// --- 2. INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const logElement = document.getElementById('log');

// Función para registrar mensajes en la consola de la página
function log(message, type = '') {
    logElement.innerHTML += `<div class="${type}">${message}</div>`;
    logElement.scrollTop = logElement.scrollHeight;
}

// --- 3. DATOS DE ESTUDIANTES ---
// La lista definitiva que proporcionaste.
const studentsData = [
    { "uid": "00000249116", "displayName": "Danett Itzanami Arana Guerrero", "email": "danett.arana249116@potros.itson.edu.mx", "matricula": "00000249116", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000147818", "displayName": "Abraham Francisco Araujo Godoy", "email": "abraham.araujo@potros.itson.edu.mx", "matricula": "00000147818", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244228", "displayName": "Egla Icel Avalos Morales", "email": "egla.avalos244228@potros.itson.edu.mx", "matricula": "00000244228", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244442", "displayName": "Luis Mario Blasco Villagomez", "email": "luis.blasco244442@potros.itson.edu.mx", "matricula": "00000244442", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244242", "displayName": "Adlemi Guadalupe Duarte Lopez", "email": "adlemi.duarte244242@potros.itson.edu.mx", "matricula": "00000244242", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244473", "displayName": "Jesus Alan Espericueta Ramos", "email": "jesus.espericueta244473@potros.itson.edu.mx", "matricula": "00000244473", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244608", "displayName": "Sergio Alejandro Gracia Morales", "email": "sergio.gracia244608@potros.itson.edu.mx", "matricula": "00000244608", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000228847", "displayName": "Julian Ricardo Hernandez Gonzalez", "email": "julian.hernandez228847@potros.itson.edu.mx", "matricula": "00000228847", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000248997", "displayName": "Mario Enrique Le Blohic Garay", "email": "mario.leblohic248997@potros.itson.edu.mx", "matricula": "00000248997", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000249012", "displayName": "Luis Carlos Lopez Guerrero", "email": "luis.lopez249012@potros.itson.edu.mx", "matricula": "00000249012", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000248990", "displayName": "Jose Gabriel Maldonado Montoya", "email": "jose.maldonado248990@potros.itson.edu.mx", "matricula": "00000248990", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244378", "displayName": "Yolanda Martínez Santacruz", "email": "yolanda.martinez244378@potros.itson.edu.mx", "matricula": "00000244378", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000217812", "displayName": "Dainiz Raí Martínez Soto", "email": "dainiz.martinez217812@potros.itson.edu.mx", "matricula": "00000217812", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244321", "displayName": "Angel Stipe Nevescanin Moreno", "email": "angel.nevescanin244321@potros.itson.edu.mx", "matricula": "00000244321", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244477", "displayName": "Erik David Osuna Aguilera", "email": "erik.osuna244477@potros.itson.edu.mx", "matricula": "00000244477", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244711", "displayName": "Jorge Eduardo Palacios Cardenas", "email": "jorge.palacios244711@potros.itson.edu.mx", "matricula": "00000244711", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244569", "displayName": "Juan Carlos Preciado Ruiz", "email": "juan.preciado244569@potros.itson.edu.mx", "matricula": "00000244569", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244373", "displayName": "Jose Abelardo Reyes Galaz", "email": "jose.reyes244373@potros.itson.edu.mx", "matricula": "00000244373", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000240691", "displayName": "Emmanuel Rivas Quintana", "email": "emmanuel.rivas240691@potros.itson.edu.mx", "matricula": "00000240691", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244266", "displayName": "Víctor Emmanuel Rocha Aguilar", "email": "victor.rocha244266@potros.itson.edu.mx", "matricula": "00000244266", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244312", "displayName": "Jose Agustin Rodriguez Alvarado", "email": "jose.rodriguez244312@potros.itson.edu.mx", "matricula": "00000244312", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244621", "displayName": "Francisco Javier Soto Carrazco", "email": "francisco.soto244621@potros.itson.edu.mx", "matricula": "00000244621", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000216759", "displayName": "Dulce María Sánchez Zavala", "email": "dulce.sanchez216759@potros.itson.edu.mx", "matricula": "00000216759", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244689", "displayName": "Ramsés Mauricio Villegas Sosa", "email": "ramses.villegas244689@potros.itson.edu.mx", "matricula": "00000244689", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000244679", "displayName": "Angel Gael Viveros Zavala", "email": "angel.viveros244679@potros.itson.edu.mx", "matricula": "00000244679", "grades": { "u1": 0, "u2": 0, "u3": 0 } },
    { "uid": "00000099876", "displayName": "Pruebas Isaac", "email": "iman.guaymas@potros.itson.edu.mx", "matricula": "00000099876", "grades": { "u1": 0, "u2": 0, "u3": 0 } }
];

// --- 4. LÓGICA DEL SEMBRADOR ---
// Función principal que se ejecuta al cargar la página.
async function seedDatabase() {
    log("Conectado a Firestore. Iniciando proceso de sembrado...", "info");
    const studentsRef = collection(db, "students");

    for (const student of studentsData) {
        // Por cada estudiante en la lista, verificamos si ya existe por su 'uid'.
        const q = query(studentsRef, where("uid", "==", student.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Si no se encontraron documentos con ese 'uid', lo agregamos.
            try {
                await addDoc(studentsRef, student);
                log(`✓ Agregado: ${student.displayName} (${student.uid})`, "success");
            } catch (e) {
                log(`✗ Error agregando a ${student.displayName}: ${e.message}`, "error");
            }
        } else {
            // Si ya existe, lo omitimos para no duplicar.
            log(`- Omitido (ya existe): ${student.displayName} (${student.uid})`);
        }
    }

    log("<br><strong>🎉 Proceso completado. La colección 'students' ha sido actualizada. 🎉</strong>", "info");
}

// --- 5. EJECUCIÓN ---
// Inicia el proceso de sembrado.
seedDatabase();
