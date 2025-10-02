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
     * NUEVA FUNCIÓN: Exporta el contenido del formulario a un archivo PDF.
     */
    function handleExportPDF() {
        const elementToExport = document.querySelector('.plan-document');
        const planId = document.getElementById('identificador').value || "nuevo-plan";
        const fileName = `Plan de Pruebas - ${planId}.pdf`;

        // Opciones de configuración para html2pdf.js
        const opt = {
            margin:       [0.5, 0.5, 0.5, 0.5], // Márgenes en pulgadas [arriba, izquierda, abajo, derecha]
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Feedback visual para el usuario mientras se genera el PDF
        printButton.disabled = true;
        printButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exportando...';

        // Llamada a la biblioteca para generar y descargar el PDF
        html2pdf().from(elementToExport).set(opt).save().then(() => {
            // Restaurar el botón a su estado original
            printButton.disabled = false;
            printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
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
