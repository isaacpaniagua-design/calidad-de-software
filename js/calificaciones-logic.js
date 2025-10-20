// En: js/calificaciones-logic.js

import {
    getDb,
    getAuth
} from './firebase.js';
import {
    collection,
    query,
    where,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import {
    calculateGrades,
    gradeSchema
} from './grade-calculator.js';
import { getActivityById } from './course-activities.js';

const db = getDb();
const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    const studentNameEl = document.getElementById('student-name');
    const studentIdEl = document.getElementById('student-id');
    const finalGradeDisplay = document.getElementById('final-grade-display');
    const gradeDetailsContainer = document.getElementById('grade-details-container');
    const noGradesMessage = document.getElementById('no-grades-message');
    const unitTemplate = document.getElementById('unit-grade-template');
    const categoryTemplate = document.getElementById('category-grade-template');

    onAuthStateChanged(auth, user => {
        if (user) {
            studentNameEl.textContent = user.displayName || 'Usuario sin nombre';
            studentIdEl.textContent = user.email || 'No disponible';
            subscribeToStudentSubmissions(user.uid);
        } else {
            console.log("No user is signed in.");
            gradeDetailsContainer.innerHTML = '<p class="text-center text-red-500">No has iniciado sesión. Por favor, inicia sesión para ver tus calificaciones.</p>';
        }
    });

    function subscribeToStudentSubmissions(uid) {
        const submissionsQuery = query(collection(db, 'submissions'), where('studentUid', '==', uid));

        onSnapshot(submissionsQuery, (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayCalculatedGrades(submissions);
        }, (error) => {
            console.error("Error al obtener las calificaciones:", error);
            noGradesMessage.textContent = 'Error al cargar las calificaciones.';
            noGradesMessage.classList.remove('hidden');
        });
    }

    function displayCalculatedGrades(submissions) {
        if (submissions.length === 0) {
            noGradesMessage.classList.remove('hidden');
            finalGradeDisplay.textContent = "N/A";
            gradeDetailsContainer.innerHTML = '';
            return;
        }

        noGradesMessage.classList.add('hidden');
        gradeDetailsContainer.innerHTML = ''; // Clear previous content

        const gradeResults = calculateGrades(submissions);

        // Update final grade display
        finalGradeDisplay.textContent = gradeResults.finalGrade.toFixed(2);

        // Populate the detailed breakdown
        for (const unitId in gradeResults.units) {
            const unitData = gradeResults.units[unitId];
            const unitSchema = gradeSchema[unitId];
            if (!unitSchema) continue;

            const unitCard = unitTemplate.content.cloneNode(true);
            const unitTitle = unitCard.querySelector('.unit-title');
            const unitScore = unitCard.querySelector('.unit-score');
            const unitWeight = unitCard.querySelector('.unit-weight');
            const categoryBreakdown = unitCard.querySelector('.category-breakdown');

            // Find the unit label from courseActivities
            const unitInfo = courseActivities.find(u => u.unitId === unitId);
            unitTitle.textContent = unitInfo ? unitInfo.unitLabel : `Unidad ${unitId}`;
            
            unitScore.textContent = unitData.unitScore.toFixed(2);
            unitWeight.textContent = `(Ponderación: ${unitSchema.weight * 100}%)`;

            for (const categoryId in unitData.categories) {
                const categoryData = unitData.categories[categoryId];
                const categorySchema = unitSchema.categories[categoryId];
                if (!categorySchema) continue;

                const categoryItem = categoryTemplate.content.cloneNode(true);
                const categoryLabel = categoryItem.querySelector('.category-label');
                const categoryScore = categoryItem.querySelector('.category-score');
                const categoryWeight = categoryItem.querySelector('.category-weight');

                categoryLabel.textContent = categorySchema.label;
                categoryScore.textContent = `${categoryData.score.toFixed(2)} / 100`;
                categoryWeight.textContent = `(${categoryData.weightedScore.toFixed(2)} pts)`;

                categoryBreakdown.appendChild(categoryItem);
            }
            gradeDetailsContainer.appendChild(unitCard);
        }
    }
});
