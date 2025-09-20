(function setupStudentNav(){
  if (window.__qsStudentNavFixed) return;
  window.__qsStudentNavFixed = true;
  var navReady = false;

  function injectCriticalStyles() {
    try {
      if (document.getElementById('qs-nav-critical')) return;
      var style = document.createElement('style');
      style.id = 'qs-nav-critical';
      style.textContent = `:root{--nav-h:72px;--anchor-offset:calc(var(--nav-h)+8px);}html{scroll-padding-top:var(--nav-h);}body{margin:0;padding-top:var(--nav-h);transition:padding-top .2s ease;} .qs-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(255,255,255,0.96);backdrop-filter:saturate(140%) blur(18px);border-bottom:1px solid rgba(148,163,184,0.18);box-shadow:0 12px 32px rgba(15,23,42,0.12);} .qs-nav .wrap{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;} .qs-brand{display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:#1f2937;font-weight:800;font-size:1.05rem;line-height:1;border-radius:18px;padding:6px 12px;} .qs-logo{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:.85rem;font-weight:800;box-shadow:0 6px 18px rgba(102,126,234,0.35);} .qs-tabs{display:flex;gap:10px;flex-wrap:nowrap;overflow-x:auto;padding:6px;border-radius:999px;background:rgba(255,255,255,0.45);backdrop-filter:blur(10px);} .qs-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:999px;border:0;font-weight:600;font-size:.92rem;text-decoration:none;color:#374151;background:rgba(255,255,255,0.78);box-shadow:0 1px 0 rgba(15,23,42,0.04);transition:background .2s ease,color .2s ease,transform .2s ease,box-shadow .2s ease;} .qs-btn:hover{color:#fff;background:linear-gradient(135deg,#667eea,#764ba2);box-shadow:0 12px 24px rgba(102,126,234,0.35);transform:translateY(-1px);} .qs-btn[aria-current="page"]{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;box-shadow:0 10px 28px rgba(102,126,234,0.45);} html:not(.role-teacher) .teacher-only{display:none !important;}`;
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

  function afterNav(nav) {
    if (!nav || navReady) return;
    navReady = true;
    markActive(nav);
    adjustSpacing(nav);

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
