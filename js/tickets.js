window.TK = window.TK || {};

(function (TK) {
  'use strict';

  TK.sesion = {
    correo: localStorage.getItem('tk.sesion') || TK.USUARIOS[0].correo,
    logueado: function () { return !!TK.usuario(localStorage.getItem('tk.sesion')); },
    actual: function () { return TK.usuario(TK.sesion.correo) || TK.USUARIOS[0]; },
    entrar: function (usuario, clave) {
      var q = String(usuario || '').trim().toLowerCase();
      var u = TK.USUARIOS.find(function (x) { return x.usuario === q || x.correo === q; });
      if (!u || clave !== TK.CLAVE_DEMO) return null;
      TK.sesion.correo = u.correo;
      localStorage.setItem('tk.sesion', u.correo);
      return u;
    },
    salir: function () {
      localStorage.removeItem('tk.sesion');
      TK.sesion.correo = TK.USUARIOS[0].correo;
    }
  };

  // Primera vez en producción en este equipo: elimina tickets, fotos y sesión de la versión de demostración.
  TK.purgarDemo = function () {
    return TK.db.getMeta('produccion-v1', false).then(function (ya) {
      if (ya || !TK.PRODUCCION) return null;
      return TK.db.borrarTodo().then(function () {
        try { localStorage.removeItem('tk.sesion'); localStorage.removeItem('tk.simOffline'); localStorage.removeItem('tk.fallas'); } catch (e) {}
        return TK.db.setMeta('produccion-v1', true);
      });
    });
  };

  // Primera vez con Supabase en este equipo: lo guardado antes vive solo en el servidor simulado local
  // (nunca llegó a la base de datos), así que se descarta para no mezclar pruebas con datos reales.
  TK.purgarLocalAlConectar = function () {
    if (TK.backend !== 'supabase') return Promise.resolve();
    return TK.db.getMeta('backend-supabase-v1', false).then(function (ya) {
      if (ya) return null;
      return TK.db.borrarTodo().then(function () {
        try { localStorage.removeItem('tk.sesion'); localStorage.removeItem('tk.auth'); localStorage.removeItem('tk.supaPull'); } catch (e) {}
        TK.sesion.correo = TK.USUARIOS[0].correo;
        // borrarTodo también vacía 'meta': se reponen las marcas para no repetir limpiezas.
        return Promise.all([TK.db.setMeta('backend-supabase-v1', true), TK.db.setMeta('produccion-v1', true), TK.db.setMeta('schema', 2)]);
      });
    });
  };

  var LADO_MAX = 1600, LADO_MINI = 320, CALIDAD = 0.75;

  function cargarBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }
  function dibujar(src, ancho, alto, max, tipo, calidad) {
    var esc = Math.min(1, max / Math.max(ancho, alto));
    var w = Math.max(1, Math.round(ancho * esc)), h = Math.max(1, Math.round(alto * esc));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return new Promise(function (resolve) {
      c.toBlob(function (b) { resolve({ blob: b, w: w, h: h, canvas: c }); }, tipo, calidad);
    });
  }
  function huella(blob) {
    if (window.crypto && crypto.subtle && blob.arrayBuffer) {
      return blob.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (d) {
        return Array.prototype.map.call(new Uint8Array(d), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      });
    }
    return Promise.resolve('f' + blob.size + '-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  }

  TK.procesarFoto = function (file, etapa) {
    if (!file || !/^image\//.test(file.type || 'image/jpeg')) return Promise.reject(new Error('El archivo no es una imagen'));
    return cargarBitmap(file).then(function (bmp) {
      var ancho = bmp.width || bmp.naturalWidth, alto = bmp.height || bmp.naturalHeight;
      return dibujar(bmp, ancho, alto, LADO_MAX, 'image/jpeg', CALIDAD).then(function (full) {
        return dibujar(bmp, ancho, alto, LADO_MINI, 'image/jpeg', 0.6).then(function (mini) {
          return huella(full.blob).then(function (h) {
            if (bmp.close) bmp.close();
            return {
              id: TK.uuid(), etapa: etapa, blob: full.blob, thumb: mini.canvas.toDataURL('image/jpeg', 0.6),
              bytes: full.blob.size, bytesOriginal: file.size, ancho: full.w, alto: full.h, hash: h,
              estadoSubida: 'Local', progreso: 0, tomada: TK.ahora(), por: TK.sesion.correo
            };
          });
        });
      });
    });
  };

  TK.tickets = {};

  TK.tickets.todos = function () { return TK.db.all('tickets'); };
  TK.tickets.obtener = function (id) { return TK.db.get('tickets', id); };
  TK.tickets.fotosDe = function (id) { return TK.db.byIndex('photos', 'ticketId', id); };

  // La fecha límite es la fecha compromiso. Mientras el responsable no la define, el ticket está "sin planear".
  TK.tickets.limite = function (t) { return t.compromiso || null; };
  TK.tickets.abierto = function (t) { return TK.ABIERTOS.indexOf(t.estado) >= 0; };
  TK.tickets.sinPlanear = function (t) { return TK.tickets.abierto(t) && !t.compromiso; };
  TK.tickets.vencido = function (t) {
    return TK.tickets.abierto(t) && !!TK.tickets.limite(t) && TK.tickets.limite(t) < TK.hoy();
  };
  TK.tickets.diasRestantes = function (t) {
    var l = TK.tickets.limite(t);
    return l ? TK.diasEntre(TK.hoy(), l) : null;
  };
  TK.tickets.estadoMostrado = function (t) { return TK.tickets.vencido(t) ? 'Vencido' : t.estado; };

  // La imagen final es obligatoria para cerrar, salvo en estas categorías (no dejan un resultado que fotografiar).
  TK.tickets.sinFotoFinal = ['inspeccion', 'acordonamiento', 'staff', 'limpieza', 'residuos'];
  TK.tickets.requiereFotoFinal = function (t) { return TK.tickets.sinFotoFinal.indexOf(t.categoriaId) < 0; };

  // Cumplimiento: cerrado a más tardar el día de la fecha compromiso. null si no tenía compromiso.
  TK.tickets.cumpleCompromiso = function (t) {
    if (!t.cierre || !t.compromiso) return null;
    return TK.fechaLocal(t.cierre) <= t.compromiso;
  };
  TK.tickets.horasAtencion = function (t) {
    if (!t.primeraAtencion) return null;
    return (new Date(t.primeraAtencion) - new Date(t.creado)) / 3600000;
  };

  // Visibilidad: administrador ve todo; los demás, lo propio (solicita, responde, apoyo) y lo que les escala por vencimiento.
  TK.tickets.escaladoA = function (t, u) {
    if (!TK.tickets.abierto(t) || (u.rol !== 'Supervisor' && u.rol !== 'Coordinador')) return false;
    var d = TK.tickets.diasRestantes(t);
    if (d === null) return false;
    return u.rol === 'Supervisor' ? d <= -1 : d <= -3;
  };
  TK.tickets.esPropio = function (t, u) {
    var c = u.correo;
    return t.solicitante === c || t.responsable === c || (t.apoyo || []).some(function (a) { return a.correo === c; });
  };
  // Participa según la RACI de la actividad (R, A o C): también le corresponde el ticket.
  TK.tickets.enRaci = function (t, u) { return TK.tieneRolActivo(t.raci || TK.raciDe(t.actividad), u.correo); };
  TK.tickets.puedeVer = function (t, u) { return !!u && (TK.esAdmin(u) || TK.tickets.esPropio(t, u) || TK.tickets.enRaci(t, u) || TK.tickets.escaladoA(t, u)); };
  TK.tickets.visibles = function (lista, u) { return lista.filter(function (t) { return TK.tickets.puedeVer(t, u); }); };

  TK.tickets.filtrar = function (lista, pestaña, u) {
    var c = u.correo;
    return lista.filter(function (t) {
      var abierto = TK.tickets.abierto(t);
      var conApoyo = (t.apoyo || []).some(function (a) { return a.correo === c; });
      switch (pestaña) {
        case 'asignados': return t.responsable === c && abierto;
        case 'creados': return t.solicitante === c;
        case 'apoyo': return conApoyo || (t.solicitante === c && (t.apoyo || []).length > 0);
        case 'cerrados': return (t.estado === 'Completado' || t.estado === 'Cancelado') && (t.solicitante === c || t.responsable === c || conApoyo);
        case 'vencidos': return TK.tickets.vencido(t) && (t.solicitante === c || t.responsable === c || conApoyo || TK.esSupervisor(u));
        case 'todos': return t.solicitante === c || t.responsable === c || conApoyo || TK.tickets.escaladoA(t, u);
        case 'area': return TK.esAdmin(u);
        default: return TK.tickets.puedeVer(t, u);
      }
    }).sort(function (a, b) { return (b.creado || '').localeCompare(a.creado || ''); });
  };

  // Datos de una imagen para el servidor (el archivo se sube aparte).
  function datosFoto(f) {
    return { fotoId: f.id, hash: f.hash, etapa: f.etapa, bytes: f.bytes, ancho: f.ancho, alto: f.alto, tomada: f.tomada, thumb: f.thumb };
  }
  function rechazar(msg) { return Promise.reject(new Error(msg)); }
  function nombre(c) { return TK.nombreDe(c); }

  // Escenario A (ejecuto): el solicitante es el responsable y define su fecha compromiso.
  // Escenario B (solicito): otra persona es responsable y es quien planea (inicio, compromiso, finalización).
  TK.tickets.crear = function (f) {
    var u = TK.sesion.actual();
    var cat = TK.CATALOGO.find(function (c) { return c.id === f.categoriaId; });
    if (!cat || !f.actividad) return rechazar('Elige una categoría y una actividad');
    var tipo = f.tipoSolicitud;
    if (tipo !== 'ejecuto' && tipo !== 'solicito') return rechazar('Indica si ejecutarás la actividad o si pides que otra persona la realice.');
    if (TK.IMPACTO_IDS.indexOf(f.impacto) < 0) return rechazar('Elige el impacto.');
    var desc = (f.descripcion || '').trim();
    if (tipo === 'solicito' && desc.length < 10) return rechazar('Describe el requerimiento completo para quien lo va a realizar.');
    var resp = tipo === 'ejecuto' ? u.correo : (f.responsable || TK.responsablePorDefecto(cat.id, f.actividad));
    if (!resp) return rechazar('No hay un responsable disponible. Elige uno.');
    if (tipo === 'ejecuto' && f.compromiso && f.compromiso < TK.hoy()) return rechazar('La fecha compromiso no puede ser anterior a hoy.');
    var id = TK.uuid();
    var ahora = TK.ahora();
    var t = {
      id: id, folio: null, folioProv: 'BORR-' + id.slice(0, 4).toUpperCase(),
      estado: 'Nuevo', impacto: f.impacto, tipoSolicitud: tipo,
      categoria: cat.nombre, categoriaId: cat.id, actividad: f.actividad,
      ubicacion: f.ubicacion, descripcion: desc,
      solicitante: u.correo, area: u.area,
      creado: ahora, fechaInicio: null, compromiso: tipo === 'ejecuto' ? (f.compromiso || null) : null, fechaFin: null,
      primeraAtencion: null, cierre: null, cerradoPor: null, comentarioCierre: '',
      responsable: resp, raci: TK.raciDe(f.actividad),
      apoyo: tipo === 'ejecuto' ? (f.apoyo || []).filter(function (c) { return c !== u.correo; }).map(function (c) { return { correo: c, estado: 'pendiente' }; }) : [],
      comentarios: [],
      historial: [{
        ts: ahora, usuario: u.correo,
        texto: 'Ticket creado' + (TK.net.online() ? '' : ' sin conexión') + (tipo === 'ejecuto' ? '. Ejecutará la actividad' : '. Solicita que ' + nombre(resp) + ' la realice')
      }],
      sync: 'pendiente', version: 1, origen: TK.net.online() ? 'en línea' : 'offline'
    };
    var inicial = (f.fotos || []).filter(function (p) { return p.etapa === 'Inicial'; }).slice(-1);
    inicial.forEach(function (p) { p.ticketId = id; });

    return TK.db.put('tickets', t).then(function () {
      return Promise.all(inicial.map(function (p) { return TK.db.put('photos', p); }));
    }).then(function () {
      // El orden importa: primero el ticket, luego su imagen.
      return TK.queue.add('crear_ticket', id, {
        categoriaId: t.categoriaId, categoria: t.categoria, actividad: t.actividad, ubicacion: t.ubicacion, descripcion: t.descripcion,
        impacto: t.impacto, tipoSolicitud: tipo, compromiso: t.compromiso, responsable: t.responsable,
        apoyo: t.apoyo.map(function (a) { return a.correo; }), creado: t.creado, origen: t.origen
      });
    }).then(function () {
      return inicial.reduce(function (p, foto) {
        return p.then(function () { return TK.queue.add('subir_foto', id, datosFoto(foto)); });
      }, Promise.resolve());
    }).then(function () { TK.emitir('cambio'); return t; });
  };

  // Un ticket guarda como máximo una imagen inicial y una final: una nueva reemplaza a la anterior.
  TK.tickets.agregarFoto = function (t, foto) {
    if (TK.ETAPAS.indexOf(foto.etapa) < 0) return rechazar('Solo se permite imagen inicial o final.');
    foto.ticketId = t.id;
    return Promise.all([TK.tickets.fotosDe(t.id), TK.queue.todas()]).then(function (r) {
      var viejas = r[0].filter(function (x) { return x.etapa === foto.etapa; });
      var ids = viejas.map(function (x) { return x.id; });
      var ops = r[1].filter(function (o) { return o.tipo === 'subir_foto' && ids.indexOf(o.data.fotoId) >= 0; });
      return Promise.all(viejas.map(function (x) { return TK.db.del('photos', x.id); }).concat(ops.map(function (o) { return TK.db.del('queue', o.opId); })))
        .then(function () { return viejas.length; });
    }).then(function (huboPrevia) {
      return TK.db.put('photos', foto).then(function () {
        t.historial.push({ ts: TK.ahora(), usuario: TK.sesion.correo, texto: 'Imagen ' + foto.etapa.toLowerCase() + (huboPrevia ? ' reemplazada' : ' agregada') });
        t.version += 1;
        return TK.db.put('tickets', t);
      });
    }).then(function () {
      return TK.queue.add('subir_foto', t.id, datosFoto(foto));
    }).then(function () { TK.emitir('cambio'); });
  };

  TK.tickets.puedePlanear = function (t, u) { return TK.tickets.abierto(t) && t.responsable === u.correo; };
  TK.tickets.puedeReasignar = function (t, u) { return TK.tickets.abierto(t) && (t.responsable === u.correo || TK.esAdmin(u)); };
  // Cerrar y reabrir: cualquier usuario con acceso al ticket. Sin jerarquías ni perfiles especiales.
  TK.tickets.puedeCerrar = function (t, u) { return TK.tickets.abierto(t) && TK.tickets.puedeVer(t, u); };
  TK.tickets.puedeReabrir = function (t, u) { return t.estado === 'Completado' && TK.tickets.puedeVer(t, u); };

  TK.tickets.acciones = function (t, u) {
    var flags = { responsable: t.responsable === u.correo, solicitante: t.solicitante === u.correo, supervisor: TK.esAdmin(u) };
    var out = [];
    (TK.TRANSICIONES[t.estado] || []).forEach(function (tr) {
      if (!tr.quien.some(function (q) { return flags[q]; })) return;
      var et = tr.a;
      if (t.estado === 'Pendiente de información' && tr.a === 'En proceso') et = 'Ya envié el dato';
      if (t.estado === 'Asignado' && tr.a === 'En proceso') et = 'Aceptar y empezar';
      out.push({ a: tr.a, pideMotivo: !!tr.pideMotivo, etiqueta: et, pidePlan: t.estado === 'Asignado' && tr.a === 'En proceso' && !t.compromiso });
    });
    if (TK.tickets.puedeCerrar(t, u)) out.push({ a: 'Completado', cerrar: true, etiqueta: 'Cerrar ticket' });
    if (TK.tickets.puedeReabrir(t, u)) out.push({ a: 'En proceso', pideMotivo: true, etiqueta: 'Reabrir' });
    if (TK.CANCELABLES.indexOf(t.estado) >= 0 && (t.solicitante === u.correo || TK.esAdmin(u))) {
      out.push({ a: 'Cancelado', pideMotivo: true, etiqueta: 'Cancelar ticket', peligro: true });
    }
    return out;
  };

  TK.tickets.cambiarEstado = function (t, nuevo, opc) {
    opc = opc || {};
    var u = TK.sesion.actual();
    var desde = t.estado;
    if (nuevo === 'Completado') return rechazar('Para cerrar usa "Cerrar ticket".');
    if (opc.motivoObligatorio && !opc.motivo) return rechazar('Escribe el motivo.');
    var ahora = TK.ahora();
    t.estado = nuevo;
    if (nuevo === 'En proceso' && !t.primeraAtencion) t.primeraAtencion = ahora;
    if (nuevo === 'Cancelado') { t.cierre = ahora; t.cerradoPor = u.correo; t.comentarioCierre = opc.motivo || ''; }
    if (desde === 'Completado' && nuevo === 'En proceso') { t.cierre = null; t.cerradoPor = null; t.comentarioCierre = ''; }
    t.historial.push({ ts: ahora, usuario: u.correo, texto: desde + ' → ' + nuevo + (opc.motivo ? '. Motivo: ' + opc.motivo : '') });
    t.version += 1;
    return TK.db.put('tickets', t).then(function () {
      return TK.queue.add('cambiar_estado', t.id, { desde: desde, nuevo: nuevo, motivo: opc.motivo || null });
    }).then(function () { TK.emitir('cambio'); return t; });
  };

  // Cierre: solo se registra quién cerró, cuándo y un comentario opcional (más la imagen final si aplica).
  TK.tickets.cerrar = function (t, opc) {
    opc = opc || {};
    var u = TK.sesion.actual();
    if (!TK.tickets.puedeCerrar(t, u)) return rechazar('Este ticket ya no se puede cerrar.');
    var desde = t.estado;
    return TK.tickets.fotosDe(t.id).then(function (fotos) {
      var tieneFinal = fotos.some(function (f) { return f.etapa === 'Final'; });
      if (TK.tickets.requiereFotoFinal(t) && !tieneFinal && !opc.foto) throw new Error('Agrega la imagen final para cerrar este ticket.');
      return opc.foto ? TK.tickets.agregarFoto(t, opc.foto) : null;
    }).then(function () {
      var ahora = TK.ahora();
      var com = (opc.comentario || '').trim();
      t.estado = 'Completado';
      t.cierre = ahora; t.cerradoPor = u.correo; t.comentarioCierre = com;
      if (!t.primeraAtencion) t.primeraAtencion = ahora;
      t.historial.push({ ts: ahora, usuario: u.correo, texto: 'Cerró el ticket' + (com ? '. Comentarios: ' + com : '') });
      t.version += 1;
      return TK.db.put('tickets', t);
    }).then(function () {
      return TK.queue.add('cambiar_estado', t.id, { desde: desde, nuevo: 'Completado', motivo: (opc.comentario || '').trim() || null });
    }).then(function () { TK.emitir('cambio'); return t; });
  };

  // Planeación: la hace el responsable (en el escenario A, el propio solicitante).
  TK.tickets.planear = function (t, d) {
    var u = TK.sesion.actual();
    if (!TK.tickets.puedePlanear(t, u)) return rechazar('Solo el responsable asignado puede definir las fechas.');
    if (!d.compromiso) return rechazar('Define la fecha compromiso.');
    if (d.fechaInicio && d.fechaInicio > d.compromiso) return rechazar('La fecha de inicio no puede ser posterior a la fecha compromiso.');
    if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) return rechazar('La fecha de finalización no puede ser anterior al inicio.');
    var cambioComp = t.compromiso && t.compromiso !== d.compromiso;
    if (cambioComp && !(d.motivo || '').trim()) return rechazar('Escribe el motivo del cambio de fecha compromiso.');
    var ahora = TK.ahora(), cambios = [];
    function nota(et, antes, ahoraV) { if ((antes || null) !== (ahoraV || null)) cambios.push(et + ': ' + (antes ? TK.fmtFecha(antes) : 'sin definir') + ' → ' + (ahoraV ? TK.fmtFecha(ahoraV) : 'sin definir')); }
    nota('Inicio', t.fechaInicio, d.fechaInicio); nota('Compromiso', t.compromiso, d.compromiso); nota('Finalización', t.fechaFin, d.fechaFin);
    if (!cambios.length) return Promise.resolve(t);
    var primera = !t.compromiso;
    t.fechaInicio = d.fechaInicio || null; t.compromiso = d.compromiso; t.fechaFin = d.fechaFin || null;
    t.historial.push({ ts: ahora, usuario: u.correo, texto: 'Planeación. ' + cambios.join('; ') + (cambioComp ? '. Motivo: ' + d.motivo.trim() : '') });
    t.version += 1;
    return TK.db.put('tickets', t).then(function () { return TK.tickets.reprogramarRecordatorios(t.id); }).then(function () {
      return TK.queue.add('planear', t.id, { fechaInicio: t.fechaInicio, compromiso: t.compromiso, fechaFin: t.fechaFin, motivo: (d.motivo || '').trim() || null });
    }).then(function () {
      if (t.solicitante === u.correo) return null;
      return TK.agregarAviso([t.solicitante], (primera ? 'Se definió la fecha compromiso' : 'Cambió la fecha compromiso') + ' de ' + (t.folio || t.folioProv) + ': ' + TK.fmtFecha(t.compromiso), t.id);
    }).then(function () { TK.emitir('cambio'); return t; });
  };

  TK.tickets.reasignar = function (t, nuevo, motivo) {
    var u = TK.sesion.actual();
    if (!TK.tickets.puedeReasignar(t, u)) return rechazar('No puedes reasignar este ticket.');
    if (!TK.usuario(nuevo)) return rechazar('Elige a quién se reasigna.');
    if (nuevo === t.responsable) return rechazar('Esa persona ya es la responsable.');
    var antes = t.responsable;
    t.responsable = nuevo;
    t.historial.push({ ts: TK.ahora(), usuario: u.correo, texto: 'Reasignado de ' + nombre(antes) + ' a ' + nombre(nuevo) + ((motivo || '').trim() ? '. Motivo: ' + motivo.trim() : '') });
    t.version += 1;
    return TK.db.put('tickets', t).then(function () { return TK.tickets.reprogramarRecordatorios(t.id); }).then(function () {
      return TK.queue.add('reasignar', t.id, { nuevo: nuevo, motivo: (motivo || '').trim() || null });
    }).then(function () {
      var dest = [nuevo].concat(t.solicitante !== u.correo && t.solicitante !== nuevo ? [t.solicitante] : []);
      return TK.agregarAviso(dest, 'Ticket ' + (t.folio || t.folioProv) + ' reasignado a ' + nombre(nuevo) + ': ' + t.actividad, t.id);
    }).then(function () { TK.emitir('cambio'); return t; });
  };

  TK.tickets.comentar = function (t, texto) {
    texto = (texto || '').trim();
    if (!texto) return Promise.resolve();
    var c = { id: TK.uuid(), autor: TK.sesion.correo, texto: texto, ts: TK.ahora() };
    t.comentarios.push(c);
    t.version += 1;
    return TK.db.put('tickets', t).then(function () {
      return TK.queue.add('agregar_comentario', t.id, { comentarioId: c.id, comentario: c });
    }).then(function () { TK.emitir('cambio'); });
  };

  TK.tickets.responderApoyo = function (t, aceptar) {
    var u = TK.sesion.actual();
    var a = (t.apoyo || []).find(function (x) { return x.correo === u.correo; });
    if (!a) return Promise.resolve();
    a.estado = aceptar ? 'aceptado' : 'rechazado';
    a.respondido = TK.ahora();
    t.apoyoIncompleto = t.apoyo.some(function (x) { return x.estado === 'rechazado'; });
    t.historial.push({ ts: TK.ahora(), usuario: u.correo, texto: (aceptar ? 'Aceptó' : 'Rechazó') + ' dar apoyo' });
    t.version += 1;
    return TK.db.put('tickets', t).then(function () {
      return TK.queue.add('responder_apoyo', t.id, { aceptar: aceptar });
    }).then(function () { TK.emitir('cambio'); });
  };

    TK.tickets.reprogramarRecordatorios = function (ticketId) {
    return TK.db.getMeta('rec', {}).then(function (rec) {
      Object.keys(rec).forEach(function (k) { if (k.indexOf(ticketId + ':') === 0) delete rec[k]; });
      return TK.db.setMeta('rec', rec);
    });
  };

  TK.tickets.generarRecordatorios = function () {
    return Promise.all([TK.tickets.todos(), TK.db.getMeta('rec', {})]).then(function (r) {
      var lista = r[0], rec = r[1], nuevos = [], cambio = false;
      var sup = TK.USUARIOS.filter(function (x) { return x.rol === 'Supervisor'; }).map(function (x) { return x.correo; });
      var coord = TK.USUARIOS.filter(function (x) { return x.rol === 'Coordinador'; }).map(function (x) { return x.correo; });
      lista.filter(TK.tickets.abierto).forEach(function (t) {
        var dias = TK.tickets.diasRestantes(t);
        var lim = TK.tickets.limite(t);
        var base = (t.folio || t.folioProv) + ' (' + t.actividad + ')';
        if (dias === null) {
          // Sin fecha compromiso: se recuerda al responsable que planee; a los 3 días se escala a coordinación.
          var edad = TK.diasEntre(TK.fechaLocal(t.creado), TK.hoy());
          var kp = t.id + ':plan1:'; var kc = t.id + ':plan3:';
          if (edad >= 1 && !rec[kp]) { rec[kp] = TK.ahora(); cambio = true; nuevos.push(TK.agregarAviso([t.responsable], 'Falta planear fechas: ' + base, t.id)); }
          if (edad >= 3 && !rec[kc]) { rec[kc] = TK.ahora(); cambio = true; nuevos.push(TK.agregarAviso(coord, 'Sin planeación (3 días): ' + base, t.id)); }
          return;
        }
        var para = [t.responsable].concat((t.apoyo || []).filter(function (a) { return a.estado === 'aceptado'; }).map(function (a) { return a.correo; })).filter(Boolean);
        function marcar(tipo, dest, texto) {
          var k = t.id + ':' + tipo + ':' + lim; 
          if (rec[k]) return;
          rec[k] = TK.ahora(); cambio = true;
          nuevos.push(TK.agregarAviso(dest, texto, t.id));
        }
        
        if (dias >= 0) {
          var umbral = null;
          TK.RECORDATORIOS.slice().sort(function (a, b) { return a - b; }).forEach(function (u) { if (umbral === null && dias <= u) umbral = u; });
          if (umbral !== null) {
            TK.RECORDATORIOS.forEach(function (u) { if (u > umbral) rec[t.id + ':r' + u + ':' + lim] = rec[t.id + ':r' + u + ':' + lim] || 'omitido'; });
            marcar('r' + umbral, para, 'Faltan ' + dias + ' día(s) para vencer: ' + base);
          }
        } else {
          marcar('vencido', para.concat([t.solicitante]), 'VENCIDO: ' + base);
          if (dias <= -1) marcar('esc24', sup, 'Escalamiento (1 día vencido): ' + base);
          if (dias <= -3) marcar('esc72', coord, 'Escalamiento (3 días vencido): ' + base);
        }
      });
      return Promise.all(nuevos).then(function () { return cambio ? TK.db.setMeta('rec', rec) : null; }).then(function () {
        if (nuevos.length) TK.emitir('cambio');
      });
    });
  };

  // Migra datos guardados con el modelo anterior (prioridad, fecha requerida, fotos por etapa, extensiones, aprobación).
  TK.migrar = function () {
    return TK.db.getMeta('schema', 1).then(function (v) {
      if (v >= 2) return null;
      var MAPA = { Baja: 'Bajo', Media: 'Medio', Alta: 'Alto', 'Crítica': 'Crítico' };
      return Promise.all([TK.db.all('tickets'), TK.db.all('photos'), TK.db.all('queue')]).then(function (r) {
        var ops = [];
        r[0].forEach(function (t) {
          t.impacto = t.impacto || MAPA[t.prioridad] || 'Medio'; delete t.prioridad;
          if (!t.compromiso && t.requerida) t.compromiso = t.requerida;
          delete t.requerida; delete t.extensiones; delete t.extensionesAprobadas; delete t.conExtension; delete t.aprueba;
          t.tipoSolicitud = t.tipoSolicitud || (t.solicitante === t.responsable ? 'ejecuto' : 'solicito');
          t.fechaInicio = t.fechaInicio || null; t.fechaFin = t.fechaFin || null;
          if (t.estado === 'Pendiente de aprobación') t.estado = 'En proceso';
          if (t.estado === 'Completado' && !t.cerradoPor) {
            var h = (t.historial || []).slice().reverse().find(function (x) { return /Completado/.test(x.texto || ''); });
            t.cerradoPor = h ? h.usuario : t.responsable; t.comentarioCierre = t.comentarioCierre || '';
          }
          ops.push(TK.db.put('tickets', t));
        });
        var vistas = {};
        r[1].slice().sort(function (a, b) { return (b.tomada || '').localeCompare(a.tomada || ''); }).forEach(function (f) {
          var etapa = f.etapa === 'Antes' ? 'Inicial' : f.etapa === 'Después' ? 'Final' : f.etapa;
          var k = f.ticketId + ':' + etapa;
          if (etapa !== 'Inicial' && etapa !== 'Final' || vistas[k]) { ops.push(TK.db.del('photos', f.id)); return; }
          vistas[k] = 1; f.etapa = etapa; ops.push(TK.db.put('photos', f));
        });
        var borradas = r[1].filter(function (f) { return !/^(Antes|Después|Inicial|Final)$/.test(f.etapa); }).map(function (f) { return f.id; });
        r[2].forEach(function (o) {
          if (o.tipo === 'solicitar_extension' || o.tipo === 'resolver_extension' || (o.tipo === 'subir_foto' && borradas.indexOf(o.data.fotoId) >= 0)) ops.push(TK.db.del('queue', o.opId));
          else if (o.tipo === 'subir_foto') { o.data.etapa = o.data.etapa === 'Antes' ? 'Inicial' : o.data.etapa === 'Después' ? 'Final' : o.data.etapa; ops.push(TK.db.put('queue', o)); }
        });
        return Promise.all(ops);
      }).then(function () { return TK.db.setMeta('schema', 2); });
    });
  };
})(window.TK);
