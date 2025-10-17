// En: js/student-file-uploader.js

// Importamos la configuración de Firebase para reutilizar la apiKey
import { firebaseConfig } from './firebase-config.js';

// --- CONFIGURACIÓN DE GOOGLE DRIVE API ---

// 1. La API Key se reutiliza desde tu configuración de Firebase.
const GOOGLE_API_KEY = firebaseConfig.apiKey;

// 2. ¡IMPORTANTE! Debes generar este ID de Cliente de OAuth 2.0 en tu Google Cloud Console.
//    Ve a APIs y Servicios > Credenciales > Crear Credenciales > ID de cliente de OAuth.
//    Asegúrate de que sea de tipo "Aplicación web" y añade tu dominio a los "Orígenes de JavaScript autorizados".
const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com"; // <-- REEMPLAZA ESTO

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// --- Variables de estado del módulo ---
let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Carga e inicializa los clientes de las APIs de Google (GAPI y GIS).
 * Evita la recarga de scripts si ya han sido inyectados en el DOM.
 */
export function initDriveUploader() {
    if (gapiInited && gisInited) return;

    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: '', 
            });
            gisInited = true;
        };
        document.body.appendChild(script);
    }

    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => {
            gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
            });
        };
        document.body.appendChild(gapiScript);
    }
}

/**
 * Busca o crea una carpeta en Google Drive y devuelve su ID.
 * @param {string} name - El nombre de la carpeta.
 * @param {string} parentId - El ID de la carpeta padre (por defecto es 'root').
 * @returns {Promise<string>} El ID de la carpeta encontrada o creada.
 */
async function getOrCreateFolder(name, parentId = 'root') {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'files(id)',
    });

    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
    } else {
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };
        const newFolder = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        return newFolder.result.id;
    }
}

/**
 * Sube un archivo a una estructura de carpetas específica en Google Drive.
 * @param {File} file - El objeto File del input.
 * @param {object} details - Contiene { unit, activity, studentName }.
 * @returns {Promise<{id: string, webViewLink: string}>} El ID y enlace de vista del archivo.
 */
export async function uploadFile(file, details = {}) {
    if (!gapiInited || !gisInited) {
        throw new Error("La API de Google Drive aún no está lista. Intenta de nuevo.");
    }
    if (!tokenClient) {
        throw new Error("El cliente de autenticación de Google no se ha inicializado.");
    }

    await new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => (resp.error ? reject(resp) : resolve(resp));
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });

    const rootFolderId = await getOrCreateFolder("Calidad de Software (Entregas)");
    const unitFolderId = await getOrCreateFolder(details.unit || "Unidad General", rootFolderId);
    const activityFolderId = await getOrCreateFolder(details.activity || "Actividad General", unitFolderId);
    const studentFolderId = await getOrCreateFolder(details.studentName || "Alumno", activityFolderId);
    
    const metadata = {
        name: file.name,
        parents: [studentFolderId],
    };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error.message || 'Fallo la subida del archivo a Drive.');
    }

    return await response.json();
}
