window.TK = window.TK || {};
TK.vistas = TK.vistas || {};
TK.acc = TK.acc || { click: {}, change: {}, input: {} };

(function (TK) {
  'use strict';
  var esc = TK.esc;

  var OJO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OJO_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.7A10 10 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9M6.5 7.2A16.5 16.5 0 0 0 2 12s3.5 6.5 10 6.5c1.6 0 3-.3 4.3-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var USUARIO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>';
  var ANTENA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/></svg>';

  TK.vistas.login = function (cont) {
    cont.removeAttribute('data-ticket');
    cont.innerHTML =
      '<div class="login-wrap">' +
        '<header class="login-cab"><span class="org">DHL Supply Chain · Cuenta P&amp;G</span></header>' +
        '<div class="login-centro"><div class="login-tarjeta">' +
          '<h1>INICIAR SESIÓN</h1>' +
          '<form id="formLogin" novalidate>' +
            '<div id="loginError" class="login-error oculto" role="alert"></div>' +
            '<div class="campo-l"><label for="loginUsuario">Usuario</label><div class="linea">' +
              '<input id="loginUsuario" type="text" placeholder="nombre.apellido" autocomplete="username" autocapitalize="none" spellcheck="false">' +
              USUARIO_ICO + '</div></div>' +
            '<div class="campo-l"><label for="loginClave">Contraseña</label><div class="linea">' +
              '<input id="loginClave" type="password" placeholder="••••••••" autocomplete="current-password">' +
              '<button type="button" class="ojo" data-acc="ver-clave" aria-label="Mostrar contraseña">' + OJO + '</button></div></div>' +
            '<button type="submit" class="entrar">Entrar</button>' +
          '</form>' +
          (TK.PRODUCCION ? '' : ''+
          '<details class="login-demo"><summary>Cuentas de demostración</summary>' +
            '<p class="chico" style="color:inherit">Solo prototipo. Contraseña para todas: <b>' + esc(TK.CLAVE_DEMO) + '</b></p>' +
            '<div class="chips">' + TK.USUARIOS.map(function (u) {
              return '<button type="button" class="chip" data-acc="demo-usuario" data-u="' + esc(u.usuario) + '">' + esc(u.usuario) + ' · ' + esc(u.rol) + '</button>';
            }).join('') + '</div></details>') +
          '<div class="login-nota">' + ANTENA + '<span>Sin señal también puedes trabajar: tus tickets se envían al reconectar.</span></div>' +
        '</div></div>' +
      '</div>';

    var f = TK.$('#formLogin');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = TK.$('button.entrar'), er = TK.$('#loginError');
      btn.disabled = true; er.classList.add('oculto');
      Promise.resolve().then(function () {
        return TK.sesion.entrar(TK.$('#loginUsuario').value, TK.$('#loginClave').value);
      }).then(function (u) {
        btn.disabled = false;
        if (!u) {
          er.textContent = 'Usuario o contraseña incorrectos.';
          er.classList.remove('oculto');
          TK.$('#loginClave').select();
          return;
        }
        TK.estadoUI.pestana = null;
        TK.estadoUI.busqueda = '';
        if (location.hash !== '#/') location.hash = '#/'; else TK.navegar();
      }).catch(function (x) {
        btn.disabled = false;
        er.textContent = x.message || 'No se pudo iniciar sesión.';
        er.classList.remove('oculto');
      });
    });
    return Promise.resolve();
  };

  TK.acc.click['ver-clave'] = function (el) {
    var i = TK.$('#loginClave');
    var ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    el.innerHTML = ver ? OJO_X : OJO;
    el.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };
  TK.acc.click['demo-usuario'] = function (el) {
    TK.$('#loginUsuario').value = el.getAttribute('data-u');
    TK.$('#loginClave').value = TK.CLAVE_DEMO;
  };
  TK.acc.click['cerrar-sesion'] = function () {
    TK.ui.confirmar('Cerrar sesión', 'Los tickets y envíos pendientes se quedan guardados en este equipo.', 'Cerrar sesión', 'peligro').then(function (ok) {
      if (!ok) return;
      TK.sesion.salir();
      TK.estadoUI.pestana = null;
      location.hash = '#/login';
      TK.navegar();
    });
  };
})(window.TK);
