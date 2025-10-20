// js/auth-guard.js

import { onAuth, isTeacherEmail, initFirebase, getDb } from './firebase.js';

function initializeAuthProtection() {
    const isPublicPage = document.body.hasAttribute('data-public-page');
    if (isPublicPage) {
        // Inicializa Firebase pero no hace nada más.
        initFirebase();
        return;
    }

    onAuth(async (user) => {
        const rootElement = document.documentElement;
        initFirebase(); // Aseguramos que Firebase se inicialice
        const db = getDb(); // Y que tenemos la instancia de la BD

        if (user) {
            rootElement.classList.remove('user-signed-out');
            rootElement.classList.add('user-signed-in');

            const isTeacher = isTeacherEmail(user.email);
            localStorage.setItem('qs_role', isTeacher ? 'docente' : 'student');
            rootElement.classList.add(isTeacher ? 'role-teacher' : 'role-student');

            // --- ¡LA CLAVE ESTÁ AQUÍ! ---
            // Una vez sabemos que el usuario está autenticado y la BD lista,
            // ejecutamos las inicializaciones de las páginas que lo necesiten.
            if (window.QS_PAGE_INIT) {
                if (isTeacher) {
                    // Solo para docentes
                    if (typeof window.QS_PAGE_INIT.actividades === 'function') {
                        window.QS_PAGE_INIT.actividades(user, db);
                    }
                    if (typeof window.QS_PAGE_INIT.assignActivities === 'function') {
                        window.QS_PAGE_INIT.assignActivities(user, db);
                    }
                }
                // Aquí irían otras inicializaciones que no dependen del rol
            }

        } else {
            rootElement.classList.remove('user-signed-in', 'role-teacher', 'role-student');
            rootElement.classList.add('user-signed-out');
            localStorage.removeItem('qs_role');
            
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'login.html' && currentPage !== '404.html') {
                const basePath = document.querySelector("script[src*='layout.js']")?.src.replace('js/layout.js', '') || './';
                window.location.href = `${basePath}login.html`;
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthProtection);
} else {
    initializeAuthProtection();
}
