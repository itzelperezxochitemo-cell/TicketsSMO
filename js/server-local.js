/* Servidor SIMULADO (local). Vive en IndexedDB y sirve para probar y capacitar sin backend.
   Es el único punto que habla con "el servidor": para conectar un backend real, reemplaza este archivo
   por uno que defina TK.server con la misma forma (ver docs/BACKEND.md). El motor de cola/reintentos
   (js/sync.js) y la interfaz no cambian.

   Contrato:
     TK.server.apply(op, progreso) -> Promise<resultado>   (idempotente por op.opId)
     TK.server.pull()              -> Promise                (opcional: traer cambios del servidor)
   Errores: Error con .tipo = 'red' (reintentar), 'dependencia' (reintentar), 'validacion' (se aparta tras 5 intentos). */
window.TK = window.TK || {};

(function (TK) {
  'use strict';
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var errRed = function (msg) { var e = new Error(msg); e.tipo = 'red'; return e; };

  function pad6(n) { return String(n).padStart(6, '0'); }

  TK.server = {
    apply: function (op, progreso) {
      return espera(180 + Math.random() * 220).then(function () {
        if (!TK.net.online()) throw errRed('Sin conexión');
        if (TK.net.fallas && Math.random() < 0.1) throw errRed('Se cortó la conexión antes de llegar');
        return TK.db.get('srv', 'op:' + op.opId);
      }).then(function (previo) {
        if (previo) return Object.assign({ repetida: true }, previo.resultado);
        return procesar(op, progreso).then(function (res) {
          return TK.db.put('srv', { key: 'op:' + op.opId, resultado: res }).then(function () {
            if (TK.net.fallas && Math.random() < 0.3) throw errRed('Se perdió la respuesta del servidor');
            return res;
          });
        });
      });
    }
  };

  function procesar(op, progreso) {
    var d = op.data;
    if (op.tipo === 'crear_ticket') {
      if (!d.actividad) { var e = new Error('Falta la actividad'); e.tipo = 'validacion'; throw e; }
      return TK.db.get('srv', 'counter').then(function (c) {
        var n = (c ? c.n : 0) + 1;
        return TK.db.put('srv', { key: 'counter', n: n }).then(function () {
          var res = { folio: 'TK-' + new Date().getFullYear() + '-' + pad6(n), estado: 'Asignado', responsable: d.responsable || null };
          return TK.db.put('srv', { key: 'tk:' + op.ticketId, estado: res.estado, version: 1 }).then(function () { return res; });
        });
      });
    }
    if (op.tipo === 'subir_foto') {
      return TK.db.get('srv', 'tk:' + op.ticketId).then(function (t) {
        if (!t) { var e = errRed('El ticket aún no existe en el servidor'); e.tipo = 'dependencia'; throw e; }
        return TK.db.get('srv', 'foto:' + d.hash);
      }).then(function (dup) {
        var pasos = 5, i = 0;
        var tam = d.bytes || 300000;
        var ms = Math.min(1200, 200 + tam / 1500);
        function paso() {
          if (i >= pasos) return Promise.resolve();
          i++;
          if (progreso) progreso(Math.round(i / pasos * 100));
          return espera(ms / pasos).then(function () {
            if (!TK.net.online()) throw errRed('Se perdió la señal durante la subida');
            return paso();
          });
        }
        if (dup) return { ok: true, duplicada: true };
        return paso().then(function () {
          return TK.db.put('srv', { key: 'foto:' + d.hash, ticketId: op.ticketId }).then(function () { return { ok: true }; });
        });
      });
    }
    if (op.tipo === 'cambiar_estado') {
      return TK.db.get('srv', 'tk:' + op.ticketId).then(function (t) {
        if (!t) { var e = errRed('El ticket aún no existe en el servidor'); e.tipo = 'dependencia'; throw e; }
        if (d.desde && t.estado !== d.desde && d.nuevo !== 'Cancelado') {
          return { rechazada: true, estadoServidor: t.estado, motivo: 'El ticket ya estaba en "' + t.estado + '"' };
        }
        t.estado = d.nuevo; t.version = (t.version || 1) + 1;
        return TK.db.put('srv', t).then(function () { return { ok: true, estado: d.nuevo }; });
      });
    }
    
    return TK.db.get('srv', 'tk:' + op.ticketId).then(function (t) {
      if (!t && op.tipo !== 'crear_ticket') { var e = errRed('El ticket aún no existe en el servidor'); e.tipo = 'dependencia'; throw e; }
      return { ok: true };
    });
  }


})(window.TK);
