// Minimal, UTF-8-safe back-to-home button per page
document.addEventListener('DOMContentLoaded', function () {
  try {
    var fname = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (fname === 'index.html') return; // no button on home
    if (document.getElementById('btn-back-home')) return;

    var a = document.createElement('a');
    a.id = 'btn-back-home';
    a.href = 'index.html';
    a.setAttribute('aria-label', 'Regresar al inicio');
    a.title = 'Regresar al inicio';
    a.innerHTML = '&larr; Inicio';
    var s = a.style;
    s.position = 'fixed';
    s.left = '16px';
    s.bottom = '16px';
    s.zIndex = '950';
    s.padding = '10px 14px';
    s.borderRadius = '9999px';
    s.textDecoration = 'none';
    s.fontWeight = '700';
    s.background = 'linear-gradient(135deg,#667eea,#764ba2)';
    s.color = '#fff';
    s.boxShadow = '0 6px 18px rgba(0,0,0,.2)';
    s.userSelect = 'none';
    document.body.appendChild(a);
  } catch (e) {
    // noop
  }
});

