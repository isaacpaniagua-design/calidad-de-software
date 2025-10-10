// js/calificaciones-backend.js
import { app } from "./firebase.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.9.2/firebase-firestore.js";
import { authReady } from './auth-manager.js'; // Importamos al director de orquesta

const db = getFirestore(app);

// --- Toda la lógica del módulo se envuelve en la promesa authReady ---
authReady.then(user => {
    // Este bloque de código solo se ejecutará DESPUÉS de que la autenticación inicial se haya completado.
    
    if (user) {
        console.log(`calificaciones-backend.js: Usuario ${user.email} autenticado. Procediendo a cargar datos.`);
        
        // --- INICIO DE TU CÓDIGO ORIGINAL ---
        const studentId = localStorage.getItem('qs_user_uid'); // Ahora podemos leer esto con seguridad
        if (!studentId) {
            console.error("No se pudo obtener el ID del estudiante desde localStorage.");
            return;
        }

        const courseId = "software-quality-2024";
        const gradesDocRef = doc(db, "courses", courseId, "grades", studentId);
        
        const gradeInputs = document.querySelectorAll(".grade-input");
        const finalGradeEl = document.getElementById("finalGrade");
        const unit1GradeEl = document.getElementById("unit1Grade");
        const unit2GradeEl = document.getElementById("unit2Grade");
        const unit3GradeEl = document.getElementById("unit3Grade");
        const progressBar = document.getElementById("progressBar");
        const progressPercent = document.getElementById("progressPercent");

        function calculateGrades() {
            let totalWeightedGrade = 0;
            let unit1WeightedGrade = 0;
            let unit2WeightedGrade = 0;
            let unit3WeightedGrade = 0;
            
            const unit1TotalWeight = 30;
            const unit2TotalWeight = 30;
            const unit3TotalWeight = 40;

            gradeInputs.forEach((input) => {
                const grade = parseFloat(input.value) || 0;
                const weight = parseFloat(input.dataset.weight);
                const unit = input.closest(".unit-content").id;

                const weightedGrade = (grade / 10) * weight;
                totalWeightedGrade += weightedGrade;

                if (unit === "unit1") {
                    unit1WeightedGrade += weightedGrade;
                } else if (unit === "unit2") {
                    unit2WeightedGrade += weightedGrade;
                } else if (unit === "unit3") {
                    unit3WeightedGrade += weightedGrade;
                }
            });
            
            const unit1Percentage = (unit1WeightedGrade / unit1TotalWeight) * 100;
            const unit2Percentage = (unit2WeightedGrade / unit2TotalWeight) * 100;
            const unit3Percentage = (unit3WeightedGrade / unit3TotalWeight) * 100;

            finalGradeEl.textContent = totalWeightedGrade.toFixed(2);
            unit1GradeEl.textContent = unit1Percentage.toFixed(2);
            unit2GradeEl.textContent = unit2Percentage.toFixed(2);
            unit3GradeEl.textContent = unit3Percentage.toFixed(2);
            
            progressBar.style.width = `${totalWeightedGrade.toFixed(2)}%`;
            progressPercent.textContent = `${totalWeightedGrade.toFixed(2)}%`;
        }

        async function saveGrades() {
            const grades = {};
            gradeInputs.forEach((input, index) => {
                grades[`activity_${index}`] = input.value;
            });

            try {
                await setDoc(gradesDocRef, grades);
                console.log("Calificaciones guardadas en Firestore.");
            } catch (error) {
                console.error("Error al guardar calificaciones: ", error);
            }
        }

        async function loadGrades() {
            try {
                const docSnap = await getDoc(gradesDocRef);
                if (docSnap.exists()) {
                    const grades = docSnap.data();
                    gradeInputs.forEach((input, index) => {
                        if (grades[`activity_${index}`]) {
                            input.value = grades[`activity_${index}`];
                        }
                    });
                    console.log("Calificaciones cargadas desde Firestore.");
                    calculateGrades();
                } else {
                    console.log("No hay calificaciones guardadas para este estudiante.");
                }
            } catch (error) {
                console.error("Error al cargar calificaciones: ", error);
            }
        }

        gradeInputs.forEach((input) => {
            input.addEventListener("input", calculateGrades);
        });
        
        // Carga las calificaciones al iniciar
        loadGrades();

        // Escucha cambios en tiempo real desde Firestore
        onSnapshot(gradesDocRef, (doc) => {
            if (doc.exists()) {
                const grades = doc.data();
                gradeInputs.forEach((input, index) => {
                    if (grades[`activity_${index}`]) {
                        input.value = grades[`activity_${index}`];
                    }
                });
                console.log("Datos actualizados en tiempo real.");
                calculateGrades();
            }
        });
        
        // --- FIN DE TU CÓDIGO ORIGINAL ---

    } else {
        // Si el usuario no está autenticado, la lógica de calificaciones no se ejecuta.
        console.log("calificaciones-backend.js: Usuario no autenticado. No se realizarán operaciones de carga o guardado de datos.");
    }
});
