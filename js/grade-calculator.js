
// js/grade-calculator.js

import { courseActivities } from './course-activities.js';

/**
 * Defines the weighting structure for the course.
 */
export const gradeSchema = {
    unit1: {
        weight: 0.30,
        categories: {
            participacion: { weight: 0.10, label: 'Participación' },
            examen: { weight: 0.40, label: 'Examen' },
            asignaciones: { weight: 0.25, label: 'Asignaciones' },
            actividades: { weight: 0.25, label: 'Actividades' }
        }
    },
    unit2: {
        weight: 0.30,
        categories: {
            participacion: { weight: 0.10, label: 'Participación' },
            examen: { weight: 0.40, label: 'Examen' },
            asignaciones: { weight: 0.25, label: 'Asignaciones' },
            actividades: { weight: 0.25, label: 'Actividades' }
        }
    },
    unit3: {
        weight: 0.40,
        categories: {
            proyecto: { weight: 1.0, label: 'Proyecto Final' }
        }
    }
};

// A map to quickly find activity details by ID
const activityMap = new Map();
courseActivities.forEach(unit => {
    unit.activities.forEach(activity => {
        activityMap.set(activity.id, {
            ...activity,
            unitId: unit.unitId,
            unitLabel: unit.unitLabel
        });
    });
});

/**
 * Calculates the final grade based on a student's submissions.
 * @param {Array<Object>} submissions - An array of submission objects from Firestore.
 * @returns {Object} An object containing the detailed grade breakdown.
 */
export function calculateGrades(submissions) {
    const results = {
        finalGrade: 0,
        units: {}
    };

    // Initialize results structure based on schema
    for (const unitId in gradeSchema) {
        results.units[unitId] = {
            unitScore: 0,
            weightedUnitScore: 0,
            categories: {}
        };
        for (const categoryId in gradeSchema[unitId].categories) {
            results.units[unitId].categories[categoryId] = {
                label: gradeSchema[unitId].categories[categoryId].label,
                score: 0,
                weightedScore: 0,
                submissionCount: 0,
                totalActivities: 0
            };
        }
    }

    // Categorize submissions and sum up grades
    const categorizedGrades = {};

    submissions.forEach(sub => {
        const activity = activityMap.get(sub.activityId);
        if (activity && activity.unitId && activity.category && sub.grade != null) {
            const { unitId, category } = activity;
            if (!categorizedGrades[unitId]) {
                categorizedGrades[unitId] = {};
            }
            if (!categorizedGrades[unitId][category]) {
                categorizedGrades[unitId][category] = { total: 0, count: 0 };
            }
            categorizedGrades[unitId][category].total += sub.grade;
            categorizedGrades[unitId][category].count++;
        }
    });

    // Count total activities per category
    activityMap.forEach(activity => {
        if (activity.unitId && activity.category) {
            const { unitId, category } = activity;
            if (results.units[unitId] && results.units[unitId].categories[category]) {
                results.units[unitId].categories[category].totalActivities++;
            }
        }
    });
    
    // Calculate weighted scores
    for (const unitId in gradeSchema) {
        let unitScoreTotal = 0;
        for (const categoryId in gradeSchema[unitId].categories) {
            const categoryData = categorizedGrades[unitId]?.[categoryId];
            const categorySchema = gradeSchema[unitId].categories[categoryId];
            let categoryAverage = 0;
            let submissionCount = 0;

            if (categoryData && categoryData.count > 0) {
                categoryAverage = categoryData.total / categoryData.count;
                submissionCount = categoryData.count;
            }
            
            const weightedCategoryScore = categoryAverage * categorySchema.weight;
            unitScoreTotal += weightedCategoryScore;

            results.units[unitId].categories[categoryId].score = categoryAverage;
            results.units[unitId].categories[categoryId].weightedScore = weightedCategoryScore;
            results.units[unitId].categories[categoryId].submissionCount = submissionCount;
        }

        results.units[unitId].unitScore = unitScoreTotal;
        results.units[unitId].weightedUnitScore = unitScoreTotal * gradeSchema[unitId].weight;
        results.finalGrade += results.units[unitId].weightedUnitScore;
    }

    return results;
}
