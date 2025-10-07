// js/plan-de-pruebas.js

// Importamos únicamente la función de guardado
import { saveTestPlan } from './firebase.js';

// Usamos el objeto jspdf que se carga globalmente desde el script
const { jsPDF } = window.jspdf;

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
     * FUNCIÓN FINAL CON LIBRERÍA JSPDF: Exporta el contenido a un PDF.
     * Este método es el más confiable y definitivo.
     */
    function handleExportPDF() {
        const originalElement = document.querySelector('.plan-document');
        const planId = document.getElementById('identificador').value.trim() || "nuevo-plan";
        const fileName = `Plan de Pruebas - ${planId}.pdf`;

        printButton.disabled = true;
        printButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando PDF...';

        // 1. Clonamos el nodo para prepararlo para la exportación
        const exportContainer = originalElement.cloneNode(true);
        exportContainer.id = 'pdf-export-container';

        // 2. Reemplazamos los textareas por divs para una mejor visualización
        exportContainer.querySelectorAll('.input-area').forEach(textarea => {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pdf-content';
            contentDiv.innerHTML = textarea.value.replace(/\n/g, '<br>');
            textarea.parentNode.replaceChild(contentDiv, textarea);
        });

        // 3. Lo añadimos al cuerpo para que pueda ser renderizado por el navegador
        document.body.appendChild(exportContainer);

        // 4. Usamos html2canvas para capturar el clon como una imagen de alta calidad
        html2canvas(exportContainer, {
            scale: 2, // Mejora la resolución de la imagen de captura
            useCORS: true,
            logging: false,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: 'letter'
            });

            // Dimensiones del PDF y del Canvas
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const canvasRatio = canvasHeight / canvasWidth;
            
            // Calculamos la altura de la imagen en el PDF para que no se deforme
            const imgHeight = pdfWidth * canvasRatio;
            let heightLeft = imgHeight;
            let position = 0;

            // Agregamos la imagen (completa) al PDF en la primera página
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Si el contenido es más largo que una página, creamos nuevas páginas
            // y movemos la posición de la imagen hacia arriba para mostrar el resto
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            // 5. Descargamos el PDF generado
            pdf.save(fileName);

            // 6. Limpiamos el DOM eliminando el clon y restauramos el botón
            document.body.removeChild(exportContainer);
            printButton.disabled = false;
            printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
        }).catch(err => {
            console.error("Error al generar el PDF:", err);
            alert("Hubo un problema al crear el PDF. Revisa la consola para más detalles.");
            // Limpiamos y restauramos también en caso de error
            document.body.removeChild(exportContainer);
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
