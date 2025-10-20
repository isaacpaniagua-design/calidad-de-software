import { onFirebaseReady, getDb, onAuth } from './firebase.js';
import { getDocs, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

let db;

// --- LA SOLUCIÓN CORRECTA: ESPERAR A FIREBASE ---
onFirebaseReady(() => {
    // Ahora es seguro llamar a getDb()
    db = getDb();

    // El auth-guard ya protege la página, pero onAuth nos da el `user`
    onAuth(user => {
        if (user) {
            setupAssignActivities(user);
        }
    });
});

async function loadStudentsIntoAssignForm() {
    const studentSelect = document.getElementById('student-select-individual');
    if (!studentSelect) return;

    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Cargando...</option>';

    try {
        // `db` ahora está garantizado que no es undefined
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        students.sort((a, b) => a.name.localeCompare(b.name));

        studentSelect.innerHTML = '<option value="">Seleccione estudiante</option>';
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = false;
    } catch (error) {
        console.error("Error cargando estudiantes para asignar: ", error);
        studentSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function setupAssignActivities(user) {
    if (!user || localStorage.getItem('qs_role') !== 'docente') {
        const form = document.getElementById('assign-individual-activity-form');
        if(form) form.style.display = 'none';
        return;
    }
    
    const activitySelect = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');

    if (!activitySelect || !assignForm) {
        return;
    }

    loadStudentsIntoAssignForm();

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

    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const assignStatus = document.getElementById('assign-status');
        const gradeInput = document.getElementById('grade-input');
        const studentSelect = document.getElementById('student-select-individual');

        const studentId = studentSelect.value;
        const activityId = activitySelect.value;
        const grade = gradeInput.value;
        if (!studentId || !activityId || grade === '') {
            assignStatus.textContent = 'Complete todos los campos.';
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
            assignStatus.textContent = 'Asignada correctamente.';
            assignForm.reset();
            
            const displaySelect = document.getElementById('student-select-display');
            if (displaySelect && displaySelect.value === studentId) {
                 displaySelect.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.error("Error al asignar calificación: ", error);
            assignStatus.textContent = 'Error al asignar.';
        }
    });
}
