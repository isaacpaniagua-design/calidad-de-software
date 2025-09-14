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

  // Quitar "Roadmap" de navs residuales
  document
    .querySelectorAll(".qs-tabs a, nav a, .navbar a, .topbar a")
    .forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase().trim();
      const txt = (a.textContent || "").toLowerCase().trim();
      if (href.endsWith("roadmap.html") || txt === "roadmap") a.remove();
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

// === Controles y saneo SOLO en sesiones ===
document.addEventListener("DOMContentLoaded", () => {
  // Guard: solo en /sesiones/ o archivos sesion*.html
  const p = location.pathname.toLowerCase();
  const isSesion =
    p.includes("/sesiones/") || /(^|\/)sesion[\w-]*\.html$/.test(p);
  if (!isSesion || window.__qsSlidesInit) return;
  window.__qsSlidesInit = true;

  const navHVal = () =>
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
    ) || 64;

  // 1) Oculta navs locales pegados arriba o con z alto
  (function demoteSessionNav() {
    document
      .querySelectorAll(
        "body > nav:not(.qs-nav), header > nav:not(.qs-nav), .topbar"
      )
      .forEach((el) => {
        const cs = getComputedStyle(el);
        const top = el.getBoundingClientRect().top;
        const isTopish = top < navHVal() + 24;
        const z = parseInt(cs.zIndex || "0", 10);
        const isOverlay =
          cs.position === "fixed" || cs.position === "sticky" || z >= 900;
        if (isTopish || isOverlay) {
          el.classList.add("legacy-nav");
          el.style.display = "none";
          el.style.position = "static";
          el.style.zIndex = "auto";
          el.style.marginTop = `calc(var(--nav-h) + 8px)`;
        }
      });
    // Oculta footers locales duplicados
    document
      .querySelectorAll("body > footer:not(.footer)")
      .forEach((f) => (f.style.display = "none"));
  })();

  // 2) Oculta encabezados locales de slides (prev/next/currentSlide) pegados al NAV
  (function hideLegacySlideHeader() {
    const nodes = document.querySelectorAll(
      '#prevBtn, #nextBtn, #currentSlide, button[onclick*="previousSlide"], button[onclick*="nextSlide"]'
    );
    if (!nodes.length) return;

    let header = null;
    nodes.forEach((n) => {
      const p = n.closest("div, header, nav, section") || n.parentElement;
      if (!p) return;
      if (!header) header = p;
      else if (!header.contains(n)) {
        let a = header;
        while (a && !a.contains(n)) a = a.parentElement;
        if (a) header = a;
      }
    });
    if (!header) return;

    const nearTop = header.getBoundingClientRect().top < navHVal() + 24;
    if (nearTop) {
      header.classList.add("legacy-nav");
      header.style.display = "none";
    }
  })();

  // 3) Detecta slides sin imponer estructura
  const slides = document.querySelectorAll(
    '[data-slide], .slide, section[id^="slide"]'
  );
  if (slides.length < 2) return; // no crear controles si no hay deck

  // 4) Controles fijos ◀ ▶
  const ctrl = document.createElement("div");
  ctrl.className = "slide-ctrls";
  Object.assign(ctrl.style, {
    position: "fixed",
    right: "16px",
    zIndex: "950",
    display: "flex",
    gap: "10px",
  });

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

  // 5) Posición: pegado encima del footer
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

  // 6) Navegación
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
