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
    
    const countEl = document.querySelector("[data-upload-count]");
    const uploadStatusDiv = document.getElementById('studentUploadStatus');

    // --- Variables de Estado ---
    let currentUser = null;
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
            if (countEl) countEl.textContent = 0; // Resetea el contador al cerrar sesión
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
        // El observador ahora solo actualiza el contador total de entregas.
        observeStudentUploads(uid, (items) => {
            if (countEl) countEl.textContent = items.length;
        }, (error) => {
            console.error("Error observando entregas:", error);
            updateUploadStatus("Error al cargar tus entregas anteriores.", "error");
        });
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
