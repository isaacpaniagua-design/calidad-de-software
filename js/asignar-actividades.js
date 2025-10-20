import { onFirebaseReady, getDb, getAuthInstance } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getDocs, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

let db;

// ✅ CORRECCIÓN: Se usa onAuthStateChanged para una gestión de sesión moderna.
onFirebaseReady(() => {
    db = getDb();
    const auth = getAuthInstance();
    onAuthStateChanged(auth, user => {
        // La función setup ya maneja la lógica de si el usuario es docente o no.
        setupAssignActivities(user);
    });
});

async function loadStudentsIntoAssignForm() {
    const studentSelect = document.getElementById('student-select-individual');
    if (!studentSelect) return;

    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Cargando...</option>';

    try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        let students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        students = students.filter(student => student.displayName && student.displayName.trim() !== '');
        students.sort((a, b) => a.displayName.localeCompare(b.displayName));

        studentSelect.innerHTML = '<option value="">Seleccione estudiante</option>';
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.displayName;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = false;
    } catch (error) {
        console.error("Error cargando estudiantes para asignar: ", error);
        studentSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function setupAssignActivities(user) {
    const form = document.getElementById('assign-individual-activity-form');
    const isTeacher = user && localStorage.getItem('qs_role') === 'docente';

    if (!isTeacher) {
        if(form) form.style.display = 'none';
        return;
    }

    if(form) form.style.display = 'block'; // Asegurarse de que el formulario sea visible para el docente
    
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
