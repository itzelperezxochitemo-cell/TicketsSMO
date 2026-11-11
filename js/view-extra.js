window.TK = window.TK || {};
TK.vistas = TK.vistas || {};
TK.acc = TK.acc || { click: {}, change: {}, input: {} };
TK.estadoUI = TK.estadoUI || {};

(function (TK) {
  'use strict';
  var esc = TK.esc;
  TK.estadoUI.dash = TK.estadoUI.dash || { dias: 90, categoria: '', area: '' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function media(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function mediana(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function cuenta(lista, fn) {
    var m = {};
    lista.forEach(function (t) { var k = fn(t); m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { nombre: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n; });
  }
  function barras(datos, opc) {
    opc = opc || {};
    if (!datos.length) return '<p class="suave">Sin datos en el periodo.</p>';
    var max = Math.max.apply(null, datos.map(function (d) { return d.n; })) || 1;
    return '<div class="barras">' + datos.map(function (d, i) {
      return '<div class="b' + (d.mal ? ' mal' : i === 0 && opc.acento ? ' acento' : '') + '"><span class="nom" title="' + esc(d.nombre) + '">' + esc(d.nombre) + '</span>' +
        '<span class="pista"><i style="width:' + Math.max(3, Math.round(d.n / max * 100)) + '%"></i></span><span class="n">' + d.n + '</span></div>';
    }).join('') + '</div>';
  }
  function horasTxt(h) {
    if (h === null) return '—';
    if (h < 1) return Math.round(h * 60) + ' min';
    if (h < 48) return h.toFixed(1) + ' h';
    return (h / 24).toFixed(1) + ' d';
  }

  function lineas(series, etiquetas) {
    var W = 640, H = 230, L = 34, R = 12, T = 14, B = 28;
    var max = Math.max.apply(null, [1].concat(series.reduce(function (a, s) { return a.concat(s.v); }, [])));
    var paso = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10;
    var tope = Math.ceil(max / paso) * paso;
    var x = function (i) { return L + (etiquetas.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (etiquetas.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / tope); };
    var g = '';
    for (var v = 0; v <= tope; v += paso) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E3E9F6"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#5A6989">' + v + '</text>';
    }
    etiquetas.forEach(function (e, i) { g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#5A6989">' + e + '</text>'; });
    series.forEach(function (s) {
      var pts = s.v.map(function (n, i) { return x(i) + ',' + y(n); }).join(' ');
      if (s.borde) g += '<polyline points="' + pts + '" fill="none" stroke="#1F5FD6" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>';
      g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      s.v.forEach(function (n, i) {
        g += '<circle cx="' + x(i) + '" cy="' + y(n) + '" r="4.5" fill="' + s.color + '" stroke="#1F5FD6" stroke-width="1.5"><title>' + s.nombre + ' ' + etiquetas[i] + ': ' + n + '</title></circle>';
      });
    });
    return '<svg class="grafica-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tendencia mensual de tickets creados y cerrados">' + g + '</svg>' +
      '<div class="leyenda">' + series.map(function (s) { return '<span><i style="background:' + s.color + ';border:1.5px solid #1F5FD6"></i>' + s.nombre + '</span>'; }).join('') + '</div>';
  }

  TK.vistas.dashboard = function (cont) {
    var u = TK.sesion.actual();
    var f = TK.estadoUI.dash;
    return TK.tickets.todos().then(function (todos) {
      var alcance = TK.tickets.visibles(todos, u);
      var areas = Object.keys(alcance.reduce(function (m, t) { m[t.area] = 1; return m; }, {})).sort();
      var base = alcance.filter(function (t) { return (!f.categoria || t.categoriaId === f.categoria) && (!f.area || t.area === f.area); });
      var hoy = TK.hoy();
      var desde = f.dias ? TK.sumarDias(hoy, -f.dias) : '0000-00-00';
      var periodo = base.filter(function (t) { return t.creado.slice(0, 10) >= desde; });

      var abiertos = base.filter(TK.tickets.abierto);
      var vencidos = abiertos.filter(TK.tickets.vencido);
      var cerrados = periodo.filter(function (t) { return t.estado === 'Completado' && t.cierre; });
      var cumplen = cerrados.filter(function (t) { return TK.tickets.cumpleCompromiso(t) === true; }).length;
      var conComp = cerrados.filter(function (t) { return t.compromiso; }).length;
      var sla = conComp ? Math.round(cumplen / conComp * 100) : null;
      var porImpacto = TK.IMPACTO_IDS.map(function (i) { return { nombre: i, n: periodo.filter(function (t) { return t.impacto === i; }).length }; });
      var atenciones = periodo.map(TK.tickets.horasAtencion).filter(function (x) { return x !== null; });
      var resoluciones = cerrados.map(function (t) { return (new Date(t.cierre) - new Date(t.creado)) / 3600000; });

      var cubos = [{ n: '0 a 3 días', a: 0, b: 3 }, { n: '4 a 7 días', a: 4, b: 7 }, { n: '8 a 15 días', a: 8, b: 15 }, { n: 'Más de 15 días', a: 16, b: 9999 }];
      var backlog = cubos.map(function (c) {
        var l = abiertos.filter(function (t) { var d = TK.diasEntre(t.creado.slice(0, 10), hoy); return d >= c.a && d <= c.b; });
        return { nombre: c.n, n: l.length, venc: l.filter(TK.tickets.vencido).length };
      });
      var maxB = Math.max.apply(null, [1].concat(backlog.map(function (x) { return x.n; })));

      var d0 = new Date(); d0.setDate(1);
      var claves = [], etiquetas = [];
      for (var i = 5; i >= 0; i--) {
        var d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
        claves.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        etiquetas.push(MESES[d.getMonth()]);
      }
      var creadosM = claves.map(function (k) { return base.filter(function (t) { return t.creado.slice(0, 7) === k; }).length; });
      var cerradosM = claves.map(function (k) { return base.filter(function (t) { return t.estado === 'Completado' && t.cierre && t.cierre.slice(0, 7) === k; }).length; });

      var estatus = cuenta(periodo, function (t) { return TK.tickets.estadoMostrado(t); }).map(function (d) { d.mal = d.nombre === 'Vencido'; return d; });
      var porActividad = cuenta(periodo, function (t) { return t.actividad; }).slice(0, 10);
      var porCategoria = cuenta(periodo, function (t) { return t.categoria; });
      var porArea = cuenta(periodo, function (t) { return t.area; }).slice(0, 10);

      var h = TK.ui.titulo('Indicadores', TK.esAdmin(u) ? 'Todo el almacén' : 'Solo tus tickets') +
        '<div class="tarjeta"><div class="grid3">' +
        '<div><label class="campo" for="fDias" style="margin-top:0">Periodo</label><select id="fDias" data-chg="dash-f" data-k="dias">' +
        [[30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [180, 'Últimos 180 días'], [0, 'Todo']].map(function (o) { return '<option value="' + o[0] + '"' + (f.dias === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div><label class="campo" for="fCat" style="margin-top:0">Categoría</label><select id="fCat" data-chg="dash-f" data-k="categoria"><option value="">Todas</option>' +
        TK.CATALOGO.map(function (c) { return '<option value="' + c.id + '"' + (f.categoria === c.id ? ' selected' : '') + '>' + esc(c.nombre) + '</option>'; }).join('') + '</select></div>' +
        '<div><label class="campo" for="fArea" style="margin-top:0">Área</label><select id="fArea" data-chg="dash-f" data-k="area"><option value="">Todas</option>' +
        areas.map(function (a) { return '<option' + (f.area === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div></div></div>' +

        '<div class="kpis">' +
        '<div class="kpi"><div class="v">' + abiertos.length + '</div><div class="t">Tickets abiertos</div><div class="s">Backlog actual</div></div>' +
        '<div class="kpi ' + (vencidos.length ? 'mal' : 'bien') + '"><div class="v">' + vencidos.length + '</div><div class="t">Vencidos</div><div class="s">' + (abiertos.length ? Math.round(vencidos.length / abiertos.length * 100) : 0) + '% de los abiertos</div></div>' +
        '<div class="kpi ' + (sla === null ? '' : sla >= 85 ? 'bien' : sla >= 65 ? '' : 'mal') + '"><div class="v">' + (sla === null ? '—' : sla + '%') + '</div><div class="t">Cumplimiento de compromiso</div><div class="s">' + cumplen + ' de ' + conComp + ' cerrados a tiempo</div></div>' +
        '<div class="kpi"><div class="v">' + horasTxt(media(atenciones)) + '</div><div class="t">Tiempo promedio de atención</div><div class="s">Mediana ' + horasTxt(mediana(atenciones)) + ' · resolución ' + horasTxt(media(resoluciones)) + '</div></div></div>' +

        '<div class="rejilla-dash">' +
        '<div class="tarjeta"><h3>Tickets por estatus</h3>' + barras(estatus) + '</div>' +
        '<div class="tarjeta"><h3>Backlog por antigüedad</h3><div class="barras">' + backlog.map(function (c) {
          return '<div class="b"><span class="nom">' + c.nombre + '</span><span class="pista" style="display:flex"><i style="width:' + Math.round((c.n - c.venc) / maxB * 100) + '%;border-radius:6px 0 0 6px"></i><i style="width:' + Math.round(c.venc / maxB * 100) + '%;background:var(--rojo);border-radius:0 6px 6px 0"></i></span><span class="n">' + c.n + '</span></div>';
        }).join('') + '</div><div class="leyenda"><span><i style="background:#1F5FD6"></i>Dentro de plazo</span><span><i style="background:#E04444"></i>Vencidos</span></div></div>' +
        '<div class="tarjeta"><h3>Tickets por impacto</h3>' + barras(porImpacto, { acento: true }) + '</div>' +
        '<div class="tarjeta"><h3>Tickets por categoría</h3>' + barras(porCategoria, { acento: true }) + '</div>' +
        '<div class="tarjeta"><h3>Top 10 actividades</h3>' + barras(porActividad, { acento: true }) + '</div>' +
        '<div class="tarjeta"><h3>Top áreas solicitantes</h3>' + barras(porArea, { acento: true }) + '</div>' +
        '<div class="tarjeta"><h3>Tendencia mensual</h3>' + lineas([
          { nombre: 'Creados', v: creadosM, color: '#E04444' }, { nombre: 'Cerrados', v: cerradosM, color: '#FC931F', borde: true }], etiquetas) + '</div></div>' +
        '<p class="suave">Periodo seleccionado: ' + periodo.length + ' tickets creados. Tiempo de atención = de la creación a pasar a En proceso. Cumplimiento = cierre a más tardar en la fecha compromiso (solo cuentan tickets con compromiso).</p>';
      cont.innerHTML = h;
    });
  };

  TK.acc.change['dash-f'] = function (el) {
    var k = el.getAttribute('data-k');
    TK.estadoUI.dash[k] = k === 'dias' ? Number(el.value) : el.value;
    TK.vistas.dashboard(TK.$('#vista'));
  };

  var NOMBRES_OP = {
    crear_ticket: 'Crear ticket', subir_foto: 'Subir foto', cambiar_estado: 'Cambiar estado', agregar_comentario: 'Comentario',
    responder_apoyo: 'Responder apoyo', cerrar: 'Cerrar', planear: 'Planear fechas', reasignar: 'Reasignar'
  };

  TK.vistas.cola = function (cont) {
    return Promise.all([TK.queue.todas(), TK.tickets.todos(), TK.db.all('photos'),
      navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null),
      navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(function (r) {
      var ops = r[0], mapa = {}, fotos = r[2], est = r[3], persistente = r[4];
      r[1].forEach(function (t) { mapa[t.id] = t; });
      var pendF = fotos.filter(function (f) { return f.estadoSubida !== 'Subida'; });
      var bytesPend = pendF.reduce(function (n, f) { return n + (f.bytes || 0); }, 0);
      var online = TK.net.online();
      var h = TK.ui.titulo('Envíos', 'Sincronización') + '<div class="tarjeta">' +
        '<div class="fila espacio envolver"><div><b>' + (online ? (TK.sync.estado.corriendo ? 'Sincronizando…' : 'Con conexión') : 'Sin señal') + '</b>' +
        '<div class="chico">' + (TK.sync.estado.ultimo ? 'Última revisión: ' + TK.fmtFechaHora(TK.sync.estado.ultimo) : 'Aún no se ha sincronizado en esta sesión') + '</div></div>' +
        '<button type="button" class="btn primario" data-acc="sync-ahora"' + (online ? '' : ' disabled') + '>Sincronizar ahora</button></div>' +
        '<div class="grid3 mt"><div class="kpi"><div class="v">' + ops.length + '</div><div class="t">Operaciones pendientes</div></div>' +
        '<div class="kpi ' + (ops.some(function (o) { return o.apartada; }) ? 'mal' : '') + '"><div class="v">' + ops.filter(function (o) { return o.apartada; }).length + '</div><div class="t">Requieren atención</div></div>' +
        '<div class="kpi"><div class="v">' + pendF.length + '</div><div class="t">Fotos por enviar</div><div class="s">' + TK.fmtBytes(bytesPend) + '</div></div></div></div>';

      h += '<div class="tarjeta"><h3>Lista</h3>' + (ops.length ? ops.map(function (o) {
        var t = mapa[o.ticketId];
        return '<div class="op-cola"><div class="fila espacio"><b>' + (NOMBRES_OP[o.tipo] || esc(o.tipo)) + '</b><span class="chico">' + TK.fmtFechaHora(o.ts) + '</span></div>' +
          '<div class="chico">' + (t ? esc(t.folio || t.folioProv) + ' · ' + esc(t.actividad) : 'Ticket ' + esc(o.ticketId.slice(0, 8))) + ' · intentos: ' + o.intentos + (o.apartada ? ' · <b>apartada</b>' : '') + '</div>' +
          (o.ultimoError ? '<div class="err">' + esc(o.ultimoError) + '</div>' : '') + '</div>';
      }).join('') + (ops.some(function (o) { return o.apartada; }) ? '<button type="button" class="btn mt" data-acc="reintentar">Reintentar las que requieren atención</button>' : '')
        : '<div class="vacio"><div class="grande"></div><p>Todo está enviado. No hay nada pendiente.</p></div>') +
        '<p class="chico mt">Las actividades se envían en el orden en que se crearon y solo se borran cuando el servidor las confirma.</p></div>';

      h += '<div class="tarjeta"><h3>Almacenamiento en este equipo</h3>' +
        (est && est.quota ? '<p>Usado: <b>' + TK.fmtBytes(est.usage) + '</b> de ' + TK.fmtBytes(est.quota) + ' disponibles (' + (est.usage / est.quota * 100).toFixed(1) + '%).</p>' : '<p class="suave">Este navegador no informa el espacio disponible.</p>') +
        '<p>Almacenamiento: <b>' + (persistente ? 'Concedido' : 'No concedido') + '</b></p>' +
        (!persistente && navigator.storage && navigator.storage.persist ? '<button type="button" class="btn chico" data-acc="persistir">Almacenamiento</button>' : '') +
        '<p class="chico mt"></p></div>';
      cont.innerHTML = h;
    });
  };

  TK.acc.click['sync-ahora'] = function () { TK.sync.run({ manual: true }).then(function () { TK.vistas.cola(TK.$('#vista')); }); };
  TK.acc.click.reintentar = function () { TK.queue.reintentarApartadas().then(function () { TK.vistas.cola(TK.$('#vista')); }); };
  TK.acc.click.persistir = function () {
    navigator.storage.persist().then(function (ok) {
      TK.ui.toast(ok ? 'Almacenamiento ' : 'El navegador no lo concedió. Instala la app e inténtalo de nuevo.', ok ? 'ok' : 'warn');
      TK.vistas.cola(TK.$('#vista'));
    });
  };

  TK.vistas.mas = function (cont) {
    var u = TK.sesion.actual();
    return Promise.all([TK.db.getMeta('bandeja', []), TK.tickets.todos()]).then(function (r) {
      var bandeja = r[0], lista = r[1];
      var mios = bandeja.filter(function (a) { return a.para.indexOf(u.correo) >= 0; }).slice(0, 30);
      var ini = u.nombre.split(' ').map(function (x) { return x.charAt(0); }).slice(0, 2).join('').toUpperCase();
      var ab = TK.tickets.filtrar(lista, 'todos', u).filter(TK.tickets.abierto).length;
      var ce = TK.tickets.filtrar(lista, 'cerrados', u).length;
      var pa = TK.tickets.filtrar(lista, 'todos', u).filter(TK.tickets.sinPlanear).filter(function (t) { return t.responsable === u.correo; }).length;
      var h = TK.ui.titulo('Perfil', 'Tu cuenta y opciones de la app') +
        '<div class="hero perfil"><div class="avatar" aria-hidden="true">' + esc(ini) + '</div>' +
        '<div class="nombre">' + esc(u.nombre) + '</div><div class="rol">' + esc(u.rol) + ' · ' + esc(u.area) + '</div>' +
        '<div class="stats"><div><b>' + ab + '</b><span>Abiertos</span></div><div><b>' + ce + '</b><span>Cerrados</span></div><div><b>' + pa + '</b><span>Por planear</span></div></div></div>' +


        '<button type="button" class="btn salir" data-acc="cerrar-sesion">Cerrar sesión</button>' ;
      cont.innerHTML = h;
    });
  };

  TK.acc.change['sim-offline'] = function (el) { TK.net.setSimOffline(el.checked); TK.ui.toast(el.checked ? 'Sin señal simulada' : 'Conexión restablecida. Sincronizando…', el.checked ? '' : 'ok'); };
  TK.acc.change['sim-fallas'] = function (el) { TK.net.setFallas(el.checked); };
  TK.acc.click['gen-rec'] = function () { TK.tickets.generarRecordatorios().then(function () { TK.ui.toast('Recordatorios revisados', 'ok'); TK.vistas.mas(TK.$('#vista')); }); };
  TK.acc.click.instalar = function () {
    if (!TK.instalar) return;
    TK.instalar.prompt();
    TK.instalar.userChoice.then(function () { TK.instalar = null; TK.vistas.mas(TK.$('#vista')); });
  };
})(window.TK);
