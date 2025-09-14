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

// === Controles de slides SOLO en sesiones ===
document.addEventListener("DOMContentLoaded", () => {
  // Guard: solo en /sesiones/ o archivos sesion*.html
  const p = location.pathname.toLowerCase();
  const isSesion =
    p.includes("/sesiones/") || /(^|\/)sesion[\w-]*\.html$/.test(p);
  if (!isSesion || window.__qsSlidesInit) return;
  window.__qsSlidesInit = true;

  // Quita controles sueltos que queden pegados al NAV
  const navHVal = () =>
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
    ) || 64;
  document.querySelectorAll("#prevSlide, #nextSlide").forEach((btn) => {
    const inOurCtrl = btn.closest(".slide-ctrls");
    if (inOurCtrl) return;
    const top = btn.getBoundingClientRect().top;
    const nearTop = top < navHVal() + 24;
    const inTopBar = btn.closest(".qs-nav, .topbar, header, nav");
    if (nearTop || inTopBar) btn.remove();
  });

  // Detecta slides sin imponer estructura
  const slides = document.querySelectorAll(
    '[data-slide], .slide, section[id^="slide"]'
  );
  if (slides.length < 2) return; // no crear controles si no hay deck

  // Contenedor de controles
  const ctrl = document.createElement("div");
  ctrl.className = "slide-ctrls";
  Object.assign(ctrl.style, {
    position: "fixed",
    right: "16px",
    zIndex: "950",
    display: "flex",
    gap: "10px",
  });

  // Botón base con estilo solicitado
  const baseCss =
    "border:0;border-radius:999px;width:36px;height:36px;cursor:pointer;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:700";

  const prev = document.createElement("button");
  prev.id = "prevSlide";
  prev.title = "Anterior";
  prev.setAttribute("aria-label", "Anterior");
  prev.textContent = "◀";
  prev.style.cssText = baseCss;

  const next = document.createElement("button");
  next.id = "nextSlide";
  next.title = "Siguiente";
  next.setAttribute("aria-label", "Siguiente");
  next.textContent = "▶";
  next.style.cssText = baseCss;

  ctrl.append(prev, next);
  document.body.appendChild(ctrl);

  // Posición: pegado encima del footer
  const place = () => {
    const footer = document.querySelector("footer.footer");
    const fh = footer ? footer.getBoundingClientRect().height : 56;
    ctrl.style.bottom = fh + 12 + "px";
  };
  place();
  addEventListener("resize", place);
  if (window.ResizeObserver) {
    const f = document.querySelector("footer.footer");
    if (f) new ResizeObserver(place).observe(f);
  }

  // Navegación
  const currentIdx = () => {
    const y = scrollY + navHVal() + 10;
    let idx = 0,
      best = Infinity;
    slides.forEach((el, i) => {
      const top = el.getBoundingClientRect().top + scrollY;
      const d = Math.abs(top - y);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return idx;
  };
  const goTo = (i) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const top = slides[i].getBoundingClientRect().top + scrollY - navHVal() - 8;
    scrollTo({ top, behavior: "smooth" });
  };

  prev.addEventListener("click", () => goTo(currentIdx() - 1));
  next.addEventListener("click", () => goTo(currentIdx() + 1));

  // Teclas: ← → PageUp PageDown (no en inputs)
  addEventListener("keydown", (e) => {
    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.isComposing) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev.click();
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      next.click();
    }
  });
});
