// js/calificaciones-logic.js

import {
  getDb,
  getAuthInstance,
  onAuth,
  isTeacherByDoc,
  findStudentByUid,
} from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";


const db = getDb();
const auth = getAuthInstance();

/**
 * Initializes the activity breakdown section.
 * This function will fetch and display the activities for the logged-in user or a selected student.
 */
async function initActivityBreakdown() {
  onAuth(async (user) => {
    if (user) {
      const userRole = await getUserRole(user.uid);
      if (userRole === "teacher") {
        setupTeacherView();
      } else {
        displayStudentActivities(user.uid);
      }
    }
  });
}

/**
 * Gets the role of the user by checking the 'teachers' and 'students' collections.
 * @param {string} uid - The user ID.
 * @returns {Promise<string|null>} The user role ('teacher', 'student') or null if not found.
 */
async function getUserRole(uid) {
  if (await isTeacherByDoc(uid)) {
    return "teacher";
  }
  if (await findStudentByUid(uid)) {
    return "student";
  }
  return null;
}


/**
 * Sets up the teacher's view, including the student selector.
 */
async function setupTeacherView() {
  const selectorContainer = document.getElementById("teacher-student-selector-container");
  if (!selectorContainer) return;
  const studentSelector = document.getElementById("student-selector");
  if (!studentSelector) return;
  
  selectorContainer.hidden = false;

  // Populate student selector
  const students = await getStudents();
  studentSelector.innerHTML = students
    .map(student => `<option value="${student.uid}">${student.name}</option>`)
    .join('');

  // Add event listener to selector
  studentSelector.addEventListener("change", (e) => {
    displayStudentActivities(e.target.value);
  });

  // Display activities for the first student by default
  if (students.length > 0) {
    displayStudentActivities(students[0].uid);
  }
}

/**
 * Fetches all students from the 'students' collection.
 * @returns {Promise<Array<Object>>} A list of student objects.
 */
async function getStudents() {
  const studentsRef = collection(db, "students");
  const querySnapshot = await getDocs(studentsRef);
  const students = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.authUid && data.name) {
      students.push({ uid: data.authUid, name: data.name });
    }
  });
  return students.sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Displays the activities for a given student.
 * @param {string} studentId - The ID of the student.
 */
async function displayStudentActivities(studentId) {
  const loadingEl = document.getElementById("activity-list-loading");
  const emptyEl = document.getElementById("activity-list-empty");
  const listEl = document.getElementById("activity-list");
  const template = document.querySelector(".activity-item-template");

  if (!loadingEl || !emptyEl || !listEl || !template) return;

  loadingEl.hidden = false;
  listEl.innerHTML = ''; // Clear previous list
  emptyEl.hidden = true;

  try {
    const activities = await getAssignedActivities();
    const submissions = await getStudentSubmissions(studentId);

    if (activities.length === 0) {
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
        if(gradeBadge) gradeBadge.textContent = submission.grade || 'N/A';
        if(statusBadge) {
            statusBadge.textContent = 'Entregado';
            statusBadge.classList.add('bg-green-100', 'text-green-800');
            statusBadge.classList.remove('bg-yellow-100', 'text-yellow-800');
        }
        if(submissionLink) submissionLink.href = submission.fileUrl;
        if(noSubmissionText) noSubmissionText.style.display = 'none';
        if(submissionLink && !submission.fileUrl) submissionLink.style.display = 'none';

      } else {
        if(gradeBadge) gradeBadge.textContent = 'N/A';
        if(statusBadge) {
            statusBadge.textContent = 'Pendiente';
            statusBadge.classList.add('bg-yellow-100', 'text-yellow-800');
            statusBadge.classList.remove('bg-green-100', 'text-green-800');
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
  const activitiesList = activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return activitiesList;
}

/**
 * Fetches all submissions for a specific student from the 'submissions' collection.
 * @param {string} studentId - The authUid of the student.
 * @returns {Promise<Array<Object>>} A list of submission objects.
 */
async function getStudentSubmissions(studentId) {
  const submissionsRef = collection(db, "submissions");
  // Assuming the student's auth UID is stored in a field called 'studentUid'
  const q = query(submissionsRef, where("studentUid", "==", studentId));
  const querySnapshot = await getDocs(q);
  const submissions = [];
  querySnapshot.forEach((doc) => {
    submissions.push({ id: doc.id, ...doc.data() });
  });
  return submissions;
}

// Initialize the module
document.addEventListener("DOMContentLoaded", initActivityBreakdown);
