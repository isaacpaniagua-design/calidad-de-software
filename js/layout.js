// Unified layout bootstrap for the QS platform.
// Creates the navigation bar, footer, and login integrations used across pages.

// CAMBIO: 1. Importar las variables desde el módulo de actualizaciones.
// Asegúrate de que el archivo 'updates.js' que te proporcioné antes exista en la misma carpeta 'js/'.
import { latestVersion, lastSeenVersionKey } from "./updates.js";

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
const REALTIME_MODULE_FLAG = "__qsRealtimeNotificationsModuleLoaded";

function bootstrapLayout() {
  if (window.__qsLayoutBooted) return;
  window.__qsLayoutBooted = true;

  const pageDoc = document;
  if (!pageDoc) return;

  const html = pageDoc.documentElement;
  const body = pageDoc.body || pageDoc.documentElement;
  const currentPage = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();
  const isLogin = currentPage === "login.html";
  const isNotFound = currentPage === "404.html";

  const basePath = computeBasePath(pageDoc);
  ensureFavicon(pageDoc, basePath);

  const nav = ensureNavigation(pageDoc, body, basePath);
  ensureRealtimeCenter(pageDoc, body, nav);
  const footer = ensureFooter(pageDoc, body);

  toggleTeacherNavLinks(nav, html.classList.contains("role-teacher"));
  observeRoleClassChanges(html, (isTeacher) =>
    toggleTeacherNavLinks(nav, isTeacher)
  );

  updateAuthAppearance(nav, readStoredAuthState());
  bindNavAuthRedirect(nav, basePath);
  setupNavToggle(nav);
  highlightActiveLink(nav, currentPage);
  refreshNavSpacing(nav);
  observeNavHeight(nav);
  setupSlideAssist(pageDoc);

  ensureRealtimeNotificationsModule();

  if (!isLogin && !isNotFound) {
    injectAuthGuard(pageDoc, basePath);
    injectAuthIntegration(pageDoc, basePath, nav);
  }

  window.QSLayout = Object.freeze({
    nav,
    footer,
    refreshSpacing: () => refreshNavSpacing(nav),
  });

  window.__qsLayoutReadAuthState = readStoredAuthState;
  window.__qsLayoutPersistAuthState = persistAuthState;
  window.__qsLayoutPersistRole = (role) => persistRole(role, nav);
  window.__qsLayoutToggleTeacherNavLinks = (isTeacher) =>
    toggleTeacherNavLinks(nav, isTeacher);
}

function computeBasePath(doc) {
  try {
    const script =
      doc.currentScript || doc.querySelector("script[src*='layout.js']");
    if (!script) return "./";
    const src = script.getAttribute("src") || "layout.js";
    const scriptUrl = new URL(src, location.href);
    if (scriptUrl.protocol === "file:") return "./";
    const baseUrl = new URL("../", scriptUrl);
    const href = baseUrl.href;
    return href.endsWith("/") ? href : href + "/";
  } catch (_) {
    return "./";
  }
}

