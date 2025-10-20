// En: js/course-activities.js

export const courseActivities = [
    {
        unitId: "unit1",
        unitLabel: "Unidad 1 · Fundamentos de Calidad de Software",
        activities: [
            { id: "unit1-foro-ejemplo-metricas", title: "Foro: Ejemplo de Métricas", category: "participacion" },
            { id: "unit1-taller-complejidad-ciclomatica", title: "Taller de Complejidad Ciclomática", category: "actividades" },
            { id: "unit1-plan-pruebas-ieee-829", title: "Plan de Pruebas (IEEE 829)", category: "asignaciones" },
            { id: "unit1-simulacion-revision-tecnica", title: "Simulación de Revisión Técnica", category: "actividades" },
            { id: "unit1-diseno-casos-prueba", title: "Diseño de Casos de Prueba", category: "asignaciones" },
            { id: "unit1-foro-seguridad", title: "Foro de Seguridad", category: "participacion" },
            { id: "unit1-presentacion-metricas", title: "Presentación de métricas (producto, proceso, proyecto)", category: "actividades" },
            { id: "unit1-participacion-clase", title: "Participación en Clase", category: "participacion" },
            { id: "unit1-examen", title: "Examen Unidad I", category: "examen" },
        ]
    },
    {
        unitId: "unit2",
        unitLabel: "Unidad 2 · Modelos y Estándares de Calidad",
        activities: [
            { id: "unit2-role-playing-auditoria", title: "Role-Playing de Auditoría", category: "actividades" },
            { id: "unit2-informe-comparativo-modelos", title: "Informe Comparativo de Modelos", category: "asignaciones" },
            { id: "unit2-mapa-conceptual-colaborativo", title: "Mapa Conceptual Colaborativo", category: "actividades" },
            { id: "unit2-participacion-clase", title: "Participación en Clase", category: "participacion" },
            { id: "unit2-examen", title: "Examen Unidad II", category: "examen" },
        ]
    },
    {
        unitId: "unit3",
        unitLabel: "Unidad 3 · Plan de Certificación de Calidad",
        activities: [
            { id: "unit3-proyecto-fase1-diagnostico", title: "Proyecto Final – Fase 1 (Diagnóstico)", category: "proyecto" },
            { id: "unit3-proyecto-fase2-gap-analysis", title: "Proyecto Final – Fase 2 (Gap Analysis)", category: "proyecto" },
            { id: "unit3-proyecto-fases-3-4-roadmap", title: "Proyecto Final – Fases 3 y 4 (Roadmap y Gestión de Cambio)", category: "proyecto" },
            { id: "unit3-presentacion-proyecto-final", title: "Presentación del Proyecto Final", category: "proyecto" },
            { id: "unit3-examen-final-integrador", title: "Examen Final Integrador", category: "examen" }, // Note: This was not in the original spec, but is categorized as an exam.
        ]
    },
];

/**
 * Busca una actividad por su ID a través de todas las unidades.
 * @param {string} activityId - El ID de la actividad a buscar.
 * @returns {Object|null} El objeto de la actividad o null si no se encuentra.
 */
export function getActivityById(activityId) {
    if (!activityId) return null;
    for (const unit of courseActivities) {
        const activity = unit.activities.find(act => act.id === activityId);
        if (activity) {
            return { ...activity, unitId: unit.unitId, unitLabel: unit.unitLabel };
        }
    }
    return null;
}

/**
 * Busca una actividad por su título, opcionalmente dentro de una unidad específica.
 * @param {string} title - El título de la actividad a buscar.
 * @param {string} [unitId] - El ID opcional de la unidad para limitar la búsqueda.
 * @returns {Object|null} El objeto de la actividad o null si no se encuentra.
 */
export function findActivityByTitle(title, unitId) {
    if (!title) return null;
    const normalizedTitle = title.trim().toLowerCase();

    const searchInUnit = (unit) => {
        const activity = unit.activities.find(act => act.title.trim().toLowerCase() === normalizedTitle);
        if (activity) {
            return { ...activity, unitId: unit.unitId, unitLabel: unit.unitLabel };
        }
        return null;
    };

    if (unitId) {
        const unit = courseActivities.find(u => u.unitId === unitId);
        if (unit) {
            return searchInUnit(unit);
        }
    }

    for (const unit of courseActivities) {
        const activity = searchInUnit(unit);
        if (activity) {
            return activity;
        }
    }

    return null;
}
