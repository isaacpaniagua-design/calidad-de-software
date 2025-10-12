// js/maintenance.js

// Estado de mantenimiento: 'true' para activado, 'false' para desactivado.
const MANTENIMIENTO_ACTIVADO = true;

// Correo del estudiante que SÍ puede acceder durante el mantenimiento.
const CORREO_EXCEPCION = "iman.guaymas@potros.itson.edu.mx";

// Función para verificar el estado de autenticación y rol del usuario.
function verificarAccesoMantenimiento() {
    if (!MANTENIMIENTO_ACTIVADO) {
        // Si el mantenimiento no está activado, no hacemos nada.
        return;
    }

    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // El usuario está autenticado.
            user.getIdTokenResult().then(idTokenResult => {
                const esDocente = idTokenResult.claims.role === 'teacher';
                const esExcepcion = user.email === CORREO_EXCEPCION;

                if (esDocente || esExcepcion) {
                    // Si es docente o es el estudiante de excepción, puede continuar.
                    console.log("Acceso permitido durante mantenimiento.");
                } else {
                    // Si es cualquier otro estudiante, se redirige a la pantalla de mantenimiento.
                    window.location.href = '/maintenance.html';
                }
            });
        } else {
            // Si no hay un usuario autenticado, el auth-guard.js debería manejarlo.
            // Si estás en una página que no sea login.html, es probable que seas redirigido.
            console.log("Usuario no autenticado, auth-guard se encargará.");
        }
    });
}

// Ejecutar la verificación en cuanto se cargue el DOM.
document.addEventListener('DOMContentLoaded', verificarAccesoMantenimiento);
