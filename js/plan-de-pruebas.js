// js/plan-de-pruebas.js

// Ya no necesitamos la importación de Firebase para guardar, ahora es local.
// import { saveTestPlan } from './firebase.js';

const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveButton');
    const clearButton = document.getElementById('clearButton');
    const printButton = document.getElementById('printButton');
    const textareas = document.querySelectorAll('.input-area');
    const localStorageKey = 'testPlanData'; // Clave para guardar en el navegador

    // --- LÓGICA DE GUARDADO Y CARGA LOCAL ---

    /**
     * Guarda el contenido de todos los textareas en el localStorage del navegador.
     */
    const saveDataToLocalStorage = () => {
        const formData = {};
        textareas.forEach(textarea => {
            formData[textarea.id] = textarea.value;
        });
        // Convertimos el objeto a un string JSON para guardarlo
        localStorage.setItem(localStorageKey, JSON.stringify(formData));
    };

    /**
     * Carga los datos desde localStorage y los pone en los textareas.
     */
    const loadDataFromLocalStorage = () => {
        const savedData = localStorage.getItem(localStorageKey);
        if (savedData) {
            const formData = JSON.parse(savedData);
            textareas.forEach(textarea => {
                if (formData[textarea.id]) {
                    textarea.value = formData[textarea.id];
                }
            });
        }
    };
    
    // --- EVENT LISTENERS ---

    // 1. Al cargar la página, intenta cargar el progreso guardado.
    loadDataFromLocalStorage();

    // 2. El botón de guardar ahora usa la función local.
    saveButton.addEventListener('click', () => {
        saveDataToLocalStorage();
        // Feedback visual para el usuario
        saveButton.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>¡Guardado!';
        setTimeout(() => {
            saveButton.innerHTML = '<i class="bi bi-device-hdd-fill me-2"></i>Guardar Localmente';
        }, 1500);
    });
    
    // 3. Limpiar el formulario ahora también limpia el storage.
    clearButton.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todo el contenido del formulario? Esta acción no se puede deshacer.')) {
            textareas.forEach(textarea => textarea.value = '');
            localStorage.removeItem(localStorageKey);
        }
    });

    // 4. La exportación a PDF sigue igual, ya que lee el contenido actual.
    printButton.addEventListener('click', handleExportPDF);
    
    // 5. Autoguardado: Cada vez que el usuario escribe, se guarda el progreso.
    textareas.forEach(textarea => {
        textarea.addEventListener('input', saveDataToLocalStorage);
    });

    // Generar navegación dinámica
    generateNavLinks();

    /**
     * Función de exportación a PDF (sin cambios, pero necesaria aquí).
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
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'a3' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasRatio;
            
            let heightLeft = imgHeight;
            let position = 0;

            const addHeadersAndFooters = () => {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    pdf.setPage(i);
                    pdf.setFillColor(45, 52, 71);
                    pdf.rect(0, 0, pdfWidth, 0.5, 'F');
                    pdf.setFontSize(14);
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Plan de Pruebas de Software', pdfWidth / 2, 0.3, { align: 'center' });
                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Página ${i} de ${pageCount}`, pdfWidth / 2, pdfHeight - 0.3, { align: 'center' });
                }
            };

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

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
