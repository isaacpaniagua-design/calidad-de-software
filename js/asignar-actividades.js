import { getDocs, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

// No necesitamos getDb de firebase.js, lo recibimos como parámetro
let db;

async function loadStudentsIntoAssignForm() {
    const studentSelect = document.getElementById('student-select-individual');
    if (!studentSelect) return;

    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Cargando...</option>';

    try {
        // Ahora `db` está garantizado que existe
        if (!db) throw new Error("La BD no está lista.");

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

// --- ¡CORRECCIÓN CLAVE! ---
// Aceptamos la instancia de la base de datos como segundo parámetro.
function setupAssignActivities(user, database) {
    db = database; // Asignamos la instancia recibida a nuestra variable local.

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

        if (!db) {
            assignStatus.textContent = 'Error: BD no lista.';
            return;
        }

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

if (typeof window.QS_PAGE_INIT === 'undefined') {
    window.QS_PAGE_INIT = {};
}
window.QS_PAGE_INIT.assignActivities = setupAssignActivities;
