// js/calificaciones-backend.js

import { getDb, onAuth } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

// Importa TODAS las funciones de inicialización de los otros módulos
import { initStudentUploads } from './student-uploads.js';
import { initTeacherSync } from './calificaciones-teacher-sync.js';
import { initTeacherPreview } from './calificaciones-teacher-preview.js';
import { initUploadsUI } from './calificaciones-uploads-ui.js';

const db = getDb();
const COURSE_ID = "calidad-de-software-v2";
let students = [];
let isAppInitialized = false; // Bandera de control para evitar doble inicialización

// --- Carga de Datos Segura ---
async function fetchStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        students = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        students.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (typeof window.populateStudentDropdown === 'function') {
            window.populateStudentDropdown(students);
        }
    } catch (error) {
        console.error("Error al cargar estudiantes:", error);
        alert("No se pudo cargar la lista de estudiantes. Asegúrate de iniciar sesión como 'docente'.");
    }
}

// --- Gestión de Calificaciones ---
async function saveGradesToFirestore(studentId) {
    if (!studentId) return false;
    const gradesData = {};
    document.querySelectorAll(".grade-input, .project-grade-input").forEach(input => {
        const activityId = input.dataset.activityId;
        if (activityId) {
            gradesData[activityId] = input.value || "0";
        }
    });

    try {
        const gradesDocRef = doc(db, "courses", COURSE_ID, "grades", studentId);
        await setDoc(gradesDocRef, gradesData, { merge: true });
        return true;
    } catch (error) {
        console.error("Error al guardar calificaciones:", error);
        return false;
    }
}

async function loadGradesFromFirestore(studentId) {
    const clearUI = () => window.clearAllGrades && window.clearAllGrades();
    const calculateUI = () => {
        if (window.calculateProjectGrades) window.calculateProjectGrades();
        if (window.calculateGrades) window.calculateGrades();
    };
    if (!studentId) { clearUI(); return; }
    try {
        const gradesDocRef = doc(db, "courses", COURSE_ID, "grades", studentId);
        const docSnap = await getDoc(gradesDocRef);
        clearUI();
        if (docSnap.exists()) {
            const grades = docSnap.data();
            document.querySelectorAll(".grade-input, .project-grade-input").forEach(input => {
                const activityId = input.dataset.activityId;
                if (activityId && grades[activityId] !== undefined) {
                    input.value = grades[activityId];
                }
            });
        }
        calculateUI();
    } catch (error) {
        console.error("Error al cargar calificaciones:", error);
        clearUI();
    }
}

// --- Lógica de Interfaz ---
window.populateStudentDropdown = (studentList) => {
    const select = document.getElementById("studentSelect");
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
    studentList.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = `${student.matricula || student.id} - ${student.name}`;
        select.appendChild(option);
    });
    if (currentVal) select.value = currentVal;
};

// --- Punto de Entrada y Orquestación ---
function initializePageEventListeners() {
    const studentSelect = document.getElementById("studentSelect");
    if (studentSelect) {
        studentSelect.addEventListener("change", function () {
            const student = students.find(s => s.id === this.value);
            if (student) {
                document.getElementById("studentId").value = student.id;
                document.getElementById("studentName").value = student.name;
                document.getElementById("studentEmail").value = student.email;
                loadGradesFromFirestore(this.value);
            } else {
                document.getElementById("studentId").value = "";
                document.getElementById("studentName").value = "";
                document.getElementById("studentEmail").value = "";
                if(window.clearAllGrades) window.clearAllGrades();
            }
        });
    }

    const saveButton = document.getElementById("saveGradesBtn");
    if (saveButton) {
        saveButton.addEventListener("click", async () => {
            const statusEl = document.getElementById("saveGradesStatus");
            const showStatus = (message, isError) => {
                 if (!statusEl) return;
                 statusEl.textContent = message;
                 statusEl.classList.remove("hidden");
                 statusEl.classList.toggle("text-red-600", !!isError);
                 statusEl.classList.toggle("text-emerald-600", !isError);
                 setTimeout(() => statusEl.classList.add("hidden"), 4000);
            };

            const studentId = document.getElementById("studentId").value;
            if (!studentId) {
                showStatus("Selecciona un estudiante antes de guardar.", true);
                return;
            }
            saveButton.disabled = true;
            saveButton.textContent = "Guardando...";
            const success = await saveGradesToFirestore(studentId);
            showStatus(success ? "Calificaciones guardadas en la nube." : "Error al guardar.", !success);
            saveButton.disabled = false;
            saveButton.textContent = "Guardar Cambios";
        });
    }
}

// --- PUNTO DE ENTRADA ÚNICO DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initializePageEventListeners();
    
    onAuth((user, claims) => {
        if (!user || !claims) {
            console.log("Usuario no autenticado, auth-guard.js debería actuar.");
            isAppInitialized = false;
            return;
        }

        if (isAppInitialized) {
            return;
        }
        isAppInitialized = true;
        
        console.log(`Usuario autenticado como: ${claims.role}. Inicializando todos los módulos...`);

        // Llama a TODOS los inicializadores
        initTeacherSync(user, claims);
        initTeacherPreview(user, claims);
        initStudentUploads(user, claims);
        initUploadsUI(user, claims);

        // Lógica específica de esta página
        if (claims.role === 'docente') {
            document.body.classList.add('role-teacher');
            fetchStudents();
        } else {
            document.body.classList.remove('role-teacher');
            const teacherUI = document.querySelector('.teacher-only');
            if(teacherUI) teacherUI.style.display = 'none';
            loadGradesFromFirestore(user.uid);
        }
    });
});
