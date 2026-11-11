window.TK = window.TK || {};
TK.vistas = TK.vistas || {};
TK.acc = TK.acc || { click: {}, change: {}, input: {} };

(function (TK) {
  'use strict';
  var esc = TK.esc;
  
  function nuevoBorrador() {
    return {
      paso: 1, categoriaId: null, actividad: null, busqueda: '',
      ubicacion: { tipo: 'cortina', nave: TK.NAVES[0], pasillo: '', rack: '', cortina: '', texto: '' },
      descripcion: '', impacto: 'Medio', impactoTocado: false, tipoSolicitud: null, responsable: null,
      compromiso: '', apoyo: [], fotos: [], buscaPersona: '', enviando: false
    };
  }
  var b = nuevoBorrador();
  TK.reiniciarBorrador = function () { b = nuevoBorrador(); };

  function recientes() {
    try { return JSON.parse(localStorage.getItem('tk.recientes') || '[]'); } catch (e) { return []; }
  }
  function guardarReciente(act) {
    var r = recientes().filter(function (x) { return x !== act; });
    r.unshift(act);
    localStorage.setItem('tk.recientes', JSON.stringify(r.slice(0, 6)));
  }

  var SUB = ['', 'Elige la categoría y la actividad que necesitas', 'Indica dónde se realizará', 'Define el tipo de solicitud, el impacto y la imagen inicial', 'Revisa y envía'];
  var lado = '';
  function barraPasos() {
    var s = '';
    var nom = ['', 'Actividad', 'Ubicación', 'Evidencia y detalle', 'Revisión'];
    for (var i = 1; i <= 4; i++) s += '<div class="p ' + (i < b.paso ? 'hecho' : i === b.paso ? 'actual' : '') + '"><i>' + (i < b.paso ? '✓' : i) + '</i><span class="t">' + nom[i] + '</span></div>';
    return '<div class="pasos" aria-label="Paso ' + b.paso + ' de 4">' + s + '</div>';
  }

  function pie(atras, siguiente, textoSig, deshabilitado) {
    lado = (siguiente ? '<button type="button" class="btn continuar" data-acc="nv-sig"' + (deshabilitado ? ' disabled' : '') + '>' + (textoSig || 'Continuar') + '</button>' : '') +
      (atras ? '<button type="button" class="btn" data-acc="nv-atras">Atrás</button>' : '') +
      '<button type="button" class="btn cancelar" data-acc="nv-cancelar">Cancelar</button>';
    return '';
  }

  var LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5"/></svg>';
  function paso1() {
    var q = b.busqueda.trim().toLowerCase();
    var total = TK.CATALOGO.reduce(function (n, c) { return n + c.actividades.length; }, 0);
    var h = '<h3>¿Qué necesitas?</h3><label class="buscador">' + LUPA +
      '<input type="search" id="nvBuscar" placeholder="Buscar actividad en las ' + total + ' disponibles" value="' + esc(b.busqueda) + '" data-inp="nv-buscar" autocomplete="off" aria-label="Buscar actividad"></label>';
    pie(false, false);
    if (q) {
      var res = [];
      TK.CATALOGO.forEach(function (c) {
        c.actividades.forEach(function (a) { if ((a + ' ' + c.nombre).toLowerCase().indexOf(q) >= 0) res.push({ c: c, a: a }); });
      });
      return h + '<div class="acts mt">' + (res.length ? res.slice(0, 40).map(function (r) {
        return '<button type="button" class="act-op" data-acc="nv-act" data-cat="' + r.c.id + '" data-a="' + esc(r.a) + '"><span>' + esc(r.a) + '<small>' + esc(r.c.nombre) + '</small></span></button>';
      }).join('') : '<p class="suave">No hay actividades con ese texto. Prueba con otra palabra o elige una categoría.</p>') + '</div>';
    }
    var cat = b.categoriaId ? TK.CATALOGO.find(function (c) { return c.id === b.categoriaId; }) : null;
    var der = '';
    if (cat) {
      der = '<div><span class="etq">' + esc(cat.nombre) + ' · ' + cat.actividades.length + ' actividades</span><div class="suave">Elige la actividad.</div></div>' +
        '<div class="acts">' + cat.actividades.map(function (a) {
          return '<button type="button" class="act-op' + (b.actividad === a ? ' sel' : '') + '" data-acc="nv-act" data-cat="' + cat.id + '" data-a="' + esc(a) + '"><span>' + esc(a) + '</span></button>';
        }).join('') + '</div>';
    } else {
      var rec = recientes().filter(function (a) { return TK.categoriaDe(a); });
      der = '<div><span class="etq">Categorías</span><div class="suave">Elige una categoría de la lista.</div></div>';
      if (rec.length) {
        der += '<div><span class="etq">Recientes</span></div><div class="acts">' + rec.slice(0, 4).map(function (a) {
          var c = TK.categoriaDe(a);
          return '<button type="button" class="act-op" data-acc="nv-act" data-cat="' + c.id + '" data-a="' + esc(a) + '"><span>' + esc(a) + '<small>' + esc(c.nombre) + '</small></span></button>';
        }).join('') + '</div>';
      }
    }
    return h + '<div class="maestro"><nav class="cats" aria-label="Categorías">' + TK.CATALOGO.map(function (c) {
      return '<button type="button" class="cat' + (b.categoriaId === c.id ? ' sel' : '') + '" data-acc="nv-cat" data-id="' + c.id + '"' + (b.categoriaId === c.id ? ' aria-current="true"' : '') + '>' + esc(c.nombre) + '<small>' + c.actividades.length + '</small></button>';
    }).join('') + '</nav><div class="detalle-cat">' + der + '</div></div>';
  }

  function paso2() {
    var u = b.ubicacion;
    // Actividades marcadas "libre" en la matriz RACI: la ubicación no está en naves, se escribe libremente.
    if (TK.actividadLibre(b.actividad)) {
      var hl = '<h3>Ubicación</h3><label class="campo" for="u-texto">¿Dónde se realizará? (campo abierto)</label>' +
        '<input type="text" id="u-texto" value="' + esc(u.texto || '') + '" placeholder="Ej. Baños del comedor, patio poniente, taller, oficinas planta alta" data-inp="nv-ubic" data-k="texto" autocomplete="off" maxlength="160">' +
        '<p class="chico">Escribe la ubicación como la conoce el equipo: área, cortina, nave, nombre del lugar o referencia.</p>';
      return hl + pie(true, true, 'Continuar', !(u.texto || '').trim());
    }
    var h = '<h3>Ubicación</h3><label class="campo">Nave</label><div class="segmento">' + TK.NAVES.map(function (n) {      return '<button type="button" class="seg' + (u.nave === n ? ' sel' : '') + '" data-acc="nv-nave" data-v="' + n + '">' + n + '</button>';
    }).join('') + '</div><label class="campo">Tipo de ubicación</label><div class="segmento">' + TK.TIPOS_UBICACION.map(function (t) {
      return '<button type="button" class="seg' + (u.tipo === t.id ? ' sel' : '') + '" data-acc="nv-tipo" data-v="' + t.id + '">' + t.nombre + '</button>';
    }).join('') + '</div>';
    function campo(id, etiqueta, ph) {
      return '<label class="campo" for="u-' + id + '">' + etiqueta + '</label><input type="text" id="u-' + id + '" value="' + esc(u[id]) + '" placeholder="' + ph + '" data-inp="nv-ubic" data-k="' + id + '" inputmode="text" autocomplete="off">';
    }
    if (u.tipo === 'rack') h += '<div class="grid2"><div>' + campo('pasillo', 'Pasillo', 'Ej. 7') + '</div><div>' + campo('rack', 'Rack', 'Ej. 24') + '</div></div>';
    if (u.tipo === 'pasillo') h += campo('pasillo', 'Pasillo', 'Ej. 7');
    if (u.tipo === 'cortina') h += campo('cortina', 'Número de cortina', 'Ej. 14');
    if (u.tipo === 'staff' || u.tipo === 'libre' || u.tipo === 'otra') {
      h += campo('texto', u.tipo === 'otra' ? 'Describe la ubicación' : 'Referencia (opcional)', 'Ej. junto a comedor, patio de maniobras');
    }
    h += '<div class="nota">' + esc(TK.resumenUbicacion(u)) + '</div>';
    var falta = (u.tipo === 'rack' && !u.pasillo && !u.rack) || (u.tipo === 'cortina' && !u.cortina) || (u.tipo === 'pasillo' && !u.pasillo) || (u.tipo === 'otra' && !u.texto.trim());
    return h + pie(true, true, 'Continuar', falta);
  }

  function minis() {
    var f = b.fotos[0];
    if (!f) return '<p class="suave">Aún no hay imagen inicial. Ayuda mucho a quien va a atender.</p>';
    return '<div class="miniaturas"><div class="mini"><img src="' + f.thumb + '" alt="Imagen inicial"><span class="tag">Inicial · ' + TK.fmtBytes(f.bytes) + '</span>' +
      '<button type="button" class="quitar" data-acc="nv-quitar" data-id="' + f.id + '" aria-label="Quitar imagen">✕</button></div></div>';
  }

  function otrosUsuarios() { return TK.USUARIOS.filter(function (u) { return u.correo !== TK.sesion.correo; }); }
  // Opciones de "Asignar a": primero quienes participan según la RACI de la actividad, luego el resto.
  function opcionesResp(sel) {
    var raci = TK.raciDe(b.actividad), yo = TK.sesion.correo;
    var cod = function (u) { return raci[u.correo] ? ' · ' + raci[u.correo] : ''; };
    var op = function (u) { return '<option value="' + esc(u.correo) + '"' + (u.correo === sel ? ' selected' : '') + '>' + esc(u.nombre) + ' (' + esc(u.rol) + ')' + cod(u) + '</option>'; };
    var otros = otrosUsuarios();
    var enRaci = otros.filter(function (u) { return raci[u.correo]; }), resto = otros.filter(function (u) { return !raci[u.correo]; });
    return (enRaci.length ? '<optgroup label="Según la matriz RACI">' + enRaci.map(op).join('') + '</optgroup>' : '') +
      '<optgroup label="Otros usuarios">' + resto.map(op).join('') + '</optgroup>';
  }
  function respElegido() {
    if (b.responsable && b.responsable !== TK.sesion.correo) return b.responsable;
    var d = TK.responsablePorDefecto(b.categoriaId, b.actividad);
    if (d && d !== TK.sesion.correo) return d;
    return otrosUsuarios()[0] ? otrosUsuarios()[0].correo : null;
  }

  function personasHtml() {
    var q = b.buscaPersona.trim().toLowerCase();
    var yo = TK.sesion.correo;
    var lista = TK.USUARIOS.filter(function (u) {
      return u.correo !== yo && (!q || (u.nombre + ' ' + u.area + ' ' + u.correo).toLowerCase().indexOf(q) >= 0);
    });
    var raci = TK.raciDe(b.actividad);
    lista.sort(function (a, c) { return (raci[c.correo] ? 1 : 0) - (raci[a.correo] ? 1 : 0); });
    return lista.map(function (u) {
      var sel = b.apoyo.indexOf(u.correo) >= 0;
      return '<label class="persona"><input type="checkbox" data-chg="nv-persona" data-c="' + u.correo + '"' + (sel ? ' checked' : '') + '><span><b>' + esc(u.nombre) + '</b><br><span class="chico">' + esc(u.area) + ' · ' + esc(u.correo) + '</span></span></label>';
    }).join('') || '<div class="persona">Sin resultados</div>';
  }

  function paso3() {
    var sugiereAlto = TK.SUGIERE_ALTO.indexOf(b.actividad) >= 0;
    if (sugiereAlto && !b.impactoTocado) b.impacto = 'Alto';
    var tipo = b.tipoSolicitud;
    var h = '<h3>Tipo de solicitud, impacto y evidencia</h3>' +
      '<label class="campo">Tipo de solicitud</label><div class="opciones-tipo">' + TK.TIPOS_SOLICITUD.map(function (x) {
        return '<button type="button" class="opcion-tipo' + (tipo === x.id ? ' sel' : '') + '" data-acc="nv-tipo-sol" data-v="' + x.id + '" aria-pressed="' + (tipo === x.id) + '"><b>' + esc(x.nombre) + '</b><span class="chico">' + esc(x.desc) + '</span></button>';
      }).join('') + '</div>';
    if (!tipo) return h + '<div class="nota">Elige una opción para continuar.</div>' + pie(true, true, 'Continuar', true);
    if (tipo === 'ejecuto') {
      h += '<label class="campo" for="nvComp">Fecha compromiso (opcional)</label><input type="date" id="nvComp" min="' + TK.hoy() + '" value="' + esc(b.compromiso) + '" data-chg="nv-comp">' +
        '<p class="chico">Tú eres el responsable y puedes definirla o cambiarla después.</p>';
    } else {
      var r = respElegido();
      h += '<div class="nota">Quien reciba el ticket analiza el trabajo y define fecha de inicio, compromiso y finalización. Tú no defines fechas operativas.</div>' +
        '<label class="campo" for="nvResp">Asignar a</label><select id="nvResp" data-chg="nv-resp">' + opcionesResp(r) + '</select>';
    }
    h += '<label class="campo" for="nvDesc">Descripción' + (tipo === 'solicito' ? ' del requerimiento (obligatoria)' : ' (opcional)') + '</label>' +
      '<textarea id="nvDesc" rows="4" placeholder="' + (tipo === 'solicito' ? 'Describe completo lo que se necesita: qué, dónde, cuánto y para cuándo lo ocupas.' : 'Cuenta qué vas a hacer. Puedes dictar con el micrófono del teclado.') + '" data-inp="nv-desc">' + esc(b.descripcion) + '</textarea>' +
      '<label class="campo">Impacto</label>' + (sugiereAlto ? '<div class="nota">Por seguridad se sugiere impacto Alto para esta actividad.</div>' : '') +
      '<div class="segmento">' + TK.IMPACTOS.map(function (p) {
        return '<button type="button" class="seg ' + p.id + (b.impacto === p.id ? ' sel' : '') + '" data-acc="nv-impacto" data-v="' + p.id + '">' + p.id + '</button>';
      }).join('') + '</div>' +
      '<p class="chico">' + esc(TK.IMPACTOS.find(function (p) { return p.id === b.impacto; }).desc) + '</p>' +
      '<label class="campo">Imagen inicial (opcional)</label>' +
      '<div class="zona-fotos" id="zonaFotos"><div class="fila envolver" style="justify-content:center">' +
      '<label class="btn primario"><input type="file" accept="image/*" capture="environment" hidden data-chg="nv-foto">Tomar foto</label>' +
      '<label class="btn"><input type="file" accept="image/*" hidden data-chg="nv-foto">Galería</label></div>' +
      '<p class="chico mt" style="margin-bottom:0">También puedes arrastrar una imagen aquí o pegarla con Ctrl+V. Solo se guardan imagen inicial e imagen final.</p></div>' +
      '<div id="minis">' + minis() + '</div>';
    if (tipo === 'ejecuto') {
      h += '<label class="campo" for="nvPers">Solicitar apoyo de personas (opcional)</label>' +
        '<input type="search" id="nvPers" placeholder="Buscar por nombre o área" value="' + esc(b.buscaPersona) + '" data-inp="nv-pers" autocomplete="off">' +
        '<div class="personas mt" id="personas">' + personasHtml() + '</div>' +
        (b.apoyo.length ? '<p class="chico">Se avisará a ' + b.apoyo.length + ' persona(s) cuando el ticket se sincronice.</p>' : '');
    }
    var falta = tipo === 'solicito' && b.descripcion.trim().length < 10;
    return h + pie(true, true, 'Continuar', falta);
  }

  function paso4() {
    var cat = TK.CATALOGO.find(function (c) { return c.id === b.categoriaId; });
    var online = TK.net.online();
    var ej = b.tipoSolicitud === 'ejecuto';
    var h = '<h3>Revisa y envía</h3><dl class="resumen">' +
      '<dt>Actividad</dt><dd>' + esc(b.actividad) + '<div class="chico">' + esc(cat.nombre) + '</div></dd>' +
      '<dt>Tipo de solicitud</dt><dd>' + esc(TK.TIPOS_SOLICITUD.find(function (x) { return x.id === b.tipoSolicitud; }).nombre) + '</dd>' +
      '<dt>Ubicación</dt><dd>' + esc(TK.resumenUbicacion(b.ubicacion)) + '</dd>' +
      '<dt>Impacto</dt><dd>' + TK.ui.etiquetaImpacto(b.impacto) + '</dd>' +
      '<dt>Responsable</dt><dd>' + esc(TK.nombreDe(ej ? TK.sesion.correo : respElegido())) + '</dd>' +
      '<dt>Fecha compromiso</dt><dd>' + (ej ? (b.compromiso ? TK.fmtFecha(b.compromiso) : 'Sin definir (la defines después)') : 'La define el responsable') + '</dd>' +
      '<dt>Imagen inicial</dt><dd>' + (b.fotos.length ? 'Sí (' + TK.fmtBytes(b.fotos[0].bytes) + ')' : 'Sin imagen') + '</dd>' +
      (ej ? '<dt>Apoyo</dt><dd>' + (b.apoyo.length ? b.apoyo.map(TK.nombreDe).map(esc).join(', ') : 'Ninguno') + '</dd>' : '') +
      (b.descripcion.trim() ? '<dt><span class="etq">Descripción</span></dt><dd>' + esc(b.descripcion) + '</dd>' : '') + '</dl>' +
      (online ? '<div class="nota">Hay conexión: el ticket se enviará de inmediato.</div>'
        : '<div class="nota mala"><b>Sin señal.</b> El ticket y su imagen se guardarán en este equipo y se enviarán solos al volver la conexión. No pierdes nada.</div>');
    lado = '<button type="button" class="btn primario" data-acc="nv-enviar"' + (b.enviando ? ' disabled' : '') + '>' + (online ? 'Enviar ticket' : 'Guardar y enviar después') + '</button>' +
      '<button type="button" class="btn" data-acc="nv-atras">Atrás</button>' +
      '<button type="button" class="btn cancelar" data-acc="nv-cancelar">Cancelar</button>';
    return h;
  }

  function resumenLado() {
    var cat = b.categoriaId ? TK.CATALOGO.find(function (c) { return c.id === b.categoriaId; }) : null;
    function it(t, v) { return '<div><dt class="etq">' + t + '</dt><dd>' + v + '</dd></div>'; }
    var d = it('Categoría', cat ? esc(cat.nombre) : '<span class="suave">Sin elegir</span>') +
      it('Actividad', b.actividad ? esc(b.actividad) : '<span class="suave">Sin elegir</span>');
    if (b.paso >= 3) d += it('Ubicación', esc(TK.resumenUbicacion(b.ubicacion)));
    if (b.paso >= 4) { d += it('Impacto', TK.ui.etiquetaImpacto(b.impacto)); d += it('Tipo', esc(TK.TIPOS_SOLICITUD.find(function (x) { return x.id === b.tipoSolicitud; }).nombre)); }
    return '<section class="tarjeta"><h3>Resumen</h3><dl class="resumen">' + d + '</dl><div class="botones">' + lado + '</div></section>';
  }

  TK.vistas.nuevo = function (cont) {
    lado = '';
    var cuerpo = [null, paso1, paso2, paso3, paso4][b.paso]();
    cont.innerHTML = TK.ui.titulo('Nuevo ticket', 'Paso ' + b.paso + ' de 4 · ' + SUB[b.paso]) + barraPasos() +
      '<div class="nv-grid"><div class="nv-main"><section class="tarjeta">' + cuerpo + '</section></div><aside class="nv-lado">' + resumenLado() + '</aside></div>';
    cont.removeAttribute('data-ticket');
    return Promise.resolve();
  };
  function pintar() { return TK.vistas.nuevo(TK.$('#vista')); }
  function arriba() { window.scrollTo({ top: 0 }); }

  TK.acc.click['nv-cat'] = function (el) { b.categoriaId = el.getAttribute('data-id'); b.actividad = null; pintar(); };
  TK.acc.click['nv-act'] = function (el) {
    b.categoriaId = el.getAttribute('data-cat'); b.actividad = el.getAttribute('data-a'); b.busqueda = '';
    b.impactoTocado = false; b.responsable = null;
    b.ubicacion = TK.actividadLibre(b.actividad) ? { tipo: 'abierta', texto: (b.ubicacion.tipo === 'abierta' ? b.ubicacion.texto : '') } : (b.ubicacion.tipo === 'abierta' ? nuevoBorrador().ubicacion : b.ubicacion);
    b.paso = 2; guardarReciente(b.actividad); pintar(); arriba();
  };
  TK.acc.input['nv-buscar'] = function (el) {
    b.busqueda = el.value; var pos = el.selectionStart;
    pintar().then(function () { var n = TK.$('#nvBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignorar */ } } });
  };
  TK.acc.click['nv-nave'] = function (el) { b.ubicacion.nave = el.getAttribute('data-v'); pintar(); };
  TK.acc.click['nv-tipo'] = function (el) { b.ubicacion.tipo = el.getAttribute('data-v'); pintar(); };
  TK.acc.input['nv-ubic'] = function (el) {
    b.ubicacion[el.getAttribute('data-k')] = el.value;
    var nota = TK.$('.nota'); if (nota) nota.textContent = '' + TK.resumenUbicacion(b.ubicacion);
    var sig = TK.$('[data-acc="nv-sig"]');
    if (sig) {
      var u = b.ubicacion;
      sig.disabled = (u.tipo === 'abierta' && !u.texto.trim()) || (u.tipo === 'rack' && !u.pasillo && !u.rack) || (u.tipo === 'cortina' && !u.cortina) || (u.tipo === 'pasillo' && !u.pasillo) || (u.tipo === 'otra' && !u.texto.trim());
    }
  };
  TK.acc.click['nv-cancelar'] = function () {
    TK.ui.confirmar('Cancelar ticket nuevo', 'Se descartará lo que llevas capturado.', 'Descartar', 'peligro').then(function (ok) {
      if (!ok) return;
      TK.reiniciarBorrador();
      location.hash = '#/';
    });
  };
  TK.acc.click['nv-atras'] = function () { b.paso = Math.max(1, b.paso - 1); pintar(); arriba(); };
  TK.acc.click['nv-sig'] = function () { b.paso = Math.min(4, b.paso + 1); pintar(); arriba(); };
  TK.acc.click['nv-tipo-sol'] = function (el) { b.tipoSolicitud = el.getAttribute('data-v'); if (b.tipoSolicitud === 'solicito') b.apoyo = []; pintar(); };
  TK.acc.click['nv-impacto'] = function (el) { b.impacto = el.getAttribute('data-v'); b.impactoTocado = true; pintar(); };
  TK.acc.input['nv-desc'] = function (el) {
    b.descripcion = el.value;
    var sig = TK.$('[data-acc="nv-sig"]');
    if (sig && b.tipoSolicitud === 'solicito') sig.disabled = b.descripcion.trim().length < 10;
  };
  TK.acc.change['nv-comp'] = function (el) { b.compromiso = el.value || ''; };
  TK.acc.change['nv-resp'] = function (el) { b.responsable = el.value; };
  TK.acc.input['nv-pers'] = function (el) { b.buscaPersona = el.value; TK.$('#personas').innerHTML = personasHtml(); };
  TK.acc.change['nv-persona'] = function (el) {
    var c = el.getAttribute('data-c'), i = b.apoyo.indexOf(c);
    if (el.checked && i < 0) b.apoyo.push(c);
    if (!el.checked && i >= 0) b.apoyo.splice(i, 1);
  };
  TK.acc.click['nv-quitar'] = function (el) {
    b.fotos = [];
    TK.$('#minis').innerHTML = minis();
  };

  // Solo hay una imagen inicial: la nueva reemplaza a la anterior.
  function agregarArchivos(archivos) {
    var img = Array.prototype.slice.call(archivos || []).filter(function (f) { return /^image\//.test(f.type); })[0];
    if (!img) { TK.ui.toast('Solo se aceptan imágenes.', 'warn'); return Promise.resolve(); }
    return TK.procesarFoto(img, 'Inicial').then(function (foto) {
      b.fotos = [foto];
      var m = TK.$('#minis'); if (m) m.innerHTML = minis();
    }).catch(function (e) { TK.ui.toast(e.message, 'warn'); });
  }
  TK.acc.change['nv-foto'] = function (el) {
    var arch = el.files; var copia = Array.prototype.slice.call(arch || []);
    el.value = '';
    agregarArchivos(copia);
  };

  document.addEventListener('dragover', function (e) {
    var z = TK.$('#zonaFotos'); if (!z) return;
    e.preventDefault(); z.classList.add('sobre');
  });
  document.addEventListener('dragleave', function () { var z = TK.$('#zonaFotos'); if (z) z.classList.remove('sobre'); });
  document.addEventListener('drop', function (e) {
    var z = TK.$('#zonaFotos'); if (!z) return;
    e.preventDefault(); z.classList.remove('sobre');
    agregarArchivos(e.dataTransfer && e.dataTransfer.files);
  });
  document.addEventListener('paste', function (e) {
    if (!TK.$('#zonaFotos')) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var archivos = [];
    for (var i = 0; i < items.length; i++) if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) archivos.push(f); }
    if (archivos.length) { e.preventDefault(); agregarArchivos(archivos); TK.ui.toast('Imagen pegada', 'ok', 1800); }
  });

  TK.acc.click['nv-enviar'] = function () {
    if (b.enviando) return;
    b.enviando = true; pintar();
    var datos = {
      categoriaId: b.categoriaId, actividad: b.actividad, ubicacion: Object.assign({}, b.ubicacion, { resumen: TK.resumenUbicacion(b.ubicacion) }),
      descripcion: b.descripcion, impacto: b.impacto, tipoSolicitud: b.tipoSolicitud,
      compromiso: b.tipoSolicitud === 'ejecuto' ? (b.compromiso || null) : null,
      responsable: b.tipoSolicitud === 'solicito' ? respElegido() : null,
      apoyo: b.tipoSolicitud === 'ejecuto' ? b.apoyo.slice() : [], fotos: b.fotos.slice()
    };
    var online = TK.net.online();
    TK.tickets.crear(datos).then(function (t) {
      TK.reiniciarBorrador();
      TK.ui.toast(online ? 'Ticket creado. Enviando…' : 'Guardado en tu equipo. Se enviará solo al volver la señal.', 'ok', 5000);
      location.hash = '#/t/' + t.id;
    }).catch(function (e) {
      b.enviando = false; pintar();
      TK.ui.toast(e.message || 'No se pudo guardar', 'warn');
    });
  };
})(window.TK);
