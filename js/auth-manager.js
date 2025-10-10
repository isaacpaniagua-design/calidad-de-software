// js/auth-manager.js
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-auth.js";

const auth = getAuth(app);

/**
 * Esta es una promesa que se resolverá una sola vez cuando el estado de autenticación inicial sea conocido.
 * Otros módulos pueden "esperar" a esta promesa para asegurarse de que el chequeo de auth ha terminado.
 * @type {Promise<import("firebase/auth").User|null>}
 */
export const authReady = new Promise(resolve => {
    // onAuthStateChanged se dispara inmediatamente con el estado actual y luego cada vez que cambia.
    // Usamos 'unsubscribe' para que solo se ejecute la primera vez, evitando comportamientos inesperados.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        resolve(user); // Resuelve la promesa con el usuario (o null si no está logueado)
        unsubscribe(); // Nos damos de baja para no volver a ejecutar esto.
    });
});
