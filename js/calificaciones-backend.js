// js/calificaciones-backend.js

import { onAuth } from "./firebase.js";

let unsubscribeFromData = null;

async function handleAuthStateChanged(user) {
  // --- Selección dinámica de estudiante para docentes ---
  let studentSelect = document.getElementById("teacher-student-select");
  if (!studentSelect && userRole === "docente") {
    // Crear el select si no existe
    const mainContainer = document.querySelector(".container.mx-auto");
    if (mainContainer) {
      const selectDiv = document.createElement("div");
      selectDiv.className =
        "mb-6 p-4 bg-white rounded-lg shadow border border-blue-100 flex flex-col gap-2";
      selectDiv.innerHTML = `
        <label for="teacher-student-select" class="block text-base font-semibold text-blue-700 mb-1">Selecciona estudiante para ver/calificar actividades:</label>
        <select id="teacher-student-select" class="w-full p-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-400"></select>
      `;
      mainContainer.insertBefore(selectDiv, mainContainer.firstChild);
      studentSelect = selectDiv.querySelector("#teacher-student-select");
    }
  }

  if (unsubscribeFromData) unsubscribeFromData();

  const gradesContainer = document.getElementById("grades-table-container");
  const titleEl = document.getElementById("grades-title");
  const teacherGradesList = document.getElementById("teacherGradesList");
  const teacherGradesEmpty = document.getElementById("teacherGradesEmpty");

  if (!user) {
    if (gradesContainer) gradesContainer.style.display = "none";
    if (teacherGradesList) teacherGradesList.innerHTML = "";
    if (teacherGradesEmpty) teacherGradesEmpty.hidden = false;
    return;
  }

  const userRole = (localStorage.getItem("qs_role") || "").toLowerCase();
  if (gradesContainer) gradesContainer.style.display = "block";

  const response = await fetch("./data/students.json");
  const rosterData = await response.json();
  const rosterMap = new Map(rosterData.students.map((s) => [s.id, s.name]));

  // Importar Firestore dinámicamente para evitar dependencias rotas
  const { getDb } = await import("./firebase.js");
  const db = getDb();
  const { collection, getDocs, query, where, doc, updateDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"
  );

  // Mostrar desglose de actividades desde la subcolección activities
  async function loadActivitiesSubcollection(studentId) {
    const activitiesRef = collection(db, "grades", studentId, "activities");
    const snap = await getDocs(activitiesRef);
    const activities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return activities;
  }

  // Renderiza la lista editable de actividades/evidencias para el docente
  async function renderTeacherActivities(studentId) {
    if (!teacherGradesList) return;
    const activities = await loadActivitiesSubcollection(studentId);
    if (!activities.length) {
      teacherGradesList.innerHTML = "";
      if (teacherGradesEmpty) teacherGradesEmpty.hidden = false;
      return;
    }
    teacherGradesList.innerHTML = activities
      .map(
        (a) => `
        <li class="flex items-center justify-between border-b py-2">
          <div>
            <span class="font-semibold">${a.activityName || a.id}</span>
            <span class="ml-2 text-xs text-gray-500">(${
              a.type || "N/A"
            }, Unidad: ${(a.unit || "").replace("unit", "")})</span>
            ${
              a.evidenceUrl
                ? `<a href="${a.evidenceUrl}" target="_blank" class="ml-2 text-blue-600 underline">Ver evidencia</a>`
                : ""
            }
          </div>
          <div class="flex items-center gap-2">
            <input type="number" min="0" max="100" step="1" value="${
              a.grade ?? ""
            }" data-activity-id="${
          a.id
        }" class="activity-grade-input w-16 p-1 border rounded text-right">
            <button data-activity-id="${
              a.id
            }" class="save-grade-btn bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Guardar</button>
          </div>
        </li>
      `
      )
      .join("");
    if (teacherGradesEmpty) teacherGradesEmpty.hidden = true;
  }

  // Evento para guardar calificación editada
  if (teacherGradesList) {
    teacherGradesList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".save-grade-btn");
      if (btn) {
        const activityId = btn.dataset.activityId;
        const input = teacherGradesList.querySelector(
          `input[data-activity-id='${activityId}']`
        );
        if (!input) return;
        btn.disabled = true;
        try {
          const studentId = user.uid;
          await updateDoc(
            doc(db, "grades", studentId, "activities", activityId),
            { grade: Number(input.value) }
          );
          input.classList.add("bg-green-100", "border-green-400");
          setTimeout(() => {
            input.classList.remove("bg-green-100", "border-green-400");
          }, 1200);
        } catch (err) {
          input.classList.add("bg-red-100", "border-red-400");
          setTimeout(() => {
            input.classList.remove("bg-red-100", "border-red-400");
          }, 1500);
        } finally {
          btn.disabled = false;
        }
      }
    });
  }

  if (userRole === "docente") {
    if (titleEl)
      titleEl.textContent = "Panel de Calificaciones (Promedios Generales)";
    // Renderizar desglose de actividades para el docente (selección dinámica)
    const gradesSnap = await getDocs(collection(db, "grades"));
    const allStudentGrades = [];
    gradesSnap.forEach((doc) => {
      const grade = doc.data();
      allStudentGrades.push({
        ...grade,
        name:
          rosterMap.get(grade.authUid) || grade.name || "Estudiante sin nombre",
        id: doc.id,
      });
    });
    renderGradesTable(allStudentGrades);
    // Llenar el select de estudiantes
    if (studentSelect) {
      studentSelect.innerHTML = allStudentGrades
        .map(
          (s, i) =>
            `<option value="${s.id}"${i === 0 ? " selected" : ""}>${
              s.name
            }</option>`
        )
        .join("");
      // Evento para cambiar el desglose mostrado
      studentSelect.onchange = async (e) => {
        await renderTeacherActivities(e.target.value);
      };
    }
    // Mostrar actividades del primer estudiante por defecto
    if (allStudentGrades.length) {
      await renderTeacherActivities(allStudentGrades[0].id);
    }
    unsubscribeFromData = () => {};
  } else {
    if (titleEl) titleEl.textContent = "Resumen de Mis Calificaciones";
    // Renderizar desglose de actividades para el estudiante actual
    if (user.uid) {
      const gradesQuery = query(
        collection(db, "grades"),
        where("authUid", "==", user.uid)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const myGrades = [];
      gradesSnap.forEach((doc) => {
        const grade = doc.data();
        myGrades.push({
          ...grade,
          name: rosterMap.get(grade.authUid) || grade.name || "Estudiante",
          id: doc.id,
        });
      });
      renderGradesTable(myGrades);
      // Mostrar actividades del propio estudiante
      const activities = await loadActivitiesSubcollection(user.uid);
      if (teacherGradesList) {
        teacherGradesList.innerHTML = activities
          .map(
            (a) => `
            <li class="flex items-center justify-between border-b py-2">
              <div>
                <span class="font-semibold">${a.activityName || a.id}</span>
                <span class="ml-2 text-xs text-gray-500">(${
                  a.type || "N/A"
                }, Unidad: ${(a.unit || "").replace("unit", "")})</span>
                ${
                  a.evidenceUrl
                    ? `<a href="${a.evidenceUrl}" target="_blank" class="ml-2 text-blue-600 underline">Ver evidencia</a>`
                    : ""
                }
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold">${a.grade ?? "-"}</span>
              </div>
            </li>
          `
          )
          .join("");
        if (teacherGradesEmpty)
          teacherGradesEmpty.hidden = activities.length > 0;
      }
    }
  }
}

