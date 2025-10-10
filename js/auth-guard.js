import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PROTECTED_PATH = '/index.html';
const LOGIN_PATH = '/login.html';

const isPublicPage = (path) => path === LOGIN_PATH;

onAuthStateChanged(auth, async (user) => {
  const currentPage = window.location.pathname;

  if (user) {
    // Usuario ha iniciado sesión. Ahora verificamos si es docente.
    const userDocRef = doc(db, "teachers", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      // El usuario es un docente.
      console.log("Acceso concedido. Usuario es docente.");
      if (isPublicPage(currentPage)) {
        // Si está en la página de login, redirigir al panel.
        window.location.href = PROTECTED_PATH;
      }
    } else {
      // El usuario no es un docente.
      console.warn("Acceso denegado. El usuario no está en la colección de teachers.");
      await signOut(auth);
      // Redirigir a login con un mensaje de error.
      window.location.href = `${LOGIN_PATH}?error=unauthorized`;
    }
  } else {
    // No hay usuario iniciado sesión.
    if (!isPublicPage(currentPage)) {
      // Si no está en una página pública, redirigir a login.
      console.log("Usuario no autenticado. Redirigiendo a login.");
      window.location.href = LOGIN_PATH;
    }
  }
});
