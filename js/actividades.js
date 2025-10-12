// js/actividades.js

import { onAuth, getDb, subscribeGrades } from './firebase.js';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

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
const mainContent = document.querySelector('.container.mx-auto'); // Contenedor principal

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
    // Corregido: Busca tipo 'proyecto' en unidad 3, si no existe, busca en las demás.
    const projectFinalActivity = activities.find(a => a.unit === 'unit3' && a.type === 'proyecto') || activities.find(a => a.type === 'proyecto');
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
            projectFinal: parseFloat(projectFinalScore.toFixed(2)),
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
    const isTeacher = user && localStorage.getItem('qs_role') === 'docente';
    
    if (isTeacher) {
        // Si es docente, nos aseguramos de que el contenido principal sea visible
        if(mainContent) mainContent.style.display = 'block';
        loadStudents();
        setupEventListeners();
    } else {
        // Si no es docente, ocultamos el contenido y mostramos un error sin destruir la página
        if(mainContent) mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
    }
});

function loadStudents() {
    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option>Cargando estudiantes...</option>';

    subscribeGrades(students => {
        studentsList = students;
        studentSelect.innerHTML = ''; // Limpiar

        if (students && students.length > 0) {
            studentSelect.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = student.name || `Estudiante sin nombre (ID: ${student.id})`;
                studentSelect.appendChild(option);
            });
            studentSelect.disabled = false;
        } else {
            // Si no hay estudiantes, mostramos un mensaje claro y mantenemos el select deshabilitado
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
        // ¡Magia! Cada vez que las actividades cambian, se recalcula todo.
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
            // Mostramos las secciones correspondientes
            createActivitySection.style.display = 'block';
            activitiesListSection.style.display = 'block';
            loadActivitiesForStudent(selectedStudentId);
        } else {
            // Si se deselecciona, ocultamos todo
            createActivitySection.style.display = 'none';
            activitiesListSection.style.display = 'none';
        }
    });

    createActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedStudentId) {
            alert("Por favor, seleccione un estudiante antes de crear una actividad.");
            return;
        }

        const newActivity = {
            activityName: document.getElementById('activity-name').value.trim(),
            unit: document.getElementById('activity-unit').value,
            type: document.getElementById('activity-type').value,
            score: 0 // Inicia con calificación 0
        };

        if (!newActivity.activityName) {
            alert("El nombre de la actividad no puede estar vacío.");
            return;
        }

        const activitiesRef = collection(db, 'grades', selectedStudentId, 'activities');
        await addDoc(activitiesRef, newActivity);
        createActivityForm.reset();
    });
    
    activitiesContainer.addEventListener('change', async (e) => {
        if (e.target.classList.contains('score-input')) {
            const input = e.target;
            const activityId = input.dataset.activityId;
            let newScore = parseFloat(input.value);

            // Validar que la calificación esté en el rango 0-10
            if (isNaN(newScore) || newScore < 0) newScore = 0;
            if (newScore > 10) newScore = 10;
            input.value = newScore; // Corregir el valor en la UI si está fuera de rango

            const activityRef = doc(db, 'grades', selectedStudentId, 'activities', activityId);
            await updateDoc(activityRef, { score: newScore });
            // No necesitamos llamar a la función de cálculo aquí, porque el listener onSnapshot ya lo hace automáticamente.
        }
    });

    // Event listener para el botón de eliminar usando delegación de eventos
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
