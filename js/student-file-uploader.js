// En: js/student-file-uploader.js

import { firebaseConfig } from './firebase-config.js';

// --- CONFIGURACIÓN DE GOOGLE DRIVE API ---
const GOOGLE_API_KEY = firebaseConfig.apiKey;
const GOOGLE_CLIENT_ID = "220818066383-opt4vno9it90l5md8u80884p35rn4q5c.apps.googleusercontent.com";

// ⭐️ ID de la carpeta compartida del docente ya integrado.
const TEACHER_SHARED_FOLDER_ID = "1WPZ9AvDxVF8GasTuDPYeaU8unw7e3fM3";

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// --- Variables de estado y promesas de inicialización ---
let tokenClient;
let gapiLoadPromise = null;
let gisLoadPromise = null;

/**
 * Carga e inicializa los clientes de las APIs de Google.
 */
export function initDriveUploader() {
    if (gapiLoadPromise && gisLoadPromise) {
        return Promise.all([gapiLoadPromise, gisLoadPromise]);
    }

    gisLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: '',
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        script.onerror = () => reject(new Error("No se pudo cargar el script de Google Identity Services."));
        document.body.appendChild(script);
    });

    gapiLoadPromise = new Promise((resolve, reject) => {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.async = true;
        gapiScript.defer = true;
        gapiScript.onload = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: GOOGLE_API_KEY,
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        };
        gapiScript.onerror = () => reject(new Error("No se pudo cargar el script de GAPI."));
        document.body.appendChild(gapiScript);
    });

    return Promise.all([gapiLoadPromise, gisLoadPromise]);
}

/**
 * Busca o crea una carpeta dentro de una carpeta padre.
 */
async function getOrCreateFolder(name, parentId) {
    const saneName = name.replace(/[\\/]/g, '_'); // Evita caracteres inválidos.
    const query = `name='${saneName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    
    const response = await gapi.client.drive.files.list({ q: query, fields: 'files(id)' });

    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
    } else {
        const fileMetadata = {
            name: saneName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };
        const newFolder = await gapi.client.drive.files.create({ resource: fileMetadata, fields: 'id' });
        return newFolder.result.id;
    }
}

/**
 * Sube un archivo a la carpeta compartida del docente.
 */
export async function uploadFile(file, details = {}) {
    await initDriveUploader();

    const tokenResponse = await new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => (resp.error ? reject(resp) : resolve(resp));
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });

    // La creación de carpetas comienza dentro de la carpeta del docente.
    const unitFolderId = await getOrCreateFolder(details.unit, TEACHER_SHARED_FOLDER_ID);
    const activityFolderId = await getOrCreateFolder(details.activity, unitFolderId);
    const studentFolderId = await getOrCreateFolder(details.studentName, activityFolderId);
    
    const metadata = {
        name: file.name,
        parents: [studentFolderId],
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` },
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("❌ ERROR DE LA API DE DRIVE:", errorBody);
        throw new Error(errorBody.error.message || 'Fallo la subida del archivo.');
    }

    return await response.json();
}
