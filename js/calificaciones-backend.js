// js/calificaciones-backend.js

import { onAuth } from './firebase.js';
import { subscribeGrades, subscribeMyGrades, updateStudentGradePartial } from './firebase.js';

let unsubscribeFromGrades = null;

/**
 * Función principal que se ejecuta cuando el estado de autenticación cambia.
 */
function handleAuthStateChanged(user) {
    if (unsubscribeFromGrades) {
        unsubscribeFromGrades();
        unsubscribeFromGrades = null;
    }

    const container = document.getElementById('grades-table-container');
    const titleEl = document.getElementById('grades-title');

    if (!container || !titleEl) {
        console.error("Error crítico: No se encontraron los elementos #grades-table-container o #grades-title en el HTML.");
        return;
    }

    if (user) {
        const userRole = localStorage.getItem('qs_role') || 'estudiante';
        container.style.display = 'block';

        if (userRole === 'docente') {
            titleEl.textContent = 'Panel de Calificaciones';
            // Llama a la función que renderiza la tabla editable para el docente
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);
        } else {
            titleEl.textContent = 'Mis Calificaciones';
            // --- CAMBIO IMPORTANTE AQUÍ ---
            // Leemos el ID de estudiante (ej. "00000099876") desde localStorage
            const studentId = localStorage.getItem('qs_student_id'); 
            
            // Usamos ese ID para buscar las calificaciones, en lugar de user.uid
            unsubscribeFromGrades = subscribeMyGrades(studentId, renderGradesTableForStudent);
        }
    } else {
        container.style.display = 'none';
        const tbody = document.getElementById('grades-table-body');
        if (tbody) tbody.innerHTML = '';
    }
}

/**
 * Renderiza la tabla de calificaciones para la vista del DOCENTE.
 * Las celdas son inputs editables.
 * @param {Array<object>} studentsData - Array con los datos de todos los estudiantes.
 */
function renderGradesTableForTeacher(studentsData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay estudiantes registrados.</td></tr>';
        return;
    }

    studentsData.forEach(student => {
        const row = document.createElement('tr');
        row.dataset.studentId = student.id; // ID del documento del estudiante
        row.className = 'border-b hover:bg-gray-50';

        // Celda del nombre (no editable)
        row.innerHTML = `<td class="py-2 px-4">${student.name || 'Sin nombre'}</td>`;

        // Celdas de calificaciones (editables)
        const fields = ['unit1', 'unit2', 'unit3', 'projectFinal'];
        fields.forEach(field => {
            const cell = document.createElement('td');
            cell.className = 'py-2 px-4';
            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 10;
            input.step = 0.1; // Permitir decimales
            input.value = student[field] || 0;
            input.dataset.field = field; // ej. 'unit1'
            input.className = 'w-20 text-center bg-transparent focus:bg-blue-50 rounded';
            cell.appendChild(input);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    // Se añade un único listener al contenedor de la tabla para ser más eficiente.
    tbody.addEventListener('blur', handleGradeChange, true);
}

/**
 * Maneja el evento de cambio en un input de calificación y lo guarda en Firestore.
 * @param {Event} event - El evento 'blur' que se propaga desde un input.
 */
async function handleGradeChange(event) {
    const input = event.target;
    // Nos aseguramos de que el evento venga de un input de calificación
    if (input.tagName === 'INPUT' && input.dataset.field) {
        const studentId = input.closest('tr').dataset.studentId;
        const field = input.dataset.field;
        const value = Math.max(0, Math.min(10, parseFloat(input.value) || 0)); // Validar que esté entre 0 y 10

        // Actualizar el valor visual por si se corrigió (ej. si pusieron 11 o -1)
        input.value = value;

        try {
            console.log(`Actualizando para ${studentId}: ${field} -> ${value}`);
            await updateStudentGradePartial(studentId, field, value);

            input.classList.add('bg-green-100');
            setTimeout(() => input.classList.remove('bg-green-100'), 1500);

        } catch (error) {
            console.error("Error al guardar la calificación:", error);
            input.classList.add('bg-red-100');
        }
    }
}

/**
 * Renderiza la tabla de calificaciones para la vista del ESTUDIANTE.
 * Las celdas son de solo lectura.
 * @param {Array<object>} myGradesData - Array con las calificaciones del estudiante.
 */
function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myGradesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Aún no tienes calificaciones registradas.</td></tr>';
        return;
    }

    const myData = myGradesData[0];
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="py-2 px-4">${myData.name || 'Estudiante'}</td>
        <td class="py-2 px-4">${myData.unit1 || 0}</td>
        <td class="py-2 px-4">${myData.unit2 || 0}</td>
        <td class="py-2 px-4">${myData.unit3 || 0}</td>
        <td class="py-2 px-4">${myData.projectFinal || 0}</td>
    `;
    tbody.appendChild(row);
}

// Punto de entrada: iniciar la lógica cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', () => {
    onAuth(handleAuthStateChanged);
});
