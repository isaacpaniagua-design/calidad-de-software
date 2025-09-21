// Unified layout bootstrap for the QS platform.
// Creates the navigation bar, footer, and login integrations used across pages.

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

const NAV_VERSION = "2024.12.clean";
const FOOTER_VERSION = "2024.12.clean";
const AUTH_STORAGE_KEY = "qs_auth_state";
const ROLE_STORAGE_KEY = "qs_role";
const SESSION_STATUS_STORAGE_PREFIX = "qs_session_status:";
const SESSION_STATUS_STATES = Object.freeze([
  { id: "not-started", label: "No realizada" },
  { id: "in-progress", label: "En curso" },
  { id: "completed", label: "Realizada" },
]);

function bootstrapLayout() {
  if (window.__qsLayoutBooted) return;
  window.__qsLayoutBooted = true;

  const doc = document;
  if (!doc) return;

  const html = doc.documentElement;
  const body = doc.body || doc.documentElement;
  const currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isLogin = currentPage === "login.html";
  const isNotFound = currentPage === "404.html";
  const isSessionPage = /^sesion\d+\.html$/.test(currentPage);

  const basePath = computeBasePath(doc);
  ensureFavicon(doc, basePath);

  if (isSessionPage) {
    decorateSessionPage(doc, html, body);
  }

  const nav = ensureNavigation(doc, body, basePath);
  const footer = ensureFooter(doc, body);

  toggleTeacherNavLinks(nav, html.classList.contains("role-teacher"));
  observeRoleClassChanges(html, (isTeacher) => toggleTeacherNavLinks(nav, isTeacher));

  updateAuthAppearance(nav, readStoredAuthState());
  bindNavAuthRedirect(nav, basePath);
  setupNavToggle(nav);
  highlightActiveLink(nav, currentPage);
  refreshNavSpacing(nav);
  observeNavHeight(nav);
  setupSessionStatusControl(doc, currentPage);

  if (!isLogin && !isNotFound) {
    injectAuthGuard(doc, basePath);
    injectAuthIntegration(doc, basePath, nav);
  }

  window.QSLayout = Object.freeze({
    nav,
    footer,
    refreshSpacing: () => refreshNavSpacing(nav),
  });

  window.__qsLayoutReadAuthState = readStoredAuthState;
  window.__qsLayoutPersistAuthState = persistAuthState;
  window.__qsLayoutPersistRole = (role) => persistRole(role, nav);
  window.__qsLayoutToggleTeacherNavLinks = (isTeacher) => toggleTeacherNavLinks(nav, isTeacher);
}

function computeBasePath(doc) {
  try {
    const script = doc.currentScript || doc.querySelector("script[src*='layout.js']");
    if (!script) return './';
    const src = script.getAttribute('src') || 'layout.js';
    const scriptUrl = new URL(src, location.href);
    if (scriptUrl.protocol === 'file:') return './';
    const baseUrl = new URL('../', scriptUrl);
    const href = baseUrl.href;
    return href.endsWith('/') ? href : href + '/';
  } catch (_) {
    return './';
  }
}

function ensureNavigation(doc, body, basePath) {
  let nav = doc.querySelector(".qs-nav");
  const template = buildNavTemplate(basePath);

  if (!nav) {
    nav = doc.createElement("div");
    nav.className = "qs-nav";
    nav.setAttribute("data-role", "main-nav");
    nav.setAttribute("data-nav-version", NAV_VERSION);
    nav.innerHTML = template;
    if (body.firstChild) body.insertBefore(nav, body.firstChild);
    else body.appendChild(nav);
  } else {
    nav.classList.add("qs-nav");
    nav.setAttribute("data-role", "main-nav");
    nav.setAttribute("data-nav-version", NAV_VERSION);
    nav.innerHTML = template;
  }

  return nav;
}

