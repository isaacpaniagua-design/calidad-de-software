// =================================================================================================
// ARCHIVO: js/calificaciones-backend.js
// VERSIÓN COMPLETA Y REVISADA
// =================================================================================================

// --- Importaciones de Módulos ES6 ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { auth } from "./firebase-config.js";
import {
  subscribeGrades,
  subscribeAllActivities,
  subscribeMyGradesAndActivities,
} from "./firebase.js";
import { calculateWeightedAverage } from "./grade-calculator.js";

// --- Almacenamiento de Datos en Memoria ---
// Variables globales para mantener el estado de los datos recibidos de Firestore.
let studentGrades = null;
let studentActivities = null;
let allStudentsData = null;
let allActivitiesData = null;

// Variables para gestionar las suscripciones en tiempo real y evitar fugas de memoria.
let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

// =================================================================================================
// FUNCIÓN PRINCIPAL DE CONTROL
// =================================================================================================

/**
 * Maneja los cambios de estado de autenticación para renderizar la vista correcta.
 * Este es el "cerebro" que decide qué datos cargar basándose en el rol del usuario.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
function handleAuthStateChanged(user) {
  // 1. Limpieza de suscripciones anteriores
  if (unsubscribeFromGrades) unsubscribeFromGrades();
  if (unsubscribeFromActivities) unsubscribeFromActivities();

  // 2. Obtención de Elementos del DOM
  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById("student-activities-container");
  const titleEl = document.getElementById("grades-title");

  if (!gradesContainer || !titleEl || !activitiesContainer) {
    console.error("Error crítico: Faltan elementos clave del HTML en la página de calificaciones.");
    return;
  }

  // 3. Manejador de errores centralizado
  const handleSubscriptionError = (error) => {
    console.error("Error crítico de Firestore:", error);
    // Este es el error que probablemente ves. Te indica que necesitas crear un índice en Firestore.
    // Busca en la consola de tu navegador el link para crearlo automáticamente.
    renderError("No se pudieron cargar los datos. Es muy probable que falte un índice en la base de datos. Revisa la consola del navegador para encontrar un enlace para crearlo.");
  };

  if (user) {
    // 4. Lógica de Usuario Autenticado
    const userRole = localStorage.getItem("qs_role");
    gradesContainer.style.display = "block";

    if (userRole === "docente") {
      // --- VISTA DEL DOCENTE ---
      console.log("Rol DOCENTE detectado. Iniciando carga del panel de calificaciones.");
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
      activitiesContainer.style.display = "none";
      
      // Resetea los datos y muestra el estado "Cargando..."
      allStudentsData = null;
      allActivitiesData = null;
      renderTeacherView(); 

      // Suscripción a los datos de TODOS los estudiantes
      unsubscribeFromGrades = subscribeGrades(students => {
        allStudentsData = students;
        renderTeacherView();
      }, handleSubscriptionError);

      // Suscripción a TODAS las actividades (esta es la que necesita el índice)
      unsubscribeFromActivities = subscribeAllActivities(activities => {
        allActivitiesData = activities;
        renderTeacherView();
      }, handleSubscriptionError);

    } else {
      // --- VISTA DEL ESTUDIANTE ---
      titleEl.textContent = "Resumen de Mis Calificaciones";
      activitiesContainer.style.display = "block";
      unsubscribeFromGrades = subscribeMyGradesAndActivities(user, {
        next: ({ grades, activities }) => {
          studentGrades = grades ? [grades] : [];
          studentActivities = activities;
          renderStudentView();
        },
        error: handleSubscriptionError
      });
    }
  } else {
    // 5. Usuario no autenticado
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
  }
}

// =================================================================================================
// FUNCIONES DE RENDERIZADO (UI)
// =================================================================================================

/**
 * Renderiza la vista de la tabla para el docente.
 */
function renderTeacherView() {
    const tableBody = document.querySelector("#grades-table tbody");
    if (!tableBody) return;

    // Muestra "Cargando..." mientras no lleguen AMBOS conjuntos de datos.
    if (allStudentsData === null || allActivitiesData === null) {
        tableBody.innerHTML = '<tr><td colspan="10">Cargando datos de estudiantes y actividades...</td></tr>';
        return;
    }

    if (allStudentsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">No hay estudiantes registrados para mostrar.</td></tr>';
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

/**
 * Renderiza la vista de la tabla para el estudiante.
 */
function renderStudentView() {
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

/**
 * Muestra un mensaje de error genérico en la tabla.
 * @param {string} message - El mensaje a mostrar.
 */
function renderError(message) {
  const tableBody = document.querySelector("#grades-table tbody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="10" class="error-message">${message}</td></tr>`;
  }
}

// =================================================================================================
// INICIALIZACIÓN
// =================================================================================================

// El punto de entrada: escucha los cambios de autenticación y arranca la lógica.
onAuthStateChanged(auth, handleAuthStateChanged);
