// js/role-gate.js
import { onAuth, isTeacherByDoc, ensureTeacherAllowlistLoaded } from "./firebase.js";

/**
 * Manages UI visibility based on user role (student vs. teacher).
 * Hides/shows elements with `teacher-only` and `student-only` classes.
 */
function handleRoleBasedUI(isTeacher) {
  const teacherOnlyElements = document.querySelectorAll(".teacher-only");
  const studentOnlyElements = document.querySelectorAll(".student-only");

  if (isTeacher) {
    teacherOnlyElements.forEach((el) => {
      el.hidden = false;
      el.style.display = ''; 
      el.removeAttribute('aria-hidden');
    });
    studentOnlyElements.forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  } else {
    teacherOnlyElements.forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
    studentOnlyElements.forEach((el) => {
      el.hidden = false;
      el.style.display = '';
      el.removeAttribute('aria-hidden');
    });
  }
}

/**
 * Initializes the role-gate logic.
 */
async function initRoleGate() {
  await ensureTeacherAllowlistLoaded();

  onAuth(async (user) => {
    let isTeacher = false;
    if (user) {
      isTeacher = await isTeacherByDoc(user.uid);
    }
    
    // Update the UI based on the role.
    handleRoleBasedUI(isTeacher);
    
    // Announce that the role has been determined and the UI is ready.
    const event = new CustomEvent('role-determined', { 
        detail: { 
            user: user, 
            isTeacher: isTeacher 
        } 
    });
    document.dispatchEvent(event);
  });
}

// Execute the role gate initialization when the DOM is ready.
document.addEventListener("DOMContentLoaded", initRoleGate);