function buildNavTemplate(basePath) {
  return `
    <div class="wrap">
      <div class="qs-brand-shell">
        <div class="qs-brand-region">
          <a class="qs-brand" href="${basePath}index.html">
            <span class="qs-logo" aria-hidden="true">QS</span>
            <span class="qs-brand-text">
              <span class="qs-title">Calidad de Software</span>
              <span class="qs-subtitle">ITSON</span>
            </span>
          </a>
        </div>
        <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">
          <span class="qs-menu-icon" aria-hidden="true"></span>
          <span class="sr-only">Abrir menu</span>
        </button>
      </div>
      <div class="qs-links-region" data-open="false">
        <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegacion principal">
          <a class="qs-btn" href="${basePath}materiales.html">Materiales</a>
          <a class="qs-btn" href="${basePath}asistencia.html">Asistencia</a>
          <a class="qs-btn" href="${basePath}calificaciones.html">Calificaciones</a>
          <a class="qs-btn" href="${basePath}Foro.html">Foro</a>
          <a class="qs-btn teacher-only" data-route="panel" href="${basePath}paneldocente.html" hidden aria-hidden="true">Panel</a>
        </nav>
        <div class="qs-actions">
          <a
            class="qs-cta"
            data-default-auth-link
            href="${basePath}login.html"
            aria-label="Ir a iniciar sesion"
          >
            Iniciar sesion
          </a>
        </div>
      </div>
    </div>
  `;
}

function decorateSessionPage(doc, html, body) {
  if (!doc || !html || !body) return;
  try {
    if (!html.getAttribute("data-layout")) {
      html.setAttribute("data-layout", "session");
    }
    html.classList.add("qs-session-root");
    body.classList.add("qs-session-page");
    ensureSessionPageStyles(doc);

    const shell =
      doc.querySelector(".qs-page-wrap") ||
      doc.querySelector("main") ||
      doc.querySelector("[class~='max-w-7xl']") ||
      doc.querySelector("[class~='max-w-6xl']");

    if (shell) {
      shell.classList.add("qs-session-shell");
    }
  } catch (_) {}
}

function ensureSessionPageStyles(doc) {
  try {
    if (!doc || doc.getElementById("qs-session-style")) return;
    const style = doc.createElement("style");
    style.id = "qs-session-style";
    style.textContent = `
      html[data-layout='session'] body.qs-session-page {
        background:
          radial-gradient(circle at 12% 18%, rgba(129, 140, 248, 0.25), transparent 55%),
          radial-gradient(circle at 85% 12%, rgba(59, 130, 246, 0.22), transparent 52%),
          linear-gradient(165deg, #f8fafc 0%, #eef2ff 55%, #fdf2f8 100%);
        color: #0f172a;
      }

      html[data-layout='session'] body.qs-session-page::before,
      html[data-layout='session'] body.qs-session-page::after {
        content: '';
        position: fixed;
        z-index: -1;
        filter: blur(96px);
        opacity: 0.45;
        pointer-events: none;
        transition: opacity var(--motion-duration) var(--motion-easing);
      }

      html[data-layout='session'] body.qs-session-page::before {
        inset: -30% 42% auto -28%;
        height: 420px;
        background: radial-gradient(circle at center, rgba(99, 102, 241, 0.28), transparent 70%);
      }

      html[data-layout='session'] body.qs-session-page::after {
        inset: auto -32% -22% 22%;
        height: 360px;
        background: radial-gradient(circle at center, rgba(16, 185, 129, 0.2), transparent 74%);
      }

      html[data-layout='session'] .qs-session-shell {
        width: var(--page-max-width);
        margin: 0 auto;
        padding: clamp(32px, 5vw, 60px) clamp(18px, 5vw, 32px) clamp(96px, 8vw, 140px);
        position: relative;
        z-index: 0;
      }

      html[data-layout='session'] .qs-session-shell > * {
        position: relative;
        z-index: 1;
      }

      html[data-layout='session'] .qs-session-shell::before {
        content: '';
        position: absolute;
        inset: clamp(12px, 3vw, 24px);
        border-radius: clamp(24px, 5vw, 36px);
        background: rgba(255, 255, 255, 0.72);
        box-shadow: 0 40px 90px rgba(15, 23, 42, 0.18);
        z-index: 0;
        pointer-events: none;
        opacity: 0.85;
      }

      html[data-layout='session'] .qs-session-shell > *:first-child {
        margin-top: clamp(12px, 4vw, 20px);
      }

      @media (max-width: 960px) {
        html[data-layout='session'] .qs-session-shell {
          padding: clamp(24px, 5vw, 40px) clamp(16px, 6vw, 28px) clamp(80px, 8vw, 120px);
        }

        html[data-layout='session'] .qs-session-shell::before {
          inset: clamp(8px, 4vw, 22px);
        }
      }
    `;
    const head = doc.head || doc.documentElement;
    if (head && head.appendChild) head.appendChild(style);
  } catch (_) {}
}

