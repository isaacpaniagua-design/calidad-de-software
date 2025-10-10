// js/auth-guard.js
import { authReady } from './auth-manager.js'; // Importamos a nuestro nuevo director
import { app } from './firebase.js'; // Se mantiene por si se necesita en el futuro

const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

/**
 * Gestiona la sesión del usuario en localStorage.
 * @param {import("firebase/auth").User|null} user - El objeto de usuario de Firebase o null.
 */
function manageUserSession(user) {
    if (user) {
        // 1. Determinar el rol
        const isTeacher = user.email && user.email.endsWith('@potros.itson.edu.mx');
        const role = isTeacher ? 'docente' : 'estudiante';

        // 2. Guardar datos de sesión
        localStorage.setItem('qs_user_uid', user.uid);
        localStorage.setItem('qs_user_name', user.displayName);
        localStorage.setItem('qs_user_email', user.email);
        localStorage.setItem('qs_role', role);
        
        console.log(`Auth Guard: Sesión iniciada. Rol de usuario: ${role.toUpperCase()}`);
    } else {
        // 3. Si no hay usuario, limpiar la sesión
        localStorage.clear(); // Limpia todo para evitar datos residuales
        console.log("Auth Guard: Sesión cerrada. Se limpió localStorage.");
    }
}

// --- Lógica Principal del Guardián ---
// Toda la lógica ahora espera a que el 'auth-manager' dé la señal de que está listo.
authReady.then(user => {
    // Una vez que sabemos el estado de auth, gestionamos la sesión.
    manageUserSession(user);

    const currentPage = window.location.pathname.split('/').pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
        // Usuario ha iniciado sesión.
        // Si está en la página de login, lo redirigimos al panel principal.
        if (currentPage === 'login.html' || currentPage === '') {
            window.location.href = 'calificaciones.html';
        }
    } else {
        // Usuario NO ha iniciado sesión.
        // Si intenta acceder a una página protegida, lo redirigimos al login.
        if (isProtectedPage) {
            console.log(`Auth Guard: Acceso denegado a ${currentPage}. Redirigiendo a login.`);
            window.location.href = 'login.html';
        }
    }
});
