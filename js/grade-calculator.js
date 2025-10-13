// js/grade-calculator.js

/**
 * @file Contiene la lógica centralizada y los pesos para el cálculo de calificaciones.
 * Este archivo es la única fuente de verdad para evitar discrepancias en la aplicación.
 */

/**
 * Pesos para las unidades que componen la calificación final.
 * Estos pesos deben sumar 1.0 si se usan como porcentajes directos.
 */
export const FINAL_GRADE_WEIGHTS = {
  unit1: 0.2,
  unit2: 0.2,
  unit3: 0.2,
  projectFinal: 0.4,
};

/**
 * Pesos para los tipos de actividades dentro de cada unidad.
 * La suma de estos pesos debe ser 1.0 para que el cálculo sea una media ponderada.
 */
export const UNIT_ACTIVITY_WEIGHTS = {
  participation: 0.1,
  assignments: 0.25,
  classwork: 0.25,
  exam: 0.4,
};

/**
 * Calcula la calificación ponderada de una unidad.
 * @param {object|undefined} unit - Objeto con las calificaciones de las actividades de la unidad.
 *   Ej: { participation: 8, assignments: 9, classwork: 10, exam: 7 }
 * @returns {number} La calificación de la unidad (0-10).
 */
export function calculateUnitGrade(unit) {
  if (!unit || typeof unit !== "object") {
    return 0;
  }

  let total = 0;
  for (const activityType in UNIT_ACTIVITY_WEIGHTS) {
    const gradeValue = unit[activityType];
    if (gradeValue === undefined) continue;

    let categoryScore = 0;
    if (typeof gradeValue === "number") {
      categoryScore = gradeValue;
    } else if (typeof gradeValue === "object" && gradeValue !== null) {
      // Si hay sub-calificaciones (ej. múltiples tareas), se promedian.
      const scores = Object.values(gradeValue).filter(
        (v) => typeof v === "number"
      );
      if (scores.length > 0) {
        categoryScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    if (categoryScore > 0) {
      total += categoryScore * UNIT_ACTIVITY_WEIGHTS[activityType];
    }
  }
  return total;
}

/**
 * Calcula la calificación final del curso.
 * @param {object|undefined} grades - Objeto con las calificaciones de todas las unidades y el proyecto final.
 *   Ej: { unit1: {...}, unit2: {...}, unit3: {...}, projectFinal: 9 }
 * @returns {number} La calificación final redondeada (0-100).
 */
export function calculateFinalGrade(grades) {
  if (!grades) {
    return 0;
  }

  const u1 = calculateUnitGrade(grades.unit1);
  const u2 = calculateUnitGrade(grades.unit2);
  const u3 = calculateUnitGrade(grades.unit3);
  const pf = grades.projectFinal || 0;

  const finalGrade =
    u1 * FINAL_GRADE_WEIGHTS.unit1 * 10 +
    u2 * FINAL_GRADE_WEIGHTS.unit2 * 10 +
    u3 * FINAL_GRADE_WEIGHTS.unit3 * 10 +
    pf * FINAL_GRADE_WEIGHTS.projectFinal;

  return Math.round(finalGrade);
}
