// js/calificaciones-backend.js

import { onAuth, subscribeGrades, subscribeMyGrades, subscribeMyActivities } from './firebase.js';

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 */
function getSafeScore(gradeData) {
    let score = 0;
    if (typeof gradeData === 'number') {
        score = gradeData;
    } else if (typeof gradeData === 'object' && gradeData !== null && typeof gradeData.score === 'number') {
        score = gradeData.score;
    }
    return !isNaN(score) ? parseFloat(score.toFixed(2)) : 0;
}

/**
 * Maneja los cambios de estado de autenticación para renderizar la vista correcta.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
function handleAuthStateChanged(user) {
    // Limpiar suscripciones anteriores para evitar fugas de memoria.
    if (unsubscribeFromGrades) unsubscribeFromGrades();
    if (unsubscribeFromActivities) unsubscribeFromActivities();

    const gradesContainer = document.getElementById('grades-table-container');
    const activitiesContainer = document.getElementById('student-activities-container');
    const titleEl = document.getElementById('grades-title');

    if (!gradesContainer || !titleEl || !activitiesContainer) {
        console.error("Error crítico: Faltan elementos clave del HTML.");
        return;
    }

    if (user) {
        // CORRECCIÓN CLAVE: Convertimos el rol a minúsculas para una comparación segura.
        const userRole = (localStorage.getItem('qs_role') || '').toLowerCase();
        gradesContainer.style.display = 'block';

        if (userRole === 'docente') {
            // --- VISTA DEL DOCENTE ---
            titleEl.textContent = 'Panel de Calificaciones (Promedios Generales)';
            activitiesContainer.style.display = 'none';
            // Llama a la función correcta para el docente.
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);

        } else { // Asumimos rol de estudiante
            // --- VISTA DEL ESTUDIANTE ---
            titleEl.textContent = 'Resumen de Mis Calificaciones';
            activitiesContainer.style.display = 'block';
            
            if (user.uid) {
                unsubscribeFromGrades = subscribeMyGrades(user.uid, renderGradesTableForStudent);
                unsubscribeFromActivities = subscribeMyActivities(user.uid, renderActivitiesForStudent);
            } else {
                renderError('No se pudo identificar tu sesión. Por favor, inicia sesión de nuevo.');
            }
        }
    } else {
        // Ocultar todo si no hay sesión
        gradesContainer.style.display = 'none';
        activitiesContainer.style.display = 'none';
    }
}

function renderGradesTableForTeacher(studentsData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    if (!studentsData || studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay estudiantes con calificaciones para mostrar.</td></tr>';
        return;
    }

    tbody.innerHTML = studentsData.map(student => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${student.name || 'Sin nombre'}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.unit1)}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.unit2)}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.projectFinal)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${getSafeScore(student.finalGrade)}</td>
        </tr>
    `).join('');
}

function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    if (!myGradesData || myGradesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Aún no tienes un resumen de calificaciones.</td></tr>';
        return;
    }
    const myData = myGradesData[0];
    tbody.innerHTML = `
        <tr>
            <td class="py-3 px-4 font-medium text-gray-800">${myData.name || 'Estudiante'}</td>
            <td class="py-3 px-4 text-center">${(myData.unit1 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(myData.unit2 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(myData.projectFinal || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${(myData.finalGrade || 0).toFixed(2)}</td>
        </tr>
    `;
}

function renderActivitiesForStudent(activities) {
    const tbody = document.getElementById('student-activities-body');
    if (!tbody) return;

    if (!activities || activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas para mostrar.</td></tr>';
        return;
    }
    tbody.innerHTML = activities.map(activity => `
        <tr class="border-b">
            <td class="py-2 px-4">${activity.activityName || 'Sin nombre'}</td>
            <td class="py-2 px-4 capitalize">${activity.type || 'N/A'}</td>
            <td class="py-2 px-4 text-center">${(activity.unit || '').replace('unit', '')}</td>
            <td class="py-2 px-4 text-right font-medium">${(activity.score || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

function renderError(message) {
    const tbody = document.getElementById('grades-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">${message}</td></tr>`;
}

// Punto de entrada del script
onAuth(handleAuthStateChanged);
