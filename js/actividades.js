// js/actividades.js

import {
  onAuth,
  getDb,
  subscribeGrades, // Usaremos esta para obtener la lista inicial
} from "./firebase.js";

import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  getDoc,

  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();
let studentsList = []; // Lista de estudiantes del curso
let selectedStudentId = null;
let unsubscribeFromActivities = null;

// Referencias al DOM
const studentSelect = document.getElementById("student-select");
const activitiesListSection = document.getElementById("activities-list-section");
const studentNameDisplay = document.getElementById("student-name-display");
const activitiesContainer = document.getElementById("activities-container");
const mainContent = document.querySelector(".container.mx-auto");
const createGroupActivityForm = document.getElementById("create-group-activity-form");
const submitGroupActivityBtn = document.getElementById("submit-group-activity");
const batchStatusDiv = document.getElementById("batch-status");

/**
 * Función central para recalcular promedios y guardarlos en Firestore.
 * Se activa cada vez que una actividad cambia.
 */
async function recalculateAndSaveGrades(studentId, activities) {
  if (!studentId) return;

  const studentGradesRef = doc(db, "grades", studentId);

  try {
    // 1. Calcular promedios por unidad
    const gradesByUnit = activities.reduce((acc, activity) => {
      const unit = activity.unit;
      const score = typeof activity.score === 'number' ? activity.score : 0;
      if (!unit) return acc;

      if (!acc[unit]) {
        acc[unit] = { totalScore: 0, count: 0 };
      }
      acc[unit].totalScore += score;
      acc[unit].count++;
      return acc;
    }, {});

    const unitAverages = {};
    for (const unit in gradesByUnit) {
      if (gradesByUnit[unit].count > 0) {
        unitAverages[unit] = {
          average: gradesByUnit[unit].totalScore / gradesByUnit[unit].count
        };
      }
    }

    // 2. Obtener calificación del proyecto final (si ya existe)
    const studentDoc = await getDoc(studentGradesRef);
    const projectFinalScore = studentDoc.exists() && studentDoc.data().projectFinal ? studentDoc.data().projectFinal : 0;

    // 3. Calcular calificación final (40% unidades + 60% proyecto)
    const unitAverageValues = Object.values(unitAverages).map(u => u.average);
    const averageOfUnits = unitAverageValues.length > 0 ? unitAverageValues.reduce((sum, avg) => sum + avg, 0) / unitAverageValues.length : 0;
    const finalGrade = (averageOfUnits * 0.4) + (projectFinalScore * 0.6);

    // 4. Preparar datos para actualizar
    const dataToUpdate = {
      ...unitAverages,
      finalGrade: finalGrade,
    };

    // 5. Actualizar Firestore
    await setDoc(studentGradesRef, dataToUpdate, { merge: true });
    console.log(`Promedios para ${studentId} actualizados.`);

  } catch (error) {
    console.error("Error recalculando promedios:", error);
  }
}

// --- LÓGICA DE LA INTERFAZ (UI) ---

export function initActividadesPage(user) {
  const isTeacher = user && (localStorage.getItem("qs_role") || "").toLowerCase() === "docente";

  if (isTeacher) {
    if (mainContent) mainContent.style.display = "block";
    loadStudents();
    setupEventListeners();
  } else {
    if (mainContent)
      mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
  }
}

/**
 * Carga la lista de estudiantes desde students.json y la cruza con los datos de 'grades'.
 */
async function loadStudents() {
  studentSelect.disabled = true;
  studentSelect.innerHTML = "<option>Cargando estudiantes...</option>";

  try {
    // Primero, carga la lista "maestra" desde el JSON
    const response = await fetch('../data/students.json');
    const rosterData = await response.json();
    const rosterStudents = rosterData.students || [];

    // Luego, usa subscribeGrades para saber quiénes ya tienen registro en la BD
    subscribeGrades((gradedStudents) => {
      // Mapea los estudiantes de la lista maestra para fácil acceso
      const rosterMap = new Map(rosterStudents.map(s => [s.id, s]));

      studentsList = gradedStudents.map(gs => ({
        ...gs, // Datos de la BD (calificaciones)
        name: rosterMap.get(gs.id)?.name || gs.name || `Estudiante (ID: ${gs.id})` // Nombre del JSON, o de respaldo
      }));
      
      studentsList.sort((a, b) => a.name.localeCompare(b.name));

      studentSelect.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
      studentsList.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = student.name;
        studentSelect.appendChild(option);
      });
      studentSelect.disabled = false;
    });
  } catch (error) {
    console.error("Error cargando la lista de estudiantes:", error);
    studentSelect.innerHTML = '<option value="">Error al cargar estudiantes</option>';
  }
}

