// js/index-student-uploads.js

import { onAuth, getFirestore, addDoc, collection, serverTimestamp } from './firebase.js';

// --- 🔽 ¡IMPORTANTE! CONFIGURA ESTOS VALORES 🔽 ---
const CLOUDINARY_CLOUD_NAME = "do8hy56ur"; // Pega tu Cloud Name de Cloudinary aquí
const CLOUDINARY_UPLOAD_PRESET = "qs_student_uploads"; // Pega el nombre de tu Upload Preset aquí
// ----------------------------------------------------

onAuth(user => {
    const uploadSection = document.getElementById('studentUploadsSection');
    const userRole = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();

    // La sección de subida solo debe aparecer para estudiantes autenticados
    if (!user || userRole === 'docente') {
        if (uploadSection) uploadSection.style.display = 'none';
        return;
    }
    if (uploadSection) uploadSection.style.display = 'block';

    const statusDiv = document.getElementById('upload-status');
    const uploadButton = document.getElementById('upload_widget_opener');

    if (!uploadButton) return;

    // Configura el widget de Cloudinary
    const myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'url', 'camera', 'google_drive'],
        folder: `calidad-de-software/${user.uid}`,
        language: 'es',
        multiple: false,
    }, async (error, result) => {
        if (!error && result && result.event === "success") {
            showStatus('Archivo subido. Registrando entrega...', 'info');
            try {
                await saveUploadInfoToFirestore(user, result.info);
                showStatus('¡Entrega registrada con éxito!', 'success');
            } catch (dbError) {
                console.error("Error al registrar en Firestore:", dbError);
                showStatus('El archivo se subió, pero no se pudo registrar. Contacta al docente.', 'warning');
            }
        }
        if(error) {
            console.error('Error de Cloudinary:', error);
            showStatus('Ocurrió un error durante la subida.', 'error');
        }
    });

    uploadButton.addEventListener('click', () => myWidget.open(), false);

    async function saveUploadInfoToFirestore(user, fileInfo) {
        const db = getFirestore();
        await addDoc(collection(db, "studentUploads"), {
            student: {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
            },
            fileName: fileInfo.original_filename + '.' + fileInfo.format,
            fileUrl: fileInfo.secure_url,
            fileSize: fileInfo.bytes,
            fileType: fileInfo.resource_type,
            submittedAt: serverTimestamp(),
            status: 'enviado',
            uploadSource: 'cloudinary',
        });
    }

    function showStatus(message, type) {
        if (!statusDiv) return;
        statusDiv.textContent = message;
        statusDiv.className = `mt-4 text-center font-semibold ${
            type === 'success' ? 'text-green-600' :
            type === 'error'   ? 'text-red-600'   :
            type === 'warning' ? 'text-yellow-600' : 'text-gray-600'
        }`;
    }
});
