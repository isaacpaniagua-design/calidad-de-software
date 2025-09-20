(function setupStudentNav(){
  if (window.__qsStudentNavFixed) return;
  window.__qsStudentNavFixed = true;
  var navReady = false;

  function injectCriticalStyles() {
    try {
      if (document.getElementById('qs-nav-critical')) return;
      var style = document.createElement('style');
      style.id = 'qs-nav-critical';
      style.textContent = `
:root{--nav-h:74px;--anchor-offset:calc(var(--nav-h)+8px);--nav-bg:rgba(255,255,255,0.94);--nav-border:rgba(148,163,184,0.35);--nav-shadow:0 20px 45px rgba(15,23,42,0.12);--nav-text:#1e1b4b;--nav-subtitle:#475569;--nav-chip-bg:rgba(99,102,241,0.12);--nav-chip-text:#4338ca;--nav-pill-bg:rgba(99,102,241,0.08);--nav-pill-outline:rgba(79,70,229,0.22);--nav-accent-from:#6366f1;--nav-accent-to:#8b5cf6;--nav-cta-bg:#0f172a;--nav-cta-shadow:0 20px 40px rgba(15,23,42,0.2);--motion-duration-fast:160ms;--motion-duration:220ms;--motion-duration-slow:320ms;--motion-easing:cubic-bezier(0.4,0,0.2,1);--motion-easing-emphasized:cubic-bezier(0.34,0.7,0.25,1);}
html{scroll-padding-top:var(--nav-h);scroll-behavior:smooth;}
body{margin:0;padding-top:var(--nav-h);transition:padding-top var(--motion-duration) var(--motion-easing);}
.qs-nav{position:fixed;top:0;left:0;right:0;z-index:1000;margin:0;background:var(--nav-bg);border-bottom:1px solid var(--nav-border);box-shadow:var(--nav-shadow);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);}
.qs-nav .wrap{max-width:1200px;margin:0 auto;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;}
.qs-brand-shell{display:flex;align-items:center;gap:16px;}
.qs-brand-region{display:flex;align-items:center;gap:16px;min-width:0;}
.qs-brand{display:inline-flex;align-items:center;gap:14px;text-decoration:none;color:var(--nav-text);font-weight:700;border-radius:18px;padding:6px 12px;transition:transform var(--motion-duration) var(--motion-easing),box-shadow var(--motion-duration) var(--motion-easing),color var(--motion-duration) var(--motion-easing);}
.qs-brand:hover,.qs-brand:focus-visible{color:#312e81;transform:translateY(-1px);}
.qs-logo{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#ec4899);color:#fff;font-weight:800;font-size:1rem;letter-spacing:.6px;box-shadow:0 18px 38px rgba(76,29,149,0.25);}
.qs-brand-text{display:flex;flex-direction:column;gap:2px;line-height:1.05;}
.qs-title{color:inherit;font-weight:800;font-size:1.1rem;letter-spacing:.01em;}
.qs-subtitle{font-size:.72rem;text-transform:uppercase;letter-spacing:.22em;font-weight:600;color:var(--nav-subtitle);}
.qs-chip{display:inline-flex;align-items:center;justify-content:center;padding:6px 14px;border-radius:999px;background:var(--nav-chip-bg);color:var(--nav-chip-text);font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;}
.qs-links-region{display:flex;align-items:center;gap:24px;}
.qs-tabs{display:flex;align-items:center;gap:8px;padding:6px;border-radius:999px;background:var(--nav-pill-bg);box-shadow:inset 0 0 0 1px var(--nav-pill-outline);}
.qs-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:999px;border:1px solid transparent;background:transparent;color:#1f2937;font-weight:600;font-size:.95rem;text-decoration:none;line-height:1;transition:color var(--motion-duration) var(--motion-easing),transform var(--motion-duration) var(--motion-easing);z-index:0;}
.qs-btn::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(99,102,241,0.14),rgba(14,165,233,0.12));opacity:0;transition:opacity var(--motion-duration) var(--motion-easing);z-index:-1;}
.qs-btn:hover,.qs-btn:focus-visible{color:#1e1b4b;transform:translateY(-1px);}
.qs-btn:hover::before,.qs-btn:focus-visible::before{opacity:1;}
.qs-btn[aria-current="page"]{color:#fff;box-shadow:0 16px 32px rgba(99,102,241,0.3);}
.qs-btn[aria-current="page"]::before{opacity:1;background:linear-gradient(135deg,var(--nav-accent-from),var(--nav-accent-to));}
.qs-actions{display:flex;align-items:center;gap:12px;}
.qs-cta{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 24px;border-radius:16px;font-weight:700;font-size:.95rem;text-decoration:none;background:var(--nav-cta-bg);color:#f8fafc;box-shadow:var(--nav-cta-shadow);transition:transform var(--motion-duration) var(--motion-easing),box-shadow var(--motion-duration) var(--motion-easing),background var(--motion-duration) var(--motion-easing);}
.qs-cta::after{content:"→";font-size:.95rem;}
.qs-cta:hover,.qs-cta:focus-visible{transform:translateY(-1px);background:linear-gradient(135deg,#0f172a,#1e293b);box-shadow:0 24px 48px rgba(15,23,42,0.28);color:#f8fafc;}
.qs-menu-toggle{display:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;border:0;background:rgba(99,102,241,0.1);color:#312e81;cursor:pointer;transition:background var(--motion-duration) var(--motion-easing),transform var(--motion-duration) var(--motion-easing),box-shadow var(--motion-duration) var(--motion-easing);}
.qs-menu-toggle:hover,.qs-menu-toggle:focus-visible{background:rgba(99,102,241,0.18);transform:translateY(-1px);box-shadow:0 12px 30px rgba(79,70,229,0.24);}
.qs-menu-icon,.qs-menu-icon::before,.qs-menu-icon::after{display:block;position:relative;width:18px;height:2px;border-radius:999px;background:currentColor;transition:transform var(--motion-duration-slow) var(--motion-easing),opacity var(--motion-duration-slow) var(--motion-easing);content:"";}
.qs-menu-icon::before{position:absolute;transform:translateY(-6px);}
.qs-menu-icon::after{position:absolute;transform:translateY(6px);}
.qs-nav.is-open .qs-menu-icon{background:transparent;}
.qs-nav.is-open .qs-menu-icon::before{transform:rotate(45deg);}
.qs-nav.is-open .qs-menu-icon::after{transform:rotate(-45deg);}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
@media(prefers-reduced-motion:reduce){:root{--motion-duration-fast:0ms;--motion-duration:0ms;--motion-duration-slow:0ms;}html{scroll-behavior:auto;}*,*::before,*::after{transition-duration:0ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important;}}
@media(max-width:960px){.qs-nav .wrap{flex-wrap:wrap;padding:16px 20px 20px;gap:16px;}.qs-brand-shell{width:100%;justify-content:space-between;}.qs-menu-toggle{display:inline-flex;}.qs-links-region{width:100%;flex-direction:column;align-items:stretch;background:rgba(148,163,184,0.15);border-radius:24px;padding:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35);display:none;}.qs-nav.is-open .qs-links-region{display:flex;}.qs-tabs{width:100%;flex-direction:column;align-items:stretch;gap:12px;padding:0;background:transparent;box-shadow:none;}.qs-btn{width:100%;justify-content:flex-start;padding:14px 16px;font-size:1rem;}.qs-btn::before{background:linear-gradient(135deg,rgba(99,102,241,0.22),rgba(14,165,233,0.18));}.qs-actions{width:100%;justify-content:stretch;}.qs-cta{width:100%;justify-content:center;}}
html:not(.role-teacher) .teacher-only{display:none !important;}`

      document.head.appendChild(style);
    } catch (_) {
      // ignore
    }
  }

  function syncRole() {
    try {
      var root = document.documentElement;
      if (!root) return;
      var stored = localStorage.getItem('qs_role');
      root.classList.remove('role-teacher', 'role-student');
      if (stored === 'docente') {
        root.classList.add('role-teacher');
      } else {
        root.classList.add('role-student');
      }
    } catch (_) {
      try {
        document.documentElement.classList.add('role-student');
      } catch (err) {
        // ignore
      }
    }
  }

  function markActive(nav) {
    try {
      var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      nav.querySelectorAll('.qs-tabs a.qs-btn').forEach(function (a) {
        var href = (a.getAttribute('href') || '').split('?')[0].toLowerCase();
        if (href === current) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    } catch (_) {}
  }

  function adjustSpacing(nav) {
    if (!nav) return;
    try {
      var rect = nav.getBoundingClientRect();
      var h = rect && rect.height ? Math.round(rect.height) : 72;
      if (!isFinite(h) || h <= 0) h = 72;
      h = Math.max(56, Math.min(96, h));
      document.documentElement.style.setProperty('--nav-h', h + 'px');
      document.documentElement.style.setProperty('--anchor-offset', h + 8 + 'px');
      document.body.style.paddingTop = h + 'px';
    } catch (_) {}
  }

  function init() {
    injectCriticalStyles();
    syncRole();

    var nav = document.querySelector('.qs-nav');
    if (!nav) {
      waitForNav(0);
      return;
    }
    afterNav(nav);
  }

  function waitForNav(tries) {
    if (tries > 10) return;
    requestAnimationFrame(function () {
      var found = document.querySelector('.qs-nav');
      if (found) {
        afterNav(found);
      } else {
        waitForNav(tries + 1);
      }
    });
  }

  function setupNavToggle(nav) {
    if (!nav || nav.__qsToggleBound) return;
    try {
      var toggle = nav.querySelector('.qs-menu-toggle');
      var region = nav.querySelector('.qs-links-region');
      if (!toggle || !region) return;
      nav.__qsToggleBound = true;
      function setState(open) {
        if (open) nav.classList.add('is-open');
        else nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        region.setAttribute('data-open', open ? 'true' : 'false');
      }
      setState(false);
      toggle.addEventListener('click', function () {
        var next = !nav.classList.contains('is-open');
        setState(next);
      });
      region.addEventListener('click', function (evt) {
        var anchor = evt.target && evt.target.closest ? evt.target.closest('a[href]') : null;
        if (anchor) setState(false);
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 960) setState(false);
      });
    } catch (_) {}
  }
  window.setupQsNavToggle = window.setupQsNavToggle || setupNavToggle;

  function afterNav(nav) {
    if (!nav || navReady) return;
    navReady = true;
    markActive(nav);
    adjustSpacing(nav);
    (window.setupQsNavToggle || setupNavToggle)(nav);

    window.addEventListener('resize', function () {
      adjustSpacing(nav);
    });

    if (window.ResizeObserver) {
      try {
        var ob = new ResizeObserver(function () {
          adjustSpacing(nav);
        });
        window.__qsNavObserver = ob;
        ob.observe(nav);
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
