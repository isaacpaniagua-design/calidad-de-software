// js/calificaciones-backend.js

import {
  onAuth,
  subscribeMyGradesAndActivities,
  subscribeGrades,
} from "./firebase.js";

let unsubscribeFromData = null;

async function handleAuthStateChanged(user) {
  if (unsubscribeFromData) unsubscribeFromData();

  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById("student-activities-container");
  const titleEl = document.getElementById("grades-title");

  if (!user) {
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
    return;
  }

  const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
  gradesContainer.style.display = "block";

  // ✅ *** CORRECCIÓN DE RUTA ***
  const response = await fetch('./data/students.json');
  const rosterData = await response.json();
  const rosterMap = new Map(rosterData.students.map(s => [s.id, s.name]));

  if (userRole === "docente") {
    titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
    activitiesContainer.style.display = "none";

    unsubscribeFromData = subscribeGrades((allStudentGrades) => {
      const fullStudentData = allStudentGrades.map(grade => ({
        ...grade,
        name: rosterMap.get(grade.id) || grade.name || "Estudiante sin nombre",
      }));
      renderGradesTable(fullStudentData);
    });

  } else {
    titleEl.textContent = "Resumen de Mis Calificaciones";
    activitiesContainer.style.display = "block";

    if (user.uid) {
      unsubscribeFromData = subscribeMyGradesAndActivities(
        user,
        ({ grades, activities }) => {
          if (grades) {
            const myFullData = {
              ...grades,
              name: rosterMap.get(grades.id) || grades.name || "Estudiante",
            };
            renderGradesTable([myFullData]);
          } else {
            renderGradesTable([]);
          }
          renderActivitiesForStudent(activities);
        }
      );
    }
  }
}

function renderGradesTable(studentsData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!studentsData || studentsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay calificaciones para mostrar.</td></tr>';
    return;
  }
  
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

onAuth(handleAuthStateChanged);
