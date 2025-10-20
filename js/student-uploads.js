// En: js/student-uploads.js

import { onFirebaseReady, getDb } from './firebase.js';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

let db;
onFirebaseReady(() => {
  db = getDb();
});

/**
 * Guarda un registro de la entrega de un estudiante en Firestore.
 * @param {object} payload - El objeto que contiene toda la información de la entrega.
 * @returns {Promise<DocumentReference>} La referencia al documento recién creado.
 */
export async function createStudentUpload(payload) {
  if (!db) {
    throw new Error("La base de datos de Firestore no está inicializada.");
  }

  try {
    const docRef = await addDoc(collection(db, 'studentUploads'), {
      ...payload,
      createdAt: serverTimestamp(),
      status: 'entregado' // Estado inicial
    });
    return docRef;
  } catch (error) {
    console.error("Error al crear el registro de entrega en Firestore: ", error);
    throw new Error("No se pudo registrar la entrega en la base de datos.");
  }
}

/**
 * Observa en tiempo real las entregas de un estudiante específico.
 * @param {string} uid - El UID del estudiante.
 * @param {function} onData - Callback que se ejecuta con la lista de entregas.
 * @param {function} onError - Callback que se ejecuta si hay un error.
 * @returns {function} Una función para cancelar la suscripción (unsubscribe).
 */
export function observeStudentUploads(uid, onData, onError) {
  if (!db) {
    onError(new Error("Firestore no está listo."));
    return () => {}; // Devuelve una función vacía si no hay DB
  }

  const q = query(collection(db, "studentUploads"), where("student.uid", "==", uid));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      onData([]);
      return;
    }
    const uploads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    uploads.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    onData(uploads);
  }, (error) => {
    console.error("Error al observar las entregas: ", error);
    if (onError) {
      onError(error);
    }
  });

  return unsubscribe;
}