function ensureNavigation(doc, body, basePath) {
  let nav = doc.querySelector(".qs-nav");

  // CAMBIO: 2. Lógica para determinar si se debe mostrar la notificación.
  // Esto se hace ANTES de construir el template del menú.
  const lastSeenVersion = localStorage.getItem(lastSeenVersionKey);
  const hasNewUpdate = latestVersion !== lastSeenVersion;
  const notificationBadge = hasNewUpdate
    ? '<span class="notification-dot" title="¡Nuevas actualizaciones disponibles!"></span>'
    : "";

  const template = buildNavTemplate(basePath, notificationBadge); // Pasamos el badge al template

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

function buildNavTemplate(basePath, notificationBadge) {
  // CAMBIO: 3. Añadimos el nuevo enlace "Actualizaciones" y el badge.
  // El badge se mostrará solo si 'notificationBadge' tiene contenido.
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
     <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegación principal">
  <!-- <a class="qs-btn" href="${basePath}materiales.html">Materiales</a> -->
  <a class="qs-btn" href="${basePath}asistencia.html">Asistencia</a>
  <a class="qs-btn" href="${basePath}calificaciones.html">Calificaciones</a>
  <a class="qs-btn teacher-only" href="${basePath}actividades.html">Actividades</a>
  <a
    class="qs-btn teacher-only"
    href="${basePath}paneldocente.html"
    data-route="panel"
    hidden
    aria-hidden="true"
    >Panel</a
  >
</nav>
      <div class="qs-actions">
        <a class="qs-cta" data-default-auth-link href="${basePath}login.html">Iniciar sesion</a>
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

function ensureRealtimeCenter(doc, body, nav) {
  if (!doc || !body) return null;

  let center = doc.querySelector("[data-realtime-center]");
  if (!center) {
    center = doc.createElement("div");
  }

  center.classList.add("realtime-center");
  center.setAttribute("data-realtime-center", "");

  if (!center.querySelector("[data-realtime-panel]")) {
    center.innerHTML = buildRealtimeCenterTemplate();
  }

  const referenceParent = body;
  const referenceSibling =
    nav && nav.parentNode === referenceParent
      ? nav.nextSibling
      : referenceParent.firstChild;
  referenceParent.insertBefore(center, referenceSibling || null);

  return center;
}

function buildRealtimeCenterTemplate() {
  return `
    <button
      class="realtime-toggle"
      type="button"
      aria-haspopup="true"
      aria-expanded="false"
      aria-controls="realtimePanel"
      data-realtime-toggle
    >
      <span class="realtime-toggle__icon" aria-hidden="true">🔔</span>
      <span class="sr-only" data-realtime-toggle-label>Abrir centro de notificaciones</span>


    </button>
    <section
      class="realtime-panel"
      id="realtimePanel"
      role="dialog"
      aria-label="Notificaciones en tiempo real"
      tabindex="-1"
      data-realtime-panel
      hidden
    >
      <header class="realtime-panel__header">
        <div class="realtime-panel__heading">
          <span class="realtime-panel__eyebrow">Alertas inteligentes</span>
          <div class="realtime-panel__title-row">
            <h2 class="realtime-panel__title">Notificaciones en tiempo real</h2>
            <span class="realtime-panel__status" data-realtime-status data-enabled="true" aria-live="polite">
              Notificaciones en tiempo real activas.
            </span>
          </div>
        </div>
        <button type="button" class="realtime-panel__close" data-realtime-close aria-label="Cerrar notificaciones">
          <span aria-hidden="true">×</span>
          <span class="sr-only">Cerrar centro de notificaciones</span>
        </button>
      </header>
      <details class="realtime-panel__hint">
        <summary>
          <span class="realtime-panel__hint-icon" aria-hidden="true">💡</span>
          <span>¿Cómo funcionan las alertas?</span>
          <span class="realtime-panel__hint-caret" aria-hidden="true">▸</span>
        </summary>
        <p class="realtime-panel__description">
          Personaliza qué eventos generan avisos al instante. Al iniciar sesión como docente, las entregas de alumnos y los
          nuevos comentarios del foro se mostrarán aquí en tiempo real.
        </p>
      </details>
      <div class="realtime-panel__content">
        <div class="realtime-feed">
          <div class="realtime-feed__header">
            <h3 class="realtime-feed__title">Actividad en vivo</h3>
            <p class="realtime-feed__description">
              Vista previa de cómo aparecerán las alertas en la plataforma.
            </p>
          </div>
          <div class="realtime-feed__empty" data-realtime-empty>
            <strong data-empty-title>Esperando actividad…</strong>
            <span data-empty-message>Activa al menos un tipo para previsualizar las notificaciones en vivo.</span>
          </div>
          <div class="realtime-feed__list" data-realtime-feed></div>
        </div>
      </div>
    </section>
  `.trim();
}

function ensureRealtimeNotificationsModule() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[REALTIME_MODULE_FLAG]) return;
  window[REALTIME_MODULE_FLAG] = true;

  import("./realtime-notifications.js").catch((error) => {
    console.error("No se pudo cargar js/realtime-notifications.js", error);
  });
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
    const anchor =
      evt.target && evt.target.closest ? evt.target.closest("a") : null;
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
      const matches =
        normalized === currentPage ||
        (isIndex &&
          (normalized === "" ||
            normalized === "./" ||
            normalized === "index.html"));
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
      const anchor =
        evt.target && evt.target.closest ? evt.target.closest("a[href]") : null;
      if (!anchor || !nav.contains(anchor)) return;
      const href = anchor.getAttribute("href") || "";
      if (shouldBypassAuth(href)) return;
      const state = readStoredAuthState();
      if (state !== "signed-in" && state !== "unknown") {
        evt.preventDefault();
        location.href = `${basePath}login.html`;
      }
    },
    true
  );
}

