// js/auth-guard.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
// CORRECCIÓN: Importamos todas las funciones necesarias, incluyendo findTeacherByUid.
import { initFirebase, getAuthInstance, findStudentByUid, findTeacherByUid } from "./firebase.js";

initFirebase(); // Asegura que Firebase se inicialice.
const auth = getAuthInstance();

const PROTECTED_PAGES = [
  "calificaciones.html",
  "paneldocente.html",
  "asistencia.html",
  "materiales.html",
  "Foro.html",
];

/**
 * Función central para gestionar la sesión del usuario.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
async function manageUserSession(user) {
  if (user) {
    // MODIFICACIÓN: Lógica de detección de rol robusta.
    let userProfile = await findStudentByUid(user.uid);
    let role = "ESTUDIANTE";

    if (!userProfile) {
      userProfile = await findTeacherByUid(user.uid);
      role = "DOCENTE";
    }

    localStorage.setItem("qs_user_uid", user.uid);
    localStorage.setItem("qs_user_name", userProfile?.name || user.displayName || user.email);
    localStorage.setItem("qs_user_email", user.email);
    localStorage.setItem("qs_role", role);

    if (role === "ESTUDIANTE") {
      if (userProfile && userProfile.id) {
        // CORRECCIÓN CLAVE: Guardamos el UID de AUTENTICACIÓN (`user.uid`) para consistencia.
        // Esto soluciona la desconexión de UIDs.
        localStorage.setItem("qs_student_id", user.uid);
        console.log(
          `Auth Guard: Perfil de estudiante encontrado para ${user.email}. ID de sesión asignado: ${user.uid}`
        );
      } else {
        localStorage.removeItem("qs_student_id");
        console.warn(
          `Auth Guard: No se encontró un perfil de estudiante para el UID ${user.uid}. Asegúrate de que el campo 'authUid' en la colección 'students' coincida.`
        );
      }
    } else {
      // Si es docente o no tiene perfil, nos aseguramos de que no haya un ID de estudiante.
      localStorage.removeItem("qs_student_id");
    }

    console.log(
      `Sesión iniciada para ${user.email}. Rol asignado: ${role}`
    );
  } else {
    localStorage.clear();
    console.log("Sesión cerrada. Se limpió localStorage.");
  }
}

/**
 * Listener principal que se activa cuando cambia el estado de autenticación.
 */
onAuthStateChanged(auth, async (user) => {
  // Primero, gestiona toda la lógica de la sesión y los roles.
  await manageUserSession(user);

  // Después, maneja la protección de las páginas y las redirecciones.
  const currentPage = window.location.pathname.split("/").pop();
  const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

  if (user) {
    // Si el usuario ya está logueado y visita la página de login, lo redirigimos.
    if (currentPage === "login.html" || currentPage === "") {
      window.location.href = "calificaciones.html";
    }
  } else {
    // Si no hay usuario y la página es protegida, lo enviamos al login.
    if (isProtectedPage) {
      console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
      window.location.href = "login.html";
    }
  }
});
