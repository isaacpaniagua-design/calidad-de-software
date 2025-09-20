// Inicializa el layout global de la plataforma QS.
// Se encarga de inyectar/normalizar la barra de navegación, footer y rutinas
// auxiliares que dependen del estado de autenticación.

const NAV_VERSION = "2024.12.clean";
const FOOTER_VERSION = "2024.12.clean";
const AUTH_STORAGE_KEY = "qs_auth_state";
const ROLE_STORAGE_KEY = "qs_role";

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
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
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

  const doc = document;
  if (!doc) return;

  const html = doc.documentElement;
  const body = doc.body;
  const currentPage = (location.pathname.split("/").pop() || "").toLowerCase();
  const isLogin = currentPage === "login.html";
  const isNotFound = currentPage === "404.html";

  if (body) body.classList.add("qs-layout");

  const basePath = computeBasePath();
  ensureStyles(doc, basePath);

  const nav = ensureNavigation(doc, body, basePath);
  const footer = ensureFooter(doc, body, basePath);

  toggleTeacherNavLinks(nav, html?.classList.contains("role-teacher"));
  observeRoleClassChanges(html, (isTeacher) => toggleTeacherNavLinks(nav, isTeacher));

  updateAuthAppearance(nav, readStoredAuthState());
  bindNavAuthRedirect(nav, basePath);
  setupNavToggle(nav);
  highlightActiveLink(nav, currentPage);
  refreshNavSpacing(nav, html, body);
  observeNavHeight(nav, (target) => refreshNavSpacing(target, html, body));

  if (!isLogin && !isNotFound) {
    injectAuthGuard(doc, basePath);
    injectAuthIntegration(doc, basePath);
  }

  window.QSLayout = Object.freeze({
    nav,
    footer,
    refreshSpacing() {
      refreshNavSpacing(nav, html, body);
    },
  });

  window.__qsLayoutReadAuthState = readStoredAuthState;
  window.__qsLayoutPersistAuthState = persistAuthState;
  window.__qsLayoutPersistRole = persistRole;
  window.__qsLayoutToggleTeacherNavLinks = (value) =>
    toggleTeacherNavLinks(nav, value);
}

function computeBasePath() {
  try {
    const doc = document;
    if (!doc) return "./";
    const script = doc.currentScript || doc.querySelector("script[src*='layout.js']");
    if (!script) return "./";
    const rawSrc = script.getAttribute("src") || "";
    const resolved = new URL(rawSrc, location.href);
    const parts = resolved.pathname.split("/").filter(Boolean);
    if (parts.length) parts.pop();
    const pageParts = location.pathname.split("/").filter(Boolean);
    if (pageParts.length) pageParts.pop();
    while (parts.length && pageParts.length && parts[0] === pageParts[0]) {
      parts.shift();
      pageParts.shift();
    }
    const ups = new Array(pageParts.length).fill("..");
    const downs = parts;
    const prefix = ups.concat(downs).join("/");
    return prefix ? `${prefix}/` : "./";
  } catch (_) {
    return "./";
  }
}

function ensureStyles(doc, basePath) {
  try {
    const head = doc.head || doc.getElementsByTagName("head")[0];
    if (!head) return;
    const href = `${basePath || "./"}css/layout.css`;
    const existing = doc.querySelector("link[data-qs='layout-css']");
    if (existing) {
      if (href && existing.getAttribute("href") !== href) {
        existing.setAttribute("href", href);
      }
      return;
    }
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-qs", "layout-css");
    head.appendChild(link);
  } catch (_) {}
}

function ensureNavigation(doc, body, basePath) {
  const base = basePath || "./";
  const template = `
    <div class="wrap">
      <div class="qs-brand-shell">
        <div class="qs-brand-region">
          <a class="qs-brand" href="${base}index.html">
            <span class="qs-logo" aria-hidden="true">QS</span>
            <span class="qs-brand-text">
              <span class="qs-title">Calidad de Software</span>
              <span class="qs-subtitle">Campus QS</span>
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
          <a class="qs-btn teacher-only" data-route="panel" href="${base}paneldocente.html" hidden aria-hidden="true">Panel</a>
        </nav>
        <div class="qs-actions">
          <a class="qs-cta" data-default-auth-link data-awaiting-auth="signed-out" href="${base}login.html" aria-label="Iniciar sesión">Iniciar sesión</a>
        </div>
      </div>
    </div>
  `;

  let nav = doc.querySelector("[data-role='main-nav']");
  if (!nav) {
    nav = doc.createElement("div");
    nav.setAttribute("data-role", "main-nav");
    nav.className = "qs-nav";
    nav.setAttribute("data-nav-version", NAV_VERSION);
    nav.innerHTML = template;
    if (body) {
      body.prepend(nav);
    } else {
      doc.documentElement.insertBefore(nav, doc.documentElement.firstChild);
    }
  } else {
    nav.classList.add("qs-nav");
    if (nav.getAttribute("data-nav-version") !== NAV_VERSION) {
      nav.innerHTML = template;
    }
    nav.setAttribute("data-nav-version", NAV_VERSION);
  }
  return nav;
}

