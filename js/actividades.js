import {
    initFirebase,
    getDb
} from './firebase.js';
import {
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js';
import {
    collection,
    getDocs,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
    calculateGrades
} from './grade-calculator.js';

// --- INITIALIZATION ---
initFirebase();
const db = getDb();
const functions = getFunctions();

// --- DOM ELEMENTS ---
const rosterContainer = document.getElementById('student-roster-container');
const rosterItemTemplate = document.getElementById('student-roster-item-template');
const detailedViewCard = document.getElementById('detailed-view-card');
const detailedStudentName = document.getElementById('detailed-student-name');
const closeDetailedViewBtn = document.getElementById('close-detailed-view');
const gradeSummarySection = document.getElementById('grade-summary-section');
const activitiesContainer = document.getElementById('activities-container');

// --- STATE ---
let allStudents = [];
let allSubmissions = [];

// --- DATA FETCHING & RENDERING ---
async function initializeDashboard() {
    // 1. Fetch all students from the Firebase Function
    try {
        const listUsers = httpsCallable(functions, 'listUsers');
        const userRecords = await listUsers();
        allStudents = userRecords.data.users;
    } catch (error) {
        console.error("Error fetching students:", error);
        rosterContainer.innerHTML = '<p class="error-message">No se pudieron cargar los estudiantes.</p>';
        return;
    }

    // 2. Listen for real-time updates on all submissions
    const submissionsQuery = collection(db, "submissions");
    onSnapshot(submissionsQuery, (snapshot) => {
        allSubmissions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        renderStudentRoster();
    }, (error) => {
        console.error("Error fetching submissions:", error);
        rosterContainer.innerHTML = '<p class="error-message">No se pudieron cargar las entregas.</p>';
    });
}

function renderStudentRoster() {
    rosterContainer.innerHTML = ''; // Clear previous state

    if (allStudents.length === 0) {
        rosterContainer.innerHTML = '<p>No hay estudiantes registrados.</p>';
        return;
    }

    allStudents.forEach(student => {
        const studentSubmissions = allSubmissions.filter(sub => sub.studentUid === student.uid);
        const gradeResults = calculateGrades(studentSubmissions);

        const rosterItem = rosterItemTemplate.content.cloneNode(true);
        rosterItem.querySelector('.roster-student-name').textContent = student.displayName || student.email;
        rosterItem.querySelector('.roster-final-grade').textContent = gradeResults.finalGrade.toFixed(2);

        const rosterElement = rosterItem.querySelector('.roster-item');
        rosterElement.dataset.studentId = student.uid;
        rosterElement.addEventListener('click', () => showDetailedView(student.uid));

        rosterContainer.appendChild(rosterItem);
    });
}

function showDetailedView(studentId) {
    const student = allStudents.find(s => s.uid === studentId);
    if (!student) return;

    detailedStudentName.textContent = `Calificaciones para ${student.displayName}`;

    // Render grade summary and grading inputs (similar to before, but for the selected student)
    const studentSubmissions = allSubmissions.filter(sub => sub.studentUid === studentId);
    // (Code to render the detailed grade breakdown and the grading form would go here)

    detailedViewCard.style.display = 'block';
}

function hideDetailedView() {
    detailedViewCard.style.display = 'none';
}

// --- EVENT LISTENERS ---
closeDetailedViewBtn.addEventListener('click', hideDetailedView);

// --- INITIALIZE ---
initializeDashboard();
