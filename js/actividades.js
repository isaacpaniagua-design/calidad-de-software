import { onFirebaseReady, getDb, getAuthInstance } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { collection, doc, updateDoc, onSnapshot, query, where, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

let db;
let studentsList = [];
let selectedStudentId = null;
let unsubscribeFromGrades = null;

const studentSelect = document.getElementById("student-select-display");
const activitiesListSection = document.getElementById("activities-list-section");
const studentNameDisplay = document.getElementById("student-name-display");
const activitiesContainer = document.getElementById("activities-container");
const mainContent = document.querySelector(".container.mx-auto");

// ✅ CORRECCIÓN: Se usa onAuthStateChanged para reaccionar a los cambios de sesión.
onFirebaseReady(() => {
    db = getDb();
    const auth = getAuthInstance();
    onAuthStateChanged(auth, user => {
        // initActividadesPage ya contiene la lógica para manejar usuarios autenticados y no autenticados.
        initActividadesPage(user);
    });
});

function initActividadesPage(user) {
    const isTeacher = user && (localStorage.getItem("qs_role") || "").toLowerCase() === "docente";

    if (isTeacher) {
        if (mainContent) mainContent.style.display = "block";
        loadStudentsFromFirestore();
        setupDisplayEventListeners();
    } else {
        if (mainContent) {
            mainContent.style.display = "block"; // Asegurarse de que el contenedor sea visible
            mainContent.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-md text-center"><h1 class="text-2xl font-bold text-red-600">Acceso Denegado</h1><p class="text-gray-600 mt-2">Esta página es solo para docentes.</p></div>';
        }
    }
}

async function loadStudentsFromFirestore() {
    if (!studentSelect) return;
    studentSelect.disabled = true;
    studentSelect.innerHTML = "<option>Cargando estudiantes...</option>";

    try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        studentsList = studentsList.filter(student => student.displayName && student.displayName.trim() !== '');
        studentsList.sort((a, b) => a.displayName.localeCompare(b.displayName));

        studentSelect.innerHTML = '<option value="">-- Seleccione para ver --</option>';
        studentsList.forEach((student) => {
            const option = document.createElement("option");
            option.value = student.id;
            option.textContent = student.displayName;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = false;
    } catch (error) {
        console.error("Error definitivo cargando estudiantes desde Firestore:", error);
        studentSelect.innerHTML = `<option value="">Error al cargar</option>`;
        // Aquí podría ir un reintento o un mensaje más amigable
    }
}

function renderStudentGrades(grades) {
    activitiesContainer.innerHTML = "";
    if (grades.length === 0) {
        activitiesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Este estudiante no tiene calificaciones asignadas.</p>';
        return;
    }
    grades.sort((a, b) => (a.assignedAt?.toDate() || 0) - (b.assignedAt?.toDate() || 0));
    grades.forEach((grade) => {
        const card = document.createElement("div");
        card.className = "activity-card bg-gray-50 p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-3 gap-4 items-center";
        card.innerHTML = `
            <div class="col-span-1 md:col-span-2">
                <p class="font-bold">${grade.activityName}</p>
                <p class="text-sm text-gray-500">ID: ${grade.activityId}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 items-center">
                 <input type="number" step="1" min="0" max="100" value="${grade.grade || 0}"
                       data-grade-id="${grade.id}"
                       class="grade-input-display mt-1 w-full p-2 border rounded-md shadow-sm">
                <button data-action="delete-grade" data-grade-id="${grade.id}" class="bg-red-100 text-red-700 text-xs py-2 px-2 rounded-md hover:bg-red-200">Eliminar</button>
            </div>
        `;
        activitiesContainer.appendChild(card);
    });
}

function loadGradesForStudent(studentId) {
    if (unsubscribeFromGrades) unsubscribeFromGrades();
    const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentId));

    unsubscribeFromGrades = onSnapshot(gradesQuery, (snapshot) => {
        const grades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStudentGrades(grades);
    }, (error) => {
        console.error("Error al cargar calificaciones:", error);
        activitiesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar calificaciones.</p>';
    });
}

function setupDisplayEventListeners() {
    if (!studentSelect) return;

    studentSelect.addEventListener("change", () => {
        selectedStudentId = studentSelect.value;
        if (selectedStudentId) {
            const student = studentsList.find((s) => s.id === selectedStudentId);
            studentNameDisplay.textContent = student ? student.displayName : "N/A";
            activitiesListSection.style.display = "block";
            loadGradesForStudent(selectedStudentId);
        } else {
            activitiesListSection.style.display = "none";
            if (unsubscribeFromGrades) unsubscribeFromGrades();
        }
    });

    activitiesContainer.addEventListener("change", async (e) => {
        if (e.target.classList.contains("grade-input-display")) {
            const input = e.target;
            input.disabled = true;
            try {
                // Asegurarse de que el ID del estudiante esté disponible para la actualización
                if (!selectedStudentId) return;
                await updateDoc(doc(db, "grades", input.dataset.gradeId), { 
                    grade: Number(input.value),
                    lastUpdated: serverTimestamp()
                });
            } catch (error) {
                console.error("Error actualizando calificación:", error);
            } finally {
                input.disabled = false;
            }
        }
    });

    activitiesContainer.addEventListener("click", async (e) => {
        const targetButton = e.target.closest('button[data-action="delete-grade"]');
        if (targetButton) {
            if (confirm("¿Está seguro de que desea eliminar esta calificación?")) {
                try {
                    await deleteDoc(doc(db, "grades", targetButton.dataset.gradeId));
                } catch (error) {
                    console.error("Error eliminando calificación:", error);
                }
            }
        }
    });
}
