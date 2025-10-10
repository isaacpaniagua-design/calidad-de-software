// js/auth-guard.js
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
// No se necesitan más importaciones de firestore aquí, se mantiene simple.

const auth = getAuth(app);

const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

/**
 * --- INICIO DE LÓGICA INTEGRADA ---
 * Determina el rol del usuario basado en su email y lo guarda en la sesión.
 */
function manageUserSession(user) {
    if (user) {
        // 1. Determinar el rol
        const isTeacher = user.email && user.email.endsWith('@potros.itson.edu.mx');
        const role = isTeacher ? 'docente' : 'estudiante';

        // 2. Guardar datos de sesión en localStorage para que otras páginas los usen
        localStorage.setItem('qs_user_uid', user.uid);
        localStorage.setItem('qs_user_name', user.displayName);
        localStorage.setItem('qs_user_email', user.email);
        localStorage.setItem('qs_role', role);
        
        console.log(`Sesión iniciada. Rol de usuario: ${role.toUpperCase()}`);
    } else {
        // 3. Si no hay usuario, limpiar la sesión
        localStorage.removeItem('qs_user_uid');
        localStorage.removeItem('qs_user_name');
        localStorage.removeItem('qs_user_email');
        localStorage.removeItem('qs_role');
        console.log("Sesión cerrada. Se limpió localStorage.");
    }
}
/**
 * --- FIN DE LÓGICA INTEGRADA ---
 */


// --- TU LÓGICA ORIGINAL (CONSERVADA Y MEJORADA) ---
onAuthStateChanged(auth, (user) => {
    // Se llama a nuestra nueva función para que gestione el rol y localStorage
    manageUserSession(user);

    const currentPage = window.location.pathname.split('/').pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
        // Usuario ha iniciado sesión.
        // Si está en la página de login, lo redirigimos al panel.
        if (currentPage === 'login.html' || currentPage === '') { // También cubre la raíz
            window.location.href = 'calificaciones.html'; // Redirige a la página principal
        }
    } else {
        // Usuario NO ha iniciado sesión.
        // Si intenta acceder a una página protegida, lo redirigimos al login.
        if (isProtectedPage) {
            console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
            window.location.href = 'login.html';
        }
    }
});
