// Rellena este archivo con la configuración de tu proyecto Firebase.
// Obtén las credenciales en Firebase Console > Configuración del proyecto > tus apps web.
// IMPORTANTE: No subas credenciales sensibles a repos públicos.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  // Nota: el valor esperado aquí es el bucket canonical (appspot.com)
  // El dominio firebasestorage.app se usa en URLs de descarga, no como nombre de bucket
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth and db instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// Dominio permitido para acceso de alumnos
export const allowedEmailDomain = "potros.itson.edu.mx";

// Correos con permisos de docente (pueden editar calificaciones y materiales)
// Mantener sincronizado con tools/firestore.rules > allowedTeacherEmails().
export const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx",
  "profe.paniagua@gmail.com",
];

// Documento en Firestore que puede contener correos adicionales autorizados
// como docentes. Debe incluir un arreglo `emails` en minúsculas. Los correos
// declarados aquí se combinan con la lista estática anterior.
export const teacherAllowlistDocPath = "config/teacherAllowlist";

// Habilitar o deshabilitar Firebase Storage.
// Se requiere para que el personal docente pueda subir evidencias pendientes.
export const useStorage = true;

// Carpeta de Google Drive para materiales (ID extraído del enlace compartido)
// URL compartida: https://drive.google.com/drive/folders/1kHZa-58lXRWniS8O5tAUG933g4oDs8_L?usp=sharing
export const driveFolderId = "1kHZa-58lXRWniS8O5tAUG933g4oDs8_L";
