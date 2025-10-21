
import { gradeStudentUpload } from "./student-uploads.js";

function createGradingModal() {
  const modal = document.createElement("div");
  modal.id = "grading-modal";
  modal.className = "pd-modal";
  modal.innerHTML = `
    <div class="pd-modal-content">
      <span class="pd-modal-close">&times;</span>
      <h2>Calificar Entrega</h2>
      <form id="grading-form">
        <input type="hidden" id="grading-upload-id" name="uploadId">
        <div class="pd-field">
          <label for="grade-input">Calificación (0-100)</label>
          <input type="number" id="grade-input" name="grade" min="0" max="100" required>
        </div>
        <div class="pd-field">
          <label for="feedback-input">Comentarios</label>
          <textarea id="feedback-input" name="feedback"></textarea>
        </div>
        <button type="submit" class="pd-button primary">Guardar Calificación</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".pd-modal-close").onclick = () => {
    modal.style.display = "none";
  };

  modal.querySelector("#grading-form").onsubmit = async (e) => {
    e.preventDefault();
    const uploadId = document.getElementById("grading-upload-id").value;
    const grade = document.getElementById("grade-input").value;
    const feedback = document.getElementById("feedback-input").value;

    try {
      await gradeStudentUpload(uploadId, {
        grade: parseInt(grade, 10),
        teacherFeedback: feedback,
      });
      modal.style.display = "none";
      // Optionally, refresh the uploads list or show a success message
    } catch (error) {
      console.error("Error saving grade:", error);
      // Show an error message
    }
  };

  return modal;
}

export function initGrading() {
  const modal = createGradingModal();

  document.addEventListener("click", (e) => {
    if (e.target.dataset.action === "grade") {
      const uploadId = e.target.closest(".pd-uploads__item").dataset.id;
      document.getElementById("grading-upload-id").value = uploadId;
      modal.style.display = "block";
    }
  });
}
