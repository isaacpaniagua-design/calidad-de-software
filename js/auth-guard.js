// js/auth-guard.js

import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";

const auth = getAuth(app);
const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

/**
 * Determina el rol del usuario basado en su dirección de correo electrónico.
 * @param {import("firebase/auth").User} user - El objeto de usuario de Firebase.
 * @returns {'docente' | 'estudiante'} - El rol asignado.
 */
function determineUserRole(user) {
    if (user && user.email && user.email.endsWith('@potros.itson.edu.mx')) {
        return 'docente';
    }
    return 'estudiante';
}

/**
 * Guarda la información del usuario y su rol en el almacenamiento local.
 * @param {import("firebase/auth").User} user - El objeto de usuario de Firebase.
 * @param {string} role - El rol del usuario.
 */
function saveSession(user, role) {
    localStorage.setItem('qs_user_uid', user.uid);
    localStorage.setItem('qs_user_name', user.displayName);
    localStorage.setItem('qs_user_email', user.email);
    localStorage.setItem('qs_role', role);
}

/**
 * Limpia la sesión del almacenamiento local al cerrar sesión.
 */
function clearSession() {
    localStorage.removeItem('qs_user_uid');
    localStorage.removeItem('qs_user_name');
    localStorage.removeItem('qs_user_email');
    localStorage.removeItem('qs_role');
}

// --- Lógica Principal del Guardián ---
onAuthStateChanged(auth, (user) => {
    const currentPage = window.location.pathname.split('/').pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
        // Usuario ha iniciado sesión
        const role = determineUserRole(user);
        saveSession(user, role);
        console.log(`Usuario autenticado como: ${role.toUpperCase()}`);

        // Si el usuario está en la página de login, lo redirigimos al panel principal.
        if (currentPage === 'login.html') {
            window.location.href = 'index.html';
        }

    } else {
        // Usuario NO ha iniciado sesión
        clearSession();
        console.log("Usuario no autenticado.");

        // Si intenta acceder a una página protegida, lo redirigimos al login.
        if (isProtectedPage) {
            console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
            window.location.href = 'login.html';
        }
    }
});
