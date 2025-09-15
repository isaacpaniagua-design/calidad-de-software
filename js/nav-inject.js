// Injects a top nav similar to index, without altering page structure
document.addEventListener('DOMContentLoaded', function(){
  try{
    // Basic CSS to match index styling
    var css = `
      /* Override any previous pseudo icon */
      .qs-brand::before { content: none !important; }
      body { padding-top: 72px; }
      .qs-nav { position: fixed; top:0; left:0; right:0; z-index:1000; backdrop-filter:saturate(140%) blur(18px); background:rgba(255,255,255,0.95); border-bottom:1px solid rgba(255,255,255,0.2); box-shadow:0 8px 32px rgba(0,0,0,0.10); }
      .qs-nav .wrap { max-width:1200px; margin:0 auto; padding:14px 20px; display:flex; gap:16px; align-items:center; justify-content:space-between; }
      .qs-brand { display:flex; gap:12px; align-items:center; color:#1f2937; font-weight:800; font-size:1.2rem; text-decoration:none; padding:6px 12px; border-radius:16px; }
      .qs-brand:hover { transform: translateY(-2px) scale(1.02); transition: transform .25s ease; }
      .qs-logo { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:.9rem; letter-spacing:.5px; box-shadow:0 6px 16px rgba(102,126,234,.35); transition: transform .25s ease; }
      .qs-brand:hover .qs-logo { transform: rotate(8deg) scale(1.05); }
      .qs-title { background:linear-gradient(135deg,#4f46e5,#7c3aed); -webkit-background-clip:text; background-clip:text; color:transparent; font-weight:800; }
      .qs-tabs { display:flex; gap:10px; flex-wrap:nowrap; overflow-x:auto; white-space:nowrap; background:rgba(255,255,255,0.3); padding:6px; border-radius:30px; backdrop-filter:blur(10px); }
      .qs-btn { border:0; padding:10px 16px; border-radius:22px; background:rgba(255,255,255,0.7); color:#374151; text-decoration:none; font-weight:600; font-size:.9rem; transition:all .25s ease; border:2px solid transparent; flex:0 0 auto; }
      .qs-btn:hover { color:#fff; transform:translateY(-2px); box-shadow:0 8px 18px rgba(102,126,234,.35); border-color:rgba(102,126,234,.25); background:linear-gradient(135deg,#667eea,#764ba2); }
      .qs-btn[aria-current="page"] { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; box-shadow:0 6px 16px rgba(102,126,234,.45); }
    `;

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var template = [
      '<div class="wrap">',
      '  <a class="qs-brand" href="index.html"><span class="qs-logo">QS</span><span class="qs-title">Plataforma QS</span></a>',
      '  <nav class="qs-tabs" aria-label="Navegación">',
      '    <a class="qs-btn" href="materiales.html">Materiales</a>',
      '    <a class="qs-btn" href="asistencia.html">Asistencia</a>',
      '    <a class="qs-btn" href="calificaciones.html">Calificaciones</a>',
      '    <a class="qs-btn" href="Foro.html">Foro</a>',
      '    <a class="qs-btn" href="paneldocente.html">Panel</a>',
      '  </nav>',
      '</div>'
    ].join('');

    var nav = document.querySelector('.qs-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'qs-nav';
      nav.innerHTML = template;
      document.body.prepend(nav);
    } else {
      nav.classList.add('qs-nav');
      nav.innerHTML = template;
    }

    // Mark active link
    var current = (location.pathname.split('/').pop()||'').toLowerCase();
    document.querySelectorAll('.qs-tabs a.qs-btn').forEach(function(a){
      var href = (a.getAttribute('href')||'').toLowerCase();
      if(href === current){ a.setAttribute('aria-current','page'); }
    });
    // Offset sticky/fixed toolbars and ensure scroll
    try {
      var navH = document.querySelector('.qs-nav')?.getBoundingClientRect().height || 72;
      document.documentElement.style.setProperty('--qs-nav-h', navH + 'px');
      document.body.style.paddingTop = (navH + 4) + 'px';
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
  }catch(e){ /* noop */ }
});

