document.addEventListener('DOMContentLoaded', () => {
  try {
    // Ensure shared CSS is loaded
    const hasLayoutCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(l => (l.getAttribute('href') || '').includes('css/layout.css'));
    if (!hasLayoutCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/layout.css';
      document.head.appendChild(link);
    }

    // Ensure consistent solid background
    document.documentElement.style.background = '#764ba2';
    document.body.style.background = '#764ba2';
    document.body.style.minHeight = '100vh';

    // Build shared nav
    const navHtml = `
      <div class="wrap">
        <a class="qs-brand" href="index.html"><span>Plataforma QS</span></a>
        <nav class="qs-tabs" aria-label="Navegación">
          <a class="qs-btn" href="materiales.html">Materiales</a>
          <a class="qs-btn" href="asistencia.html">Asistencia</a>
          <a class="qs-btn" href="calificaciones.html">Calificaciones</a>
          <a class="qs-btn" href="Foro.html">Foro</a>
          <a class="qs-btn" href="paneldocente.html">Panel</a>
          <a class="qs-btn" href="roadmap.html">Roadmap</a>
        </nav>
      </div>`;

    let nav = document.querySelector('.qs-nav');
    if (nav) {
      nav.innerHTML = navHtml;
    } else {
      nav = document.createElement('div');
      nav.className = 'qs-nav';
      nav.innerHTML = navHtml;
      document.body.prepend(nav);
    }

    // Adjust body padding-top to navbar height (override CSS fallback)
    const setPad = () => {
      const h = nav?.offsetHeight || 70;
      document.body.style.setProperty('padding-top', h + 'px', 'important');
    };
    setPad();
    window.addEventListener('resize', setPad);

    // Shared footer with automatic year
    const year = new Date().getFullYear();
    const footerHtml = `<div class="footer-content">© ${year} Plataforma QS - Calidad de Software | Isaac Paniagua</div>`;
    let footer = document.querySelector('footer.footer');
    if (footer) {
      footer.innerHTML = footerHtml;
    } else {
      footer = document.createElement('footer');
      footer.className = 'footer';
      footer.innerHTML = footerHtml;
      document.body.appendChild(footer);
    }

    // Mark active tab
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.qs-tabs a.qs-btn').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href === path) a.setAttribute('aria-current', 'page');
    });
  } catch (_) { /* noop */ }
});
