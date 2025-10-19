// En: js/course-activities.js

export const courseActivities = [
    {
        unitId: "unit1",
        unitLabel: "Unidad 1 · Fundamentos de Calidad de Software",
        activities: [
            { id: "unit1-foro-ejemplo-metricas", title: "Foro: Ejemplo de Métricas" },
            { id: "unit1-taller-complejidad-ciclomatica", title: "Taller de Complejidad Ciclomática" },
            { id: "unit1-plan-pruebas-ieee-829", title: "Plan de Pruebas (IEEE 829)" },
            { id: "unit1-simulacion-revision-tecnica", title: "Simulación de Revisión Técnica" },
            { id: "unit1-diseno-casos-prueba", title: "Diseño de Casos de Prueba" },
            { id: "unit1-foro-seguridad", title: "Foro de Seguridad" },
            { id: "unit1-presentacion-metricas", title: "Presentación de métricas (producto, proceso, proyecto)" },
            { id: "unit1-participacion-clase", title: "Participación en Clase" },
            { id: "unit1-examen", title: "Examen Unidad I" },
        ]
    },
    {
        unitId: "unit2",
        unitLabel: "Unidad 2 · Modelos y Estándares de Calidad",
        activities: [
            { id: "unit2-role-playing-auditoria", title: "Role-Playing de Auditoría" },
            { id: "unit2-informe-comparativo-modelos", title: "Informe Comparativo de Modelos" },
            { id: "unit2-mapa-conceptual-colaborativo", title: "Mapa Conceptual Colaborativo" },
            { id: "unit2-participacion-clase", title: "Participación en Clase" },
            { id: "unit2-examen", title: "Examen Unidad II" },
        ]
    },
    {
        unitId: "unit3",
        unitLabel: "Unidad 3 · Plan de Certificación de Calidad",
        activities: [
            { id: "unit3-proyecto-fase1-diagnostico", title: "Proyecto Final – Fase 1 (Diagnóstico)" },
            { id: "unit3-proyecto-fase2-gap-analysis", title: "Proyecto Final – Fase 2 (Gap Analysis)" },
            { id: "unit3-proyecto-fases-3-4-roadmap", title: "Proyecto Final – Fases 3 y 4 (Roadmap y Gestión de Cambio)" },
            { id: "unit3-presentacion-proyecto-final", title: "Presentación del Proyecto Final" },
            { id: "unit3-examen-final-integrador", title: "Examen Final Integrador" },
        ]
    },
    {
        unitId: "project",
        unitLabel: "Rúbrica del Proyecto Final – Plan de Certificación de Calidad",
        activities: [
            { id: "project-fase1-claridad-diagnostico", title: "Claridad y completitud del diagnóstico" },
            { id: "project-fase1-justificacion-modelo", title: "Justificación de la selección del modelo" },
            { id: "project-fase1-presentacion-formato", title: "Presentación y formato" },
            { id: "project-fase2-identificacion-brechas", title: "Identificación de brechas" },
            { id: "project-fase2-acciones-priorizacion", title: "Acciones recomendadas y priorización" },
            { id: "project-fase2-claridad-visual", title: "Claridad visual del documento" },
            { id: "project-roadmap-secuencia-hitos", title: "Secuencia lógica y realista de hitos" },
            { id: "project-roadmap-factibilidad", title: "Factibilidad de recursos, tiempos y responsables" },
            { id: "project-roadmap-plan-comunicacion", title: "Plan de comunicación y capacitación" },
            { id: "project-roadmap-presentacion-formato", title: "Presentación y formato" },
            { id: "project-presentacion-claridad-estructura", title: "Claridad y estructura de la exposición" },
            { id: "project-presentacion-dominio-tema", title: "Dominio del tema y respuesta a preguntas" },
            { id: "project-presentacion-calidad-visuales", title: "Calidad de diapositivas y visuales" },
            { id: "project-presentacion-valor-negocio", title: "Justificación del valor de negocio (ROI)" },
            { id: "project-presentacion-trabajo-equipo", title: "Trabajo en equipo y participación equitativa" },
        ]
    }
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
