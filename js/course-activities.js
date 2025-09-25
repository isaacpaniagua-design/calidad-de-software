const baseActivities = [
  {
    unitId: "unit1",
    unitLabel: "Unidad 1 · Fundamentos de Calidad de Software",
    shortLabel: "Unidad 1",
    items: [
      { id: "unit1-foro-ejemplo-metricas", title: "Foro: Ejemplo de Métricas" },
      { id: "unit1-taller-complejidad-ciclomatica", title: "Taller de Complejidad Ciclomática" },
      { id: "unit1-plan-pruebas-ieee-829", title: "Plan de Pruebas (IEEE 829)" },
      { id: "unit1-simulacion-revision-tecnica", title: "Simulación de Revisión Técnica" },
      { id: "unit1-diseno-casos-prueba", title: "Diseño de Casos de Prueba" },
      { id: "unit1-foro-seguridad", title: "Foro de Seguridad" },
      {
        id: "unit1-presentacion-metricas",
        title: "Presentación de métricas (producto, proceso, proyecto)",
      },
      { id: "unit1-participacion-clase", title: "Participación en Clase" },
      { id: "unit1-examen", title: "Examen Unidad I" },
    ],
  },
  {
    unitId: "unit2",
    unitLabel: "Unidad 2 · Modelos y Estándares de Calidad",
    shortLabel: "Unidad 2",
    items: [
      { id: "unit2-role-playing-auditoria", title: "Role-Playing de Auditoría" },
      {
        id: "unit2-informe-comparativo-modelos",
        title: "Informe Comparativo de Modelos",
      },
      {
        id: "unit2-mapa-conceptual-colaborativo",
        title: "Mapa Conceptual Colaborativo",
      },
      { id: "unit2-participacion-clase", title: "Participación en Clase" },
      { id: "unit2-examen", title: "Examen Unidad II" },
    ],
  },
  {
    unitId: "unit3",
    unitLabel: "Unidad 3 · Plan de Certificación de Calidad",
    shortLabel: "Unidad 3",
    items: [
      {
        id: "unit3-proyecto-fase1-diagnostico",
        title: "Proyecto Final – Fase 1 (Diagnóstico)",
      },
      {
        id: "unit3-proyecto-fase2-gap-analysis",
        title: "Proyecto Final – Fase 2 (Gap Analysis)",
      },
      {
        id: "unit3-proyecto-fases-3-4-roadmap",
        title: "Proyecto Final – Fases 3 y 4 (Roadmap y Gestión de Cambio)",
      },
      {
        id: "unit3-presentacion-proyecto-final",
        title: "Presentación del Proyecto Final",
      },
      {
        id: "unit3-examen-final-integrador",
        title: "Examen Final Integrador",
      },
    ],
  },
  {
    unitId: "project",
    unitLabel: "Rúbrica del Proyecto Final – Plan de Certificación de Calidad",
    shortLabel: "Proyecto Final",
    items: [
      {
        id: "project-fase1-claridad-diagnostico",
        title: "Claridad y completitud del diagnóstico",
      },
      {
        id: "project-fase1-justificacion-modelo",
        title: "Justificación de la selección del modelo",
      },
      {
        id: "project-fase1-presentacion-formato",
        title: "Presentación y formato",
      },
      {
        id: "project-fase2-identificacion-brechas",
        title: "Identificación de brechas",
      },
      {
        id: "project-fase2-acciones-priorizacion",
        title: "Acciones recomendadas y priorización",
      },
      {
        id: "project-fase2-claridad-visual",
        title: "Claridad visual del documento",
      },
      {
        id: "project-roadmap-secuencia-hitos",
        title: "Secuencia lógica y realista de hitos",
      },
      {
        id: "project-roadmap-factibilidad",
        title: "Factibilidad de recursos, tiempos y responsables",
      },
      {
        id: "project-roadmap-plan-comunicacion",
        title: "Plan de comunicación y capacitación",
      },
      {
        id: "project-roadmap-presentacion-formato",
        title: "Presentación y formato",
      },
      {
        id: "project-presentacion-claridad-estructura",
        title: "Claridad y estructura de la exposición",
      },
      {
        id: "project-presentacion-dominio-tema",
        title: "Dominio del tema y respuesta a preguntas",
      },
      {
        id: "project-presentacion-calidad-visuales",
        title: "Calidad de diapositivas y visuales",
      },
      {
        id: "project-presentacion-valor-negocio",
        title: "Justificación del valor de negocio (ROI)",
      },
      {
        id: "project-presentacion-trabajo-equipo",
        title: "Trabajo en equipo y participación equitativa",
      },
    ],
  },
];

function normalizeActivityTitle(text) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const flatActivities = [];
const activityById = new Map();

baseActivities.forEach((unit) => {
  unit.items.forEach((item, index) => {
    const entry = {
      id: item.id,
      title: item.title,
      unitId: unit.unitId,
      unitLabel: unit.unitLabel,
      unitShortLabel: unit.shortLabel || unit.unitLabel,
      order: index,
      normalizedTitle: normalizeActivityTitle(item.title),
    };
    flatActivities.push(entry);
    activityById.set(entry.id, entry);
  });
});

export const courseActivities = baseActivities.map((unit) => ({
  unitId: unit.unitId,
  unitLabel: unit.unitLabel,
  shortLabel: unit.shortLabel,
  items: unit.items.map((item) => ({
    id: item.id,
    title: item.title,
  })),
}));

export function getActivityById(id) {
  if (!id) return null;
  return activityById.get(id) || null;
}

export function findActivityByTitle(title, unitId) {
  const normalized = normalizeActivityTitle(title);
  if (!normalized) return null;
  const matches = flatActivities.filter((item) => item.normalizedTitle === normalized);
  if (!matches.length) return null;
  if (unitId) {
    const matchByUnit = matches.find((item) => item.unitId === unitId);
    if (matchByUnit) return matchByUnit;
  }
  return matches[0];
}

export { flatActivities, normalizeActivityTitle };