function shouldBypassAuth(href) {
  if (!href) return true;
  const trimmed = href.trim();
  if (!trimmed) return true;
  const lower = trimmed.split("#")[0].split("?")[0].toLowerCase();
  if (!lower) return true;
  // Permitimos el acceso a 'updates.html' sin necesidad de autenticación.
  if (
    lower === "updates.html" ||
    lower === "login.html" ||
    lower === "404.html"
  )
    return true;
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
      link.textContent = "Cerrar sesión";
      link.setAttribute("aria-label", "Cerrar sesión");
      link.setAttribute("data-awaiting-auth", "signed-in");
      // Visual: resalta si el texto o aria-label no son correctos
      if (
        link.textContent !== "Cerrar sesión" ||
        link.getAttribute("aria-label") !== "Cerrar sesión"
      ) {
        link.style.background = "#dc2626";
        link.style.color = "#fff";
        link.style.border = "2px solid #b91c1c";
      } else {
        link.style.background = "";
        link.style.color = "";
        link.style.border = "";
      }
    } else {
      link.textContent = "Iniciar sesión";
      link.setAttribute("aria-label", "Iniciar sesión");
      link.setAttribute("data-awaiting-auth", "signed-out");
      // Visual: resalta si el texto o aria-label no son correctos
      if (
        link.textContent !== "Iniciar sesión" ||
        link.getAttribute("aria-label") !== "Iniciar sesión"
      ) {
        link.style.background = "#dc2626";
        link.style.color = "#fff";
        link.style.border = "2px solid #b91c1c";
      } else {
        link.style.background = "";
        link.style.color = "";
        link.style.border = "";
      }
    }
    // Log para depuración
    console.log("[QSLayout] updateAuthAppearance:", {
      state,
      ariaLabel: link.getAttribute("aria-label"),
      text: link.textContent,
    });
  } catch (e) {
    console.warn("[QSLayout] updateAuthAppearance error", e);
  }
}

