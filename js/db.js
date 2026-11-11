window.TK = window.TK || {};

(function (TK) {
  'use strict';

  var DB_NAME = 'tickets-almacen';
  var DB_VERSION = 1;
  var dbp = null;

  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('tickets')) db.createObjectStore('tickets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) {
          var p = db.createObjectStore('photos', { keyPath: 'id' });
          p.createIndex('ticketId', 'ticketId', { unique: false });
        }
        if (!db.objectStoreNames.contains('queue')) {
          var q = db.createObjectStore('queue', { keyPath: 'opId' });
          q.createIndex('seq', 'seq', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('srv')) db.createObjectStore('srv', { keyPath: 'key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }

  function tx(store, modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, modo);
        var st = t.objectStore(store);
        var out;
        try { out = fn(st); } catch (e) { reject(e); return; }
        t.oncomplete = function () {
          if (out && typeof out === 'object' && 'result' in out) resolve(out.result); else resolve(out);
        };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transacción cancelada')); };
      });
    });
  }

  TK.db = {
    init: abrir,
    get: function (store, key) { return tx(store, 'readonly', function (s) { return s.get(key); }); },
    put: function (store, valor) { return tx(store, 'readwrite', function (s) { s.put(valor); return valor; }); },
    del: function (store, key) { return tx(store, 'readwrite', function (s) { s.delete(key); }); },
    all: function (store) { return tx(store, 'readonly', function (s) { return s.getAll(); }); },
    count: function (store) { return tx(store, 'readonly', function (s) { return s.count(); }); },
    clear: function (store) { return tx(store, 'readwrite', function (s) { s.clear(); }); },
    byIndex: function (store, indice, valor) {
      return tx(store, 'readonly', function (s) { return s.index(indice).getAll(valor); });
    },
    getMeta: function (key, defecto) {
      return TK.db.get('meta', key).then(function (r) { return r ? r.value : defecto; });
    },
    setMeta: function (key, value) { return TK.db.put('meta', { key: key, value: value }); },
    borrarTodo: function () {
      return Promise.all(['tickets', 'photos', 'queue', 'meta', 'srv'].map(function (s) { return TK.db.clear(s); }));
    }
  };

  TK.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };
  TK.ahora = function () { return new Date().toISOString(); };
  TK.hoy = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  TK.fechaLocal = function (iso) { // ISO -> YYYY-MM-DD en hora local
    var d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  TK.sumarDias = function (fecha, n) {
    var d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  TK.diasEntre = function (a, b) { // b - a en días enteros (YYYY-MM-DD)
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  };
  TK.fmtFecha = function (f) {
    if (!f) return '—';
    var p = String(f).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  };
  TK.fmtFechaHora = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  TK.fmtBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };
  TK.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  TK.bus = new EventTarget();
  TK.emitir = function (nombre, detalle) { TK.bus.dispatchEvent(new CustomEvent(nombre, { detail: detalle })); };
})(window.TK);
