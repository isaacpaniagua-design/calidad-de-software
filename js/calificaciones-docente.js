import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { initFirebase, getDb } from './firebase.js';

initFirebase();
const db = getDb();
const auth = getAuth();

async function loadTeacherGrades() {
    const user = auth.currentUser;
    if (!user) {
        console.log("Usuario no autenticado.");
        return;
    }

    const teacherGradesList = document.getElementById('teacherGradesList');
    const teacherGradesEmpty = document.getElementById('teacherGradesEmpty');

    try {
        const gradesQuery = query(collection(db, "grades"), where("studentId", "==", user.uid));
        const querySnapshot = await getDocs(gradesQuery);

        if (querySnapshot.empty) {
            teacherGradesEmpty.hidden = false;
            teacherGradesList.hidden = true;
            return;
        }

        let gradesHtml = '';
        querySnapshot.forEach(doc => {
            const grade = doc.data();
            gradesHtml += `<li class="teacher-grades__item">${grade.activityName}: ${grade.grade}</li>`;
        });

        teacherGradesList.innerHTML = gradesHtml;
        teacherGradesEmpty.hidden = true;
        teacherGradesList.hidden = false;

    } catch (error) {
        console.error("Error al cargar las calificaciones del docente: ", error);
        teacherGradesEmpty.hidden = false;
        teacherGradesList.hidden = true;
    }
}

document.addEventListener('DOMContentLoaded', loadTeacherGrades);
