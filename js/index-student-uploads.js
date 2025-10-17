// En: js/index-student-uploads.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { createStudentUpload, observeStudentUploads } from "./student-uploads.js";
import { courseActivities } from './course-activities.js';
import { initDriveUploader, uploadFile } from "./student-file-uploader.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- Referencias al DOM (con validación) ---
    const form = document.getElementById("studentUploadForm");
    if (!form) {
        console.log("El formulario de entrega de actividades no se encuentra en esta página. Script detenido.");
        return;
    }

    const titleSelect = document.getElementById("studentUploadTitle");
    const typeSelect = document.getElementById("studentUploadType");
    const descriptionTextarea = document.getElementById("studentUploadDescription");
    const fileInput = document.getElementById("studentUploadFile");
    const submitBtn = form.querySelector('button[type="submit"]');
    const resetBtn = document.getElementById("studentUploadReset");
    
    const listEl = document.getElementById("studentUploadList");
    const emptyEl = document.getElementById("studentUploadEmpty");
    const countEl = document.querySelector("[data-upload-count]");
    const uploadStatusDiv = document.getElementById('studentUploadStatus');

    // --- Variables de Estado ---
    let currentUser = null;
    let todasLasEntregas = [];
    let defaultStatusMessage = '';
    
    // --- Autenticación y Carga Inicial ---
    populateActivitiesSelect();
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            defaultStatusMessage = `Sesión iniciada como ${user.displayName}. Ya puedes registrar entregas.`;
            updateUploadStatus(defaultStatusMessage, 'success', false);
            submitBtn.disabled = false; 
            initDriveUploader();
            startObserver(user.uid);
        } else {
            defaultStatusMessage = 'Debes iniciar sesión para poder registrar entregas.';
            updateUploadStatus(defaultStatusMessage, 'error', false);
            submitBtn.disabled = true;
            renderAllLists([]);
        }
    });

    // --- Manejadores de Eventos ---
    form.addEventListener("submit", handleFormSubmit);

    resetBtn.addEventListener('click', () => {
        form.reset();
        updateUploadStatus("Formulario limpiado.", "info", false);
         setTimeout(() => {
            updateUploadStatus(defaultStatusMessage, 'success', false);
        }, 3000);
    });

    /**
     * Actualiza el texto y la apariencia del div de estado, y opcionalmente hace scroll.
     * @param {string} message - El mensaje a mostrar.
     * @param {'loading'|'success'|'error'|'info'} type - El tipo de estado.
     * @param {boolean} [doScroll=true] - Si es true, se desplazará para hacer visible el mensaje.
     */
    function updateUploadStatus(message, type, doScroll = true) {
        if (!uploadStatusDiv) return;
        uploadStatusDiv.textContent = message;
        uploadStatusDiv.classList.remove('is-loading', 'is-success', 'is-error', 'is-info');
        const typeClass = `is-${type}`;
        uploadStatusDiv.classList.add(typeClass);
        if (doScroll) {
            uploadStatusDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // --- Lógica Principal ---

    async function handleFormSubmit(e) {
        e.preventDefault();
        if (!currentUser) return updateUploadStatus("Error: No has iniciado sesión.", "error");
        if (!fileInput.files || fileInput.files.length === 0) return updateUploadStatus("Error: Debes seleccionar un archivo.", "error");
        
        const selectedOption = titleSelect.options[titleSelect.selectedIndex];
        if (!selectedOption || selectedOption.disabled) return updateUploadStatus("Error: Debes seleccionar una actividad.", "error");
        
        const file = fileInput.files[0];
        const unitLabel = selectedOption.dataset.unitLabel || "General";
        const activityTitle = selectedOption.text;

        submitBtn.disabled = true;

        try {
            updateUploadStatus("Subiendo archivo a Drive...", "loading");
            const driveResponse = await uploadFile(file, {
                unit: unitLabel,
                activity: activityTitle,
                studentName: currentUser.displayName || currentUser.email,
            });

            updateUploadStatus("Registrando entrega en la plataforma...", "loading");
            const payload = {
                title: titleSelect.value,
                description: descriptionTextarea.value,
                kind: typeSelect.value,
                fileUrl: driveResponse.webViewLink,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                student: { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email },
                extra: { uploadBackend: "googledrive", driveFileId: driveResponse.id, unitId: selectedOption.dataset.unitId, unitLabel, activityTitle },
            };
            
            await createStudentUpload(payload);
            updateUploadStatus("¡Entrega exitosa! Tu archivo fue registrado.", "success");
            
            form.reset();
            populateActivitiesSelect();

            setTimeout(() => {
                updateUploadStatus(defaultStatusMessage, 'success', false);
            }, 5000);

        } catch (error) {
            console.error("Error en el proceso de entrega:", error);
            updateUploadStatus(`Error en la entrega: ${error.message}`, "error");
        } finally {
            submitBtn.disabled = false;
        }
    }

    function startObserver(uid) {
        observeStudentUploads(uid, (items) => {
            todasLasEntregas = items;
            renderAllLists(items);
        }, (error) => {
            console.error("Error observando entregas:", error);
            updateUploadStatus("Error al cargar tus entregas anteriores.", "error");
        });
    }

    function renderAllLists(items) {
        if (countEl) countEl.textContent = items.length;
        if (listEl) renderUploads(items.slice(0, 3), listEl, emptyEl);
    }
    
    function renderUploads(items = [], listContainer, emptyContainer) {
        if (!listContainer) return;
        const hasItems = items.length > 0;
        if (emptyContainer) emptyContainer.hidden = !hasItems;
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

    function populateActivitiesSelect() {
        if (!titleSelect) return;
        titleSelect.innerHTML = '';
        const defaultOption = new Option('Selecciona la actividad o asignación', '', true, true);
        defaultOption.disabled = true;
        titleSelect.add(defaultOption);

        courseActivities.forEach(unit => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = unit.unitLabel;
            unit.activities.forEach(activity => {
                const option = new Option(activity.title, activity.id);
                option.dataset.unitId = unit.unitId;
                option.dataset.unitLabel = unit.unitLabel;
                optgroup.appendChild(option);
            });
            titleSelect.appendChild(optgroup);
        });
    }
});
