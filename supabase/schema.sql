-- =====================================================================
-- Portal de solicitudes operativas · esquema para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase > SQL Editor. Es idempotente (se puede repetir).
-- Orden: 1) schema.sql  2) seed_raci.sql  3) seed_usuarios.sql
--
-- Principios
--  * La app NO escribe en las tablas: todo cambio entra por public.aplicar_op(), que valida
--    permisos y reglas de negocio en el servidor y es idempotente por opId (reintentos seguros).
--  * La lectura pasa por RLS: un usuario solo ve lo que le corresponde (public.puede_ver).
--  * Las evidencias (solo imagen inicial y final) viven en Storage, bucket privado "evidencias".
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Perfiles (usuarios del portal) ----------
create table if not exists public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  correo  text unique not null,
  nombre  text not null,
  area    text not null default '',
  rol     text not null check (rol in ('Administrador', 'Coordinador', 'Supervisor', 'Equipo', 'Colaborador')),
  activo  boolean not null default true
);

-- ---------- Matriz RACI por actividad ----------
create table if not exists public.raci (
  actividad text not null,
  correo    text not null,
  codigo    text not null check (codigo ~ '^(R|A|C|I)(/(R|A|C|I))?$'),
  primary key (actividad, correo)
);

-- ---------- Tickets ----------
create sequence if not exists public.folio_seq;

create table if not exists public.tickets (
  id               uuid primary key,
  folio            text unique not null,
  estado           text not null check (estado in ('Nuevo', 'Asignado', 'En proceso', 'Pendiente de información', 'Completado', 'Cancelado')),
  impacto          text not null check (impacto in ('Bajo', 'Medio', 'Alto', 'Crítico')),
  tipo_solicitud   text not null check (tipo_solicitud in ('ejecuto', 'solicito')),
  categoria_id     text not null,
  categoria        text not null,
  actividad        text not null,
  ubicacion        jsonb not null default '{}',
  descripcion      text not null default '',
  solicitante      text not null references public.perfiles (correo),
  area             text not null default '',
  responsable      text not null references public.perfiles (correo),
  creado           timestamptz not null default now(),
  fecha_inicio     date,
  compromiso       date,
  fecha_fin        date,
  primera_atencion timestamptz,
  cierre           timestamptz,
  cerrado_por      text references public.perfiles (correo),
  comentario_cierre text not null default '',
  apoyo            jsonb not null default '[]',
  apoyo_incompleto boolean not null default false,
  raci             jsonb not null default '{}',
  comentarios      jsonb not null default '[]',
  historial        jsonb not null default '[]',
  origen           text not null default 'en línea',
  version          int not null default 1,
  updated_at       timestamptz not null default now()
);
create index if not exists tickets_updated_idx on public.tickets (updated_at);
create index if not exists tickets_resp_idx on public.tickets (responsable);
create index if not exists tickets_solic_idx on public.tickets (solicitante);

-- ---------- Evidencias: una imagen inicial y una final por ticket ----------
create table if not exists public.fotos (
  id        uuid primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  etapa     text not null check (etapa in ('Inicial', 'Final')),
  ruta      text not null,           -- ruta dentro del bucket "evidencias"
  hash      text,
  bytes     int,
  ancho     int,
  alto      int,
  thumb     text,                    -- miniatura (data URL) para listas sin descargar la imagen
  tomada    timestamptz not null default now(),
  por       text not null,
  unique (ticket_id, etapa)
);

-- ---------- Operaciones ya aplicadas (idempotencia) ----------
create table if not exists public.ops (
  op_id     uuid primary key,
  ticket_id uuid,
  usuario   text not null,
  tipo      text not null,
  resultado jsonb not null,
  creado    timestamptz not null default now()
);

-- ---------- Funciones auxiliares ----------
create or replace function public.hoy_mx() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- Visibilidad. Administrador: todo. El resto: lo propio (solicita, responde, apoyo), lo que la RACI de la
-- actividad le marca como R, A o C (el rol I solo se informa) y lo que se le escala por vencimiento
-- (Supervisor: 1 día o más vencido; Coordinador: 3 días o más).
create or replace function public.puede_ver(t public.tickets) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p public.perfiles;
begin
  select * into p from public.perfiles where user_id = auth.uid() and activo;
  if not found then return false; end if;
  if p.rol = 'Administrador' then return true; end if;
  if t.solicitante = p.correo or t.responsable = p.correo then return true; end if;
  if exists (select 1 from jsonb_array_elements(t.apoyo) a where a ->> 'correo' = p.correo) then return true; end if;
  if coalesce(t.raci ->> p.correo, '') ~ '[RAC]' then return true; end if;
  if t.estado in ('Nuevo', 'Asignado', 'En proceso', 'Pendiente de información') and t.compromiso is not null then
    if p.rol = 'Supervisor' and t.compromiso <= public.hoy_mx() - 1 then return true; end if;
    if p.rol = 'Coordinador' and t.compromiso <= public.hoy_mx() - 3 then return true; end if;
  end if;
  return false;
