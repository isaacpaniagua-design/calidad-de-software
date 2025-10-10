// js/calificaciones-backend.js

// 1. IMPORTACIONES CORREGIDAS: Usamos las funciones de tu archivo firebase.js
import { getDb, onAuth } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const db = getDb();

const COURSE_ID = "calidad-de-software-v2"; // ID único para este curso
let students = []; // Caché local de la lista de estudiantes

// --- Carga de Datos Segura desde Firestore ---
async function fetchStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        students = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        students.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        
        if (typeof populateStudentDropdown === 'function') {
            populateStudentDropdown(students);
        }
    } catch (error) {
        console.error("Error al cargar estudiantes:", error);
        alert("No se pudo cargar la lista de estudiantes. Asegúrate de haber iniciado sesión como 'docente'.");
    }
}

// --- Gestión de Calificaciones en Firestore ---
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

    if (!studentId) {
        clearUI();
        return;
    }

    try {
        const gradesDocRef = doc(db, "courses", COURSE_ID, "grades", studentId);
        const docSnap = await getDoc(gradesDocRef);

        clearUI(); // Limpia la UI antes de cargar nuevos datos

        if (docSnap.exists()) {
            const grades = docSnap.data();
            document.querySelectorAll(".grade-input, .project-grade-input").forEach(input => {
                const activityId = input.dataset.activityId;
                if (activityId && grades[activityId]) {
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
    select.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
    studentList.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = `${student.matricula || student.id} - ${student.name}`;
        select.appendChild(option);
    });
};

// --- Inicialización y Manejo de Autenticación ---
function initializePage() {
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
    const statusEl = document.getElementById("saveGradesStatus");
    if (saveButton && statusEl) {
        const showStatus = (message, isError) => { /* ... (código sin cambios) */ };
        saveButton.addEventListener("click", async () => { /* ... (código sin cambios) */ });
    }
}

// Punto de entrada principal
document.addEventListener('DOMContentLoaded', () => {
    
    initializePage();

    onAuth(async (user, claims) => {
        if (user && claims) {
            // Usuario autenticado
            const userRole = claims.role;

            if (userRole === 'docente') {
                document.body.classList.add('role-teacher');
                fetchStudents(); // Solo el docente carga la lista
            } else {
                // Es un estudiante
                document.body.classList.remove('role-teacher');
                // Ocultamos el selector de estudiantes y mostramos sus datos
                const studentInfo = document.querySelector('.teacher-only');
                if(studentInfo) studentInfo.style.display = 'none';

                // Cargamos solo sus propias calificaciones
                loadGradesFromFirestore(user.uid); 
            }
        } else {
            // Usuario no autenticado
            console.log("Usuario no autenticado, esperando redirección de auth-guard.js");
            // Limpiamos la UI para no mostrar datos residuales
            window.populateStudentDropdown([]);
            if(window.clearAllGrades) window.clearAllGrades();
        }
    });
});
