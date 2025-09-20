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

  const basePath = computeBasePath(doc);
  ensureFavicon(doc, basePath);

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
    if (!script) return "./";
    const src = script.getAttribute("src") || "layout.js";
    const scriptUrl = new URL(src, location.href);
    const scriptParts = scriptUrl.pathname.split("/").filter(Boolean);
    if (scriptParts.length) scriptParts.pop();
    const pageParts = location.pathname.split("/").filter(Boolean);
    if (pageParts.length) pageParts.pop();

    let commonIndex = 0;
    while (
      commonIndex < scriptParts.length &&
      commonIndex < pageParts.length &&
      scriptParts[commonIndex] === pageParts[commonIndex]
    ) {
      commonIndex += 1;
    }

    const ups = pageParts.slice(commonIndex).map(() => "..");
    const downs = scriptParts.slice(commonIndex);
    const relative = ups.concat(downs).join("/");
    return relative ? relative + "/" : "./";
  } catch (_) {
    return "./";
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
              <span class="qs-subtitle">Campus QS</span>
            </span>
          </a>
          <span class="qs-chip">Edicion 2024</span>
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
          <a class="qs-cta" data-default-auth-link data-awaiting-auth="signed-out" href="${basePath}login.html">Iniciar sesion</a>
        </div>
      </div>
    </div>
  `;
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
