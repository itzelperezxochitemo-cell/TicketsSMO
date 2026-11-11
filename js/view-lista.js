window.TK = window.TK || {};
TK.vistas = TK.vistas || {};
TK.acc = TK.acc || { click: {}, change: {}, input: {} };
TK.estadoUI = TK.estadoUI || { pestana: null, busqueda: '', };

(function (TK) {
  'use strict';
  var esc = TK.esc;

  function falla(e) { TK.ui.toast((e && e.message) || 'Algo salió mal', 'warn'); }

  var PESTANAS = [
    { id: 'asignados', nombre: 'Asignados a mí' },
    { id: 'creados', nombre: 'Creados por mí' },
    { id: 'apoyo', nombre: 'Apoyo' },
    { id: 'todos', nombre: 'Mis tickets' },
    { id: 'cerrados', nombre: 'Cerrados' },
    { id: 'vencidos', nombre: 'Vencidos', rojo: true },
    { id: 'area', nombre: 'Todo el almacén', soloSup: true }
  ];

  TK.vistas.inicio = function (cont) {
    var u = TK.sesion.actual();
    return TK.tickets.todos().then(function (lista) {
      var tabs = PESTANAS.filter(function (p) { return !p.soloSup || TK.esSupervisor(u); });
      var cuentas = {};
      tabs.forEach(function (p) { cuentas[p.id] = TK.tickets.filtrar(lista, p.id, u).length; });
      if (!TK.estadoUI.pestana || !tabs.some(function (p) { return p.id === TK.estadoUI.pestana; })) {
        TK.estadoUI.pestana = cuentas.asignados > 0 ? 'asignados' : 'todos';
      }
      var items = TK.tickets.filtrar(lista, TK.estadoUI.pestana, u);
      var q = TK.estadoUI.busqueda.trim().toLowerCase();
      if (q) {
        items = items.filter(function (t) {
          return ((t.folio || '') + ' ' + (t.folioProv || '') + ' ' + t.actividad + ' ' + t.categoria + ' ' + TK.resumenUbicacion(t.ubicacion) + ' ' +
            TK.nombreDe(t.solicitante) + ' ' + TK.nombreDe(t.responsable)).toLowerCase().indexOf(q) >= 0;
        });
      }
      var mostrar = items.slice(0, 80);
      var base = TK.tickets.visibles(lista, u);
      var kAbiertos = base.filter(TK.tickets.abierto).length;
      var kSinPlan = base.filter(TK.tickets.sinPlanear).length;
      var kVenc = base.filter(TK.tickets.vencido).length;
      var kComp = base.filter(function (t) { return t.estado === 'Completado'; }).length;
      var cifra = function (t, v, s, mal) { return '<div class="cifra' + (mal ? ' mal' : '') + '"><span class="etq">' + t + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; };
      var LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5"/></svg>';
      var html =
        TK.ui.titulo('Tickets', 'Solicitudes de apoyo del almacén', '<span class="nuevo-escritorio">' + TK.ui.BTN_NUEVO + '</span>') +
        '<div class="cifras">' +
          cifra('Abiertos', kAbiertos, 'En trámite en el almacén') +
          cifra('Sin planear', kSinPlan, 'Esperan fecha compromiso', kSinPlan > 0) +
          cifra('Vencidos', kVenc, 'Pasaron su fecha compromiso', kVenc > 0) +
          cifra('Completados', kComp, 'Tickets cerrados') + '</div>' +
        '<section class="panel">' +
        '<div class="pestanas" role="tablist" aria-label="Vistas de tickets">' + tabs.map(function (p) {
          return '<button type="button" role="tab" aria-selected="' + (p.id === TK.estadoUI.pestana) + '" class="pestana' + (p.id === TK.estadoUI.pestana ? ' activa' : '') + (p.rojo && cuentas[p.id] ? ' rojo' : '') +
            '" data-acc="tab" data-id="' + p.id + '"><span>' + esc(p.nombre) + '</span><span class="n">' + cuentas[p.id] + '</span></button>';
        }).join('') + '</div>' +
        '<div class="herramientas"><label class="buscador">' + LUPA +
          '<input type="search" id="buscar" placeholder="Buscar por folio, actividad o ubicación" value="' + esc(TK.estadoUI.busqueda) + '" data-inp="buscar" aria-label="Buscar tickets"></label>' +
          '<span class="chico">Mostrando ' + mostrar.length + ' de ' + items.length + ' tickets</span></div>' +
        (mostrar.length ?
          '<div class="tabla-wrap"><div class="tk-tabla" role="table" aria-label="Tickets del almacén">' +
            '<div class="tk-fila cab" role="row"><span role="columnheader">Folio</span><span role="columnheader">Actividad</span><span role="columnheader">Ubicación</span><span role="columnheader">Impacto</span><span role="columnheader">Estado</span><span role="columnheader">Responsable</span><span role="columnheader">Fecha compromiso</span></div>' +
            mostrar.map(TK.ui.filaTicket).join('') + '</div></div>' +
          '<div class="lista-cel">' + mostrar.map(TK.ui.tarjetaTicket).join('') + '</div>' :
          '<div class="vacio"><div class="grande"></div><p>No hay tickets en esta pestaña.</p><a class="btn primario" href="#/nuevo">Crear un ticket</a></div>') +
        '<div class="pie-panel">' + (items.length > mostrar.length ? 'Mostrando ' + mostrar.length + ' de ' + items.length + '. ' : '') + 'Usa el buscador para acotar la lista.</div>' +
        '</section>';
      cont.innerHTML = html;
    });
  };

  TK.acc.click.tab = function (el) {
    TK.estadoUI.pestana = el.getAttribute('data-id');
    TK.vistas.inicio(TK.$('#vista'));
  };
  TK.acc.input.buscar = function (el) {
    TK.estadoUI.busqueda = el.value;
    var pos = el.selectionStart;
    TK.vistas.inicio(TK.$('#vista')).then(function () {
      var n = TK.$('#buscar');
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* tipo search */ } }
    });
  };

  TK.vistas.detalle = function (cont, id) {
    var u = TK.sesion.actual();
    return Promise.all([TK.tickets.obtener(id), TK.tickets.fotosDe(id)]).then(function (r) {
      var t = r[0], fotos = r[1];
      if (!t) { cont.innerHTML = '<div class="vacio"><div class="grande">🔎</div><p>No se encontró el ticket.</p><a class="btn" href="#/">Volver</a></div>'; return; }
      if (!TK.tickets.puedeVer(t, u)) { cont.innerHTML = '<div class="vacio"><div class="grande">🔒</div><p>No tienes acceso a este ticket.</p><a class="btn" href="#/">Volver</a></div>'; return; }
      var local = TK.ui.pendienteDe(t);
      var acciones = TK.tickets.acciones(t, u);
      var abierto = TK.tickets.abierto(t);
      var puedePlanear = TK.tickets.puedePlanear(t, u);
      var puedeReasignar = TK.tickets.puedeReasignar(t, u);
      var miApoyo = (t.apoyo || []).find(function (a) { return a.correo === u.correo; });
      var progreso = TK.sync.estado.progresoFoto;
      var h = '', P = {};
      var esB = t.tipoSolicitud === 'solicito';

      h += '<div class="tarjeta cabecera-ticket"><div class="fila espacio envolver"><span class="folio">' + esc(t.folio || t.folioProv) + '</span>' +
        '<span class="fila envolver">' + (local ? '<span class="etiqueta local">Pendiente de enviar</span>' : '') + TK.ui.etiquetaEstado(t) + TK.ui.etiquetaImpacto(t.impacto) + '</span></div>' +
        '<h2 class="mt">' + esc(t.actividad) + '</h2><div class="suave">' + esc(t.categoria) + '</div>' +
        (!t.folio ? '<div class="nota">Este ticket se creó en el dispositivo. El folio definitivo llega al sincronizar.</div>' : '') +
        (esB && abierto && !t.compromiso ? '<div class="nota">' + (puedePlanear ? 'Este ticket te lo solicitaron: revisa el requerimiento y define tus fechas con "Planear fechas".' : 'Esperando que ' + esc(TK.nombreDe(t.responsable)) + ' defina las fechas.') + '</div>' : '') +
        '<dl class="kv mt">' +
        '<dt>Tipo de solicitud</dt><dd>' + (t.tipoSolicitud === 'ejecuto' ? 'El solicitante ejecuta la actividad' : 'El solicitante pide que otra persona la realice') + '</dd>' +
        '<dt>Ubicación</dt><dd>' + esc(TK.resumenUbicacion(t.ubicacion)) + '</dd>' +
        '<dt>Solicitante</dt><dd>' + esc(TK.nombreDe(t.solicitante)) + ' <span class="chico">(' + esc(t.area) + ')</span></dd>' +
        '<dt>Responsable</dt><dd>' + esc(TK.nombreDe(t.responsable)) + '</dd>' +
        '<dt>Creado</dt><dd>' + TK.fmtFechaHora(t.creado) + (t.origen === 'offline' ? ' <span class="chico">(sin conexión)</span>' : '') + '</dd>' +
        '<dt>Fecha de inicio</dt><dd>' + (t.fechaInicio ? TK.fmtFecha(t.fechaInicio) : '<span class="suave">Sin definir</span>') + '</dd>' +
        '<dt>Fecha compromiso</dt><dd>' + (t.compromiso ? TK.fmtFecha(t.compromiso) : '<span class="suave">Sin definir</span>') + ' ' + TK.ui.diasHtml(t) + '</dd>' +
        '<dt>Fecha de finalización</dt><dd>' + (t.fechaFin ? TK.fmtFecha(t.fechaFin) : '<span class="suave">Sin definir</span>') + '</dd>' +
        (t.descripcion ? '<dt>Descripción</dt><dd>' + esc(t.descripcion) + '</dd>' : '') +
        (t.cierre ? '<dt>' + (t.estado === 'Cancelado' ? 'Cancelado' : 'Cierre') + '</dt><dd>' + esc(TK.nombreDe(t.cerradoPor)) + ' · ' + TK.fmtFechaHora(t.cierre) +
          (t.comentarioCierre ? '<div class="chico">' + esc(t.comentarioCierre) + '</div>' : '') + '</dd>' : '') +
        '</dl></div>';
      P.cab = h; h = '';

      if (acciones.length || puedePlanear || puedeReasignar) {
        h += '<div class="tarjeta"><h3>Acciones</h3><div class="fila envolver">' +
          acciones.map(function (a) {
            if (a.cerrar) return '<button type="button" class="btn primario" data-acc="cerrar">' + esc(a.etiqueta) + '</button>';
            return '<button type="button" class="btn ' + (a.peligro ? 'peligro' : '') + '" data-acc="estado" data-a="' + esc(a.a) + '" data-motivo="' + (a.pideMotivo ? 1 : 0) +
              '" data-plan="' + (a.pidePlan ? 1 : 0) + '" data-etiqueta="' + esc(a.etiqueta) + '">' + esc(a.etiqueta) + '</button>';
          }).join('') +
          (puedePlanear ? '<button type="button" class="btn" data-acc="planear">Planear fechas</button>' : '') +
          (puedeReasignar ? '<button type="button" class="btn" data-acc="reasignar">Reasignar</button>' : '') + '</div></div>';
      }
      P.acc = h; h = '';

      // Evidencias: una imagen inicial y una final. Sin capturas intermedias.
      h += '<div class="tarjeta"><h3>Evidencias</h3><div class="ranuras">' + TK.ETAPAS.map(function (e) {
        var f = fotos.filter(function (x) { return x.etapa === e; })[0];
        var sube = f && progreso && progreso.fotoId === f.id ? progreso.p : null;
        var cuerpo = f ?
          '<button type="button" class="mini" data-acc="ver-foto" data-id="' + f.id + '" aria-label="Ver imagen ' + e.toLowerCase() + '"><img src="' + f.thumb + '" alt="Imagen ' + e.toLowerCase() + '">' +
            '<span class="estado ' + (f.estadoSubida === 'Subida' ? 'ok' : '') + '">' + (f.estadoSubida === 'Subida' ? '✓ Enviada' : f.estadoSubida === 'Subiendo' ? 'Subiendo…' : 'En el equipo') + '</span>' +
            '<span class="tag">' + TK.fmtBytes(f.bytes) + '</span>' + (sube !== null ? '<span class="barra"><i style="width:' + sube + '%"></i></span>' : '') + '</button>' :
          '<div class="vacia">Sin imagen ' + e.toLowerCase() + '</div>';
        var btn = abierto ? '<label class="btn chico"><input type="file" accept="image/*" capture="environment" hidden data-chg="foto-detalle" data-etapa="' + e + '">' + (f ? 'Reemplazar' : 'Tomar foto') + '</label>' +
          '<label class="btn chico"><input type="file" accept="image/*" hidden data-chg="foto-detalle" data-etapa="' + e + '">Galería</label>' : '';
        return '<div class="ranura"><b>Imagen ' + e.toLowerCase() + '</b>' + cuerpo + '<div class="fila envolver">' + btn + '</div></div>';
      }).join('') + '</div>';
      if (TK.tickets.requiereFotoFinal(t) && abierto) {
        h += '<p class="chico mt">' + (fotos.some(function (f) { return f.etapa === 'Final'; }) ? '✓ Ya hay imagen final.' : 'Para cerrar este ticket se necesita la imagen final.') + '</p>';
      }
      h += '</div>';
      P.evi = h; h = '';

      if ((t.apoyo || []).length) {
        h += '<div class="tarjeta"><h3>Apoyo solicitado</h3>' + t.apoyo.map(function (a) {
          var usu = TK.usuario(a.correo);
          return '<div class="fila espacio" style="padding:6px 0"><div><b>' + esc(TK.nombreDe(a.correo)) + '</b><div class="chico">' + esc(usu ? usu.area : '') + ' · ' + esc(a.correo) + '</div></div>' +
            '<span class="etiqueta ' + (a.estado === 'aceptado' ? 'estado-Completado' : a.estado === 'rechazado' ? 'estado-Vencido' : 'estado-Pendiente') + '">' + (a.estado === 'pendiente' ? 'Sin responder' : a.estado === 'aceptado' ? 'Aceptó' : 'Rechazó') + '</span></div>';
        }).join('') +
          (t.apoyoIncompleto ? '<div class="nota mala">Alguien rechazó el apoyo. Pide seguimiento por comentarios o reasigna el ticket.</div>' : '') +
          (miApoyo && miApoyo.estado === 'pendiente' ? '<div class="fila mt"><button type="button" class="btn primario" data-acc="apoyo" data-si="1">Aceptar apoyo</button><button type="button" class="btn peligro" data-acc="apoyo" data-si="0">Rechazar</button></div>' : '') +
          '</div>';
      }
      P.apo = h; h = '';

      var part = TK.participantesRaci(t.actividad).filter(function (x) { return TK.usuario(x.correo); });
      if (part.length) {
        h += '<div class="tarjeta"><h3>Matriz RACI</h3><div class="chico">R ejecuta · A es el dueño · C se consulta · I se informa</div>' + part.map(function (x) {
          return '<div class="fila espacio" style="padding:5px 0"><span>' + esc(TK.nombreDe(x.correo)) + '</span><span class="etiqueta">' + esc(x.codigo) + '</span></div>';
        }).join('') + '</div>';
      }
      P.raci = h; h = '';

      h += '<div class="tarjeta"><h3>Comentarios</h3>' + (t.comentarios.length ? t.comentarios.map(function (c) {
        return '<div class="comentario"><b>' + esc(TK.nombreDe(c.autor)) + '</b> <span class="chico">' + TK.fmtFechaHora(c.ts) + '</span><div>' + esc(c.texto) + '</div></div>';
      }).join('') : '<p class="suave">Sin comentarios.</p>') +
        '<label class="campo" for="txtComentario">Agregar comentario</label><textarea id="txtComentario" rows="2" placeholder="Escribe una nota o pide apoyo o seguimiento"></textarea>' +
        '<button type="button" class="btn mt" data-acc="comentar">Enviar comentario</button></div>';
      P.com = h; h = '';

      h += '<div class="tarjeta"><h3>Historial</h3><ul class="linea-tiempo">' + t.historial.slice().reverse().map(function (x) {
        return '<li><span class="cuando">' + TK.fmtFechaHora(x.ts) + ' · ' + esc(x.usuario === 'Sistema' ? 'Sistema' : TK.nombreDe(x.usuario)) + '</span>' + esc(x.texto) + '</li>';
      }).join('') + '</ul></div>';
      P.his = h;

      function ord(x, n) { return x ? x.replace(/<div class="tarjeta/g, '<div style="order:' + n + '" class="tarjeta') : ''; }
      cont.innerHTML = '<a class="volver" href="#/">← Volver a la lista</a>' +
        '<div class="det-grid"><div class="det-col det-encab">' + ord(P.cab, 0) + '</div>' +
        '<div class="det-col det-izq">' + ord(P.evi, 2) + ord(P.com, 5) + '</div>' +
        '<div class="det-col det-der">' + ord(P.acc, 1) + ord(P.apo, 3) + ord(P.raci, 4) + ord(P.his, 6) + '</div></div>';
      cont.setAttribute('data-ticket', id);
    });
  };

  function ticketActual() { return TK.tickets.obtener(TK.$('#vista').getAttribute('data-ticket')); }
  function recargar() { return TK.vistas.detalle(TK.$('#vista'), TK.$('#vista').getAttribute('data-ticket')); }

  TK.acc.click['ver-foto'] = function (el) {
    TK.db.get('photos', el.getAttribute('data-id')).then(function (f) { if (f) TK.ui.verFoto(f); });
  };

  TK.acc.change['foto-detalle'] = function (el) {
    var archivo = (el.files || [])[0];
    var etapa = el.getAttribute('data-etapa');
    el.value = '';
    if (!archivo) return;
    ticketActual().then(function (t) {
      return TK.procesarFoto(archivo, etapa).then(function (foto) { return TK.tickets.agregarFoto(t, foto); });
    }).then(function () {
      TK.ui.toast('Imagen ' + etapa.toLowerCase() + ' guardada en tu equipo' + (TK.net.online() ? '' : '. Se enviará al volver la señal.'), 'ok');
    }).then(recargar).catch(falla);
  };

  // Diálogo de planeación (responsable). Devuelve {fechaInicio, compromiso, fechaFin, motivo} o undefined.
  function dialogoPlan(t, titulo) {
    var cambia = !!t.compromiso;
    return TK.ui.dialogo({
      titulo: titulo || 'Planear fechas',
      cuerpo: '<p class="suave">Define cuándo empiezas, cuándo te comprometes a entregar y cuándo terminarás.</p>' +
        '<label class="campo" for="pIni">Fecha de inicio</label><input type="date" id="pIni" value="' + esc(t.fechaInicio || '') + '">' +
        '<label class="campo" for="pComp">Fecha compromiso</label><input type="date" id="pComp" value="' + esc(t.compromiso || '') + '" min="' + TK.hoy() + '">' +
        '<label class="campo" for="pFin">Fecha de finalización</label><input type="date" id="pFin" value="' + esc(t.fechaFin || '') + '">' +
        (cambia ? '<label class="campo" for="pMot">Motivo del cambio (si mueves la fecha compromiso)</label><textarea id="pMot" rows="2"></textarea>' : ''),
      botones: [{ texto: 'Volver', valor: undefined }, {
        texto: 'Guardar', clase: 'primario',
        validar: function (d) {
          var i = TK.$('#pIni', d).value, c = TK.$('#pComp', d).value, f = TK.$('#pFin', d).value, m = cambia ? TK.$('#pMot', d).value.trim() : '';
          if (!c) return 'Define la fecha compromiso.';
          if (i && i > c) return 'El inicio no puede ser posterior al compromiso.';
          if (i && f && f < i) return 'La finalización no puede ser anterior al inicio.';
          if (cambia && c !== t.compromiso && !m) return 'Escribe el motivo del cambio de fecha compromiso.';
          return null;
        },
        recoger: function (d) { return { fechaInicio: TK.$('#pIni', d).value || null, compromiso: TK.$('#pComp', d).value, fechaFin: TK.$('#pFin', d).value || null, motivo: cambia ? TK.$('#pMot', d).value.trim() : '' }; }
      }]
    });
  }

  TK.acc.click.planear = function () {
    ticketActual().then(function (t) {
      return dialogoPlan(t).then(function (v) { return v ? TK.tickets.planear(t, v).then(function () { TK.ui.toast('Fechas guardadas.', 'ok'); }) : null; });
    }).then(recargar).catch(falla);
  };

  TK.acc.click.reasignar = function () {
    ticketActual().then(function (t) {
      var opciones = TK.USUARIOS.filter(function (x) { return x.correo !== t.responsable; }).map(function (x) {
        return '<option value="' + esc(x.correo) + '">' + esc(x.nombre) + ' · ' + esc(x.rol) + '</option>';
      }).join('');
      return TK.ui.dialogo({
        titulo: 'Reasignar ticket',
        cuerpo: '<p class="suave">Responsable actual: <b>' + esc(TK.nombreDe(t.responsable)) + '</b></p>' +
          '<label class="campo" for="rNuevo">Nuevo responsable</label><select id="rNuevo">' + opciones + '</select>' +
          '<label class="campo" for="rMot">Motivo (opcional)</label><textarea id="rMot" rows="2"></textarea>',
        botones: [{ texto: 'Volver', valor: undefined }, {
          texto: 'Reasignar', clase: 'primario',
          recoger: function (d) { return { nuevo: TK.$('#rNuevo', d).value, motivo: TK.$('#rMot', d).value }; }
        }]
      }).then(function (v) { return v ? TK.tickets.reasignar(t, v.nuevo, v.motivo).then(function () { TK.ui.toast('Ticket reasignado.', 'ok'); }) : null; });
    }).then(recargar).catch(falla);
  };

  // Cerrar: cualquier usuario con acceso. Se registra quién, cuándo y un comentario opcional.
  TK.acc.click.cerrar = function () {
    Promise.all([ticketActual(), null]).then(function (r) {
      var t = r[0];
      return TK.tickets.fotosDe(t.id).then(function (fotos) {
        var tiene = fotos.some(function (f) { return f.etapa === 'Final'; });
        var pideFoto = TK.tickets.requiereFotoFinal(t) && !tiene;
        var foto = null;
        return TK.ui.dialogo({
          titulo: 'Cerrar ticket',
          cuerpo: '<p class="suave">Cerrará: <b>' + esc(TK.nombreDe(TK.sesion.correo)) + '</b> · ' + TK.fmtFechaHora(TK.ahora()) + '</p>' +
            '<label class="campo" for="cCom">Comentarios de cierre (opcional)</label><textarea id="cCom" rows="3"></textarea>' +
            (pideFoto ? '<label class="campo">Imagen final (obligatoria)</label><label class="btn"><input type="file" id="cFoto" accept="image/*" hidden>Tomar o elegir imagen</label><div class="miniaturas" id="cMini"></div>' : ''),
          alAbrir: function (d) {
            var inp = TK.$('#cFoto', d);
            if (!inp) return;
            inp.addEventListener('change', function (e) {
              var a = (e.target.files || [])[0]; e.target.value = '';
              if (!a) return;
              TK.procesarFoto(a, 'Final').then(function (f) {
                foto = f;
                TK.$('#cMini', d).innerHTML = '<div class="mini"><img alt="Imagen final" src="' + f.thumb + '"><span class="tag">' + TK.fmtBytes(f.bytes) + '</span></div>';
              }).catch(falla);
            });
          },
          botones: [{ texto: 'Volver', valor: undefined }, {
            texto: 'Cerrar ticket', clase: 'primario',
            validar: function () { return pideFoto && !foto ? 'Agrega la imagen final para cerrar.' : null; },
            recoger: function (d) { return { comentario: TK.$('#cCom', d).value, foto: foto }; }
          }]
        }).then(function (v) { return v ? TK.tickets.cerrar(t, v).then(function () { TK.ui.toast('Ticket cerrado.', 'ok'); }) : null; });
      });
    }).then(recargar).catch(falla);
  };

  TK.acc.click.estado = function (el) {
    var nuevo = el.getAttribute('data-a');
    var pideMotivo = el.getAttribute('data-motivo') === '1';
    var pidePlan = el.getAttribute('data-plan') === '1';
    var etiqueta = el.getAttribute('data-etiqueta');
    ticketActual().then(function (t) {
      // Para empezar sin compromiso, primero se planea.
      var previo = pidePlan ? dialogoPlan(t, 'Antes de empezar: planea tus fechas').then(function (v) { return v ? TK.tickets.planear(t, v).then(function () { return true; }) : false; }) : Promise.resolve(true);
      return previo.then(function (ok) {
        if (!ok) return null;
        if (!pideMotivo) {
          return TK.ui.confirmar(etiqueta, '¿Confirmas el cambio a "' + nuevo + '"?', 'Confirmar', nuevo === 'Cancelado' ? 'peligro' : 'primario').then(function (c) {
            return c ? TK.tickets.cambiarEstado(t, nuevo, {}) : null;
          });
        }
        return TK.ui.dialogo({
          titulo: etiqueta,
          cuerpo: '<label class="campo" for="dMotivo">Motivo' + (nuevo === 'Pendiente de información' ? ' (¿qué dato falta y a quién se lo pides?)' : '') + '</label><textarea id="dMotivo" rows="3"></textarea>',
          botones: [{ texto: 'Volver', valor: undefined }, {
            texto: 'Confirmar', clase: nuevo === 'Cancelado' ? 'peligro' : 'primario',
            validar: function (d) { return !TK.$('#dMotivo', d).value.trim() ? 'Escribe el motivo.' : null; },
            recoger: function (d) { return { motivo: TK.$('#dMotivo', d).value.trim() }; }
          }]
        }).then(function (v) { return v ? TK.tickets.cambiarEstado(t, nuevo, v) : null; });
      });
    }).then(recargar).catch(falla);
  };

  TK.acc.click.apoyo = function (el) {
    var si = el.getAttribute('data-si') === '1';
    ticketActual().then(function (t) { return TK.tickets.responderApoyo(t, si); }).then(recargar).catch(falla);
  };

  TK.acc.click.comentar = function () {
    var txt = TK.$('#txtComentario').value;
    ticketActual().then(function (t) { return TK.tickets.comentar(t, txt); }).then(recargar).catch(falla);
  };
})(window.TK);
