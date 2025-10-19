
import {
    getDb,
    collection,
    onSnapshot,
    doc,
    addDoc,
    updateDoc,
    query,
    where,
    getDocs
} from './firebase.js';

const db = getDb();

document.addEventListener('DOMContentLoaded', () => {
    const studentSelect = document.getElementById('student-select');
    const activitiesListSection = document.getElementById('activities-list-section');
    const activitiesContainer = document.getElementById('activities-container');
    const studentNameDisplay = document.getElementById('student-name-display');
    const createActivityForm = document.getElementById('create-group-activity-form');
    const batchStatus = document.getElementById('batch-status');

    // Cargar estudiantes en el selector
    const studentsCollection = collection(db, "students");
    onSnapshot(studentsCollection, (snapshot) => {
        let options = '<option value="">Seleccione un estudiante</option>';
        snapshot.forEach(doc => {
            const student = doc.data();
            options += `<option value="${doc.id}" data-uid="${student.authUid || ''}">${student.name}</option>`;
        });
        studentSelect.innerHTML = options;
    });

    // Crear actividad grupal
    createActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('group-activity-name').value;
        const unit = document.getElementById('group-activity-unit').value;
        const type = document.getElementById('group-activity-type').value;

        if (!name) {
            batchStatus.textContent = "El nombre de la actividad es obligatorio.";
            batchStatus.className = "text-red-600";
            return;
        }

        const submitButton = document.getElementById('submit-group-activity');
        submitButton.disabled = true;
        submitButton.textContent = "Procesando...";

        try {
            // 1. Guardar la actividad maestra
            const activitiesCollection = collection(db, "activities");
            const activityRef = await addDoc(activitiesCollection, {
                title: name,
                description: `Actividad de tipo ${type} para la ${unit}`,
                unit: unit,
                type: type,
                createdAt: new Date()
            });

            batchStatus.textContent = `Actividad "${name}" creada exitosamente.`;
            batchStatus.className = "text-green-600";
            createActivityForm.reset();

            // Opcional: Si se seleccionó un estudiante, recargar sus actividades
            if (studentSelect.value) {
                await loadStudentActivities(studentSelect.value, studentSelect.options[studentSelect.selectedIndex].text);
            }

        } catch (error) {
            console.error("Error al crear actividad:", error);
            batchStatus.textContent = "Error al crear la actividad.";
            batchStatus.className = "text-red-600";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Añadir Actividad a Todos";
        }
    });


    // Cargar actividades del estudiante seleccionado
    studentSelect.addEventListener('change', async (e) => {
        const studentId = e.target.value;
        if (studentId) {
            const studentName = e.target.options[e.target.selectedIndex].text;
            const studentUid = e.target.options[e.target.selectedIndex].dataset.uid;
            studentNameDisplay.textContent = studentName;
            activitiesListSection.style.display = 'block';
            await loadStudentActivities(studentId, studentUid);
        } else {
            activitiesListSection.style.display = 'none';
        }
    });

    async function loadStudentActivities(studentDocId, studentAuthUid) {
        activitiesContainer.innerHTML = '<p>Cargando actividades...</p>';
    
        // 1. Obtener todas las actividades maestras
        const activitiesCollection = collection(db, "activities");
        const activitiesSnapshot = await getDocs(activitiesCollection);
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        // 2. Obtener todas las entregas para este estudiante
        const submissionsCollection = collection(db, "submissions");
        const submissionsQuery = query(submissionsCollection, where("studentUid", "==", studentAuthUid));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const studentSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        // 3. Renderizar la lista
        activitiesContainer.innerHTML = '';
        if (allActivities.length === 0) {
            activitiesContainer.innerHTML = '<p>No hay actividades creadas en el sistema.</p>';
            return;
        }
    
        allActivities.forEach(activity => {
            const submission = studentSubmissions.find(s => s.activityId === activity.id);
            const submissionId = submission ? submission.id : null;
            const currentGrade = submission ? submission.grade : '';
    
            const activityEl = document.createElement('div');
            activityEl.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md';
            activityEl.innerHTML = `
                <div>
                    <p class="font-semibold">${activity.title}</p>
                    <p class="text-sm text-gray-500">${activity.description}</p>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" min="0" max="100" placeholder="N/A" 
                           class="w-20 p-1 border border-gray-300 rounded-md text-center" 
                           value="${currentGrade}" 
                           data-activity-id="${activity.id}" 
                           data-submission-id="${submissionId || ''}">
                    <button class="save-grade-btn bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600">Guardar</button>
                </div>
            `;
            activitiesContainer.appendChild(activityEl);
        });
    }
    
    // Guardar calificación
    activitiesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('save-grade-btn')) {
            const button = e.target;
            const input = button.previousElementSibling;
            const grade = input.value;
            const activityId = input.dataset.activityId;
            let submissionId = input.dataset.submissionId;
    
            const selectedOption = studentSelect.options[studentSelect.selectedIndex];
            const studentUid = selectedOption.dataset.uid;
    
            if (!studentUid) {
                alert("Error: No se pudo identificar al estudiante (authUid no encontrado).");
                return;
            }
    
            button.disabled = true;
            button.textContent = '...';
    
            try {
                const submissionsCollection = collection(db, "submissions");
                
                // Si ya existe una entrega (submission), la actualizamos.
                // Si no, creamos una nueva.
                if (submissionId && submissionId !== 'null') {
                    const submissionRef = doc(db, "submissions", submissionId);
                    await updateDoc(submissionRef, {
                        grade: Number(grade),
                        gradedAt: new Date()
                    });
                } else {
                    const newSubmissionRef = await addDoc(submissionsCollection, {
                        studentUid: studentUid,
                        activityId: activityId,
                        grade: Number(grade),
                        fileUrl: null, // El archivo se sube por separado por el estudiante
                        submittedAt: null,
                        gradedAt: new Date()
                    });
                    // Actualizamos el UI para la próxima vez que se guarde
                    input.dataset.submissionId = newSubmissionRef.id;
                }
    
                button.textContent = 'Hecho';
                setTimeout(() => button.textContent = 'Guardar', 2000);
    
            } catch (error) {
                console.error("Error al guardar la calificación:", error);
                button.textContent = 'Error';
                setTimeout(() => button.textContent = 'Guardar', 2000);
            } finally {
                button.disabled = false;
            }
        }
    });
});
