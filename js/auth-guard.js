// js/actividades.js
import { getDb, collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "./firebase.js";

const db = getDb();
const activitiesCollection = collection(db, 'course-activities');
let unsubscribe = null;

// CORRECCIÓN: Toda la lógica ahora está dentro de una función que podemos llamar.
export function initActividadesPage() {
    const activityForm = document.getElementById('activity-form');
    const activitiesList = document.getElementById('activities-list');
    const formTitle = document.getElementById('form-title');
    const activityIdInput = document.getElementById('activity-id');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // Función para renderizar la lista de actividades
    const renderActivities = (activities) => {
        activitiesList.innerHTML = '';
        activities.forEach(activity => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${activity.name} - ${activity.type} (Unidad ${activity.unit})</span>
                <div>
                    <button class="btn btn-secondary btn-sm edit-btn">Editar</button>
                    <button class="btn btn-danger btn-sm delete-btn">Eliminar</button>
                </div>
            `;
            li.querySelector('.edit-btn').addEventListener('click', () => editActivity(activity));
            li.querySelector('.delete-btn').addEventListener('click', () => deleteActivity(activity.id));
            activitiesList.appendChild(li);
        });
    };

    // Suscribirse a los cambios en tiempo real
    if (unsubscribe) unsubscribe(); // Limpia suscripciones anteriores
    unsubscribe = onSnapshot(activitiesCollection, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderActivities(activities);
    });

    // Manejar el envío del formulario (crear o actualizar)
    activityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = activityIdInput.value;
        const activityData = {
            name: activityForm.name.value,
            type: activityForm.type.value,
            unit: activityForm.unit.value,
            updatedAt: serverTimestamp()
        };

        if (id) {
            // Actualizar
            await updateDoc(doc(db, 'course-activities', id), activityData);
        } else {
            // Crear
            activityData.createdAt = serverTimestamp();
            await addDoc(activitiesCollection, activityData);
        }
        resetForm();
    });

    // Funciones para editar, eliminar y resetear
    const editActivity = (activity) => {
        formTitle.textContent = 'Editar Actividad';
        activityIdInput.value = activity.id;
        activityForm.name.value = activity.name;
        activityForm.type.value = activity.type;
        activityForm.unit.value = activity.unit;
        cancelEditBtn.style.display = 'inline-block';
    };

    const deleteActivity = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta actividad?')) {
            await deleteDoc(doc(db, 'course-activities', id));
        }
    };

    const resetForm = () => {
        formTitle.textContent = 'Agregar Nueva Actividad';
        activityForm.reset();
        activityIdInput.value = '';
        cancelEditBtn.style.display = 'none';
    };

    cancelEditBtn.addEventListener('click', resetForm);
}
