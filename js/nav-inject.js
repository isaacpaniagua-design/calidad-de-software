// Reemplaza el contenido de js/nav-inject.js con esto:
(function () {
  const navContainer = document.getElementById("main-nav-container");
  if (!navContainer) return;

  const navHTML = `
    <div class="qs-nav" data-role="main-nav">
      <div class="wrap">
        <div class="qs-brand-shell">
          <div class="qs-brand-region">
            <a class="qs-brand" href="index.html">
              <span class="qs-logo" aria-hidden="true">QS</span>
              <span class="qs-brand-text">
                <span class="qs-title">Calidad de Software</span>
                <span class="qs-subtitle">ITSON</span>
              </span>
            </a>
          </div>
          <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">
            <span class="qs-menu-icon" aria-hidden="true"></span>
            <span class="sr-only">Abrir menú</span>
          </button>
        </div>
        <div class="qs-links-region">
          <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegación principal">
            <a class="qs-btn" href="materiales.html">Materiales</a>
            <a class="qs-btn" href="asistencia.html">Asistencia</a>
            <a class="qs-btn" href="calificaciones.html">Calificaciones</a>
            <a class="qs-btn" href="Foro.html">Foro</a>
            
            <a class="qs-btn teacher-only" href="actividades.html">Gestionar Actividades</a>

            <a class="qs-btn teacher-only" href="paneldocente.html">Panel</a>
          </nav>
        </div>
      </div>
    </div>
  `;
  navContainer.innerHTML = navHTML;
})();
