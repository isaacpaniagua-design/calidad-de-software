// js/plan-de-pruebas.js

// Importamos las funciones que acabamos de crear en firebase.js
import { saveTestPlan, fetchAllTestPlans, fetchTestPlanById } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos principales de la UI
    const saveButton = document.getElementById('saveButton');
    const loadButton = document.getElementById('loadButton');
    const clearButton = document.getElementById('clearButton');
    const printButton = document.getElementById('printButton');
    const modal = document.getElementById('loadPlanModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const textareas = document.querySelectorAll('.input-area');

    // --- EVENT LISTENERS ---
    saveButton.addEventListener('click', handleSave);
    loadButton.addEventListener('click', handleOpenLoadModal);
    clearButton.addEventListener('click', handleClearForm);
    printButton.addEventListener('click', () => window.print());
    closeModalButton.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

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

    async function handleOpenLoadModal() {
        const listContainer = document.getElementById('plan-list-container');
        listContainer.innerHTML = '<p>Cargando planes...</p>';
        modal.style.display = 'flex';

        try {
            const plans = await fetchAllTestPlans();
            let html = '';
            if (plans.length > 0) {
                html = '<div class="list-group">';
                plans.forEach(plan => {
                    const modDate = plan.lastModified ? plan.lastModified.toDate().toLocaleString() : 'N/A';
                    html += `<a href="#" class="list-group-item" data-plan-id="${plan.id}">
                               <strong>${plan.id}</strong>
                               <small>Modificado: ${modDate}</small>
                           </a>`;
                });
                html += '</div>';
            } else {
                html = '<p>No hay planes guardados.</p>';
            }
            listContainer.innerHTML = html;
            
            // Añadir event listeners a los nuevos elementos
            listContainer.querySelectorAll('.list-group-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleLoadPlan(item.dataset.planId);
                });
            });

        } catch (error) {
            console.error("Error al cargar lista de planes:", error);
            listContainer.innerHTML = `<p class="text-danger">Error al cargar la lista: ${error.message}</p>`;
        }
    }

    async function handleLoadPlan(planId) {
        modal.style.display = 'none';
        try {
            const planData = await fetchTestPlanById(planId);
            if (planData) {
                textareas.forEach(textarea => {
                    textarea.value = planData[textarea.id] || '';
                });
                alert(`Plan "${planId}" cargado.`);
            } else {
                alert(`No se encontró el plan "${planId}".`);
            }
        } catch (error) {
            console.error("Error al cargar el plan:", error);
            alert(`❌ Error al cargar el plan: ${error.message}`);
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
