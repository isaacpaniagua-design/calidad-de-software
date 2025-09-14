document.addEventListener("DOMContentLoaded", () => {
  // Asegura CSS compartido (elige base por carpeta)
  const inSesiones = location.pathname.toLowerCase().includes("/sesiones/");
  const cssHref = (inSesiones ? "../" : "") + "css/layout.css";
  const hasLayoutCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(l => (l.getAttribute("href") || "").includes("layout.css"));
  if (!hasLayoutCss) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  // Build shared nav
  const navHtml = `
    <div class="wrap">
      <a class="qs-brand" href="${inSesiones ? '../' : ''}index.html"><span>Plataforma QS</span></a>
      <nav class="qs-tabs" aria-label="Navegación">
        <a class="qs-btn" href="${inSesiones ? '../' : ''}materiales.html">Materiales</a>
        <a class="qs-btn" href="${inSesiones ? '../' : ''}asistencia.html">Asistencia</a>
        <a class="qs-btn" href="${inSesiones ? '../' : ''}calificaciones.html">Calificaciones</a>
        <a class="qs-btn" href="${inSesiones ? '../' : ''}Foro.html">Foro</a>
        <a class="qs-btn" href="${inSesiones ? '../' : ''}paneldocente.html">Panel</a>
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
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  navEl.querySelectorAll(".qs-tabs a.qs-btn").forEach(a => {
    const href = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
    if (href === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  // Quitar "Roadmap" de navs residuales
  document.querySelectorAll(".qs-tabs a, nav a, .navbar a, .topbar a").forEach(a=>{
    const href = (a.getAttribute("href")||"").toLowerCase().trim();
    const txt  = (a.textContent||"").toLowerCase().trim();
    if (href.endsWith("roadmap.html") || txt === "roadmap") a.remove();
  });

  // Padding-top via CSS var
  const pickNav = () => document.querySelector('[data-role="main-nav"], .qs-nav, nav');
  const setPad = () => {
    const el = pickNav();
    const h  = el ? el.getBoundingClientRect().height : 64;
    const safe = Math.min(Math.max(Math.round(h), 56), 96);
    document.documentElement.style.setProperty("--nav-h", safe + "px");
    document.body.style.removeProperty("padding-top");
    if (el) { el.style.marginTop = "0"; el.style.marginBottom = "0"; }
  };
  setPad();
  addEventListener("resize", setPad);
  if (window.ResizeObserver) {
    const obEl = pickNav();
    if (obEl) new ResizeObserver(setPad).observe(obEl);
  }

  // Footer autogenerado
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
  const p = location.pathname.toLowerCase();
  const isSesion = p.includes("/sesiones/") || /(^|\/)sesion[\w-]*\.html$/.test(p);
  if (!isSesion || window.__qsSlidesInit) return;
  window.__qsSlidesInit = true;

  const navHVal = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;

  // 1) Oculta navs locales pegados arriba o con z alto
  (function demoteSessionNav(){
    document.querySelectorAll("body > nav:not(.qs-nav), header > nav:not(.qs-nav), .topbar").forEach(el=>{
      const cs = getComputedStyle(el);
      const top = el.getBoundingClientRect().top;
      const isTopish = top < navHVal() + 24;
      const z = parseInt(cs.zIndex || "0", 10);
      const isOverlay = cs.position === "fixed" || cs.position === "sticky" || z >= 900;
      if (isTopish || isOverlay) {
        el.classList.add("legacy-nav");
        el.style.display = "none";
        el.style.position = "static";
        el.style.zIndex = "auto";
        el.style.marginTop = `calc(var(--nav-h) + 8px)`;
      }
    });
    // Oculta footers locales duplicados
    document.querySelectorAll("body > footer:not(.footer)").forEach(f => f.style.display = "none");
  })();

  // 2) Oculta encabezados locales de slides pegados al NAV
  (function hideLegacySlideHeader(){
    const nodes = document.querySelectorAll('#prevBtn, #nextBtn, #currentSlide, button[onclick*="previousSlide"], button[onclick*="nextSlide"]');
    if (!nodes.length) return;
    let header = null;
    nodes.forEach(n=>{
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
    if (nearTop) { header.classList.add("legacy-nav"); header.style.display = "none"; }
  })();

  // 3) Detecta slides
  const slides = document.querySelectorAll('[data-slide], .slide, section[id^="slide"], div[id^="slide"]');
  const hasDeck = slides.length >= 2;

  // 4) Enganche con API local si existe
  const hasShow = typeof window.showSlide === "function";
  const hasNext = typeof window.nextSlide === "function";
  const hasPrev = typeof window.previousSlide === "function";

  // Lectura de índice actual desde #currentSlide si existe
  const readCurrentFromDom = () => {
    const t = document.getElementById("currentSlide")?.textContent || "";
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n - 1 : null;
  };

  // Fallback: calcular por scroll
  const computeIdxByScroll = () => {
    const y = scrollY + navHVal() + 10;
    let idx = 0, best = Infinity;
    slides.forEach((el, i) => {
      const top = el.getBoundingClientRect().top + scrollY;
      const d = Math.abs(top - y);
      if (d < best){ best = d; idx = i; }
    });
    return idx;
  };

  const currentIdx = () => {
    const byDom = readCurrentFromDom();
    if (byDom !== null) return byDom;
    if (hasDeck) return computeIdxByScroll();
    return 0;
  };

  const goTo = (i) => {
    if (hasShow) { window.showSlide(i + 1); return; }
    if (!hasDeck) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    const top = slides[i].getBoundingClientRect().top + scrollY - navHVal() - 8;
    scrollTo({ top, behavior: "smooth" });
  };

  // 5) Controles fijos ◀ ▶
  const ctrl = document.createElement("div");
  ctrl.className = "slide-ctrls";
  Object.assign(ctrl.style, { position:"fixed", right:"16px", zIndex:"950", display:"flex", gap:"10px" });

  const baseCss = "border:0;border-radius:999px;width:36px;height:36px;cursor:pointer;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:700";

  const prev = document.createElement("button");
  prev.id = "prevSlide"; prev.title = "Anterior"; prev.setAttribute("aria-label","Anterior"); prev.textContent = "◀"; prev.style.cssText = baseCss;

  const next = document.createElement("button");
  next.id = "nextSlide"; next.title = "Siguiente"; next.setAttribute("aria-label","Siguiente"); next.textContent = "▶"; next.style.cssText = baseCss;

  ctrl.append(prev, next);
  document.body.appendChild(ctrl);

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

  // Clicks: usar API local si está, si no, fallback
  prev.addEventListener("click", () => {
    if (hasPrev) { window.previousSlide(); return; }
    goTo(currentIdx() - 1);
  });
  next.addEventListener("click", () => {
    if (hasNext) { window.nextSlide(); return; }
    goTo(currentIdx() + 1);
  });

  // Teclas: ← → PageUp PageDown
  addEventListener("keydown", (e) => {
    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.isComposing) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp"){ e.preventDefault(); prev.click(); }
    if (e.key === "ArrowRight" || e.key === "PageDown"){ e.preventDefault(); next.click(); }
  });
});
