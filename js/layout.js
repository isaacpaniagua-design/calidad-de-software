// Inicializa el layout global de la plataforma QS.
// Se encarga de inyectar/normalizar la barra de navegación, footer y rutinas
// auxiliares que dependen del estado de autenticación.
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
    } else if (storedRole) {
      root.classList.add("role-student");
    }
  } catch (_) {}
})();

function bootstrapLayout() {
  if (window.__qsLayoutBooted) return;
  window.__qsLayoutBooted = true;

  const NAV_VERSION = "2024.12.clean";
  const FOOTER_VERSION = "2024.12.clean";
  const AUTH_STORAGE_KEY = "qs_auth_state";
  const ROLE_STORAGE_KEY = "qs_role";

  const doc = document;
  const html = doc.documentElement;
  const body = doc.body;
  const currentPage = (location.pathname.split("/").pop() || "").toLowerCase();
  const isLogin = currentPage === "login.html";
  const isNotFound = currentPage === "404.html";

  if (body) body.classList.add("qs-layout");

  const basePath = computeBasePath();
  ensureStyles(basePath);

  const nav = ensureNavigation(basePath);
  const footer = ensureFooter();

  toggleTeacherNavLinks(html.classList.contains("role-teacher"));
  observeRoleClassChanges();

  updateAuthAppearance(nav, readStoredAuthState());
  bindNavAuthRedirect(nav);
  setupNavToggle(nav);
  highlightActiveLink(nav, currentPage);
  refreshNavSpacing(nav);
  observeNavHeight(nav);

  if (!isLogin && !isNotFound) {
    injectAuthGuard(basePath);
    injectAuthIntegration(basePath, nav);
  }

  window.QSLayout = Object.freeze({
    nav,
    footer,
    refreshSpacing: () => refreshNavSpacing(nav),
  });

  window.__qsLayoutReadAuthState = readStoredAuthState;
  window.__qsLayoutPersistAuthState = persistAuthState;
  window.__qsLayoutPersistRole = persistRole;
  window.__qsLayoutToggleTeacherNavLinks = toggleTeacherNavLinks;


  function computeBasePath() {
    try {
      const script =
        doc.currentScript || doc.querySelector("script[src*='layout.js']");
      if (!script) return "";
      const rawSrc = script.getAttribute("src") || "";
      const resolved = new URL(rawSrc, location.href);
      const parts = resolved.pathname.split("/").filter(Boolean);
      if (parts.length) parts.pop();
      const rootParts = parts.length ? parts.slice(0, -1) : [];
      const pageParts = location.pathname
        .split("/")
        .filter(Boolean)
        .slice(0, -1);
      const from = pageParts.slice();
      const to = rootParts.slice();
      while (from.length && to.length && from[0] === to[0]) {
        from.shift();
        to.shift();
      }
      const ups = new Array(from.length).fill("..");
      const downs = to;
      const prefix = ups.concat(downs).join("/");
      return prefix ? prefix + "/" : "";
    } catch (_) {
      return "";
    }
  }


        <a class="qs-brand" href="${base}index.html">
          <span class="qs-logo" aria-hidden="true">QS</span>
          <span class="qs-brand-text">
            <span class="qs-title">Plataforma QS</span>
            <span class="qs-subtitle">Calidad de Software</span>
          </span>
        </a>
        <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">
          <span class="qs-menu-icon" aria-hidden="true"></span>
          <span class="sr-only">Abrir menú</span>
        </button>
        <div class="qs-links-region" data-open="false">
          <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegación principal">
            <a class="qs-btn" href="${base}materiales.html">Materiales</a>
            <a class="qs-btn" href="${base}asistencia.html">Asistencia</a>
            <a class="qs-btn" href="${base}calificaciones.html">Calificaciones</a>
            <a class="qs-btn" href="${base}Foro.html">Foro</a>
            <a
              class="qs-btn teacher-only"
              data-route="panel"
              href="${base}paneldocente.html"
              hidden
              aria-hidden="true"
            >Panel</a>
          </nav>
        </div>
      </div>`;



    if (!nav) {
      nav = doc.createElement("nav");
      nav.className = "qs-nav";
      nav.setAttribute("data-role", "main-nav");
      nav.setAttribute("data-nav-version", NAV_VERSION);
      nav.innerHTML = template;
      body.prepend(nav);
    } else {
      nav.classList.add("qs-nav");
      if (nav.getAttribute("data-nav-version") !== NAV_VERSION) {
        nav.innerHTML = template;
        nav.setAttribute("data-nav-version", NAV_VERSION);
      }
    }

    }
  }


    }
    footer.classList.add("qs-footer");
    footer.setAttribute("data-footer-version", FOOTER_VERSION);
    footer.innerHTML = markup;
    return footer;
  }


      }
    });
  }



  function observeNavHeight(nav) {
    if (!nav || !window.ResizeObserver) return;
    const observer = new ResizeObserver(() => refreshNavSpacing(nav));
    observer.observe(nav);
  }

  function shouldBypassAuth(href) {
    if (!href) return true;
    const trimmed = href.trim();
    if (!trimmed) return true;
    const lower = trimmed.split("#")[0].split("?")[0].toLowerCase();
    if (!lower) return true;
    if (lower === "login.html" || lower === "404.html") return true;
    if (/^https?:\/\//.test(trimmed)) return true;
    if (trimmed.startsWith("#")) return true;
    if (trimmed.startsWith("mailto:")) return true;
    if (trimmed.startsWith("tel:")) return true;
    return false;
  }

  function bindNavAuthRedirect(nav) {
    if (!nav || nav.__qsAuthRedirect) return;
    nav.__qsAuthRedirect = true;
    nav.addEventListener(
      "click",
      (evt) => {
        try {
          const anchor =
            evt.target && evt.target.closest
              ? evt.target.closest("a[href]")
              : null;
          if (!anchor) return;
          if (!nav.contains(anchor)) return;
          const href = anchor.getAttribute("href") || "";
          if (shouldBypassAuth(href)) return;
          const state = readStoredAuthState();
          if (state && state !== "signed-in" && state !== "unknown") {
            evt.preventDefault();
            location.href = `${basePath}login.html`;
          }
        } catch (_) {}
      },
      true,
    );
  }

  function readStoredAuthState() {
    try {
      const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (sessionValue) return sessionValue;
    } catch (_) {}
    try {
      const localValue = localStorage.getItem(AUTH_STORAGE_KEY);
      if (localValue) return localValue;
    } catch (_) {}
    if (window.__qsAuthState) return window.__qsAuthState;
    return "unknown";
  }

  function persistAuthState(state) {
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, state);
    } catch (_) {}
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, state);
    } catch (_) {}
    window.__qsAuthState = state;
  }

  function persistRole(role) {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch (_) {}
    toggleTeacherNavLinks(role === "docente");
  }

  function updateAuthAppearance(nav, state) {
    if (!nav) return;
    try {
      const actions = nav.querySelector(".qs-actions");
      if (!actions) return;
      const defaultLink = actions.querySelector("[data-default-auth-link]");
      if (!defaultLink) return;
      if (state === "signed-in") {
        defaultLink.textContent = "Cerrar sesión";
        defaultLink.setAttribute("aria-label", "Cerrar sesión");
        defaultLink.title = "Cerrar sesión";
        defaultLink.setAttribute("data-awaiting-auth", "signed-in");
      } else {
        defaultLink.textContent = "Iniciar sesión";
        defaultLink.setAttribute("aria-label", "Iniciar sesión");
        defaultLink.title = "Iniciar sesión";
        defaultLink.setAttribute("data-awaiting-auth", "signed-out");
      }
    } catch (_) {}
  }

  function toggleTeacherNavLinks(isTeacher) {
    try {
      const links = nav ? nav.querySelectorAll("[data-route='panel']") : [];
      links.forEach((link) => {
        if (!link) return;
        if (isTeacher) {
          link.removeAttribute("hidden");
          link.removeAttribute("aria-hidden");
        } else {
          link.setAttribute("hidden", "hidden");
          link.setAttribute("aria-hidden", "true");
        }
      });
    } catch (_) {}
  }

  function observeRoleClassChanges() {
    if (!html || !window.MutationObserver) return;
    try {
      const observer = new MutationObserver(() => {
        toggleTeacherNavLinks(html.classList.contains("role-teacher"));
      });
      observer.observe(html, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch (_) {}
  }


          }
          persistRole(isTeacher ? 'docente' : 'estudiante');
          applyRole(isTeacher);
          showPanel(isTeacher);
        } else {
          persistAuth('signed-out');
          setSignIn();
          showPanel(false);
          persistRole('estudiante');
          applyRole(false);
        }
      });
    `;

}

