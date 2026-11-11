# Backend: Supabase (implementado) y contrato para cambiarlo

La base de datos es **Supabase**. `js/server-supabase.js` implementa el contrato de abajo y se activa al llenar `js/config.js`;
sin config, la app usa el servidor simulado `js/server-local.js`. Puesta en marcha: `supabase/LEEME.md`. El resto de esta
nota es el contrato, por si alguna vez se cambia de backend.

## Punto de conexión
Reemplaza `js/server-local.js` por un archivo que defina `TK.server` con esta forma (el motor `js/sync.js`,
la cola y las vistas no cambian):

```js
TK.server = {
  apply: function (op, progreso) { /* -> Promise<resultado> */ },
  pull:  function () { /* opcional -> Promise: traer cambios de otros dispositivos */ }
};
```

- `op` = `{ opId, seq, tipo, ticketId, data, ts }`. `opId` es único: el servidor debe ser **idempotente** por `opId`
  (si la repite por un reintento, devuelve el mismo resultado).
- Errores: lanza `Error` con `.tipo = 'red'` o `'dependencia'` (se reintenta con espera creciente) o `'validacion'`
  (se aparta tras 5 intentos y se muestra al usuario).
- `progreso(p)` (0–100) es opcional para subidas de imagen.
- Las operaciones llegan **en orden** por ticket: primero `crear_ticket`, luego el resto.

## Operaciones
| tipo | data | efecto |
|---|---|---|
| `crear_ticket` | `{actividad, responsable, impacto, tipoSolicitud, compromiso}` | Crea el ticket; responde `{folio}` |
| `cambiar_estado` | `{desde, nuevo, motivo}` | Incluye `nuevo:'Completado'` (cierre: `motivo` = comentario de cierre) y `'Cancelado'` |
| `planear` | `{fechaInicio, compromiso, fechaFin, motivo}` | Fechas definidas por el responsable |
| `reasignar` | `{nuevo, motivo}` | Cambia el responsable |
| `subir_foto` | `{fotoId, hash, etapa, bytes}` | `etapa` solo `Inicial` o `Final` (una por ticket; la nueva reemplaza) |
| `agregar_comentario` | `{texto}` | Comentario |
| `responder_apoyo` | `{acepta}` | Respuesta a una solicitud de apoyo |

El registro completo del ticket está en IndexedDB (`tickets`); al integrar, el servidor puede recibir el documento
completo en lugar de reconstruirlo con las operaciones. Campos: `impacto`, `tipoSolicitud` (`ejecuto`|`solicito`),
`solicitante`, `responsable`, `fechaInicio`, `compromiso`, `fechaFin`, `cierre`, `cerradoPor`, `comentarioCierre`,
`historial[]`, `comentarios[]`, `apoyo[]`.

## Reglas que el servidor debe repetir (no confiar en el cliente)
- **Visibilidad**: Administrador ve todo; el resto solo tickets propios (solicitante, responsable, apoyo) y los escalados por vencimiento.
- **Cierre**: cualquier usuario con acceso al ticket puede cerrarlo; registrar quién, fecha/hora y comentario opcional. Sin jerarquías.
- **Planeación**: solo el responsable asignado define inicio/compromiso/finalización; en `solicito` el solicitante no.
- **Imagen**: máximo una inicial y una final por ticket.
- **Autenticación**: hoy es una contraseña temporal compartida en el código (`TK.CLAVE_DEMO`); sustituir por SSO/JWT.
- **Folios y avisos** (correo/Teams/push) los genera el servidor.
