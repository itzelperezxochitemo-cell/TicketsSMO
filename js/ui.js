window.TK = window.TK || {};

(function (TK) {
  'use strict';

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  TK.$ = $;
  TK.$$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  TK.ui = { colaN: 0, porTicket: {}, urls: {} };

  TK.ui.toast = function (texto, tipo, ms) {
    var cont = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (tipo ? ' ' + tipo : '');
    el.textContent = texto;
    cont.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 4200);
  };

  TK.ui.dialogo = function (o) {
    var dlg = $('#dlg');
    return new Promise(function (resolve) {
      var botones = o.botones || [{ texto: 'Cerrar', valor: null }];
      dlg.innerHTML =
        '<div class="dlg"><h3>' + TK.esc(o.titulo || '') + '</h3>' + (o.cuerpo || '') +
        '<div class="acciones">' + botones.map(function (b, i) {
          return '<button type="button" class="btn ' + (b.clase || '') + '" data-i="' + i + '">' + TK.esc(b.texto) + '</button>';
        }).join('') + '</div></div>';
      function cerrar(valor) {
        dlg.removeEventListener('click', clic);
        dlg.removeEventListener('cancel', cancelar);
        if (dlg.open) dlg.close();
        resolve(valor);
      }
      function cancelar() { cerrar(undefined); }
      function clic(e) {
        var btn = e.target.closest('button[data-i]');
        if (!btn) return;
        var b = botones[Number(btn.getAttribute('data-i'))];
        if (b.validar) {
          var msg = b.validar(dlg);
          if (msg) { TK.ui.toast(msg, 'warn'); return; }
        }
        cerrar(b.recoger ? b.recoger(dlg) : b.valor);
      }
      dlg.addEventListener('click', clic);
      dlg.addEventListener('cancel', cancelar);
      if (!dlg.open) dlg.showModal();
      if (o.alAbrir) o.alAbrir(dlg);
    });
  };

  TK.ui.confirmar = function (titulo, texto, textoOk, clase) {
    return TK.ui.dialogo({
      titulo: titulo, cuerpo: '<p>' + TK.esc(texto) + '</p>',
      botones: [{ texto: 'Volver', valor: false }, { texto: textoOk || 'Aceptar', valor: true, clase: clase || 'primario' }]
    }).then(function (v) { return v === true; });
  };

  TK.ui.urlDe = function (foto) {
    if (!TK.ui.urls[foto.id]) TK.ui.urls[foto.id] = URL.createObjectURL(foto.blob);
    return TK.ui.urls[foto.id];
  };
  TK.ui.verFoto = function (foto) {
    var obtener = foto.blob ? Promise.resolve(foto)
      : (foto.ruta && TK.supa
        ? TK.supa.descargarFoto(foto.ruta).then(function (b) { foto.blob = b; return TK.db.put('photos', foto).then(function () { return foto; }); })
        : Promise.reject(new Error('La foto completa no está disponible en este equipo.')));
    return obtener.then(function (f) {
      return TK.ui.dialogo({
        titulo: f.etapa + ' · ' + TK.fmtFechaHora(f.tomada),
        cuerpo: '<img class="grande" alt="Foto de evidencia" src="' + TK.ui.urlDe(f) + '">' +
          '<p class="chico">' + f.ancho + ' × ' + f.alto + ' px · ' + TK.fmtBytes(f.bytes) +
          (f.bytesOriginal ? ' (original ' + TK.fmtBytes(f.bytesOriginal) + ')' : '') +
          ' · ' + TK.esc(f.estadoSubida) + '</p>',
        botones: [{ texto: 'Cerrar', valor: null }]
      });
    }).catch(function (e) { TK.ui.toast(e.message, 'warn'); });
  };

  TK.ui.etiquetaImpacto = function (p) { return '<span class="etiqueta ' + TK.esc(p) + '" title="Impacto">Impacto ' + TK.esc(p.toLowerCase()) + '</span>'; };
  TK.ui.etiquetaEstado = function (t) {
    var e = TK.tickets.estadoMostrado(t);
    var clase = 'estado-' + e.split(' ')[0];
    return '<span class="etiqueta ' + clase + '">' + TK.esc(e) + '</span>';
  };
  TK.ui.diasHtml = function (t) {
    if (!TK.tickets.abierto(t)) return '';
    var d = TK.tickets.diasRestantes(t);
    if (d === null) return '<span class="dias ojo">Sin planear</span>';
    if (d < 0) return '<span class="dias mal">Vencido hace ' + (-d) + ' d</span>';
    if (d === 0) return '<span class="dias mal">Vence hoy</span>';
    if (d <= 3) return '<span class="dias ojo">Vence en ' + d + ' d</span>';
    return '<span class="dias">Vence en ' + d + ' d</span>';
  };
  TK.ui.pendienteDe = function (t) { return (TK.ui.porTicket[t.id] || 0) > 0 || t.sync === 'pendiente'; };

  TK.ui.tarjetaTicket = function (t) {
    var venc = TK.tickets.vencido(t);
    var local = TK.ui.pendienteDe(t);
    return '<a class="ticket-item p-' + TK.esc(t.impacto) + (venc ? ' venc' : '') + '" href="#/t/' + t.id + '">' +
      '<div class="linea1"><span class="folio">' + TK.esc(t.folio || t.folioProv) + '</span>' +
      '<span class="fila">' + (local ? '<span class="etiqueta local">Pendiente de enviar</span>' : '') + TK.ui.etiquetaEstado(t) + '</span></div>' +
      '<div class="act">' + TK.esc(t.actividad) + '</div>' +
      '<div class="meta"><span>' + TK.esc(t.categoria) + '</span><span>' + TK.esc(TK.resumenUbicacion(t.ubicacion)) + '</span>' +
      TK.ui.etiquetaImpacto(t.impacto) + TK.ui.diasHtml(t) + '</div>' +
      '<div class="meta mt"><span>Solicitó: ' + TK.esc(TK.nombreDe(t.solicitante)) + '</span><span>Responsable: ' + TK.esc(TK.nombreDe(t.responsable)) + '</span></div></a>';
  };

  TK.ui.filaTicket = function (t) {
    var d = TK.tickets.abierto(t) ? TK.tickets.diasRestantes(t) : null;
    var txt = '', mal = false;
    if (d !== null) {
      if (d < 0) { txt = 'vencido hace ' + (-d) + (d === -1 ? ' día' : ' días'); mal = true; }
      else if (d === 0) { txt = 'vence hoy'; mal = true; }
      else if (d === 1) txt = 'mañana';
      else txt = 'en ' + d + ' días';
    } else if (t.estado === 'Completado') txt = 'cerrado';
    else if (TK.tickets.sinPlanear(t)) { txt = 'sin planear'; }
    var fecha = t.compromiso;
    var local = TK.ui.pendienteDe(t);
    var href = '#/t/' + t.id;
    return '<div class="tk-fila dato" role="row">' +
      '<span role="cell"><a class="folio" href="' + href + '">' + TK.esc(t.folio || t.folioProv) + '</a></span>' +
      '<span role="cell" class="act"><a href="' + href + '">' + TK.esc(t.actividad) + '</a><span>' + TK.esc(t.categoria) + '</span></span>' +
      '<span role="cell">' + TK.esc(TK.resumenUbicacion(t.ubicacion)) + '</span>' +
      '<span role="cell" class="prio"><i class="punto-prio ' + TK.esc(t.impacto) + '"></i>' + TK.esc(t.impacto) + '</span>' +
      '<span role="cell">' + TK.ui.etiquetaEstado(t) + (local ? ' <span class="etiqueta local" title="Pendiente de enviar">Pendiente</span>' : '') + '</span>' +
      '<span role="cell">' + TK.esc(TK.nombreDe(t.responsable)) + '</span>' +
      '<span role="cell" class="fecha"><b style="font-weight:400">' + (fecha ? TK.fmtFecha(fecha) : '—') + '</b>' + (txt ? '<span class="' + (mal ? 'mal' : '') + '">' + txt + '</span>' : '') + '</span>' +
    '</div>';
  };

  TK.ui.titulo = function (texto, sub, extra) {
    return '<div class="pagina"><div class="bloque"><h1>' + TK.esc(texto) + '</h1><div class="barra"></div>' +
      (sub ? '<span class="sub">' + TK.esc(sub) + '</span>' : '') + '</div>' + (extra || '') + '</div>';
  };

  TK.ui.BTN_NUEVO = '<a class="btn primario" href="#/nuevo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Nuevo ticket</span></a>';

    TK.ui.refrescarCola = function () {
    return TK.queue.todas().then(function (ops) {
      var m = {};
      ops.forEach(function (o) { m[o.ticketId] = (m[o.ticketId] || 0) + 1; });
      TK.ui.porTicket = m;
      TK.ui.colaN = ops.length;
      TK.ui.apartadas = ops.filter(function (o) { return o.apartada; }).length;
      TK.ui.pintarChrome();
    });
  };

  TK.ui.pintarChrome = function () {
    var chip = $('#chipRed'), txt = $('#chipTexto'), n = $('#chipN'), banda = $('#banda'), badge = $('#badgeCola');
    var online = TK.net.online();
    var sync = TK.sync.estado.corriendo;
    chip.classList.toggle('sin', !online);
    chip.classList.toggle('sync', online && sync);
    var base = TK.backend === 'supabase' ? ' · Supabase' : ' · Modo local';
    var fallo = TK.sync.estado.ultimoError;
    txt.textContent = (!online ? 'Sin señal' : sync ? 'Sincronizando' : fallo ? 'Error de envío' : 'En línea') + base;
    chip.title = fallo ? 'Último error: ' + fallo : (TK.backend === 'supabase' ? 'Conectado a la base de datos' : 'Los datos solo se guardan en este equipo');
    n.classList.toggle('oculto', TK.ui.colaN === 0);
    n.textContent = TK.ui.colaN;
    badge.classList.toggle('oculto', TK.ui.colaN === 0);
    badge.textContent = TK.ui.colaN;
    if (!online) {
      banda.classList.remove('oculto');
      banda.classList.toggle('modo-sim', TK.net.simOffline);
      banda.textContent = (TK.net.simOffline ? 'Modo sin señal simulado. ' : 'Sin señal. ') +
        'Puedes seguir creando tickets y tomando fotos: se guardan en este equipo y se envían solos al volver la conexión.' +
        (TK.ui.colaN ? ' Pendientes de enviar: ' + TK.ui.colaN + '.' : '');
    } else if (TK.ui.apartadas) {
      banda.classList.remove('oculto', 'modo-sim');
      banda.textContent = TK.ui.apartadas + ' envío(s) requieren atención. Revisa la pestaña Envíos.';
    } else {
      banda.classList.add('oculto');
    }
  };

  TK.bus.addEventListener('red', function () { TK.ui.pintarChrome(); });
  TK.bus.addEventListener('sync', function () { TK.ui.pintarChrome(); });
  TK.bus.addEventListener('cola', function () { TK.ui.refrescarCola(); });
  TK.bus.addEventListener('aviso', function (e) { TK.ui.toast(e.detail.texto, e.detail.tipo === 'warn' ? 'warn' : ''); });
})(window.TK);
