// js/auth-guard.js
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
import { findStudentByUid } from './firebase.js'; // Importación de la nueva función

const auth = getAuth(app);

const PROTECTED_PAGES = ['calificaciones.html', 'paneldocente.html', 'asistencia.html', 'materiales.html', 'Foro.html'];

/**
 * Gestiona la sesión del usuario, determina su rol y guarda su ID de estudiante si aplica.
 * @param {import("firebase/auth").User|null} user - El objeto de usuario de Firebase o null.
 */
async function manageUserSession(user) {
  const userRole = determineUserRole(user);
  localStorage.setItem('qs_role', userRole);

  console.log(`Renderizando página para el rol: ${userRole.toUpperCase()}`);

  try {
    if (userRole === 'estudiante') {
      // Usamos la nueva función para buscar por UID, no por email.
      const studentProfile = await findStudentByUid(user.uid);
      
      if (studentProfile && studentProfile.id) {
        // Guardamos el ID del documento del estudiante (su matrícula), que es lo que necesitamos.
        localStorage.setItem('qs_student_id', studentProfile.id);
        console.log(`Auth Guard: Perfil de estudiante encontrado para ${user.email}. ID asignado: ${studentProfile.id}`);
      } else {
        localStorage.removeItem('qs_student_id');
        console.warn(`Auth Guard: No se encontró un perfil de estudiante para ${user.email}. El estudiante no podrá ver sus calificaciones.`);
      }

    } else if (userRole === 'docente') {
      localStorage.removeItem('qs_student_id');
    }
    
    updateUIVisibility(userRole);

  } catch (error) {
    console.error("Auth Guard: Error al procesar la sesión del usuario:", error);
  }
}
        
        console.log(`Sesión iniciada para ${user.email}. Rol asignado: ${role.toUpperCase()}`);
    } else {
        localStorage.clear();
        console.log("Sesión cerrada. Se limpió localStorage.");
    }
}

// Listener principal de autenticación
onAuthStateChanged(auth, async (user) => {
    // La función que gestiona la sesión ahora es asíncrona, así que usamos await.
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
