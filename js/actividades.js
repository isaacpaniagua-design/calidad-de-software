// js/actividades.js

// Correcto: Importar helpers locales desde firebase.js
import {
  onAuth,
  getDb,
  subscribeGrades,
  updateStudentGrades, // Aunque no la usaremos directamente, es bueno mantenerla por si acaso
} from "./firebase.js";

// Correcto: Importar funciones del SDK de Firestore directamente desde la URL oficial.
// MODIFICADO: Añadimos getDoc para poder leer la calificación del proyecto final.
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  getDoc, // <--- AÑADIDO
  setDoc, // <--- AÑADIDO para actualizar el documento de calificaciones
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();
let studentsList = [];
let selectedStudentId = null;
let unsubscribeFromActivities = null;

// Referencias al DOM
const studentSelect = document.getElementById("student-select");
const activitiesListSection = document.getElementById(
  "activities-list-section"
);
const studentNameDisplay = document.getElementById("student-name-display");
const activitiesContainer = document.getElementById("activities-container");
const mainContent = document.querySelector(".container.mx-auto");
const createGroupActivityForm = document.getElementById(
  "create-group-activity-form"
);
const submitGroupActivityBtn = document.getElementById("submit-group-activity");
const batchStatusDiv = document.getElementById("batch-status");

// --- LÓGICA DE CÁLCULO Y GUARDADO DE CALIFICACIONES (VERSIÓN MEJORADA) ---
/**
 * Recalcula los promedios de las unidades y la calificación final para un
 * estudiante basándose en todas sus actividades, y actualiza Firestore.
 * @param {string} studentId - El ID del estudiante a recalcular.
 * @param {Array} activities - La lista de actividades del estudiante.
 */
async function recalculateAndSaveGrades(studentId, activities) {
  if (!studentId) return;

  const studentGradesRef = doc(db, "grades", studentId);

  try {
    // 1. Calcular los promedios por unidad
    const gradesByUnit = activities.reduce((acc, activity) => {
      const unit = activity.unit; // ej. "unit1"
      const score = typeof activity.score === 'number' ? activity.score : 0;
      if (!unit) return acc; // Ignorar actividades sin unidad

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
        // Guardamos el objeto completo con el promedio
        unitAverages[unit] = {
          average: gradesByUnit[unit].totalScore / gradesByUnit[unit].count
        };
      }
    }

    // 2. Obtener la calificación del proyecto final directamente del documento
    const studentDoc = await getDoc(studentGradesRef);
    const projectFinalScore = studentDoc.exists() && studentDoc.data().projectFinal ? studentDoc.data().projectFinal : 0;

    // 3. Calcular la calificación final (puedes ajustar esta fórmula)
    const unitAverageValues = Object.values(unitAverages).map(u => u.average);
    const averageOfUnits = unitAverageValues.length > 0 ? unitAverageValues.reduce((sum, avg) => sum + avg, 0) / unitAverageValues.length : 0;

    // Fórmula de ejemplo: 40% promedio de unidades + 60% proyecto final.
    const finalGrade = (averageOfUnits * 0.4) + (projectFinalScore * 0.6);

    // 4. Preparar los datos para actualizar en Firestore
    const dataToUpdate = {
      ...unitAverages, // ej. { unit1: { average: 8.5 }, unit2: { average: 9.0 } }
      finalGrade: finalGrade,
    };

    // 5. Actualizar el documento del estudiante con los nuevos promedios
    await setDoc(studentGradesRef, dataToUpdate, { merge: true });
    console.log(`Promedios para el estudiante ${studentId} actualizados correctamente.`);

  } catch (error) {
    console.error("Error al recalcular los promedios del estudiante:", error);
  }
}


// --- LÓGICA DE LA INTERFAZ (UI) ---

export function initActividadesPage(user) {
  const isTeacher =
    user && (localStorage.getItem("qs_role") || "").toLowerCase() === "docente";

  if (isTeacher) {
    if (mainContent) mainContent.style.display = "block";
    loadStudents();
    setupEventListeners();
  } else {
    if (mainContent)
      mainContent.innerHTML =
        '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
  }
}

function loadStudents() {
  studentSelect.disabled = true;
  studentSelect.innerHTML = "<option>Cargando estudiantes...</option>";

  subscribeGrades((students) => {
    studentsList = students.filter((s) => s.id);
    studentSelect.innerHTML = "";

    if (studentsList.length > 0) {
      studentSelect.innerHTML =
        '<option value="">-- Seleccione un estudiante para calificar --</option>';
      studentsList.forEach((student) => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent =
          student.name || `Estudiante sin nombre (ID: ${student.id})`;
        studentSelect.appendChild(option);
      });
      studentSelect.disabled = false;
    } else {
      studentSelect.innerHTML =
        '<option value="">No hay estudiantes para mostrar.</option>';
    }
  });
}

function renderActivities(activities) {
  activitiesContainer.innerHTML = "";
  if (activities.length === 0) {
    activitiesContainer.innerHTML =
      '<p class="text-center text-gray-500 py-4">Este estudiante no tiene actividades. ¡Crea una para empezar!</p>';
    return;
  }
  activities.forEach((activity) => {
    const card = document.createElement("div");
    card.className =
      "activity-card bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-4 gap-4 items-center";
    card.innerHTML = `
            <div class="col-span-1 md:col-span-2">
                <p class="font-bold text-lg">${activity.activityName}</p>
                <p class="text-sm text-gray-500">Unidad: ${(activity.unit || "").replace(
                  "unit",
                  ""
                )} | Tipo: ${activity.type || "N/A"}</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Calificación (0-10)</label>
                <input type="number" step="0.1" min="0" max="10" value="${
                  activity.score || 0
                }"
                       data-activity-id="${activity.id}"
                       class="score-input mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div class="text-right">
              <button data-action="delete-activity" data-activity-id="${
                activity.id
              }" class="bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-md hover:bg-red-200 transition">Eliminar</button>
            </div>
        `;
    activitiesContainer.appendChild(card);
  });
}