function renderActivities(activities) {
    activitiesContainer.innerHTML = "";
    if (activities.length === 0) {
        activitiesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Este estudiante no tiene actividades.</p>';
        return;
    }
    activities.forEach((activity) => {
        const card = document.createElement("div");
        card.className = "activity-card bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-4 gap-4 items-center";
        card.innerHTML = `
            <div class="col-span-1 md:col-span-2">
                <p class="font-bold text-lg">${activity.activityName}</p>
                <p class="text-sm text-gray-500">Unidad: ${(activity.unit || "").replace("unit","")} | Tipo: ${activity.type || "N/A"}</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Calificación (0-10)</label>
                <input type="number" step="0.1" min="0" max="10" value="${activity.score || 0}"
                       data-activity-id="${activity.id}"
                       class="score-input mt-1 w-full p-2 border rounded-md shadow-sm">
            </div>
            <div class="text-right">
              <button data-action="delete-activity" data-activity-id="${activity.id}" class="bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-md hover:bg-red-200">Eliminar</button>
            </div>
        `;
        activitiesContainer.appendChild(card);
    });
}

function loadActivitiesForStudent(studentId) {
    if (unsubscribeFromActivities) unsubscribeFromActivities();

    const activitiesRef = collection(db, "grades", studentId, "activities");
    const q = query(activitiesRef, orderBy("activityName"));

    unsubscribeFromActivities = onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderActivities(activities);
        recalculateAndSaveGrades(studentId, activities); // Recalcula con cada cambio
    }, (error) => {
        console.error("Error al cargar actividades:", error);
        activitiesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar actividades.</p>';
    });
}

function setupEventListeners() {
    studentSelect.addEventListener("change", () => {
        selectedStudentId = studentSelect.value;
        if (selectedStudentId) {
            const student = studentsList.find((s) => s.id === selectedStudentId);
            studentNameDisplay.textContent = student ? student.name : "N/A";
            activitiesListSection.style.display = "block";
            loadActivitiesForStudent(selectedStudentId);
        } else {
            activitiesListSection.style.display = "none";
        }
    });

    createGroupActivityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (studentsList.length === 0) return alert("No hay estudiantes cargados.");

        const activityName = document.getElementById("group-activity-name").value.trim();
        if (!activityName) return alert("El nombre de la actividad es requerido.");

        const newActivityData = {
            activityName,
            unit: document.getElementById("group-activity-unit").value,
            type: document.getElementById("group-activity-type").value,
            score: 0,
        };

        submitGroupActivityBtn.disabled = true;
        submitGroupActivityBtn.textContent = "Procesando...";
        batchStatusDiv.textContent = `Asignando a ${studentsList.length} estudiantes...`;

        try {
            const batch = writeBatch(db);
            studentsList.forEach((student) => {
                const activityRef = doc(collection(db, "grades", student.id, "activities"));
                batch.set(activityRef, newActivityData);
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

    activitiesContainer.addEventListener("change", async (e) => {
        if (e.target.classList.contains("score-input")) {
            const input = e.target;
            input.disabled = true;
            const activityId = input.dataset.activityId;
            let newScore = parseFloat(input.value);

            if (isNaN(newScore) || newScore < 0) newScore = 0;
            if (newScore > 10) newScore = 10;
            input.value = newScore.toFixed(1);

            try {
                const activityRef = doc(db, "grades", selectedStudentId, "activities", activityId);
                await updateDoc(activityRef, { score: newScore });
            } catch (error) {
                console.error("Error actualizando calificación:", error);
            } finally {
                input.disabled = false;
            }
        }
    });

    activitiesContainer.addEventListener("click", async (e) => {
        const targetButton = e.target.closest('button[data-action="delete-activity"]');
        if (targetButton) {
            const activityId = targetButton.dataset.activityId;
            if (confirm("¿Eliminar esta actividad?")) {
                try {
                    const activityRef = doc(db, "grades", selectedStudentId, "activities", activityId);
                    await deleteDoc(activityRef);
                } catch (error) {
                    console.error("Error eliminando actividad:", error);
                }
            }
        }
    });
}

// --- INICIALIZACIÓN ---
onAuth(initActividadesPage);
