// js/auth-guard.js
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";

const auth = getAuth(app);

// Lista de páginas que requieren que el usuario haya iniciado sesión.
const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

/**
 * Gestiona la sesión del usuario en localStorage y determina su rol.
 * @param {import("firebase/auth").User|null} user - El objeto de usuario de Firebase o null.
 */
function manageUserSession(user) {
    if (user) {
        // REGLA DE NEGOCIO ACTUALIZADA: Isaac Paniagua es el único docente.
        const isTeacher = user.email === 'isaac.paniagua@potros.itson.edu.mx';
        const role = isTeacher ? 'docente' : 'estudiante';

        // Guardar los datos de sesión que usarán otros scripts como 'role-gate.js'
        localStorage.setItem('qs_user_uid', user.uid);
        localStorage.setItem('qs_user_name', user.displayName);
        localStorage.setItem('qs_user_email', user.email);
        localStorage.setItem('qs_role', role);
        
        console.log(`Auth Guard: Sesión iniciada para ${user.email}. Rol asignado: ${role.toUpperCase()}`);
    } else {
        // Si no hay usuario, limpiar la sesión para proteger los datos.
        localStorage.clear();
        console.log("Auth Guard: Sesión cerrada. Se limpió localStorage.");
    }
}

// Listener principal de autenticación. Se ejecuta al cargar la página y cada vez que el estado de auth cambia.
onAuthStateChanged(auth, (user) => {
    // 1. Asigna el rol y guarda la sesión del usuario.
    manageUserSession(user);

    const currentPage = window.location.pathname.split('/').pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
        // 2. Si el usuario YA ESTÁ logueado:
        // Si intenta ir a la página de login, lo redirigimos a la página principal de la plataforma.
        if (currentPage === 'login.html' || currentPage === '') {
            window.location.href = 'calificaciones.html';
        }
    } else {
        // 3. Si el usuario NO ESTÁ logueado:
        // Si intenta acceder a una página protegida, lo enviamos al login.
        if (isProtectedPage) {
            console.log(`Auth Guard: Acceso denegado a ${currentPage}. Redirigiendo a login.`);
            window.location.href = 'login.html';
        }
    }
});