function ensureFooter(doc, body) {
  let footer = doc.querySelector("footer[data-footer-version]");
  const markup = `
    <div class="footer-content">&copy; ${new Date().getFullYear()} Plataforma QS - Calidad de Software</div>
  `;

  if (!footer) {
    footer = doc.createElement("footer");
    footer.className = "qs-footer";
    footer.setAttribute("data-footer-version", FOOTER_VERSION);
    footer.innerHTML = markup;
    body.appendChild(footer);
  } else {
    footer.classList.add("qs-footer");
    footer.setAttribute("data-footer-version", FOOTER_VERSION);
    footer.innerHTML = markup;
  }

  return footer;
}

function ensureFavicon(doc, basePath) {
  const head = doc.head || doc.getElementsByTagName("head")[0];
  if (!head) return;
  const desiredHref = new URL(`${basePath}favicon.ico`, location.href).href;
  let link = head.querySelector("link[rel='icon']");
  if (!link) {
    link = doc.createElement("link");
    link.rel = "icon";
    head.appendChild(link);
  }
  link.href = desiredHref;
}

function setupNavToggle(nav) {
  if (!nav || nav.__qsToggleBound) return;
  const toggle = nav.querySelector(".qs-menu-toggle");
  const region = nav.querySelector(".qs-links-region");
  if (!toggle || !region) return;

  const setState = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    region.setAttribute("data-open", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    setState(!nav.classList.contains("is-open"));
  });

  region.addEventListener("click", (evt) => {
    const anchor = evt.target && evt.target.closest ? evt.target.closest("a") : null;
    if (anchor) setState(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) setState(false);
  });

  nav.__qsToggleBound = true;
}

function refreshNavSpacing(nav) {
  if (!nav) return;
  try {
    const rect = nav.getBoundingClientRect();
    const height = Math.max(56, Math.min(120, Math.round(rect.height || 72)));
    const root = document.documentElement;
    root.style.setProperty("--nav-h", `${height}px`);
    root.style.setProperty("--anchor-offset", `${height + 8}px`);
  } catch (_) {}
}

function observeNavHeight(nav) {
  if (!nav || !window.ResizeObserver) return;
  try {
    const observer = new ResizeObserver(() => refreshNavSpacing(nav));
    observer.observe(nav);
  } catch (_) {}
}

function highlightActiveLink(nav, currentPage) {
  if (!nav) return;
  try {
    const links = nav.querySelectorAll(".qs-tabs a[href]");
    links.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      const normalized = href.split("#")[0].split("?")[0];
      const isIndex = !currentPage || currentPage === "index.html";
      const matches = normalized === currentPage || (isIndex && (normalized === "" || normalized === "./" || normalized === "index.html"));
      if (matches) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  } catch (_) {}
}

