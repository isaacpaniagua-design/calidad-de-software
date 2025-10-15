// =================================================================================================
// ARCHIVO: js/calificaciones-backend.js
// VERSIÓN CORREGIDA Y FINAL
// =================================================================================================

// --- Importaciones de Módulos ES6 ---
// Se importan las funciones necesarias de Firebase y de los archivos locales del proyecto.
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

// Variables para gestionar las suscripciones en tiempo real de Firestore.
// Es crucial anularlas (unsubscribe) cuando el usuario sale o cambia de vista para evitar fugas de memoria.
let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

// =================================================================================================
// FUNCIÓN PRINCIPAL DE CONTROL (EL "CEREBRO" DEL SCRIPT)
// =================================================================================================

/**
 * Maneja los cambios de estado de autenticación (inicio/cierre de sesión) para renderizar la vista correcta.
 * Esta función es el punto central de control que decide qué datos cargar basándose en el rol del usuario.
 *
 * @param {object|null} user - El objeto de usuario proporcionado por Firebase Auth.
 */
function handleAuthStateChanged(user) {
  // --- Limpieza ---
  // Antes de hacer nada, se cancelan las suscripciones anteriores para evitar que se ejecuten
  // múltiples escuchas de datos simultáneamente, lo que consumiría recursos y podría causar errores.
  if (unsubscribeFromGrades) unsubscribeFromGrades();
  if (unsubscribeFromActivities) unsubscribeFromActivities();

  // --- Obtención de Elementos del DOM ---
  // Se obtienen las referencias a los contenedores principales de la página.
  const gradesContainer = document.getElementById("grades-table-container");
  const activitiesContainer = document.getElementById("student-activities-container");
  const titleEl = document.getElementById("grades-title");

  // Verificación de seguridad: si los elementos no existen, se detiene la ejecución para prevenir errores.
  if (!gradesContainer || !titleEl || !activitiesContainer) {
    console.error("Error crítico: Faltan elementos clave del HTML en calificaciones.html.");
    return;
  }

  // --- Manejador de Errores Centralizado ---
  // Esta función se llamará si alguna de las suscripciones a Firestore falla (ej. por permisos denegados).
  const handleSubscriptionError = (error) => {
    console.error("Error de permisos o de suscripción a Firestore:", error);
    renderError("No se pudieron cargar los datos. Revisa tu conexión o contacta al soporte.");
  };

  if (user) {
    // --- LÓGICA DE USUARIO AUTENTICADO ---
    // Obtenemos el rol del usuario que se guardó en localStorage durante el inicio de sesión.
    const userRole = localStorage.getItem("qs_role");
    gradesContainer.style.display = "block";

    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN DE SEGURIDAD MÁS IMPORTANTE! ---
    // Se divide la lógica estrictamente por rol.
    if (userRole === "docente") {
      // --- VISTA DEL DOCENTE ---
      // Si el usuario es docente, se ejecutan las funciones que traen TODOS los datos.
      console.log("Rol DOCENTE detectado. Cargando panel de calificaciones.");
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
      activitiesContainer.style.display = "none"; // Se oculta el contenedor de actividades del estudiante.
      
      // Se inician las suscripciones a los datos de TODOS los estudiantes.
      // Se pasa el manejador de errores como segundo argumento.
      unsubscribeFromGrades = subscribeGrades(students => {
        allStudentsData = students;
        renderTeacherView();
      }, handleSubscriptionError);

      unsubscribeFromActivities = subscribeAllActivities(activities => {
        allActivitiesData = activities;
        renderTeacherView();
      }, handleSubscriptionError);

    } else {
      // --- VISTA DEL ESTUDIANTE ---
      // Si el rol NO es docente (es decir, es un estudiante), SOLO se cargan sus propios datos.
      console.log("Rol ESTUDIANTE detectado. Cargando mis calificaciones.");
      titleEl.textContent = "Resumen de Mis Calificaciones";
      activitiesContainer.style.display = "block";

      // Se inicia la suscripción a los datos del PROPIO estudiante.
      // El código nunca intentará llamar a `subscribeAllActivities`, evitando el error de permisos.
      unsubscribeFromGrades = subscribeMyGradesAndActivities(user, {
        next: ({ grades, activities }) => {
          studentGrades = grades ? [grades] : [];
          studentActivities = activities;
          renderStudentView();
        },
        error: handleSubscriptionError
      });
      unsubscribeFromActivities = null;
    }
  } else {
    // --- LÓGICA DE USUARIO NO AUTENTICADO ---
    // Si no hay usuario, se ocultan los contenedores y se limpia el estado.
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
    studentGrades = null;
    studentActivities = null;
    allStudentsData = null;
    allActivitiesData = null;
  }
}

// =================================================================================================
// FUNCIONES DE RENDERIZADO (UI)
// (Estas funciones no se modifican, pero se incluyen para que el archivo esté completo)
// =================================================================================================

/**
 * Renderiza la tabla de calificaciones para la vista del estudiante.
 */
function renderStudentView() {
  const tableBody = document.querySelector("#grades-table tbody");
  if (!tableBody) return;

  if (!studentGrades || studentGrades.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10">No tienes calificaciones registradas.</td></tr>';
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
 * Renderiza la tabla de calificaciones para la vista del docente.
 */
function renderTeacherView() {
    const tableBody = document.querySelector("#grades-table tbody");
    if (!tableBody) return;

    if (!allStudentsData || !allActivitiesData) {
        // Aún no han llegado ambos flujos de datos, esperamos.
        tableBody.innerHTML = '<tr><td colspan="10">Cargando datos de estudiantes...</td></tr>';
        return;
    }

    if (allStudentsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">No hay estudiantes para mostrar.</td></tr>';
        return;
    }

    // Ordenar estudiantes alfabéticamente
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
 * Muestra un mensaje de error en la tabla.
 * @param {string} message - El mensaje de error a mostrar.
 */
function renderError(message) {
  const tableBody = document.querySelector("#grades-table tbody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="10" class="error-message">${message}</td></tr>`;
  }
}

// =================================================================================================
// INICIALIZACIÓN DEL SCRIPT
// =================================================================================================

// Se establece el listener que dispara `handleAuthStateChanged` cada vez que el estado
// de autenticación cambia (alguien inicia o cierra sesión).
// Este es el punto de entrada que pone en marcha toda la lógica de la página.
onAuthStateChanged(auth, handleAuthStateChanged);
