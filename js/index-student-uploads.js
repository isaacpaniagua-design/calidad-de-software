import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js";

// ============================================================================
// ¡IMPORTANTE! REEMPLAZA ESTOS VALORES
// ============================================================================
const CLIENT_ID = '220818066383-opt4vno9it90l5md8u80884p35rn4q5c.apps.googleusercontent.com'; // <-- Pega tu ID de Cliente aquí
const API_KEY = 'AIzaSyBDip2OjSOUZrr3iiIle2Klodify9LaLe8'; // <-- Pega tu Clave de API aquí
// ============================================================================

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Inicialización de Firebase
const auth = getAuth();
const db = getFirestore();

// Variables globales para la API de Google
let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentUser = null;

// Referencias a los elementos del DOM
const activitySelect = document.getElementById('studentUploadTitle');
const uploadButton = document.getElementById('google-drive-button');
const statusDiv = document.getElementById('google-drive-status');
const uploadList = document.getElementById('studentUploadList');
const emptyMessage = document.getElementById('studentUploadEmpty');
const countBadge = document.querySelector('[data-upload-count]');
const globalStatus = document.getElementById('upload-status');

/**
 * Función principal que se ejecuta al cargar el script
 */
function main() {
    // 1. Inicializa los clientes de GAPI y GIS (Google Identity Services)
    gapi.load('client:picker', initializeGapiClient);
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Se establecerá dinámicamente
    });
    gisInited = true;

    // 2. Escucha cambios en la autenticación de Firebase
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("Usuario de Firebase autenticado:", user.uid);
            updateButtonState();
            listenToUploads(user.uid);
        } else {
            currentUser = null;
            console.log("Ningún usuario de Firebase autenticado.");
            updateButtonState();
            uploadList.innerHTML = '';
            showEmptyMessage(true);
        }
    });

    // 3. Asigna eventos a los elementos del formulario
    uploadButton.addEventListener('click', handleAuthClick);
    activitySelect.addEventListener('change', updateButtonState);

    // 4. Estado inicial del botón
    updateButtonState();
}

/**
 * Habilita o deshabilita el botón de entrega según el estado
 */
function updateButtonState() {
    const activitySelected = activitySelect.value !== '';
    if (!currentUser) {
        uploadButton.disabled = true;
        statusDiv.textContent = 'Inicia sesión para poder entregar.';
    } else if (!activitySelected) {
        uploadButton.disabled = true;
        statusDiv.textContent = 'Selecciona una actividad para poder entregar.';
    } else {
        uploadButton.disabled = false;
        statusDiv.textContent = 'Listo para adjuntar tu archivo desde Google Drive.';
    }
}

/**
 * Inicializa el cliente de la API de Google (GAPI)
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    console.log("Cliente GAPI inicializado.");
}

/**
 * Maneja el clic en el botón. Pide autorización y luego muestra el picker.
 */
function handleAuthClick() {
    if (uploadButton.disabled) return;

    tokenClient.callback = async (resp) => {
        if (resp.error) {
            console.error("Error de autorización:", resp.error);
            updateGlobalStatus('Hubo un error al autorizar tu cuenta de Google.', 'is-error');
            throw (resp);
        }
        console.log("Token de acceso obtenido.");
        createPicker();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Crea y muestra el Google Picker
 */
function createPicker() {
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId(CLIENT_ID.split('-')[0])
        .setOAuthToken(gapi.client.getToken().access_token)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setDeveloperKey(API_KEY)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

/**
 * Callback que se ejecuta cuando el usuario selecciona un archivo en el Picker.
 */
async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];
        const fileId = doc.id;
        
        updateGlobalStatus(`Procesando archivo: ${doc.name}...`, 'is-info');

        try {
            const res = await gapi.client.drive.files.get({
                fileId: fileId,
                fields: 'webViewLink, name, iconLink'
            });

            const fileData = {
                name: res.result.name,
                url: res.result.webViewLink,
                icon: res.result.iconLink,
            };

            const activityId = activitySelect.value;
            const activityLabel = activitySelect.options[activitySelect.selectedIndex].text;

            await saveLinkToFirestore(activityId, activityLabel, fileData);

            updateGlobalStatus(`¡Entrega para "${activityLabel}" guardada con éxito!`, 'is-success');
            
        } catch (error) {
            console.error("Error al obtener el enlace o guardar en Firestore:", error);
            updateGlobalStatus('Error al procesar el archivo. Inténtalo de nuevo.', 'is-error');
        }
    }
}

/**
 * Guarda la información del archivo entregado en Firestore.
 */
async function saveLinkToFirestore(activityId, activityLabel, fileData) {
    if (!currentUser) throw new Error("Usuario no autenticado.");

    const docRef = doc(db, 'student-uploads', `${currentUser.uid}_${activityId}`);
    
    await setDoc(docRef, {
        studentUid: currentUser.uid,
        studentEmail: currentUser.email,
        activityId: activityId,
        activityLabel: activityLabel,
        submittedAt: serverTimestamp(),
        file: fileData,
        status: 'enviado',
    });

    console.log(`Entrega para ${activityId} guardada.`);
}

/**
 * Escucha en tiempo real las entregas del estudiante actual.
 */
function listenToUploads(uid) {
    const q = query(
        collection(db, 'student-uploads'),
        where('studentUid', '==', uid),
        orderBy('submittedAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            showEmptyMessage(true);
            return;
        }

        showEmptyMessage(false);
        uploadList.innerHTML = '';
        snapshot.forEach(doc => {
            const upload = doc.data();
            const listItem = createUploadListItem(upload);
            uploadList.appendChild(listItem);
        });
        countBadge.textContent = snapshot.size;
    }, (error) => {
        console.error("Error al escuchar entregas:", error);
        updateGlobalStatus('No se pudieron cargar tus entregas.', 'is-error');
    });
}

/**
 * Crea un elemento de la lista para una entrega.
 */
function createUploadListItem(upload) {
    const item = document.createElement('li');
    item.className = 'student-uploads__item';
    
    const submittedDate = upload.submittedAt?.toDate().toLocaleString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) || 'Fecha no disponible';

    item.innerHTML = `
        <div class="student-uploads__item-header">
            <div class="student-uploads__item-heading">
                <span class="student-uploads__item-title">${upload.activityLabel}</span>
            </div>
            <span class="student-uploads__item-status student-uploads__item-status--${upload.status || 'enviado'}">
                ${upload.status || 'Enviado'}
            </span>
        </div>
        <p class="student-uploads__item-meta">
            Entregado: ${submittedDate}
        </p>
        <div class="student-uploads__item-actions">
            <a href="${upload.file.url}" class="student-uploads__item-link" target="_blank" rel="noopener noreferrer">
                <img src="${upload.file.icon}" alt="" width="16" height="16"> Ver Archivo
            </a>
        </div>
    `;
    return item;
}

/**
 * Muestra u oculta el mensaje de "sin entregas".
 */
function showEmptyMessage(show) {
    emptyMessage.hidden = !show;
    uploadList.hidden = show;
    countBadge.textContent = show ? '0' : countBadge.textContent;
    if (show) {
        updateGlobalStatus('Aún no registras entregas. Usa el formulario para subir la primera.', 'is-info');
    }
}

/**
 * Actualiza el mensaje de estado global.
 */
function updateGlobalStatus(message, type = 'is-info') {
    globalStatus.textContent = message;
    globalStatus.className = `student-uploads__status ${type}`;
}

// Inicia la aplicación
main();
