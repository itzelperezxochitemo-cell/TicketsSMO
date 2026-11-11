window.TK = window.TK || {};

(function (TK) {
  'use strict';

  TK.CATALOGO = [
    { id: 'acordonamiento', nombre: 'Acordonamiento', icono: '🚧', equipo: 'Seguridad', actividades: [
      'Acordonamiento con cadena de las cortinas',
      'Acordonamiento de ubicaciones de áreas staff',
      'Acordonamiento con cadena de ubicaciones canceladas en racks por daño',
      'Acordonamiento con cadena de incidentes de MHE',
      'Acordonamiento con cadena de pasillos peatonales',
      'Colocación de cinta en piso para delimitar o por seguridad',
      'Movimiento de trafitambos para delimitar áreas'] },
    { id: 'puertas', nombre: 'Puertas', icono: '🚪', equipo: 'Mantenimiento', actividades: [
      'Reparación de bisagras de puertas',
      'Reparación de pintura de puertas',
      'Reparación o cambio de chapas de puertas',
      'Ajuste de zargentos de puertas'] },
    { id: 'mobiliario', nombre: 'Mobiliario', icono: '🪑', equipo: 'Facilities', actividades: [
      'Anclaje de estantes y/o mobiliario',
      'Reparación de cajones de mobiliario',
      'Reparación de manijas de mobiliario',
      'Apoyo de movimiento de mobiliario',
      'Reparación de sillas',
      'Retiro de mobiliario obsoleto',
      "Colocación de U's para candados"] },
    { id: 'guardas', nombre: 'Guardas', icono: '🛡️', equipo: 'Mantenimiento', actividades: [
      'Anclaje de guardas de contención de golpes'] },
    { id: 'residuos', nombre: 'Residuos no peligrosos', icono: '♻️', equipo: 'Facilities', actividades: [
      'Apoyo al retiro de residuos no peligrosos (Movil Container)'] },
    { id: 'obsoletos', nombre: 'Obsoletos', icono: '📦', equipo: 'Facilities', actividades: [
      'Retiro de nose jacks',
      'Retiro de racks',
      'Retiro de conveyors',
      'Retiro de objetos obsoletos'] },
    { id: 'agua', nombre: 'Agua', icono: '💧', equipo: 'Mantenimiento', actividades: [
      'Apoyo a la recepción de pipa de agua para tanque elevado y cisterna',
      'Apoyo a la imagen de llenado de la cisterna',
      'Apoyo a la imagen del medidor de agua',
      'Reemplazo de mangueras, cespol y llaves angulares de sanitarios y lavabos',
      'Reparación de fugas menores en sanitarios y comedor',
      'Cambio de mezcladoras de agua (comedor y estacionamiento)'] },
    { id: 'electrico', nombre: 'Eléctrico', icono: '⚡', equipo: 'Mantenimiento', actividades: [
      'Desconexión de tableros eléctricos',
      'Cambio de contactos',
      'Cambio de focos de lámparas de cortinas y áreas de oficinas',
      'Reparación de lámparas en cortinas',
      'Revisión de funcionamiento de tableros de rampas de cortinas',
      'Colocación de tapas ciegas',
      'Apoyo a la colocación de reflectores dentro y fuera del almacén',
      'Reportar apagones de luz CFE',
      'Reparación de semáforos (inferiores y superiores)',
      'Apoyo para checar el diésel de la planta de emergencia'] },
    { id: 'cortinas', nombre: 'Cortinas', icono: '🏭', equipo: 'Mantenimiento', actividades: [
      'Cambio de pasador de cortinas',
      'Cambio de paneles dañados por DHL',
      'Ajuste de límites de apertura y cierre de cortinas vehiculares',
      'Ajuste de resortes de cortinas',
      'Ajuste de actuadores de micro',
      'Cambio de calzas y cadenas',
      'Colocación de piola en cortinas',
      'Revisión para cancelación y liberación de cortinas',
      'Lubricación de bisagras de ceja de rampa',
      'Ajuste de panel de control de rampas',
      'Ajuste de guías laterales',
      'Sujeción de piernas y faldones',
      'Ajuste de botoneras de semáforo',
      'Colocación de pernos de rampa'] },
    { id: 'mecanico', nombre: 'Mecánico', icono: '🔧', equipo: 'Mantenimiento', actividades: [
      'Cambio de ruedas de nose jacks, góndolas y diablitos',
      'Reparación de manubrios y manivelas de nose jacks',
      'Reemplazo de ruedas de diablitos',
      'Reparación de carro para basura',
      'Reparación de flejadora manual',
      'Habilitación de patines dañados'] },
    { id: 'sanitarios', nombre: 'Sanitarios', icono: '🚻', equipo: 'Facilities', actividades: [
      'Apoyo a la colocación de jaboneras',
      'Apoyo a la colocación de despachadores de toalla',
      'Apoyo a la colocación de pilas de despachadores de toalla',
      'Apoyo a la colocación de pilas de fluxómetros',
      'Colocación de mamparas por daño en sanitarios',
      'Colocación de puertas por daño en sanitarios',
      'Destapar mingitorios, tazas y lavabos de baño',
      'Despintado de puertas y despachadores marcados con marcador permanente'] },
    { id: 'cajas-secas', nombre: 'Reparación de cajas secas', icono: '🚛', equipo: 'Mantenimiento', actividades: [
      'Reparación de agujeros en piso con placa de 40 x 30 cm',
      'Reparación de claros de luz',
      'Reparación de láminas zafadas',
      'Reparación de goteras'] },
    { id: 'corte', nombre: 'Corte', icono: '✂️', equipo: 'Mantenimiento', actividades: [
      'Corte de esquineros para clientes especiales (customizado)',
      'Corte de placas para reparación de cajas secas',
      'Corte de tubería de estructura (customizado)'] },
    { id: 'staff', nombre: 'Staff', icono: '🏢', equipo: 'Facilities', actividades: [
      'Apoyo a la colocación de adornos en días festivos',
      'Apoyo para mover archivo muerto de oficinas',
      'Apoyo con extensiones, ajustes e instalación de lonas',
      'Apoyo con subir garrafones a planta alta',
      'Colocación de letreros y lonas de DHL',
      'Colocación de cajas de acrílico de DHL y P&G'] },
    { id: 'limpieza', nombre: 'Limpieza', icono: '🧹', equipo: 'Facilities', actividades: [
      'Vaciado de agua de diques',
      'Limpieza de plataforma',
      'Orden y limpieza de lockers de herramienta',
      'Reemplazo de agua sucia por limpia en el lavamanos de customizado'] },
    { id: 'inspeccion', nombre: 'Inspección', icono: '🔍', equipo: 'Seguridad', tipo: 'inspección', actividades: [
      'Carritos de basura', 'Patín hidráulico', 'Nose jacks', 'Lockers', 'Cizallas de corte',
      'Compresor', 'Escalera de tijera', 'Escalera marina', 'Multímetro', 'Estación lavaojos',
      'Cortadora eléctrica', 'Gato mecánico de cremallera', 'Anaquel', 'Cámara termográfica',
      'Escalerilla', 'Carros tiendita', 'Soportes de montacargas', 'Arnés', 'Cuerdas de vida',
      'Diques de contención', 'Careta', 'Diablito', 'Taladro', 'Tableros eléctricos',
      'Esmeril de mano', 'Tazas', 'Mingitorios', 'Lavamanos', 'Regaderas',
      'Portón acceso trailer oriente', 'Portón de acceso vehicular', 'Portón acceso trailer poniente',
      'Cortinas (APP P&G)', 'Racks nave 1 (APP P&G)', 'Racks nave 2 (APP P&G)', 'Racks nave 3 (APP P&G)'] },
    { id: 'customizado', nombre: 'Customizado', icono: '🎞️', equipo: 'Mantenimiento', actividades: [
      'Alineación de banda retractiladora',
      'Cambio de botoneras de banda',
      'Ajuste básico de encintadora',
      'Cambio de película termoencogible de retractiladora'] },
    { id: 'colapsos', nombre: 'Colapsos', icono: '⚠️', equipo: 'Seguridad', impactoSugerido: 'Alto', actividades: [
      'Colapsos en racks niveles B a F',
      'Revisión de charolas push back'] }
  ];

  // Actividades que sugieren impacto Alto por seguridad.
  TK.SUGIERE_ALTO = [
    'Acordonamiento con cadena de incidentes de MHE',
    'Colapsos en racks niveles B a F',
    'Revisión para cancelación y liberación de cortinas'
  ];

  // Impacto: afectación que genera el requerimiento o la incidencia.
  TK.IMPACTOS = [
    { id: 'Bajo', desc: 'No afecta la operación' },
    { id: 'Medio', desc: 'Afecta en parte; hay alternativa' },
    { id: 'Alto', desc: 'Afecta la operación o el servicio' },
    { id: 'Crítico', desc: 'Detiene la operación o hay riesgo para personas o mercancía' }
  ];
  TK.IMPACTO_IDS = TK.IMPACTOS.map(function (i) { return i.id; });

  // Tipo de solicitud: define quién ejecuta y quién planea.
  TK.TIPOS_SOLICITUD = [
    { id: 'ejecuto', nombre: 'Ejecutaré la actividad', desc: 'Tú la realizas y defines tu fecha compromiso.' },
    { id: 'solicito', nombre: 'Solicito que alguien realice la actividad', desc: 'El responsable asignado analiza el trabajo y define las fechas.' }
  ];

  TK.ESTADOS = ['Nuevo', 'Asignado', 'En proceso', 'Pendiente de información', 'Completado', 'Cancelado', 'Vencido'];
  TK.ABIERTOS = ['Nuevo', 'Asignado', 'En proceso', 'Pendiente de información'];
  // Evidencia: una imagen al inicio y una al final. Nada intermedio.
  TK.ETAPAS = ['Inicial', 'Final'];

  // Cambios de estado con reglas. Cerrar (Completado), reabrir y cancelar se manejan aparte:
  // cerrar y reabrir los puede hacer cualquier usuario con acceso al ticket.
  TK.TRANSICIONES = {
    'Nuevo': [{ a: 'Asignado', quien: ['supervisor'] }],
    'Asignado': [{ a: 'En proceso', quien: ['responsable'] }],
    'En proceso': [{ a: 'Pendiente de información', quien: ['responsable'], pideMotivo: true }],
    'Pendiente de información': [{ a: 'En proceso', quien: ['solicitante', 'responsable'] }]
  };
  TK.CANCELABLES = TK.ABIERTOS;

  TK.RECORDATORIOS = [7, 3, 1];

  // Producción: sin cuentas ni datos de demostración a la vista.
  TK.PRODUCCION = true;
  // Contraseña temporal compartida (se mantiene mientras se conecta el inicio de sesión corporativo).
  TK.CLAVE_DEMO = 'demo123';
  TK.DOMINIO = '@dhl.com';
  function usr(usuario, nombre, area, rol) { return { usuario: usuario, correo: usuario + TK.DOMINIO, nombre: nombre, area: area, rol: rol }; }
  // Usuarios: los de la matriz RACI (personas y equipos) más la coordinación y la administración.
  TK.USUARIOS = [
    usr('leonardo.leal', 'Leonardo Leal', 'DHL', 'Administrador'),
    usr('itzel.perez', 'Itzel Pérez', 'DHL', 'Administrador'),
    usr('berlin.ortiz', 'Berlin Ortiz', 'Operaciones DHL', 'Coordinador'),
    usr('manuel.castro', 'Manuel Castro', 'DHL', 'Supervisor'),
    usr('mtto.dhl', 'MTTO DHL', 'Mantenimiento DHL', 'Equipo'),
    usr('ingenieria.pg', 'Ingeniería P&G', 'Ingeniería P&G', 'Equipo'),
    usr('hse.dhl', 'HS&E DHL', 'HS&E DHL', 'Equipo'),
    usr('calidad.dhl', 'Calidad DHL', 'Calidad DHL', 'Equipo'),
    usr('ulises.delgado', 'Ulises Delgado', 'RACI', 'Colaborador'),
    usr('victor.duran', 'Víctor Durán', 'RACI', 'Colaborador'),
    usr('diego.bonilla', 'Diego Bonilla', 'RACI', 'Colaborador'),
    usr('karen.villanueva', 'Karen Villanueva', 'RACI', 'Colaborador'),
    usr('miguel.mendoza', 'Miguel Mendoza', 'RACI', 'Colaborador'),
    usr('tavo.alarcon', 'Tavo Alarcón', 'RACI', 'Colaborador'),
    usr('jessica.dennise', 'Jessica Dennise', 'HSE P&G', 'Colaborador')
  ];

  TK.NAVES = ['Nave 1', 'Nave 2', 'Nave 3'];
  TK.TIPOS_UBICACION = [
    { id: 'rack', nombre: 'Rack' },
    { id: 'pasillo', nombre: 'Pasillo' },
    { id: 'cortina', nombre: 'Cortina' },
    { id: 'staff', nombre: 'Área staff' },
    { id: 'libre', nombre: 'Área libre' },
    { id: 'otra', nombre: 'Otra ubicación' }
  ];

  TK.usuario = function (correo) {
    return TK.USUARIOS.find(function (u) { return u.correo === correo; }) || null;
  };
  TK.nombreDe = function (correo) {
    var u = TK.usuario(correo);
    return u ? u.nombre : (correo || '—');
  };
  TK.categoriaDe = function (actividad) {
    return TK.CATALOGO.find(function (c) { return c.actividades.indexOf(actividad) >= 0; }) || null;
  };
  // Solo los administradores ven el total de tickets y su detalle; el resto, solo lo que le corresponde.
  TK.esAdmin = function (u) { return !!u && u.rol === 'Administrador'; };
  TK.esSupervisor = TK.esAdmin; // nombre histórico: "puede ver y gestionar todo"


  TK.resumenUbicacion = function (u) {
    if (!u) return '—';
    var p = [];
    if (u.nave) p.push(u.nave);
    if (u.tipo === 'rack') { if (u.pasillo) p.push('Pasillo ' + u.pasillo); if (u.rack) p.push('Rack ' + u.rack); }
    else if (u.tipo === 'pasillo') { if (u.pasillo) p.push('Pasillo ' + u.pasillo); }
    else if (u.tipo === 'cortina') { if (u.cortina) p.push('Cortina ' + u.cortina); }
    else if (u.tipo === 'staff') p.push('Área staff' + (u.texto ? ': ' + u.texto : ''));
    else if (u.tipo === 'libre') p.push('Área libre' + (u.texto ? ': ' + u.texto : ''));
    else if (u.tipo === 'otra') p.push(u.texto || 'Otra ubicación');
    else if (u.tipo === 'abierta') p.push(u.texto || '—');
    return p.join(' · ') || '—';
  };

  TK.totalActividades = function () {
    return TK.CATALOGO.reduce(function (n, c) { return n + c.actividades.length; }, 0);
  };
})(window.TK);
