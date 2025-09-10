// Rellena este archivo con la configuración de tu proyecto Firebase.
// Obtén las credenciales en Firebase Console > Configuración del proyecto > tus apps web.
// IMPORTANTE: No subas credenciales sensibles a repos públicos.

export const firebaseConfig = {
  apiKey: "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8",
  authDomain: "calidad-de-software-v2.firebaseapp.com",
  projectId: "calidad-de-software-v2",
  // Nota: el valor esperado aquí es el bucket canonical (appspot.com)
  // El dominio firebasestorage.app se usa en URLs de descarga, no como nombre de bucket
  storageBucket: "calidad-de-software-v2.appspot.com",
  messagingSenderId: "220818066383",
  appId: "1:220818066383:web:0c2119f470a5f9711b60ba"
};

// Dominio permitido para acceso de alumnos
export const allowedEmailDomain = "potros.itson.edu.mx";

// Correos con permisos de docente (pueden editar calificaciones y materiales)
export const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx"
];

// Habilitar o deshabilitar Firebase Storage.
// Si no puedes crear un bucket en tu región, déjalo en false.
export const useStorage = false;

// Carpeta de Google Drive para materiales (ID extraído del enlace compartido)
// URL compartida: https://drive.google.com/drive/folders/1kHZa-58lXRWniS8O5tAUG933g4oDs8_L?usp=sharing
export const driveFolderId = "1kHZa-58lXRWniS8O5tAUG933g4oDs8_L";
