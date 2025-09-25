const VIEWER_ID = "fileViewer";
let viewerEl = null;
let dialogEl = null;
let titleEl = null;
let frameEl = null;
let fallbackLinkEl = null;
let initialized = false;
let lastActiveElement = null;

function queryElements() {
  if (viewerEl) return true;
  viewerEl = document.getElementById(VIEWER_ID);
  if (!viewerEl) return false;
  dialogEl = viewerEl.querySelector(".file-viewer__dialog");
  titleEl = viewerEl.querySelector("[data-file-viewer-title]");
  frameEl = viewerEl.querySelector("[data-file-viewer-frame]");
  fallbackLinkEl = viewerEl.querySelector("[data-file-viewer-download]");
  if (dialogEl && !dialogEl.hasAttribute("tabindex")) {
    dialogEl.setAttribute("tabindex", "-1");
  }
  return true;
}

function onKeyDown(event) {
  if (!viewerEl || viewerEl.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeFileViewer();
  }
}

function onFocus(event) {
  if (!viewerEl || viewerEl.hidden) return;
  if (!dialogEl) return;
  if (!dialogEl.contains(event.target)) {
    dialogEl.focus({ preventScroll: true });
  }
}

function clearFrame() {
  if (!frameEl) return;
  try {
    frameEl.src = "about:blank";
  } catch (error) {
    frameEl.removeAttribute("src");
  }
}

export function closeFileViewer() {
  if (!viewerEl) return;
  viewerEl.hidden = true;
  viewerEl.setAttribute("aria-hidden", "true");
  viewerEl.classList.remove("is-visible");
  clearFrame();
  if (document.body) {
    document.body.classList.remove("has-file-viewer");
  }
  if (lastActiveElement && typeof lastActiveElement.focus === "function") {
    lastActiveElement.focus({ preventScroll: true });
  }
  lastActiveElement = null;
}

function attachListeners() {
  if (!viewerEl || initialized) return;
  const closeTriggers = viewerEl.querySelectorAll("[data-file-viewer-close]");
  closeTriggers.forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      closeFileViewer();
    });
  });
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("focus", onFocus, true);
  initialized = true;
}

export function initializeFileViewer() {
  if (!queryElements()) return false;
  attachListeners();
  return true;
}

export function openFileViewer(url, options = {}) {
  if (!url) return false;
  if (!queryElements()) {
    window.open(url, "_blank", "noopener");
    return false;
  }
  attachListeners();
  lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (document.body) {
    document.body.classList.add("has-file-viewer");
  }
  viewerEl.hidden = false;
  viewerEl.setAttribute("aria-hidden", "false");
  viewerEl.classList.add("is-visible");
  if (titleEl) {
    titleEl.textContent = options.title || "Vista previa del archivo";
  }
  if (fallbackLinkEl) {
    const linkUrl = options.downloadUrl || url;
    fallbackLinkEl.href = linkUrl;
    if (options.fileName) {
      fallbackLinkEl.setAttribute("download", options.fileName);
    } else {
      fallbackLinkEl.removeAttribute("download");
    }
  }
  if (frameEl) {
    frameEl.src = url;
  }
  if (dialogEl) {
    dialogEl.focus({ preventScroll: true });
  }
  return true;
}
