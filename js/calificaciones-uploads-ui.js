import { initFirebase } from "./firebase.js";
import { useStorage } from "./firebase-config.js";
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import {
  createStudentUpload,
  observeStudentUploads,
  observeStudentUploadsByEmail,
  deleteStudentUpload,
} from "./student-uploads.js";
import {
  getActivityById,
  findActivityByTitle,
} from "./course-activities.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// initFirebase(); // Se elimina, el orquestador lo hace.
initializeFileViewer();

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const gradeItemSelector = "#calificaciones-root .grade-item";
const displays = new Map();
let unsubscribeUploads = null;
let currentProfileKey = null;
let currentStudentProfile = null;
let authUser = null;
let uiReady = false;
let hiddenFileInput = null;
let pendingUploadEntry = null;
let teacherRoleDetected = false;

// ... (TODAS las funciones auxiliares internas desde isTeacherUploadingForAnotherStudent hasta handleFileInputChange van aquí SIN CAMBIOS)
// ... PEGA EL CÓDIGO FALTANTE AQUÍ ...
// (Es el mismo código que ya tienes en tu archivo, no necesitas cambiar nada en ellas)

function subscribeToProfile(profile) {
  setCurrentProfile(profile);
  if (!uiReady) return;
  const key = profile
    ? `${profile.uid || ""}|${(profile.email || "").toLowerCase()}`
    : "__none__";
  if (key === currentProfileKey) {
    updateUploadButtonsState(currentStudentProfile);
    return;
  }
  currentProfileKey = key;
  if (typeof unsubscribeUploads === "function") {
    try {
      unsubscribeUploads();
    } catch (_) {}
    unsubscribeUploads = null;
  }

  if (!profile || (!profile.uid && !profile.email)) {
    updateDisplays(new Map());
    return;
  }

  setLoadingState();

  const onChange = (items) => {
    updateDisplays(mapUploadsByActivity(items));
  };

  const onError = () => {
    setErrorState();
  };

  if (profile.uid) {
    unsubscribeUploads = observeStudentUploads(profile.uid, onChange, onError);
  } else if (profile.email) {
    unsubscribeUploads = observeStudentUploadsByEmail(profile.email, onChange, onError);
  }
}

function getSelectedStudentProfile() {
  const select = document.getElementById("studentSelect");
  if (!select || !select.value) return null;
  const option = select.selectedOptions && select.selectedOptions[0];
  const value = select.value;
  const email = option?.dataset?.email || option?.getAttribute("data-email") || "";
  const uid = option?.dataset?.uid || option?.getAttribute("data-uid") || "";
  
  // Lógica simplificada para obtener el perfil
  const profile = {
      uid: uid,
      email: email,
      matricula: value,
      id: value,
      displayName: option ? option.textContent.split(' - ')[1] : ''
  };

  if (profile.uid || profile.email || profile.matricula) return profile;
  return null;
}

function handleStudentSelection() {
  const profile = getSelectedStudentProfile();
  if (profile) {
    subscribeToProfile(profile);
  } else if (authUser) {
    subscribeToProfile({ uid: authUser.uid, email: authUser.email || "" });
  } else {
    subscribeToProfile(null);
  }
}

async function main() {
  if (uiReady) return; // Evita re-inicialización
  await ready();
  ensureDisplays();
  uiReady = true;
  handleStudentSelection();

  const select = document.getElementById("studentSelect");
  if (select) {
    select.addEventListener("change", handleStudentSelection);
  }
}

// --- ¡NUEVA FUNCIÓN DE INICIALIZACIÓN! ---
export function initUploadsUI(user, claims) {
    if (!user || !claims) {
        return;
    }
    authUser = user;
    teacherRoleDetected = claims.role === 'docente';
    
    main().catch((error) => {
        console.error("[calificaciones-uploads-ui]", error);
        if (typeof setErrorState === 'function') {
            setErrorState();
        }
    });
}
