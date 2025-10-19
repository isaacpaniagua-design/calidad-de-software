
import {
    initFirebase,
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

initFirebase();
const db = getDb();

document.addEventListener('DOMContentLoaded', async () => {
    const studentSelectForGrading = document.getElementById('student-select');
    const studentSelectForIndividual = document.getElementById('individual-student-select');
    const activitiesListSection = document.getElementById('activities-list-section');
    const activitiesContainer = document.getElementById('activities-container');
    const studentNameDisplay = document.getElementById('student-name-display');
    const createGroupActivityForm = document.getElementById('create-group-activity-form');
    const batchStatus = document.getElementById('batch-status');
    const assignIndividualActivityForm = document.getElementById('assign-individual-activity-form');
    const individualStatus = document.getElementById('individual-status');
    const individualActivitySelect = document.getElementById('individual-activity-select');

    // Populate individual activity dropdown
    let activityOptions = '<option value="">Seleccione una actividad</option>';
    courseActivities.forEach(unit => {
        activityOptions += `<optgroup label="${unit.unitLabel}">`;
        unit.activities.forEach(activity => {
            activityOptions += `<option value="${activity.id}">${activity.title || '(Sin Título)'}</option>`;
        });
        activityOptions += `</optgroup>`;
    });
    individualActivitySelect.innerHTML = activityOptions;

    // --- Load students by combining Firestore data and JSON names ---
    async function loadStudentDropdowns() {
        const studentNameMap = new Map();
        try {
            const response = await fetch('data/students.json');
            if (response.ok) {
                const data = await response.json();
                data.students.forEach(student => {
                    if (student.email && student.name) {
                        studentNameMap.set(student.email.toLowerCase(), student.name);
                    }
                });
            }
        } catch (error) {
            console.error("Could not load or parse students.json for names", error);
        }

        const studentsCollection = collection(db, "students");
        onSnapshot(studentsCollection, (snapshot) => {
            let options = '<option value="">Seleccione un estudiante</option>';
            const studentDocs = snapshot.docs.sort((a, b) => {
                const studentA = a.data();
                const studentB = b.data();
                const nameA = studentNameMap.get(studentA.email?.toLowerCase()) || studentA.displayName || studentA.name || '';
                const nameB = studentNameMap.get(studentB.email?.toLowerCase()) || studentB.displayName || studentB.name || '';
                return nameA.localeCompare(nameB);
            });

            studentDocs.forEach(doc => {
                const student = doc.data();
                const email = student.email ? student.email.toLowerCase() : null;
                const studentName = studentNameMap.get(email) || student.displayName || student.name || '(Sin Nombre)';
                options += `<option value="${doc.id}" data-uid="${student.authUid || ''}">${studentName}</option>`;
            });
            studentSelectForGrading.innerHTML = options;
            studentSelectForIndividual.innerHTML = options;
        });
    }

    await loadStudentDropdowns();

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
            
            await addDoc(submissionsCollection, {
                studentUid: studentUid,
                activityId: selectedActivityId,
                grade: null,
                fileUrl: null,
                submittedAt: null,
                assignedAt: new Date()
            });

            individualStatus.textContent = `Entrega para "${selectedActivityText}" asignada a ${studentName} exitosamente.`;
            individualStatus.className = "text-green-600";
            assignIndividualActivityForm.reset();
            
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
        if (!studentAuthUid) {
            activitiesContainer.innerHTML = '<p class="text-red-500">Error: Este estudiante no tiene un UID de autenticación asignado.</p>';
            return;
        }

        activitiesContainer.innerHTML = '<p>Cargando actividades...</p>';
    
        const activitiesCollection = collection(db, "activities");
        const activitiesSnapshot = await getDocs(activitiesCollection);
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        const submissionsCollection = collection(db, "submissions");
        const submissionsQuery = query(submissionsCollection, where("studentUid", "==", studentAuthUid));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const studentSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        activitiesContainer.innerHTML = '';
        
        const relevantActivityIds = new Set(allActivities.map(a => a.id));
        studentSubmissions.forEach(s => relevantActivityIds.add(s.activityId));

        const combinedActivities = courseActivities
            .flatMap(unit => unit.activities)
            .concat(allActivities)
            .filter(a => relevantActivityIds.has(a.id));

        const uniqueActivities = Array.from(new Set(combinedActivities.map(a => a.id)))
            .map(id => {
                return combinedActivities.find(a => a.id === id) || allActivities.find(a => a.id === id);
            });


        if (uniqueActivities.length === 0) {
            activitiesContainer.innerHTML = '<p>No hay actividades grupales creadas o individuales asignadas.</p>';
            return;
        }
    
        uniqueActivities.forEach(activity => {
            const submission = studentSubmissions.find(s => s.activityId === activity.id);
            const submissionId = submission ? submission.id : null;
            const currentGrade = submission ? submission.grade : '';
            const title = activity.title || '(Sin Título)';
            const description = activity.description || '(Sin descripción)';
    
            const activityEl = document.createElement('div');
            activityEl.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md';
            activityEl.innerHTML = `
                <div>
                    <p class="font-semibold">${title}</p>
                    <p class="text-sm text-gray-500">${description}</p>
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
                alert("Error: No se pudo identificar al estudiante (UID no encontrado).");
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
                        gradedAt: new Date(),
                        submittedAt: null,
                        fileUrl: null
                    });
                    input.dataset.submissionId = newSubmissionRef.id;
                }
    
                button.textContent = 'Hecho';
                setTimeout(() => {
                    button.textContent = 'Guardar';
                    button.disabled = false;
                }, 2000);
    
            } catch (error) {
                console.error("Error al guardar la calificación:", error);
                button.textContent = 'Error';
                setTimeout(() => {
                     button.textContent = 'Guardar';
                     button.disabled = false;
                }, 3000);
            }
        }
    });
});
