import { getDb, onFirebaseReady } from './firebase.js'; // CAMBIO: Usamos onFirebaseReady
import { getDocs, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

let db;

function setupAssignActivities(user) {
    // Verificar si el usuario es docente
    if (!user || localStorage.getItem('qs_role') !== 'docente') {
        const form = document.getElementById('assign-individual-activity-form');
        if(form) form.style.display = 'none'; // Ocultar el formulario si no es docente
        return;
    }

    db = getDb(); // Ahora es seguro obtener la instancia de la BD
    if (!db) {
        console.error("La asignación de actividades no puede iniciar porque la BD no está lista.");
        return;
    }
    
    const studentSelect = document.getElementById('student-select-individual');
    const activitySelect = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');
    const assignStatus = document.getElementById('assign-status');
    const gradeInput = document.getElementById('grade-input');

    if (!studentSelect || !activitySelect || !assignForm) {
        return; // No hacer nada si los elementos no están en la página
    }

    // Cargar estudiantes
    getDocs(collection(db, 'students'))
        .then(studentsSnapshot => {
            studentSelect.innerHTML = '<option value="">Seleccione un estudiante</option>'; 
            studentsSnapshot.forEach(doc => {
                const student = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = student.name;
                studentSelect.appendChild(option);
            });
        })
        .catch(error => console.error("Error al cargar estudiantes para asignar: ", error));

    // Cargar actividades
    activitySelect.innerHTML = '<option value="">Seleccione una actividad</option>';
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

    // Manejar el envío del formulario
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

            // Si el estudiante cuyas calificaciones se están mostrando es el mismo al que se le asignó,
            // dispara un evento para forzar la recarga de su lista de calificaciones.
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

// CAMBIO: Usar onFirebaseReady para asegurar que Firebase esté inicializado
onFirebaseReady(setupAssignActivities);
