// js/calificaciones-backend.js

import { onAuth } from "./firebase.js";

let unsubscribeFromData = null;

async function handleAuthStateChanged(user) {
  if (unsubscribeFromData) unsubscribeFromData();

  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById(
    "student-activities-container"
  );
  const titleEl = document.getElementById("grades-title");

  if (!user) {
    if (gradesContainer) gradesContainer.style.display = "none";
    if (activitiesContainer) activitiesContainer.style.display = "none";
    return;
  }

  const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
  if (gradesContainer) gradesContainer.style.display = "block";

  const response = await fetch("./data/students.json");
  const rosterData = await response.json();
  const rosterMap = new Map(rosterData.students.map((s) => [s.id, s.name]));

  // Importar Firestore dinámicamente para evitar dependencias rotas
  const { getDb } = await import("./firebase.js");
  const db = getDb();
  const { collection, getDocs, query, where } = await import(
    "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"
  );

  if (userRole === "docente") {
    if (titleEl)
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
    if (activitiesContainer) activitiesContainer.style.display = "none";

    // Obtener todas las calificaciones
    const gradesSnap = await getDocs(collection(db, "grades"));
    const allStudentGrades = [];
    gradesSnap.forEach((doc) => {
      const grade = doc.data();
      allStudentGrades.push({
        ...grade,
        name:
          rosterMap.get(grade.authUid) || grade.name || "Estudiante sin nombre",
      });
    });
    renderGradesTable(allStudentGrades);
    unsubscribeFromData = () => {};
  } else {
    if (titleEl) titleEl.textContent = "Resumen de Mis Calificaciones";
    if (activitiesContainer) activitiesContainer.style.display = "block";

    // Obtener solo las calificaciones del estudiante actual
    if (user.uid) {
      const gradesQuery = query(
        collection(db, "grades"),
        where("authUid", "==", user.uid)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const myGrades = [];
      gradesSnap.forEach((doc) => {
        const grade = doc.data();
        myGrades.push({
          ...grade,
          name: rosterMap.get(grade.authUid) || grade.name || "Estudiante",
        });
      });
      renderGradesTable(myGrades);
      // Si tienes actividades, aquí podrías cargarlas y llamar a renderActivitiesForStudent
    }
  }
}

function renderGradesTable(studentsData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!studentsData || studentsData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4">No hay calificaciones para mostrar.</td></tr>';
    return;
  }

  studentsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  tbody.innerHTML = studentsData
    .map((student) => {
      const unit1 = student.unit1?.average ?? student.unit1 ?? 0;
      const unit2 = student.unit2?.average ?? student.unit2 ?? 0;
      const projectFinal = student.projectFinal ?? 0;
      const finalGrade = student.finalGrade ?? 0;
      return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${student.name}</td>
            <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(
              2
            )}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(
              finalGrade
            ).toFixed(1)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderActivitiesForStudent(activities) {
  const tbody = document.getElementById("student-activities-body");
  if (!tbody) return;
  if (!activities || activities.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas.</td></tr>';
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

onAuth(handleAuthStateChanged);
