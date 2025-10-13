// js/actividades.js

import { onAuth, getDb, subscribeGrades } from './firebase.js';
import { collection, doc, updateDoc, onSnapshot, query, orderBy, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();
let studentsList = [];
let selectedStudentId = null;
let unsubscribeFromActivities = null;

// Referencias al DOM
const studentSelect = document.getElementById('student-select');
const activitiesListSection = document.getElementById('activities-list-section');
const studentNameDisplay = document.getElementById('student-name-display');
const activitiesContainer = document.getElementById('activities-container');
const mainContent = document.querySelector('.container.mx-auto');
const createGroupActivityForm = document.getElementById('create-group-activity-form');
const submitGroupActivityBtn = document.getElementById('submit-group-activity');
const batchStatusDiv = document.getElementById('batch-status');

// --- LÓGICA DE CÁLCULO DE CALIFICACIONES (Tu código original - sin cambios) ---

const GRADE_WEIGHTS = {
    UNITS: { unit1: 0.30, unit2: 0.30, unit3: 0.40 },
    UNIT_1_2_TYPES: {
        actividad: 0.25,
        asignacion: 0.25,
        participacion: 0.10,
        examen: 0.40
    }
};

async function calculateAndSaveAllGrades(activities) {
    if (!selectedStudentId) return;

    const unit1Activities = activities.filter(a => a.unit === 'unit1');
    const unit1Score = calculateUnitAverage(unit1Activities);

    const unit2Activities = activities.filter(a => a.unit === 'unit2');
    const unit2Score = calculateUnitAverage(unit2Activities);
    
    const projectFinalActivity = activities.find(a => a.unit === 'unit3' && a.type === 'proyecto') || activities.find(a => a.type === 'proyecto');
    const projectFinalScore = projectFinalActivity ? (projectFinalActivity.score || 0) : 0;

    const finalGrade = (unit1Score * GRADE_WEIGHTS.UNITS.unit1) +
                       (unit2Score * GRADE_WEIGHTS.UNITS.unit2) +
                       (projectFinalScore * GRADE_WEIGHTS.UNITS.unit3);

    const studentGradeRef = doc(db, 'grades', selectedStudentId);
    try {
        await updateDoc(studentGradeRef, {
            unit1: parseFloat(unit1Score.toFixed(2)),
            unit2: parseFloat(unit2Score.toFixed(2)),
            projectFinal: parseFloat(projectFinalScore.toFixed(2)),
            finalGrade: parseFloat(finalGrade.toFixed(2))
        });
        console.log(`Calificaciones actualizadas para ${selectedStudentId}: U1=${unit1Score.toFixed(2)}, U2=${unit2Score.toFixed(2)}, PF=${projectFinalScore.toFixed(2)}, Final=${finalGrade.toFixed(2)}`);
    } catch (error) {
        console.error("Error al guardar los promedios generales:", error);
    }
}

function calculateUnitAverage(unitActivities) {
    let weightedScore = 0;
    const types = GRADE_WEIGHTS.UNIT_1_2_TYPES;

    for (const type in types) {
        const activitiesOfType = unitActivities.filter(a => a.type === type);
        if (activitiesOfType.length > 0) {
            const sumOfScores = activitiesOfType.reduce((acc, curr) => acc + (curr.score || 0), 0);
            const averageTypeScore = (sumOfScores / activitiesOfType.length) * 10;
            weightedScore += averageTypeScore * types[type];
        }
    }
    return weightedScore;
}


// --- LÓGICA DE LA INTERFAZ (UI) ---

// CORRECCIÓN CLAVE: Envolvemos la lógica principal en una función exportable.
export function initActividadesPage(user) {
    const isTeacher = user && (localStorage.getItem('qs_role') || '').toLowerCase() === 'docente';
    
    if (isTeacher) {
        if(mainContent) mainContent.style.display = 'block';
        loadStudents();
        setupEventListeners();
    } else {
        if(mainContent) mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
    }
}

// El resto de tus funciones se mantienen exactamente igual, ahora son llamadas por initActividadesPage.

function loadStudents() {
    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Cargando estudiantes...</option>';

    subscribeGrades(students => {
        studentsList = students.filter(s => s.id);
        studentSelect.innerHTML = '';

        if (studentsList.length > 0) {
            studentSelect.innerHTML = '<option value="">-- Seleccione un estudiante para calificar --</option>';
            studentsList.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = student.name || `Estudiante sin nombre (ID: ${student.id})`;
                studentSelect.appendChild(option);
            });
            studentSelect.disabled = false;
        } else {
            studentSelect.innerHTML = '<option value="">No hay estudiantes para mostrar.</option>';
        }
    });
}

