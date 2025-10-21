
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { initFirebase, getDb } from './firebase.js';

initFirebase();
const db = getDb();

function toggleTeacherView(isTeacher) {
    const teacherView = document.querySelector('.teacher-view');
    const studentView = document.querySelector('.student-view');

    if (isTeacher) {
        teacherView.style.display = 'block';
        studentView.style.display = 'none';
    } else {
        teacherView.style.display = 'none';
        studentView.style.display = 'block';
    }
}

async function loadAllStudents() {
    const studentsCollection = collection(db, 'users');
    const q = query(studentsCollection, where('role', '==', 'estudiante'));
    const querySnapshot = await getDocs(q);
    const students = [];
    querySnapshot.forEach((doc) => {
        students.push({ id: doc.id, ...doc.data() });
    });
    return students;
}

async function loadStudentGrades(studentId) {
    const gradesCollection = collection(db, 'grades');
    const q = query(gradesCollection, where('studentId', '==', studentId));
    const querySnapshot = await getDocs(q);
    const grades = [];
    querySnapshot.forEach((doc) => {
        grades.push({ id: doc.id, ...doc.data() });
    });
    return grades;
}

function renderStudentList(students) {
    const studentListContainer = document.getElementById('student-list-container');
    if (!studentListContainer) return;

    let studentListHtml = '<ul>';
    students.forEach(student => {
        studentListHtml += `
            <li class="student-item">
                <span>${student.displayName}</span>
                <button class="view-grades-btn" data-student-id="${student.id}">Ver Calificaciones</button>
            </li>
        `;
    });
    studentListHtml += '</ul>';
    studentListContainer.innerHTML = studentListHtml;

    document.querySelectorAll('.view-grades-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const studentId = e.target.dataset.studentId;
            const grades = await loadStudentGrades(studentId);
            renderStudentGrades(grades);
        });
    });
}

function renderStudentGrades(grades) {
    const gradesContainer = document.getElementById('student-grades-container');
    if (!gradesContainer) {
        console.error("El contenedor de calificaciones de estudiante no se encontrÃ³");
        return;
    }

    let gradesHtml = '<ul>';
    if (grades.length === 0) {
        gradesHtml += '<li>No se encontraron calificaciones para este estudiante.</li>';
    } else {
        grades.forEach(grade => {
            gradesHtml += `<li>${grade.activityName}: ${grade.grade}</li>`;
        });
    }
    gradesHtml += '</ul>';
    gradesContainer.innerHTML = gradesHtml;
}

document.addEventListener('DOMContentLoaded', async () => {
    const rol = localStorage.getItem("qs_role") || "estudiante";
    const isTeacher = rol === 'docente';

    toggleTeacherView(isTeacher);

    if (isTeacher) {
        const students = await loadAllStudents();
        renderStudentList(students);
        
        const studentGradesContainer = document.createElement('div');
        studentGradesContainer.id = 'student-grades-container';
        studentGradesContainer.className = 'bg-white rounded-lg card-shadow p-6 mt-4';
        document.querySelector('.teacher-view').appendChild(studentGradesContainer);
    }
});
