
import {
    getApp,
    getDb
} from './firebase.js';
import {
    collection,
    onSnapshot,
    doc,
    query,
    where,
    updateDoc,
    getDocs,
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

const db = getDb();
const app = getApp();

document.addEventListener('DOMContentLoaded', () => {
    // Shared student dropdowns
    const studentSelectForGrading = document.getElementById('student-select');
    const studentSelectForIndividual = document.getElementById('individual-student-select');
    
    // Section-specific elements
    const activitiesListSection = document.getElementById('activities-list-section');
    const activitiesContainer = document.getElementById('activities-container');
    const studentNameDisplay = document.getElementById('student-name-display');
    
    // Group Activity Form
    const createGroupActivityForm = document.getElementById('create-group-activity-form');
    const batchStatus = document.getElementById('batch-status');

    // Individual Activity Form
    const assignIndividualActivityForm = document.getElementById('assign-individual-activity-form');
    const individualStatus = document.getElementById('individual-status');
    const individualActivitySelect = document.getElementById('individual-activity-select');

    // Populate individual activity dropdown
    let activityOptions = '<option value="">Seleccione una actividad</option>';
    courseActivities.forEach(activity => {
        activityOptions += `<option value="${activity.id}">${activity.title}</option>`;
    });
    individualActivitySelect.innerHTML = activityOptions;

    // --- Student Loading ---
    const studentsCollection = collection(db, "students");
    onSnapshot(studentsCollection, (snapshot) => {
        let options = '<option value="">Seleccione un estudiante</option>';
        snapshot.forEach(doc => {
            const student = doc.data();
            options += `<option value="${doc.id}" data-uid="${student.authUid || ''}">${student.name}</option>`;
        });
        studentSelectForGrading.innerHTML = options;
        studentSelectForIndividual.innerHTML = options; // Populate both dropdowns
    });

    // --- 1. Group Activity Creation ---
    createGroupActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('group-activity-name').value;
        const unit = document.getElementById('group-activity-unit').value;
        const type = document.getElementById('group-activity-type').value;

        if (!name) {
            batchStatus.textContent = "El nombre de la actividad es obligatorio.";
            return;
        }

        const submitButton = document.getElementById('submit-group-activity');
        submitButton.disabled = true;
        submitButton.textContent = "Procesando...";

        try {
            const activitiesCollection = collection(db, "activities");
            await addDoc(activitiesCollection, {
                title: name,
                description: `Actividad de tipo ${type} para la ${unit}`,
                unit: unit,
                type: type,
                createdAt: new Date()
            });

            batchStatus.textContent = `Actividad "${name}" creada exitosamente para todos.`;
            batchStatus.className = "text-green-600";
            createGroupActivityForm.reset();

        } catch (error) {
            console.error("Error al crear actividad grupal:", error);
            batchStatus.textContent = "Error al crear la actividad.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Añadir Actividad a Todos";
        }
    });
    
    // --- 2. Individual Activity Assignment ---
    assignIndividualActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const studentDocId = studentSelectForIndividual.value;
        const selectedOption = studentSelectForIndividual.options[studentSelectForIndividual.selectedIndex];
        const studentUid = selectedOption.dataset.uid;
        const studentName = selectedOption.text;
        const selectedActivityId = individualActivitySelect.value;
        const selectedActivityText = individualActivitySelect.options[individualActivitySelect.selectedIndex].text;

        if (!studentDocId || !selectedActivityId) {
            individualStatus.textContent = "Debe seleccionar un estudiante y una actividad.";
            return;
        }

        const submitButton = document.getElementById('submit-individual-activity');
        submitButton.disabled = true;
        submitButton.textContent = "Creando entrega...";

        try {
            const submissionsCollection = collection(db, "submissions");
            // Find the activity details from courseActivities array
            const activityRef = courseActivities.find(a => a.id === selectedActivityId);

            if (!activityRef) {
                throw new Error("Actividad seleccionada no encontrada.");
            }

            await addDoc(submissionsCollection, {
                studentUid: studentUid,
                activityId: activityRef.id,
                grade: null,
                fileUrl: null,
                submittedAt: null,
                assignedAt: new Date()
            });

            individualStatus.textContent = `Entrega para "${selectedActivityText}" asignada a ${studentName} exitosamente.`;
            individualStatus.className = "text-green-600";
            assignIndividualActivityForm.reset();
            
            // Refresh the grading list if that student is currently selected
            if(studentSelectForGrading.value === studentDocId) {
                await loadStudentActivities(studentDocId, studentUid);
            }

        } catch (error) {
            console.error("Error al asignar actividad individual:", error);
            individualStatus.textContent = "Error al asignar la actividad.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Asignar a Estudiante";
        }
    });


    // --- 3. Grading Section ---
    studentSelectForGrading.addEventListener('change', async (e) => {
        const studentId = e.target.value;
        if (studentId) {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const studentName = selectedOption.text;
            const studentUid = selectedOption.dataset.uid;
            
            studentNameDisplay.textContent = studentName;
            activitiesListSection.style.display = 'block';
            await loadStudentActivities(studentId, studentUid);
        } else {
            activitiesListSection.style.display = 'none';
        }
    });

    async function loadStudentActivities(studentDocId, studentAuthUid) {
        activitiesContainer.innerHTML = '<p>Cargando actividades...</p>';
    
        const activitiesCollection = collection(db, "activities");
        const activitiesSnapshot = await getDocs(activitiesCollection);
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        const submissionsCollection = collection(db, "submissions");
        const submissionsQuery = query(submissionsCollection, where("studentUid", "==", studentAuthUid));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const studentSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        activitiesContainer.innerHTML = '';
        
        const relevantActivities = allActivities.filter(activity => {
            // An activity is relevant if it's a group activity (no individual flag)
            // OR if there's a specific submission for this student for this activity.
            const isAssigned = studentSubmissions.some(s => s.activityId === activity.id);
            // This logic is simplified: we show all group activities PLUS any activity this student has a submission for.
            return !activity.description.includes("(Individual)") || isAssigned;
        });


        if (relevantActivities.length === 0) {
            activitiesContainer.innerHTML = '<p>No hay actividades grupales creadas o individuales asignadas.</p>';
            return;
        }
    
        relevantActivities.forEach(activity => {
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
                           value="${currentGrade !== null ? currentGrade : ''}" 
                           data-activity-id="${activity.id}" 
                           data-submission-id="${submissionId || ''}">
                    <button class="save-grade-btn bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600">Guardar</button>
                </div>
            `;
            activitiesContainer.appendChild(activityEl);
        });
    }
    
    activitiesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('save-grade-btn')) {
            const button = e.target;
            const input = button.previousElementSibling;
            const grade = input.value;
            const activityId = input.dataset.activityId;
            let submissionId = input.dataset.submissionId;
    
            const selectedOption = studentSelectForGrading.options[studentSelectForGrading.selectedIndex];
            const studentUid = selectedOption.dataset.uid;
    
            if (!studentUid) {
                alert("Error: No se pudo identificar al estudiante.");
                return;
            }
    
            button.disabled = true;
            button.textContent = '...';
    
            try {
                const submissionsCollection = collection(db, "submissions");
                
                if (submissionId && submissionId !== 'null') {
                    const submissionRef = doc(db, "submissions", submissionId);
                    await updateDoc(submissionRef, { grade: Number(grade), gradedAt: new Date() });
                } else {
                    const newSubmissionRef = await addDoc(submissionsCollection, {
                        studentUid: studentUid,
                        activityId: activityId,
                        grade: Number(grade),
                        gradedAt: new Date()
                    });
                    input.dataset.submissionId = newSubmissionRef.id;
                }
    
                button.textContent = 'Hecho';
                setTimeout(() => button.textContent = 'Guardar', 2000);
    
            } catch (error) {
                console.error("Error al guardar la calificación:", error);
            } finally {
                button.disabled = false;
            }
        }
    });
});
