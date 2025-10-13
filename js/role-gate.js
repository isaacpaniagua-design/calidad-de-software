// js/role-gate.js

/**
 * Esta función se encarga de adaptar la interfaz de usuario según el rol del usuario.
 * Ahora es exportable para que otros módulos (como auth-guard) puedan llamarla.
 */
export function showRoleSpecificUI() {
    try {
        // 1. Obtener el rol del usuario desde el almacenamiento local. Si no existe, se asume 'estudiante'.
        const rol = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();
        const isTeacher = rol === 'docente';

        console.log(`Renderizando página para el rol: ${rol.toUpperCase()}`);

        // 2. Limpiar clases de rol anteriores y añadir la actual al <html>.
        document.documentElement.classList.remove('role-docente', 'role-estudiante', 'role-invitado');
        document.documentElement.classList.add(`role-${rol}`);

        // 3. Si el usuario NO es un docente, aplicar restricciones en la UI.
        if (!isTeacher) {
            
            // Ocultar todos los elementos que son exclusivos para docentes.
            document.querySelectorAll(".teacher-only, .docente-only").forEach(function (el) {
                el.style.display = "none";
            });

            // Recorrer todos los elementos de formulario para deshabilitarlos o ponerlos en modo de solo lectura.
            document.querySelectorAll("input, select, textarea, button").forEach(function (el) {
                
                const isExemptButton = el.classList.contains('tab-button') || 
                                       el.classList.contains('upload-trigger') || 
                                       el.classList.contains('upload-reset') ||
                                       el.classList.contains('action-button');

                if (el.tagName === "BUTTON" && !isExemptButton) {
                    el.disabled = true;
                
                } else if (el.tagName !== "BUTTON") {
                    el.readOnly = true; 
                }
            });
        }
        
    } catch (e) {
        console.error("Error al aplicar las reglas de rol en la interfaz:", e);
    }
}
