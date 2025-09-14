document.addEventListener("DOMContentLoaded", () => {
  // Asegura CSS compartido (ruta estándar /css)
  const hasLayoutCss = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  ).some((l) => (l.getAttribute("href") || "").includes("layout.css"));
  if (!hasLayoutCss) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/layout.css";
    document.head.appendChild(link);
  }

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
        </nav>
      </div>`;

  let navEl = document.querySelector(".qs-nav, [data-role='main-nav']");
  if (!navEl) {
    navEl = document.createElement("div");
    navEl.className = "qs-nav";
    document.body.prepend(navEl);
  }
  navEl.setAttribute("data-role", "main-nav");
  navEl.innerHTML = navHtml;

  // Marca pestaña activa
  const path = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();
  navEl.querySelectorAll(".qs-tabs a.qs-btn").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  // Padding-top via CSS var (sin tocar contenido)
  const pickNav = () =>
    document.querySelector('[data-role="main-nav"], .qs-nav, nav');
  const setPad = () => {
    const el = pickNav();
    const h = el ? el.getBoundingClientRect().height : 64;
    const safe = Math.min(Math.max(Math.round(h), 56), 96);
    document.documentElement.style.setProperty("--nav-h", safe + "px");
    // limpia overrides antiguos
    document.body.style.removeProperty("padding-top");
    if (el) {
      el.style.marginTop = "0";
      el.style.marginBottom = "0";
    }
  };
  setPad();
  addEventListener("resize", setPad);
  if (window.ResizeObserver) {
    const obEl = pickNav();
    if (obEl) new ResizeObserver(setPad).observe(obEl);
  }

  // Shared footer con año automático
  const year = new Date().getFullYear();
  const footerHtml = `<div class="footer-content">© ${year} Plataforma QS - Calidad de Software | Isaac Paniagua</div>`;
  let footer = document.querySelector("footer.footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "footer";
    document.body.appendChild(footer);
  }
  footer.innerHTML = footerHtml;
});
