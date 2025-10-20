// js/auth-guard.js

import { onFirebaseReady, getAuthInstance } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { allowedTeacherEmails } from './firebase-config.js';

/**
 * Comprueba si un correo electrónico pertenece a un profesor.
 * @param {string} email El correo electrónico a verificar.
 * @returns {boolean} True si el correo es de un profesor.
 */
function isTeacherEmail(email) {
    return email && allowedTeacherEmails.includes(email);
}

/**
 * Protege las páginas que requieren autenticación y establece clases globales de CSS.
 */
function initializeAuthProtection() {
    const isPublicPage = document.body.hasAttribute('data-public-page');

    onFirebaseReady(() => {
        const auth = getAuthInstance();

        onAuthStateChanged(auth, (user) => {
            const rootElement = document.documentElement; // <html> tag

            if (user) {
                // --- USUARIO AUTENTICADO ---
                rootElement.classList.remove('user-signed-out');
                rootElement.classList.add('user-signed-in');

                const isTeacher = isTeacherEmail(user.email);
                localStorage.setItem('qs_role', isTeacher ? 'docente' : 'student');
                rootElement.classList.remove('role-student', 'role-teacher'); // Limpia roles antiguos
                rootElement.classList.add(isTeacher ? 'role-teacher' : 'role-student');

            } else {
                // --- USUARIO NO AUTENTICADO ---
                rootElement.classList.remove('user-signed-in', 'role-teacher', 'role-student');
                rootElement.classList.add('user-signed-out');
                localStorage.removeItem('qs_role');
                
                // Si la página NO es pública y no estamos ya en login, redirigir.
                if (!isPublicPage) {
                    const currentPage = window.location.pathname.split('/').pop();
                    if (currentPage !== 'login.html' && currentPage !== '404.html') {
                        const basePath = document.querySelector("script[src*='layout.js']")?.src.replace('js/layout.js', '') || './';
                        window.location.href = `${basePath}login.html`;
                    }
                }
            }
        });
    });
}

// Asegurar que el DOM esté cargado antes de ejecutar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthProtection);
} else {
    initializeAuthProtection();
}
