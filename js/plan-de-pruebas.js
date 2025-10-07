// js/plan-de-pruebas.js

// Importamos únicamente la función de guardado
import { saveTestPlan } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos de la UI restantes
    const saveButton = document.getElementById('saveButton');
    const clearButton = document.getElementById('clearButton');
    const printButton = document.getElementById('printButton');
    const textareas = document.querySelectorAll('.input-area');

    // --- EVENT LISTENERS ---
    saveButton.addEventListener('click', handleSave);
    clearButton.addEventListener('click', handleClearForm);
    printButton.addEventListener('click', handleExportPDF);
    
    // Generar navegación dinámica al cargar la página
    generateNavLinks();

    // --- LÓGICA PRINCIPAL ---

    async function handleSave() {
        const formData = {};
        textareas.forEach(textarea => {
            formData[textarea.id] = textarea.value;
        });

        const planId = formData.identificador;
        if (!planId || planId.trim() === '') {
            alert('El campo "Identificador del Plan de Pruebas" es obligatorio para guardar.');
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';

        try {
            await saveTestPlan(planId, formData);
            alert(`✅ Plan "${planId}" guardado con éxito.`);
        } catch (error) {
            console.error("Error al guardar:", error);
            alert(`❌ Hubo un error al guardar el plan: ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-2"></i>Guardar en Plataforma';
        }
    }

    /**
     * FUNCIÓN CORREGIDA: Exporta el contenido del formulario a un archivo PDF
     * con un diseño mejorado.
     */
    function handleExportPDF() {
        const originalElement = document.querySelector('.plan-document');
        const planId = document.getElementById('identificador').value || "nuevo-plan";
        const fileName = `Plan de Pruebas - ${planId}.pdf`;

        // 1. Crear un contenedor temporal para la versión de exportación
        const exportContainer = document.createElement('div');
        exportContainer.innerHTML = originalElement.innerHTML;
        exportContainer.classList.add('plan-document-pdf'); // Clase para estilos PDF

        // 2. Reemplazar cada <textarea> con un <div> con el contenido
        exportContainer.querySelectorAll('.input-area').forEach(textarea => {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pdf-content';
            
            // Escapamos HTML para seguridad y preservamos saltos de línea
            const safeText = document.createTextNode(textarea.value).textContent;
            contentDiv.innerHTML = safeText.replace(/\n/g, '<br>');
            
            textarea.parentNode.replaceChild(contentDiv, textarea);
        });

        // 3. Añadir temporalmente el contenedor al DOM para que sea renderizable
        document.body.appendChild(exportContainer);

        // Opciones de configuración para html2pdf.js
        const opt = {
            margin:       [0.7, 0.5, 0.7, 0.5], // Márgenes en pulgadas [arriba, izq, abajo, der]
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Feedback visual para el usuario
        printButton.disabled = true;
        printButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exportando...';

        // 4. Llamada a la biblioteca para generar y descargar el PDF
        html2pdf().from(exportContainer).set(opt).save().then(() => {
            // Restaurar el botón y limpiar
            printButton.disabled = false;
            printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
            document.body.removeChild(exportContainer);
        }).catch((error) => {
            console.error("Error al exportar PDF:", error);
            alert("Ocurrió un error al generar el PDF.");
            // Restaurar el botón y limpiar en caso de error
            printButton.disabled = false;
            printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
            document.body.removeChild(exportContainer);
        });
    }
    
    function handleClearForm() {
        if (confirm('¿Estás seguro de que quieres borrar todo el contenido del formulario?')) {
            textareas.forEach(textarea => textarea.value = '');
        }
    }
    
    function generateNavLinks() {
        const navContainer = document.getElementById('navigation-links');
        const sections = document.querySelectorAll('.section h2');
        sections.forEach(h2 => {
            const sectionId = h2.parentElement.id;
            const link = document.createElement('button');
            link.className = 'btn btn-outline-secondary';
            link.textContent = h2.textContent;
            link.onclick = () => document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
            navContainer.appendChild(link);
        });
    }
});
