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
      const anchor = document.createElement("a");
      anchor.href = currentScript.src;

      if (anchor.protocol && anchor.host) {
        const basePath = anchor.pathname.replace(/[^/]*$/, "");
        layoutSrc = `${anchor.protocol}//${anchor.host}${basePath}layout.js`;
      } else {
        console.warn(
          "nav-inject.js: no se pudo resolver la ruta hacia layout.js; se usará la predeterminada."
        );
      }
    }
  }

  if (document.querySelector("script[data-qs='layout-loader']")) return;

  const hasLayoutScript = Array.from(document.querySelectorAll("script[src]"))
    .filter((script) => script !== currentScript)
    .some((script) => {
      const src = script.getAttribute("src") || "";
      return /(?:^|\/|\\)layout\.js(?:$|[?#])/.test(src);
    });
  if (hasLayoutScript) return;

  const loader = document.createElement("script");
  loader.type = "module";
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
