// js/calificaciones-backend.js

// 1. IMPORTACIONES CORRECTAS
// Importamos 'onAuth' para saber quién es el usuario y las dos funciones para obtener calificaciones.
import { onAuth } from './firebase.js';
import { subscribeGrades, subscribeMyGrades, updateStudentGradePartial } from './firebase.js';

// Variable global para mantener la referencia a la función de cancelación de la suscripción de Firestore
let unsubscribeFromGrades = null;

/**
 * Función principal que se ejecuta cuando el estado de autenticación cambia.
 * @param {import("firebase/auth").User|null} user - El objeto de usuario de Firebase o null.
 */
function handleAuthStateChanged(user) {
    // Si hay una suscripción activa de Firestore de una sesión anterior, la cancelamos.
    if (unsubscribeFromGrades) {
        unsubscribeFromGrades();
        unsubscribeFromGrades = null;
        console.log("Suscripción de calificaciones anterior cancelada.");
    }

    if (user) {
        const userRole = localStorage.getItem('qs_role') || 'estudiante';
        console.log(`Usuario autenticado con rol: ${userRole.toUpperCase()}`);

        // 2. LÓGICA BASADA EN EL ROL
        if (userRole === 'docente') {
            // VISTA DEL DOCENTE: Carga la tabla con todos los estudiantes y la hace editable.
            document.getElementById('grades-table-container').style.display = 'block';
            unsubscribeFromGrades = subscribeGrades(renderGradesTableForTeacher);
        } else {
            // VISTA DEL ESTUDIANTE: Carga solo sus propias calificaciones en modo de solo lectura.
            document.getElementById('grades-table-container').style.display = 'block';
            unsubscribeFromGrades = subscribeMyGrades(user.uid, renderGradesTableForStudent);
        }
    } else {
        // Si no hay usuario, ocultamos la tabla y nos aseguramos de que no haya suscripciones activas.
        console.log("Usuario no autenticado. Limpiando vista de calificaciones.");
        document.getElementById('grades-table-container').style.display = 'none';
        const tbody = document.getElementById('grades-table-body');
        if (tbody) tbody.innerHTML = '';
    }
}

/**
 * Renderiza la tabla de calificaciones para la vista del DOCENTE.
 * Las celdas son editables.
 * @param {Array<object>} studentsData - Array con los datos de los estudiantes.
 */
function renderGradesTableForTeacher(studentsData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = ''; // Limpiar tabla
    if (studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">No hay estudiantes registrados para calificar.</td></tr>';
        return;
    }

    studentsData.forEach(student => {
        const row = document.createElement('tr');
        row.dataset.studentId = student.id; // Guardamos el ID del estudiante en la fila

        // Celda para el nombre del estudiante (no editable)
        const nameCell = document.createElement('td');
        nameCell.textContent = student.name || 'Sin nombre';
        row.appendChild(nameCell);

        // Celdas para las calificaciones de las unidades y proyecto
        const fields = ['unit1', 'unit2', 'unit3', 'projectFinal'];
        fields.forEach(field => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 10;
            input.value = student[field] || 0;
            input.dataset.field = field; // Guardamos el campo que representa (ej. 'unit1')
            input.classList.add('grade-input-teacher');
            cell.appendChild(input);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    // Añadir el listener para guardar cambios al salir del input (evento 'blur')
    tbody.addEventListener('blur', handleGradeChange, true);
}

/**
 * Maneja el evento de cambio de calificación y lo guarda en Firestore.
 * @param {Event} event - El evento 'blur' del input.
 */
async function handleGradeChange(event) {
    if (event.target.classList.contains('grade-input-teacher')) {
        const input = event.target;
        const studentId = input.closest('tr').dataset.studentId;
        const field = input.dataset.field;
        const value = parseFloat(input.value) || 0;

        try {
            console.log(`Actualizando calificación para ${studentId}: ${field} = ${value}`);
            await updateStudentGradePartial(studentId, field, value);
            // Opcional: mostrar una confirmación visual de que se guardó.
            input.style.backgroundColor = '#d4edda'; // Verde claro
            setTimeout(() => {
                input.style.backgroundColor = '';
            }, 1000);
        } catch (error) {
            console.error("Error al guardar la calificación:", error);
            input.style.backgroundColor = '#f8d7da'; // Rojo claro
        }
    }
}


/**
 * Renderiza la tabla de calificaciones para la vista del ESTUDIANTE.
 * Las celdas son de solo lectura.
 * @param {Array<object>} myGradesData - Array con un único objeto: las calificaciones del estudiante.
 */
function renderGradesTableForStudent(myGradesData) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myGradesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">Aún no tienes calificaciones registradas.</td></tr>';
        return;
    }

    const myData = myGradesData[0]; // Solo habrá un elemento en el array
    const row = document.createElement('tr');

    // Nombre
    row.innerHTML += `<td>${myData.name || 'Estudiante'}</td>`;

    // Calificaciones
    row.innerHTML += `<td>${myData.unit1 || 0}</td>`;
    row.innerHTML += `<td>${myData.unit2 || 0}</td>`;
    row.innerHTML += `<td>${myData.unit3 || 0}</td>`;
    row.innerHTML += `<td>${myData.projectFinal || 0}</td>`;

    tbody.appendChild(row);
}


// --- PUNTO DE ENTRADA ---
// Iniciar la lógica cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar los cambios de autenticación para iniciar la aplicación
    onAuth(handleAuthStateChanged);
});