function ensureLoadingOverlay() {
  try {
    const doc = document;
    if (!doc) return;
    if (doc.querySelector("[data-qs-loader]")) return;
    const overlay = doc.createElement("div");
    overlay.className = "qs-loading-overlay";
    overlay.setAttribute("data-qs-loader", "true");
    overlay.innerHTML = `
      <div class="qs-loading-card" role="status" aria-live="polite" aria-busy="true">
        <span class="qs-loading-spinner" aria-hidden="true"></span>
        <p class="qs-loading-text">Cargando plataforma…</p>
      </div>
    `;
    const target = doc.body || doc.documentElement;
    target.appendChild(overlay);
  } catch (_) {}
}

function markLayoutReady() {
  try {
    const root = document.documentElement;
    if (root) {
      root.classList.remove("qs-loading");
      root.classList.add("qs-loaded");
    }
    const loader = document.querySelector("[data-qs-loader]");
    if (loader && !loader.hasAttribute("data-qs-loader-dismissed")) {
      loader.setAttribute("data-qs-loader-dismissed", "true");
      const hide = () => {
        loader.classList.add("is-hidden");
        window.setTimeout(() => {
          try {
            loader.remove();
          } catch (_) {}
        }, 320);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(hide);
      } else {
        hide();
      }
    }
  } catch (_) {}
}

window.addEventListener("load", markLayoutReady, { once: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapLayout, {
    once: true,
  });
} else {
  bootstrapLayout();
}
