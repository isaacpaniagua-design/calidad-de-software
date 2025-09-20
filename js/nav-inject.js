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

    // CSS base del nuevo navbar (versión inyectada)
    var css = `
.qs-brand::before{content:none !important;}
body{padding-top:calc(var(--nav-h,72px)+8px);}
.qs-nav{position:fixed;top:0;left:0;right:0;margin:0;z-index:1000;background:linear-gradient(135deg,rgba(79,70,229,0.94),rgba(124,58,237,0.92));border-bottom:1px solid rgba(148,163,184,0.25);box-shadow:0 18px 48px rgba(15,23,42,0.28);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);}
.qs-nav .wrap{max-width:1200px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;}
.qs-brand{display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:#f8fafc;font-weight:700;border-radius:16px;padding:6px 10px;transition:color .2s ease,transform .2s ease;}
.qs-brand:hover{color:#ffffff;transform:translateY(-1px);}
.qs-logo{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(140deg,#6366f1,#a855f7);color:#fff;font-weight:800;font-size:1rem;letter-spacing:.6px;box-shadow:0 12px 26px rgba(99,102,241,0.45);}
.qs-brand-text{display:flex;flex-direction:column;line-height:1.1;}
.qs-title{color:inherit;font-weight:800;font-size:1.05rem;letter-spacing:.01em;}
.qs-subtitle{font-size:.72rem;text-transform:uppercase;letter-spacing:.18em;font-weight:600;color:rgba(226,232,240,0.72);}
.qs-links-region{display:flex;align-items:center;gap:18px;}
.qs-tabs{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;}
.qs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:999px;border:1px solid transparent;background:rgba(255,255,255,0.16);color:#f8fafc;font-weight:600;font-size:.95rem;text-decoration:none;line-height:1;transition:all .2s ease;box-shadow:0 1px 2px rgba(15,23,42,0.18);}
.qs-btn:hover{background:rgba(255,255,255,0.26);color:#fff;transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,0.22);}
.qs-btn[aria-current="page"]{background:#fff;color:#312e81;box-shadow:0 18px 42px rgba(15,23,42,0.25);}
.qs-actions{display:flex;align-items:center;gap:12px;}
.qs-cta{display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;border-radius:999px;font-weight:700;font-size:.95rem;text-decoration:none;background:linear-gradient(135deg,#f97316,#facc15);color:#111827;box-shadow:0 18px 40px rgba(249,115,22,0.35);transition:transform .2s ease,box-shadow .2s ease;}
.qs-cta:hover{transform:translateY(-1px) scale(1.01);box-shadow:0 24px 48px rgba(249,115,22,0.45);color:#111827;}
.qs-menu-toggle{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:14px;border:0;background:rgba(255,255,255,0.18);color:#f8fafc;cursor:pointer;transition:background .2s ease,transform .2s ease,box-shadow .2s ease;}
.qs-menu-toggle:hover{background:rgba(255,255,255,0.28);transform:translateY(-1px);box-shadow:0 12px 30px rgba(15,23,42,0.28);}
.qs-menu-icon,.qs-menu-icon::before,.qs-menu-icon::after{display:block;position:relative;width:18px;height:2px;border-radius:999px;background:currentColor;transition:transform .25s ease,opacity .25s ease;content:"";}
.qs-menu-icon::before{position:absolute;transform:translateY(-6px);}
.qs-menu-icon::after{position:absolute;transform:translateY(6px);}
.qs-nav.is-open .qs-menu-icon{background:transparent;}
.qs-nav.is-open .qs-menu-icon::before{transform:rotate(45deg);}
.qs-nav.is-open .qs-menu-icon::after{transform:rotate(-45deg);}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
@media(max-width:960px){.qs-nav .wrap{flex-wrap:wrap;padding:14px 20px 18px;gap:14px;}.qs-menu-toggle{display:inline-flex;}.qs-links-region{width:100%;flex-direction:column;align-items:stretch;background:rgba(15,23,42,0.35);border-radius:20px;padding:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12);display:none;}.qs-nav.is-open .qs-links-region{display:flex;}.qs-tabs{flex-direction:column;align-items:stretch;gap:12px;}.qs-btn{width:100%;justify-content:flex-start;background:rgba(255,255,255,0.14);}.qs-actions{width:100%;justify-content:stretch;}.qs-cta{width:100%;}}
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
      '  <a class="qs-brand" href="' + prefix + 'index.html">',
      '    <span class="qs-logo">QS</span>',
      '    <span class="qs-brand-text">',
      '      <span class="qs-title">Plataforma QS</span>',
      '      <span class="qs-subtitle">Calidad de Software</span>',
      '    </span>',
      '  </a>',
      '  <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">',
      '    <span class="qs-menu-icon" aria-hidden="true"></span>',
      '    <span class="sr-only">Abrir menú</span>',
      '  </button>',
      '  <div class="qs-links-region">',
      '    <nav class="qs-tabs" id="qs-nav-links" aria-label="Navegación principal">',
      '      <a class="qs-btn" href="' + prefix + 'materiales.html">Materiales</a>',
      '      <a class="qs-btn" href="' + prefix + 'asistencia.html">Asistencia</a>',
      '      <a class="qs-btn" href="' + prefix + 'calificaciones.html">Calificaciones</a>',
      '      <a class="qs-btn" href="' + prefix + 'Foro.html">Foro</a>',
      '      <a class="qs-btn teacher-only" href="' + prefix + 'paneldocente.html">Panel</a>',
      '    </nav>',
      '    <div class="qs-actions" data-auth-slot>',
      '      <a class="qs-cta" href="' + prefix + 'login.html" data-default-auth-link>Iniciar sesión</a>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    var NAV_VERSION = '2024-11-revamp';
    var nav = document.querySelector('.qs-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'qs-nav';
      nav.innerHTML = template;
      nav.setAttribute('data-role','main-nav');
      nav.setAttribute('data-nav-version', NAV_VERSION);
      document.body.prepend(nav);
    } else {
      nav.classList.add('qs-nav');
      nav.setAttribute('data-role','main-nav');
      if (nav.getAttribute('data-nav-version') !== NAV_VERSION) {
        nav.innerHTML = template;
        nav.setAttribute('data-nav-version', NAV_VERSION);
      }
    }


    function ensureNavToggle(navEl){
      if (!navEl || navEl.__qsToggleBound) return;
      try {
        var toggle = navEl.querySelector('.qs-menu-toggle');
        var region = navEl.querySelector('.qs-links-region');
        if (!toggle || !region) return;
        navEl.__qsToggleBound = true;
        function setState(open){
          if (open) navEl.classList.add('is-open');
          else navEl.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          region.setAttribute('data-open', open ? 'true' : 'false');
        }
        setState(false);
        toggle.addEventListener('click', function(){
          setState(!navEl.classList.contains('is-open'));
        });
        region.addEventListener('click', function(evt){
          var anchor = evt.target && evt.target.closest ? evt.target.closest('a[href]') : null;
          if (anchor) setState(false);
        });
        window.addEventListener('resize', function(){
          if (window.innerWidth > 960) setState(false);
        });
      } catch (_) {}
    }
    if (!window.setupQsNavToggle) {
      window.setupQsNavToggle = ensureNavToggle;
    }
    (window.setupQsNavToggle || ensureNavToggle)(nav);


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
            const actions = document.querySelector('.qs-actions');
            if (!navTabs || !actions) return;
            const defaultLink = actions.querySelector('[data-default-auth-link]');
            if (defaultLink) defaultLink.remove();

            if (!btn) {
              btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'qs-cta qs-auth-btn';
              actions.appendChild(btn);
            }
            // Localiza el enlace al panel docente (Panel).  Puede estar ausente si no se inyectó la pestaña.
            const panelLink = navTabs.querySelector('a[href$="paneldocente.html"]');

            const AUTH_STORAGE_KEY = 'qs_auth_state';
            const readStoredAuthState = () => {
              try {
                const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
                if (sessionValue) return sessionValue;
              } catch (_) {}
              try {
                const localValue = localStorage.getItem(AUTH_STORAGE_KEY);
                if (localValue) return localValue;
              } catch (_) {}
              try {
                if (window.__qsAuthState) return window.__qsAuthState;
              } catch (_) {}
              return '';
            };

            const persistAuthState = (state) => {
              try { sessionStorage.setItem(AUTH_STORAGE_KEY, state); } catch (_) {}
              try { localStorage.setItem(AUTH_STORAGE_KEY, state); } catch (_) {}
              try { window.__qsAuthState = state; } catch (_) {}
            };

            function setSignInAppearance() {
              btn.textContent = 'Iniciar sesión';
              btn.setAttribute('aria-label', 'Iniciar sesión');
              btn.title = 'Iniciar sesión';
            }

            function setSignOutAppearance() {
              btn.textContent = 'Cerrar sesión';
              btn.setAttribute('aria-label', 'Cerrar sesión');
              btn.title = 'Cerrar sesión';
            }



            // Escucha cambios de autenticación para ajustar el botón y ocultar el enlace de panel
            onAuth(async (user) => {
              const root = document.documentElement;
              if (user) {
                persistAuthState('signed-in');
                setSignOutAppearance();
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
                persistAuthState('signed-out');
                setSignInAppearance();
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

