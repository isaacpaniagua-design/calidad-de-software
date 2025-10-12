// js/calificaciones-backend.js

import { onAuth } from './firebase.js';
import { 
    subscribeGrades, 
    subscribeMyGrades,
    subscribeMyActivities
} from './firebase.js';

let unsubscribeFromGrades = null;
let unsubscribeFromActivities = null;

function handleAuthStateChanged(user) {
    // Limpiar suscripciones anteriores para evitar fugas de memoria
    if (unsubscribeFromGrades) unsubscribeFromGrades();
    if (unsubscribeFromActivities) unsubscribeFromActivities();

    const gradesContainer = document.getElementById('grades-table-container');
    const activitiesContainer = document.getElementById('student-activities-container');
    const titleEl = document.getElementById('grades-title');

    // Verificación de seguridad
    if (!gradesContainer || !titleEl || !activitiesContainer) {
        console.error("Error crítico: Faltan elementos HTML requeridos.");
        return;
    }

    if (user) {
        const userRole = localStorage.getItem('qs_role') || 'estudiante';
        gradesContainer.style.display = 'block';

        if (userRole === 'docente') {
            // --- VISTA DEL DOCENTE ---
            titleEl.textContent = 'Panel de Calificaciones (Promedios Automáticos)';
            activitiesContainer.style.display = 'none';
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);

        } else {
            // --- VISTA DEL ESTUDIANTE ---
            titleEl.textContent = 'Resumen de Mis Calificaciones';
            activitiesContainer.style.display = 'block';
            
            const studentId = localStorage.getItem('qs_student_id'); 
            
            if (studentId) {
                unsubscribeFromGrades = subscribeMyGrades(studentId, renderGradesTableForStudent);
                unsubscribeFromActivities = subscribeMyActivities(studentId, renderActivitiesForStudent);
            } else {
                const tbody = document.getElementById('grades-table-body');
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error: No se pudo identificar al estudiante. Inicia sesión de nuevo.</td></tr>';
            }
        }
    } else {
        // Ocultar si no hay sesión
        gradesContainer.style.display = 'none';
        activitiesContainer.style.display = 'none';
    }
}

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 * Maneja números, objetos con 'score', y redondea a 2 decimales.
 */
function getSafeScore(gradeData) {
    let score = 0;
    if (typeof gradeData === 'number') {
        score = gradeData;
    } else if (typeof gradeData === 'object' && gradeData !== null && typeof gradeData.score === 'number') {
        score = gradeData.score;
    }
    // Asegurarse de que el valor es numérico antes de fijar decimales
    return !isNaN(score) ? parseFloat(score.toFixed(2)) : 0;
}

/**
 * Renderiza la tabla de promedios para la vista del DOCENTE.
 */
function renderGradesTableForTeacher(studentsData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!studentsData || studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay estudiantes con registro de calificación.</td></tr>';
        return;
    }

    studentsData.forEach(student => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-3 px-4 font-medium text-gray-800">${student.name || 'Sin nombre'}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.unit1)}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.unit2)}</td>
            <td class="py-3 px-4 text-center">${getSafeScore(student.projectFinal)}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${getSafeScore(student.finalGrade)}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Renderiza la tabla de RESUMEN para la vista del ESTUDIANTE.
 */
function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!myGradesData || myGradesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Aún no tienes un resumen de calificaciones.</td></tr>';
        return;
    }
    const myData = myGradesData[0];
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="py-3 px-4 font-medium text-gray-800">${myData.name || 'Estudiante'}</td>
        <td class="py-3 px-4 text-center">${getSafeScore(myData.unit1)}</td>
        <td class="py-3 px-4 text-center">${getSafeScore(myData.unit2)}</td>
        <td class="py-3 px-4 text-center">${getSafeScore(myData.projectFinal)}</td>
        <td class="py-3 px-4 text-center font-bold text-blue-600">${getSafeScore(myData.finalGrade)}</td>
    `;
    tbody.appendChild(row);
}

/**
 * Renderiza la tabla de DESGLOSE de actividades para la vista del ESTUDIANTE.
 */
function renderActivitiesForStudent(activities) {
    const tbody = document.getElementById('student-activities-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!activities || activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas para mostrar.</td></tr>';
        return;
    }
    activities.forEach(activity => {
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.innerHTML = `
            <td class="py-2 px-4">${activity.activityName || 'Sin nombre'}</td>
            <td class="py-2 px-4">${activity.type || 'N/A'}</td>
            <td class="py-2 px-4 text-center">${(activity.unit || '').replace('unit', '')}</td>
            <td class="py-2 px-4 text-right font-medium">${getSafeScore(activity.score)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Punto de entrada del script
document.addEventListener('DOMContentLoaded', () => {
    onAuth(handleAuthStateChanged);
});
