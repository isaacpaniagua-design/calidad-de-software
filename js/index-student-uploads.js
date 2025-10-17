// En: js/index-student-uploads.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { createStudentUpload, observeStudentUploads } from "./student-uploads.js";
import { courseActivities } from './course-activities.js';
import { initDriveUploader, uploadFile } from "./student-file-uploader.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- Referencias al DOM ---
    const form = document.getElementById("studentUploadForm");
    const titleSelect = document.getElementById("studentUploadTitle");
    const typeSelect = document.getElementById("studentUploadType");
    const descriptionTextarea = document.getElementById("studentUploadDescription");
    const fileInput = document.getElementById("studentUploadFile");
    const submitBtn = form.querySelector('button[type="submit"]');
    const resetBtn = document.getElementById("studentUploadReset");
    
    // Contenedores de listas y botones del historial
    const listEl = document.getElementById("studentUploadList");
    const emptyEl = document.getElementById("studentUploadEmpty");
    const fullHistoryListEl = document.getElementById("fullHistoryList");
    const btnVerHistorial = document.getElementById("btn-ver-historial");
    
    const countEl = document.querySelector("[data-upload-count]");

    // --- Variables de Estado y Modales ---
    let currentUser = null;
    let todasLasEntregas = [];
    let statusModalInstance, historialModalInstance;

    // Se asume que Bootstrap JS está cargado en la página para que esto funcione
    try {
        statusModalInstance = new bootstrap.Modal(document.getElementById('statusModal'));
        historialModalInstance = new bootstrap.Modal(document.getElementById('historialModal'));
    } catch (e) {
        console.error("Error inicializando los modales de Bootstrap. Asegúrate de que el JS de Bootstrap esté cargado.", e);
    }
    
    // --- Autenticación y Carga Inicial ---
    populateActivitiesSelect();
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            submitBtn.disabled = false;
            initDriveUploader(); // Pre-cargamos la API de Google Drive
            startObserver(user.uid);
        } else {
            submitBtn.disabled = true;
            renderAllLists([]); // Limpiar listas si el usuario cierra sesión
        }
    });

    // --- Manejadores de Eventos ---
    form.addEventListener("submit", handleFormSubmit);

    resetBtn.addEventListener('click', () => {
        form.reset();
        mostrarModalDeEstado("Formulario Limpiado", "Puedes registrar una nueva entrega.", "info");
    });

    btnVerHistorial.addEventListener('click', () => {
        renderUploads(todasLasEntregas, fullHistoryListEl); // Renderiza todas las entregas
        if (historialModalInstance) historialModalInstance.show();
    });

    // --- Lógica Principal ---

    async function handleFormSubmit(e) {
        e.preventDefault();
        if (!currentUser) {
            return mostrarModalDeEstado("Error de Autenticación", "Debes iniciar sesión para hacer una entrega.", "error");
        }
        if (!fileInput.files || fileInput.files.length === 0) {
            return mostrarModalDeEstado("Archivo Faltante", "Por favor, selecciona un archivo para subir.", "error");
        }

        const file = fileInput.files[0];
        const selectedOption = titleSelect.options[titleSelect.selectedIndex];
        if (!selectedOption || selectedOption.disabled) {
            return mostrarModalDeEstado("Actividad no seleccionada", "Por favor, selecciona una actividad de la lista.", "error");
        }
        const unitLabel = selectedOption.dataset.unitLabel || "General";
        const activityTitle = selectedOption.text;

        mostrarModalDeEstado("Procesando...", "Subiendo archivo a Google Drive...", "loading");

        try {
            const driveResponse = await uploadFile(file, {
                unit: unitLabel,
                activity: activityTitle,
                studentName: currentUser.displayName || currentUser.email,
            });

            mostrarModalDeEstado("Procesando...", "Registrando entrega en la plataforma...", "loading");
            
            const payload = {
                title: titleSelect.value,
                description: descriptionTextarea.value,
                kind: typeSelect.value,
                fileUrl: driveResponse.webViewLink,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                student: { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email },
                extra: {
                    uploadBackend: "googledrive",
                    driveFileId: driveResponse.id,
                    unitId: selectedOption.dataset.unitId,
                    unitLabel: unitLabel,
                    activityTitle: activityTitle,
                },
            };
            
            await createStudentUpload(payload);

            if (statusModalInstance) statusModalInstance.hide();
            setTimeout(() => {
                mostrarModalDeEstado("¡Entrega Exitosa!", "Tu archivo ha sido registrado correctamente.", "success");
            }, 500);
            
            form.reset();
            populateActivitiesSelect(); // Resetea el selector a su estado inicial

        } catch (error) {
            console.error("Error en el proceso de entrega:", error);
            if (statusModalInstance) statusModalInstance.hide();
            setTimeout(() => {
                mostrarModalDeEstado("Error en la Entrega", `No se pudo completar el proceso: ${error.message}`, "error");
            }, 500);
        }
    }

    function startObserver(uid) {
        observeStudentUploads(uid, (items) => {
            todasLasEntregas = items; // Almacenamos la lista completa
            renderAllLists(items);
        }, (error) => {
            console.error("Error observando entregas:", error);
            mostrarModalDeEstado("Error de Carga", "No se pudieron cargar tus entregas anteriores.", "error");
        });
    }

    function renderAllLists(items) {
        if (countEl) countEl.textContent = items.length;
        const tresUltimas = items.slice(0, 3);
        renderUploads(tresUltimas, listEl, emptyEl);
    }
    
    function renderUploads(items = [], listContainer, emptyContainer) {
        if (!listContainer) return;
        
        const hasItems = items.length > 0;
        if (emptyContainer) emptyContainer.hidden = hasItems;
        listContainer.innerHTML = !hasItems ? '' : items.map(item => {
            const submittedDate = item.submittedAt?.toDate ? new Date(item.submittedAt.toDate()).toLocaleString() : 'Fecha no disponible';
            const descriptionHTML = item.description ? `<p class="student-uploads__item-description">${item.description}</p>` : '';
            
            return `
                <li class="student-uploads__item">
                    <div class="student-uploads__item-header">
                        <div class="student-uploads__item-heading">
                            <span class="student-uploads__item-title">${item.extra?.activityTitle || item.title}</span>
                            <span class="student-uploads__item-chip">${item.kind || 'Entrega'}</span>
                        </div>
                        <span class="student-uploads__item-status student-uploads__item-status--${item.status || 'enviado'}">${item.status || 'enviado'}</span>
                    </div>
                    <p class="student-uploads__item-meta">Enviado: ${submittedDate}</p>
                    ${descriptionHTML}
                    <div class="student-uploads__item-actions">
                        <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="student-uploads__item-link">Ver Archivo en Drive</a>
                    </div>
                </li>
            `;
        }).join('');
    }

    function mostrarModalDeEstado(title, message, type) {
        if (!statusModalInstance) return;
        const modalTitle = document.getElementById('statusModalLabel');
        const modalBody = document.getElementById('statusModalBody');
        
        const iconMap = {
            success: 'fa-check-circle',
            loading: 'fa-spinner fa-spin',
            error: 'fa-times-circle',
            info: 'fa-info-circle'
        };
        
        const iconHtml = `<div class="modal-icon icon-${type}"><i class="fas ${iconMap[type]}"></i></div>`;

        modalTitle.textContent = title;
        modalBody.innerHTML = `${iconHtml}<p class="text-center">${message}</p>`;
        statusModalInstance.show();
    }

    function populateActivitiesSelect() {
        const selectEl = document.getElementById('studentUploadTitle');
        selectEl.innerHTML = '';
        const defaultOption = new Option('Selecciona la actividad o asignación', '', true, true);
        defaultOption.disabled = true;
        selectEl.add(defaultOption);

        courseActivities.forEach(unit => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = unit.unitLabel;
            unit.activities.forEach(activity => {
                const option = new Option(activity.title, activity.id);
                option.dataset.unitId = unit.unitId;
                option.dataset.unitLabel = unit.unitLabel;
                optgroup.appendChild(option);
            });
            selectEl.appendChild(optgroup);
        });
    }
});
