// js/auth-guard.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
import { findStudentByUid } from './firebase.js'; // CAMBIO IMPORTANTE: Usamos la nueva función

const auth = getAuth();

const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

async function manageUserSession(user) {
    if (user) {
        const isTeacher = user.email === 'isaac.paniagua@potros.itson.edu.mx';
        const role = isTeacher ? 'docente' : 'estudiante';

        localStorage.setItem('qs_user_uid', user.uid);
        localStorage.setItem('qs_user_name', user.displayName);
        localStorage.setItem('qs_user_email', user.email);
        localStorage.setItem('qs_role', role);
        
        if (role === 'estudiante') {
            // CAMBIO CLAVE: Buscamos al estudiante por su UID de autenticación, no por su email.
            const studentProfile = await findStudentByUid(user.uid);
            
            if (studentProfile && studentProfile.id) {
                // Guardamos el ID del documento del estudiante (su matrícula), que es lo que necesitamos.
                localStorage.setItem('qs_student_id', studentProfile.id);
                console.log(`Auth Guard: Perfil de estudiante encontrado para ${user.email}. ID asignado: ${studentProfile.id}`);
            } else {
                localStorage.removeItem('qs_student_id');
                console.warn(`Auth Guard: No se encontró un perfil de estudiante para el UID ${user.uid}. Asegúrate de que el campo 'authUid' en la colección 'students' coincida.`);
            }
        } else {
            // Si es docente, nos aseguramos de que no haya un ID de estudiante guardado.
            localStorage.removeItem('qs_student_id');
        }
        
        console.log(`Sesión iniciada para ${user.email}. Rol asignado: ${role.toUpperCase()}`);
    } else {
        localStorage.clear();
        console.log("Sesión cerrada. Se limpió localStorage.");
    }
}

onAuthStateChanged(auth, async (user) => {
    await manageUserSession(user);

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
