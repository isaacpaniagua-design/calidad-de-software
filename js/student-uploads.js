import { onFirebaseReady, getDb, onAuth } from './firebase.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

// --- ELEMENTOS DEL DOM ---
const studentUploadsSection = document.getElementById('studentUploadsSection');
const studentUploadForm = document.getElementById('studentUploadForm');
const activitySelect = document.getElementById('studentUploadTitle');
const fileInput = document.getElementById('studentUploadFile');
const descriptionInput = document.getElementById('studentUploadDescription');
const statusDiv = document.getElementById('studentUploadStatus');
const uploadList = document.getElementById('studentUploadList');
const uploadEmpty = document.getElementById('studentUploadEmpty');
const uploadCount = document.querySelector('[data-upload-count]');

let db, storage, currentUser;

// --- INICIALIZACIÓN ---
onFirebaseReady(() => {
    db = getDb();
    storage = getStorage();
    onAuth(user => {
        currentUser = user;
        if (user) {
            initStudentUploads();
        } else {
            if (studentUploadsSection) studentUploadsSection.style.display = 'none';
            if (statusDiv) statusDiv.textContent = 'Inicia sesión para registrar entregas.';
        }
    });
});

function initStudentUploads() {
    if (studentUploadsSection) {
        studentUploadsSection.style.display = 'block';
    }
    if (statusDiv) {
        statusDiv.textContent = 'Listo para recibir tu entrega.';
    }
    
    populateActivitiesDropdown();
    
    if (studentUploadForm) {
        studentUploadForm.addEventListener('submit', handleUpload);
        document.getElementById('studentUploadReset').addEventListener('click', () => studentUploadForm.reset());
    }

    // Si estamos en la página de calificaciones, cargamos el historial
    if (uploadList) {
        loadUploadHistory();
    }
}

// --- LÓGICA PRINCIPAL ---

function populateActivitiesDropdown() {
    if (!activitySelect) return;

    activitySelect.innerHTML = '<option value="" selected disabled>Selecciona la actividad o asignación</option>';

    courseActivities.forEach(unit => {
        const group = document.createElement('optgroup');
        group.label = unit.unitLabel;
        unit.activities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = activity.title;
            group.appendChild(option);
        });
        activitySelect.appendChild(group);
    });
}

async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser) {
        statusDiv.textContent = 'Error: Debes iniciar sesión para hacer una entrega.';
        return;
    }

    const activityId = activitySelect.value;
    const file = fileInput.files[0];

    if (!activityId || !file) {
        statusDiv.textContent = 'Por favor, selecciona una actividad y un archivo.';
        return;
    }

    statusDiv.textContent = `Subiendo archivo: ${file.name}...`;
    studentUploadForm.querySelector('button[type="submit"]').disabled = true;

    try {
        const activityDetails = courseActivities.flatMap(u => u.activities).find(a => a.id === activityId);
        
        // 1. Subir archivo a Storage
        const filePath = `student_uploads/${currentUser.uid}/${activityId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // 2. Guardar registro en Firestore
        await addDoc(collection(db, 'studentUploads'), {
            studentId: currentUser.uid,
            studentName: currentUser.displayName,
            studentEmail: currentUser.email,
            activityId: activityId,
            activityName: activityDetails ? activityDetails.title : 'Actividad Desconocida',
            description: descriptionInput.value || '',
            fileURL: downloadURL,
            fileName: file.name,
            filePath: filePath,
            uploadedAt: serverTimestamp(),
            status: 'entregado' // Estado inicial
        });

        statusDiv.textContent = '¡Entrega exitosa!';
        studentUploadForm.reset();

    } catch (error) {
        console.error("Error en la entrega: ", error);
        statusDiv.textContent = 'Error al subir el archivo. Inténtalo de nuevo.';
    } finally {
        studentUploadForm.querySelector('button[type="submit"]').disabled = false;
    }
}

function loadUploadHistory() {
    if (!currentUser || !uploadList) return;

    const q = query(collection(db, "studentUploads"), where("studentId", "==", currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            if(uploadEmpty) uploadEmpty.hidden = false;
            if(uploadList) uploadList.innerHTML = '';
            if(uploadCount) uploadCount.textContent = '0';
            return;
        }

        if(uploadEmpty) uploadEmpty.hidden = true;
        
        const uploads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        uploads.sort((a, b) => b.uploadedAt - a.uploadedAt); // Más recientes primero

        if(uploadCount) uploadCount.textContent = uploads.length;
        
        uploadList.innerHTML = '';
        uploads.forEach(upload => {
            const li = document.createElement('li');
            li.className = 'student-uploads__item';
            
            const uploadedDate = upload.uploadedAt ? upload.uploadedAt.toDate().toLocaleString() : 'Fecha desconocida';

            li.innerHTML = `
                <div class="item-main">
                    <strong class="item-title">${upload.activityName}</strong>
                    <a href="${upload.fileURL}" target="_blank" class="item-filename">${upload.fileName}</a>
                    <span class="item-date">${uploadedDate}</span>
                </div>
                <div class="item-status item-status--${upload.status.toLowerCase()}">
                    <span>${upload.status}</span>
                </div>
            `;
            uploadList.appendChild(li);
        });
    }, (error) => {
        console.error("Error al cargar historial: ", error);
        if (uploadEmpty) {
            uploadEmpty.hidden = false;
            uploadEmpty.querySelector('p').textContent = "Error al cargar tu historial de entregas.";
        }
    });
}
