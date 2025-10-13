// js/calificaciones-backend.js

import {
  onAuth,
  subscribeGrades,
  subscribeMyGrades,
  subscribeMyActivities,
} from "./firebase.js";

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 */
function getSafeScore(gradeData) {
  let score = 0;
  if (typeof gradeData === "number") {
    score = gradeData;
  } else if (
    typeof gradeData === "object" &&
    gradeData !== null &&
    typeof gradeData.score === "number"
  ) {
    score = gradeData.score;
  }
  return !isNaN(score) ? parseFloat(score.toFixed(2)) : 0;
}

const unitWeights = {
  participation: 0.1,
  assignments: 0.25,
  classwork: 0.25,
  exam: 0.4,
};

function calculateUnitGrade(unit) {
  if (!unit || typeof unit !== "object") return 0;
  let total = 0;
  for (const activityType in unitWeights) {
    const gradeValue = unit[activityType];
    if (gradeValue === undefined) continue;

    let categoryScore = 0;
    if (typeof gradeValue === "number") {
      categoryScore = gradeValue;
    } else if (typeof gradeValue === "object" && gradeValue !== null) {
      const scores = Object.values(gradeValue).filter(
        (v) => typeof v === "number"
      );
      if (scores.length > 0) {
        categoryScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    if (categoryScore > 0) {
      total += categoryScore * unitWeights[activityType];
    }
  }
  return total;
}

function calculateFinalGrade(grades) {
  if (!grades) return 0;

  const finalWeights = {
    unit1: 0.2,
    unit2: 0.2,
    unit3: 0.2,
    projectFinal: 0.4,
  };

  const u1 = calculateUnitGrade(grades.unit1);
  const u2 = calculateUnitGrade(grades.unit2);
  const u3 = calculateUnitGrade(grades.unit3);
  const pf = grades.projectFinal || 0;

  const finalGrade =
    u1 * finalWeights.unit1 * 10 +
    u2 * finalWeights.unit2 * 10 +
    u3 * finalWeights.unit3 * 10 +
    pf * finalWeights.projectFinal;

  return Math.round(finalGrade);
}

/**
 * Maneja los cambios de estado de autenticación para renderizar la vista correcta.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
function handleAuthStateChanged(user) {
  // Limpiar suscripciones anteriores para evitar fugas de memoria.
  if (unsubscribeFromGrades) unsubscribeFromGrades();
  if (unsubscribeFromActivities) unsubscribeFromActivities();

  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById(
    "student-activities-container"
  );
  const titleEl = document.getElementById("grades-title");

  if (!gradesContainer || !titleEl || !activitiesContainer) {
    console.error("Error crítico: Faltan elementos clave del HTML.");
    return;
  }

  if (user) {
    // CORRECCIÓN CLAVE: Convertimos el rol a minúsculas para una comparación segura.
    const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
    gradesContainer.style.display = "block";

    if (userRole === "docente") {
      // --- VISTA DEL DOCENTE ---
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
      activitiesContainer.style.display = "none";
      // Llama a la función correcta para el docente.
      unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);
    } else {
      // Asumimos rol de estudiante
      // --- VISTA DEL ESTUDIANTE ---
      titleEl.textContent = "Resumen de Mis Calificaciones";
      activitiesContainer.style.display = "block";

      if (user.uid) {
        unsubscribeFromGrades = subscribeMyGrades(
          user,
          renderGradesTableForStudent
        );
        unsubscribeFromActivities = subscribeMyActivities(
          user,
          renderActivitiesForStudent
        );
      } else {
        renderError(
          "No se pudo identificar tu sesión. Por favor, inicia sesión de nuevo."
        );
      }
    }
  } else {
    // Ocultar todo si no hay sesión
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
  }
}

function renderGradesTableForTeacher(studentsData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!studentsData || studentsData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4">No hay estudiantes con calificaciones para mostrar.</td></tr>';
    return;
  }

  tbody.innerHTML = studentsData
    .map((student) => {
      const u1 = calculateUnitGrade(student.unit1);
      const u2 = calculateUnitGrade(student.unit2);
      const finalGrade = calculateFinalGrade(student);

      return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${
              student.name || "Sin nombre"
            }</td>
            <td class="py-3 px-4 text-center">${Math.round(u1 * 10)}</td>
            <td class="py-3 px-4 text-center">${Math.round(u2 * 10)}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(
              student.projectFinal
            )}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${finalGrade}</td>
        </tr>
    `;
    })
    .join("");
}

function renderGradesTableForStudent(myGradesData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!myGradesData || myGradesData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4">Aún no tienes un resumen de calificaciones.</td></tr>';
    return;
  }
  const myData = myGradesData[0];
  const finalGrade = calculateFinalGrade(myData);
  tbody.innerHTML = `
        <tr>
            <td class="py-3 px-4 font-medium text-gray-800">${
              myData.name || "Estudiante"
            }</td>
            <td class="py-3 px-4 text-center">${(
              calculateUnitGrade(myData.unit1) * 10
            ).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(
              calculateUnitGrade(myData.unit2) * 10
            ).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(
              myData.projectFinal || 0
            ).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${finalGrade}</td>
        </tr>
    `;
}

function renderActivitiesForStudent(activities) {
  const tbody = document.getElementById("student-activities-body");
  if (!tbody) return;

  if (!activities || activities.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas para mostrar.</td></tr>';
    return;
  }
  tbody.innerHTML = activities
    .map(
      (activity) => `
        <tr class="border-b">
            <td class="py-2 px-4">${activity.activityName || "Sin nombre"}</td>
            <td class="py-2 px-4 capitalize">${activity.type || "N/A"}</td>
            <td class="py-2 px-4 text-center">${(activity.unit || "").replace(
              "unit",
              ""
            )}</td>
            <td class="py-2 px-4 text-right font-medium">${(
              activity.score || 0
            ).toFixed(2)}</td>
        </tr>
    `
    )
    .join("");
}

function renderError(message) {
  const tbody = document.getElementById("grades-table-body");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">${message}</td></tr>`;
}

// Punto de entrada del script
onAuth(handleAuthStateChanged);
