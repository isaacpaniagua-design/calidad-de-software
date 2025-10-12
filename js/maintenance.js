// js/maintenance.js

// Usamos importaciones de módulos para obtener las funciones que necesitamos
import { initFirebase, getDb } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

// Inicializamos Firebase para asegurarnos de que la conexión esté lista.
initFirebase(); 
const db = getDb();

async function verificarAccesoMantenimiento() {
    if (!db) {
        console.error("La base de datos de Firebase no está inicializada.");
        return;
    }

    // Usamos el UID del usuario actual guardado en localStorage
    const userUid = localStorage.getItem('qs_user_uid');
    
    // Si no hay UID, no es necesario continuar.
    if (!userUid) {
        return; 
    }

    try {
        const maintenanceRef = doc(db, 'maintenance', 'accessControl');
        const docSnap = await getDoc(maintenanceRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const whitelist = data.whitelist || [];
            
            // Si el UID del usuario no está en la lista blanca, lo redirigimos.
            if (!whitelist.includes(userUid)) {
                window.location.href = '/maintenance.html';
            }
        } else {
            // Si el documento de control no existe, por seguridad, redirigimos a todos.
            window.location.href = '/maintenance.html';
        }
    } catch (error) {
        console.error("Error al verificar el modo de mantenimiento:", error);
        // En caso de error, es más seguro redirigir.
        window.location.href = '/maintenance.html';
    }
}

// Nos aseguramos de que el DOM esté cargado antes de ejecutar la función.
document.addEventListener('DOMContentLoaded', verificarAccesoMantenimiento);
