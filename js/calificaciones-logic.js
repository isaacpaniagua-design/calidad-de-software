// js/calificaciones-logic.js

import {
  getDb,
} from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const db = getDb();

/**
 * Main initialization function that waits for the role to be determined.
 */
function init() {
  document.addEventListener('role-determined', (e) => {
    const { user, isTeacher } = e.detail;
    
    if (user) {
      if (isTeacher) {
        setupTeacherView();
      } else {
        displayStudentActivities(user.uid);
      }
    } else {
      console.log("No user is signed in.");
    }
  });
}

/**
 * Sets up the teacher's view by populating the student selector.
 */
async function setupTeacherView() {
  const selectorContainer = document.getElementById("teacher-student-selector-container");
  const studentSelector = document.getElementById("student-selector");
  
  if (!selectorContainer || !studentSelector) {
    console.error("Teacher view elements not found.");
    return;
  }
  
  selectorContainer.hidden = false;

  try {
    const students = await getStudents();
    if (students.length > 0) {
      studentSelector.innerHTML = '<option value="">Seleccione un estudiante</option>' + students
        .map(student => `<option value="${student.uid}">${student.name}</option>`)
        .join('');
    } else {
      studentSelector.innerHTML = '<option value="">No se encontraron estudiantes</option>';
    }

    studentSelector.addEventListener("change", (e) => {
      const studentUid = e.target.value;
      if (studentUid) {
        displayStudentActivities(studentUid);
      } else {
        document.getElementById("activity-list").innerHTML = '';
        const emptyEl = document.getElementById("activity-list-empty");
        if (emptyEl) {
          emptyEl.hidden = false;
          emptyEl.textContent = 'Seleccione un estudiante para ver sus actividades.';
        }
      }
    });
  } catch (error) {
    console.error("Failed to set up teacher view:", error);
    studentSelector.innerHTML = '<option value="">Error al cargar estudiantes</option>';
  }
}

/**
 * Fetches all students from the local data/students.json file.
 * @returns {Promise<Array<Object>>} A list of student objects.
 */
async function getStudents() {
  try {
    const response = await fetch('data/students.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const studentsData = await response.json();

    if (!Array.isArray(studentsData.students)) {
      console.error("Invalid format: students.json should have a 'students' array.");
      return [];
    }

    // Map and filter the data to ensure all records are valid before sorting.
    return studentsData.students
      .map(student => ({
        uid: student.authUid,
        name: student.name
      }))
      .filter(student => student.uid && student.name) // Ensure both uid and name exist.
      .sort((a, b) => a.name.localeCompare(b.name)); // Now, this is safe to run.

  } catch (error) {
    console.error("Could not fetch or parse students.json:", error);
    return []; // Return an empty array on failure.
  }
}

/**
 * Displays the activities for a given student.
 * @param {string} studentUid - The authUid of the student.
 */
async function displayStudentActivities(studentUid) {
  const loadingEl = document.getElementById("activity-list-loading");
  const emptyEl = document.getElementById("activity-list-empty");
  const listEl = document.getElementById("activity-list");
  const template = document.querySelector(".activity-item-template");

  if (!loadingEl || !emptyEl || !listEl || !template) return;

  loadingEl.hidden = false;
  listEl.innerHTML = '';
  emptyEl.hidden = true;

  try {
    const [activities, submissions] = await Promise.all([
      getAssignedActivities(),
      getStudentSubmissions(studentUid)
    ]);

    if (activities.length === 0) {
      emptyEl.textContent = 'No hay actividades asignadas por el momento.';
      emptyEl.hidden = false;
      return;
    }

    activities.forEach(activity => {
      const submission = submissions.find(s => s.activityId === activity.id);
      const clone = template.cloneNode(true);
      
      clone.classList.remove("activity-item-template");
      clone.style.display = 'block';

      const titleEl = clone.querySelector('.font-semibold');
      if(titleEl) titleEl.textContent = activity.title;

      const descriptionEl = clone.querySelector('.text-sm.text-gray-500');
      if(descriptionEl) descriptionEl.textContent = activity.description;

      const gradeBadge = clone.querySelector('.grade-badge');
      const statusBadge = clone.querySelector('.status-badge');
      const submissionLink = clone.querySelector('.submission-link');
      const noSubmissionText = clone.querySelector('.no-submission-text');
      
      if (submission) {
        if(gradeBadge) gradeBadge.textContent = typeof submission.grade === 'number' ? submission.grade : 'N/A';
        
        if(statusBadge) {
            if (submission.fileUrl) {
                statusBadge.textContent = 'Entregado';
                statusBadge.className = 'status-badge bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
            } else if (typeof submission.grade === 'number') {
                statusBadge.textContent = 'Calificado';
                statusBadge.className = 'status-badge bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
            } else {
                statusBadge.textContent = 'Visto';
                statusBadge.className = 'status-badge bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
            }
        }
        
        if(noSubmissionText) noSubmissionText.style.display = 'none';

        if(submissionLink) {
            if (submission.fileUrl) {
                submissionLink.href = submission.fileUrl;
                submissionLink.style.display = 'inline';
            } else {
                submissionLink.style.display = 'none';
            }
        }

      } else {
        if(gradeBadge) gradeBadge.textContent = 'N/A';
        if(statusBadge) {
            statusBadge.textContent = 'Pendiente';
            statusBadge.className = 'status-badge bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
        }
        if(submissionLink) submissionLink.style.display = 'none';
        if(noSubmissionText) noSubmissionText.style.display = 'block';
      }

      listEl.appendChild(clone);
    });
  } catch (error) {
      console.error("Error displaying student activities:", error);
      emptyEl.textContent = "Error al cargar las actividades.";
      emptyEl.hidden = false;
  } finally {
      loadingEl.hidden = true;
  }
}

/**
 * Fetches all assigned activities from the 'activities' collection.
 * @returns {Promise<Array<Object>>} A list of activity objects.
 */
async function getAssignedActivities() {
  const activitiesCol = collection(db, "activities");
  const activitySnapshot = await getDocs(activitiesCol);
  return activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Fetches all submissions for a specific student.
 * @param {string} studentUid - The authUid of the student.
 * @returns {Promise<Array<Object>>} A list of submission objects.
 */
async function getStudentSubmissions(studentUid) {
  if (!studentUid) return [];
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("studentUid", "==", studentUid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Start the initialization process when the DOM is ready.
document.addEventListener("DOMContentLoaded", init);
