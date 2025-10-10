// js/role-gate.js

document.addEventListener("DOMContentLoaded", function () {
    try {
        const rol = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();
        const isTeacher = rol === 'docente';

        console.log(`Renderizando página para el rol: ${rol.toUpperCase()}`);

        // --- MEJORA: Añadir clase de rol al <html> ---
        // Esto permite estilizar con CSS, ej: html.role-estudiante .teacher-only { display: none; }
        document.documentElement.classList.add(`role-${rol}`);

        // --- TU LÓGICA ORIGINAL (CONSERVADA Y OPTIMIZADA) ---
        if (!isTeacher) {
            // Ocultar elementos exclusivos para docentes
            document.querySelectorAll(".teacher-only, .docente-only").forEach(function (el) {
                el.style.display = "none";
            });

            // Deshabilitar controles para estudiantes (tu lógica original)
            document.querySelectorAll("input, select, textarea, button").forEach(function (el) {
                // Se conserva tu lógica de no deshabilitar botones de subida/tabs
                const isExemptButton = el.classList.contains('tab-button') || 
                                       el.classList.contains('upload-trigger') || 
                                       el.classList.contains('upload-reset');

                if (el.tagName === "BUTTON" && !isExemptButton) {
                    el.disabled = true;
                } else if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
                    // La propiedad 'readOnly' es mejor para inputs que 'disabled' porque permite seleccionar el texto.
                    el.readOnly = true; 
                }
            });
        }
        
    } catch (e) {
        console.error("Error al aplicar las reglas de rol:", e);
    }
});
