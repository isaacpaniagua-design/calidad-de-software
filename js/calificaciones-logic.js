// js/calificaciones-logic.js

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

/**
 * Initializes the activity breakdown section.
 * This function will fetch and display the activities for the logged-in user or a selected student.
 */
async function initActivityBreakdown() {
  onAuthStateChanged(auth, async (user) => {
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
 * Gets the role of the user from the Firestore 'users' collection.
 * @param {string} uid - The user ID.
 * @returns {Promise<string|null>} The user role or null if not found.
 */
async function getUserRole(uid) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data().role;
  }
  return null;
}

/**
 * Sets up the teacher's view, including the student selector.
 */
async function setupTeacherView() {
  const selectorContainer = document.getElementById("teacher-student-selector-container");
  const studentSelector = document.getElementById("student-selector");
  
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
 * Fetches all students from the 'users' collection.
 * @returns {Promise<Array<Object>>} A list of student objects.
 */
async function getStudents() {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "student"));
  const querySnapshot = await getDocs(q);
  const students = [];
  querySnapshot.forEach((doc) => {
    students.push({ uid: doc.id, ...doc.data() });
  });
  return students;
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

  loadingEl.hidden = false;
  listEl.innerHTML = ''; // Clear previous list
  emptyEl.hidden = true;

  const activities = await getAssignedActivities();
  const submissions = await getStudentSubmissions(studentId);

  loadingEl.hidden = true;

  if (activities.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  activities.forEach(activity => {
    const submission = submissions.find(s => s.activityId === activity.id);
    const clone = template.cloneNode(true);
    
    clone.classList.remove("activity-item-template");
    clone.style.display = 'block';

    clone.querySelector('.font-semibold').textContent = activity.title;
    clone.querySelector('.text-sm.text-gray-500').textContent = activity.description;

    const gradeBadge = clone.querySelector('.grade-badge');
    const statusBadge = clone.querySelector('.status-badge');
    const submissionLink = clone.querySelector('.submission-link');
    const noSubmissionText = clone.querySelector('.no-submission-text');
    
    if (submission) {
      gradeBadge.textContent = submission.grade || 'N/A';
      statusBadge.textContent = 'Entregado';
      statusBadge.classList.add('bg-green-100', 'text-green-800');
      submissionLink.href = submission.fileUrl;
      noSubmissionText.style.display = 'none';
    } else {
      gradeBadge.textContent = 'N/A';
      statusBadge.textContent = 'Pendiente';
      statusBadge.classList.add('bg-yellow-100', 'text-yellow-800');
      submissionLink.style.display = 'none';
    }

    listEl.appendChild(clone);
  });
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
 * @param {string} studentId - The ID of the student.
 * @returns {Promise<Array<Object>>} A list of submission objects.
 */
async function getStudentSubmissions(studentId) {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);
  const submissions = [];
  querySnapshot.forEach((doc) => {
    submissions.push({ id: doc.id, ...doc.data() });
  });
  return submissions;
}

// Initialize the module
document.addEventListener("DOMContentLoaded", initActivityBreakdown);
