const STORAGE_KEY = "qs:realtime-notifications";
const BOOT_FLAG = "__qsRealtimeNotificationsBooted";
let storageUnavailable = false;

const OPTIONS = [
  {
    id: "activity-received",
    icon: "📥",
    label: "Recepción de actividades",
    description:
      "Confirma al instante cada vez que una actividad es entregada para alumnos y docentes.",
  },
  {
    id: "activity-graded",
    icon: "✅",
    label: "Calificación de actividades",
    description:
      "Recibe un aviso cuando se publique la retroalimentación o la nota de una actividad.",
  },
  {
    id: "homework",
    icon: "📝",
    label: "Tareas asignadas",
    description: "Notificaciones inmediatas de nuevas tareas o cambios en sus fechas límite.",
  },
  {
    id: "evidence-student",
    icon: "📤",
    label: "Evidencias del alumno",
    description:
      "Alertas cuando los estudiantes comparten archivos de evidencia o seguimiento.",
  },
  {
    id: "evidence-teacher",
    icon: "📚",
    label: "Evidencias del docente",
    description:
      "Enterate cuando el equipo docente publique guías o ejemplos de evidencia.",
  },
  {
    id: "forum-reply",
    icon: "💬",
    label: "Respuestas en el foro",
    description:
      "Sigue los comentarios nuevos en tus hilos y menciones dentro del foro colaborativo.",
  },
  {
    id: "forum-reaction",
    icon: "👏",
    label: "Reacciones en el foro",
    description: "Recibe un ping al instante cuando tus aportes reciban aplausos u otras reacciones.",
  },
  {
    id: "grades",
    icon: "📊",
    label: "Actualizaciones de calificaciones",
    description:
      "Avisos globales cuando cambian promedios, parciales o calificaciones finales.",
  },
];

const FEED_EVENTS = [
  {
    type: "activity-received",
    icon: "📥",
    message: "Camila R. envió la Actividad 04 “Plan de pruebas”.",
    detail: "Alumno · Archivo PDF (1.2 MB).",
  },
  {
    type: "activity-graded",
    icon: "✅",
    message: "Mtra. Salas calificó la Actividad 03 de Ana con 95.",
    detail: "Incluye comentarios detallados para el cierre del sprint.",
  },
  {
    type: "homework",
    icon: "📝",
    message: "Nueva tarea “Backlog de bugs críticos” asignada para la semana 6.",
    detail: "El docente notificó a todo el grupo con la nueva rúbrica.",
  },
  {
    type: "evidence-student",
    icon: "📤",
    message: "Kevin H. subió evidencia en video para la Sesión 8.",
    detail: "Disponible en el repositorio compartido de la clase.",
  },
  {
    type: "forum-reply",
    icon: "💬",
    message: "Mariana respondió en tu hilo “Integración continua”.",
    detail: "Sugiere automatizar las pruebas de despliegue nocturno.",
  },
  {
    type: "forum-reaction",
    icon: "👏",
    message: "Recibiste 3 aplausos en tu aporte sobre pipelines CI/CD.",
    detail: "Participaron María, José y Andrea.",
  },
  {
    type: "evidence-teacher",
    icon: "📚",
    message: "El equipo docente compartió nueva evidencia guía para Sprint 2.",
    detail: "Incluye una rúbrica actualizada y ejemplos resueltos.",
  },
  {
    type: "grades",
    icon: "📊",
    message: "Se actualizó la calificación global del Sprint 2 a 18/20.",
    detail: "Promedio del grupo: 92%. Consulta detalles en Calificaciones.",
  },
  {
    type: "activity-graded",
    icon: "📝",
    message: "Ing. Castro añadió retroalimentación a la Evidencia 05.",
    detail: "Revisa los comentarios sobre el plan de pruebas automatizadas.",
  },
  {
    type: "forum-reply",
    icon: "🔔",
    message: "Hay 3 nuevas respuestas en el tema “Pruebas exploratorias con Playwright”.",
    detail: "Se sugirió cubrir escenarios móviles y de rendimiento.",
  },
  {
    type: "homework",
    icon: "⏱️",
    message: "La tarea “Pruebas de carga” extendió su fecha límite al lunes 18:00 h.",
    detail: "Aviso enviado a alumnos y docentes.",
  },
  {
    type: "grades",
    icon: "🎯",
    message: "Tu promedio en QA Ágil se actualizó a 9.6.",
    detail: "Última modificación registrada por Mtra. Rivera.",
  },
];

function loadPreferences() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    storageUnavailable = true;
    return {};
  }
}

