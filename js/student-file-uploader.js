// js/student-file-uploader.js

import { onAuth, getFirestore, addDoc, collection, serverTimestamp } from './firebase.js';

// --- 🔽 ¡IMPORTANTE! CONFIGURA ESTOS VALORES 🔽 ---
const CLOUDINARY_CLOUD_NAME = "do8hy56ur"; // Pega tu Cloud Name de Cloudinary aquí
const CLOUDINARY_UPLOAD_PRESET = "qs_student_uploads"; // Pega el nombre de tu Upload Preset aquí
// ----------------------------------------------------

onAuth(user => {
    const uploadContainer = document.getElementById('student-uploads-container');
    const userRole = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();

    // La sección de subida solo debe aparecer para estudiantes autenticados
    if (!user || userRole === 'docente') {
        if (uploadContainer) uploadContainer.style.display = 'none';
        return;
    }
    if (uploadContainer) uploadContainer.style.display = 'block';

    const statusDiv = document.getElementById('upload-status');
    const uploadButton = document.getElementById('upload_widget_opener');

    // Configura el widget de Cloudinary
    const myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'url', 'camera', 'google_drive'], // Fuentes permitidas
        folder: `calidad-de-software/${user.uid}`, // Crea una subcarpeta por estudiante para máxima organización
        language: 'es',
        multiple: false, // Permitir solo un archivo a la vez
    }, async (error, result) => {
        if (!error && result && result.event === "success") {
            console.log('Archivo subido con éxito:', result.info);
            showStatus('Archivo subido. Registrando entrega...', 'info');
            try {
                // Guarda la información del archivo en tu base de datos Firestore
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

    // Abre el widget cuando el usuario hace clic en el botón
    uploadButton.addEventListener('click', function() {
        myWidget.open();
    }, false);

    // Función para guardar el registro del archivo en Firestore
    async function saveUploadInfoToFirestore(user, fileInfo) {
        const db = getFirestore();
        await addDoc(collection(db, "studentUploads"), {
            student: {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
            },
            fileName: fileInfo.original_filename + '.' + fileInfo.format,
            fileUrl: fileInfo.secure_url, // URL segura y permanente del archivo
            fileSize: fileInfo.bytes,
            fileType: fileInfo.resource_type, // ej. "image", "raw"
            submittedAt: serverTimestamp(),
            status: 'enviado', // Estado inicial que el docente puede cambiar
            uploadSource: 'cloudinary',
        });
    }

    // Función para mostrar mensajes de estado al usuario
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `mt-4 text-center font-semibold ${
            type === 'success' ? 'text-green-600' :
            type === 'error'   ? 'text-red-600'   :
            type === 'warning' ? 'text-yellow-600' : 'text-gray-600'
        }`;
    }
});
