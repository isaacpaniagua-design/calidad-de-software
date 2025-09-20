// Refleja el rol almacenado lo antes posible para controlar los elementos
// marcados como `teacher-only` antes de que se renderice el contenido.
(function syncRoleFromStorage(){
  try {
    const root = document.documentElement;
    if (!root) return;
    const stored = localStorage.getItem("qs_role");
    root.classList.remove("role-teacher", "role-student");
    if (stored === "docente") root.classList.add("role-teacher");
    else if (stored) root.classList.add("role-student");
  } catch (_) {}
})();

function getStoredAuthState() {
  const key = 'qs_auth_state';
  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  } catch (_) {}
  try {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.__qsAuthState) {
      return window.__qsAuthState;
    }
  } catch (_) {}
  return '';
}

function applyInitialAuthAppearance(navEl) {
  if (!navEl) return;
  try {
    const actions = navEl.querySelector('.qs-actions');
    if (!actions) return;
    const defaultLink = actions.querySelector('[data-default-auth-link]');
    if (!defaultLink) return;
    const state = getStoredAuthState();
    const isSignedIn = state === 'signed-in';
    const text = isSignedIn ? 'Cerrar sesión' : 'Iniciar sesión';
    defaultLink.textContent = text;
    defaultLink.setAttribute('aria-label', text);
    defaultLink.title = text;
    defaultLink.setAttribute('data-awaiting-auth', isSignedIn ? 'signed-in' : 'signed-out');
    if (isSignedIn && !defaultLink.__qsAwaitPrevent) {
      defaultLink.__qsAwaitPrevent = true;
      defaultLink.addEventListener('click', (evt) => {
        try { evt.preventDefault(); } catch (_) {}
      });
    }
  } catch (_) {}
}

