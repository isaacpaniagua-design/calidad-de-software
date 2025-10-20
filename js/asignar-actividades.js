import { initFirebase, getDb, getAuthInstance } from './firebase.js';
import { getDocs, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

function setupAssignActivities() {
    const db = getDb();
    
    const studentSelect = document.getElementById('student-select-individual');
    const activitySelect = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');
    const assignStatus = document.getElementById('assign-status');
    const gradeInput = document.getElementById('grade-input');

    if (!studentSelect || !activitySelect || !assignForm) {
        console.log('No se encontraron los elementos para asignar actividades, saltando inicialización.');
        return;
    }

    // 1. Cargar lista de estudiantes
    getDocs(collection(db, 'students'))
        .then(studentsSnapshot => {
            studentSelect.innerHTML = '<option value="">Seleccione un estudiante</option>'; // Limpiar y añadir opción por defecto
            studentsSnapshot.forEach(doc => {
                const student = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = student.name;
                studentSelect.appendChild(option);
            });
        })
        .catch(error => console.error("Error al cargar estudiantes: ", error));

    // 2. Cargar lista de actividades
    activitySelect.innerHTML = '<option value="">Seleccione una actividad</option>'; // Limpiar y añadir opción por defecto
    courseActivities.forEach(unit => {
        const group = document.createElement('optgroup');
        group.label = unit.unitLabel;
        unit.activities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = activity.title;
            group.appendChild(option);
        });
        activitySelect.appendChild(group);
    });

    // 3. Manejar el envío del formulario
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        assignStatus.textContent = 'Asignando...';
        assignStatus.classList.remove('text-red-500', 'text-green-500');

        const studentId = studentSelect.value;
        const activityId = activitySelect.value;
        const grade = gradeInput.value;
        const activityDetails = courseActivities.flatMap(u => u.activities).find(a => a.id === activityId);

        if (!studentId || !activityId || grade === '') {
            assignStatus.textContent = 'Por favor, complete todos los campos.';
            assignStatus.classList.add('text-red-500');
            return;
        }

        try {
            await addDoc(collection(db, 'grades'), {
                studentId: studentId,
                activityId: activityId,
                activityName: activityDetails ? activityDetails.title : 'Actividad Desconocida',
                grade: Number(grade),
                assignedAt: serverTimestamp()
            });
            assignStatus.textContent = 'Calificación asignada correctamente.';
            assignStatus.classList.add('text-green-500');
            assignForm.reset();
            // Recargar las calificaciones del estudiante afectado en la otra sección
            if (document.getElementById('student-select-display').value === studentId) {
                 document.getElementById('student-select-display').dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.error("Error al asignar calificación: ", error);
            assignStatus.textContent = 'Error al asignar la calificación.';
            assignStatus.classList.add('text-red-500');
        }
    });
}

// Inicialización principal
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    const auth = getAuthInstance();

    auth.onAuthStateChanged(user => {
        if (user) {
            // Esperamos un momento para asegurar que otros scripts hayan cargado y el DOM esté listo.
            setTimeout(setupAssignActivities, 100); 
        } else {
            console.log("Usuario no autenticado. La asignación de actividades está deshabilitada.");
        }
    });
});
