// js/plan-de-pruebas.js

import { saveTestPlan } from './firebase.js';

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
     * FUNCIÓN MEJORADA: Exporta a PDF con diseño y formato A3 para evitar cortes.
     */
    function handleExportPDF() {
        const originalElement = document.querySelector('.plan-document');
        const planId = document.getElementById('identificador').value.trim() || "nuevo-plan";
        const fileName = `Plan de Pruebas - ${planId}.pdf`;

        printButton.disabled = true;
        printButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando PDF...';

        const exportContainer = originalElement.cloneNode(true);
        exportContainer.id = 'pdf-export-container';

        exportContainer.querySelectorAll('.input-area').forEach(textarea => {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pdf-content';
            contentDiv.innerHTML = textarea.value.replace(/\n/g, '<br>');
            textarea.parentNode.replaceChild(contentDiv, textarea);
        });

        document.body.appendChild(exportContainer);

        html2canvas(exportContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            // CAMBIO: Usamos formato 'a3' para tener una hoja más larga
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: 'a3' 
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasRatio;
            
            let heightLeft = imgHeight;
            let position = 0;
            let page = 1;

            // Función para añadir cabecera y pie de página
            const addHeadersAndFooters = () => {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    pdf.setPage(i);
                    // -- Cabecera --
                    pdf.setFillColor(45, 52, 71); // Color oscuro (#2d3447)
                    pdf.rect(0, 0, pdfWidth, 0.5, 'F');
                    pdf.setFontSize(14);
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Plan de Pruebas de Software', pdfWidth / 2, 0.3, { align: 'center' });

                    // -- Pie de página --
                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Página ${i} de ${pageCount}`, pdfWidth / 2, pdfHeight - 0.3, { align: 'center' });
                }
            };

            // Añadir la primera página
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Añadir páginas adicionales si es necesario
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            // Añadir diseño a todas las páginas generadas
            addHeadersAndFooters();

            pdf.save(fileName);

            document.body.removeChild(exportContainer);
            printButton.disabled = false;
            printButton.innerHTML = '<i class="bi bi-printer me-2"></i>Imprimir / PDF';
        }).catch(err => {
            console.error("Error al generar el PDF:", err);
            alert("Hubo un problema al crear el PDF. Revisa la consola.");
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
