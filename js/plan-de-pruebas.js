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
    printButton.addEventListener('click', () => window.print());

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
