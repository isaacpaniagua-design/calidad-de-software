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
  unit1: 0.3,
  unit2: 0.3,
  unit3: 0.4,
};

/**
 * Pesos para los tipos de actividades dentro de las unidades 1 y 2.
 * La suma de estos pesos debe ser 1.0 para que el cálculo sea una media ponderada.
 * `actividades`: Corresponde a trabajos en clase.
 * `asignaciones`: Corresponde a tareas o entregables.
 * `examen`: Examen de la unidad.
 * `participaciones`: Participación en foros u otras actividades.
 */
export const UNIT_ACTIVITY_WEIGHTS_U1_U2 = {
  actividades: 0.25,
  asignaciones: 0.25,
  examen: 0.4,
  participaciones: 0.1,
};

/**
 * @deprecated Utilizar UNIT_ACTIVITY_WEIGHTS_U1_U2. Se mantiene por retrocompatibilidad.
 */
export const UNIT_ACTIVITY_WEIGHTS = UNIT_ACTIVITY_WEIGHTS_U1_U2;

/**
 * Calcula la calificación ponderada de una unidad.
 * @param {object|undefined} unit - Objeto con las calificaciones de las actividades de la unidad.
 *   Ej: { actividades: 8, asignaciones: 9, examen: 7, participaciones: 10 }
 * @param {number} unitNumber - El número de la unidad (1, 2, 3) para seleccionar los pesos correctos.
 * @returns {number} La calificación de la unidad (0-10).
 */
export function calculateUnitGrade(unit, unitNumber = 1) {
  if (!unit || typeof unit !== "object") {
    return 0;
  }

  // La unidad 3 es solo el proyecto final, su calificación se toma directamente.
  if (unitNumber === 3) {
    return typeof unit.proyecto === "number" ? unit.proyecto : 0;
  }

  const weights = UNIT_ACTIVITY_WEIGHTS_U1_U2;
  let total = 0;
  let totalWeight = 0;

  for (const activityType in weights) {
    const gradeValue = unit[activityType];
    if (typeof gradeValue === "number") {
      total += gradeValue * weights[activityType];
      totalWeight += weights[activityType];
    }
  }

  if (totalWeight === 0) {
    return 0;
  }

  return total / totalWeight;
}

/**
 * Calcula la calificación final del curso.
 * @param {object|undefined} grades - Objeto con las calificaciones de todas las unidades.
 *   Ej: { unit1: {...}, unit2: {...}, unit3: { project: 9 } }
 * @returns {number} La calificación final redondeada (0-100).
 */
export function calculateFinalGrade(grades) {
  if (!grades) {
    return 0;
  }

  const u1 = calculateUnitGrade(grades.unit1, 1);
  const u2 = calculateUnitGrade(grades.unit2, 2);

  // La calificación del proyecto final se toma directamente del campo `projectFinal`.
  const projectScore =
    typeof grades.projectFinal === "number" ? grades.projectFinal : 0;

  const finalGrade =
    u1 * FINAL_GRADE_WEIGHTS.unit1 +
    u2 * FINAL_GRADE_WEIGHTS.unit2 +
    projectScore * FINAL_GRADE_WEIGHTS.unit3;

  // La calificación final debe estar en una escala de 0 a 10 y se redondea a 2 decimales.
  return parseFloat(finalGrade.toFixed(2));
}
