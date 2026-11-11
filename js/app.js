(function (TK) {
  'use strict';
  var $ = TK.$;
  var rutaActual = 'inicio';
  var temporizador = null;

  function parsear() {
    var h = (location.hash || '#/').replace(/^#/, '');
    var p = h.split('/').filter(Boolean);
    if (!p.length) return { ruta: 'inicio' };
    if (p[0] === 't' && p[1]) return { ruta: 'detalle', id: p[1] };
    if (['nuevo', 'dashboard', 'cola', 'mas', 'login'].indexOf(p[0]) >= 0) return { ruta: p[0] };
    return { ruta: 'inicio' };
  }

  function pintar(r) {
    var cont = $('#vista');
    var navRuta = r.ruta === 'detalle' ? 'inicio' : r.ruta;
    TK.$$('.nav a').forEach(function (a) {
      var act = a.getAttribute('data-ruta') === navRuta;
      a.classList.toggle('activa', act);
      if (act) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var v = TK.vistas[r.ruta];
    if (r.ruta !== 'detalle') cont.removeAttribute('data-ticket');
    return Promise.resolve(v(cont, r.id)).catch(function (e) {
      console.error(e);
      cont.innerHTML = '<div class="tarjeta"><b>No se pudo mostrar esta pantalla.</b><p class="chico">' + TK.esc(e.message || e) + '</p></div>';
    });
  }

  function pintarUsuario() {
    var u = TK.sesion.logueado() ? TK.sesion.actual() : null;
    if (!u) return;
    var ini = u.nombre.split(' ').map(function (x) { return x.charAt(0); }).slice(0, 2).join('').toUpperCase();
    $('#usuarioIni').textContent = ini;
    $('#usuarioNombre').textContent = u.nombre;
    $('#usuarioRol').textContent = u.rol;
  }

  function navegar() {
    var r = parsear();
    if (!TK.sesion.logueado()) { r = { ruta: 'login' }; }
    else if (r.ruta === 'login') { r = { ruta: 'inicio' }; if (location.hash !== '#/') history.replaceState(null, '', '#/'); }
    document.body.classList.toggle('login', r.ruta === 'login');
    pintarUsuario();
    var cambioRuta = r.ruta !== rutaActual;
    rutaActual = r.ruta;
    pintar(r).then(function () { if (cambioRuta) { window.scrollTo(0, 0); } });
  }

  function refrescarSuave() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      if ($('#dlg').open || rutaActual === 'nuevo' || rutaActual === 'mas' || rutaActual === 'login') { return; }
      var a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('#vista').contains(a)) return;
      var y = window.scrollY;
      pintar(parsear()).then(function () { window.scrollTo(0, y); });
    }, 250);
  }

  TK.navegar = navegar;

  function delegar(tipo, atributo, tabla) {
    document.addEventListener(tipo, function (e) {
      var el = e.target.closest ? e.target.closest('[' + atributo + ']') : null;
      if (!el) return;
      var f = TK.acc[tabla][el.getAttribute(atributo)];
      if (f) f(el, e);
    });
  }

  function iniciar() {
    delegar('click', 'data-acc', 'click');
    delegar('change', 'data-chg', 'change');
    delegar('input', 'data-inp', 'input');
    window.addEventListener('hashchange', navegar);
    $('#chipRed').addEventListener('click', function () { location.hash = '#/cola'; });
    TK.bus.addEventListener('cambio', refrescarSuave);
    TK.bus.addEventListener('red', function () { if (rutaActual === 'cola') refrescarSuave(); });
    TK.bus.addEventListener('sync', function () { if (rutaActual === 'cola') refrescarSuave(); });

    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); TK.instalar = e; });
    window.addEventListener('appinstalled', function () { TK.instalar = null; });

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Service worker no registrado', e); });
    }
    if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

    return TK.db.init()
      .then(function () { return TK.purgarDemo(); })
      .then(function () { return TK.purgarLocalAlConectar(); })
      .then(function () { return TK.migrar(); })
      .then(function () { return TK.tickets.generarRecordatorios(); })
      .then(function () { return TK.ui.refrescarCola(); })
      .then(function () {
        navegar();
        TK.sync.run();
        setInterval(function () { TK.tickets.generarRecordatorios(); }, 5 * 60 * 1000);
        setInterval(function () { if (TK.net.online() && TK.ui.colaN) TK.sync.run(); }, 30 * 1000);
      })
      .catch(function (e) {
        console.error(e);
        $('#vista').innerHTML = '<div class="tarjeta"><b>No se pudo iniciar la base de datos local.</b><p class="chico">' + TK.esc(e.message || e) +
          '</p><p class="chico">Si usas navegación privada, ábrela en una ventana normal.</p></div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window.TK);