function renderGradesTable(studentsData) {
  const tbody = document.getElementById("grades-table-body");
  if (!tbody) return;

  if (!studentsData || studentsData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4">No hay calificaciones para mostrar.</td></tr>';
    return;
  }

  studentsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  tbody.innerHTML = studentsData
    .map((student) => {
      const unit1 = student.unit1?.average ?? student.unit1 ?? 0;
      const unit2 = student.unit2?.average ?? student.unit2 ?? 0;
      const projectFinal = student.projectFinal ?? 0;
      const finalGrade = student.finalGrade ?? 0;
      return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium text-gray-800">${student.name}</td>
            <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
            <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(
              2
            )}</td>
            <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(
              finalGrade
            ).toFixed(1)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderActivitiesForStudent(activities) {
  const tbody = document.getElementById("student-activities-body");
  if (!tbody) return;
  if (!activities || activities.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4">No hay actividades detalladas.</td></tr>';
    return;
  }
  tbody.innerHTML = activities
    .map(
      (activity) => `
        <tr class="border-b">
            <td class="py-2 px-4">${activity.activityName || "Sin nombre"}</td>
            <td class="py-2 px-4 capitalize">${activity.type || "N/A"}</td>
            <td class="py-2 px-4 text-center">${(activity.unit || "").replace(
              "unit",
              ""
            )}</td>
            <td class="py-2 px-4 text-right font-medium">${(
              activity.score || 0
            ).toFixed(2)}</td>
        </tr>
    `
    )
    .join("");
}

onAuth(handleAuthStateChanged);
