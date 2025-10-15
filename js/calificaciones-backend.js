// =================================================================================================
// ARCHIVO: js/calificaciones-backend.js
// VERSIÓN FINAL CON LA NUEVA LÓGICA SECUENCIAL
// =================================================================================================

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { auth } from "./firebase-config.js";
import {
  subscribeGrades,
  subscribeMyGradesAndActivities,
  fetchAllActivitiesByStudent, // Importamos la NUEVA función
} from "./firebase.js";
import { calculateWeightedAverage } from "./grade-calculator.js";

// Variables globales para el estado.
let allStudentsData = null;
let allActivitiesData = null;
let unsubscribeFromGrades = null;

function handleAuthStateChanged(user) {
  if (unsubscribeFromGrades) unsubscribeFromGrades();

  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById("student-activities-container");
  const titleEl = document.getElementById("grades-title");

  if (!gradesContainer || !titleEl || !activitiesContainer) {
    console.error("Error crítico: Faltan elementos del HTML.");
    return;
  }
  
  const handleSubscriptionError = (error) => {
    console.error("Error crítico de Firestore:", error);
    renderError("No se pudieron cargar los datos. Revisa los permisos en las reglas de seguridad.");
  };

  if (user) {
    const userRole = localStorage.getItem("qs_role");
    gradesContainer.style.display = "block";

    if (userRole === "docente") {
      // --- VISTA DEL DOCENTE (NUEVA LÓGICA) ---
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
      activitiesContainer.style.display = "none";
      
      allStudentsData = null;
      allActivitiesData = null;
      renderTeacherView(); // Muestra "Cargando..."

      // 1. Nos suscribimos a la lista de estudiantes.
      unsubscribeFromGrades = subscribeGrades(async (students) => {
        allStudentsData = students;
        
        // 2. UNA VEZ que tenemos los estudiantes, usamos la nueva función para buscar sus actividades.
        //    Esto evita por completo el 'collectionGroup' y el problema del índice.
        allActivitiesData = await fetchAllActivitiesByStudent(students);
        
        // 3. Con AMBOS datos en mano, renderizamos la tabla final.
        renderTeacherView();
      }, handleSubscriptionError);

    } else {
      // --- VISTA DEL ESTUDIANTE (SIN CAMBIOS) ---
      titleEl.textContent = "Resumen de Mis Calificaciones";
      activitiesContainer.style.display = "block";
      unsubscribeFromGrades = subscribeMyGradesAndActivities(user, {
        next: ({ grades, activities }) => {
          const studentGrades = grades ? [grades] : [];
          const studentActivities = activities;
          renderStudentView(studentGrades, studentActivities);
        },
        error: handleSubscriptionError
      });
    }
  } else {
    gradesContainer.style.display = "none";
  }
}

// --- FUNCIONES DE RENDERIZADO (SIN CAMBIOS) ---
function renderTeacherView() {
    const tableBody = document.querySelector("#grades-table tbody");
    if (!tableBody) return;
    if (allStudentsData === null || allActivitiesData === null) {
        tableBody.innerHTML = '<tr><td colspan="10">Cargando datos...</td></tr>';
        return;
    }
    if (allStudentsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">No hay estudiantes para mostrar.</td></tr>';
        return;
    }
    allStudentsData.sort((a, b) => a.name.localeCompare(b.name));
    let tableHTML = "";
    allStudentsData.forEach(student => {
        const studentActivities = allActivitiesData[student.id] || [];
        const { p1, p2, p3, project, final } = calculateWeightedAverage(student, studentActivities);
        const status = final >= 70 ? 'Aprobado' : 'No Aprobado';
        tableHTML += `
            <tr>
                <td>${student.name || 'N/A'}</td>
                <td>${student.id || 'N/A'}</td>
                <td>${p1.toFixed(2)}</td>
                <td>${p2.toFixed(2)}</td>
                <td>${p3.toFixed(2)}</td>
                <td>${project.toFixed(2)}</td>
                <td>${final.toFixed(2)}</td>
                <td>${student.absences || 0}</td>
                <td>${student.delays || 0}</td>
                <td class="${status.replace(' ', '-').toLowerCase()}">${status}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = tableHTML;
}

function renderStudentView(studentGrades, studentActivities) {
  const tableBody = document.querySelector("#grades-table tbody");
  if (!tableBody) return;
  if (!studentGrades || studentGrades.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10">Aún no tienes calificaciones registradas.</td></tr>';
    return;
  }
  const grades = studentGrades[0];
  const { p1, p2, p3, project, final } = calculateWeightedAverage(grades, studentActivities);
  tableBody.innerHTML = `
    <tr>
      <td>${grades.name || 'N/A'}</td>
      <td>${grades.id || 'N/A'}</td>
      <td>${p1.toFixed(2)}</td>
      <td>${p2.toFixed(2)}</td>
      <td>${p3.toFixed(2)}</td>
      <td>${project.toFixed(2)}</td>
      <td>${final.toFixed(2)}</td>
      <td>${grades.absences || 0}</td>
      <td>${grades.delays || 0}</td>
      <td><strong>${final >= 70 ? 'Aprobado' : 'No Aprobado'}</strong></td>
    </tr>
  `;
}

function renderError(message) {
  const tableBody = document.querySelector("#grades-table tbody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="10" class="error-message">${message}</td></tr>`;
  }
}

onAuthStateChanged(auth, handleAuthStateChanged);
