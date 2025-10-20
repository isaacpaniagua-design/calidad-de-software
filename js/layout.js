// Unified layout bootstrap for the QS platform.
// Creates the navigation bar, footer, and login integrations used across pages.

// CAMBIO: 1. Importar las variables desde el módulo de actualizaciones.
// Asegúrate de que el archivo 'updates.js' que te proporcioné antes exista en la misma carpeta 'js/'.
import { latestVersion, lastSeenVersionKey } from "./updates.js";

(function initializeLoadingOverlay() {
  ensureLoadingOverlay();
  try {
    const root = document.documentElement;
    if (!root) return;
    root.classList.add("qs-loading");
    root.classList.remove("qs-loaded");
  } catch (_) {}
})();

(function syncRoleFromStorage() {
  try {
    const root = document.documentElement;
    if (!root) return;
    const storedRole = localStorage.getItem("qs_role");
    root.classList.remove("role-teacher", "role-student");
    if (storedRole === "docente") {
      root.classList.add("role-teacher");
    } else if (storedRole === "estudiante") {
      root.classList.add("role-student");
    }
  } catch (_) {}
})();

function ensureLoadingOverlay() {
  if (document.querySelector(".qs-loading-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "qs-loading-overlay";
  overlay.innerHTML = `
    <div class="qs-loading-spinner">
      <svg viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>
    </div>
  `;
  document.body.appendChild(overlay);
}

document.addEventListener("DOMContentLoaded", function () {
  const root = document.documentElement;
  if (!root) return;

  root.classList.remove("qs-loading");
  root.classList.add("qs-loaded");

  const isIndexPage =
    window.location.pathname.endsWith("/") ||
    window.location.pathname.endsWith("/index.html");

  const navPath = isIndexPage ? "" : "../";

  const navLinks = `
    <a href="${navPath}index.html">Inicio</a>
    <a href="${navPath}actividades.html">Actividades</a>
    <a href="${navPath}calificaciones.html">Calificaciones</a>
    <a href="${navPath}materiales.html">Materiales</a>
    <a href="${navPath}paneldocente.html" class="teacher-only">Panel Docente</a>
    <a href="${navPath}updates.html">Novedades</a>
  `;

  const navHtml = `
    <div class="nav-container">
      <div class="nav-left">
        <a href="${navPath}index.html" class="brand-logo">
          <img src="https://firebasestorage.googleapis.com/v0/b/plataforma-bravo.appspot.com/o/logo.png?alt=media&token=e2e34493-52f1-4688-958b-57c57c23a7e0" alt="Plataforma Bravo" />
        </a>
        <div class="nav-links">
          ${navLinks}
        </div>
      </div>
      <div class="nav-right">
        <div id="user-info"></div>
        <button id="logout-button" style="display: none;">Cerrar Sesión</button>
      </div>
    </div>
  `;

  const footerHtml = `
    <div class="footer-container">
      <p>&copy; 2024 Plataforma Bravo. Todos los derechos reservados.</p>
    </div>
  `;

  const navElement = document.createElement("nav");
  navElement.innerHTML = navHtml;
  document.body.insertBefore(navElement, document.body.firstChild);

  const footerElement = document.createElement("footer");
  footerElement.innerHTML = footerHtml;
  document.body.appendChild(footerElement);

  // CAMBIO: 2. Lógica para mostrar el indicador de novedades.
  // Esta parte debe estar DESPUÉS de que se ha creado el menú de navegación.
  const lastSeenVersion = localStorage.getItem(lastSeenVersionKey);
  if (String(lastSeenVersion) !== String(latestVersion)) {
    const updatesLink = document.querySelector('a[href*="updates.html"]');
    if (updatesLink) {
      const notificationDot = document.createElement("span");
      notificationDot.classList.add("notification-dot");
      updatesLink.classList.add("notification-active");
      updatesLink.appendChild(notificationDot);
    }
  }
});
