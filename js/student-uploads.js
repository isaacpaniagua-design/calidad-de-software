import { onFirebaseReady, getDb, onAuth } from './firebase.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { courseActivities } from './course-activities.js';

// --- ELEMENTOS DEL DOM ---
const studentUploadsSection = document.getElementById('studentUploadsSection');
const studentUploadForm = document.getElementById('studentUploadForm');
const activitySelect = document.getElementById('studentUploadTitle');
const uploadcareWidget = uploadcare.Widget('[role=uploadcare-uploader]');
const descriptionInput = document.getElementById('studentUploadDescription');
const statusDiv = document.getElementById('studentUploadStatus');
const uploadList = document.getElementById('studentUploadList');
const uploadEmpty = document.getElementById('studentUploadEmpty');
const uploadCount = document.querySelector('[data-upload-count]');

let db, currentUser;

// --- INICIALIZACIÓN ---
onFirebaseReady(() => {
    db = getDb();
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
    if (!studentUploadsSection || !currentUser || localStorage.getItem('qs_role') === 'docente') {
        if(studentUploadsSection) studentUploadsSection.style.display = 'none';
        return;
    }

    studentUploadsSection.style.display = 'block';
    if (statusDiv) statusDiv.textContent = 'Listo para recibir tu entrega.';
    
    populateActivitiesDropdown();
    
    if (studentUploadForm) {
        studentUploadForm.addEventListener('submit', handleUpload);
        document.getElementById('studentUploadReset').addEventListener('click', () => {
            studentUploadForm.reset();
            uploadcareWidget.value(null); // Limpiar el widget de Uploadcare
        });
    }

    // Si estamos en la página de calificaciones, cargamos el historial
    if (uploadList) {
        loadUploadHistory();
    }
}

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
    const fileInfo = uploadcareWidget.value();

    if (!activityId || !fileInfo) {
        statusDiv.textContent = 'Por favor, selecciona una actividad y un archivo.';
        return;
    }

    statusDiv.textContent = `Registrando entrega...`;
    studentUploadForm.querySelector('button[type="submit"]').disabled = true;

    try {
        const file = await fileInfo; // El widget devuelve una promesa
        const activityDetails = courseActivities.flatMap(u => u.activities).find(a => a.id === activityId);

        await addDoc(collection(db, 'studentUploads'), {
            studentId: currentUser.uid,
            studentName: currentUser.displayName,
            studentEmail: currentUser.email,
            activityId: activityId,
            activityName: activityDetails ? activityDetails.title : 'Actividad Desconocida',
            description: descriptionInput.value || '',
            fileURL: file.cdnUrl, // URL del archivo desde Uploadcare
            fileName: file.name,
            uploadedAt: serverTimestamp(),
            status: 'entregado'
        });

        statusDiv.textContent = '¡Entrega exitosa!';
        studentUploadForm.reset();
        uploadcareWidget.value(null); // Limpiar el widget

    } catch (error) {
        console.error("Error en la entrega: ", error);
        statusDiv.textContent = 'Error al registrar la entrega. Inténtalo de nuevo.';
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
        uploads.sort((a, b) => b.uploadedAt - a.uploadedAt);

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
                <div class="item-status item-status--${upload.status ? upload.status.toLowerCase() : 'entregado'}">
                    <span>${upload.status || 'entregado'}</span>
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
