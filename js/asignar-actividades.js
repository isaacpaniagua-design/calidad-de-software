import { getDb, onAuth } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

let db;

function getBasePath() {
    const layoutScript = document.querySelector("script[src*='layout.js']");
    if (layoutScript) {
        return layoutScript.src.replace('js/layout.js', '');
    }
    return './';
}

function setupAssignActivities(user) {
    db = getDb();
    if (!user || localStorage.getItem('qs_role') !== 'docente') {
        const form = document.getElementById('assign-individual-activity-form');
        if(form) form.style.display = 'none';
        return;
    }
    
    const studentSelect = document.getElementById('student-select-individual');
    const activitySelect = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');

    if (!studentSelect || !activitySelect || !assignForm) {
        return;
    }

    // --- ¡CORRECCIÓN DE RUTA! ---
    const basePath = getBasePath();
    const studentJsonUrl = `${basePath}students.json`;

    fetch(studentJsonUrl)
        .then(response => {
            if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
            return response.json();
        })
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
            console.error("Error al cargar students.json: ", error);
            studentSelect.innerHTML = '<option value="">Error al cargar lista</option>';
        });

    // Cargar actividades (local)
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

    // Listener del formulario
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const assignStatus = document.getElementById('assign-status');

        if (!db) {
            assignStatus.textContent = 'Error: la base de datos no está lista.';
            return;
        }

        const studentId = studentSelect.value;
        const activityId = activitySelect.value;
        const grade = document.getElementById('grade-input').value;
        if (!studentId || !activityId || grade === '') {
            assignStatus.textContent = 'Por favor, complete todos los campos.';
            return;
        }
        
        assignStatus.textContent = 'Asignando...';
        try {
            const activityDetails = courseActivities.flatMap(u => u.activities).find(a => a.id === activityId);
            await addDoc(collection(db, 'grades'), {
                studentId,
                activityId,
                activityName: activityDetails ? activityDetails.title : 'Actividad Desconocida',
                grade: Number(grade),
                assignedAt: serverTimestamp()
            });
            assignStatus.textContent = 'Calificación asignada correctamente.';
            assignForm.reset();
            
            // Forzar recarga en la otra vista si el estudiante es el mismo
            const displaySelect = document.getElementById('student-select-display');
            if (displaySelect && displaySelect.value === studentId) {
                 displaySelect.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.error("Error al asignar calificación: ", error);
            assignStatus.textContent = 'Error al asignar calificación.';
        }
    });
}

onAuth(setupAssignActivities);
