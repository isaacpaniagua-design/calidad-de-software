import {
    initFirebase,
    getDb
} from './firebase.js';
import {
    getAuth,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import {
    collection,
    query,
    where,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
    calculateGrades,
    gradeSchema
} from './grade-calculator.js';
import { courseActivities } from './course-activities.js';

// --- INITIALIZATION ---
initFirebase();
const db = getDb();
const auth = getAuth();

// --- DOM ELEMENTS ---
const studentNameEl = document.getElementById('student-name');
const studentIdEl = document.getElementById('student-id');
const finalGradeDisplay = document.getElementById('final-grade-display');
const gradeDetailsContainer = document.getElementById('grade-details-container');
const noGradesMessage = document.getElementById('no-grades-message');
const unitTemplate = document.getElementById('unit-grade-template');
const categoryTemplate = document.getElementById('category-grade-template');

let unsubscribe = null; // To stop listening to updates when the user logs out

// --- AUTHENTICATION LISTENER ---
onAuthStateChanged(auth, user => {
    if (unsubscribe) {
        unsubscribe(); // Unsubscribe from previous listener if it exists
        unsubscribe = null;
    }

    if (user) {
        // User is signed in
        studentNameEl.textContent = user.displayName || 'No disponible';
        studentIdEl.textContent = user.email ? user.email.split('@')[0] : 'No disponible';

        // Subscribe to real-time updates for this student's submissions
        const submissionsQuery = query(collection(db, "submissions"), where("studentUid", "==", user.uid));
        unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayGrades(submissions);
        }, (error) => {
            console.error("Error fetching student submissions:", error);
            noGradesMessage.style.display = 'block';
            gradeDetailsContainer.innerHTML = '';
        });
    } else {
        // User is signed out
        studentNameEl.textContent = 'No ha iniciado sesión';
        studentIdEl.textContent = 'N/A';
        finalGradeDisplay.textContent = '0.00';
        gradeDetailsContainer.innerHTML = '';
        noGradesMessage.style.display = 'block';
        noGradesMessage.querySelector('p').textContent = 'Inicia sesión para ver tus calificaciones.';
    }
});

// --- UI RENDERING FUNCTIONS ---
function displayGrades(submissions) {
    if (!submissions || submissions.length === 0) {
        finalGradeDisplay.textContent = '0.00';
        noGradesMessage.style.display = 'block';
        gradeDetailsContainer.innerHTML = '';
        return;
    }

    noGradesMessage.style.display = 'none';
    gradeDetailsContainer.innerHTML = ''; // Clear previous content

    const gradeResults = calculateGrades(submissions);

    // Display final grade
    finalGradeDisplay.textContent = gradeResults.finalGrade.toFixed(2);

    // Display detailed breakdown per unit
    for (const unitId in gradeResults.units) {
        const unitData = gradeResults.units[unitId];
        const unitSchema = gradeSchema[unitId];
        const unitConfig = courseActivities.find(u => u.unitId === unitId);

        if (!unitSchema || !unitConfig) continue;

        const unitCard = unitTemplate.content.cloneNode(true);
        unitCard.querySelector('.unit-title').textContent = unitConfig.unitLabel;
        unitCard.querySelector('.unit-weight').textContent = `Ponderación: ${unitSchema.weight * 100}%`;
        unitCard.querySelector('.unit-score').textContent = unitData.unitScore.toFixed(2);

        const categoryBreakdown = unitCard.querySelector('.category-breakdown');
        categoryBreakdown.innerHTML = ''; // Clear template content

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
