import {
  initFirebase,
  onAuth,
  getAuthInstance,
  // Use the unrestricted Google sign-in for all roles. This allows accounts
  // outside of the @potros domain to authenticate while roles are determined
  // via Firestore and allowedTeacherEmails.
  signInWithGoogleOpen as signInWithGooglePotros,
  signOutCurrent,
  isTeacherEmail,
  isTeacherByDoc,
  ensureTeacherDocForUser,
} from "./firebase.js";

initFirebase();

function setLocalRole(isTeacher) {
  try {
    localStorage.setItem("qs_role", isTeacher ? "docente" : "estudiante");
  } catch (_) {}
}

function upsertAuthButton(target) {
  let btn = document.getElementById("qs-auth-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "qs-auth-btn";
    btn.className =
      "px-3 py-1 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 text-sm";
    (target || document.body).appendChild(btn);
  }
  return btn;
}

function applyMaterialsRole(isTeacher) {
  const teacherView = document.getElementById("teacherView");
  const studentView = document.getElementById("studentView");
  if (teacherView && studentView) {
    teacherView.classList.toggle("hidden", !isTeacher);
    studentView.classList.toggle("hidden", !!isTeacher);
  }
  document
    .querySelectorAll(".teacher-only,.docente-only")
    .forEach((el) => el.classList.toggle("hidden", !isTeacher));
  // Disable role toggle buttons to avoid manual switching
  document.querySelectorAll(".role-toggle .role-btn").forEach((b) => {
    b.disabled = true;
    b.classList.remove("active");
  });
  const active = document.getElementById(
    isTeacher ? "teacherBtn" : "studentBtn"
  );
  if (active) active.classList.add("active");
  // Inject auth button in header
  const roleToggle = document.querySelector(".role-toggle");
  const authBtn = upsertAuthButton(
    roleToggle || document.querySelector(".header-content")
  );
  authBtn.textContent = getAuthInstance()?.currentUser
    ? "Cerrar sesion"
    : "Iniciar sesion";
  authBtn.onclick = async () => {
    const auth = getAuthInstance();
    if (auth?.currentUser) await signOutCurrent();
    else await signInWithGooglePotros();
  };
}

function applyGradesRole(isTeacher) {
  // Solo botón de autenticación. El gating de inputs lo hace el HTML.
  const btnWrap = document.createElement("div");
  btnWrap.style.position = "fixed";
  btnWrap.style.top = "10px";
  btnWrap.style.right = "12px";
  btnWrap.style.zIndex = "1000";
  btnWrap.className = "flex gap-2 items-center";
  const authBtn = upsertAuthButton(btnWrap);
  document.body.appendChild(btnWrap);
  authBtn.textContent = getAuthInstance()?.currentUser
    ? "Cerrar sesión"
    : "Iniciar con Google";
  authBtn.onclick = async () => {
    const auth = getAuthInstance();
    if (auth?.currentUser) await signOutCurrent();
    else await signInWithGooglePotros();
  };
  // Para pruebas con cuentas externas o dominios no permitidos, se puede
  // acceder mediante la página login.html. Si deseas mostrar un enlace
  // explícito aquí, descomenta el siguiente bloque:
  /*
  const altLink = document.createElement('a');
  altLink.href = 'login.html';
  altLink.textContent = 'Acceso alternativo';
  altLink.className = 'text-sm text-indigo-600 hover:underline';
  btnWrap.appendChild(altLink);
  */
}

onAuth(async (user) => {
  const email = user?.email || "";
  let teacher = false;
  if (user?.uid) {
    try {
      teacher = await isTeacherByDoc(user.uid);
    } catch (_) {}
  }
  if (!teacher && email) teacher = isTeacherEmail(email);
  if (!teacher && user?.uid && email && isTeacherEmail(email)) {
    try {
      const ok = await ensureTeacherDocForUser({
        uid: user.uid,
        email,
        displayName: user.displayName,
      });
      if (ok) teacher = true;
    } catch (_) {}
  }
  setLocalRole(teacher);

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page === "materiales.html") applyMaterialsRole(teacher);
  // Calificaciones.html ya contiene la barra de navegación con su propio botón
  // de autenticación a través de nav-inject.js.  Evitamos inyectar otro
  // botón (qs-auth-btn) desde role-gate para no duplicar controles.
  if (page === "calificaciones.html") {
    // No llamar a applyGradesRole aquí.
  }
});
