/* Servidor REAL: Supabase (PostgreSQL + Auth + Storage), sin librerías: solo fetch/XHR.
   Se activa solo si js/config.js trae supabaseUrl y supabaseKey; si no, la app sigue con js/server-local.js.
   Mantiene el mismo contrato que el servidor local (TK.server.apply / TK.server.pull), así que la cola,
   los reintentos y las pantallas no cambian. Todo cambio entra por la función SQL public.aplicar_op(),
   que valida permisos y reglas en el servidor y es idempotente por opId.
   Ver supabase/LEEME.md para la puesta en marcha. */
window.TK = window.TK || {};

(function (TK) {
  'use strict';
  var C = TK.CONFIG || {};
  if (!C.supabaseUrl || !C.supabaseKey) { TK.backend = 'local'; return; }
  TK.backend = 'supabase';

  var URL_ = C.supabaseUrl.replace(/\/+$/, '');
  var KEY = C.supabaseKey;
  var LS = window.localStorage;
  function err(msg, tipo) { var e = new Error(msg); e.tipo = tipo; return e; }

  // ---------- Sesión (tokens de Supabase Auth) ----------
  function leerAuth() { try { return JSON.parse(LS.getItem('tk.auth') || 'null'); } catch (e) { return null; } }
  function guardarAuth(r) {
    LS.setItem('tk.auth', JSON.stringify({ access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }));
  }
  function http(url, opts) {
    return fetch(url, opts).catch(function () { throw err('Sin conexión con el servidor', 'red'); });
  }
  var refrescando = null;
  function token() {
    var a = leerAuth();
    if (!a) return Promise.reject(err('Sesión vencida: vuelve a iniciar sesión', 'red'));
    if (a.exp - Date.now() > 60000) return Promise.resolve(a.access);
    if (!refrescando) {
      refrescando = http(URL_ + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: a.refresh })
      }).then(function (r) {
        if (!r.ok) throw err('Sesión vencida: vuelve a iniciar sesión', 'red');
        return r.json();
      }).then(function (j) { guardarAuth(j); return j.access_token; }).then(function (t) { refrescando = null; return t; }, function (e) { refrescando = null; throw e; });
    }
    return refrescando;
  }
  function cabeceras(tk, extra) { return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + tk }, extra || {}); }

  // Traduce una respuesta de error de PostgREST/Storage al tipo que entiende la cola.
  function errorDe(r, cuerpo) {
    var msg = (cuerpo && (cuerpo.message || cuerpo.error_description || cuerpo.error)) || ('Error ' + r.status);
    if (/^dependencia:/.test(msg)) return err(msg.replace(/^dependencia:\s*/, ''), 'dependencia');
    if (/^(validacion|forbidden):/.test(msg)) return err(msg.replace(/^(validacion|forbidden):\s*/, ''), 'validacion');
    if (r.status === 401) return err('Sesión vencida: vuelve a iniciar sesión', 'red');
    if (r.status >= 500 || r.status === 429 || r.status === 408) return err(msg, 'red');
    return err(msg, 'validacion');
  }
  function rpc(nombre, cuerpo) {
    return token().then(function (tk) {
      return http(URL_ + '/rest/v1/rpc/' + nombre, { method: 'POST', headers: cabeceras(tk, { 'Content-Type': 'application/json' }), body: JSON.stringify(cuerpo) });
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) { if (!r.ok) throw errorDe(r, j); return j; });
    });
  }

  // ---------- Inicio y cierre de sesión ----------
  var salirOriginal = TK.sesion.salir;
  TK.sesion.logueado = function () { return !!leerAuth() && !!TK.usuario(LS.getItem('tk.sesion')); };
  TK.sesion.entrar = function (usuario, clave) {
    var q = String(usuario || '').trim().toLowerCase();
    var email = q.indexOf('@') >= 0 ? q : q + TK.DOMINIO;
    if (!q || !clave) return Promise.resolve(null);
    return http(URL_ + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: clave })
    }).catch(function () { throw new Error('Necesitas conexión para iniciar sesión.'); }).then(function (r) {
      if (r.status === 400 || r.status === 401) return null;
      if (!r.ok) throw new Error('El servidor no respondió bien (' + r.status + '). Intenta de nuevo.');
      return r.json();
    }).then(function (j) {
      if (!j) return null;
      var u = TK.usuario(email);
      if (!u) throw new Error('Tu cuenta no está dada de alta en la app.');
      guardarAuth(j);
      TK.sesion.correo = u.correo;
      LS.setItem('tk.sesion', u.correo);
      setTimeout(function () { TK.sync.run(); }, 200);
      return u;
    });
  };
  TK.sesion.salir = function () {
    var a = leerAuth();
    LS.removeItem('tk.auth');
    LS.removeItem('tk.supaPull');
    if (a) fetch(URL_ + '/auth/v1/logout', { method: 'POST', headers: cabeceras(a.access) }).catch(function () {});
    salirOriginal();
  };

  // ---------- Evidencias (Storage) ----------
  function subirBlob(ruta, blob, progreso) {
    return token().then(function (tk) {
      return new Promise(function (ok, fallo) {
        var x = new XMLHttpRequest();
        x.open('POST', URL_ + '/storage/v1/object/evidencias/' + ruta.split('/').map(encodeURIComponent).join('/'));
        var h = cabeceras(tk, { 'Content-Type': blob.type || 'image/jpeg', 'Cache-Control': '3600' });
        Object.keys(h).forEach(function (k) { x.setRequestHeader(k, h[k]); });
        if (x.upload && progreso) x.upload.onprogress = function (e) { if (e.lengthComputable) progreso(Math.round(e.loaded / e.total * 95)); };
        x.onerror = x.ontimeout = function () { fallo(err('Se perdió la señal durante la subida', 'red')); };
        x.onload = function () {
          var j = null; try { j = JSON.parse(x.responseText); } catch (e) {}
          if (x.status >= 200 && x.status < 300) return ok();
          if (x.status === 409 || (j && /duplicate|already exists/i.test(j.message || j.error || ''))) return ok();   // ya estaba subida
          if (x.status === 400 || x.status === 403) return fallo(err('El ticket aún no está disponible en el servidor', 'dependencia'));
          fallo(errorDe({ status: x.status }, j));
        };
        x.send(blob);
      });
    });
  }
  TK.supa = {
    // Imagen completa de otro dispositivo: se descarga bajo demanda (la miniatura ya viene en el ticket).
    descargarFoto: function (ruta) {
      return token().then(function (tk) {
        return http(URL_ + '/storage/v1/object/authenticated/evidencias/' + ruta.split('/').map(encodeURIComponent).join('/'), { headers: cabeceras(tk) });
      }).then(function (r) { if (!r.ok) throw new Error('No se pudo descargar la imagen'); return r.blob(); });
    }
  };

  // ---------- Contrato de servidor ----------
  TK.server = {
    apply: function (op, progreso) {
      if (op.tipo === 'subir_foto') {
        return TK.db.get('photos', op.data.fotoId).then(function (f) {
          if (!f || !f.blob) return { ok: true, omitida: true };   // se reemplazó o ya no existe en este equipo
          var ruta = op.ticketId + '/' + f.etapa + '-' + String(f.hash).replace(/[^a-z0-9]/gi, '').slice(0, 16) + '.jpg';
          return subirBlob(ruta, f.blob, progreso).then(function () {
            if (progreso) progreso(98);
            var d = Object.assign({}, op.data, { ruta: ruta });
            return rpc('aplicar_op', { p_op: { opId: op.opId, tipo: op.tipo, ticketId: op.ticketId, data: d } });
          });
        });
      }
      return rpc('aplicar_op', { p_op: { opId: op.opId, tipo: op.tipo, ticketId: op.ticketId, data: op.data } });
    },

    // Trae del servidor lo visible para este usuario. Incremental por updated_at y una lectura completa al día
    // (la visibilidad por vencimiento cambia con la fecha, no con la edición del ticket).
    pull: function () {
      if (!leerAuth()) return Promise.resolve();
      var m = {}; try { m = JSON.parse(LS.getItem('tk.supaPull') || '{}'); } catch (e) {}
      var hoy = TK.hoy();
      var completa = m.dia !== hoy || !m.desde;
      return Promise.all([rpc('leer_tickets', { p_desde: completa ? null : m.desde }), TK.queue.todas()]).then(function (r) {
        var docs = r[0] || [], pend = {};
        r[1].forEach(function (o) { pend[o.ticketId] = true; });
        var desde = m.desde || null, cambio = false;
        return docs.reduce(function (p, doc) {
          if (!desde || doc.updatedAt > desde) desde = doc.updatedAt;
          if (pend[doc.id]) return p;     // hay cambios locales sin enviar: no se pisan
          return p.then(function () { return fusionar(doc); }).then(function (c) { cambio = cambio || c; });
        }, Promise.resolve()).then(function () {
          LS.setItem('tk.supaPull', JSON.stringify({ desde: desde, dia: completa ? hoy : m.dia }));
          if (cambio) TK.emitir('cambio');
        });
      });
    }
  };

  function fusionar(doc) {
    var fotos = doc.fotos || [];
    var t = Object.assign({}, doc);
    delete t.fotos; delete t.updatedAt;
    t.apoyo = t.apoyo || []; t.comentarios = t.comentarios || []; t.historial = t.historial || []; t.raci = t.raci || {};
    t.sync = 'sincronizado';
    return TK.db.get('tickets', t.id).then(function (local) {
      if (local && local.version >= t.version && local.sync === 'sincronizado' && JSON.stringify(local.historial) === JSON.stringify(t.historial) && local.estado === t.estado &&
          local.responsable === t.responsable && local.compromiso === t.compromiso && local.comentarios.length === t.comentarios.length) {
        return false;
      }
      if (local && local.folioProv) t.folioProv = local.folioProv;
      return TK.db.put('tickets', t).then(function () { return true; });
    }).then(function (cambioT) {
      return TK.tickets.fotosDe(t.id).then(function (locales) {
        return fotos.reduce(function (p, f) {
          return p.then(function (c) {
            var l = locales.filter(function (x) { return x.etapa === f.etapa; })[0];
            if (l && l.hash === f.hash) {
              if (l.estadoSubida === 'Subida' && l.ruta) return c;
              l.estadoSubida = 'Subida'; l.ruta = f.ruta;
              return TK.db.put('photos', l).then(function () { return true; });
            }
            var quitar = l ? TK.db.del('photos', l.id) : Promise.resolve();
            return quitar.then(function () {
              return TK.db.put('photos', {
                id: f.id, ticketId: t.id, etapa: f.etapa, thumb: f.thumb, bytes: f.bytes, ancho: f.ancho, alto: f.alto, hash: f.hash,
                tomada: f.tomada, por: f.por, estadoSubida: 'Subida', progreso: 100, ruta: f.ruta, blob: null
              });
            }).then(function () { return true; });
          });
        }, Promise.resolve(false));
      }).then(function (cambioF) { return cambioT || cambioF; });
    });
  }

  // Ver en otros equipos lo que cambió: lectura periódica mientras la app está abierta.
  setInterval(function () {
    if (TK.sesion.logueado() && TK.net.online() && !document.hidden) TK.sync.run();
  }, 60000);
})(window.TK);
