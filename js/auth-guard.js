// js/auth-guard.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";
import {
  initFirebase,
  getAuthInstance,
  findStudentByEmail,
} from "./firebase.js";

initFirebase(); // Se llama a la inicialización primero.
const auth = getAuthInstance(); // Luego se obtiene la instancia.

const PROTECTED_PAGES = [
  "calificaciones.html",
  "paneldocente.html",
  "asistencia.html",
  "materiales.html",
  "Foro.html",
];

async function manageUserSession(user) {
  if (user) {
    const isTeacher = user.email === "isaac.paniagua@potros.itson.edu.mx";
    const role = isTeacher ? "docente" : "estudiante";

    localStorage.setItem("qs_user_uid", user.uid);
    localStorage.setItem("qs_user_name", user.displayName);
    localStorage.setItem("qs_user_email", user.email);
    localStorage.setItem("qs_role", role);

    if (role === "estudiante") {
      // Se busca el perfil del estudiante por su correo electrónico.
      const studentProfile = await findStudentByEmail(user.email);

      if (studentProfile && studentProfile.uid) {
        // Guardamos el UID del estudiante (matrícula), que es el ID que se usa en el resto de la app.
        localStorage.setItem("qs_student_id", studentProfile.uid);
        console.log(
          `Auth Guard: Perfil de estudiante encontrado por email para ${user.email}. UID asignado: ${studentProfile.uid}`
        );
      } else {
        localStorage.removeItem("qs_student_id");
        console.warn(
          `Auth Guard: No se encontró un perfil de estudiante para el email ${user.email}. Asegúrate de que el campo 'email' en la colección 'students' coincida y que el documento tenga un campo 'uid' con la matrícula.`
        );
      }
    } else {
      // Si es docente, nos aseguramos de que no haya un ID de estudiante guardado.
      localStorage.removeItem("qs_student_id");
    }

    console.log(
      `Sesión iniciada para ${user.email}. Rol asignado: ${role.toUpperCase()}`
    );
  } else {
    localStorage.clear();
    console.log("Sesión cerrada. Se limpió localStorage.");
  }
}

onAuthStateChanged(auth, async (user) => {
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