function renderActivities(activities) {
    activitiesContainer.innerHTML = '';
    if (activities.length === 0) {
        activitiesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Este estudiante no tiene actividades. ¡Crea una para empezar!</p>';
        return;
    }
    activities.forEach(activity => {
        const card = document.createElement('div');
        card.className = 'activity-card bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-4 gap-4 items-center';
        card.innerHTML = `
            <div class="col-span-1 md:col-span-2">
                <p class="font-bold text-lg">${activity.activityName}</p>
                <p class="text-sm text-gray-500">Unidad: ${activity.unit.replace('unit', '')} | Tipo: ${activity.type}</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Calificación (0-10)</label>
                <input type="number" step="0.1" min="0" max="10" value="${activity.score || 0}"
                       data-activity-id="${activity.id}"
                       class="score-input mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div class="text-right">
              <button data-action="delete-activity" data-activity-id="${activity.id}" class="bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-md hover:bg-red-200 transition">Eliminar</button>
            </div>
        `;
        activitiesContainer.appendChild(card);
    });
}

function loadActivitiesForStudent(studentId) {
    if (unsubscribeFromActivities) unsubscribeFromActivities();

    const activitiesRef = collection(db, 'grades', studentId, 'activities');
    const q = query(activitiesRef, orderBy('activityName'));

    unsubscribeFromActivities = onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderActivities(activities);
        calculateAndSaveAllGrades(activities);
    }, (error) => {
        console.error("Error al cargar actividades:", error);
        activitiesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar las actividades. Revisa los permisos de la base de datos.</p>';
    });
}

function setupEventListeners() {
    studentSelect.addEventListener('change', () => {
        selectedStudentId = studentSelect.value;
        if (selectedStudentId) {
            const student = studentsList.find(s => s.id === selectedStudentId);
            studentNameDisplay.textContent = student.name;
            activitiesListSection.style.display = 'block';
            loadActivitiesForStudent(selectedStudentId);
        } else {
            activitiesListSection.style.display = 'none';
        }
    });

    createGroupActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (studentsList.length === 0) {
            alert("No hay estudiantes cargados para asignar la actividad.");
            return;
        }

        const activityName = document.getElementById('group-activity-name').value.trim();
        if (!activityName) {
            alert("El nombre de la actividad no puede estar vacío.");
            return;
        }

        const newActivityData = {
            activityName: activityName,
            unit: document.getElementById('group-activity-unit').value,
            type: document.getElementById('group-activity-type').value,
            score: 0
        };

        submitGroupActivityBtn.disabled = true;
        submitGroupActivityBtn.textContent = 'Procesando...';
        batchStatusDiv.textContent = `Asignando actividad a ${studentsList.length} estudiantes...`;
        batchStatusDiv.className = 'text-blue-600';

        try {
            const batch = writeBatch(db);

            studentsList.forEach(student => {
                const activityRef = doc(collection(db, 'grades', student.id, 'activities'));
                batch.set(activityRef, newActivityData);
            });

            await batch.commit();

            batchStatusDiv.textContent = `¡Éxito! La actividad "${activityName}" fue asignada a todos los estudiantes.`;
            batchStatusDiv.className = 'text-green-600 font-semibold';
            createGroupActivityForm.reset();

        } catch (error) {
            console.error("Error al crear actividad en lote:", error);
            batchStatusDiv.textContent = "Error: No se pudo asignar la actividad. Revisa la consola.";
            batchStatusDiv.className = 'text-red-600 font-semibold';
            alert("Ocurrió un error al asignar la actividad en lote.");
        } finally {
            submitGroupActivityBtn.disabled = false;
            submitGroupActivityBtn.textContent = 'Añadir Actividad a Todos';
            setTimeout(() => { batchStatusDiv.textContent = ''; }, 5000);
        }
    });
    
    activitiesContainer.addEventListener('change', async (e) => {
        if (e.target.classList.contains('score-input')) {
            const input = e.target;
            const activityId = input.dataset.activityId;
            let newScore = parseFloat(input.value);

            if (isNaN(newScore) || newScore < 0) newScore = 0;
            if (newScore > 10) newScore = 10;
            input.value = newScore;

            const activityRef = doc(db, 'grades', selectedStudentId, 'activities', activityId);
            await updateDoc(activityRef, { score: newScore });
        }
    });

    activitiesContainer.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button[data-action="delete-activity"]');
        if (targetButton) {
            const activityId = targetButton.dataset.activityId;
            if (confirm(`¿Estás seguro de que quieres eliminar esta actividad? Esta acción no se puede deshacer.`)) {
                try {
                    const activityRef = doc(db, 'grades', selectedStudentId, 'activities', activityId);
                    await deleteDoc(activityRef);
                } catch (error) {
                    console.error("Error al eliminar actividad:", error);
                    alert("No se pudo eliminar la actividad.");
                }
            }
        }
    });
}
