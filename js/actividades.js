// js/actividades.js

import {
  onAuth,
  getDb,
} from "./firebase.js";

import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let db;
let studentsList = [];
let selectedStudentId = null;
let unsubscribeFromGrades = null;

// Referencias al DOM
const studentSelect = document.getElementById("student-select-display");
const activitiesListSection = document.getElementById("activities-list-section");
const studentNameDisplay = document.getElementById("student-name-display");
const activitiesContainer = document.getElementById("activities-container");
const mainContent = document.querySelector(".container.mx-auto");
const createGroupActivityForm = document.getElementById("create-group-activity-form");
const submitGroupActivityBtn = document.getElementById("submit-group-activity");
const batchStatusDiv = document.getElementById("batch-status");

export function initActividadesPage(user) {
  db = getDb(); // Obtenemos la BD para operaciones futuras
  const isTeacher = user && (localStorage.getItem("qs_role") || "").toLowerCase() === "docente";
  
  if (isTeacher) {
    if (mainContent) mainContent.style.display = "block";
    loadStudentsIntoDisplay(); // Cargar estudiantes desde JSON
    setupDisplayEventListeners();
  } else {
    if (mainContent)
      mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
  }
}

// ¡¡CORRECCIÓN PRINCIPAL!! Cargar estudiantes desde students.json
async function loadStudentsIntoDisplay() {
    if (!studentSelect) return;
    studentSelect.disabled = true;
    studentSelect.innerHTML = "<option>Cargando estudiantes...</option>";
    try {
        const response = await fetch('./students.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const students = await response.json();
        
        // Asumimos que el JSON es un array de objetos {id, name, ...}
        studentsList = students.sort((a, b) => a.name.localeCompare(b.name));

        studentSelect.innerHTML = '<option value="">-- Seleccione para ver --</option>';
        studentsList.forEach((student) => {
            const option = document.createElement("option");
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = false;
    } catch (error) {
        console.error("Error cargando la lista de estudiantes desde students.json:", error);
        studentSelect.innerHTML = `<option value="">Error al cargar</option>`;
        // Fallback a Firestore si el JSON falla
        console.log("Intentando cargar desde Firestore como fallback...");
        loadStudentsFromFirestore(); 
    }
}

// Fallback: Cargar desde Firestore si students.json no funciona
async function loadStudentsFromFirestore() {
    try {
        if (!db) {
          console.error("La base de datos no está lista para el fallback de Firestore.");
          return;
        }
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        studentsList.sort((a, b) => a.name.localeCompare(b.name));

        studentSelect.innerHTML = '<option value="">-- Seleccione para ver --</option>';
        studentsList.forEach((student) => {
            const option = document.createElement("option");
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = false;
    } catch (error) {
        console.error("Error definitivo cargando estudiantes desde Firestore:", error);
        studentSelect.innerHTML = `<option value="">Error irrecuperable</option>`;
    }
}

function renderStudentGrades(grades) {
    activitiesContainer.innerHTML = "";
    if (grades.length === 0) {
        activitiesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Este estudiante no tiene calificaciones asignadas.</p>';
        return;
    }
    grades.sort((a,b) => (a.assignedAt?.toDate() || 0) - (b.assignedAt?.toDate() || 0));
    grades.forEach((grade) => {
        const card = document.createElement("div");
        card.className = "activity-card bg-gray-50 p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-3 gap-4 items-center";
        card.innerHTML = `
            <div class="col-span-1 md:col-span-2">
                <p class="font-bold">${grade.activityName}</p>
                <p class="text-sm text-gray-500">ID: ${grade.activityId}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 items-center">
                 <input type="number" step="1" min="0" max="100" value="${grade.grade || 0}"
                       data-grade-id="${grade.id}"
                       class="grade-input-display mt-1 w-full p-2 border rounded-md shadow-sm">
                <button data-action="delete-grade" data-grade-id="${grade.id}" class="bg-red-100 text-red-700 text-xs py-2 px-2 rounded-md hover:bg-red-200">Eliminar</button>
            </div>
        `;
        activitiesContainer.appendChild(card);
    });
}

function loadGradesForStudent(studentId) {
    if (unsubscribeFromGrades) unsubscribeFromGrades(); 
    if (!db) return; // No intentar si la BD no está lista
    const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentId));
    
    unsubscribeFromGrades = onSnapshot(gradesQuery, (snapshot) => {
        const grades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStudentGrades(grades);
    }, (error) => {
        console.error("Error al cargar calificaciones:", error);
        activitiesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar calificaciones.</p>';
    });
}

function setupDisplayEventListeners() {
    if (!studentSelect) return;

    studentSelect.addEventListener("change", () => {
        selectedStudentId = studentSelect.value;
        if (selectedStudentId) {
            const student = studentsList.find((s) => s.id === selectedStudentId);
            studentNameDisplay.textContent = student ? student.name : "N/A";
            activitiesListSection.style.display = "block";
            loadGradesForStudent(selectedStudentId);
        } else {
            activitiesListSection.style.display = "none";
            if(unsubscribeFromGrades) unsubscribeFromGrades();
        }
    });

    activitiesContainer.addEventListener("change", async (e) => {
        if (e.target.classList.contains("grade-input-display")) {
            if (!db) { alert("La base de datos no está lista. Recargue la página."); return; }
            const input = e.target;
            input.disabled = true;
            const gradeId = input.dataset.gradeId;
            const newScore = Number(input.value);
            try {
                const gradeRef = doc(db, "grades", gradeId);
                await updateDoc(gradeRef, { grade: newScore });
            } catch (error) {
                console.error("Error actualizando calificación:", error);
            } finally {
                input.disabled = false;
            }
        }
    });

    activitiesContainer.addEventListener("click", async (e) => {
        const targetButton = e.target.closest('button[data-action="delete-grade"]');
        if (targetButton) {
             if (!db) { alert("La base de datos no está lista. Recargue la página."); return; }
            const gradeId = targetButton.dataset.gradeId;
            if (confirm("¿Eliminar esta calificación?")) {
                try {
                    await deleteDoc(doc(db, "grades", gradeId));
                } catch (error) {
                    console.error("Error eliminando calificación:", error);
                }
            }
        }
    });
    
    if (createGroupActivityForm) {
        createGroupActivityForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!db) { alert("La base de datos no está lista. Recargue la página."); return; }
            if (studentsList.length === 0) return alert("No hay estudiantes cargados.");
            const activityName = document.getElementById("group-activity-name").value.trim();
            if (!activityName) return alert("El nombre de la actividad es requerido.");
            
            submitGroupActivityBtn.disabled = true;
            submitGroupActivityBtn.textContent = "Procesando...";
            batchStatusDiv.textContent = `Asignando a ${studentsList.length} estudiantes...`;
            
            try {
                const batch = writeBatch(db);
                studentsList.forEach((student) => {
                    const gradeRef = doc(collection(db, "grades")); 
                    batch.set(gradeRef, {
                        studentId: student.id,
                        activityName: activityName,
                        activityId: `group-${Date.now()}`,
                        grade: 0,
                        assignedAt: serverTimestamp()
                    });
                });
                await batch.commit();
                batchStatusDiv.textContent = `¡Éxito! Actividad asignada.`;
                createGroupActivityForm.reset();
            } catch (error) {
                console.error("Error en lote:", error);
                batchStatusDiv.textContent = "Error al asignar.";
            } finally {
                submitGroupActivityBtn.disabled = false;
                submitGroupActivityBtn.textContent = "Añadir Actividad a Todos";
                setTimeout(() => { batchStatusDiv.textContent = ""; }, 5000);
            }
        });
    }
}

// Este script se sigue iniciando con onAuth para tener el contexto del usuario
onAuth(initActividadesPage);
