import { getDb, onAuth } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

let db;

function setupAssignActivities(user) {
    db = getDb(); // Obtenemos la BD para operaciones de escritura
    if (!user || localStorage.getItem('qs_role') !== 'docente') {
        const form = document.getElementById('assign-individual-activity-form');
        if(form) form.style.display = 'none';
        return;
    }
    
    const studentSelect = document.getElementById('student-select-individual');
    const activitySelect = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');
    const assignStatus = document.getElementById('assign-status');
    const gradeInput = document.getElementById('grade-input');

    if (!studentSelect || !activitySelect || !assignForm) {
        return;
    }

    // ¡¡CORRECCIÓN!! Cargar lista de estudiantes desde JSON
    fetch('./students.json')
        .then(response => response.json())
        .then(students => {
            studentSelect.innerHTML = '<option value="">Seleccione un estudiante</option>';
            students.sort((a,b) => a.name.localeCompare(b.name)).forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = student.name;
                studentSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Error al cargar estudiantes desde students.json: ", error);
            studentSelect.innerHTML = '<option value="">Error al cargar</option>';
        });

    // Cargar lista de actividades (esto es local, no hay problema)
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

    // Manejar el envío del formulario (aquí sí se usa la BD)
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!db) { 
            assignStatus.textContent = 'La base de datos no está lista. Inténtelo de nuevo.';
            assignStatus.classList.add('text-red-500');
            return;
        }

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

// El script se inicia con onAuth para tener el contexto del usuario
onAuth(setupAssignActivities);
