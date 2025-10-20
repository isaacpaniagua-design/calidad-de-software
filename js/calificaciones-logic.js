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
import {
    getActivityById
} from './course-activities.js';

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
    const activityBreakdownContainer = document.getElementById('activity-breakdown-container');
    const activityList = document.getElementById('activity-list');
    const activityItemTemplate = document.getElementById('activity-item-template');

    onAuthStateChanged(auth, user => {
        if (user) {
            studentNameEl.textContent = user.displayName || 'Usuario sin nombre';
            studentIdEl.textContent = user.email || 'No disponible';
            subscribeToStudentSubmissions(user.uid);
        } else {
            console.log("No user is signed in.");
            gradeDetailsContainer.innerHTML = '<p>Por favor, inicia sesión para ver tus calificaciones.</p>';
            activityBreakdownContainer.style.display = 'none';
        }
    });

    function subscribeToStudentSubmissions(uid) {
        const submissionsQuery = query(collection(db, 'submissions'), where('studentUid', '==', uid));

        onSnapshot(submissionsQuery, async (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            await processAndDisplaySubmissions(submissions);
        }, (error) => {
            console.error("Error al obtener las calificaciones:", error);
            noGradesMessage.textContent = 'Error al cargar las calificaciones.';
            noGradesMessage.style.display = 'block';
            activityBreakdownContainer.style.display = 'none';
        });
    }

    async function processAndDisplaySubmissions(submissions) {
        if (submissions.length === 0) {
            noGradesMessage.style.display = 'block';
            finalGradeDisplay.textContent = "N/A";
            gradeDetailsContainer.innerHTML = '';
            activityBreakdownContainer.style.display = 'none';
            return;
        }

        noGradesMessage.style.display = 'none';
        gradeDetailsContainer.innerHTML = '';

        const gradeResults = calculateGrades(submissions);
        finalGradeDisplay.textContent = gradeResults.finalGrade.toFixed(2);

        for (const unitId in gradeResults.units) {
            const unitData = gradeResults.units[unitId];
            const unitSchema = gradeSchema[unitId];
            if (!unitSchema) continue;

            const unitCard = unitTemplate.content.cloneNode(true);
            const unitTitle = unitCard.querySelector('.unit-title');
            const unitScore = unitCard.querySelector('.unit-score');
            const unitWeight = unitCard.querySelector('.unit-weight');
            const categoryBreakdown = unitCard.querySelector('.category-breakdown');

            unitTitle.textContent = unitSchema.label || `Unidad ${unitId}`;
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

        await displayActivityBreakdown(submissions);
    }

    async function displayActivityBreakdown(submissions) {
        activityList.innerHTML = '';

        const activityPromises = submissions.map(async (submission) => {
            const activity = await getActivityById(submission.activityId);
            return {
                submission,
                activity
            };
        });

        const results = await Promise.all(activityPromises);

        if (results.length > 0) {
            activityBreakdownContainer.style.display = 'block';
        } else {
            activityBreakdownContainer.style.display = 'none';
            return;
        }

        results.forEach(({
            submission,
            activity
        }) => {
            if (!activity) {
                console.warn(`Activity details not found for ID: ${submission.activityId}`);
                return;
            }

            const item = activityItemTemplate.content.cloneNode(true);
            const nameEl = item.querySelector('.activity-name');
            const statusEl = item.querySelector('.activity-status');
            const gradeEl = item.querySelector('.activity-grade');
            const linkEl = item.querySelector('.activity-submission-link');

            nameEl.textContent = activity.title || 'Actividad sin título';

            if (submission.grade !== undefined && submission.grade !== null) {
                statusEl.textContent = 'Calificada';
                gradeEl.textContent = `Calificación: ${submission.grade}`;
                statusEl.classList.add('status-graded');
            } else {
                statusEl.textContent = 'Entregada';
                gradeEl.textContent = 'Pendiente';
                statusEl.classList.add('status-submitted');
            }

            if (submission.fileUrl) {
                linkEl.href = submission.fileUrl;
            } else {
                linkEl.style.display = 'none';
            }

            activityList.appendChild(item);
        });
    }
});