function initLayout() {
  const p = location.pathname;
  const pLow = p.toLowerCase();
  const inSesiones =
    /(^|\/)sesiones\//.test(pLow) || /(^|\/)sesion[\w-]*\.html$/.test(pLow);
  const base = inSesiones ? "../" : "";

  // Asegura un favicon para evitar errores 404 en navegadores.
  try {
    const hasIcon = document.querySelector("link[rel*='icon']");
    if (!hasIcon) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.href = base + "favicon.ico";
      document.head.appendChild(icon);
    }
  } catch (_) {}

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
    const NAV_VERSION = '2024-11-revamp';
    const navHtml = `
      <div class="wrap">
        <a class="qs-brand" href="${base}index.html">
          <span class="qs-logo">QS</span>
          <span class="qs-brand-text">
            <span class="qs-title">Plataforma QS</span>
            <span class="qs-subtitle">Calidad de Software</span>
          </span>
        </a>
        <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">
          <span class="qs-menu-icon" aria-hidden="true"></span>
          <span class="sr-only">Abrir menú</span>
        </button>
        <div class="qs-links-region">
          <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegación principal">
            <a class="qs-btn" href="${base}materiales.html">Materiales</a>
            <a class="qs-btn" href="${base}asistencia.html">Asistencia</a>
            <a class="qs-btn" href="${base}calificaciones.html">Calificaciones</a>
            <a class="qs-btn" href="${base}Foro.html">Foro</a>
            <a class="qs-btn teacher-only" href="${base}paneldocente.html">Panel</a>
          </nav>
          <div class="qs-actions" data-auth-slot>
            <a class="qs-cta" href="${base}login.html" data-default-auth-link>Iniciar sesión</a>
          </div>
        </div>
      </div>`;

    let navEl = document.querySelector(".qs-nav, [data-role='main-nav']");
    if (!navEl) {
      navEl = document.createElement("div");
      navEl.className = "qs-nav";
      document.body.prepend(navEl);
    }
    navEl.setAttribute("data-role", "main-nav");
    const version = navEl.getAttribute("data-nav-version");
    if (
      !navEl.children.length ||
      !navEl.querySelector(".qs-brand") ||
      !navEl.querySelector(".qs-tabs") ||
      version !== NAV_VERSION
    ) {
      navEl.innerHTML = navHtml;
      navEl.setAttribute("data-nav-version", NAV_VERSION);
    }

    applyInitialAuthAppearance(navEl);

    const ensureToggle = (navNode) => {
      if (!navNode || navNode.__qsToggleBound) return;
      const toggle = navNode.querySelector(".qs-menu-toggle");
      const region = navNode.querySelector(".qs-links-region");
      if (!toggle || !region) return;
      navNode.__qsToggleBound = true;
      const setState = (open) => {
        if (open) navNode.classList.add("is-open");
        else navNode.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        region.setAttribute("data-open", open ? "true" : "false");
      };
      setState(false);
      toggle.addEventListener("click", () => {
        setState(!navNode.classList.contains("is-open"));
      });
      region.addEventListener("click", (evt) => {
        const anchor = evt.target?.closest?.("a[href]");
        if (anchor) setState(false);
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth > 960) setState(false);
      });
    };
    if (typeof window.setupQsNavToggle !== "function") {
      window.setupQsNavToggle = ensureToggle;
    }
    (window.setupQsNavToggle || ensureToggle)(navEl);

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
            const { onAuth, signInWithGoogleOpen, signOutCurrent, isTeacherEmail, isTeacherByDoc } = firebaseModule;
            const navTabs = document.querySelector('.qs-tabs');
            const actions = document.querySelector('.qs-actions');
            if (!navTabs || !actions) return;
            const defaultLink = actions.querySelector('[data-default-auth-link]');
            if (defaultLink) defaultLink.remove();
            const existingButtons = Array.from(actions.querySelectorAll('.qs-auth-btn'));
            let btn = existingButtons[0] || null;
            if (existingButtons.length > 1) {
              for (let i = 1; i < existingButtons.length; i++) {
                existingButtons[i].remove();
              }
            }
            if (!btn) {
              btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'qs-cta qs-auth-btn';
              actions.appendChild(btn);
            }
            const panelLink = navTabs.querySelector('a[href$="paneldocente.html"]');

            const AUTH_STORAGE_KEY = 'qs_auth_state';
            const readStoredAuthState = () => {
              try {
                const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
                if (sessionValue) return sessionValue;
              } catch (_) {}
              try {
                const localValue = localStorage.getItem(AUTH_STORAGE_KEY);
                if (localValue) return localValue;
              } catch (_) {}
              try {
                if (window.__qsAuthState) return window.__qsAuthState;
              } catch (_) {}
              return '';
            };

            const persistAuthState = (state) => {
              try { sessionStorage.setItem(AUTH_STORAGE_KEY, state); } catch (_) {}
              try { localStorage.setItem(AUTH_STORAGE_KEY, state); } catch (_) {}
              try { window.__qsAuthState = state; } catch (_) {}
            };

            const setSignInAppearance = () => {
              btn.textContent = 'Iniciar sesión';
              btn.setAttribute('aria-label', 'Iniciar sesión');
              btn.title = 'Iniciar sesión';
            };
            const setSignOutAppearance = () => {
              btn.textContent = 'Cerrar sesión';
              btn.setAttribute('aria-label', 'Cerrar sesión');
              btn.title = 'Cerrar sesión';
            };

            const applyStateAppearance = (state) => {
              if (state === 'signed-in') {
                setSignOutAppearance();
                btn.onclick = () => signOutCurrent();
              } else {
                setSignInAppearance();
                btn.onclick = () => signInWithGoogleOpen();
              }
            };

            applyStateAppearance(readStoredAuthState());
            onAuth(async (user) => {

              if (user) {
                persistAuthState('signed-in');
                setSignOutAppearance();
                btn.onclick = () => signOutCurrent();
                let canSeePanel = false;
                try {
                  canSeePanel = isTeacherEmail(user.email) || (await isTeacherByDoc(user.uid));
                } catch (_) {
                  canSeePanel = false;
                }

                if (panelLink) panelLink.style.display = canSeePanel ? '' : 'none';
              } else {
                persistAuthState('signed-out');
                setSignInAppearance();
                btn.onclick = () => signInWithGoogleOpen();

                if (panelLink) panelLink.style.display = 'none';
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
          const root = document.documentElement;
          if (user) {
            btn.textContent = 'Cerrar sesión';
            btn.onclick = () => signOutCurrent();
            if (root) {
              root.classList.add('role-teacher');
              root.classList.remove('role-student');
            }
          } else {
            btn.textContent = 'Iniciar sesión';
            btn.onclick = () => signInWithGoogleOpen();
            if (root) {
              root.classList.remove('role-teacher');
              root.classList.add('role-student');
            }
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLayout, { once: true });
} else {
  initLayout();
}
