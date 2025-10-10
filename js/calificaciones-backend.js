// js/calificaciones-backend.js

import { app } from './firebase.js';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);

const COURSE_ID = "calidad-de-software-v2"; // ID único del curso
let students = []; // Aquí guardaremos los estudiantes cargados desde Firestore

// --- Carga de Datos Segura ---
async function fetchStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        students = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        students.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        
        // Llama a la función global para poblar el dropdown, si existe
        if (typeof populateStudentDropdown === 'function') {
            populateStudentDropdown(students);
        }
    } catch (error) {
        console.error("Error al cargar estudiantes:", error);
        alert("No se pudo cargar la lista de estudiantes. Asegúrate de haber iniciado sesión como docente y tener los permisos correctos.");
    }
}

// --- Gestión de Calificaciones en Firestore ---
async function saveGradesToFirestore(studentId) {
    if (!studentId) return false;

    const gradesData = {};
    // Es crucial que cada input tenga un 'data-activity-id' único y estable
    document.querySelectorAll(".grade-input, .project-grade-input").forEach(input => {
        if (input.dataset.activityId) {
            gradesData[input.dataset.activityId] = input.value || "0";
        }
    });

    try {
        const gradesDocRef = doc(db, "courses", COURSE_ID, "grades", studentId);
        await setDoc(gradesDocRef, gradesData, { merge: true });
        return true; // Éxito
    } catch (error) {
        console.error("Error al guardar calificaciones en Firestore:", error);
        return false; // Fallo
    }
}

async function loadGradesFromFirestore(studentId) {
    // Estas funciones deben estar definidas globalmente o importadas para que sean accesibles
    const clearUI = typeof clearAllGrades === 'function' ? clearAllGrades : () => {};
    const calculateUI = () => {
        if (typeof calculateProjectGrades === 'function') calculateProjectGrades();
        if (typeof calculateGrades === 'function') calculateGrades();
    };

    if (!studentId) {
        clearUI();
        return;
    }

    try {
        const gradesDocRef = doc(db, "courses", COURSE_ID, "grades", studentId);
        const docSnap = await getDoc(gradesDocRef);

        if (docSnap.exists()) {
            const grades = docSnap.data();
            document.querySelectorAll(".grade-input, .project-grade-input").forEach(input => {
                if (input.dataset.activityId && grades[input.dataset.activityId]) {
                    input.value = grades[input.dataset.activityId];
                } else {
                    input.value = ""; // Limpia si no hay dato para esa actividad
                }
            });
        } else {
            clearUI();
        }
        calculateUI();
    } catch (error) {
        console.error("Error al cargar calificaciones desde Firestore:", error);
        clearUI();
    }
}

// --- Lógica de la Interfaz (Modificada para ser controlada desde aquí) ---

// Hacemos la función global para que otros scripts puedan acceder a ella
window.populateStudentDropdown = (studentList) => {
    const select = document.getElementById("studentSelect");
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';

    studentList.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        // Asumiendo que 'matricula' y 'name' vienen de Firestore
        option.textContent = `${student.matricula || student.id} - ${student.name}`;
        select.appendChild(option);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const studentSelect = document.getElementById("studentSelect");
    if (studentSelect) {
        studentSelect.addEventListener("change", function () {
            const selectedId = this.value;
            const student = students.find(s => s.id === selectedId);

            if (student) {
                document.getElementById("studentId").value = student.id;
                document.getElementById("studentName").value = student.name;
                document.getElementById("studentEmail").value = student.email;
                loadGradesFromFirestore(selectedId);
            } else {
                document.getElementById("studentId").value = "";
                document.getElementById("studentName").value = "";
                document.getElementById("studentEmail").value = "";
                if (typeof clearAllGrades === 'function') clearAllGrades();
            }
        });
    }
    
    // Configuración del botón de guardar
    const saveButton = document.getElementById("saveGradesBtn");
    const statusEl = document.getElementById("saveGradesStatus");

    if (saveButton && statusEl) {
        const showStatus = (message, isError) => {
            statusEl.textContent = message;
            statusEl.classList.remove("hidden");
            statusEl.classList.toggle("text-red-600", !!isError);
            statusEl.classList.toggle("text-emerald-600", !isError);
            setTimeout(() => statusEl.classList.add("hidden"), 4000);
        };

        saveButton.addEventListener("click", async () => {
            const studentId = document.getElementById("studentId").value;
            if (!studentId) {
                showStatus("Selecciona un estudiante antes de guardar.", true);
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Guardando...";

            const success = await saveGradesToFirestore(studentId);
            
            if (success) {
                showStatus("Calificaciones guardadas en la nube.", false);
            } else {
                showStatus("Error al guardar. Revisa la consola.", true);
            }
            
            saveButton.disabled = false;
            saveButton.textContent = "Guardar Cambios";
        });
    }
});


// --- Inicialización y Autenticación ---
function main() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.email);
            // Para obtener el rol, necesitamos que esté en el ID Token (Custom Claims)
            const idTokenResult = await user.getIdTokenResult();
            const userRole = idTokenResult.claims.role;

            if (userRole === 'docente') {
                console.log("Rol: Docente. Cargando lista de estudiantes...");
                document.body.classList.add('role-teacher');
                fetchStudents();
            } else {
                console.log("Rol: Estudiante. Cargando calificaciones personales...");
                document.body.classList.remove('role-teacher');
                // Lógica para que el estudiante vea solo sus calificaciones
                loadGradesFromFirestore(user.uid); 
            }
        } else {
            console.log("Usuario no autenticado.");
            // El auth-guard.js debería redirigir a login.html
            // Por seguridad, limpiamos cualquier dato residual
            if (typeof clearAllGrades === 'function') clearAllGrades();
            window.populateStudentDropdown([]);
        }
    });
}

main();
