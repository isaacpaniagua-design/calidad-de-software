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
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
    calculateGrades
} from './grade-calculator.js';
import { courseActivities } from './course-activities.js';

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
const activitiesContainer = document.getElementById('activities-container');
const assignGroupActivityForm = document.getElementById('assign-group-activity-form');
const assignIndividualActivityForm = document.getElementById('assign-individual-activity-form');
const groupActivitySelect = document.getElementById('group-activity-select');
const individualStudentSelect = document.getElementById('individual-student-select');
const individualActivitySelect = document.getElementById('individual-activity-select');
const batchStatus = document.getElementById('batch-status');
const individualStatus = document.getElementById('individual-status');

// --- STATE ---
let allStudents = [];
let allSubmissions = [];
let selectedStudentId = null;

// --- DATA FETCHING & RENDERING ---
async function initializeDashboard() {
    try {
        const listUsers = httpsCallable(functions, 'listUsers');
        const userRecords = await listUsers();
        allStudents = userRecords.data.users.filter(u => u.email !== 'isaac.paniagua@potros.itson.edu.mx');
        populateSelects();
    } catch (error) {
        console.error("Error fetching students:", error);
        rosterContainer.innerHTML = '<p class="error-message">No se pudieron cargar los estudiantes.</p>';
        return;
    }

    const submissionsQuery = collection(db, "submissions");
    onSnapshot(submissionsQuery, (snapshot) => {
        allSubmissions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        renderStudentRoster();
        if (selectedStudentId) {
            showDetailedView(selectedStudentId, false);
        }
    });
}

function populateSelects() {
    individualStudentSelect.innerHTML = '';
    allStudents.forEach(student => {
        const option = new Option(student.displayName || student.email, student.uid);
        individualStudentSelect.add(option);
    });

    groupActivitySelect.innerHTML = '';
    individualActivitySelect.innerHTML = '';
    courseActivities.forEach(unit => {
        unit.activities.forEach(activity => {
            const option = new Option(`${activity.name} (${unit.unitLabel})`, activity.id);
            groupActivitySelect.add(option.cloneNode(true));
            individualActivitySelect.add(option);
        });
    });
}

function renderStudentRoster() {
    rosterContainer.innerHTML = '';
    allStudents.forEach(student => {
        const studentSubmissions = allSubmissions.filter(sub => sub.studentUid === student.uid);
        const gradeResults = calculateGrades(studentSubmissions);
        const rosterItem = rosterItemTemplate.content.cloneNode(true);
        rosterItem.querySelector('.roster-student-name').textContent = student.displayName || student.email;
        rosterItem.querySelector('.roster-final-grade').textContent = gradeResults.finalGrade.toFixed(2);
        const rosterElement = rosterItem.querySelector('.roster-item');
        rosterElement.dataset.studentId = student.uid;
        rosterElement.addEventListener('click', () => showDetailedView(student.uid, true));
        rosterContainer.appendChild(rosterItem);
    });
}

function showDetailedView(studentId, shouldShowCard) {
    selectedStudentId = studentId;
    const student = allStudents.find(s => s.uid === studentId);
    if (!student) return;

    detailedStudentName.textContent = `${student.displayName}`;
    activitiesContainer.innerHTML = '';

    const studentSubmissions = allSubmissions.filter(sub => sub.studentUid === studentId);

    courseActivities.forEach(unit => {
        unit.activities.forEach(activity => {
            const submission = studentSubmissions.find(s => s.activityId === activity.id);
            const activityEl = document.createElement('div');
            activityEl.className = 'activity-grading-item';
            activityEl.innerHTML = `
                <span>${activity.name} (${unit.unitLabel})</span>
                <input type="number" min="0" max="100" value="${submission ? submission.grade : ''}" placeholder="N/A" data-activity-id="${activity.id}" />
            `;
            activitiesContainer.appendChild(activityEl);
        });
    });

    activitiesContainer.removeEventListener('change', handleGradeChange);
    activitiesContainer.addEventListener('change', handleGradeChange);

    if (shouldShowCard) {
        detailedViewCard.style.display = 'block';
    }
}

async function handleGradeChange(event) {
    if (event.target.tagName !== 'INPUT') return;
    const activityId = event.target.dataset.activityId;
    const grade = parseFloat(event.target.value);

    if (isNaN(grade) || grade < 0 || grade > 100) return;

    const submissionRef = doc(db, 'submissions', `${selectedStudentId}_${activityId}`);
    await setDoc(submissionRef, { studentUid: selectedStudentId, activityId, grade, submittedAt: serverTimestamp() }, { merge: true });
}

function hideDetailedView() {
    selectedStudentId = null;
    detailedViewCard.style.display = 'none';
}

async function handleGroupAssign(event) {
    event.preventDefault();
    const activityId = groupActivitySelect.value;
    batchStatus.textContent = `Asignando a ${allStudents.length} estudiantes...`;

    const batch = writeBatch(db);
    allStudents.forEach(student => {
        const submissionRef = doc(db, 'submissions', `${student.uid}_${activityId}`);
        batch.set(submissionRef, { studentUid: student.uid, activityId, grade: 0, submittedAt: serverTimestamp() }, { merge: true });
    });

    await batch.commit();
    batchStatus.textContent = `Actividad asignada a todos.`;
    setTimeout(() => batchStatus.textContent = '', 3000);
}

async function handleIndividualAssign(event) {
    event.preventDefault();
    const studentId = individualStudentSelect.value;
    const activityId = individualActivitySelect.value;
    individualStatus.textContent = `Asignando...`;

    const submissionRef = doc(db, 'submissions', `${studentId}_${activityId}`);
    await setDoc(submissionRef, { studentUid: studentId, activityId, grade: 0, submittedAt: serverTimestamp() }, { merge: true });

    individualStatus.textContent = `Actividad asignada.`;
    setTimeout(() => individualStatus.textContent = '', 3000);
}

// --- EVENT LISTENERS ---
closeDetailedViewBtn.addEventListener('click', hideDetailedView);
assignGroupActivityForm.addEventListener('submit', handleGroupAssign);
assignIndividualActivityForm.addEventListener('submit', handleIndividualAssign);

// --- INITIALIZE ---
initializeDashboard();