function bindNavAuthRedirect(nav, basePath) {
  if (!nav || nav.__qsAuthRedirectBound) return;
  nav.__qsAuthRedirectBound = true;
  nav.addEventListener(
    "click",
    (evt) => {
      const anchor = evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
      if (!anchor || !nav.contains(anchor)) return;
      const href = anchor.getAttribute("href") || "";
      if (shouldBypassAuth(href)) return;
      const state = readStoredAuthState();
      if (state !== "signed-in" && state !== "unknown") {
        evt.preventDefault();
        location.href = `${basePath}login.html`;
      }
    },
    true,
  );
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

function readStoredAuthState() {
  try {
    const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (sessionValue) return sessionValue;
  } catch (_) {}
  try {
    const localValue = localStorage.getItem(AUTH_STORAGE_KEY);
    if (localValue) return localValue;
  } catch (_) {}
  if (typeof window.__qsAuthState === "string") return window.__qsAuthState;
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

function persistRole(role, nav) {
  try {
    if (role) localStorage.setItem(ROLE_STORAGE_KEY, role);
    else localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch (_) {}
  toggleTeacherNavLinks(nav, role === "docente");
}

function toggleTeacherNavLinks(nav, isTeacher) {
  if (!nav) return;
  try {
    nav.querySelectorAll("[data-route='panel']").forEach((link) => {
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

function setupSessionStatusControl(doc, currentPage) {
  try {
    if (!doc) return;
    const page = (currentPage || "").toLowerCase();
    if (!/^sesion\d+\.html$/.test(page)) return;
    if (!Array.isArray(SESSION_STATUS_STATES) || SESSION_STATUS_STATES.length === 0)
      return;

    const toolbarCard = doc.querySelector(".session-toolbar-card");
    if (!toolbarCard) return;
    if (toolbarCard.querySelector("[data-role='session-status']")) return;

    ensureSessionStatusStyles(doc);

    const slideToolbar = toolbarCard.querySelector(".slide-toolbar");
    const container = doc.createElement("div");
    container.className = "session-status-control";
    container.setAttribute("data-role", "session-status");
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Estado de la sesión");

    const sessionId = page.replace(/\.html$/, "");
    const storageKey = `${SESSION_STATUS_STORAGE_PREFIX}${sessionId}`;

    const label = doc.createElement("span");
    const labelId = `session-status-label-${sessionId}`;
    label.className = "session-status-label";
    label.id = labelId;
    label.textContent = "Estado de la sesión";

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "qs-session-status-btn";
    button.setAttribute("data-role", "session-status-toggle");
    button.setAttribute("aria-describedby", labelId);

    const storedState = readStoredSessionStatus(storageKey);
    let currentIndex = SESSION_STATUS_STATES.findIndex(
      (state) => state && state.id === storedState,
    );
    if (currentIndex < 0) currentIndex = 0;

    const applyState = (index) => {
      if (!Array.isArray(SESSION_STATUS_STATES) || SESSION_STATUS_STATES.length === 0)
        return null;
      const total = SESSION_STATUS_STATES.length;
      const normalizedIndex = ((index % total) + total) % total;
      const state = SESSION_STATUS_STATES[normalizedIndex] || SESSION_STATUS_STATES[0];
      currentIndex = normalizedIndex;

      while (button.firstChild) button.removeChild(button.firstChild);

      button.dataset.state = state.id;
      button.setAttribute("data-state", state.id);

      const dot = doc.createElement("span");
      dot.className = "qs-session-status-dot";
      dot.setAttribute("aria-hidden", "true");

      const text = doc.createElement("span");
      text.className = "qs-session-status-text";
      text.textContent = state.label;

      button.appendChild(dot);
      button.appendChild(text);

      const nextState = SESSION_STATUS_STATES[(normalizedIndex + 1) % total] || state;
      const nextLabel = nextState.label || state.label;

      button.setAttribute(
        "aria-label",
        `Estado de la sesión: ${state.label}. Activa para cambiar a ${nextLabel}.`,
      );
      button.setAttribute(
        "title",
        `Estado actual: ${state.label}. Haz clic para marcar como ${nextLabel}.`,
      );

      return state;
    };

    applyState(currentIndex);

    button.addEventListener("click", () => {
      const nextIndex = (currentIndex + 1) % SESSION_STATUS_STATES.length;
      const state = applyState(nextIndex);
      if (state && state.id) {
        persistSessionStatus(storageKey, state.id);
      }
    });

    container.appendChild(label);
    container.appendChild(button);

    if (slideToolbar && slideToolbar.parentNode === toolbarCard) {
      toolbarCard.insertBefore(container, slideToolbar);
    } else {
      toolbarCard.appendChild(container);
    }
  } catch (_) {}
}

function ensureSessionStatusStyles(doc) {
  try {
    if (!doc || doc.querySelector("style[data-session-status-styles]") || !doc.createElement)
      return;

    const style = doc.createElement("style");
    style.type = "text/css";
    style.setAttribute("data-session-status-styles", "true");
    style.textContent = `
      .session-toolbar-card {
        flex-wrap: wrap;
      }
      .session-toolbar-card .slide-toolbar {
        order: 3;
      }
      .session-status-control {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.4rem 0.85rem;
        border-radius: 9999px;
        border: 1px solid rgba(99, 102, 241, 0.18);
        background: rgba(255, 255, 255, 0.92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85),
          0 12px 30px rgba(79, 70, 229, 0.12);
        order: 2;
        margin-left: auto;
      }
      .session-status-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
        white-space: nowrap;
      }
      .qs-session-status-btn {
        border: none;
        border-radius: 9999px;
        padding: 0.45rem 1rem;
        font-weight: 600;
        font-size: 0.85rem;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        cursor: pointer;
        background: #eef2ff;
        color: #4338ca;
        box-shadow: 0 12px 30px rgba(79, 70, 229, 0.18);
        transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease,
          color 0.2s ease;
      }
      .qs-session-status-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 18px 40px rgba(79, 70, 229, 0.25);
      }
      .qs-session-status-btn:focus-visible {
        outline: 2px solid rgba(99, 102, 241, 0.6);
        outline-offset: 3px;
      }
      .qs-session-status-btn .qs-session-status-dot {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 9999px;
        background: currentColor;
        opacity: 0.9;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.85);
      }
      .qs-session-status-btn .qs-session-status-text {
        white-space: nowrap;
      }
      .qs-session-status-btn[data-state='not-started'] {
        background: #fee2e2;
        color: #b91c1c;
        box-shadow: 0 14px 32px rgba(239, 68, 68, 0.22);
      }
      .qs-session-status-btn[data-state='in-progress'] {
        background: #fef3c7;
        color: #b45309;
        box-shadow: 0 14px 32px rgba(245, 158, 11, 0.22);
      }
      .qs-session-status-btn[data-state='completed'] {
        background: #dcfce7;
        color: #047857;
        box-shadow: 0 14px 32px rgba(16, 185, 129, 0.22);
      }
      @media (max-width: 900px) {
        .session-status-control {
          width: 100%;
          margin-left: 0;
          justify-content: space-between;
        }
        .session-status-label {
          font-size: 0.7rem;
        }
      }
    `;

    const head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
    if (head && head.appendChild) {
      head.appendChild(style);
    }
  } catch (_) {}
}

function readStoredSessionStatus(key) {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function persistSessionStatus(key, value) {
  if (!key) return;
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (_) {}
}

function observeRoleClassChanges(html, callback) {
  if (!html || !window.MutationObserver) return;
  try {
    const observer = new MutationObserver(() => {
      callback(html.classList.contains("role-teacher"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
  } catch (_) {}
}

function updateAuthAppearance(nav, state) {
  if (!nav) return;
  try {
    const actions = nav.querySelector(".qs-actions");
    if (!actions) return;
    const link = actions.querySelector("[data-default-auth-link]");
    if (!link) return;
    if (state === "signed-in") {
      link.textContent = "Cerrar sesion";
      link.setAttribute("aria-label", "Cerrar sesion");
      link.setAttribute("data-awaiting-auth", "signed-in");
    } else {
      link.textContent = "Iniciar sesion";
      link.setAttribute("aria-label", "Iniciar sesion");
      link.setAttribute("data-awaiting-auth", "signed-out");
    }
  } catch (_) {}
}

function injectAuthGuard(doc, basePath) {
  try {
    if (doc.querySelector("script[data-qs-auth-guard]")) return;
    const existing = doc.querySelector("script[src$='auth-guard.js']");
    if (existing) return;
    const script = doc.createElement("script");
    script.type = "module";
    script.src = `${basePath}js/auth-guard.js`;
    script.setAttribute("data-qs-auth-guard", "true");
    doc.head.appendChild(script);
  } catch (_) {}
}

function injectAuthIntegration(doc, basePath, nav) {
  if (!nav) return;
  const authLink = nav.querySelector("[data-default-auth-link]");
  if (!authLink) return;

  try {
    if (!doc.querySelector("script[src$='role-gate.js']")) {
      if (!doc.querySelector("script[data-qs-auth-integration]")) {
        const script = doc.createElement("script");
        script.type = "module";
        script.src = `${basePath}js/role-gate.js`;
        script.setAttribute("data-qs-auth-integration", "true");
        doc.head.appendChild(script);
      }
    }
  } catch (_) {}

  if (authLink.__qsAuthBound) return;
  authLink.__qsAuthBound = true;
  authLink.addEventListener("click", async (evt) => {
    try {
      const state = readStoredAuthState();
      if (state === "signed-in") {
        evt.preventDefault();
        const module = await import(`${basePath}js/firebase.js`);
        if (module && typeof module.signOutCurrent === "function") {
          await module.signOutCurrent();
          persistAuthState("signed-out");
          updateAuthAppearance(nav, "signed-out");
        }
      } else {
        persistAuthState("awaiting");
      }
    } catch (error) {
      console.error('[layout] auth integration failed', error);
    }
  });
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
        <p class="qs-loading-text">Cargando plataforma...</p>
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
  document.addEventListener("DOMContentLoaded", bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}
