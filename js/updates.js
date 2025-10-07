// js/updates.js

// --- CONFIGURACIÓN DE ACTUALIZACIONES ---
// Las fechas se introducen en formato YYYY-MM-DD.
// El script las formatea automáticamente para el usuario.
const changelogData = [
    {
        version: "v1.2.0",
        date: "2025-10-05", 
        changes: [
            { type: 'new', text: '¡Nuevo! Sección de "Actualizaciones del Sistema" para mantenerte informado sobre las últimas mejoras.' },
            { type: 'new', text: 'Indicador de notificación para nuevas actualizaciones en el menú de navegación.' },
            { type: 'improvement', text: 'El logo de la plataforma ahora es un enlace directo a la página de inicio.' },
        ]
    },
    {
        version: "v1.1.0",
        date: "2025-10-02",
        changes: [
            { type: 'new', text: 'Implementado el guardado local automático para el "Plan de Pruebas". Tu progreso se guarda mientras escribes.' },
            { type: 'improvement', text: 'El botón de guardado ahora confirma la acción visualmente.' },
            { type: 'fix', text: 'El botón "Limpiar" ahora también borra los datos guardados en el navegador.' },
        ]
    },
    {
        version: "v1.0.0",
        date: "2025-09-28",
        changes: [
            { type: 'new', text: 'Exportación de "Plan de Pruebas" a formato PDF con diseño profesional y paginación.' },
            { type: 'improvement', text: 'Se ha cambiado el tamaño de la hoja a A3 para una mejor visualización digital y menos cortes de contenido.' },
            { type: 'fix', text: 'Solucionado el error que generaba un PDF en blanco en algunos navegadores.' },
        ]
    }
];

// --- LÓGICA DEL MÓDULO ---

const latestVersion = changelogData[0].version;
const lastSeenVersionKey = 'lastSeenUpdateVersion';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('changelog-container');
    if (!container) return;

    setTimeout(() => {
        renderChangelog(container);
        localStorage.setItem(lastSeenVersionKey, latestVersion);
    }, 500);
});

/**
 * Formatea una fecha de 'YYYY-MM-DD' a un formato legible.
 * @param {string} dateString - La fecha en formato 'YYYY-MM-DD'.
 * @returns {string} - La fecha formateada, ej: "5 de octubre de 2025".
 */
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('es-ES', options);
}

function renderChangelog(container) {
    container.innerHTML = ''; // Limpiar el spinner

    changelogData.forEach(release => {
        const card = document.createElement('div');
        card.className = 'update-card';

        const changesHtml = release.changes.map(change => `
            <li>
                <i class="bi ${getIconForType(change.type)} icon icon-${change.type}"></i>
                <span>${change.text}</span>
            </li>
        `).join('');
        
        const formattedDate = formatDate(release.date);

        card.innerHTML = `
            <div class="update-card-header">
                <h2>Versión ${release.version}</h2>
                <span class="release-date">${formattedDate}</span>
            </div>
            <div class="update-card-body">
                <ul class="update-list">${changesHtml}</ul>
            </div>
        `;
        container.appendChild(card);
    });
}

function getIconForType(type) {
    switch (type) {
        case 'new': return 'bi-stars';
        case 'improvement': return 'bi-arrow-up-circle-fill';
        case 'fix': return 'bi-tools';
        default: return 'bi-info-circle-fill';
    }
}

// Exportamos las variables que necesita el layout para la notificación
export { latestVersion, lastSeenVersionKey };
