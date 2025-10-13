// js/auth-guard.js
import { onAuth, findStudentByUid, findTeacherByUid } from "./firebase.js";
import { showRoleSpecificUI } from "./role-gate.js";

/**
 * Define qué páginas requieren que el usuario haya iniciado sesión.
 */
const PROTECTED_PAGES = [
  "calificaciones.html",
  "paneldocente.html",
  "asistencia.html",
  "materiales.html",
  "Foro.html",
  "actividades.html"
];

/**
 * Función central para gestionar la sesión del usuario.
 * Determina el rol, guarda los datos en localStorage y actualiza la UI.
 * @param {object|null} user - El objeto de usuario de Firebase, o null si no hay sesión.
 */
async function manageUserSession(user) {
  // Limpiamos cualquier dato de sesión anterior al iniciar.
  localStorage.clear();

  if (user) {
    try {
      // Intentamos encontrar al usuario primero en la colección de estudiantes.
      let userProfile = await findStudentByUid(user.uid);
      let userRole = "estudiante";

      // Si no es estudiante, buscamos en la colección de docentes.
      if (!userProfile) {
        userProfile = await findTeacherByUid(user.uid);
        userRole = "docente";
      }

      // Si encontramos un perfil en cualquiera de las dos colecciones...
      if (userProfile) {
        localStorage.setItem("qs_user_uid", user.uid);
        localStorage.setItem("qs_user_email", user.email);
        localStorage.setItem("qs_role", userRole);
        localStorage.setItem("qs_user_name", userProfile.name || user.email);
        
        // ¡IMPORTANTE! Guardamos el UID del usuario como 'qs_student_id' para consistencia.
        // Esto asegura que todas las funciones que buscan calificaciones usan el mismo identificador.
        if (userRole === 'estudiante') {
          localStorage.setItem("qs_student_id", user.uid);
        }

        console.log(`Sesión iniciada para ${user.email}. Rol asignado: ${userRole.toUpperCase()}`);
      } else {
        // Si el usuario está autenticado en Firebase pero no tiene perfil en la BD...
        console.warn(`Auth Guard: El usuario ${user.email} está autenticado pero no tiene un perfil asignado (ni estudiante, ni docente).`);
        localStorage.setItem("qs_role", "invitado"); // Asignamos un rol por defecto.
      }
    } catch (error) {
      console.error("Error crítico al gestionar la sesión del usuario:", error);
      // En caso de error, forzamos el cierre de sesión para evitar un estado inconsistente.
      localStorage.clear();
    }
  } else {
    console.log("Auth Guard: No hay usuario autenticado.");
  }

  // Una vez procesada la sesión, manejamos la protección de la página.
  handlePageProtection(user);
  
  // Finalmente, actualizamos la UI según el rol.
  showRoleSpecificUI();
}

/**
 * Maneja la redirección basada en el estado de autenticación y la página actual.
 * @param {object|null} user - El objeto de usuario de Firebase.
 */
function handlePageProtection(user) {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isProtected = PROTECTED_PAGES.includes(currentPage);

  if (user) {
    // Si el usuario está en la página de login pero ya tiene sesión, lo redirigimos.
    if (currentPage === "login.html") {
      window.location.href = "calificaciones.html";
    }
    document.body.classList.remove('no-auth');
  } else {
    // Si no hay usuario y la página es protegida, lo mandamos al login.
    if (isProtected) {
      console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
      window.location.href = "login.html";
    }
    document.body.classList.add('no-auth');
  }
}

// --- PUNTO DE ENTRADA ---
// onAuth registrará un listener que se ejecutará cada vez que el estado de autenticación cambie.
onAuth(manageUserSession);
