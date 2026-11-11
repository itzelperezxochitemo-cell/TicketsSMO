-- Usuarios del portal. Repetible.
-- PASO A (opcional): crea las cuentas de acceso con una contraseña temporal. Si prefieres crearlas desde
--   Authentication > Users en el panel de Supabase, omite este paso y solo corre el PASO B.
-- Cambia la contraseña temporal aquí y exige cambiarla después. NO subas este archivo con la contraseña real.
do $$
declare
  v_clave constant text := 'demo123';   -- contraseña temporal compartida
  v record; v_id uuid;
begin
  for v in select correo from (values
    ('leonardo.leal@dhl.com'),
    ('itzel.perez@dhl.com'),
    ('berlin.ortiz@dhl.com'),
    ('manuel.castro@dhl.com'),
    ('mtto.dhl@dhl.com'),
    ('ingenieria.pg@dhl.com'),
    ('hse.dhl@dhl.com'),
    ('calidad.dhl@dhl.com'),
    ('ulises.delgado@dhl.com'),
    ('victor.duran@dhl.com'),
    ('diego.bonilla@dhl.com'),
    ('karen.villanueva@dhl.com'),
    ('miguel.mendoza@dhl.com'),
    ('tavo.alarcon@dhl.com'),
    ('jessica.dennise@dhl.com')
  ) as t(correo) loop
    if not exists (select 1 from auth.users where email = v.correo) then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v.correo,
        crypt(v_clave, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v.correo), 'email', now(), now(), now());
    end if;
  end loop;
end $$;

-- PASO B: perfil (nombre, área y rol) de cada cuenta.
insert into public.perfiles (user_id, correo, nombre, area, rol)
select u.id, v.correo, v.nombre, v.area, v.rol
from (values
  ('leonardo.leal@dhl.com','Leonardo Leal','DHL','Administrador'),
  ('itzel.perez@dhl.com','Itzel Pérez','DHL','Administrador'),
  ('berlin.ortiz@dhl.com','Berlin Ortiz','Operaciones P&G','Coordinador'),
  ('manuel.castro@dhl.com','Manuel Castro','P&G','Supervisor'),
  ('mtto.dhl@dhl.com','MTTO DHL','Mantenimiento DHL','Equipo'),
  ('ingenieria.pg@dhl.com','Ingeniería P&G','Ingeniería P&G','Equipo'),
  ('hse.dhl@dhl.com','HS&E DHL','HS&E DHL','Equipo'),
  ('calidad.dhl@dhl.com','Calidad DHL','Calidad DHL','Equipo'),
  ('ulises.delgado@dhl.com','Ulises Delgado','RACI','Colaborador'),
  ('victor.duran@dhl.com','Víctor Durán','RACI','Colaborador'),
  ('diego.bonilla@dhl.com','Diego Bonilla','RACI','Colaborador'),
  ('karen.villanueva@dhl.com','Karen Villanueva','RACI','Colaborador'),
  ('miguel.mendoza@dhl.com','Miguel Mendoza','RACI','Colaborador'),
  ('tavo.alarcon@dhl.com','Tavo Alarcón','RACI','Colaborador'),
  ('jessica.dennise@dhl.com','Jessica Dennise','HSE P&G','Colaborador')
) as v(correo, nombre, area, rol)
join auth.users u on u.email = v.correo
on conflict (user_id) do update set correo = excluded.correo, nombre = excluded.nombre, area = excluded.area, rol = excluded.rol, activo = true;
