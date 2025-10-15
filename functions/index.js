// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Cloud Function que se activa cuando una actividad de un estudiante es
 * creada, actualizada o eliminada. Recalcula los promedios de las unidades
 * y la calificación final del estudiante.
 */
exports.recalculateGrades = functions.firestore
  .document("grades/{studentId}/activities/{activityId}")
  .onWrite(async (change, context) => {
    const studentId = context.params.studentId;
    const studentGradesRef = admin.firestore().collection("grades").doc(studentId);

    // 1. Obtener todas las actividades del estudiante
    const activitiesSnapshot = await studentGradesRef.collection("activities").get();
    const activities = activitiesSnapshot.docs.map((doc) => doc.data());

    // 2. Calcular los promedios por unidad
    const gradesByUnit = activities.reduce((acc, activity) => {
      const unit = activity.unit; // ej. "unit1"
      const score = typeof activity.score === "number" ? activity.score : 0;

      if (!acc[unit]) {
        acc[unit] = { totalScore: 0, count: 0 };
      }

      acc[unit].totalScore += score;
      acc[unit].count++;

      return acc;
    }, {});

    const unitAverages = {};
    for (const unit in gradesByUnit) {
      const { totalScore, count } = gradesByUnit[unit];
      if (count > 0) {
        // Almacena el promedio, por ejemplo, unitAverages['unit1'] = 8.5
        unitAverages[unit] = totalScore / count;
      }
    }
    
    // 3. Obtener la calificación del proyecto final (si existe)
    const studentDoc = await studentGradesRef.get();
    const studentData = studentDoc.data() || {};
    const projectFinalScore = studentData.projectFinal || 0;

    // 4. Calcular la calificación final (lógica de ejemplo)
    // Este cálculo puede ser tan simple o complejo como necesites.
    // Ejemplo: 40% promedio de unidades + 60% proyecto final.
    const unitAverageValues = Object.values(unitAverages);
    const averageOfUnits =
      unitAverageValues.length > 0
        ? unitAverageValues.reduce((sum, avg) => sum + avg, 0) / unitAverageValues.length
        : 0;

    const finalGrade = averageOfUnits * 0.4 + projectFinalScore * 0.6;

    // 5. Preparar los datos para actualizar en Firestore
    const dataToUpdate = {
      finalGrade: finalGrade,
    };
    
    // Añadir los promedios de cada unidad al objeto
    // ej. { unit1: { average: 8.5 }, unit2: { average: 9.0 } }
    for (const unit in unitAverages) {
        dataToUpdate[unit] = { average: unitAverages[unit] };
    }

    // 6. Actualizar el documento del estudiante con los nuevos promedios
    console.log(`Actualizando calificaciones para ${studentId}:`, dataToUpdate);
    return studentGradesRef.set(dataToUpdate, { merge: true });
  });
