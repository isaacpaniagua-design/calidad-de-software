// Compat layer para vistas que todavía cargan nav-inject.js.
// Se limita a cargar js/layout.js y delegar en la lógica centralizada.
(function loadLayoutFromNavInject() {
  if (window.__qsLayoutBooted) return;

  const currentScript = document.currentScript;
  let layoutSrc = "js/layout.js";

  if (currentScript) {
    const configuredSrc = currentScript.getAttribute("data-layout-src");
    if (configuredSrc) {
      layoutSrc = configuredSrc;
    } else if (currentScript.src) {
      try {
        const scriptUrl = new URL(currentScript.src, window.location.href);
        const basePath = scriptUrl.pathname.substring(
          0,
          scriptUrl.pathname.lastIndexOf("/") + 1
        );
        const resolvedUrl = new URL("layout.js", `${scriptUrl.origin}${basePath}`);
        layoutSrc = resolvedUrl.href;
      } catch (error) {
        console.warn(
          "nav-inject.js: no se pudo resolver la ruta hacia layout.js; se usará la predeterminada.",
          error
        );
      }
    }
  }

  if (document.querySelector("script[data-qs='layout-loader']")) return;

  const loader = document.createElement("script");
  loader.defer = true;
  loader.src = layoutSrc;
  loader.setAttribute("data-qs", "layout-loader");
  loader.addEventListener("error", () => {
    console.error("No se pudo cargar js/layout.js desde nav-inject.js");
  });

  const parent =
    currentScript && currentScript.parentNode
      ? currentScript.parentNode
      : document.head;
  parent.appendChild(loader);
})();
