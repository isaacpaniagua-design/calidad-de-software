// En: js/firebase-config.js

// La inicialización de Firebase ahora se gestiona de forma centralizada en `js/firebase.js`.

export const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

/**
 * El dominio de correo permitido para el registro de estudiantes.
 * @type {string}
 */
export const allowedEmailDomain = "itson.edu.mx";

/**
 * Lista de correos de profesores con permisos administrativos en la interfaz.
 * @type {string[]}
 */
export const allowedTeacherEmails = [
    "profesor.ejemplo@itson.edu.mx",
    "isaac.paniagua@potros.itson.edu.mx" // <-- ✅ CORRECCIÓN: Tu correo ha sido añadido.
];

/**
 * ID de la carpeta raíz de Google Drive para las entregas.
 * @type {string}
 */
export const driveFolderId = "1WPZ9AvDxVF8GasTuDPYeaU8unw7e3fM3";

/**
 * Define si se debe usar Firebase Storage (lo hemos desactivado en favor de Google Drive).
 * @type {boolean}
 */
export const useStorage = false;

/**
 * Ruta en Firestore al documento con la lista de correos de profesores autorizados.
 * @type {string}
 */
export const teacherAllowlistDocPath = "config/teacher_allowlist";

// La función initFirebase() se ha eliminado de este archivo porque la inicialización
// ahora está correctamente centralizada en el nuevo `js/firebase.js`.
