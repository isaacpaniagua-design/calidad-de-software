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
:root{--nav-h:74px;--nav-bg:rgba(255,255,255,0.94);--nav-border:rgba(148,163,184,0.35);--nav-shadow:0 20px 45px rgba(15,23,42,0.12);--nav-text:#1e1b4b;--nav-subtitle:#475569;--nav-chip-bg:rgba(99,102,241,0.12);--nav-chip-text:#4338ca;--nav-pill-bg:rgba(99,102,241,0.08);--nav-pill-outline:rgba(79,70,229,0.22);--nav-accent-from:#6366f1;--nav-accent-to:#8b5cf6;--nav-cta-bg:#0f172a;--nav-cta-shadow:0 20px 40px rgba(15,23,42,0.2);}body{margin:0;padding-top:calc(var(--nav-h,74px));}
.qs-nav{position:fixed;top:0;left:0;right:0;margin:0;z-index:1000;background:var(--nav-bg);border-bottom:1px solid var(--nav-border);box-shadow:var(--nav-shadow);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);}
.qs-nav .wrap{max-width:1200px;margin:0 auto;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;}
.qs-brand-shell{display:flex;align-items:center;gap:16px;}
.qs-brand-region{display:flex;align-items:center;gap:16px;min-width:0;}
.qs-brand{display:inline-flex;align-items:center;gap:14px;text-decoration:none;color:var(--nav-text);font-weight:700;border-radius:18px;padding:6px 12px;transition:color .2s ease,transform .2s ease,box-shadow .2s ease;}
.qs-brand:hover,.qs-brand:focus-visible{color:#312e81;transform:translateY(-1px);}
.qs-logo{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#ec4899);color:#fff;font-weight:800;font-size:1rem;letter-spacing:.6px;box-shadow:0 18px 38px rgba(76,29,149,0.25);}
.qs-brand-text{display:flex;flex-direction:column;gap:2px;line-height:1.05;}
.qs-title{color:inherit;font-weight:800;font-size:1.1rem;letter-spacing:.01em;}
.qs-subtitle{font-size:.72rem;text-transform:uppercase;letter-spacing:.22em;font-weight:600;color:var(--nav-subtitle);}
.qs-chip{display:inline-flex;align-items:center;justify-content:center;padding:6px 14px;border-radius:999px;background:var(--nav-chip-bg);color:var(--nav-chip-text);font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;}
.qs-links-region{display:flex;align-items:center;gap:24px;}
.qs-tabs{display:flex;align-items:center;gap:8px;padding:6px;border-radius:999px;background:var(--nav-pill-bg);box-shadow:inset 0 0 0 1px var(--nav-pill-outline);}
.qs-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:999px;border:1px solid transparent;background:transparent;color:#1f2937;font-weight:600;font-size:.95rem;text-decoration:none;line-height:1;transition:color .2s ease,transform .2s ease;z-index:0;}
.qs-btn::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(99,102,241,0.14),rgba(14,165,233,0.12));opacity:0;transition:opacity .2s ease;z-index:-1;}
.qs-btn:hover,.qs-btn:focus-visible{color:#1e1b4b;transform:translateY(-1px);}
.qs-btn:hover::before,.qs-btn:focus-visible::before{opacity:1;}
.qs-btn[aria-current="page"]{color:#fff;box-shadow:0 16px 32px rgba(99,102,241,0.3);}
.qs-btn[aria-current="page"]::before{opacity:1;background:linear-gradient(135deg,var(--nav-accent-from),var(--nav-accent-to));}
.qs-actions{display:flex;align-items:center;gap:12px;}
.qs-cta{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 24px;border-radius:16px;font-weight:700;font-size:.95rem;text-decoration:none;background:var(--nav-cta-bg);color:#f8fafc;box-shadow:var(--nav-cta-shadow);transition:transform .2s ease,box-shadow .2s ease,background .2s ease;}
.qs-cta::after{content:"→";font-size:.95rem;}
.qs-cta:hover,.qs-cta:focus-visible{transform:translateY(-1px);background:linear-gradient(135deg,#0f172a,#1e293b);box-shadow:0 24px 48px rgba(15,23,42,0.28);color:#f8fafc;}
.qs-menu-toggle{display:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;border:0;background:rgba(99,102,241,0.1);color:#312e81;cursor:pointer;transition:background .2s ease,transform .2s ease,box-shadow .2s ease;}
.qs-menu-toggle:hover,.qs-menu-toggle:focus-visible{background:rgba(99,102,241,0.18);transform:translateY(-1px);box-shadow:0 12px 30px rgba(79,70,229,0.24);}
.qs-menu-icon,.qs-menu-icon::before,.qs-menu-icon::after{display:block;position:relative;width:18px;height:2px;border-radius:999px;background:currentColor;transition:transform .25s ease,opacity .25s ease;content:"";}
.qs-menu-icon::before{position:absolute;transform:translateY(-6px);}
.qs-menu-icon::after{position:absolute;transform:translateY(6px);}
.qs-nav.is-open .qs-menu-icon{background:transparent;}
.qs-nav.is-open .qs-menu-icon::before{transform:rotate(45deg);}
.qs-nav.is-open .qs-menu-icon::after{transform:rotate(-45deg);}
html:not(.role-teacher) .teacher-only{display:none !important;}
@media(max-width:960px){.qs-nav .wrap{flex-wrap:wrap;padding:16px 20px 20px;gap:16px;}.qs-brand-shell{width:100%;justify-content:space-between;}.qs-menu-toggle{display:inline-flex;}.qs-links-region{width:100%;flex-direction:column;align-items:stretch;background:rgba(148,163,184,0.15);border-radius:24px;padding:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35);display:none;}.qs-nav.is-open .qs-links-region{display:flex;}.qs-tabs{width:100%;flex-direction:column;align-items:stretch;gap:12px;padding:0;background:transparent;box-shadow:none;}.qs-btn{width:100%;justify-content:flex-start;padding:14px 16px;font-size:1rem;}.qs-btn::before{background:linear-gradient(135deg,rgba(99,102,241,0.22),rgba(14,165,233,0.18));}.qs-actions{width:100%;justify-content:stretch;}.qs-cta{width:100%;justify-content:center;}}
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
      '  <div class="qs-brand-shell">',
      '    <div class="qs-brand-region">',
      '      <a class="qs-brand" href="' + prefix + 'index.html">',
      '        <span class="qs-logo" aria-hidden="true">QS</span>',
      '        <span class="qs-brand-text">',
      '          <span class="qs-title">Calidad de Software</span>',
      '          <span class="qs-subtitle">Campus QS</span>',
      '        </span>',
      '      </a>',
      '      <span class="qs-chip">Edición 2024</span>',
      '    </div>',
      '    <button class="qs-menu-toggle" type="button" aria-expanded="false" aria-controls="qs-nav-links">',
      '      <span class="qs-menu-icon" aria-hidden="true"></span>',
      '      <span class="sr-only">Abrir menú</span>',
      '    </button>',
      '  </div>',
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

    var NAV_VERSION = '2024-12-aurora';
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

            let btn = actions.querySelector('.qs-auth-btn');

            if (!btn) {
              btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'qs-cta qs-auth-btn';
              actions.appendChild(btn);
            }

            if (!btn) return;

            if (!btn.textContent) {
              btn.textContent = 'Iniciar sesión';
              btn.setAttribute('aria-label', 'Iniciar sesión');
              btn.title = 'Iniciar sesión';
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

