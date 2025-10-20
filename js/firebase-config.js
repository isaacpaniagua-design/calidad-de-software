// En: js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

/**
 * El dominio de correo electrónico permitido para el registro y el inicio de sesión de estudiantes.
 * @type {string}
 */
export const allowedEmailDomain = "itson.edu.mx";

/**
 * Lista de correos electrónicos de profesores con permisos administrativos.
 * @type {string[]}
 */
export const allowedTeacherEmails = ["profesor.ejemplo@itson.edu.mx"];


/**
 * Inicializa la aplicación Firebase si aún no se ha inicializado.
 * @returns El objeto de la aplicación Firebase.
 */
export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  return app;
}
