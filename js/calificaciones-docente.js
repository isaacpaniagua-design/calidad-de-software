import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { initFirebase, getDb, getAuthInstance } from './firebase.js';

initFirebase();
const db = getDb();
const auth = getAuthInstance();

async function loadTeacherGrades() {
    const user = auth.currentUser;
    if (!user) {
        console.log("Usuario no autenticado, no se pueden cargar las calificaciones del docente.");
        const teacherGradesEmpty = document.getElementById('teacherGradesEmpty');
        if(teacherGradesEmpty) {
            teacherGradesEmpty.textContent = 'No se pudo verificar la autenticación para cargar las calificaciones.';
            teacherGradesEmpty.hidden = false;
        }
        return;
    }

    const teacherGradesList = document.getElementById('teacherGradesList');
    const teacherGradesEmpty = document.getElementById('teacherGradesEmpty');

    try {
        // Asumiendo que el rol de "docente" ve las calificaciones de un estudiante específico,
        // y que el `user.uid` corresponde al del estudiante que se está visualizando.
        // Si la lógica es diferente (ej. un docente ve todas las de sus alumnos), esto necesitaría ajustarse.
        const gradesQuery = query(collection(db, "grades"), where("studentId", "==", user.uid));
        const querySnapshot = await getDocs(gradesQuery);

        if (querySnapshot.empty) {
            if (teacherGradesEmpty) {
                teacherGradesEmpty.hidden = false;
            }
            if (teacherGradesList) {
                teacherGradesList.hidden = true;
            }
            return;
        }

        let gradesHtml = '';
        querySnapshot.forEach(doc => {
            const grade = doc.data();
            gradesHtml += `<li class="teacher-grades__item">${grade.activityName}: ${grade.grade}</li>`;
        });

        if (teacherGradesList) {
            teacherGradesList.innerHTML = gradesHtml;
            teacherGradesList.hidden = false;
        }
        if (teacherGradesEmpty) {
            teacherGradesEmpty.hidden = true;
        }

    } catch (error) {
        console.error("Error al cargar las calificaciones del docente: ", error);
        if (teacherGradesEmpty) {
            teacherGradesEmpty.textContent = 'Error al cargar las calificaciones.';
            teacherGradesEmpty.hidden = false;
        }
        if (teacherGradesList) {
            teacherGradesList.hidden = true;
        }
    }
}

// Esperar a que el estado de autenticación esté resuelto
auth.onAuthStateChanged(user => {
    if (user) {
        loadTeacherGrades();
    } else {
        // Manejar el caso en que el usuario no está logueado
        console.log("Usuario no logueado.");
        const teacherGradesEmpty = document.getElementById('teacherGradesEmpty');
        if(teacherGradesEmpty) {
            teacherGradesEmpty.textContent = 'Necesitas iniciar sesión para ver las calificaciones.';
            teacherGradesEmpty.hidden = false;
        }   
    }
});
