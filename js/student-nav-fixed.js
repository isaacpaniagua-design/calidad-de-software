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
:root{--nav-h:72px;--anchor-offset:calc(var(--nav-h)+8px);}
html{scroll-padding-top:var(--nav-h);}
body{margin:0;padding-top:var(--nav-h);transition:padding-top .2s ease;}
.qs-nav{position:fixed;top:0;left:0;right:0;z-index:1000;margin:0;background:linear-gradient(135deg,rgba(79,70,229,0.94),rgba(124,58,237,0.92));border-bottom:1px solid rgba(148,163,184,0.25);box-shadow:0 18px 48px rgba(15,23,42,0.28);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);}
.qs-nav .wrap{max-width:1200px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;}
.qs-brand{display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:#f8fafc;font-weight:700;border-radius:16px;padding:6px 10px;transition:color .2s ease,transform .2s ease;}
.qs-brand:hover{color:#fff;transform:translateY(-1px);}
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
