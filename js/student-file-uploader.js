// En: js/student-file-uploader.js

import { firebaseConfig } from './firebase-config.js';

// --- CONFIGURACIÓN DE GOOGLE DRIVE API ---
const GOOGLE_API_KEY = firebaseConfig.apiKey;
const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com"; // <-- REEMPLAZA ESTO
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// --- Variables de estado y promesas de inicialización ---
let tokenClient;
let gapiLoadPromise = null;
let gisLoadPromise = null;

/**
 * Carga e inicializa los clientes de las APIs de Google (GAPI y GIS).
 * Devuelve una promesa que se resuelve cuando ambas APIs están listas para usarse.
 * @returns {Promise<[void, void]>}
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
                reject(new Error("Fallo al inicializar el cliente de token de Google. ¿El Client ID es correcto?"));
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
                    console.error("Error al inicializar el cliente GAPI:", error);
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
 * Sanea un nombre de carpeta para evitar caracteres inválidos.
 * Google Drive es bastante permisivo, pero '/' y '\' son problemáticos.
 * @param {string} name - El nombre original.
 * @returns {string} - El nombre saneado.
 */
function sanitizeFolderName(name) {
    if (typeof name !== 'string') return "Nombre Inválido";
    return name.replace(/[\\/]/g, '_'); // Reemplaza \ y / con guiones bajos.
}


/**
 * Busca o crea una carpeta en Google Drive y devuelve su ID.
 * @param {string} name - El nombre de la carpeta.
 * @param {string} parentId - El ID de la carpeta padre.
 * @returns {Promise<string>} El ID de la carpeta encontrada o creada.
 */
async function getOrCreateFolder(name, parentId) {
    // Validación crucial
    if (!name || typeof name !== 'string' || name.trim() === "") {
        throw new Error(`El nombre de la carpeta no puede estar vacío.`);
    }
     if (!parentId) {
        throw new Error(`Se requiere un ID de carpeta padre para crear la carpeta "${name}".`);
    }

    const saneName = sanitizeFolderName(name);
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
 * Sube un archivo a una estructura de carpetas específica en Google Drive.
 * @param {File} file - El objeto File del input.
 * @param {object} details - Contiene { unit, activity, studentName }.
 * @returns {Promise<{id: string, webViewLink: string}>} El ID y enlace de vista del archivo.
 */
export async function uploadFile(file, details = {}) {
    console.log("🚀 Iniciando proceso de subida...");
    
    // --- PASO 1: VALIDACIÓN INICIAL ---
    if (!file || !(file instanceof File)) {
        throw new Error("El objeto de archivo proporcionado no es válido.");
    }
    if (!details.studentName || !details.unit || !details.activity) {
         throw new Error("Faltan detalles esenciales (unit, activity, studentName).");
    }

    console.log("Archivo a subir:", file);
    console.log("Detalles recibidos:", details);

    // --- PASO 2: INICIALIZACIÓN Y AUTENTICACIÓN ---
    try {
        await initDriveUploader();
    } catch (error) {
        console.error("Fallo CRÍTICO en la inicialización:", error);
        throw new Error("No se pudo inicializar la API de Google Drive. Revisa la consola.");
    }

    const tokenResponse = await new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => (resp.error ? reject(resp) : resolve(resp));
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
    console.log("✅ Token de acceso obtenido con éxito.");

    // --- PASO 3: CREACIÓN DE CARPETAS ---
    try {
        console.log("📂 Creando/verificando estructura de carpetas...");
        const rootFolderId = await getOrCreateFolder("Calidad de Software (Entregas)", 'root');
        const unitFolderId = await getOrCreateFolder(details.unit, rootFolderId);
        const activityFolderId = await getOrCreateFolder(details.activity, unitFolderId);
        const studentFolderId = await getOrCreateFolder(details.studentName, activityFolderId);
        console.log(`ID de carpeta final para el alumno: ${studentFolderId}`);

        // --- PASO 4: CONSTRUCCIÓN Y SUBIDA DE LA SOLICITUD ---
        const metadata = {
            name: file.name,
            parents: [studentFolderId],
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file);

        console.log("📦 Metadata a enviar:", JSON.stringify(metadata, null, 2));
        console.log("📡 Enviando solicitud a la API de Google Drive...");

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` },
            body: formData,
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("❌ ERROR DE LA API DE DRIVE:", errorBody);
            throw new Error(errorBody.error.message || 'Fallo la subida del archivo. El servidor devolvió un error.');
        }

        console.log("✅ ¡Archivo subido con éxito!");
        return await response.json();

    } catch (error) {
        console.error("Ha ocurrido un error durante la creación de carpetas o la subida:", error);
        throw new Error(`Error en el proceso de entrega: ${error.message}`);
    }
}