end $$;

-- Documento de ticket con el mismo formato que usa la app (camelCase).
create or replace function public.ticket_json(t public.tickets) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', t.id, 'folio', t.folio, 'estado', t.estado, 'impacto', t.impacto, 'tipoSolicitud', t.tipo_solicitud,
    'categoriaId', t.categoria_id, 'categoria', t.categoria, 'actividad', t.actividad, 'ubicacion', t.ubicacion,
    'descripcion', t.descripcion, 'solicitante', t.solicitante, 'area', t.area, 'responsable', t.responsable,
    'creado', t.creado, 'fechaInicio', t.fecha_inicio, 'compromiso', t.compromiso, 'fechaFin', t.fecha_fin,
    'primeraAtencion', t.primera_atencion, 'cierre', t.cierre, 'cerradoPor', t.cerrado_por,
    'comentarioCierre', t.comentario_cierre, 'apoyo', t.apoyo, 'apoyoIncompleto', t.apoyo_incompleto,
    'raci', t.raci, 'comentarios', t.comentarios, 'historial', t.historial, 'origen', t.origen,
    'version', t.version, 'updatedAt', t.updated_at)
$$;

-- Lectura para la app (incluye metadatos de las dos imágenes). Respeta RLS: solo devuelve lo visible.
create or replace function public.leer_tickets(p_desde timestamptz default null) returns jsonb
language sql stable security invoker as $$
  select coalesce(jsonb_agg(public.ticket_json(t) || jsonb_build_object('fotos', coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'etapa', f.etapa, 'ruta', f.ruta, 'hash', f.hash, 'bytes', f.bytes,
      'ancho', f.ancho, 'alto', f.alto, 'thumb', f.thumb, 'tomada', f.tomada, 'por', f.por))
    from public.fotos f where f.ticket_id = t.id), '[]'::jsonb)) order by t.updated_at), '[]'::jsonb)
  from public.tickets t
  where p_desde is null or t.updated_at > p_desde
$$;

