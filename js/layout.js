document.addEventListener("DOMContentLoaded", () => {
  const p = location.pathname;
  const pLow = p.toLowerCase();
  const inSesiones =
    /(^|\/)sesiones\//.test(pLow) || /(^|\/)sesion[\w-]*\.html$/.test(pLow);
  const base = inSesiones ? "../" : "";

  // ====== PÁGINAS NORMALES (no sesiones): nav + footer global ======
  if (!inSesiones) {
    // Asegura CSS global (si faltó en el HTML)
    const hasLayoutCss = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    ).some((l) => (l.getAttribute("href") || "").includes("layout.css"));
    if (!hasLayoutCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = base + "css/layout.css";
      document.head.appendChild(link);
    }

    // Nav compartido
    const navHtml = `
      <div class="wrap">
        <a class="qs-brand" href="${base}index.html"><span>Plataforma QS</span></a>
        <nav class="qs-tabs" aria-label="Navegación">
          <a class="qs-btn" href="${base}materiales.html">Materiales</a>
          <a class="qs-btn" href="${base}asistencia.html">Asistencia</a>
          <a class="qs-btn" href="${base}calificaciones.html">Calificaciones</a>
          <a class="qs-btn" href="${base}Foro.html">Foro</a>
          <a class="qs-btn" href="${base}paneldocente.html">Panel</a>
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
    const fname = (p.split("/").pop() || "index.html").toLowerCase();
    navEl.querySelectorAll(".qs-tabs a.qs-btn").forEach((a) => {
      const href = (a.getAttribute("href") || "")
        .split("/")
        .pop()
        .toLowerCase();
      if (href === fname) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    // Quita "Roadmap" de navs residuales
    document
      .querySelectorAll(".qs-tabs a, nav a, .navbar a, .topbar a")
      .forEach((a) => {
        const href = (a.getAttribute("href") || "").toLowerCase().trim();
        const txt = (a.textContent || "").toLowerCase().trim();
        if (href.endsWith("roadmap.html") || txt === "roadmap") a.remove();
      });

    // Padding-top según altura real del nav
    const pickNav = () =>
      document.querySelector('[data-role="main-nav"], .qs-nav, nav');
    const setPad = () => {
      const el = pickNav();
      const h = el ? el.getBoundingClientRect().height : 64;
      const safe = Math.min(Math.max(Math.round(h), 56), 96);
      document.documentElement.style.setProperty("--nav-h", safe + "px");
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

    // Footer compartido
    const year = new Date().getFullYear();
    const footerHtml = `<div class="footer-content">© ${year} Plataforma QS - Calidad de Software | Isaac Paniagua</div>`;
    let footer = document.querySelector("footer.footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "footer";
      document.body.appendChild(footer);
    }
    footer.innerHTML = footerHtml;
    return; // fin páginas normales
  }

  // ====== SESIONES: NO nav/footer global. Solo botón "Regresar al inicio" ======
  // No tocamos tu JS/CSS de la sesión. Conserva interacciones y navegación propia.

  // Botón fijo inferior-izquierda
  const back = document.createElement("a");
  back.href = base + "index.html";
  back.id = "btn-back-home";
  back.setAttribute("aria-label", "Regresar al inicio");
  back.title = "Regresar al inicio";
  back.textContent = "⟵ Inicio";
  Object.assign(back.style, {
    position: "fixed",
    left: "16px",
    bottom: "16px",
    zIndex: "950",
    padding: "8px 12px",
    borderRadius: "999px",
    textDecoration: "none",
    fontWeight: "700",
    background: "linear-gradient(135deg,#667eea,#764ba2)",
    color: "#fff",
    boxShadow: "0 6px 18px rgba(0,0,0,.2)",
    userSelect: "none",
  });
  document.body.appendChild(back);

  // Atajo de teclado: Alt+← o Backspace con no-input → regresar
  addEventListener("keydown", (e) => {
    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.isComposing) return;
    const go = () => {
      location.href = base + "index.html";
    };
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      go();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      go();
    }
  });
});
