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

    // Carga de guardia de autenticación para páginas con navegación global.
    // Inserta un script de tipo módulo que importa Firebase y redirige a login.html
    // si no hay usuario autenticado. Evita inyectar este guardia en la página de login
    // o en el error 404.
    try {
      const pg = (location.pathname.split('/').pop() || '').toLowerCase();
      if (pg !== 'login.html' && pg !== '404.html') {
        const guard = document.createElement('script');
        guard.type = 'module';
        guard.src = base + 'js/auth-guard.js';
        document.body.appendChild(guard);
      }
    } catch (_) {}

    // Inserta un botón de autenticación (iniciar/cerrar sesión) en la
    // navegación generada por layout.js.  Calcula la ruta base y utiliza
    // import dinámico para obtener las funciones de Firebase.  Se ejecuta
    // como módulo para disponer de 'await' y 'import'.
    try {
      const pg2 = (location.pathname.split('/').pop() || '').toLowerCase();
      if (pg2 !== 'login.html' && pg2 !== '404.html') {
        const signScr = document.createElement('script');
        signScr.type = 'module';
        signScr.textContent = `
          (async () => {
            // Compute prefix relative to current page to locate firebase.js
            const segs = window.location.pathname.split('/').filter(Boolean);
            let up = Math.max(segs.length - 2, 0);
            let prefix = '';
            for (let i = 0; i < up; i++) prefix += '../';
            // Use './js/firebase.js' when prefix is empty so that the import is treated as relative.
            const importPath = (prefix === '') ? './js/firebase.js' : (prefix + 'js/firebase.js');
            const firebaseModule = await import(importPath);
            const { onAuth, signInWithGoogleOpen, signOutCurrent } = firebaseModule;
            const navTabs = document.querySelector('.qs-tabs');
            if (!navTabs) return;
            let btn = navTabs.querySelector('.qs-auth-btn');
            if (!btn) {
              btn = document.createElement('button');
              btn.className = 'qs-btn qs-auth-btn';
              btn.style.marginLeft = '8px';
              navTabs.appendChild(btn);
            }
            onAuth((user) => {
              if (user) {
                btn.textContent = 'Cerrar sesión';
                btn.onclick = () => signOutCurrent();
              } else {
                btn.textContent = 'Iniciar sesión';
                btn.onclick = () => signInWithGoogleOpen();
              }
            });
          })().catch(console.error);
        `;
        document.body.appendChild(signScr);
      }
    } catch (_) {}
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

  // Agregar botón de autenticación en las páginas de sesiones. Este botón
  // permite iniciar sesión con Google o cerrar sesión y se sitúa en la
  // esquina inferior derecha. Al igual que en las páginas con navegación
  // global, se calcula un prefijo relativo para importar firebase.js.
  try {
    const authScript = document.createElement('script');
    authScript.type = 'module';
    authScript.textContent = `
      (async () => {
        const segs = window.location.pathname.split('/').filter(Boolean);
        let up = Math.max(segs.length - 2, 0);
        let prefix = '';
        for (let i = 0; i < up; i++) prefix += '../';
        const importPath = (prefix === '') ? './js/firebase.js' : (prefix + 'js/firebase.js');
        const { onAuth, signInWithGoogleOpen, signOutCurrent } = await import(importPath);
        const btn = document.createElement('button');
        btn.className = 'qs-btn qs-auth-btn';
        btn.style.position = 'fixed';
        btn.style.right = '16px';
        btn.style.bottom = '16px';
        btn.style.zIndex = '950';
        btn.style.padding = '8px 12px';
        btn.style.borderRadius = '999px';
        btn.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
        btn.style.color = '#fff';
        btn.style.boxShadow = '0 6px 18px rgba(0,0,0,.2)';
        document.body.appendChild(btn);
        onAuth((user) => {
          if (user) {
            btn.textContent = 'Cerrar sesión';
            btn.onclick = () => signOutCurrent();
          } else {
            btn.textContent = 'Iniciar sesión';
            btn.onclick = () => signInWithGoogleOpen();
          }
        });
      })().catch(console.error);
    `;
    document.body.appendChild(authScript);
  } catch (_) {}

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
