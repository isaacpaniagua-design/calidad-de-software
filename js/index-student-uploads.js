import { onAuth } from './firebase.js'; 
import { getFirestore, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

// --- 🔽 ¡IMPORTANTE! CONFIGURA ESTOS VALORES 🔽 ---
const API_KEY = "AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8"; // Pega tu Clave de API aquí
const CLIENT_ID = "220818066383-opt4vno9it90l5md8u80884p35rn4q5c.apps.googleusercontent.com"; // Pega tu ID de Cliente de OAuth aquí
// ----------------------------------------------------

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
let tokenClient;
let gapiInited = false;
let gisInited = false;
let pickerInited = false;
let driveFileInfo = null;

// Funciones globales que son llamadas por los scripts de Google cuando terminan de cargar
window.gapiLoaded = () => {
  gapi.load('client:picker', initializePicker);
  gapiInited = true;
  maybeEnableButton();
};
window.gisLoaded = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // Se establecerá dinámicamente
  });
  gisInited = true;
  maybeEnableButton();
};

function initializePicker() {
  pickerInited = true;
  maybeEnableButton();
}

function maybeEnableButton() {
    // Activa el botón de Drive solo cuando todas las APIs de Google están listas
    if (gapiInited && gisInited && pickerInited) {
        const uploadButton = document.getElementById('drive_picker_opener');
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.querySelector('span').textContent = 'Seleccionar desde Google Drive';
        }
    }
}

onAuth(user => {
    const uploadSection = document.getElementById('studentUploadsSection');
    const userRole = (localStorage.getItem("qs_role") || "estudiante").toLowerCase();

    if (!user || userRole === 'docente') {
        if (uploadSection) uploadSection.style.display = 'none';
        return;
    }
    if (uploadSection) uploadSection.style.display = 'block';

    const form = document.getElementById('studentUploadForm');
    const uploadButton = document.getElementById('drive_picker_opener');
    const fileInfoChip = document.getElementById('file-upload-info');
    const resetButton = document.getElementById('studentUploadReset');

    if (!uploadButton || !form) return;

    // Estado inicial del botón mientras cargan las APIs de Google
    uploadButton.disabled = true;
    uploadButton.querySelector('span').textContent = 'Cargando Drive...';

    // 1. Maneja el clic en el botón de Drive
    uploadButton.addEventListener('click', () => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                showStatus('Error de autenticación con Google. Por favor, intenta de nuevo.', 'error');
                throw (resp);
            }
            // Si la autenticación es exitosa, crea el selector de archivos
            createPicker(resp.access_token);
        };

        // Solicita el token de acceso al usuario
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });

    // 2. Crea y muestra el selector de archivos (Picker) de Google
    function createPicker(accessToken) {
        const view = new google.picker.View(google.picker.ViewId.DOCS);
        // Filtra los tipos de archivo permitidos
        view.setMimeTypes("application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip,image/jpeg,image/png");
        
        const picker = new google.picker.PickerBuilder()
            .setOAuthToken(accessToken)
            .addView(view)
            .setDeveloperKey(API_KEY)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    }

    // 3. Se ejecuta cuando el usuario selecciona un archivo en el Picker
    function pickerCallback(data) {
        if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            driveFileInfo = {
                id: doc.id,
                name: doc.name,
                url: doc.url, // Este es el enlace para ver el archivo
                mimeType: doc.mimeType,
                sizeBytes: doc.sizeBytes,
            };
            fileInfoChip.textContent = `Archivo adjunto: ${doc.name}`;
            fileInfoChip.style.display = 'inline-block';
            showStatus('Archivo listo. Haz clic en "Enviar entrega" para finalizar.', 'info');
        }
    }

    // 4. Maneja el envío final del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleSelect = document.getElementById('studentUploadTitle');
        const descriptionText = document.getElementById('studentUploadDescription');

        if (!titleSelect.value) {
            return showStatus('Debes seleccionar la actividad que estás entregando.', 'error');
        }
        if (!driveFileInfo) {
            return showStatus('Debes adjuntar un archivo desde Google Drive antes de enviar.', 'error');
        }

        showStatus('Registrando tu entrega, por favor espera...', 'info');
        form.querySelector('button[type="submit"]').disabled = true;

        try {
            await saveUploadInfoToFirestore(user, {
                title: titleSelect.options[titleSelect.selectedIndex].text,
                titleId: titleSelect.value,
                description: descriptionText.value,
                fileInfo: driveFileInfo
            });
            showStatus('¡Entrega registrada con éxito!', 'success');
            form.reset();
            fileInfoChip.style.display = 'none';
            driveFileInfo = null;
        } catch (dbError) {
            console.error("Error al registrar en Firestore:", dbError);
            showStatus('No se pudo registrar la entrega. Inténtalo de nuevo.', 'error');
        } finally {
            form.querySelector('button[type="submit"]').disabled = false;
        }
    });

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            form.reset();
            fileInfoChip.style.display = 'none';
            driveFileInfo = null;
            showStatus('Formulario limpiado. Listo para una nueva entrega.', 'info');
        });
    }
});

async function saveUploadInfoToFirestore(user, data) {
    const db = getFirestore();
    await addDoc(collection(db, "studentUploads"), {
        student: { uid: user.uid, displayName: user.displayName, email: user.email },
        title: data.title,
        titleId: data.titleId,
        description: data.description,
        fileName: data.fileInfo.name,
        fileUrl: data.fileInfo.url, // URL del archivo en Google Drive
        fileSize: data.fileInfo.sizeBytes,
        fileType: data.fileInfo.mimeType,
        submittedAt: serverTimestamp(),
        status: 'enviado',
        uploadSource: 'google_drive',
    });
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('upload-status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `student-uploads__status ${
        type === 'success' ? 'is-success' :
        type === 'error'   ? 'is-danger'  : 'is-info'
    }`;
}
