// Rellena este archivo con la configuración de tu proyecto Firebase.
// Obtén las credenciales en Firebase Console > Configuración del proyecto > tus apps web.
// IMPORTANTE: No subas credenciales sensibles a repos públicos.

const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

// Inicializar Firebase (Sintaxis v8 compatible)
// Se comprueba si la app ya fue inicializada para evitar errores.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ============================================================================
// Las variables de configuración de tu app ahora son constantes normales
// en lugar de 'exports'. Estarán disponibles para otros scripts que se
// carguen después de este.
// ============================================================================

// Dominio permitido para acceso de alumnos
const allowedEmailDomain = "potros.itson.edu.mx";

// Correos con permisos de docente (pueden editar calificaciones y materiales)
const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx",
  "profe.paniagua@gmail.com",
];

// Documento en Firestore que puede contener correos adicionales autorizados
const teacherAllowlistDocPath = "config/teacherAllowlist";

// Habilitar o deshabilitar Firebase Storage.
const useStorage = true;

// Carpeta de Google Drive para materiales (ID extraído del enlace compartido)
const driveFolderId = "1kHZa-58lXRWniS8O5tAUG933g4oDs8_L";
