// js/calificaciones-backend.js

import {
  onAuth,
  subscribeMyGradesAndActivities,
  subscribeGrades, // Usaremos esta función centralizada
} from "./firebase.js";

let unsubscribeFromData = null;

/**
 * Función principal que se activa cuando cambia el estado de autenticación.
 */
async function handleAuthStateChanged(user) {
  // Limpiar suscripción anterior para evitar duplicados
  if (unsubscribeFromData) unsubscribeFromData();

  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById("student-activities-container");
  const titleEl = document.getElementById("grades-title");

  if (!user) {
    // Si no hay sesión, ocultar todo
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
    return;
  }

  const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
  gradesContainer.style.display = "block";

  // Cargar la lista maestra de estudiantes desde el JSON
  const response = await fetch('../data/students.json');
  const rosterData = await response.json();
  const rosterMap = new Map(rosterData.students.map(s => [s.id, s.name]));

  if (userRole === "docente") {
    // --- VISTA DEL DOCENTE ---
    titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
    activitiesContainer.style.display = "none";

    // Suscribirse a TODOS los documentos de calificaciones
    unsubscribeFromData = subscribeGrades((allStudentGrades) => {
      // Enriquecer los datos de calificaciones con los nombres del JSON
      const fullStudentData = allStudentGrades.map(grade => ({
        ...grade,
        name: rosterMap.get(grade.id) || grade.name || "Estudiante sin nombre",
      }));
      renderGradesTable(fullStudentData);
    });

  } else {
    // --- VISTA DEL ESTUDIANTE ---
    titleEl.textContent = "Resumen de Mis Calificaciones";
    activitiesContainer.style.display = "block";

    if (user.uid) {
      // Suscribirse solo a MIS calificaciones y actividades
      unsubscribeFromData = subscribeMyGradesAndActivities(
        user,
        ({ grades, activities }) => {
          if (grades) {
            // Enriquecer mis datos con mi nombre del JSON
            const myFullData = {
              ...grades,
              name: rosterMap.get(grades.id) || grades.name || "Estudiante",
            };
            renderGradesTable([myFullData]); // La función espera un array
          } else {
            renderGradesTable([]);
          }
          renderActivitiesForStudent(activities);
        }
      );
    }
  }
}

/**
 * Renderiza la tabla de calificaciones. Funciona tanto para docentes como para estudiantes.
 * @param {Array} studentsData - Un array con los datos de los estudiantes y sus promedios.
 */
function renderGradesTable(studentsData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!studentsData || studentsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay calificaciones para mostrar.</td></tr>';
    return;
  }

  // Ordenar por nombre para consistencia
  studentsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  tbody.innerHTML = studentsData.map((student) => {
      const unit1 = student.unit1?.average ?? student.unit1 ?? 0;
      const unit2 = student.unit2?.average ?? student.unit2 ?? 0;
      const projectFinal = student.projectFinal ?? 0;
      const finalGrade = student.finalGrade ?? 0;
      return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${student.name}</td>
            <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(finalGrade).toFixed(1)}</td>
        </tr>
      `;
    }).join("");
}

/**
 * Renderiza la tabla de actividades detalladas para la vista del estudiante.
 */
function renderActivitiesForStudent(activities) {
  const tbody = document.getElementById("student-activities-body");
  if (!tbody) return;

  if (!activities || activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas.</td></tr>';
    return;
  }
  tbody.innerHTML = activities.map((activity) => `
        <tr class="border-b">
            <td class="py-2 px-4">${activity.activityName || "Sin nombre"}</td>
            <td class="py-2 px-4 capitalize">${activity.type || "N/A"}</td>
            <td class="py-2 px-4 text-center">${(activity.unit || "").replace("unit", "")}</td>
            <td class="py-2 px-4 text-right font-medium">${(activity.score || 0).toFixed(2)}</td>
        </tr>
    `).join("");
}

// Punto de entrada del script
onAuth(handleAuthStateChanged);
