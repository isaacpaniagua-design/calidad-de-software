// Marca rol previamente almacenado para evitar flashes de contenido docente.
(function syncRoleFromStorage(){
  try {
    var root = document.documentElement;
    var stored = localStorage.getItem('qs_role');
    if (root) {
      root.classList.remove('role-teacher', 'role-student');
      if (stored === 'docente') {
        root.classList.add('role-teacher');
      } else if (stored) {
        root.classList.add('role-student');
      }
    }
  } catch (_) {}
})();
function initNavInject(){
  try{
    var prefix = '';
    try {
      var segments = (location.pathname || '').split('/').filter(Boolean);
      var upLevels = Math.max(segments.length - 2, 0);
      for (var i = 0; i < upLevels; i++) prefix += '../';
    } catch (_) {
      prefix = '';
    }

    // Garantiza favicon disponible para evitar peticiones 404.
    try {
      var hasIcon = document.querySelector("link[rel*='icon']");
      if (!hasIcon) {
        var icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = prefix + 'favicon.ico';
        document.head && document.head.appendChild(icon);
      }
    } catch (_) {}

    try {
      var hasLayout = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(function(link){
        var href = link.getAttribute('href') || link.href || '';
        return href.indexOf('layout.css') !== -1;
      });
      if (!hasLayout) {
        var cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = prefix + 'css/layout.css';
        document.head && document.head.appendChild(cssLink);
      }
    } catch (_) {}

    // Basic CSS to match index styling
    var css = `
      /* Override any previous pseudo icon */
      .qs-brand::before { content: none !important; }
      body { padding-top: calc(var(--nav-h, 64px) + 8px); }
      .qs-nav { position: fixed; top:0; left:0; right:0; z-index:1000; background:#ffffff; border-bottom:1px solid #e5e7eb; }
      .qs-nav .wrap { max-width:1200px; margin:0 auto; padding:14px 20px; display:flex; gap:16px; align-items:center; justify-content:space-between; }
      .qs-brand { display:flex; gap:10px; align-items:center; color:#1f2937; font-weight:700; font-size:1.1rem; text-decoration:none; padding:6px 0; }
      .qs-brand:hover { color:#1d4ed8; }
      .qs-logo { width:28px; height:28px; border-radius:6px; background:#4f46e5; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:.9rem; letter-spacing:.5px; }
      .qs-title { color:inherit; font-weight:700; }
      .qs-tabs { display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; white-space:nowrap; background:none; padding:4px; border-radius:999px; }
      .qs-btn { border:0; padding:8px 14px; border-radius:999px; background:transparent; color:#374151; text-decoration:none; font-weight:600; font-size:.9rem; flex:0 0 auto; }
      .qs-btn:hover { background:#e0e7ff; color:#1d4ed8; }
      .qs-btn[aria-current="page"] { background:#4338ca; color:#fff; }
    `;

    var style = document.getElementById('qs-nav-inline-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'qs-nav-inline-style';
      document.head.appendChild(style);
    }
    style.textContent = css;

    var template = [
      '<div class="wrap">',
      '  <a class="qs-brand" href="index.html"><span class="qs-logo">QS</span><span class="qs-title">Plataforma QS</span></a>',
      '  <nav class="qs-tabs" aria-label="Navegación">',
      '    <a class="qs-btn" href="materiales.html">Materiales</a>',
      '    <a class="qs-btn" href="asistencia.html">Asistencia</a>',
      '    <a class="qs-btn" href="calificaciones.html">Calificaciones</a>',
      '    <a class="qs-btn" href="Foro.html">Foro</a>',
      '    <a class="qs-btn teacher-only" href="paneldocente.html">Panel</a>',
      '  </nav>',
      '</div>'
    ].join('');

    var nav = document.querySelector('.qs-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'qs-nav';
      nav.innerHTML = template;
      nav.setAttribute('data-role','main-nav');
      document.body.prepend(nav);
    } else {
      nav.classList.add('qs-nav');
      nav.setAttribute('data-role','main-nav');
      var hasBrand = !!nav.querySelector('.qs-brand');
      var hasTabs = !!nav.querySelector('.qs-tabs');
      if (!hasBrand || !hasTabs || !nav.children || nav.children.length === 0) {
        nav.innerHTML = template;
      }
    }

    function getStoredAuthState(){
      var key = 'qs_auth_state';
      try {
        var sessionValue = sessionStorage.getItem(key);
        if (sessionValue) return sessionValue;
      } catch (_) {}
      try {
        var localValue = localStorage.getItem(key);
        if (localValue) return localValue;
      } catch (_) {}
      if (typeof window !== 'undefined' && window.__qsAuthState) {
        return window.__qsAuthState;
      }
      return '';
    }

    function shouldBypassAuth(href){
      if (!href) return true;
      var trimmed = href.trim();
      if (!trimmed) return true;
      var lower = trimmed.split('#')[0].split('?')[0].toLowerCase();
      if (!lower) return true;
      if (lower === 'login.html' || lower === '404.html') return true;
      var lowerTrimmed = trimmed.toLowerCase();
      if (lowerTrimmed.indexOf('mailto:') === 0 || lowerTrimmed.indexOf('tel:') === 0) return true;
      if (lowerTrimmed.indexOf('javascript:') === 0) return true;
      if (/^https?:\/\//i.test(trimmed)) return true;
      if (trimmed.charAt(0) === '#') return true;
      return false;
    }

    function bindNavAuthRedirect(navEl){
      if (!navEl || navEl.__qsAuthRedirectBound) return;
      navEl.__qsAuthRedirectBound = true;
      navEl.addEventListener('click', function(evt){
        try {
          var anchor = evt.target && evt.target.closest ? evt.target.closest('a[href]') : null;
          if (!anchor) return;
          if (!navEl.contains(anchor)) return;
          var href = anchor.getAttribute('href') || '';
          if (shouldBypassAuth(href)) return;
          var state = getStoredAuthState();
          if (state && state !== 'signed-in' && state !== 'unknown') {
            evt.preventDefault();
            var loginUrl = prefix + 'login.html';
            try {
              if (window.location.replace) {
                window.location.replace(loginUrl);
              } else {
                window.location.href = loginUrl;
              }
            } catch (_) {
              window.location.href = loginUrl;
            }
          }
        } catch (_) {}
      }, true);
    }

    bindNavAuthRedirect(nav);

    // Mark active link
    var current = (location.pathname.split('/').pop()||'').toLowerCase();
    document.querySelectorAll('.qs-tabs a.qs-btn').forEach(function(a){
      var href = (a.getAttribute('href')||'').toLowerCase();
      if(href === current){ a.setAttribute('aria-current','page'); }
    });
    // Offset sticky/fixed toolbars and ensure scroll
    try {
      var navH = document.querySelector('.qs-nav')?.getBoundingClientRect().height || 72;
      var pad = navH + 4;
      document.documentElement.style.setProperty('--qs-nav-h', navH + 'px');
      document.documentElement.style.setProperty('--nav-h', navH + 'px');
      document.documentElement.style.setProperty('--anchor-offset', (navH + 8) + 'px');
      try { document.body.style.setProperty('padding-top', pad + 'px', 'important'); } catch (_) { document.body.style.paddingTop = pad + 'px'; }
      var fixedNodes = Array.from(document.querySelectorAll('.fixed, [style*="position:fixed"], [class*=" top-0"], [class*="top-0 "]'));
      fixedNodes.forEach(function(el){
        var cs = window.getComputedStyle(el);
        if ((cs.position === 'fixed' || cs.position === 'sticky') && (cs.top === '0px' || cs.top === '0')){
          el.style.top = (navH + 8) + 'px';
        }
      });
      document.documentElement.style.overflowY = document.documentElement.style.overflowY || 'auto';
      document.body.style.overflowY = document.body.style.overflowY || 'auto';
      var pb = parseInt(window.getComputedStyle(document.body).paddingBottom || '0', 10) || 0;
      if (pb < 12) document.body.style.paddingBottom = '12px';
    } catch(e){}

    // Insert an authentication guard script on pages that require a logged-in user.
    // This dynamically loads js/auth-guard.js as a module, which redirects to login.html
    // if no user is signed in. Skip this injection on the login and 404 pages.
    try {
      var pg = (location.pathname.split('/')?.pop() || '').toLowerCase();
      if (pg !== 'login.html' && pg !== '404.html') {
        var guard = document.createElement('script');
        guard.type = 'module';
        guard.src = prefix + 'js/auth-guard.js';
        document.body.appendChild(guard);
      }
    } catch (e) {}

    // Always append a sign‑in/out button to the navigation tabs.  This button
    // uses Firebase to determine whether a user is logged in and will either
    // trigger Google sign‑in or sign the user out accordingly.  We compute
    // a relative base path to import firebase.js correctly from pages in
    // subfolders (e.g. sesiones/).  The button is appended only once
    // after the navigation has been injected.
    try {
      // Only inject on pages other than login and 404
      var pg2 = (location.pathname.split('/')?.pop() || '').toLowerCase();
      if (pg2 !== 'login.html' && pg2 !== '404.html') {
        var signScript = document.createElement('script');
        signScript.type = 'module';
        signScript.textContent = `
          (async () => {
            // Compute base path relative to the current page.  We need to go up
            // one directory level for each extra path segment beyond the
            // project root.  Example: '/calidad-de-software/index.html' has
            // segments ['calidad-de-software','index.html'] => upCount=0.
            // '/calidad-de-software/sesiones/sesion1.html' => segments
            // ['calidad-de-software','sesiones','sesion1.html'] => upCount=1.
            const segments = window.location.pathname.split('/')
              .filter(Boolean);
            let upCount = Math.max(segments.length - 2, 0);
            let basePath = '';
            for (let i = 0; i < upCount; i++) basePath += '../';
            const modulePath = basePath + 'js/firebase.js';
            // Prepend './' when prefix is empty so that import specifier is treated as a relative path.
            const importPath = (basePath === '') ? './js/firebase.js' : modulePath;
            const firebaseModule = await import(importPath);
            const { onAuth, signInWithGoogleOpen, signOutCurrent, isTeacherEmail, isTeacherByDoc } = firebaseModule;
            const navTabs = document.querySelector('.qs-tabs');
            if (!navTabs) return;
            // Localiza el enlace al panel docente (Panel).  Puede estar ausente si no se inyectó la pestaña.
            const panelLink = navTabs.querySelector('a[href$="paneldocente.html"]');

            // Calcular página actual (sin parámetros) para condicionar la creación del botón de inicio/cierre de sesión.
            // Crea o reutiliza el botón de inicio/cierre de sesión una sola vez.
            let btn = navTabs.querySelector('.qs-auth-btn');
            if (!btn) {
              btn = document.createElement('button');
              btn.className = 'qs-btn qs-auth-btn';
              btn.style.marginLeft = '8px';
              navTabs.appendChild(btn);
            }
            // Escucha cambios de autenticación para ajustar el texto del botón y ocultar el enlace de panel
            onAuth(async (user) => {
              const root = document.documentElement;
              if (user) {
                btn.textContent = 'Cerrar sesión';
                btn.onclick = () => signOutCurrent();
                // Ocultar el panel docente a usuarios que no sean profesores.
                let okTeacher = false;
                try {
                  okTeacher = isTeacherEmail(user.email) || (await isTeacherByDoc(user.uid));
                } catch (_) {
                  okTeacher = false;
                }
                if (root) {
                  if (okTeacher) {
                    root.classList.add('role-teacher');
                    root.classList.remove('role-student');
                  } else {
                    root.classList.remove('role-teacher');
                    root.classList.add('role-student');
                  }
                }
                if (panelLink) {
                  panelLink.style.display = okTeacher ? '' : 'none';
                }
              } else {
                btn.textContent = 'Iniciar sesión';
                btn.onclick = () => signInWithGoogleOpen();
                if (root) {
                  root.classList.remove('role-teacher');
                  root.classList.add('role-student');
                }
                // Sin sesión: oculta el panel docente
                if (panelLink) panelLink.style.display = 'none';
              }
            });
          })().catch(console.error);
        `;
        document.body.appendChild(signScript);
      }
    } catch (e) {}
  }catch(e){ /* noop */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavInject, { once: true });
} else {
  initNavInject();
}

