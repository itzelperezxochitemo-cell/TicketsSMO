# Puesta en marcha con Supabase

La app funciona sin Supabase (modo local). Para usar la base de datos compartida:

1. **Crea un proyecto** en supabase.com (región cercana, p. ej. us-east / Sao Paulo).
2. **SQL Editor**, en este orden (cada archivo se pega y se ejecuta completo; son repetibles):
   1. `schema.sql` – tablas, seguridad por fila (RLS), funciones `aplicar_op` / `leer_tickets` y bucket privado `evidencias`.
   2. `seed_raci.sql` – la matriz RACI (127 actividades).
   3. `seed_usuarios.sql` – crea las 15 cuentas con la contraseña temporal (editable en la primera línea del bloque) y sus perfiles.
      Si prefieres crear las cuentas desde *Authentication > Users*, usa los mismos correos y corre solo el PASO B del archivo.
3. **Authentication > Providers > Email**: deja Email activo, **apaga "Allow new users to sign up"** y, si no vas a usar confirmación por correo, apaga "Confirm email".
4. **Project Settings > API**: copia *Project URL* y la llave *anon/publishable* en `js/config.js`. Nunca uses `service_role` en la app.
5. Publica la carpeta por HTTPS (SharePoint no sirve para esto; Netlify, Vercel, GitHub Pages o un servidor interno). Sube la versión de `VERSION` en `sw.js` en cada cambio.
6. Prueba: entra como `berlin.ortiz` / contraseña temporal, crea un ticket y míralo desde otro equipo con `mtto.dhl`.

## Cómo funciona
- **Escritura**: la app sigue guardando primero en el equipo y encolando (funciona sin señal). La cola envía cada operación a `public.aplicar_op`, que valida en el servidor quién puede hacerla y es idempotente por `opId`.
- **Lectura**: `public.leer_tickets` devuelve solo lo que la RLS permite (administrador: todo; los demás: lo propio, lo que la RACI marca R/A/C y los escalamientos por vencimiento). Se lee tras cada envío y cada 60 s con la app abierta.
- **Imágenes**: solo `Inicial` y `Final`, en el bucket privado `evidencias` (`<ticketId>/<Etapa>-<hash>.jpg`). La miniatura viaja en el ticket; la imagen completa se descarga al abrirla.
- **Folios**: los asigna el servidor (`TK-AAAA-NNNNNN`).
- **Primer inicio de sesión** requiere conexión. Después la sesión se mantiene y se puede trabajar sin señal.

## Qué queda fuera todavía
- Avisos por correo/Teams (hoy se generan localmente; el siguiente paso natural es un Database Webhook o Power Automate sobre `tickets`).
- Cambio de contraseña dentro de la app y SSO corporativo (la contraseña temporal compartida debe cambiarse desde el panel o con un flujo de recuperación).
- Los usuarios y la RACI también existen en `js/catalog.js` y `js/raci.js` (la app los usa para listas y nombres); si cambias uno, cambia el otro. La autoridad de permisos es la del servidor.
- Probado contra un Postgres local con un reemplazo de `auth`/`storage`; no se ha corrido todavía en un proyecto Supabase real.
