// js/calificaciones-backend.js

import {
  onAuth,
  subscribeGrades,
  subscribeMyGrades,
  subscribeMyActivities,
} from "./firebase.js";
import { calculateUnitGrade, calculateFinalGrade } from "./grade-calculator.js";

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

// Estado local para almacenar los datos del estudiante
let studentGrades = null;
let studentActivities = null;

/**
 * Combina las calificaciones base con las actividades individuales.
 * @param {object} grades - El objeto de calificaciones principal.
 * @param {Array} activities - La lista de actividades individuales.
 * @returns {object} Un nuevo objeto de calificaciones con las actividades agrupadas.
 */
function combineGradesAndActivities(grades, activities) {
  if (!grades) return null;

  // Clonamos para no mutar el estado original
  const combined = JSON.parse(JSON.stringify(grades));

  activities.forEach((activity) => {
    const { unit, type, score, activityName } = activity;
    if (!unit || !type) return;

    if (!combined[unit]) {
      combined[unit] = {};
    }
    if (!combined[unit][type]) {
      combined[unit][type] = {};
    }

    // Si ya existe una entrada y no es un objeto, la convertimos
    if (typeof combined[unit][type] !== "object") {
      const existingScore = combined[unit][type];
      combined[unit][type] = { existing: existingScore };
    }

    // Usamos un nombre de actividad único o un contador como clave
    const key =
      activityName.replace(/\s+/g, "-").toLowerCase() ||
      `item-${Object.keys(combined[unit][type]).length}`;
    combined[unit][type][key] = score;
  });

  return combined;
}

/**
 * Renderiza la vista completa del estudiante cuando todos los datos están disponibles.
 */
function renderStudentView() {
  if (studentGrades && studentActivities) {
    const studentData = studentGrades.length > 0 ? studentGrades[0] : null;
    const combinedData = combineGradesAndActivities(
      studentData,
      studentActivities
    );

    if (combinedData) {
      renderGradesTableForStudent([combinedData]); // La función espera un array
    } else {
      renderGradesTableForStudent([]); // Renderiza la tabla vacía si no hay datos
    }

    renderActivitiesForStudent(studentActivities);
  }
}

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 */
function getSafeScore(gradeData) {
  if (typeof gradeData === "number") return gradeData;
  if (typeof gradeData === "object" && gradeData !== null) {
    // Podría ser un objeto con sub-calificaciones, promediarlas si es necesario.
    // Esta lógica puede expandirse según la estructura de datos.
    return gradeData.score || 0;
  }
  return 0;
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
        // Reiniciar el estado local en cada cambio de autenticación
        studentGrades = null;
        studentActivities = null;

        unsubscribeFromGrades = subscribeMyGrades(user, (grades) => {
          studentGrades = grades;
          renderStudentView();
        });

        unsubscribeFromActivities = subscribeMyActivities(
          user,
          (activities) => {
            studentActivities = activities;
            renderStudentView();
          }
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
    // Limpiar estado al cerrar sesión
    studentGrades = null;
    studentActivities = null;
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
            <td class="py-3 px-4 text-center">${u1.toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${u2.toFixed(2)}</td>
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
            <td class="py-3 px-4 text-center">${calculateUnitGrade(
              myData.unit1
            ).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${calculateUnitGrade(
              myData.unit2
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
