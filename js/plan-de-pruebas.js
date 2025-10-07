// js/plan-de-pruebas.js

// Importamos únicamente la función de guardado
import { saveTestPlan } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveButton');
    const clearButton = document.getElementById('clearButton');
    const printButton = document.getElementById('printButton');
    const textareas = document.querySelectorAll('.input-area');

    saveButton.addEventListener('click', handleSave);
    clearButton.addEventListener('click', handleClearForm);
    printButton.addEventListener('click', handleExportPDF);
    
    generateNavLinks();

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
     * FUNCIÓN DEFINITIVA: Exporta el contenido del formulario a un archivo PDF.
     * Soluciona el problema del PDF en blanco asegurando que el contenido sea renderizado.
     */
    function handleExportPDF() {
        const originalElement = document.querySelector('.plan-document');
        const planId = document.getElementById('identificador').value.trim() || "nuevo-plan";
        const fileName = `Plan de Pruebas - ${planId}.pdf`;

        printButton.disabled = true;
        printButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparando...';

        // 1. Clonar el elemento para no alterar la vista actual
        const exportContainer = originalElement.cloneNode(true);
        exportContainer.id = 'pdf-export-container'; // ID para aplicar estilos específicos

        // 2. Reemplazar cada <textarea> por un <div> que preserve el formato
        exportContainer.querySelectorAll('.input-area').forEach(textarea => {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pdf-content';
            // Convertir saltos de línea a <br> y usar textContent para seguridad
            contentDiv.innerHTML = textarea.value.replace(/\n/g, '<br>');
            textarea.parentNode.replaceChild(contentDiv, textarea);
        });

        // 3. Añadir el clon al DOM para que sea renderizable
        document.body.appendChild(exportContainer);
        
        // Opciones de configuración para html2pdf.js
        const opt = {
            margin:       [0.6, 0.5, 0.6, 0.5],
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Mejor manejo de saltos de página
        };

        // 4. Usar un pequeño retardo para dar tiempo al navegador a renderizar el clon
        setTimeout(() => {
            html2pdf().from(exportContainer).set(opt).save().then(() => {
                // 5. Limpieza final
                document.body.removeChild(exportContainer);
                printButton.disabled = false;
                printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
            }).catch(err => {
                console.error("Error al generar el PDF:", err);
                alert("Hubo un problema al crear el PDF.");
                document.body.removeChild(exportContainer);
                printButton.disabled = false;
                printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
            });
        }, 100); // 100 milisegundos de espera
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
