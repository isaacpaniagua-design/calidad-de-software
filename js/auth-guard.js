// js/auth-guard.js
import { app } from "./firebase.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
import { findStudentByEmail } from "./firebase.js"; // Importación de la nueva función

const auth = getAuth(app);

const PROTECTED_PAGES = [
  "calificaciones.html",
  "paneldocente.html",
  "asistencia.html",
  "materiales.html",
  "Foro.html",
];

/**
 * Gestiona la sesión del usuario, determina su rol y guarda su ID de estudiante si aplica.
 * @param {import("firebase/auth").User|null} user - El objeto de usuario de Firebase o null.
 */
async function manageUserSession(user) {
  if (user) {
    const isTeacher = user.email === "isaac.paniagua@potros.itson.edu.mx";
    const role = isTeacher ? "docente" : "estudiante";

    // Guardar datos básicos de sesión
    localStorage.setItem("qs_user_uid", user.uid); // UID de Autenticación
    localStorage.setItem("qs_user_name", user.displayName);
    localStorage.setItem("qs_user_email", user.email);
    localStorage.setItem("qs_role", role);

    // Si es un estudiante, buscamos su ID de matrícula (document ID)
    if (role === "estudiante") {
      const studentProfile = await findStudentByEmail(user.email);
      if (studentProfile) {
        // Guardamos el ID de la colección 'students' (ej. "00000099876")
        localStorage.setItem("qs_student_id", studentProfile.id);
        console.log(
          `Auth Guard: ID de estudiante (${studentProfile.id}) encontrado y guardado.`
        );
      } else {
        console.warn(
          `Auth Guard: No se encontró un perfil de estudiante para ${user.email}. El estudiante no podrá ver sus calificaciones.`
        );
        localStorage.removeItem("qs_student_id"); // Asegurarse de que no haya un ID antiguo
      }

      console.log(
        `Sesión iniciada para ${
          user.email
        }. Rol asignado: ${role.toUpperCase()}`
      );
    } else {
      localStorage.clear();
      console.log("Sesión cerrada. Se limpió localStorage.");
    }
  }

  // Listener principal de autenticación
  onAuthStateChanged(auth, async (user) => {
    // La función que gestiona la sesión ahora es asíncrona, así que usamos await.
    await manageUserSession(user);

    const currentPage = window.location.pathname.split("/").pop();
    const isProtectedPage = PROTECTED_PAGES.includes(currentPage);

    if (user) {
      if (currentPage === "login.html" || currentPage === "") {
        window.location.href = "calificaciones.html";
      }
    } else {
      if (isProtectedPage) {
        console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
        window.location.href = "login.html";
      }
    }
  });
  console.log(`Acceso denegado a ${currentPage}. Redirigiendo a login.`);
  window.location.href = "login.html";
}