-- ---------- Operaciones de la app ----------
-- p_op = {opId, tipo, ticketId, data}. Errores con prefijo para que el cliente sepa qué hacer:
--   'forbidden:' / 'validacion:'  -> no se reintenta tal cual   |   'dependencia:' -> reintentar después
create or replace function public.aplicar_op(p_op jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_op    uuid := (p_op ->> 'opId')::uuid;
  v_tipo  text := p_op ->> 'tipo';
  v_tid   uuid := (p_op ->> 'ticketId')::uuid;
  d       jsonb := coalesce(p_op -> 'data', '{}'::jsonb);
  v_now   timestamptz := now();
  abiertos constant text[] := array['Nuevo', 'Asignado', 'En proceso', 'Pendiente de información'];
  -- Categorías donde no hay un resultado que fotografiar: la imagen final no es obligatoria para cerrar.
  sin_final constant text[] := array['inspeccion', 'acordonamiento', 'staff', 'limpieza', 'residuos'];
  p public.perfiles; t public.tickets; prev jsonb; res jsonb := '{"ok":true}'::jsonb;
  v_resp text; v_comp date; v_ini date; v_fin date; v_nuevo text; v_desde text; v_motivo text;
  v_apoyo jsonb; v_c text; v_cambios text[] := '{}'; v_prim boolean; v_etapa text; v_existe boolean;
  v_com jsonb; v_i int;
  function_hist text;
begin
  select * into p from public.perfiles where user_id = auth.uid() and activo;
  if not found then raise exception 'forbidden: usuario sin perfil activo'; end if;

  select resultado into prev from public.ops where op_id = v_op;
  if found then return prev || '{"repetida":true}'::jsonb; end if;

  if v_tipo = 'crear_ticket' then
    select * into t from public.tickets where id = v_tid;
    if found then
      res := jsonb_build_object('folio', t.folio, 'estado', t.estado, 'responsable', t.responsable);
    else
      if d ->> 'tipoSolicitud' not in ('ejecuto', 'solicito') then raise exception 'validacion: indica el tipo de solicitud'; end if;
      if d ->> 'impacto' not in ('Bajo', 'Medio', 'Alto', 'Crítico') then raise exception 'validacion: impacto no válido'; end if;
      if coalesce(d ->> 'actividad', '') = '' or coalesce(d ->> 'categoriaId', '') = '' then raise exception 'validacion: falta la actividad'; end if;
      if d ->> 'tipoSolicitud' = 'solicito' and length(trim(coalesce(d ->> 'descripcion', ''))) < 10 then
        raise exception 'validacion: describe el requerimiento completo';
      end if;
      v_resp := case when d ->> 'tipoSolicitud' = 'ejecuto' then p.correo else d ->> 'responsable' end;
      if not exists (select 1 from public.perfiles where correo = v_resp and activo) then raise exception 'validacion: responsable no válido'; end if;
      v_comp := case when d ->> 'tipoSolicitud' = 'ejecuto' then nullif(d ->> 'compromiso', '')::date end;
      v_apoyo := '[]'::jsonb;
      if d ->> 'tipoSolicitud' = 'ejecuto' then
        select coalesce(jsonb_agg(jsonb_build_object('correo', x.correo, 'estado', 'pendiente')), '[]'::jsonb) into v_apoyo
        from (select distinct pf.correo from jsonb_array_elements_text(coalesce(d -> 'apoyo', '[]'::jsonb)) a
              join public.perfiles pf on pf.correo = a and pf.activo and pf.correo <> p.correo) x;
      end if;
      insert into public.tickets (id, folio, estado, impacto, tipo_solicitud, categoria_id, categoria, actividad, ubicacion, descripcion,
        solicitante, area, responsable, creado, compromiso, apoyo, raci, origen, historial)
      values (v_tid, 'TK-' || extract(year from v_now)::int || '-' || lpad(nextval('public.folio_seq')::text, 6, '0'), 'Asignado',
        d ->> 'impacto', d ->> 'tipoSolicitud', d ->> 'categoriaId', coalesce(d ->> 'categoria', d ->> 'categoriaId'), d ->> 'actividad',
        coalesce(d -> 'ubicacion', '{}'::jsonb), trim(coalesce(d ->> 'descripcion', '')), p.correo, p.area, v_resp,
        coalesce((d ->> 'creado')::timestamptz, v_now), v_comp, v_apoyo,
        coalesce((select jsonb_object_agg(r.correo, r.codigo) from public.raci r where r.actividad = d ->> 'actividad'), '{}'::jsonb),
        coalesce(d ->> 'origen', 'en línea'),
        jsonb_build_array(
          jsonb_build_object('ts', coalesce((d ->> 'creado')::timestamptz, v_now), 'usuario', p.correo, 'texto',
            'Ticket creado' || case when d ->> 'tipoSolicitud' = 'ejecuto' then '. Ejecutará la actividad' else '. Solicita que ' || (select nombre from public.perfiles where correo = v_resp) || ' la realice' end),
          jsonb_build_object('ts', v_now, 'usuario', 'Sistema', 'texto', 'Folio asignado. Responsable: ' || (select nombre from public.perfiles where correo = v_resp))))
      returning * into t;
      res := jsonb_build_object('folio', t.folio, 'estado', t.estado, 'responsable', t.responsable);
    end if;
    insert into public.ops (op_id, ticket_id, usuario, tipo, resultado) values (v_op, v_tid, p.correo, v_tipo, res);
    return res;
  end if;

  -- Resto de operaciones: sobre un ticket existente al que el usuario tiene acceso
  select * into t from public.tickets where id = v_tid for update;
  if not found then raise exception 'dependencia: el ticket aún no existe en el servidor'; end if;
  if not public.puede_ver(t) then raise exception 'forbidden: no tienes acceso a este ticket'; end if;
  v_prim := false;

  if v_tipo = 'cambiar_estado' then
    v_nuevo := d ->> 'nuevo'; v_desde := d ->> 'desde'; v_motivo := trim(coalesce(d ->> 'motivo', ''));
    if v_desde is not null and t.estado <> v_desde and v_nuevo <> 'Cancelado' then
      res := jsonb_build_object('rechazada', true, 'estadoServidor', t.estado, 'motivo', 'El ticket ya estaba en "' || t.estado || '"');
      insert into public.ops (op_id, ticket_id, usuario, tipo, resultado) values (v_op, v_tid, p.correo, v_tipo, res);
      return res;
    end if;
    if v_nuevo = 'Completado' then            -- cerrar: cualquier usuario con acceso, sin jerarquías
      if not t.estado = any (abiertos) then raise exception 'validacion: el ticket ya no está abierto'; end if;
      if not t.categoria_id = any (sin_final) and not exists (select 1 from public.fotos where ticket_id = t.id and etapa = 'Final') then
        raise exception 'validacion: falta la imagen final para cerrar';
      end if;
      t.estado := 'Completado'; t.cierre := v_now; t.cerrado_por := p.correo; t.comentario_cierre := v_motivo;
      t.primera_atencion := coalesce(t.primera_atencion, v_now);
      function_hist := 'Cerró el ticket' || case when v_motivo <> '' then '. Comentarios: ' || v_motivo else '' end;
    elsif v_nuevo = 'Cancelado' then
      if not t.estado = any (abiertos) then raise exception 'validacion: el ticket ya no está abierto'; end if;
      if p.correo <> t.solicitante and p.rol <> 'Administrador' then raise exception 'forbidden: solo el solicitante o un administrador cancelan'; end if;
      t.estado := 'Cancelado'; t.cierre := v_now; t.cerrado_por := p.correo; t.comentario_cierre := v_motivo;
      function_hist := v_desde || ' → Cancelado' || case when v_motivo <> '' then '. Motivo: ' || v_motivo else '' end;
    elsif v_nuevo = 'En proceso' and t.estado = 'Completado' then   -- reabrir
      t.estado := 'En proceso'; t.cierre := null; t.cerrado_por := null; t.comentario_cierre := '';
      function_hist := 'Completado → En proceso' || case when v_motivo <> '' then '. Motivo: ' || v_motivo else '' end;
    elsif v_nuevo = 'En proceso' and t.estado = 'Asignado' then
      if p.correo <> t.responsable then raise exception 'forbidden: solo el responsable inicia el ticket'; end if;
      if t.compromiso is null then raise exception 'validacion: define la fecha compromiso antes de empezar'; end if;
      t.estado := 'En proceso'; t.primera_atencion := coalesce(t.primera_atencion, v_now);
      function_hist := 'Asignado → En proceso';
    elsif v_nuevo = 'En proceso' and t.estado = 'Pendiente de información' then
      if p.correo not in (t.solicitante, t.responsable) then raise exception 'forbidden: solo solicitante o responsable'; end if;
      t.estado := 'En proceso'; function_hist := 'Pendiente de información → En proceso';
    elsif v_nuevo = 'Pendiente de información' and t.estado = 'En proceso' then
      if p.correo <> t.responsable then raise exception 'forbidden: solo el responsable'; end if;
      if v_motivo = '' then raise exception 'validacion: escribe el motivo'; end if;
      t.estado := 'Pendiente de información'; function_hist := 'En proceso → Pendiente de información. Motivo: ' || v_motivo;
    else
      raise exception 'validacion: cambio de estado no permitido (% → %)', t.estado, v_nuevo;
    end if;
    t.historial := t.historial || jsonb_build_array(jsonb_build_object('ts', v_now, 'usuario', p.correo, 'texto', function_hist));
    res := jsonb_build_object('ok', true, 'estado', t.estado);

  elsif v_tipo = 'planear' then
    if p.correo <> t.responsable or not t.estado = any (abiertos) then raise exception 'forbidden: solo el responsable asignado define las fechas'; end if;
    v_ini := nullif(d ->> 'fechaInicio', '')::date; v_comp := nullif(d ->> 'compromiso', '')::date; v_fin := nullif(d ->> 'fechaFin', '')::date;
    v_motivo := trim(coalesce(d ->> 'motivo', ''));
    if v_comp is null then raise exception 'validacion: define la fecha compromiso'; end if;
    if v_ini is not null and v_ini > v_comp then raise exception 'validacion: el inicio no puede ser posterior al compromiso'; end if;
    if v_ini is not null and v_fin is not null and v_fin < v_ini then raise exception 'validacion: la finalización no puede ser anterior al inicio'; end if;
    if t.compromiso is not null and t.compromiso <> v_comp and v_motivo = '' then raise exception 'validacion: escribe el motivo del cambio de fecha compromiso'; end if;
    if t.fecha_inicio is distinct from v_ini then v_cambios := v_cambios || ('Inicio: ' || coalesce(to_char(t.fecha_inicio, 'DD/MM/YYYY'), 'sin definir') || ' → ' || coalesce(to_char(v_ini, 'DD/MM/YYYY'), 'sin definir')); end if;
    if t.compromiso is distinct from v_comp then v_cambios := v_cambios || ('Compromiso: ' || coalesce(to_char(t.compromiso, 'DD/MM/YYYY'), 'sin definir') || ' → ' || to_char(v_comp, 'DD/MM/YYYY')); end if;
    if t.fecha_fin is distinct from v_fin then v_cambios := v_cambios || ('Finalización: ' || coalesce(to_char(t.fecha_fin, 'DD/MM/YYYY'), 'sin definir') || ' → ' || coalesce(to_char(v_fin, 'DD/MM/YYYY'), 'sin definir')); end if;
    if array_length(v_cambios, 1) is null then
      insert into public.ops (op_id, ticket_id, usuario, tipo, resultado) values (v_op, v_tid, p.correo, v_tipo, res);
      return res;
    end if;
    t.fecha_inicio := v_ini; t.compromiso := v_comp; t.fecha_fin := v_fin;
    t.historial := t.historial || jsonb_build_array(jsonb_build_object('ts', v_now, 'usuario', p.correo,
      'texto', 'Planeación. ' || array_to_string(v_cambios, '; ') || case when v_motivo <> '' then '. Motivo: ' || v_motivo else '' end));

  elsif v_tipo = 'reasignar' then
    if not t.estado = any (abiertos) then raise exception 'validacion: el ticket ya no está abierto'; end if;
    if p.correo <> t.responsable and p.rol <> 'Administrador' then raise exception 'forbidden: solo el responsable o un administrador reasignan'; end if;
    v_resp := d ->> 'nuevo';
    if v_resp = t.responsable or not exists (select 1 from public.perfiles where correo = v_resp and activo) then raise exception 'validacion: responsable no válido'; end if;
    v_motivo := trim(coalesce(d ->> 'motivo', ''));
    t.historial := t.historial || jsonb_build_array(jsonb_build_object('ts', v_now, 'usuario', p.correo, 'texto',
      'Reasignado de ' || (select nombre from public.perfiles where correo = t.responsable) || ' a ' || (select nombre from public.perfiles where correo = v_resp)
      || case when v_motivo <> '' then '. Motivo: ' || v_motivo else '' end));
    t.responsable := v_resp;

  elsif v_tipo = 'subir_foto' then
    v_etapa := d ->> 'etapa';
    if v_etapa not in ('Inicial', 'Final') then raise exception 'validacion: solo se permite imagen inicial o final'; end if;
    if not t.estado = any (abiertos) then raise exception 'validacion: el ticket ya no está abierto'; end if;
    if coalesce(d ->> 'ruta', '') = '' or split_part(d ->> 'ruta', '/', 1) <> t.id::text then raise exception 'validacion: ruta de imagen no válida'; end if;
    select true into v_existe from public.fotos where ticket_id = t.id and etapa = v_etapa;
    insert into public.fotos (id, ticket_id, etapa, ruta, hash, bytes, ancho, alto, thumb, tomada, por)
    values (coalesce((d ->> 'fotoId')::uuid, gen_random_uuid()), t.id, v_etapa, d ->> 'ruta', d ->> 'hash', (d ->> 'bytes')::int,
      (d ->> 'ancho')::int, (d ->> 'alto')::int, d ->> 'thumb', coalesce((d ->> 'tomada')::timestamptz, v_now), p.correo)
    on conflict (ticket_id, etapa) do update set id = excluded.id, ruta = excluded.ruta, hash = excluded.hash, bytes = excluded.bytes,
      ancho = excluded.ancho, alto = excluded.alto, thumb = excluded.thumb, tomada = excluded.tomada, por = excluded.por;
    t.historial := t.historial || jsonb_build_array(jsonb_build_object('ts', v_now, 'usuario', p.correo,
      'texto', 'Imagen ' || lower(v_etapa) || case when coalesce(v_existe, false) then ' reemplazada' else ' agregada' end));

  elsif v_tipo = 'agregar_comentario' then
    v_com := d -> 'comentario';
    if v_com is null or trim(coalesce(v_com ->> 'texto', '')) = '' or length(v_com ->> 'texto') > 2000 then raise exception 'validacion: comentario vacío o demasiado largo'; end if;
    if not exists (select 1 from jsonb_array_elements(t.comentarios) c where c ->> 'id' = v_com ->> 'id') then
      t.comentarios := t.comentarios || jsonb_build_array(jsonb_build_object('id', v_com ->> 'id', 'autor', p.correo,
        'texto', trim(v_com ->> 'texto'), 'ts', coalesce(v_com ->> 'ts', v_now::text)));
    end if;

  elsif v_tipo = 'responder_apoyo' then
    v_i := null;
    select ord - 1 into v_i from jsonb_array_elements(t.apoyo) with ordinality as a(x, ord) where x ->> 'correo' = p.correo;
    if v_i is null then raise exception 'validacion: no se te pidió apoyo en este ticket'; end if;
    t.apoyo := jsonb_set(t.apoyo, array[v_i::text], (t.apoyo -> v_i) || jsonb_build_object(
      'estado', case when (d ->> 'aceptar')::boolean then 'aceptado' else 'rechazado' end, 'respondido', v_now));
    t.apoyo_incompleto := exists (select 1 from jsonb_array_elements(t.apoyo) a where a ->> 'estado' = 'rechazado');
    t.historial := t.historial || jsonb_build_array(jsonb_build_object('ts', v_now, 'usuario', p.correo,
      'texto', case when (d ->> 'aceptar')::boolean then 'Aceptó' else 'Rechazó' end || ' dar apoyo'));
  else
    raise exception 'validacion: operación desconocida %', v_tipo;
  end if;

  update public.tickets set estado = t.estado, responsable = t.responsable, fecha_inicio = t.fecha_inicio, compromiso = t.compromiso,
    fecha_fin = t.fecha_fin, primera_atencion = t.primera_atencion, cierre = t.cierre, cerrado_por = t.cerrado_por,
    comentario_cierre = t.comentario_cierre, apoyo = t.apoyo, apoyo_incompleto = t.apoyo_incompleto, comentarios = t.comentarios,
    historial = t.historial, version = t.version + 1, updated_at = v_now
  where id = t.id;
  insert into public.ops (op_id, ticket_id, usuario, tipo, resultado) values (v_op, v_tid, p.correo, v_tipo, res);
  return res;
end $$;

-- ---------- Seguridad (RLS) ----------
alter table public.perfiles enable row level security;
alter table public.raci     enable row level security;
alter table public.tickets  enable row level security;
alter table public.fotos    enable row level security;
alter table public.ops      enable row level security;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated using (true);
drop policy if exists raci_leer on public.raci;
create policy raci_leer on public.raci for select to authenticated using (true);
drop policy if exists tickets_leer on public.tickets;
create policy tickets_leer on public.tickets for select to authenticated using (public.puede_ver(tickets));
drop policy if exists fotos_leer on public.fotos;
create policy fotos_leer on public.fotos for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = fotos.ticket_id));
-- ops: sin políticas = nadie la lee desde la API (solo aplicar_op, que es security definer).

revoke all on public.perfiles, public.raci, public.tickets, public.fotos, public.ops from anon, authenticated;
grant select on public.perfiles, public.raci, public.tickets, public.fotos to authenticated;
revoke all on function public.aplicar_op(jsonb) from public, anon;
grant execute on function public.aplicar_op(jsonb) to authenticated;
revoke all on function public.leer_tickets(timestamptz) from public, anon;
grant execute on function public.leer_tickets(timestamptz) to authenticated;
revoke all on function public.puede_ver(public.tickets) from public, anon;
grant execute on function public.puede_ver(public.tickets) to authenticated;

-- ---------- Storage: bucket privado de evidencias (ruta: <ticketId>/<Etapa>-<hash>.jpg) ----------
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false) on conflict (id) do nothing;
    drop policy if exists evidencias_leer on storage.objects;
    create policy evidencias_leer on storage.objects for select to authenticated
      using (bucket_id = 'evidencias' and exists (select 1 from public.tickets t where t.id::text = (storage.foldername(name))[1]));
    drop policy if exists evidencias_subir on storage.objects;
    create policy evidencias_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'evidencias' and exists (select 1 from public.tickets t where t.id::text = (storage.foldername(name))[1]));
  end if;
end $$;
