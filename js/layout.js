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
  const rawPage = (location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage || "index.html";
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

  function ensureStyles(base) {
    try {
      const hasLayoutCss = Array.from(
        doc.querySelectorAll("link[rel='stylesheet']")
      ).some((link) => {
        const href = link.getAttribute("href") || "";
        return /(^|\/)css\/layout\.css(\?|#|$)/.test(href);
      });
      if (hasLayoutCss) return;
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = `${base || ""}css/layout.css`;
      link.setAttribute("data-qs", "layout-style");
      doc.head.appendChild(link);
    } catch (_) {}
  }

  function ensureNavigation(base) {
    try {
      const navTemplate = createNavTemplate(base || "");
      let nav =
        doc.querySelector(".qs-nav[data-role='main-nav']") ||
        doc.querySelector("[data-role='main-nav']");
      if (!nav) {
        nav = doc.createElement("nav");
        if (body && body.firstChild) {
          body.insertBefore(nav, body.firstChild);
        } else if (body) {
          body.appendChild(nav);
        }
      }
      nav.classList.add("qs-nav");
      nav.setAttribute("data-role", "main-nav");
      const version = nav.getAttribute("data-nav-version");
      if (version !== NAV_VERSION) {
        nav.innerHTML = navTemplate;
        nav.setAttribute("data-nav-version", NAV_VERSION);
      } else if (!nav.children.length) {
        nav.innerHTML = navTemplate;
      }
      return nav;
    } catch (_) {
      return null;
    }
  }

  function createNavTemplate(base) {
    return `
      <div class="wrap">
        <div class="qs-brand-shell">
          <div class="qs-brand-region">
            <a class="qs-brand" href="${base}index.html">
              <span class="qs-logo" aria-hidden="true">QS</span>
              <span class="qs-brand-text">
                <span class="qs-title">Plataforma QS</span>
                <span class="qs-subtitle">Calidad de Software</span>
              </span>
            </a>
            <span class="qs-chip">Edición 2024</span>
          </div>
          <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">
            <span class="qs-menu-icon" aria-hidden="true"></span>
            <span class="sr-only">Abrir menú</span>
          </button>
        </div>
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
          <div class="qs-actions">
            <a class="qs-cta" href="${base}login.html" data-default-auth-link>Iniciar sesión</a>
          </div>
        </div>
      </div>
    `;
  }

  function ensureFooter() {
    try {
      const year = new Date().getFullYear();
      const markup = `
        <div class="qs-footer-content">
          © ${year} · Plataforma QS - Calidad de Software | Isaac Paniagua
        </div>
      `;
      let footer =
        doc.querySelector("footer[data-footer-version]") ||
        doc.querySelector(".qs-footer") ||
        doc.querySelector("footer.footer");
      if (!footer) {
        footer = doc.createElement("footer");
        if (body) body.appendChild(footer);
      }
      footer.classList.add("qs-footer");
      const previousVersion = footer.getAttribute("data-footer-version");
      if (previousVersion !== FOOTER_VERSION || !footer.innerHTML.trim()) {
        footer.innerHTML = markup;
      }
      footer.setAttribute("data-footer-version", FOOTER_VERSION);
      return footer;
    } catch (_) {
      return null;
    }
  }

  function injectAuthGuard(base) {
    try {
      if (doc.querySelector("script[data-qs='auth-guard']")) return;
      const script = doc.createElement("script");
      script.type = "module";
      script.src = `${base || ""}js/auth-guard.js`;
      script.defer = true;
      script.setAttribute("data-qs", "auth-guard");
      doc.body.appendChild(script);
    } catch (_) {}
  }

  function injectAuthIntegration(base, navEl) {
    try {
      if (doc.querySelector("script[data-qs='auth-integration']")) return;
      const script = doc.createElement("script");
      script.type = "module";
      script.setAttribute("data-qs", "auth-integration");
      const importPath = `${base || ""}js/firebase.js`;
      const navVersion = NAV_VERSION.replace(/`/g, "");
      script.textContent = `
        (async () => {
          const {
            onAuth,
            signInWithGoogleOpen,
            signOutCurrent,
            isTeacherEmail,
            isTeacherByDoc
          } = await import('${importPath.replace(/'/g, "\\'")}');

          const nav = document.querySelector('.qs-nav[data-nav-version="${navVersion}"]') || document.querySelector('.qs-nav[data-role="main-nav"]') || document.querySelector('.qs-nav');
          if (!nav) return;
          const actions = nav.querySelector('.qs-actions');
          if (!actions) return;

          const defaultLink = actions.querySelector('[data-default-auth-link]');
          if (defaultLink) defaultLink.remove();

          let button = actions.querySelector('.qs-auth-btn');
          if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'qs-cta qs-auth-btn';
            actions.appendChild(button);
          }

          const panelLink = nav.querySelector('[data-route="panel"]');
          const readAuth = window.__qsLayoutReadAuthState || (() => 'unknown');
          const persistAuth = window.__qsLayoutPersistAuthState || (() => {});
          const persistRole = window.__qsLayoutPersistRole || (() => {});
          const toggleTeacher = window.__qsLayoutToggleTeacherNavLinks || (() => {});

          const markTeacher = (isTeacher) => {
            toggleTeacher(!!isTeacher);
            if (panelLink) {
              if (isTeacher) {
                panelLink.removeAttribute('hidden');
                panelLink.removeAttribute('aria-hidden');
              } else {
                panelLink.setAttribute('hidden', 'hidden');
                panelLink.setAttribute('aria-hidden', 'true');
              }
            }
          };

          const setSignedOut = () => {
            button.textContent = 'Iniciar sesión';
            button.setAttribute('aria-label', 'Iniciar sesión');
            button.title = 'Iniciar sesión';
            button.onclick = () => signInWithGoogleOpen();
            persistAuth('signed-out');
            persistRole('estudiante');
            markTeacher(false);
          };

          const setSignedIn = async (user) => {
            button.textContent = 'Cerrar sesión';
            button.setAttribute('aria-label', 'Cerrar sesión');
            button.title = 'Cerrar sesión';
            button.onclick = () => signOutCurrent();
            persistAuth('signed-in');
            let isTeacher = false;
            try {
              if (user && user.email && isTeacherEmail(user.email)) {
                isTeacher = true;
              } else if (user && user.uid) {
                isTeacher = await isTeacherByDoc(user.uid);
              }
            } catch (_) {
              isTeacher = false;
            }
            persistRole(isTeacher ? 'docente' : 'estudiante');
            markTeacher(isTeacher);
          };

          const initialState = readAuth();
          if (initialState === 'signed-in') {
            button.textContent = 'Cerrar sesión';
            button.setAttribute('aria-label', 'Cerrar sesión');
            button.title = 'Cerrar sesión';
            button.onclick = () => signOutCurrent();
          } else {
            button.textContent = 'Iniciar sesión';
            button.setAttribute('aria-label', 'Iniciar sesión');
            button.title = 'Iniciar sesión';
            button.onclick = () => signInWithGoogleOpen();
          }

          onAuth(async (user) => {
            if (user) {
              await setSignedIn(user);
            } else {
              setSignedOut();
            }
          });
        })().catch((error) => {
          console.error('QS Layout: no se pudo inicializar la integración de autenticación', error);
        });
      `;
      doc.body.appendChild(script);
    } catch (_) {}
  }

  function setupNavToggle(navEl) {
    try {
      if (!navEl || navEl.__qsToggleBound) return;
      const toggle = navEl.querySelector(".qs-menu-toggle");
      const region = navEl.querySelector(".qs-links-region");
      if (!toggle || !region) return;
      const setState = (open) => {
        if (open) navEl.classList.add("is-open");
        else navEl.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        region.setAttribute("data-open", open ? "true" : "false");
      };
      setState(false);
      toggle.addEventListener("click", () => {
        setState(!navEl.classList.contains("is-open"));
      });
      region.addEventListener("click", (evt) => {
        try {
          const anchor =
            evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
          if (anchor) setState(false);
        } catch (_) {}
      });
      navEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Escape") {
          setState(false);
        }
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth >= 1024) setState(false);
      });
      navEl.__qsToggleBound = true;
    } catch (_) {}
  }

  function highlightActiveLink(navEl, pageName) {
    if (!navEl) return;
    try {
      const anchors = navEl.querySelectorAll(".qs-tabs a[href]");
      anchors.forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const target = href.split("?")[0].split("#")[0].split("/").pop();
        if (!target) {
          anchor.removeAttribute("aria-current");
          return;
        }
        if (target.toLowerCase() === pageName) {
          anchor.setAttribute("aria-current", "page");
        } else {
          anchor.removeAttribute("aria-current");
        }
      });
    } catch (_) {}
  }

  function refreshNavSpacing(navEl) {
    if (!navEl) return;
    try {
      const rect = navEl.getBoundingClientRect();
      const measured = rect ? Math.round(rect.height) : 0;
      const clamped = Math.min(Math.max(measured || 0, 56), 144);
      doc.documentElement.style.setProperty("--nav-h", `${clamped}px`);
      if (body) {
        body.style.paddingTop = `${clamped + 16}px`;
      }
    } catch (_) {}
  }

  function observeNavHeight(navEl) {
    if (!navEl || !window.ResizeObserver) return;
    try {
      const observer = new ResizeObserver(() => refreshNavSpacing(navEl));
      observer.observe(navEl);
    } catch (_) {}
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

  function bindNavAuthRedirect(navEl) {
    if (!navEl || navEl.__qsAuthRedirect) return;
    navEl.__qsAuthRedirect = true;
    navEl.addEventListener(
      "click",
      (evt) => {
        try {
          const anchor =
            evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
          if (!anchor) return;
          if (!navEl.contains(anchor)) return;
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
    try {
      const root = doc.documentElement;
      if (root) {
        root.classList.remove("role-teacher", "role-student");
        if (role === "docente") {
          root.classList.add("role-teacher");
        } else if (role) {
          root.classList.add("role-student");
        }
      }
    } catch (_) {}
    toggleTeacherNavLinks(role === "docente");
  }

  function updateAuthAppearance(navEl, state) {
    if (!navEl) return;
    try {
      const actions = navEl.querySelector(".qs-actions");
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
