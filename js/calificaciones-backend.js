// js/calificaciones-backend.js

import { onAuth } from './firebase.js';
import { 
    subscribeGrades, 
    subscribeMyGrades,
    subscribeMyActivities // Asegúrate de haber añadido esta función a firebase.js
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

    // Verificación de seguridad para asegurar que el HTML está correcto
    if (!gradesContainer || !titleEl || !activitiesContainer) {
        console.error("Error crítico: Faltan elementos HTML requeridos (#grades-table-container, #grades-title, o #student-activities-container).");
        return;
    }

    if (user) {
        const userRole = localStorage.getItem('qs_role') || 'estudiante';
        gradesContainer.style.display = 'block';

        if (userRole === 'docente') {
            // --- VISTA DEL DOCENTE ---
            titleEl.textContent = 'Panel de Calificaciones (Promedios Automáticos)';
            activitiesContainer.style.display = 'none'; // Ocultar la tabla de desglose para el docente
            
            // Se suscribe a los promedios de todos los estudiantes
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);

        } else {
    // --- VISTA DEL ESTUDIANTE ---
    titleEl.textContent = 'Resumen de Mis Calificaciones';
    activitiesContainer.style.display = 'block'; // Mostrar la tabla de desglose
    
    const studentId = localStorage.getItem('qs_student_id'); 
    
    if (studentId) {
        // Cargar el resumen de promedios del estudiante
        unsubscribeFromGrades = subscribeMyGrades(studentId, renderGradesTableForStudent);
        // Cargar la lista detallada de actividades del estudiante
        unsubscribeFromActivities = subscribeMyActivities(studentId, renderActivitiesForStudent);
    } else {
        // Si no se encuentra el ID del estudiante, mostrar un mensaje de error.
        const tbody = document.getElementById('grades-table-body');
        const activitiesTbody = document.getElementById('student-activities-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error: No se pudo identificar al estudiante. Inicia sesión de nuevo.</td></tr>';
        }
        if (activitiesTbody) {
            activitiesTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">No se pueden cargar las actividades.</td></tr>';
        }
    }
}
    } else {
        // Ocultar todo si no hay sesión iniciada
        gradesContainer.style.display = 'none';
        activitiesContainer.style.display = 'none';
    }
}

/**
 * Renderiza la tabla de promedios para la vista del DOCENTE.
 * Las calificaciones son de solo lectura porque se calculan automáticamente.
 */
// js/calificaciones-backend.js

// ... (código anterior)

/**
 * Función auxiliar para obtener de forma segura una calificación numérica.
 * Maneja tanto números directos como objetos con una propiedad 'score'.
 * @param {any} gradeData - El dato de la calificación.
 * @returns {number} - La calificación numérica o 0 si no es válida.
 */
function getSafeScore(gradeData) {
    if (typeof gradeData === 'number') {
        return gradeData;
    }
    if (typeof gradeData === 'object' && gradeData !== null && typeof gradeData.score === 'number') {
        return gradeData.score;
    }
    return 0;
}

function renderGradesTableForTeacher(studentsData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay estudiantes con registro de calificación.</td></tr>';
        return;
    }

    studentsData.forEach(student => {
        const row = document.createElement('tr');
        // Alternar colores de fila para mejor legibilidad
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


function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myGradesData.length === 0) {
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
 * Renderiza la tabla de RESUMEN para la vista del ESTUDIANTE.
 */
function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myGradesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Aún no tienes un resumen de calificaciones.</td></tr>';
        return;
    }
    const myData = myGradesData[0];
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="py-2 px-4">${myData.name || 'Estudiante'}</td>
        <td class="py-2 px-4 text-center">${myData.unit1 || 0}</td>
        <td class="py-2 px-4 text-center">${myData.unit2 || 0}</td>
        <td class="py-2 px-4 text-center">${myData.projectFinal || 0}</td>
        <td class="py-2 px-4 text-center font-bold">${myData.finalGrade || 0}</td>
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
    if (activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas para mostrar.</td></tr>';
        return;
    }
    activities.forEach(activity => {
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.innerHTML = `
            <td class="py-2 px-4">${activity.activityName}</td>
            <td class="py-2 px-4">${activity.type}</td>
            <td class="py-2 px-4 text-center">${activity.unit.replace('unit', '')}</td>
            <td class="py-2 px-4 text-right font-medium">${activity.score || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Punto de entrada del script
document.addEventListener('DOMContentLoaded', () => {
    onAuth(handleAuthStateChanged);
});
