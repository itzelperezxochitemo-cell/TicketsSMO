window.TK = window.TK || {};

(function (TK) {
  'use strict';

  var LS = window.localStorage;
  TK.net = {
    simOffline: LS.getItem('tk.simOffline') === '1',
    fallas: LS.getItem('tk.fallas') === '1',
    online: function () { return navigator.onLine !== false && !TK.net.simOffline; },
    setSimOffline: function (v) {
      TK.net.simOffline = !!v;
      LS.setItem('tk.simOffline', v ? '1' : '0');
      TK.emitir('red');
      if (!v) TK.sync.run();
    },
    setFallas: function (v) {
      TK.net.fallas = !!v;
      LS.setItem('tk.fallas', v ? '1' : '0');
      TK.emitir('red');
    }
  };
  window.addEventListener('online', function () { TK.emitir('red'); TK.sync.run(); });
  window.addEventListener('offline', function () { TK.emitir('red'); });

  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var errRed = function (msg) { var e = new Error(msg); e.tipo = 'red'; return e; };

  TK.queue = {
    add: function (tipo, ticketId, data) {
      return TK.db.getMeta('seq', 0).then(function (seq) {
        seq = seq + 1;
        var op = {
          opId: TK.uuid(), seq: seq, tipo: tipo, ticketId: ticketId, data: data || {},
          ts: TK.ahora(), intentos: 0, apartada: false, ultimoError: null
        };
        return TK.db.setMeta('seq', seq).then(function () { return TK.db.put('queue', op); }).then(function () {
          TK.emitir('cola');
          TK.sync.run();
          return op;
        });
      });
    },
    todas: function () {
      return TK.db.all('queue').then(function (a) { return a.sort(function (x, y) { return x.seq - y.seq; }); });
    },
    reintentarApartadas: function () {
      return TK.db.all('queue').then(function (ops) {
        return Promise.all(ops.filter(function (o) { return o.apartada; }).map(function (o) {
          o.apartada = false; o.intentos = 0; o.ultimoError = null; return TK.db.put('queue', o);
        }));
      }).then(function () { TK.emitir('cola'); TK.sync.run({ manual: true }); });
    }
  };

  // Los avisos se encolan uno tras otro: leer-modificar-escribir en paralelo pisaría avisos.
  var cadenaAvisos = Promise.resolve();
  function agregarAviso(para, texto, ticketId) {
    var p = cadenaAvisos.then(function () {
      return TK.db.getMeta('bandeja', []).then(function (b) {
        b.unshift({ id: TK.uuid(), ts: TK.ahora(), para: para, texto: texto, ticketId: ticketId || null });
        return TK.db.setMeta('bandeja', b.slice(0, 300));
      });
    });
    cadenaAvisos = p.catch(function () {});
    return p;
  }
  TK.agregarAviso = agregarAviso;

  function aplicarResultado(op, res) {
    if (op.tipo === 'crear_ticket') {
      return TK.db.get('tickets', op.ticketId).then(function (t) {
        if (!t) return;
        t.folio = res.folio;
        t.sync = 'sincronizado';
        if (t.estado === 'Nuevo') {
          t.estado = 'Asignado';
          t.historial.push({ ts: TK.ahora(), usuario: 'Sistema', texto: 'Folio ' + res.folio + ' asignado. Responsable: ' + TK.nombreDe(t.responsable) });
        }
        return TK.db.put('tickets', t).then(function () {
          var avisos = [];
          if (t.responsable && t.responsable !== t.solicitante) avisos.push(agregarAviso([t.responsable], 'Nuevo ticket ' + t.folio + ': ' + t.actividad, t.id));
          // Según la RACI: dueño (A), consultados (C) e informados (I) se enteran de que hay un ticket nuevo.
          Object.keys(t.raci || {}).forEach(function (c) {
            if (c === t.solicitante || c === t.responsable || !TK.usuario(c)) return;
            var cod = t.raci[c];
            avisos.push(agregarAviso([c], (/A/.test(cod) ? 'Ticket a tu cargo ' : /C/.test(cod) ? 'Ticket en el que se te consulta ' : 'Ticket para tu conocimiento ') + t.folio + ': ' + t.actividad, t.id));
          });
          (t.apoyo || []).forEach(function (a) {
            avisos.push(agregarAviso([a.correo], 'Te pidieron apoyo en ' + t.folio + ': ' + t.actividad + '. Acepta o rechaza.', t.id));
          });
          return Promise.all(avisos);
        });
      });
    }
    if (op.tipo === 'subir_foto') {
      return TK.db.get('photos', op.data.fotoId).then(function (f) {
        if (!f) return;
        f.estadoSubida = 'Subida'; f.progreso = 100;
        return TK.db.put('photos', f);
      });
    }
    if (op.tipo === 'cambiar_estado' && res.rechazada) {
      return TK.db.get('tickets', op.ticketId).then(function (t) {
        if (!t) return;
        t.estado = res.estadoServidor;
        t.historial.push({ ts: TK.ahora(), usuario: 'Sistema', texto: 'Cambio a "' + op.data.nuevo + '" rechazado: ' + res.motivo });
        return TK.db.put('tickets', t).then(function () {
          TK.emitir('aviso', { tipo: 'warn', texto: 'Se rechazó tu cambio a "' + op.data.nuevo + '". ' + res.motivo + '.' });
        });
      });
    }
    return Promise.resolve();
  }

  var corriendo = false;
  var fallosSeguidos = 0;
  var timerReintento = null;

  function programarReintento() {
    clearTimeout(timerReintento);
    var ms = Math.min(30000, 2000 * Math.pow(2, Math.min(fallosSeguidos, 4))); // 2 s, 4 s, 8 s, 16 s, 30 s
    timerReintento = setTimeout(function () { TK.sync.run(); }, ms);
  }

  var pidioOtra = false;
  TK.sync = {
    estado: { corriendo: false, ultimo: null, progresoFoto: null },
    run: function (opts) {
      if (corriendo) { pidioOtra = true; return Promise.resolve(); }   // llegó trabajo nuevo durante una pasada
      if (!TK.net.online()) { TK.emitir('red'); return Promise.resolve(); }
      corriendo = true; pidioOtra = false;
      TK.sync.estado.corriendo = true;
      TK.emitir('sync');
      var huboError = false;

      return TK.queue.todas().then(function (ops) {
        var pendientes = ops.filter(function (o) { return !o.apartada; });
        var i = 0;
        function siguiente() {
          if (i >= pendientes.length || !TK.net.online()) return Promise.resolve();
          var op = pendientes[i++];
          var progreso = null;
          if (op.tipo === 'subir_foto') {
            progreso = function (p) {
              TK.sync.estado.progresoFoto = { fotoId: op.data.fotoId, p: p };
              TK.emitir('sync');
            };
            TK.db.get('photos', op.data.fotoId).then(function (f) {
              if (f && f.estadoSubida !== 'Subida') { f.estadoSubida = 'Subiendo'; TK.db.put('photos', f).then(function () { TK.emitir('cambio'); }); }
            });
          }
          return TK.server.apply(op, progreso).then(function (res) {
            return aplicarResultado(op, res).then(function () {
            
              return TK.db.del('queue', op.opId);
            }).then(function () {
              TK.sync.estado.progresoFoto = null;
              fallosSeguidos = 0; TK.sync.estado.ultimoError = null;
              TK.emitir('cola'); TK.emitir('cambio');
              return siguiente();
            });
          }).catch(function (e) {
            huboError = true;
            op.intentos += 1;
            op.ultimoError = e.message; TK.sync.estado.ultimoError = e.message;
            if (e.tipo === 'validacion' && op.intentos >= 5) op.apartada = true;
            return TK.db.put('queue', op).then(function () {
              TK.emitir('cola');
              if (e.tipo === 'validacion' && op.apartada) return siguiente(); 
              fallosSeguidos += 1; 
            });
          });
        }
        return siguiente();
      }).catch(function (e) {
        huboError = true;
        console.error('Error de sincronización', e);
      }).then(function () {
        // Punto de enganche para un backend real: traer lo que cambió en el servidor.
        if (TK.server && TK.server.pull) {
          return Promise.resolve(TK.server.pull()).catch(function (e) { huboError = true; TK.sync.estado.ultimoError = 'Lectura: ' + e.message; console.warn('No se pudo leer del servidor:', e.message); });
        }
      }).then(function () {
        corriendo = false;
        TK.sync.estado.corriendo = false;
        TK.sync.estado.progresoFoto = null;
        TK.sync.estado.ultimo = TK.ahora();
        TK.emitir('sync');
        return TK.db.count('queue').then(function (n) {
          if (pidioOtra && !huboError) { setTimeout(function () { TK.sync.run(); }, 50); return; }
          if (n > 0 && TK.net.online() && huboError) programarReintento();
          else fallosSeguidos = 0;
        });
      });
    }
  };

  setInterval(function () {
    if (!corriendo && TK.net.online()) {
      TK.db.count('queue').then(function (n) { if (n > 0) TK.sync.run(); });
    }
  }, 20000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') TK.sync.run();
  });
})(window.TK);