// Expone la función de actualización para que otras páginas puedan llamarla.
window.updateQsAuthButton = () => {
  const nav = document.querySelector(".qs-nav");
  const state = readStoredAuthState();
  updateAuthAppearance(nav, state);
};

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
          // Forzar un refresco de la página para asegurar que todos los
          // scripts específicos de la página re-evalúen el estado de autenticación.
          window.location.reload();
        }
      } else {
        persistAuthState("awaiting");
      }
    } catch (error) {
      console.error("[layout] auth integration failed", error);
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

function setupSlideAssist(doc) {
  try {
    if (!doc) return;
    const init = () => {
      try {
        const body = doc.body || doc.documentElement;
        if (!body) return;

        const prevBtn =
          doc.getElementById("prevBtn") ||
          doc.querySelector("[data-slide-prev]") ||
          doc.querySelector('[data-action="slide-prev"]');
        const nextBtn =
          doc.getElementById("nextBtn") ||
          doc.querySelector("[data-slide-next]") ||
          doc.querySelector('[data-action="slide-next"]');
        const slideCounter =
          doc.getElementById("currentSlide") ||
          doc.querySelector("[data-slide-current]");

        decorateSlideNavigation(doc, prevBtn, slideCounter);
        ensureSlideFloatingControls(doc, {
          prevBtn,
          nextBtn,
          slideCounter,
        });
      } catch (_) {}
    };

    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  } catch (_) {}
}

function decorateSlideNavigation(doc, prevBtn, slideCounter) {
  try {
    const nav = findSlideControlBar(doc, prevBtn, slideCounter);
    if (!nav) return;

    const view = doc.defaultView;
    const isFixed =
      view && nav ? view.getComputedStyle(nav).position === "fixed" : false;

    if (isFixed && doc.body) {
      doc.body.classList.add("has-slide-nav");
      nav.classList.add("session-slide-nav");
    }
  } catch (_) {}
}

function findSlideControlBar(doc, prevBtn, slideCounter) {
  const candidates = [];
  if (prevBtn) candidates.push(prevBtn);
  if (slideCounter) candidates.push(slideCounter);

  for (const el of candidates) {
    let node = el;
    while (node && node !== doc.body && node !== doc.documentElement) {
      if (node.classList && node.classList.contains("qs-nav")) break;
      if (node.hasAttribute && node.hasAttribute("data-slide-nav")) return node;
      if (node.tagName === "NAV" || node.tagName === "HEADER") return node;
      if (node.classList) {
        if (node.classList.contains("fixed")) return node;
        if (node.classList.contains("navigation")) return node;
        if (node.classList.contains("slide-control")) return node;
      }
      node = node.parentElement;
    }
  }
  return null;
}

function ensureSlideFloatingControls(doc, refs) {
  try {
    if (!doc || !refs) return;
    if (!detectSlideDeck(doc)) return;
    const body = doc.body || doc.documentElement;
    if (!body || body.querySelector(".qs-slide-fab")) return;

    body.classList.add("has-slide-floating-controls");

    const container = doc.createElement("div");
    container.className = "qs-slide-fab";
    container.innerHTML = `
      <button type="button" class="qs-slide-fab__btn is-prev" data-slide-direction="prev" aria-label="Diapositiva anterior">
        <span aria-hidden="true">&#8592;</span>
      </button>
      <button type="button" class="qs-slide-fab__btn is-next" data-slide-direction="next" aria-label="Diapositiva siguiente">
        <span aria-hidden="true">&#8594;</span>
      </button>
    `;

    body.appendChild(container);

    const prevFab = container.querySelector('[data-slide-direction="prev"]');
    const nextFab = container.querySelector('[data-slide-direction="next"]');

    if (!prevFab || !nextFab) return;

    const updateFabState = () => {
      syncSlideFabState(prevFab, refs.prevBtn);
      syncSlideFabState(nextFab, refs.nextBtn);
    };

    const scheduleUpdate = () => {
      try {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(updateFabState);
        } else {
          window.setTimeout(updateFabState, 16);
        }
      } catch (_) {
        try {
          window.setTimeout(updateFabState, 16);
        } catch (_) {}
      }
    };

    const invokeNative = (direction) => {
      try {
        const nativeBtn = direction === "prev" ? refs.prevBtn : refs.nextBtn;
        if (nativeBtn && !isNativeDisabled(nativeBtn)) {
          nativeBtn.click();
          return;
        }
        const fnName = direction === "prev" ? "previousSlide" : "nextSlide";
        const view = doc.defaultView;
        const fn =
          view && typeof view[fnName] === "function" ? view[fnName] : null;
        if (fn) fn.call(view);
      } catch (_) {}
    };

    const handleClick = (direction, fab) => (event) => {
      try {
        if (event) event.preventDefault();
      } catch (_) {}
      if (!fab || fab.disabled || fab.classList.contains("is-disabled")) return;
      invokeNative(direction);
      scheduleUpdate();
    };

    prevFab.addEventListener("click", handleClick("prev", prevFab));
    nextFab.addEventListener("click", handleClick("next", nextFab));

    const Observer = doc.defaultView && doc.defaultView.MutationObserver;
    if (Observer) {
      if (refs.prevBtn) {
        new Observer(scheduleUpdate).observe(refs.prevBtn, {
          attributes: true,
          attributeFilter: ["disabled", "aria-disabled", "class"],
        });
      }
      if (refs.nextBtn) {
        new Observer(scheduleUpdate).observe(refs.nextBtn, {
          attributes: true,
          attributeFilter: ["disabled", "aria-disabled", "class"],
        });
      }
      if (refs.slideCounter) {
        new Observer(scheduleUpdate).observe(refs.slideCounter, {
          characterData: true,
          childList: true,
          subtree: true,
        });
      }
    }

    if (refs.prevBtn) {
      refs.prevBtn.addEventListener("click", scheduleUpdate);
    }
    if (refs.nextBtn) {
      refs.nextBtn.addEventListener("click", scheduleUpdate);
    }

    wrapSlideFunction("nextSlide", scheduleUpdate);
    wrapSlideFunction("previousSlide", scheduleUpdate);
    wrapSlideFunction("goToSlide", scheduleUpdate);
    wrapSlideFunction("resetSlides", scheduleUpdate);
    wrapSlideFunction("resetAll", scheduleUpdate);

    updateFabState();
  } catch (_) {}
}

