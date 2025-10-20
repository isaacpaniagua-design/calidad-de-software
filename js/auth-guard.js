import { initFirebase } from './firebase.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

// --- CONFIGURATION ---
const TEACHER_EMAIL = 'isaac.paniagua@potros.itson.edu.mx';
const STUDENT_GRADE_PAGE = '/calificaciones.html';
const TEACHER_DASHBOARD_PAGE = '/actividades.html';

// --- INITIALIZATION ---
initFirebase();
const auth = getAuth();

// --- AUTH GUARD LOGIC ---
onAuthStateChanged(auth, (user) => {
    const currentPage = window.location.pathname;

    if (user) {
        // User is signed in
        const isTeacher = user.email === TEACHER_EMAIL;

        if (isTeacher && currentPage.endsWith(STUDENT_GRADE_PAGE)) {
            // Teacher on student page, redirect to dashboard
            console.log('Auth Guard: Teacher detected on student page. Redirecting to dashboard.');
            window.location.href = TEACHER_DASHBOARD_PAGE;
        } else if (!isTeacher && currentPage.endsWith(TEACHER_DASHBOARD_PAGE)) {
            // Student on teacher page, redirect to their grades
            console.log('Auth Guard: Student detected on teacher dashboard. Redirecting to grades.');
            window.location.href = STUDENT_GRADE_PAGE;
        }
        // Otherwise, the user is on the correct page, do nothing.

    } else {
        // No user is signed in.
        // If they are trying to access a protected page, redirect them to the login page (index.html).
        if (currentPage.endsWith(STUDENT_GRADE_PAGE) || currentPage.endsWith(TEACHER_DASHBOARD_PAGE)) {
            console.log('Auth Guard: No user signed in. Redirecting to login.');
            window.location.href = '/index.html'; 
        }
    }
});
