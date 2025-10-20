// js/auth-guard.js

// Paso 1: Importar solo las funciones necesarias desde tu módulo local de firebase.
import { onAuth, isTeacherEmail, ensureTeacherAllowlistLoaded } from './firebase.js';

// Esta función se ejecutará tan pronto como el documento HTML esté listo.
function initializeAuthProtection() {
    // Verifica si la página es pública (no requiere inicio de sesión).
    // Puedes añadir el atributo data-public-page al <body> de páginas como login.html.
    const isPublicPage = document.body.hasAttribute('data-public-page');
    if (isPublicPage) {
        return; // No se necesita protección en páginas públicas.
    }

    // Escucha los cambios en el estado de autenticación (inicio/cierre de sesión).
    onAuth(async (user) => {
        const rootElement = document.documentElement;
        if (user) {
            // --- Usuario AUTENTICADO ---
            rootElement.classList.remove('user-signed-out');
            rootElement.classList.add('user-signed-in');

            // Determinar y almacenar el rol del usuario (docente o estudiante).
            await ensureTeacherAllowlistLoaded();
            if (isTeacherEmail(user.email)) {
                localStorage.setItem('qs_role', 'docente');
                rootElement.classList.add('role-teacher');
            } else {
                localStorage.setItem('qs_role', 'student');
                rootElement.classList.add('role-student');
            }

            // Si la página actual tiene una función de inicialización, la ejecutamos.
            // Esto es útil para que páginas como 'actividades.html' carguen sus datos.
            if (typeof window.QS_PAGE_INIT === 'function') {
                window.QS_PAGE_INIT(user);
            }

        } else {
            // --- Usuario NO AUTENTICADO ---
            rootElement.classList.remove('user-signed-in', 'role-teacher', 'role-student');
            rootElement.classList.add('user-signed-out');
            localStorage.removeItem('qs_role');
            
            // Redirigir al usuario a la página de inicio de sesión.
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'login.html' && currentPage !== '404.html') {
                // Redirección inteligente para que funcione desde cualquier subdirectorio.
                const basePath = document.querySelector("script[src*='layout.js']")?.src.replace('js/layout.js', '') || './';
                window.location.href = `${basePath}login.html`;
            }
        }
    });
}

// Asegurarse de que el script se ejecute cuando el DOM esté listo.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthProtection);
} else {
    initializeAuthProtection();
}
