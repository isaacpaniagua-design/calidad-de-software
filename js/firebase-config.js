// js/firebase-config.js
// RESPONSABILIDAD: Ser el ÚNICO archivo que contiene y exporta la configuración del proyecto.

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

// Correos con permisos de docente (lista unificada)
export const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx",
  "profe.paniagua@gmail.com",
];

// Documento en Firestore que puede contener correos adicionales autorizados
export const teacherAllowlistDocPath = "config/teacherAllowlist";

// Habilitar o deshabilitar Firebase Storage
export const useStorage = true;

// Carpeta de Google Drive para materiales (ID extraído del enlace compartido)
export const driveFolderId = "1kHZa-58lXRWniS8O5tAUG933g4oDs8_L";
