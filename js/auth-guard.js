// js/auth-guard.js

// Importa las funciones necesarias de tu archivo firebase.js
import { onAuth, isTeacherEmail, initFirebase } from './firebase.js';

// Esta función es el núcleo de la protección de rutas
function initializeAuthProtection() {
    // Si la página es pública (tiene data-public-page), no hacemos nada.
    const isPublicPage = document.body.hasAttribute('data-public-page');
    if (isPublicPage) {
        // Aún queremos inicializar Firebase para cosas como el login/logout en páginas públicas
        initFirebase();
        return;
    }

    // onAuth es el listener que reacciona a los cambios de estado de autenticación
    onAuth((user) => {
        const rootElement = document.documentElement; // <html> tag

        if (user) {
            // --- USUARIO AUTENTICADO ---
            rootElement.classList.remove('user-signed-out');
            rootElement.classList.add('user-signed-in');

            // Verificamos si es docente y lo guardamos para uso de CSS y otros scripts
            const isTeacher = isTeacherEmail(user.email);
            localStorage.setItem('qs_role', isTeacher ? 'docente' : 'student');
            rootElement.classList.add(isTeacher ? 'role-teacher' : 'role-student');

        } else {
            // --- USUARIO NO AUTENTICADO ---
            rootElement.classList.remove('user-signed-in', 'role-teacher', 'role-student');
            rootElement.classList.add('user-signed-out');
            localStorage.removeItem('qs_role');
            
            // Obtenemos la página actual para evitar bucles de redirección
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'login.html' && currentPage !== '404.html') {
                // Si no está en login o 404, lo mandamos al login.
                const basePath = document.querySelector("script[src*='layout.js']")?.src.replace('js/layout.js', '') || './';
                window.location.href = `${basePath}login.html`;
            }
        }
    });
}

// Aseguramos que el DOM esté cargado antes de ejecutar el guardián
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthProtection);
} else {
    initializeAuthProtection();
}
