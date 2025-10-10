// js/calificaciones-backend.js

import { getDb, onAuth } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const db = getDb();

const COURSE_ID = "calidad-de-software-v2";
let students = []; // Caché de la lista de estudiantes

// --- Carga de Datos Segura desde Firestore ---
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

        clearUI(); // Limpia antes de cargar

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
                // Limpia la info del estudiante
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

document.addEventListener('DOMContentLoaded', () => {
    initializePageEventListeners();

    // onAuth es nuestro controlador principal. Espera a que firebase.js confirme el estado del usuario.
    onAuth(async (user, claims) => {
        if (user && claims) {
            const userRole = claims.role;

            // Llama a las funciones de inicialización de otros scripts AHORA que sabemos el rol.
            // Esto resuelve el error de "funciones base no disponibles".
            if (window.initStudentUploads) window.initStudentUploads(user, claims);
            if (window.initTeacherSync) window.initTeacherSync(user, claims);
            if (window.initTeacherPreview) window.initTeacherPreview(user, claims);

            if (userRole === 'docente') {
                document.body.classList.add('role-teacher');
                fetchStudents(); // Solo el docente puede obtener la lista de alumnos.
            } else {
                // Lógica para estudiante
                document.body.classList.remove('role-teacher');
                const teacherUI = document.querySelector('.teacher-only');
                if(teacherUI) teacherUI.style.display = 'none';
                loadGradesFromFirestore(user.uid); 
            }
        } else {
            // No hay usuario autenticado.
            console.log("Usuario no autenticado, auth-guard.js debería actuar.");
            window.populateStudentDropdown([]);
            if(window.clearAllGrades) window.clearAllGrades();
        }
    });
});
