// js/calificaciones-backend.js

// Importamos las funciones necesarias, incluyendo la nueva que creamos.
import { onAuth, subscribeGrades, subscribeMyActivities } from './firebase.js'; 
import { getStudentId } from './calificaciones-helpers.js';

// Referencias a los contenedores que YA EXISTEN en tu HTML
const gradesTableContainer = document.getElementById('grades-table-container');
const gradesTableBody = document.getElementById('grades-table-body');
const studentActivitiesContainer = document.getElementById('student-activities-container');
const studentActivitiesBody = document.getElementById('student-activities-body');
const gradesTitle = document.getElementById('grades-title');

let unsubscribeGrades = () => {};
let unsubscribeActivities = () => {};

onAuth(user => {
    if (!user) {
        // Si no hay usuario, no hacemos nada, auth-guard se encargará de redirigir.
        return;
    }

    const role = localStorage.getItem('qs_role');

    if (role === 'docente') {
        // Lógica para la vista del docente (que ya manejas en otros scripts)
        gradesTitle.textContent = 'Calificaciones de Estudiantes';
        // No cargamos datos de un solo estudiante, sino la lista completa.
        // Esto lo maneja calificaciones-teacher-sync.js
    } else if (role === 'estudiante') {
        // Lógica para la vista del estudiante
        gradesTitle.textContent = 'Mis Calificaciones';
        const studentId = localStorage.getItem('qs_student_id');

        if (studentId) {
            // Mostramos los contenedores que estaban ocultos
            gradesTableContainer.style.display = 'block';
            studentActivitiesContainer.style.display = 'block';

            // Nos suscribimos a los datos del estudiante logueado
            unsubscribeGrades = subscribeGrades(studentId, renderStudentGrades);
            unsubscribeActivities = subscribeMyActivities(studentId, renderStudentActivities);

        } else {
            renderError("No se pudo encontrar tu matrícula. Por favor, contacta a tu docente.");
        }
    }
});

// Limpiar suscripciones al salir de la página
window.addEventListener('beforeunload', () => {
    unsubscribeGrades();
    unsubscribeActivities();
});

function renderStudentGrades(gradesData) {
    if (!gradesData || gradesData.length === 0) {
        gradesTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Aún no tienes calificaciones registradas.</td></tr>`;
        return;
    }

    const student = gradesData[0]; // Para la vista de estudiante, solo vendrá un objeto
    const finalGrade = (student.finalGrade || 0).toFixed(2);

    gradesTableBody.innerHTML = `
        <tr class="hover:bg-gray-50">
            <td class="py-3 px-4 font-semibold">${student.name || 'Estudiante'}</td>
            <td class="py-3 px-4 text-center">${(student.unit1 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(student.unit2 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(student.projectFinal || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-lg ${finalGrade >= 70 ? 'text-green-600' : 'text-red-600'}">${finalGrade}</td>
        </tr>
    `;
}

function renderStudentActivities(activities) {
    if (!activities || activities.length === 0) {
        studentActivitiesBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No hay desglose de actividades disponible.</td></tr>`;
        return;
    }

    studentActivitiesBody.innerHTML = activities.map(activity => `
        <tr class="border-t hover:bg-gray-50">
            <td class="py-2 px-4">${activity.activityName}</td>
            <td class="py-2 px-4 capitalize">${activity.type}</td>
            <td class="py-2 px-4">Unidad ${activity.unit.replace('unit', '')}</td>
            <td class="py-2 px-4 text-right font-mono">${(activity.score || 0).toFixed(1)}</td>
        </tr>
    `).join('');
}

function renderError(message) {
    gradesTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-600">${message}</td></tr>`;
    studentActivitiesBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-600">No se pudo cargar el desglose.</td></tr>`;
}
