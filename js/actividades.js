// js/actividades.js

import { onAuth, getDb, subscribeGrades } from './firebase.js';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();
let studentsList = [];
let selectedStudentId = null;
let unsubscribeFromActivities = null;

// Referencias al DOM
const studentSelect = document.getElementById('student-select');
const createActivitySection = document.getElementById('create-activity-section');
const activitiesListSection = document.getElementById('activities-list-section');
const studentNameDisplay = document.getElementById('student-name-display');
const activitiesContainer = document.getElementById('activities-container');
const createActivityForm = document.getElementById('create-activity-form');

// --- LÓGICA DE CÁLCULO DE CALIFICACIONES ---

const GRADE_WEIGHTS = {
    UNITS: { unit1: 0.30, unit2: 0.30, unit3: 0.40 },
    UNIT_1_2_TYPES: {
        actividad: 0.25,
        asignacion: 0.25,
        participacion: 0.10,
        examen: 0.40
    }
};

/**
 * El motor principal de cálculo. Se ejecuta cada vez que las actividades cambian.
 * @param {Array<object>} activities - La lista completa de actividades de un estudiante.
 */
async function calculateAndSaveAllGrades(activities) {
    if (!selectedStudentId) return;

    // --- 1. CALCULAR PROMEDIO DE UNIDAD 1 ---
    const unit1Activities = activities.filter(a => a.unit === 'unit1');
    const unit1Score = calculateUnitAverage(unit1Activities);

    // --- 2. CALCULAR PROMEDIO DE UNIDAD 2 ---
    const unit2Activities = activities.filter(a => a.unit === 'unit2');
    const unit2Score = calculateUnitAverage(unit2Activities);
    
    // --- 3. OBTENER CALIFICACIÓN DE UNIDAD 3 (PROYECTO FINAL) ---
    const projectFinalActivity = activities.find(a => a.unit === 'unit3' && a.type === 'proyecto');
    const projectFinalScore = projectFinalActivity ? (projectFinalActivity.score || 0) : 0;

    // --- 4. CALCULAR PROMEDIO GENERAL ---
    const finalGrade = (unit1Score * GRADE_WEIGHTS.UNITS.unit1) +
                       (unit2Score * GRADE_WEIGHTS.UNITS.unit2) +
                       (projectFinalScore * GRADE_WEIGHTS.UNITS.unit3);

    // --- 5. GUARDAR EN FIRESTORE ---
    const studentGradeRef = doc(db, 'grades', selectedStudentId);
    try {
        await updateDoc(studentGradeRef, {
            unit1: parseFloat(unit1Score.toFixed(2)),
            unit2: parseFloat(unit2Score.toFixed(2)),
            projectFinal: parseFloat(projectFinalScore.toFixed(2)), // Anteriormente era 'unit3', lo corregimos a 'projectFinal'
            finalGrade: parseFloat(finalGrade.toFixed(2))
        });
        console.log(`Calificaciones actualizadas para ${selectedStudentId}: U1=${unit1Score.toFixed(2)}, U2=${unit2Score.toFixed(2)}, PF=${projectFinalScore.toFixed(2)}, Final=${finalGrade.toFixed(2)}`);
    } catch (error) {
        console.error("Error al guardar los promedios generales:", error);
    }
}

/**
 * Calcula el promedio ponderado para la Unidad 1 o 2.
 * @param {Array<object>} unitActivities - Actividades de una unidad específica.
 * @returns {number} - El promedio de la unidad (0-100).
 */
function calculateUnitAverage(unitActivities) {
    let weightedScore = 0;
    const types = GRADE_WEIGHTS.UNIT_1_2_TYPES;

    for (const type in types) {
        const activitiesOfType = unitActivities.filter(a => a.type === type);
        if (activitiesOfType.length > 0) {
            const sumOfScores = activitiesOfType.reduce((acc, curr) => acc + (curr.score || 0), 0);
            const averageTypeScore = (sumOfScores / activitiesOfType.length) * 10; // Convertir de base 10 a base 100
            weightedScore += averageTypeScore * types[type];
        }
    }
    return weightedScore;
}


// --- LÓGICA DE LA INTERFAZ (UI) ---

onAuth(user => {
    if (user && localStorage.getItem('qs_role') === 'docente') {
        loadStudents();
        setupEventListeners();
    } else {
        document.body.innerHTML = '<h1 class="text-red-500 text-center mt-10">Acceso Denegado. Esta página es solo para docentes.</h1>';
    }
});

function loadStudents() {
    subscribeGrades(students => {
        studentsList = students;
        studentSelect.innerHTML = ''; // Limpiar opciones anteriores

        if (students.length > 0) {
            studentSelect.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                // Asegurarse de que el nombre no sea undefined
                option.textContent = student.name || `ID: ${student.id}`;
                studentSelect.appendChild(option);
            });
        } else {
            // Si no hay estudiantes, mostrar un mensaje claro.
            studentSelect.innerHTML = '<option value="">No se encontraron estudiantes registrados.</option>';
            studentSelect.disabled = true; // Deshabilitar el select
        }
    });
}

function renderActivities(activities) {
    activitiesContainer.innerHTML = '';
    if (activities.length === 0) {
        activitiesContainer.innerHTML = '<p>Este estudiante no tiene actividades. Crea una para empezar.</p>';
        return;
    }
    activities.forEach(activity => {
        const card = document.createElement('div');
        card.className = 'activity-card bg-white p-4 rounded-lg shadow grid grid-cols-4 gap-4 items-center';
        card.innerHTML = `
            <div class="col-span-2">
                <p class="font-bold text-lg">${activity.activityName}</p>
                <p class="text-sm text-gray-500">Unidad: ${activity.unit.replace('unit', '')} | Tipo: ${activity.type}</p>
            </div>
            <div>
                <label class="block text-sm font-medium">Calificación (0-10)</label>
                <input type="number" step="0.1" min="0" max="10" value="${activity.score || 0}"
                       data-activity-id="${activity.id}"
                       class="score-input mt-1 w-full p-2 border rounded-md">
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
        // ¡Magia! Cada vez que las actividades cambian, se recalcula todo.
        calculateAndSaveAllGrades(activities);
    });
}

function setupEventListeners() {
    studentSelect.addEventListener('change', () => {
        selectedStudentId = studentSelect.value;
        if (selectedStudentId) {
            const student = studentsList.find(s => s.id === selectedStudentId);
            studentNameDisplay.textContent = student.name;
            createActivitySection.style.display = 'block';
            activitiesListSection.style.display = 'block';
            loadActivitiesForStudent(selectedStudentId);
        } else {
            createActivitySection.style.display = 'none';
            activitiesListSection.style.display = 'none';
        }
    });

    createActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedStudentId) return;

        const newActivity = {
            activityName: document.getElementById('activity-name').value,
            unit: document.getElementById('activity-unit').value,
            type: document.getElementById('activity-type').value,
            score: 0
        };

        const activitiesRef = collection(db, 'grades', selectedStudentId, 'activities');
        await addDoc(activitiesRef, newActivity);
        createActivityForm.reset();
    });
    
    activitiesContainer.addEventListener('change', async (e) => {
        if (e.target.classList.contains('score-input')) {
            const input = e.target;
            const activityId = input.dataset.activityId;
            const newScore = parseFloat(input.value) || 0;

            const activityRef = doc(db, 'grades', selectedStudentId, 'activities', activityId);
            await updateDoc(activityRef, { score: newScore });
            // No necesitamos llamar a la función de cálculo aquí, porque el listener onSnapshot ya lo hace automáticamente.
        }
    });
}
