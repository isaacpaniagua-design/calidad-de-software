// js/auth-guard.js
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";

const auth = getAuth(app);

const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

function manageUserSession(user) {
    if (user) {
        const isTeacher = user.email && user.email.endsWith('@potros.itson.edu.mx');
        const role = isTeacher ? 'docente' : 'estudiante';

        localStorage.setItem('qs_user_uid', user.uid);
        localStorage.setItem('qs_user_name', user.displayName);
        localStorage.setItem('qs_user_email', user.email);
        localStorage.setItem('qs_role', role);
        
        console.log(`Sesión iniciada. Rol de usuario: ${role.toUpperCase()}`);
    } else {
        localStorage.clear(); // Es más seguro limpiar todo
        console.log("Sesión cerrada. Se limpió localStorage.");
    }
}

onAuthStateChanged(auth, (user) => {
    manageUserSession(user);

    const currentPage = window.location.pathname.split('/').pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
        if (currentPage === 'login.html' || currentPage === '') {
            window.location.href = 'calificaciones.html';
        }
    } else {
        if (isProtectedPage) {
            console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
            window.location.href = 'login.html';
        }
    }
});