function persistPreferences(state) {
  if (storageUnavailable || typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    storageUnavailable = true;
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function initRealtimeNotifications() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[BOOT_FLAG]) return;
  window[BOOT_FLAG] = true;

  const doc = document;

  const center = doc.querySelector("[data-realtime-center]");
  if (!center) {
    return;
  }

  const toggleButton = center.querySelector("[data-realtime-toggle]");
  const panel = center.querySelector("[data-realtime-panel]");
  const optionsList = center.querySelector("[data-realtime-options]");
  const feedList = center.querySelector("[data-realtime-feed]");
  const statusEl = center.querySelector("[data-realtime-status]");
  const emptyEl = center.querySelector("[data-realtime-empty]");
  const badgeEl = center.querySelector("[data-realtime-badge]");
  const closeButton = center.querySelector("[data-realtime-close]");
  const toggleLabel = center.querySelector("[data-realtime-toggle-label]");

  if (!optionsList || !feedList || !toggleButton || !panel) {

    return;
  }

  const emptyTitleEl = emptyEl?.querySelector("[data-empty-title]") || null;
  const emptyMessageEl = emptyEl?.querySelector("[data-empty-message]") || null;

  const stored = loadPreferences();
  const state = {};
  let shouldPersist = false;

  OPTIONS.forEach((option) => {
    const value = stored[option.id];
    if (typeof value === "boolean") {
      state[option.id] = value;
    } else {
      state[option.id] = true;
      shouldPersist = true;
    }
  });

  if (shouldPersist) {
    persistPreferences(state);
  }

  const toggles = new Map();
  const labelMap = new Map(OPTIONS.map((option) => [option.id, option.label]));
  const timeFormatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let queue = [];
  let timerId = null;

  let unreadCount = 0;
  let isPanelOpen = false;
  let hideTimeoutId = null;

  updateToggleLabel(false);
  updateBadge();
  toggleButton.setAttribute("aria-expanded", "false");

  toggleButton.addEventListener("click", () => {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  if (closeButton) {
    closeButton.addEventListener("click", () => closePanel({ focusToggle: true }));
  }

  doc.addEventListener("pointerdown", (event) => {
    if (!isPanelOpen) return;
    const target = event.target;
    if (target && typeof target === "object" && "nodeType" in target && center.contains(target)) {
      return;
    }
    closePanel();
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPanelOpen) {
      event.preventDefault();
      closePanel({ focusToggle: true });
    }
  });


  renderOptions();
  updateStatus();
  filterFeedItems();
  scheduleNextEvent();


  function updateToggleLabel(open) {
    const labelText = open ? "Cerrar centro de notificaciones" : "Abrir centro de notificaciones";
    if (toggleLabel) {
      toggleLabel.textContent = labelText;
    }
    toggleButton.setAttribute("aria-label", labelText);
  }

  function updateBadge() {
    if (!badgeEl) return;
    if (unreadCount > 0) {
      badgeEl.hidden = false;
      badgeEl.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
      toggleButton.classList.add("has-unread");
    } else {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
      toggleButton.classList.remove("has-unread");
    }
  }

  function openPanel() {
    if (isPanelOpen) return;
    if (hideTimeoutId) {
      window.clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
    panel.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
    });
    isPanelOpen = true;
    toggleButton.setAttribute("aria-expanded", "true");
    updateToggleLabel(true);
    unreadCount = 0;
    updateBadge();
    if (typeof panel.focus === "function") {
      panel.focus({ preventScroll: true });
    }
  }

  function closePanel({ focusToggle = false } = {}) {
    if (!isPanelOpen) return;
    panel.classList.remove("is-open");
    isPanelOpen = false;
    toggleButton.setAttribute("aria-expanded", "false");
    updateToggleLabel(false);
    const handleTransitionEnd = () => {
      if (!isPanelOpen) {
        panel.hidden = true;
      }
    };
    panel.addEventListener("transitionend", handleTransitionEnd, { once: true });
    if (hideTimeoutId) {
      window.clearTimeout(hideTimeoutId);
    }
    hideTimeoutId = window.setTimeout(() => {
      if (!isPanelOpen) {
        panel.hidden = true;
      }
    }, 220);
    if (focusToggle) {
      toggleButton.focus();
    }
  }


  function renderOptions() {
    optionsList.innerHTML = "";
    OPTIONS.forEach((option) => {
      const li = doc.createElement("li");
      li.className = "realtime-option";
      li.dataset.type = option.id;
      li.innerHTML = `
        <div class="realtime-option__leading">
          <span class="realtime-option__icon" aria-hidden="true">${option.icon}</span>
          <div class="realtime-option__content">
            <span class="realtime-option__title">${option.label}</span>
            <p class="realtime-option__description">${option.description}</p>
          </div>
        </div>
        <button
          type="button"
          class="realtime-option__switch"
          role="switch"
          aria-checked="${isEnabled(option.id) ? "true" : "false"}"
          aria-label="Activar notificaciones de ${option.label}"
          data-option-id="${option.id}"
        ></button>
      `;

      const switchEl = li.querySelector(".realtime-option__switch");
      if (switchEl) {
        toggles.set(option.id, switchEl);
        switchEl.addEventListener("click", () => {
          setEnabled(option.id, !isEnabled(option.id));
        });
      }

      optionsList.appendChild(li);
    });
  }

  function isEnabled(id) {
    return state[id] !== false;
  }

  function setEnabled(id, enabled) {
    state[id] = enabled ? true : false;
    const toggle = toggles.get(id);
    if (toggle) {
      toggle.setAttribute("aria-checked", enabled ? "true" : "false");
    }
    persistPreferences(state);
    filterFeedItems();
    updateStatus();
  }

  function getEnabledOptionIds() {
    return OPTIONS.filter((option) => isEnabled(option.id)).map((option) => option.id);
  }

  function updateStatus() {
    if (!statusEl) return;
    const enabledCount = getEnabledOptionIds().length;
    statusEl.setAttribute("data-enabled", enabledCount > 0 ? "true" : "false");
    if (enabledCount > 0) {
      statusEl.innerHTML = `
        <span aria-hidden="true">🟢</span>

        <span>Recibirás ${enabledCount} de ${OPTIONS.length} tipos en tiempo real.</span>

      `;
    } else {
      statusEl.innerHTML = `
        <span aria-hidden="true">⚪</span>

        <span>Activa al menos un tipo para reanudar las alertas en tiempo real.</span>

      `;
    }
  }

  function updateEmptyState() {
    if (!emptyEl) return;
    const enabledCount = getEnabledOptionIds().length;
    const visibleItems = feedList
      ? Array.from(feedList.querySelectorAll(".realtime-feed__item")).filter((item) => !item.hidden).length
      : 0;

    if (enabledCount === 0) {
      emptyEl.hidden = false;
      if (emptyTitleEl) emptyTitleEl.textContent = "Notificaciones en pausa";
      if (emptyMessageEl)
        emptyMessageEl.textContent =
          "Activa al menos un tipo para previsualizar las alertas en tiempo real.";
      return;
    }

    if (visibleItems === 0) {
      emptyEl.hidden = false;
      if (emptyTitleEl) emptyTitleEl.textContent = "Esperando actividad…";
      if (emptyMessageEl)
        emptyMessageEl.textContent =
          "Las próximas entregas, calificaciones o movimientos del foro aparecerán aquí al instante.";
      return;
    }

    emptyEl.hidden = true;
  }

  function filterFeedItems() {
    const enabled = new Set(getEnabledOptionIds());
    feedList.querySelectorAll(".realtime-feed__item").forEach((item) => {
      const type = item.getAttribute("data-type");
      const show = !type || enabled.has(type);
      item.hidden = !show;
    });
    updateEmptyState();
  }

  function publishEvent(event) {
    if (!event) return;
    const card = doc.createElement("article");
    card.className = "realtime-feed__item";
    card.setAttribute("data-type", event.type);
    const enabled = isEnabled(event.type);
    card.hidden = !enabled;
    const timeText = timeFormatter.format(new Date());
    const detailHtml = event.detail ? `<p class="realtime-feed__detail">${event.detail}</p>` : "";
    card.innerHTML = `
      <div class="realtime-feed__item-header">
        <div class="realtime-feed__item-leading">
          <span class="realtime-feed__icon" aria-hidden="true">${event.icon || "🔔"}</span>
          <div class="realtime-feed__item-info">
            <span class="realtime-feed__tag">${labelMap.get(event.type) || "Notificación"}</span>
            <span class="realtime-feed__meta">${timeText}</span>
          </div>
        </div>
      </div>
      <p class="realtime-feed__message">${event.message}</p>
      ${detailHtml}
    `;

    feedList.prepend(card);


    if (!isPanelOpen) {
      unreadCount = Math.min(unreadCount + 1, 99);
      updateBadge();
    }


    requestAnimationFrame(() => {
      card.classList.add("is-visible");
    });

    while (feedList.children.length > 6) {
      feedList.removeChild(feedList.lastElementChild);
    }

    updateEmptyState();
  }

  function nextDelay() {
    const base = 4500;
    const variance = Math.floor(Math.random() * 3500);
    return base + variance;
  }

  function dequeueEvent() {
    if (!queue.length) {
      queue = shuffle(FEED_EVENTS.slice());
    }
    return queue.shift();
  }

  function scheduleNextEvent() {
    clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      const next = dequeueEvent();
      publishEvent(next);
      scheduleNextEvent();
    }, nextDelay());
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRealtimeNotifications, { once: true });
} else {
  initRealtimeNotifications();
}

export {}; // Garantiza que el archivo se trate como módulo.
