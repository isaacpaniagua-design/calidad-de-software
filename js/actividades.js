// js/actividades.js

import {
  onFirebaseReady, // CAMBIO: Usamos el nuevo inicializador
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

let db; // Se inicializará de forma segura
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

function initActividadesPage(user) {
  const isTeacher = user && (localStorage.getItem("qs_role") || "").toLowerCase() === "docente";
  
  if (isTeacher) {
    db = getDb(); // Ahora es seguro obtener la instancia de la BD
    if (!db) {
        console.error("Error crítico: La base de datos no está disponible.");
        if(mainContent) mainContent.innerHTML = '<p class="text-red-500 text-center">Error de conexión con la base de datos.</p>';
        return;
    }
    if (mainContent) mainContent.style.display = "block";
    loadStudentsIntoDisplay();
    setupDisplayEventListeners();
  } else {
    if (mainContent)
      mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
  }
}

async function loadStudentsIntoDisplay() {
    if (!studentSelect) return;
    studentSelect.disabled = true;
    studentSelect.innerHTML = "<option>Cargando estudiantes...</option>";
    try {
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
        console.error("Error cargando la lista de estudiantes para visualización:", error);
        studentSelect.innerHTML = `<option value="">Error al cargar</option>`;
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
            if (studentsList.length === 0) {
                batchStatusDiv.textContent = "No hay estudiantes cargados para asignar la actividad.";
                return;
            }
            const activityName = document.getElementById("group-activity-name").value.trim();
            if (!activityName) {
                batchStatusDiv.textContent = "El nombre de la actividad es requerido.";
                return;
            }
            
            submitGroupActivityBtn.disabled = true;
            submitGroupActivityBtn.textContent = "Procesando...";
            batchStatusDiv.textContent = `Asignando a ${studentsList.length} estudiantes...`;
            
            try {
                const batch = writeBatch(db);
                const activityId = `group-${Date.now()}`;
                const newActivityData = {
                    activityName,
                    activityId,
                    unit: document.getElementById("group-activity-unit").value,
                    type: document.getElementById("group-activity-type").value,
                    grade: 0,
                    assignedAt: serverTimestamp()
                };

                studentsList.forEach((student) => {
                    const gradeRef = doc(collection(db, "grades")); 
                    batch.set(gradeRef, {
                        ...newActivityData,
                        studentId: student.id,
                    });
                });
                await batch.commit();
                batchStatusDiv.textContent = "¡Éxito! Actividad asignada a todos los estudiantes.";
                createGroupActivityForm.reset();
            } catch (error) {
                console.error("Error en lote:", error);
                batchStatusDiv.textContent = "Error al asignar la actividad en grupo.";
            } finally {
                submitGroupActivityBtn.disabled = false;
                submitGroupActivityBtn.textContent = "Añadir Actividad a Todos";
                setTimeout(() => { batchStatusDiv.textContent = ""; }, 5000);
            }
        });
    }
}

// CAMBIO: Usar onFirebaseReady para asegurar que Firebase esté inicializado
onFirebaseReady(initActividadesPage);
