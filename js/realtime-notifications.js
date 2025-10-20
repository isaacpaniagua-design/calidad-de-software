// En: js/realtime-notifications.js

import { getDb, onFirebaseReady } from "./firebase.js";
import { collection, query, where, onSnapshot, serverTimestamp, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { allowedEmailDomain } from "./firebase-config.js"; // <-- CORRECCIÓN: Importar desde la ubicación central.

const NOTIFICATION_THROTTLE_SECONDS = 30;

let db;
let currentUser = null;
let lastNotificationTime = 0;

document.addEventListener("DOMContentLoaded", () => {
    onFirebaseReady(() => {
        db = getDb();
        const auth = getAuth();
        if (auth.currentUser) {
            currentUser = auth.currentUser;
            if (currentUser.email.endsWith(`@${allowedEmailDomain}`)) {
                startNotificationListener(currentUser.uid);
            }
        }
    });
});

function startNotificationListener(userId) {
    const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", false)
    );

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const notification = change.doc.data();
                if (!notification.isToast) { // No mostrar notificaciones que no son toast
                    showToastNotification(notification.message);
                    markNotificationAsRead(change.doc.id);
                } 
            }
        });
    });
}

function showToastNotification(message) {
    const now = Date.now() / 1000;
    if (now - lastNotificationTime < NOTIFICATION_THROTTLE_SECONDS) {
        console.log("Notificación omitida para evitar spam.");
        return;
    }
    lastNotificationTime = now;

    const toastContainer = document.querySelector(".toast-container") || createToastContainer();
    
    const toast = document.createElement("div");
    toast.className = "toast-notification is-info is-light";
    toast.innerHTML = `<button class="delete"></button> ${message}`;

    toastContainer.appendChild(toast);

    const deleteBtn = toast.querySelector(".delete");
    deleteBtn.addEventListener("click", () => {
        toast.remove();
    });

    setTimeout(() => {
        if (toast) toast.remove();
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
}

async function markNotificationAsRead(docId) {
    try {
        await updateDoc(doc(db, "notifications", docId), { read: true });
    } catch (error) {
        console.error("Error al marcar la notificación como leída:", error);
    }
}
