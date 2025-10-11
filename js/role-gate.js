// js/role-gate.js

/**
 * Este script se encarga de adaptar la interfaz de usuario según el rol del usuario (docente o estudiante).
 * Se ejecuta en cuanto el contenido de la página está listo.
 */
document.addEventListener("DOMContentLoaded", function () {
    try {
        // 1. Obtener el rol del usuario desde el almacenamiento local. Si no existe, se asume 'estudiante'.
        const rol = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();
        const isTeacher = rol === 'docente';

        console.log(`Renderizando página para el rol: ${rol.toUpperCase()}`);

        // 2. Añadir una clase al elemento <html> para permitir estilizado específico por rol con CSS.
        // Ejemplo en CSS: html.role-estudiante .elemento-docente { display: none; }
        document.documentElement.classList.add(`role-${rol}`);

        // 3. Si el usuario NO es un docente, aplicar restricciones en la UI.
        if (!isTeacher) {
            
            // Ocultar todos los elementos que son exclusivos para docentes.
            document.querySelectorAll(".teacher-only, .docente-only").forEach(function (el) {
                el.style.display = "none";
            });

            // Recorrer todos los elementos de formulario para deshabilitarlos o ponerlos en modo de solo lectura.
            document.querySelectorAll("input, select, textarea, button").forEach(function (el) {
                
                // Definir una lista de clases que exentan a un botón de ser deshabilitado.
                const isExemptButton = el.classList.contains('tab-button') || 
                                       el.classList.contains('upload-trigger') || 
                                       el.classList.contains('upload-reset') ||
                                       el.classList.contains('action-button'); // Botones para acciones permitidas (ej. tomar asistencia)

                // Si es un botón y no está exento, deshabilitarlo.
                if (el.tagName === "BUTTON" && !isExemptButton) {
                    el.disabled = true;
                
                // Para otros inputs, usar 'readOnly' es mejor que 'disabled' porque permite al usuario seleccionar y copiar el texto.
                } else if (el.tagName !== "BUTTON") {
                    el.readOnly = true; 
                }
            });
        }
        
    } catch (e) {
        console.error("Error al aplicar las reglas de rol en la interfaz:", e);
    }
});
