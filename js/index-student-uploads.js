// js/index-student-uploads.js

import { onAuth } from './firebase.js'; 
import { getFirestore, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

// --- 🔽 ¡IMPORTANTE! CONFIGURA ESTOS VALORES 🔽 ---
const CLOUDINARY_CLOUD_NAME = "do8hy56ur"; // Pega tu Cloud Name de Cloudinary aquí
const CLOUDINARY_UPLOAD_PRESET = "qs_student_uploads"; // Pega el nombre de tu Upload Preset aquí
// ----------------------------------------------------

let uploadedFileInfo = null;

onAuth(user => {
    const uploadSection = document.getElementById('studentUploadsSection');
    const userRole = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();

    if (!user || userRole === 'docente') {
        if (uploadSection) uploadSection.style.display = 'none';
        return;
    }
    if (uploadSection) uploadSection.style.display = 'block';

    const form = document.getElementById('studentUploadForm');
    const uploadButton = document.getElementById('upload_widget_opener');
    const fileInfoChip = document.getElementById('file-upload-info');
    const statusDiv = document.getElementById('upload-status');
    const resetButton = document.getElementById('studentUploadReset');

    if (!uploadButton || !form) return;

    const myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        folder: `calidad-de-software/${user.uid}`,
        language: 'es',
        multiple: false,
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            uploadedFileInfo = result.info;
            fileInfoChip.textContent = `Archivo adjunto: ${uploadedFileInfo.original_filename}.${uploadedFileInfo.format}`;
            fileInfoChip.style.display = 'inline-block';
            showStatus('Archivo listo. Haz clic en "Enviar entrega" para finalizar.', 'info');
        }
        if (error) {
            console.error('Error de Cloudinary:', error);
            showStatus('Ocurrió un error al adjuntar el archivo.', 'error');
        }
    });

    uploadButton.addEventListener('click', () => myWidget.open(), false);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleSelect = document.getElementById('studentUploadTitle');
        const descriptionText = document.getElementById('studentUploadDescription');

        if (!titleSelect.value) {
            return showStatus('Debes seleccionar la actividad que estás entregando.', 'error');
        }
        if (!uploadedFileInfo) {
            return showStatus('Debes adjuntar un archivo antes de enviar.', 'error');
        }

        showStatus('Registrando tu entrega, por favor espera...', 'info');
        form.querySelector('button[type="submit"]').disabled = true;

        try {
            await saveUploadInfoToFirestore(user, {
                title: titleSelect.options[titleSelect.selectedIndex].text,
                titleId: titleSelect.value,
                description: descriptionText.value,
                fileInfo: uploadedFileInfo
            });
            showStatus('¡Entrega registrada con éxito!', 'success');
            form.reset();
            fileInfoChip.style.display = 'none';
            uploadedFileInfo = null;
        } catch (dbError) {
            console.error("Error al registrar en Firestore:", dbError);
            showStatus('No se pudo registrar la entrega. Inténtalo de nuevo.', 'error');
        } finally {
            form.querySelector('button[type="submit"]').disabled = false;
        }
    });

    if(resetButton) {
        resetButton.addEventListener('click', () => {
            form.reset();
            fileInfoChip.style.display = 'none';
            uploadedFileInfo = null;
            showStatus('Formulario limpiado. Listo para una nueva entrega.', 'info');
        });
    }

    // ✅ FUNCIÓN DE AYUDA MOVIDA AQUÍ DENTRO
    // Ahora puede "ver" la variable statusDiv definida arriba.
    function showStatus(message, type) {
        if (!statusDiv) return;
        statusDiv.textContent = message;
        statusDiv.className = `student-uploads__status ${
            type === 'success' ? 'is-success' :
            type === 'error'   ? 'is-danger'  : 'is-info'
        }`;
    }
});

// Esta función es llamada desde arriba, por lo que puede permanecer aquí.
async function saveUploadInfoToFirestore(user, data) {
    const db = getFirestore();
    await addDoc(collection(db, "studentUploads"), {
        student: {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
        },
        title: data.title,
        titleId: data.titleId,
        description: data.description,
        fileName: data.fileInfo.original_filename + '.' + data.fileInfo.format,
        fileUrl: data.fileInfo.secure_url,
        fileSize: data.fileInfo.bytes,
        fileType: data.fileInfo.resource_type,
        submittedAt: serverTimestamp(),
        status: 'enviado',
        uploadSource: 'cloudinary',
    });
}
