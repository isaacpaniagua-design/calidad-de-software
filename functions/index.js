const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function que se dispara automáticamente cada vez que se crea un nuevo usuario.
 * Revisa el email del usuario y le asigna el rol 'docente' si su correo
 * pertenece al dominio de ITSON.
 */
exports.assignRoleOnCreate = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  const uid = user.uid;

  // Verifica si el email y el dominio son los esperados
  if (email && email.endsWith("@potros.itson.edu.mx")) {
    try {
      // Asigna el Custom Claim con el rol 'docente'
      await admin.auth().setCustomUserClaims(uid, { role: "docente" });
      console.log(`Rol 'docente' asignado automáticamente a ${email} (UID: ${uid})`);
      return null;
    } catch (error) {
      console.error(`Error asignando el rol 'docente' a ${email}:`, error);
      return null;
    }
  } else {
    // Para cualquier otro usuario, se le puede asignar un rol por defecto si se desea.
    // Por ahora, solo registramos que no es un docente.
    console.log(`El usuario ${email} no es un docente. No se asigna rol especial.`);
    // Opcional: Asignar rol de 'estudiante' por defecto
    // await admin.auth().setCustomUserClaims(uid, { role: "estudiante" });
    return null;
  }
});
