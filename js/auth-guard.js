// js/auth-guard.js
import { onAuth, findStudentByUid, findTeacherByUid } from "./firebase.js";
import { showRoleSpecificUI } from "./role-gate.js";

const PROTECTED_PAGES = [
  "calificaciones.html",
  "paneldocente.html",
  "asistencia.html",
  "materiales.html",
  "Foro.html",
  "actividades.html"
];

async function manageUserSession(user) {
  localStorage.clear();

  if (user) {
    try {
      let userProfile = await findStudentByUid(user.uid);
      let userRole = "ESTUDIANTE";

      if (!userProfile) {
        userProfile = await findTeacherByUid(user.uid);
        userRole = "DOCENTE";
      }

      if (userProfile) {
        localStorage.setItem("qs_user_uid", user.uid);
        localStorage.setItem("qs_user_email", user.email);
        localStorage.setItem("qs_role", userRole);
        localStorage.setItem("qs_user_name", userProfile.name || user.email);
        
        if (userRole === 'ESTUDIANTE') {
          localStorage.setItem("qs_student_id", user.uid);
        }
        console.log(`Sesión iniciada para ${user.email}. Rol asignado: ${userRole}`);
      } else {
        console.warn(`Auth Guard: El usuario ${user.email} está autenticado pero no tiene un perfil asignado.`);
        localStorage.setItem("qs_role", "INVITADO");
      }
    } catch (error) {
      console.error("Error crítico al gestionar la sesión del usuario:", error);
      localStorage.clear();
    }
  } else {
    console.log("Auth Guard: No hay usuario autenticado.");
  }

  handlePageProtection(user);
  showRoleSpecificUI();
}

function handlePageProtection(user) {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isProtected = PROTECTED_PAGES.includes(currentPage);

  if (user) {
    if (currentPage === "login.html") {
      window.location.href = "calificaciones.html";
    }
    document.body.classList.remove('no-auth');
  } else {
    if (isProtected) {
      console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
      window.location.href = "login.html";
    }
    document.body.classList.add('no-auth');
  }
}

// Punto de entrada del script
onAuth(manageUserSession);
