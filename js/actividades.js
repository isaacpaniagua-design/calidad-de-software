
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
import {
    calculateGrades,
    gradeSchema
} from './grade-calculator.js';
import { courseActivities, getActivityById } from './course-activities.js';

initFirebase();
const db = getDb();

document.addEventListener('DOMContentLoaded', async () => {
    // --- Element selectors ---
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

    // --- For Grade Calculation Display ---
    const finalGradeDisplay = document.getElementById('final-grade-display');
    const gradeDetailsContainer = document.getElementById('grade-details-container');
    const unitTemplate = document.getElementById('unit-grade-template');
    const categoryTemplate = document.getElementById('category-grade-template');

    // --- Populate activity dropdowns ---
    function populateActivityDropdowns() {
        let activityOptions = '<option value="">Seleccione una actividad</option>';
        courseActivities.forEach(unit => {
            activityOptions += `<optgroup label="${unit.unitLabel}">`;
            unit.activities.forEach(activity => {
                activityOptions += `<option value="${activity.id}">${activity.title || '(Sin Título)'}</option>`;
            });
            activityOptions += `</optgroup>`;
        });
        individualActivitySelect.innerHTML = activityOptions;
    }
    populateActivityDropdowns();

    // --- Load students into dropdowns ---
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
            console.error("Could not load students.json for names", error);
        }

        const studentsCollection = collection(db, "students");
        onSnapshot(studentsCollection, (snapshot) => {
            let options = '<option value="">Seleccione un estudiante</option>';
            const studentDocs = snapshot.docs.sort((a, b) => {
                const nameA = studentNameMap.get(a.data().email?.toLowerCase()) || a.data().displayName || '';
                const nameB = studentNameMap.get(b.data().email?.toLowerCase()) || b.data().displayName || '';
                return nameA.localeCompare(nameB);
            });

            studentDocs.forEach(doc => {
                const student = doc.data();
                const studentName = studentNameMap.get(student.email?.toLowerCase()) || student.displayName || '(Sin Nombre)';
                options += `<option value="${doc.id}" data-uid="${student.authUid || ''}">${studentName}</option>`;
            });
            studentSelectForGrading.innerHTML = options;
            studentSelectForIndividual.innerHTML = options;
        });
    }
    await loadStudentDropdowns();

    // --- Teacher Actions: Create Group/Individual Activities ---
    createGroupActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('group-activity-name').value.trim();
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
            await addDoc(collection(db, "activities"), {
                title: name, description: `Actividad de tipo ${type} para la ${unit}`, unit, type, createdAt: new Date()
            });
            batchStatus.textContent = `Actividad "${name}" creada exitosamente.`;
            createGroupActivityForm.reset();
        } catch (error) {
            console.error("Error al crear actividad grupal:", error);
            batchStatus.textContent = "Error al crear la actividad.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Añadir Actividad a Todos";
        }
    });

    assignIndividualActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentDocId = studentSelectForIndividual.value;
        const studentUid = studentSelectForIndividual.options[studentSelectForIndividual.selectedIndex].dataset.uid;
        const activityId = individualActivitySelect.value;
        if (!studentDocId || !activityId) {
            individualStatus.textContent = "Debe seleccionar un estudiante y una actividad.";
            return;
        }

        const submitButton = document.getElementById('submit-individual-activity');
        submitButton.disabled = true;
        submitButton.textContent = "Asignando...";
        try {
            // Check if a submission already exists
            const q = query(collection(db, "submissions"), where("studentUid", "==", studentUid), where("activityId", "==", activityId));
            const existing = await getDocs(q);
            if (!existing.empty) {
                individualStatus.textContent = "Este estudiante ya tiene una entrega para esta actividad.";
                return;
            }
            await addDoc(collection(db, "submissions"), {
                studentUid, activityId, grade: null, fileUrl: null, submittedAt: null, assignedAt: new Date()
            });
            individualStatus.textContent = `Entrega asignada exitosamente.`;
        } catch (error) {
            console.error("Error al asignar actividad:", error);
            individualStatus.textContent = "Error al asignar la actividad.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Asignar a Estudiante";
        }
    });

    // --- Main Grading Logic ---
    let currentSubmissionsUnsubscribe = null;
    studentSelectForGrading.addEventListener('change', (e) => {
        if (currentSubmissionsUnsubscribe) {
            currentSubmissionsUnsubscribe(); // Stop listening to the previous student's grades
        }
        const studentId = e.target.value;
        if (studentId) {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const studentName = selectedOption.text;
            const studentUid = selectedOption.dataset.uid;
            studentNameDisplay.textContent = studentName;
            activitiesListSection.style.display = 'block';

            if (studentUid) {
                subscribeToStudentSubmissions(studentUid);
            } else {
                console.error("Selected student has no UID.");
                activitiesContainer.innerHTML = '<p class="text-red-500">Error: Este estudiante no tiene un UID de autenticación asignado.</p>';
            }
        } else {
            activitiesListSection.style.display = 'none';
        }
    });

    function subscribeToStudentSubmissions(studentUid) {
        const submissionsQuery = query(collection(db, "submissions"), where("studentUid", "==", studentUid));
        currentSubmissionsUnsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayCalculatedGrades(submissions);
            displayGradingInputs(submissions, studentUid);
        }, (error) => {
            console.error("Error fetching student submissions:", error);
            activitiesContainer.innerHTML = `<p>Error al cargar las entregas del estudiante.</p>`;
        });
    }

    function displayCalculatedGrades(submissions) {
        const gradeResults = calculateGrades(submissions);
        finalGradeDisplay.textContent = gradeResults.finalGrade.toFixed(2);
        gradeDetailsContainer.innerHTML = ''; // Clear previous details

        for (const unitId in gradeResults.units) {
            const unitData = gradeResults.units[unitId];
            const unitSchema = gradeSchema[unitId];
            if (!unitSchema) continue;

            const unitCard = unitTemplate.content.cloneNode(true);
            unitCard.querySelector('.unit-title').textContent = courseActivities.find(u => u.unitId === unitId)?.unitLabel || `Unidad ${unitId}`;
            unitCard.querySelector('.unit-score').textContent = unitData.unitScore.toFixed(2);
            unitCard.querySelector('.unit-weight').textContent = `(Ponderación: ${unitSchema.weight * 100}%)`;
            const categoryBreakdown = unitCard.querySelector('.category-breakdown');

            for (const categoryId in unitData.categories) {
                const categoryData = unitData.categories[categoryId];
                const categorySchema = unitSchema.categories[categoryId];
                if (!categorySchema) continue;

                const categoryItem = categoryTemplate.content.cloneNode(true);
                categoryItem.querySelector('.category-label').textContent = categorySchema.label;
                categoryItem.querySelector('.category-score').textContent = `${categoryData.score.toFixed(2)} / 100`;
                categoryItem.querySelector('.category-weight').textContent = `(${categoryData.weightedScore.toFixed(2)} pts)`;
                categoryBreakdown.appendChild(categoryItem);
            }
            gradeDetailsContainer.appendChild(unitCard);
        }
    }

    function displayGradingInputs(submissions, studentUid) {
        const allCourseActivities = courseActivities.flatMap(unit => unit.activities.map(act => ({ ...act, unitId: unit.unitId })));
        activitiesContainer.innerHTML = '';
        
        if(allCourseActivities.length === 0) {
            activitiesContainer.innerHTML = '<p>No hay actividades definidas en el curso.</p>';
            return;
        }

        allCourseActivities.forEach(activity => {
            const submission = submissions.find(s => s.activityId === activity.id);
            const activityEl = document.createElement('div');
            activityEl.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md';
            activityEl.innerHTML = `
                <div>
                    <p class="font-semibold">${activity.title}</p>
                    <p class="text-sm text-gray-500">${getActivityById(activity.id)?.unitLabel || 'N/A'}</p>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" min="0" max="100" placeholder="N/A"
                           class="grade-input w-20 p-1 border border-gray-300 rounded-md text-center"
                           value="${submission?.grade ?? ''}"
                           data-activity-id="${activity.id}"
                           data-submission-id="${submission?.id || ''}"
                           data-student-uid="${studentUid}">
                    <button class="save-grade-btn bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600">Guardar</button>
                </div>
            `;
            activitiesContainer.appendChild(activityEl);
        });
    }

    activitiesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('save-grade-btn')) {
            const button = e.target;
            const input = button.closest('.flex').querySelector('.grade-input');
            const grade = input.value;
            const activityId = input.dataset.activityId;
            let submissionId = input.dataset.submissionId;
            const studentUid = input.dataset.studentUid;

            button.disabled = true;
            button.textContent = '...';

            try {
                if (submissionId) {
                    const submissionRef = doc(db, "submissions", submissionId);
                    await updateDoc(submissionRef, { grade: Number(grade), gradedAt: new Date() });
                } else {
                    const newSubmissionRef = await addDoc(collection(db, "submissions"), {
                        studentUid, activityId, grade: Number(grade), gradedAt: new Date(), assignedAt: new Date()
                    });
                    input.dataset.submissionId = newSubmissionRef.id; // Update for subsequent saves
                }
                button.textContent = 'Hecho';
                setTimeout(() => { button.textContent = 'Guardar'; button.disabled = false; }, 2000);
            } catch (error) {
                console.error("Error al guardar la calificación:", error);
                button.textContent = 'Error';
                setTimeout(() => { button.textContent = 'Guardar'; button.disabled = false; }, 3000);
            }
        }
    });
});