function loadActivitiesForStudent(studentId) {
  if (unsubscribeFromActivities) unsubscribeFromActivities();

  const activitiesRef = collection(db, "grades", studentId, "activities");
  const q = query(activitiesRef, orderBy("activityName"));

  unsubscribeFromActivities = onSnapshot(
    q,
    (snapshot) => {
      const activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderActivities(activities);
      // ¡AQUÍ ESTÁ LA MAGIA!
      // Se llama a la nueva función de recálculo cada vez que hay un cambio.
      recalculateAndSaveGrades(studentId, activities);
    },
    (error) => {
      console.error("Error al cargar actividades:", error);
      activitiesContainer.innerHTML =
        '<p class="text-center text-red-500 py-4">Error al cargar las actividades. Revisa los permisos de la base de datos.</p>';
    }
  );
}

function setupEventListeners() {
  studentSelect.addEventListener("change", () => {
    selectedStudentId = studentSelect.value;
    if (selectedStudentId) {
      const student = studentsList.find((s) => s.id === selectedStudentId);
      studentNameDisplay.textContent = student ? student.name : "Estudiante no encontrado";
      activitiesListSection.style.display = "block";
      loadActivitiesForStudent(selectedStudentId);
    } else {
      activitiesListSection.style.display = "none";
    }
  });

  createGroupActivityForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (studentsList.length === 0) {
      alert("No hay estudiantes cargados para asignar la actividad.");
      return;
    }

    const activityName = document
      .getElementById("group-activity-name")
      .value.trim();
    if (!activityName) {
      alert("El nombre de la actividad no puede estar vacío.");
      return;
    }

    const newActivityData = {
      activityName: activityName,
      unit: document.getElementById("group-activity-unit").value,
      type: document.getElementById("group-activity-type").value,
      score: 0,
    };

    submitGroupActivityBtn.disabled = true;
    submitGroupActivityBtn.textContent = "Procesando...";
    batchStatusDiv.textContent = `Asignando actividad a ${studentsList.length} estudiantes...`;
    batchStatusDiv.className = "text-blue-600";

    try {
      const batch = writeBatch(db);

      studentsList.forEach((student) => {
        const activityRef = doc(
          collection(db, "grades", student.id, "activities")
        );
        batch.set(activityRef, newActivityData);
      });

      await batch.commit();

      batchStatusDiv.textContent = `¡Éxito! La actividad "${activityName}" fue asignada a todos los estudiantes.`;
      batchStatusDiv.className = "text-green-600 font-semibold";
      createGroupActivityForm.reset();
    } catch (error) {
      console.error("Error al crear actividad en lote:", error);
      batchStatusDiv.textContent =
        "Error: No se pudo asignar la actividad. Revisa la consola.";
      batchStatusDiv.className = "text-red-600 font-semibold";
      alert("Ocurrió un error al asignar la actividad en lote.");
    } finally {
      submitGroupActivityBtn.disabled = false;
      submitGroupActivityBtn.textContent = "Añadir Actividad a Todos";
      setTimeout(() => {
        batchStatusDiv.textContent = "";
      }, 5000);
    }
  });

  activitiesContainer.addEventListener("change", async (e) => {
    if (e.target.classList.contains("score-input")) {
      const input = e.target;
      input.disabled = true; // Deshabilitar mientras se guarda
      const activityId = input.dataset.activityId;
      let newScore = parseFloat(input.value);

      if (isNaN(newScore) || newScore < 0) newScore = 0;
      if (newScore > 10) newScore = 10;
      input.value = newScore.toFixed(1);

      try {
        const activityRef = doc(
          db,
          "grades",
          selectedStudentId,
          "activities",
          activityId
        );
        await updateDoc(activityRef, { score: newScore });
        // No es necesario llamar a recalcular aquí, onSnapshot lo hará por nosotros.
      } catch (error) {
          console.error("Error al actualizar la calificación:", error);
          alert("No se pudo guardar la calificación.");
      } finally {
          input.disabled = false; // Rehabilitar el input
      }
    }
  });

  activitiesContainer.addEventListener("click", async (e) => {
    const targetButton = e.target.closest(
      'button[data-action="delete-activity"]'
    );
    if (targetButton) {
      const activityId = targetButton.dataset.activityId;
      if (
        confirm(
          `¿Estás seguro de que quieres eliminar esta actividad? Esta acción no se puede deshacer.`
        )
      ) {
        try {
          const activityRef = doc(
            db,
            "grades",
            selectedStudentId,
            "activities",
            activityId
          );
          await deleteDoc(activityRef);
          // onSnapshot se encargará de actualizar la UI y los promedios.
        } catch (error) {
          console.error("Error al eliminar actividad:", error);
          alert("No se pudo eliminar la actividad.");
        }
      }
    }
  });
}

// --- INICIALIZACIÓN ---
onAuth((user) => {
  initActividadesPage(user);
});
