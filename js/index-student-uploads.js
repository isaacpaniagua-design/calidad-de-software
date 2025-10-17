// En: js/index-student-uploads.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { createStudentUpload, observeStudentUploads } from "./student-uploads.js";
import { courseActivities } from './course-activities.js';
import { initDriveUploader, uploadFile } from "./student-file-uploader.js";

document.addEventListener("DOMContentLoaded", () => {
    // Llenar el selector de actividades tan pronto como el DOM esté listo
    populateActivitiesSelect();

    // --- Referencias al DOM ---
    const form = document.getElementById("studentUploadForm");
    const titleSelect = document.getElementById("studentUploadTitle");
    const typeSelect = document.getElementById("studentUploadType");
    const descriptionTextarea = document.getElementById("studentUploadDescription");
    const fileInput = document.getElementById("studentUploadFile");
    const submitBtn = form.querySelector('button[type="submit"]');
    const resetBtn = document.getElementById("studentUploadReset");
    const statusEl = document.getElementById("studentUploadStatus");
    const listEl = document.getElementById("studentUploadList");
    const emptyEl = document.getElementById("studentUploadEmpty");
    const countEl = document.querySelector("[data-upload-count]");

    let currentUser = null;

    // --- Autenticación y Estado Inicial ---
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            updateStatus(`Sesión iniciada como ${user.displayName || user.email}. Ya puedes registrar entregas.`, 'success');
            submitBtn.disabled = false;
            initDriveUploader(); // Inicializamos el cliente de Google Drive
            startObserver(user.uid);
        } else {
            updateStatus("Inicia sesión con Google para poder subir y registrar tus entregas.", 'warning');
            submitBtn.disabled = true;
            renderUploads([]); // Limpiar la lista si el usuario cierra sesión
        }
    });

    /**
     * Llena el <select> de actividades a partir de la lista en course-activities.js
     */
    function populateActivitiesSelect() {
        const selectEl = document.getElementById('studentUploadTitle');
        selectEl.innerHTML = ''; // Limpiar opciones para evitar duplicados

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

    // --- Manejo del Formulario ---
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUser) {
            updateStatus("Error: Debes iniciar sesión para hacer una entrega.", "error");
            return;
        }
        if (!fileInput.files || fileInput.files.length === 0) {
            updateStatus("Por favor, selecciona un archivo para subir.", "error");
            return;
        }

        const file = fileInput.files[0];
        const selectedOption = titleSelect.options[titleSelect.selectedIndex];
        const unitLabel = selectedOption.dataset.unitLabel || "General";
        const activityTitle = selectedOption.text;

        setLoadingState(true, 'Subiendo a Google Drive...');

        try {
            // 1. Subir a Google Drive
            const driveResponse = await uploadFile(file, {
                unit: unitLabel,
                activity: activityTitle,
                studentName: currentUser.displayName || currentUser.email,
            });

            // 2. Preparar payload para Firestore
            const payload = {
                title: titleSelect.value,
                description: descriptionTextarea.value,
                kind: typeSelect.value,
                fileUrl: driveResponse.webViewLink,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                student: {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email
                },
                extra: {
                    uploadBackend: "googledrive",
                    driveFileId: driveResponse.id,
                    unitId: selectedOption.dataset.unitId,
                    unitLabel: unitLabel,
                    activityTitle: activityTitle,
                },
            };
            
            // 3. Registrar en Firestore
            setLoadingState(true, 'Registrando entrega en la plataforma...');
            await createStudentUpload(payload);

            updateStatus("¡Entrega registrada con éxito!", "success");
            form.reset();

        } catch (error) {
            console.error("Error en el proceso de entrega:", error);
            updateStatus(`Error: ${error.message || "No se pudo completar la entrega."}`, "error");
        } finally {
            setLoadingState(false);
        }
    });

    resetBtn.addEventListener('click', () => {
        form.reset();
        updateStatus("Formulario limpiado. Listo para una nueva entrega.", "info");
    });

    // --- Lógica de UI (Observador y Renderizado) ---
    function startObserver(uid) {
        observeStudentUploads(uid, 
            (items) => { renderUploads(items); }, 
            (error) => {
                console.error("Error observando entregas:", error);
                updateStatus("No se pudieron cargar tus entregas anteriores.", "error");
            }
        );
    }

    function renderUploads(items = []) {
        if(countEl) countEl.textContent = items.length;
        
        if (items.length === 0) {
            if(emptyEl) emptyEl.hidden = false;
            if(listEl) listEl.innerHTML = "";
            return;
        }

        if(emptyEl) emptyEl.hidden = true;
        if(listEl) {
            listEl.innerHTML = items.map(item => {
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
    }

    function updateStatus(message, type) {
        if(statusEl) {
            statusEl.textContent = message;
            statusEl.className = `student-uploads__status is-${type}`;
        }
    }

    function setLoadingState(isLoading, message = '') {
        if(submitBtn) {
            submitBtn.disabled = isLoading;
            if (isLoading) {
                submitBtn.textContent = message || "Procesando...";
                updateStatus(message, "info");
            } else {
                submitBtn.textContent = "Enviar entrega";
            }
        }
        form.classList.toggle('is-submitting', isLoading);
    }
});
