// =================================================================================================
// ARCHIVO: js/grade-calculator.js
// VERSIÓN CORREGIDA Y FINAL
// =================================================================================================

/**
 * --- CORRECCIÓN CLAVE ---
 * Se añade la palabra clave "export" al inicio de la función.
 * Esto hace que la función sea "visible" y pueda ser importada por otros archivos,
 * como 'calificaciones-backend.js', solucionando el error de módulo.
 */
export function calculateWeightedAverage(studentData, activities) {
  // Se asegura de que 'activities' sea un array para prevenir errores si es nulo o indefinido.
  const safeActivities = Array.isArray(activities) ? activities : [];

  // Ponderaciones definidas para cada parcial y el proyecto.
  const weights = {
    p1: 0.1,  // 10%
    p2: 0.1,  // 10%
    p3: 0.1,  // 10%
    project: 0.7, // 70%
  };

  // --- Cálculo del Promedio del Parcial 1 ---
  // Filtra las 4 actividades del parcial 1, suma sus calificaciones y calcula el promedio.
  const p1_activities = safeActivities.filter((a) => a.partial === "1");
  const p1_avg = p1_activities.length > 0
    ? p1_activities.reduce((acc, a) => acc + (Number(a.grade) || 0), 0) / p1_activities.length
    : 0;

  // --- Cálculo del Promedio del Parcial 2 ---
  // Filtra las 4 actividades del parcial 2, suma sus calificaciones y calcula el promedio.
  const p2_activities = safeActivities.filter((a) => a.partial === "2");
  const p2_avg = p2_activities.length > 0
    ? p2_activities.reduce((acc, a) => acc + (Number(a.grade) || 0), 0) / p2_activities.length
    : 0;
    
  // --- Cálculo del Promedio del Parcial 3 ---
  // Filtra las 4 actividades del parcial 3, suma sus calificaciones y calcula el promedio.
  const p3_activities = safeActivities.filter((a) => a.partial === "3");
  const p3_avg = p3_activities.length > 0
    ? p3_activities.reduce((acc, a) => acc + (Number(a.grade) || 0), 0) / p3_activities.length
    : 0;

  // --- Obtención de la Calificación del Proyecto ---
  // Toma la calificación del proyecto directamente del registro principal del estudiante.
  const project_avg = studentData.project || 0;

  // --- Cálculo de la Calificación Final Ponderada ---
  const final =
    (p1_avg * weights.p1) +
    (p2_avg * weights.p2) +
    (p3_avg * weights.p3) +
    (project_avg * weights.project);

  // --- Devuelve un Objeto con Todos los Resultados ---
  // Esto permite que el otro script acceda a cada promedio individualmente.
  return {
    p1: p1_avg,
    p2: p2_avg,
    p3: p3_avg,
    project: project_avg,
    final: final,
  };
}
