// En: js/student-uploads.js

import { onFirebaseReady, getDb } from "./firebase.js";
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

let db;

// Inicializar la instancia de la base de datos tan pronto como Firebase esté listo.
onFirebaseReady(() => {
    db = getDb();
});

/**
 * Crea un nuevo registro de entrega de estudiante en Firestore.
 * @param {object} payload El objeto con los datos de la entrega.
 * @returns {Promise<DocumentReference>} La referencia al documento recién creado.
 */
export async function createStudentUpload(payload) {
    if (!db) throw new Error("Firestore no está inicializado.");

    const finalPayload = {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "entregado", // Estado inicial
    };

    try {
        const docRef = await addDoc(collection(db, "student_uploads"), finalPayload);
        console.log("Entrega registrada con ID: ", docRef.id);
        return docRef;
    } catch (error) {
        console.error("Error al registrar la entrega en Firestore: ", error);
        throw error;
    }
}

/**
 * Observa las entregas de un estudiante en tiempo real.
 * @param {string} studentUid El UID del estudiante.
 * @param {function} onDataChange Callback que se ejecuta con los nuevos datos.
 * @param {function} onError Callback que se ejecuta si hay un error.
 * @returns {function} Una función para cancelar la suscripción (unsubscribe).
 */
export function observeStudentUploads(studentUid, onDataChange, onError) {
    if (!db) {
        const error = new Error("Firestore no está inicializado para observar entregas.");
        onError(error);
        return () => {}; // Devuelve una función vacía si no hay DB
    }

    const q = query(
        collection(db, "student_uploads"),
        where("student.uid", "==", studentUid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        onDataChange(items);
    }, (error) => {
        console.error("Error en la suscripción a las entregas: ", error);
        if (onError) {
            onError(error);
        }
    });

    return unsubscribe;
}