function detectSlideDeck(doc) {
  try {
    const selectors = [
      ".slide",
      ".slide-transition",
      "[data-slide]",
      "[data-slide-index]",
      "[data-role='slide']",
    ];
    for (const sel of selectors) {
      const nodes = doc.querySelectorAll(sel);
      if (nodes && nodes.length > 1) return true;
    }

    const idMatches = doc.querySelectorAll('[id^="slide"], [id^="lamina"]');
    if (idMatches && idMatches.length) {
      let count = 0;
      idMatches.forEach((el) => {
        if (!el || !el.id) return;
        if (/^slide\d+$/i.test(el.id) || /^lamina\d+$/i.test(el.id)) {
          count += 1;
        }
      });
      if (count > 1) return true;
    }
  } catch (_) {}
  return false;
}

function syncSlideFabState(fab, nativeBtn) {
  if (!fab) return;
  let disabled = false;
  try {
    if (nativeBtn) {
      disabled =
        !!nativeBtn.disabled ||
        nativeBtn.getAttribute("aria-disabled") === "true" ||
        (nativeBtn.classList &&
          (nativeBtn.classList.contains("opacity-50") ||
            nativeBtn.classList.contains("cursor-not-allowed") ||
            nativeBtn.classList.contains("disabled")));
    }
  } catch (_) {}

  fab.disabled = disabled;
  if (disabled) {
    fab.classList.add("is-disabled");
    fab.setAttribute("aria-disabled", "true");
  } else {
    fab.classList.remove("is-disabled");
    fab.removeAttribute("aria-disabled");
  }
}

function isNativeDisabled(btn) {
  try {
    if (!btn) return false;
    if (btn.disabled) return true;
    if (btn.getAttribute && btn.getAttribute("aria-disabled") === "true")
      return true;
    if (btn.classList) {
      if (btn.classList.contains("opacity-50")) return true;
      if (btn.classList.contains("cursor-not-allowed")) return true;
      if (btn.classList.contains("disabled")) return true;
    }
  } catch (_) {}
  return false;
}

function wrapSlideFunction(name, onAfter) {
  try {
    const view = window;
    if (!view || typeof onAfter !== "function") return;
    const original = view[name];
    if (typeof original !== "function") return;
    if (original.__qsWrapped) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      try {
        onAfter();
      } catch (_) {}
      return result;
    };
    wrapped.__qsWrapped = true;
    view[name] = wrapped;
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
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      bootstrapLayout();
      if (typeof window.updateQsAuthButton === "function") {
        window.updateQsAuthButton();
      }
    },
    { once: true }
  );
} else {
  bootstrapLayout();
  if (typeof window.updateQsAuthButton === "function") {
    window.updateQsAuthButton();
  }
}
