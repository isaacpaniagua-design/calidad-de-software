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

/**
 * Obtiene y muestra el historial de entregas del estudiante desde Firestore.
 * @param {string} authUid - El UID de autenticación del estudiante.
 */
async function displaySubmissionHistory(authUid) {
    const historyContainer = document.getElementById('submission-history-container');
    if (!historyContainer) {
        console.error("El contenedor del historial de entregas no se encontró en el DOM.");
        return;
    }

    try {
        // Referencia a la colección 'student_uploads'
        const uploadsRef = collection(db, 'student_uploads');

        // Creamos la consulta: buscar documentos por authUid y ordenar por fecha descendente
        const q = query(uploadsRef, where("authUid", "==", authUid), orderBy("timestamp", "desc"));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<p class="text-gray-400">Aún no has realizado ninguna entrega.</p>';
            return;
        }

        // Si hay documentos, construimos el HTML
        let historyHtml = '<ul class="divide-y divide-gray-700">';
        querySnapshot.forEach((doc) => {
            const upload = doc.data();
            const submissionDate = upload.timestamp.toDate().toLocaleString('es-MX'); // Formato de fecha amigable

            historyHtml += `
                <li class="py-3 sm:py-4">
                    <div class="flex items-center space-x-4">
                        <div class="flex-shrink-0">
                            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-white truncate">
                                ${upload.fileName}
                            </p>
                            <p class="text-sm text-gray-400 truncate">
                                Entregado: ${submissionDate}
                            </p>
                        </div>
                        <div class="inline-flex items-center text-base font-semibold text-white">
                            <a href="${upload.fileURL}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">
                                Ver/Descargar
                            </a>
                        </div>
                    </div>
                </li>
            `;
        });
        historyHtml += '</ul>';

        historyContainer.innerHTML = historyHtml;

    } catch (error) {
        console.error("Error al obtener el historial de entregas:", error);
        historyContainer.innerHTML = '<p class="text-red-500">No se pudo cargar el historial. Intenta recargar la página.</p>';
    }
}
