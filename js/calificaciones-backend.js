// js/calificaciones-backend.js

import { onAuth, subscribeGrades, subscribeMyGrades, subscribeMyActivities } from './firebase.js';

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

function handleAuthStateChanged(user) {
    // Limpiar suscripciones anteriores para evitar fugas de memoria y datos incorrectos
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
        const userRole = localStorage.getItem('qs_role');
        gradesContainer.style.display = 'block';

        if (userRole === 'docente') {
            // --- VISTA DEL DOCENTE ---
            titleEl.textContent = 'Panel de Calificaciones (Promedios Generales)';
            activitiesContainer.style.display = 'none'; // Ocultamos el desglose, no aplica aquí
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);

        } else { // Asumimos que si no es docente, es estudiante
            // --- VISTA DEL ESTUDIANTE ---
            titleEl.textContent = 'Resumen de Mis Calificaciones';
            activitiesContainer.style.display = 'block';
            
            const studentId = localStorage.getItem('qs_student_id'); 
            
            if (studentId) {
                // Suscripciones independientes para la vista del alumno
                unsubscribeFromGrades = subscribeMyGrades(studentId, renderGradesTableForStudent);
                unsubscribeFromActivities = subscribeMyActivities(studentId, renderActivitiesForStudent);
            } else {
                renderError('No se pudo identificar tu matrícula. Por favor, inicia sesión de nuevo.');
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

    // Usamos map y join para mayor eficiencia
    tbody.innerHTML = studentsData.map(student => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${student.name || 'Sin nombre'}</td>
            <td class="py-3 px-4 text-center">${(student.unit1 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(student.unit2 || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${(student.projectFinal || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${(student.finalGrade || 0).toFixed(2)}</td>
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
