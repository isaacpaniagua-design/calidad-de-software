// js/seed-grades.js

import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const startButton = document.getElementById('startButton');
const statusDiv = document.getElementById('status');

function log(message, type = 'info') {
    const p = document.createElement('p');
    p.textContent = message;
    if (type === 'success') {
        p.className = 'success';
    } else if (type === 'error') {
        p.className = 'error';
    }
    statusDiv.appendChild(p);
    statusDiv.scrollTop = statusDiv.scrollHeight; // Auto-scroll
}

async function createInitialGradeRecords() {
    log("Iniciando proceso de carga masiva...");
    startButton.disabled = true;

    try {
        // 1. Cargar la lista de estudiantes desde el archivo JSON
        const response = await fetch('../data/students.json');
        if (!response.ok) {
            throw new Error(`No se pudo cargar students.json (status: ${response.status})`);
        }
        const students = await response.json();
        log(`Se encontraron ${students.length} estudiantes en el archivo local.`);

        // 2. Iterar sobre cada estudiante y crear su registro en 'grades'
        for (const student of students) {
            const studentId = student.id; // ej: "00000099876"
            const studentName = student.name;

            if (!studentId || !studentName) {
                log(`Saltando registro inválido: ${JSON.stringify(student)}`, 'error');
                continue;
            }

            const gradeRef = doc(db, 'grades', studentId);

            // Verificar si el documento ya existe para no sobrescribirlo
            const docSnap = await getDoc(gradeRef);
            if (docSnap.exists()) {
                log(`El estudiante ${studentName} (${studentId}) ya tiene un registro de calificaciones. Saltando.`);
                continue;
            }

            // 3. Definir la estructura del documento inicial de calificaciones
            const initialGradeData = {
                name: studentName,
                email: student.email || null, // Guardar el email también es útil
                unit1: 0,
                unit2: 0,
                unit3: 0,
                projectFinal: 0,
                createdAt: new Date() // Sello de tiempo de creación
            };
            
            // 4. Escribir el documento en Firestore
            await setDoc(gradeRef, initialGradeData);
            log(`Éxito: Se creó el registro para ${studentName} (${studentId}).`, 'success');
        }

        log("¡Proceso de carga masiva completado!", 'success');

    } catch (error) {
        log(`Error crítico durante el proceso: ${error.message}`, 'error');
        console.error(error);
    } finally {
        startButton.disabled = false;
    }
}

startButton.addEventListener('click', createInitialGradeRecords);
