document.addEventListener("DOMContentLoaded", () => {
  // Asegura CSS compartido. Usa ./layout.css en raíz (GitHub Pages).
  const hasLayoutCss = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  ).some((l) => (l.getAttribute("href") || "").includes("layout.css"));
  if (!hasLayoutCss) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href="./layout.css"; // si lo mueves a /css, cámbialo a 'css/layout.css'
    document.head.appendChild(link);
  }
  // No forzar color de fondo aquí. Se hereda de layout.css

  // Build shared nav
  const navHtml = `
      <div class="wrap">
        <a class="qs-brand" href="index.html"><span>Plataforma QS</span></a>
        <nav class="qs-tabs" aria-label="Navegación">
          <a class="qs-btn" href="materiales.html">Materiales</a>
          <a class="qs-btn" href="asistencia.html">Asistencia</a>
          <a class="qs-btn" href="calificaciones.html">Calificaciones</a>
          <a class="qs-btn" href="Foro.html">Foro</a>
          <a class="qs-btn" href="paneldocente.html">Panel</a>
          <a class="qs-btn" href="roadmap.html">Roadmap</a>
        </nav>
      </div>`;
  // Marcar pestaña activa por pathname
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".qs-tabs a.qs-btn").forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (href && href.endsWith(current)) {
      a.setAttribute("aria-current", "page");
    } else {
      a.removeAttribute("aria-current");
    }
  });

  let nav = document.querySelector(".qs-nav");
  if (nav) {
    nav.innerHTML = navHtml;
  } else {
    nav = document.createElement("div");
    nav.className = "qs-nav";
    nav.innerHTML = navHtml;
    document.body.prepend(nav);
  }

  // Adjust body padding-top to navbar height (override CSS fallback)
  const setPad = () => {
    const h = nav?.offsetHeight || 70;
    document.body.style.setProperty("padding-top", h + "px", "important");
  };
  setPad();
  window.addEventListener("resize", setPad);

  // Shared footer with automatic year
  const year = new Date().getFullYear();
  const footerHtml = `<div class="footer-content">© ${year} Plataforma QS - Calidad de Software | Isaac Paniagua</div>`;
  let footer = document.querySelector("footer.footer");
  if (footer) {
    footer.innerHTML = footerHtml;
  } else {
    footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML = footerHtml;
    document.body.appendChild(footer);
  }

  // Mark active tab
  const path = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();
  document.querySelectorAll(".qs-tabs a.qs-btn").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) a.setAttribute("aria-current", "page");
  });
  // Remove the erroneous catch block
});
