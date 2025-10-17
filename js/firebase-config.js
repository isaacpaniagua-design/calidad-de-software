// js/firebase-config.js

// ARCHIVO DE PURA CONFIGURACIÓN. NO INICIALIZA NADA.

export const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

// Dominio permitido para acceso de alumnos
export const allowedEmailDomain = "potros.itson.edu.mx";

// Correos con permisos de docente
export const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx",
  "profe.paniagua@gmail.com",
];

// Documento en Firestore con lista de docentes adicionales
export const teacherAllowlistDocPath = "config/teacherAllowlist";

// Habilitar o deshabilitar Firebase Storage
export const useStorage = true;

// Carpeta de Google Drive para materiales
export const driveFolderId = "1kHZa-58lXRWniS8O5tAUG933g4oDs8_L";
