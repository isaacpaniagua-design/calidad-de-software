// js/calificaciones-backend.js

import {
  onAuth,
  subscribeMyGradesAndActivities,
  subscribeAllActivities,
  // --- NUEVAS FUNCIONES REQUERIDAS en firebase.js ---
  subscribeToStudentList, // Para obtener la lista de estudiantes
  getGradeForStudent,      // Para obtener las calificaciones de un estudiante específico
} from "./firebase.js";
import { calculateUnitGrade, calculateFinalGrade } from "./grade-calculator.js";

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;
let studentSubscriptions = []; // Array para manejar múltiples suscripciones a estudiantes

// Estado local para almacenar datos
let studentGrades = null;
let studentActivities = null;
let allStudentsData = null;
let allActivitiesData = null;

/**
 * Renderiza la vista completa del estudiante cuando todos los datos están disponibles.
 */
function renderStudentView() {
  if (!studentGrades) {
    return;
  }
  const studentData = studentGrades.length > 0 ? studentGrades[0] : null;
  if (studentData) {
    renderGradesTableForStudent([studentData]);
  } else {
    renderGradesTableForStudent([]);
  }
  renderActivitiesForStudent(studentActivities);
}

/**
 * Renderiza la vista del profesor cuando los datos de los estudiantes están disponibles.
 */
function renderTeacherView() {
  if (!allStudentsData) {
    return;
  }
  renderGradesTableForTeacher(allStudentsData);
}

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 */
function getSafeScore(gradeData) {
  let score = 0;
  if (typeof gradeData === "number") {
    score = gradeData;
  } else if (typeof gradeData === "object" && gradeData !== null) {
    score = gradeData.score || 0;
  }
  return score.toFixed(2);
}

/**
 * Maneja los cambios de estado de autenticación para renderizar la vista correcta.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
function handleAuthStateChanged(user) {
  // Limpiar suscripciones anteriores para evitar fugas de memoria.
  if (unsubscribeFromGrades) unsubscribeFromGrades();
  if (unsubscribeFromActivities) unsubscribeFromActivities();
  studentSubscriptions.forEach(unsub => unsub()); // Limpia las suscripciones individuales
  studentSubscriptions = [];

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
    const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
    gradesContainer.style.display = "block";

    if (userRole === "docente") {
      // --- VISTA DEL DOCENTE (LÓGICA CORREGIDA) ---
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
      activitiesContainer.style.display = "none";

      allStudentsData = []; // Inicializar como array vacío

      // 1. Suscribirse a la lista de estudiantes (requiere la nueva función en firebase.js)
      unsubscribeFromGrades = subscribeToStudentList((students) => {
        // Limpiar suscripciones anteriores a calificaciones para evitar duplicados
        studentSubscriptions.forEach(unsub => unsub());
        studentSubscriptions = [];
        allStudentsData = []; // Reiniciar en cada actualización de la lista

        // 2. Para cada estudiante, obtener su documento de calificaciones.
        students.forEach(student => {
          const studentId = student.id; // Asumiendo que el doc ID es el UID
          
          // Suscribirse a las calificaciones de este estudiante
          const unsubscribe = getGradeForStudent(studentId, (gradeData) => {
            const studentInfo = {
              ...student, // Datos base del estudiante (nombre, etc.)
              ...(gradeData || {}), // Datos de sus calificaciones
              id: studentId,
            };

            // Actualizar o agregar al estudiante en el estado local
            const existingStudentIndex = allStudentsData.findIndex(s => s.id === studentId);
            if (existingStudentIndex > -1) {
              allStudentsData[existingStudentIndex] = studentInfo;
            } else {
              allStudentsData.push(studentInfo);
            }
            
            // Renderizar la tabla con los datos actualizados
            renderTeacherView();
          });
          studentSubscriptions.push(unsubscribe); // Guardar para poder desuscribirse luego
        });
      });

      // La suscripción a todas las actividades debería funcionar si tienes la regla correcta
      unsubscribeFromActivities = subscribeAllActivities((activities) => {
        allActivitiesData = activities;
        renderTeacherView(); // Volver a renderizar si es necesario
      });

    } else {
      // --- VISTA DEL ESTUDIANTE (Sin cambios, es correcta) ---
      titleEl.textContent = "Resumen de Mis Calificaciones";
      activitiesContainer.style.display = "block";

      if (user.uid) {
        studentGrades = null;
        studentActivities = null;

        unsubscribeFromGrades = subscribeMyGradesAndActivities(
          user,
          ({ grades, activities }) => {
            studentGrades = grades ? [grades] : []; // La vista espera un array
            studentActivities = activities;
            renderStudentView();
          }
        );
        unsubscribeFromActivities = null;
      } else {
        renderError(
          "No se pudo identificar tu sesión. Por favor, inicia sesión de nuevo."
        );
      }
    }
  } else {
    // Ocultar y limpiar todo si no hay sesión
    gradesContainer.style.display = "none";
    activitiesContainer.style.display = "none";
    studentGrades = null;
    studentActivities = null;
    allStudentsData = null;
    allActivitiesData = null;
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
      const unit1 = student.unit1?.average ?? student.unit1 ?? 0;
      const unit2 = student.unit2?.average ?? student.unit2 ?? 0;
      const projectFinal = student.projectFinal ?? 0;
      const finalGrade = student.finalGrade ?? student.final ?? 0;
      return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${
              student.name || student.displayName || "Sin nombre"
            }</td>
            <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(finalGrade).toFixed(1)}</td>
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
  const unit1 = myData.unit1?.average ?? myData.unit1 ?? 0;
  const unit2 = myData.unit2?.average ?? myData.unit2 ?? 0;
  const projectFinal = myData.projectFinal ?? 0;
  const finalGrade = myData.finalGrade ?? myData.final ?? 0;
  tbody.innerHTML = `
        <tr>
            <td class="py-3 px-4 font-medium text-gray-800">${
              myData.name || myData.displayName || "Estudiante"
            }</td>
            <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(finalGrade).toFixed(1)}</td>
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
