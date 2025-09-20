// Compat layer para vistas que todavía cargan nav-inject.js.
// Se limita a cargar js/layout.js y delegar en la lógica centralizada.
(function loadLayoutFromNavInject() {
  if (window.__qsLayoutBooted) return;
  const current = document.currentScript;
  let layoutSrc = "js/layout.js";
  try {

        }
      }
    }
  } catch (_) {}

  if (document.querySelector("script[data-qs='layout-loader']")) return;
  const script = document.createElement("script");
  script.src = layoutSrc;
  script.defer = true;
  script.setAttribute("data-qs", "layout-loader");
  script.addEventListener("error", () => {
    console.error("No se pudo cargar js/layout.js desde nav-inject.js");
  });
  const parent =
    current && current.parentNode ? current.parentNode : document.head;
  parent.appendChild(script);
})();
