// Rellena este archivo con la configuración de tu proyecto Firebase.
// Obtén las credenciales en Firebase Console > Configuración del proyecto > tus apps web.
// IMPORTANTE: No subas credenciales sensibles a repos públicos.

export const firebaseConfig = {
  apiKey: "AIzaSyBtNovYd0nk0JCgEIZcnip3ynVwZq4mXSE",
  authDomain: "clase-calidad-software.firebaseapp.com",
  projectId: "clase-calidad-software",
  storageBucket: "clase-calidad-software.firebasestorage.app",
  messagingSenderId: "506608159674",
  appId: "1:506608159674:web:ae1cc61c9e9ffda583eb83"
};

// Dominio permitido para acceso de alumnos
export const allowedEmailDomain = "potros.itson.edu.mx";

// Correos con permisos de docente (pueden editar calificaciones y materiales)
export const allowedTeacherEmails = [
  "isaac.paniagua@potros.itson.edu.mx"
];
