import { initFirebase, getDb, getAuthInstance } from './firebase.js';
import { getDocs, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

async function init() {
    initFirebase();
    const db = getDb();
    const auth = getAuthInstance();

    const studentSelectIndividual = document.getElementById('student-select-individual');
    const activitySelectIndividual = document.getElementById('activity-select-individual');
    const assignForm = document.getElementById('assign-individual-activity-form');
    const assignStatus = document.getElementById('assign-status');

    // Cargar estudiantes
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = student.name;
        studentSelectIndividual.appendChild(option.cloneNode(true));
    });

    // Cargar actividades
    courseActivities.forEach(unit => {
        unit.activities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = `${unit.unitLabel} - ${activity.title}`;
            activitySelectIndividual.appendChild(option);
        });
    });

    // Asignar actividad
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        assignStatus.textContent = 'Asignando...';

        const studentId = studentSelectIndividual.value;
        const activityId = activitySelectIndividual.value;
        const grade = document.getElementById('grade-input').value;

        try {
            await addDoc(collection(db, 'grades'), {
                studentId,
                activityId,
                grade: Number(grade),
                assignedAt: new Date()
            });
            assignStatus.textContent = 'Calificación asignada correctamente.';
            assignForm.reset();
        } catch (error) {
            console.error("Error al asignar calificación: ", error);
            assignStatus.textContent = 'Error al asignar la calificación.';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