function ensureFooter(doc, body, basePath) {
  const base = basePath || "./";
  const markup = `
    <p>Calidad de Software · Plataforma QS</p>
    <p>
      <a href="${base}index.html">Inicio</a>
      <span aria-hidden="true"> · </span>
      <a href="${base}status.html">Estado del servicio</a>
    </p>
  `;

  let footer = doc.querySelector("footer[data-footer-version]");
  if (!footer) {
    footer = doc.createElement("footer");
    footer.className = "qs-footer";
    footer.setAttribute("data-footer-version", FOOTER_VERSION);
    footer.innerHTML = markup;
    (body || doc.documentElement).appendChild(footer);
  } else {
    footer.classList.add("qs-footer");
    if (footer.getAttribute("data-footer-version") !== FOOTER_VERSION) {
      footer.innerHTML = markup;
    }
    footer.setAttribute("data-footer-version", FOOTER_VERSION);
  }
  return footer;
}

function setupNavToggle(nav) {
  if (!nav || nav.__qsToggleBound) return;
  try {
    const toggle = nav.querySelector(".qs-menu-toggle");
    const region = nav.querySelector(".qs-links-region");
    if (!toggle || !region) return;
    nav.__qsToggleBound = true;

    const setState = (open) => {
      nav.classList.toggle("is-open", !!open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      region.setAttribute("data-open", open ? "true" : "false");
    };

    setState(false);

    toggle.addEventListener("click", () => {
      setState(!nav.classList.contains("is-open"));
    });

    region.addEventListener("click", (evt) => {
      const anchor = evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
      if (anchor) setState(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 960) setState(false);
    });
  } catch (_) {}
}

function highlightActiveLink(nav, currentPage) {
  if (!nav) return;
  try {
    const links = nav.querySelectorAll(".qs-tabs a[href]");
    links.forEach((link) => {
      const href = (link.getAttribute("href") || "").split("?")[0].split("#")[0].toLowerCase();
      if (!href) return;
      if (href === currentPage) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  } catch (_) {}
}

function refreshNavSpacing(nav, html, body) {
  if (!nav) return;
  try {
    const rect = nav.getBoundingClientRect();
    const height = rect && rect.height ? Math.round(rect.height) : 72;
    const clamped = Math.max(56, Math.min(120, height));
    if (html) {
      html.style.setProperty("--nav-h", `${clamped}px`);
      html.style.setProperty("--anchor-offset", `${clamped + 8}px`);
    }
    if (body) {
      body.style.paddingTop = `${clamped}px`;
    }
  } catch (_) {}
}

function observeNavHeight(nav, onChange) {
  if (!nav || !window.ResizeObserver) return;
  try {
    const observer = new ResizeObserver(() => {
      try {
        onChange(nav);
      } catch (_) {}
    });
    observer.observe(nav);
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

function bindNavAuthRedirect(nav, basePath) {
  if (!nav || nav.__qsAuthRedirect) return;
  nav.__qsAuthRedirect = true;
  nav.addEventListener(
    "click",
    (evt) => {
      try {
        const anchor = evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
        if (!anchor || !nav.contains(anchor)) return;
        const href = anchor.getAttribute("href") || "";
        if (shouldBypassAuth(href)) return;
        const state = readStoredAuthState();
        if (state && state !== "signed-in" && state !== "unknown") {
          evt.preventDefault();
          location.href = `${basePath || "./"}login.html`;
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
  const nav = window.QSLayout?.nav || document.querySelector("[data-role='main-nav']");
  toggleTeacherNavLinks(nav, role === "docente");
}

function updateAuthAppearance(nav, state) {
  if (!nav) return;
  try {
    const defaultLink = nav.querySelector("[data-default-auth-link]");
    if (!defaultLink) return;
    if (state === "signed-in") {
      defaultLink.textContent = "Cerrar sesión";
      defaultLink.setAttribute("aria-label", "Cerrar sesión");
      defaultLink.setAttribute("data-awaiting-auth", "signed-in");
    } else {
      defaultLink.textContent = "Iniciar sesión";
      defaultLink.setAttribute("aria-label", "Iniciar sesión");
      defaultLink.setAttribute("data-awaiting-auth", "signed-out");
    }
  } catch (_) {}
}

function toggleTeacherNavLinks(nav, isTeacher) {
  if (!nav) return;
  try {
    const links = nav.querySelectorAll("[data-route='panel'], .teacher-only");
    links.forEach((link) => {
      if (!link) return;
      if (isTeacher) {
        link.removeAttribute("hidden");
        link.removeAttribute("aria-hidden");
        link.classList.remove("hidden");
      } else {
        link.setAttribute("hidden", "hidden");
        link.setAttribute("aria-hidden", "true");
        link.classList.add("hidden");
      }
    });
  } catch (_) {}
}

function observeRoleClassChanges(html, callback) {
  if (!html || !window.MutationObserver) return;
  try {
    const observer = new MutationObserver(() => {
      try {
        callback(html.classList.contains("role-teacher"));
      } catch (_) {}
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
  } catch (_) {}
}

function injectAuthGuard(doc, basePath) {
  try {
    if (doc.querySelector("script[data-qs='auth-guard']")) return;
    const script = doc.createElement("script");
    script.type = "module";
    script.src = `${basePath || "./"}js/auth-guard.js`;
    script.setAttribute("data-qs", "auth-guard");
    doc.head.appendChild(script);
  } catch (_) {}
}

function injectAuthIntegration(doc, basePath) {
  try {
    if (doc.querySelector("script[data-qs='role-gate']")) return;
    const script = doc.createElement("script");
    script.type = "module";
    script.src = `${basePath || "./"}js/role-gate.js`;
    script.setAttribute("data-qs", "role-gate");
    doc.head.appendChild(script);
  } catch (_) {}
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
