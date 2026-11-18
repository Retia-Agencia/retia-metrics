# 0135 — El MCP lee datos con SQL de solo lectura, por un usuario de base propio y un alcance que fija el servidor

- **Estado:** aceptado · 18-nov-2026 (Mani: decisiones del 18-nov sobre el ticket 407, y aprobación del cambio de diseño tras el hallazgo de abajo).
- **Amplía:** ADR 0119 (el MCP del CRM) y ADR 0129 (puerta total con reglas de orientación). **Confirma:** ADR 0043 y 0048 (el programa es frontera), ADR 0115 N1 (un concepto, una definición), ADR 0026 y 0038 (lo anulado no cuenta), ADR 0025 (el developer no se restringe).
- **Ticket:** 407, fase 1.

## Contexto

Gerencia y pauta hacen preguntas que ninguna herramienta fija responde, y una herramienta por pregunta no escala. El pedido del 8-nov: acceso a la base más libre pero controlado, con las definiciones de las métricas a la mano y la fórmula en cada respuesta. Decisiones del 18-nov: `consultar_datos` solo para gerente, paid trafficker y developer (closer y customer success siguen con las herramientas fijas); las vistas de `mcp_lectura` serán la ÚNICA fuente de cada hecho (fase 1: vistas y tests de paridad contra `lib/queries`; fase 2: `lib/queries/hechos` lee esas vistas); nombres, correos y teléfonos no se censuran, los protege el rol y el alcance (8-nov).

## El diseño que se descartó, y por qué

El primer diseño: un rol `mcp_lectura` sin login, con la conexión de la app haciendo `SET LOCAL ROLE mcp_lectura` y una tabla de alcance que el rol no puede escribir. **No se sostiene.** `SET ROLE` se autoriza contra el *usuario de sesión* (el que abrió la conexión: el de la app), no contra el rol actual. Probado el 18-nov (PGlite):

```sql
select query_to_xml('select * from public.deals', true, false, '')
from (select set_config('role', 'postgres', true)) s
```

con el rol ya bajado devolvió todas las filas de `public`, de todos los programas, y las de la tabla de alcance: `current_user` pasó a `postgres` mientras `session_user` nunca cambió. Es una sola sentencia SELECT: ni el protocolo (una sentencia por llamada) ni una validación del texto lo cierran de forma fiable (`query_to_xml`, `DO`, funciones, `set_config`). Cualquier diseño en el que el agente corra dentro de la sesión de un usuario más poderoso hereda este escape.

## Decisión

1. **Un usuario de sesión propio.** El rol `mcp_lectura_login` (en la migración 0152 nace `NOLOGIN`, sin contraseña, sin pertenecer a ningún otro rol, `NOINHERIT`) es el usuario con que se abre la conexión de lectura. No hay rol al que subir. LOGIN, contraseña y la variable `DATABASE_URL_MCP_LECTURA` (cadena del pooler de Supabase, usuario `mcp_lectura_login.<ref>`) los pone una persona fuera del repo, junto con el secreto en Vercel. Es el mismo lugar autorizado de siempre (`.env.local` y Vercel): no hay excepción nueva en `restricciones.md#secretos`.
2. **Pool propio** (`lib/db/mcp-lectura.ts`, 2 conexiones por proceso; se suman a la cuenta del ticket 441). **Nunca cae a la conexión de la app:** sin la variable, o con una cadena cuyo usuario no es `mcp_lectura_login`, `consultar_datos` no se registra y `definiciones_de_metricas` dice que falta la conexión.
3. **El alcance lo fija el servidor, una sola vez por transacción.** La tabla `mcp_lectura.alcance (txid, programa_id, ve_equipo)` solo la escribe `mcp_lectura.fijar_alcance(programas uuid[], ve_equipo boolean)`, `SECURITY DEFINER` con `search_path` fijo y `EXECUTE` solo para el rol de lectura. La función rechaza una segunda llamada en la misma transacción (fila ancla con el uuid nulo, también para quien no tiene programas), así que el agente, que corre después, no puede reescribirlo. Cada vista cruza con `txid_current()`; sin alcance fijado, cero filas.
4. **Orden de la transacción:** `BEGIN` → `fijar_alcance` → `SET LOCAL transaction_read_only = on` → `SET LOCAL statement_timeout = 5000` → `select * from (<sql del agente>) limit tope+1` → `ROLLBACK`. `fijar_alcance` va primero porque escribe; después la transacción pasa a solo lectura. Con el ROLLBACK el alcance tampoco queda. El texto del agente llega con parámetros (protocolo extendido: una sola sentencia) y el cierre del paréntesis en línea aparte, para que un comentario `--` no se lo coma.
5. **Vistas `security_barrier`**, una por hecho (`programas`, `envios`, `agendas`, `citas`, `ventas`, `abonos`, `gasto`, `leads`, `deals`), con día de Bogotá, moneda explícita, vigencia aplicada y dedup por correo donde aplica. Reproducen el predicado de su módulo de `lib/queries/hechos` (venta = Abonado o Completo, sin cortesía, sin reversa posterior; llamada sin deal anulado; envío completo; gasto Paid; etc.). `security_barrier` impide que un predicado del agente se evalúe sobre filas ajenas antes del cruce con el alcance. Las gemelas SQL de área, canal y cuenta (`utm_*`) se comparan en un test con `lib/atribucion/canal-sql.ts`. **Las comparaciones con enums van como texto**: el migrador corre todo en una transacción y un valor de enum agregado por una migración anterior no se puede usar como literal ahí (PGlite no lo detecta; Postgres real sí).
6. **Quien no ve al equipo comercial** (`veEquipoComercial`: pauta) recibe nulos en dueño, registrador y «traído por»; lo impone la vista con `ve_equipo`, no el prompt. Lo demás no se censura.
7. **Una función de rol**, `puedeConsultarDatos` en `lib/auth/roles.ts` (gerente, paid trafficker y developer, hoy `manejaPauta`). Vale lo mismo en «Ver como»: el rol efectivo decide.
8. **`definiciones_de_metricas`** devuelve el catálogo tipado de las vistas (`lib/queries/mcp-lectura/catalogo.ts`: qué es una fila, qué cuenta, con qué fecha, qué excluye, y cada columna) más las métricas del registro cuya ancla de fecha cae en cada vista (`VISTA_POR_ANCLA`, exhaustivo por tipo). No hay texto duplicado a mano: un test compara el catálogo con las columnas reales de la base en los dos sentidos.
9. **Toda respuesta de `consultar_datos`** trae `como_se_calculo`, `es_cifra_del_hub: false` y las métricas del Hub relacionadas; las instrucciones del servidor mandan responder una métrica registrada con `consultar_metrica` y reservar `consultar_datos` para explorar.
10. **La validación del texto** (`validarSoloSelect`: un solo SELECT, sin escrituras, `set_config`, `fijar_alcance` ni esquemas ajenos) **solo da mejores mensajes**; la base es la barrera y sus pruebas la ejercen con SQL hostil sin pasar por la validación (`ejecutarAcotado`).

## Enmienda del 18-nov (tres decisiones de Mani, auditoría de coherencia §5)

- **La venta se fecha por el primer pago** (abono vigente más antiguo, en Bogotá), con respaldo al día de la etapa si no hay abono. `ventas` expone `dia_de_venta` (la definición nueva; es también `dia`, `semana` y `mes`) y `dia_de_etapa` (la anterior). Otra sesión cambia `lib/queries/metricas-filtros.ts`; mientras no aterrice, el test de paridad compara el módulo contra `dia_de_etapa` y afirma `dia_de_venta` aparte. Al aterrizar, la paridad pasa a `dia`.
- **`envios` expone `tipo`** (`completo` o `parcial`); su día es `coalesce(fecha_envio, created_at)` en Bogotá (todos los parciales tienen `fecha_envio` nulo). Un parcial de alguien que después completó (mismo formulario y token) no aparece. Registros = `tipo = 'completo'`.
- **Toda cifra o tasa de citas lleva su universo:** `agendas` y `citas` traen `universo_paid` (todas las áreas = todas las filas; Paid = `'si'`), y una regla de lectura lo exige al agente.

## Consecuencias

- **Fase 2 (pendiente):** `lib/queries/hechos` pasa a leer las vistas para que cada hecho tenga una sola definición. Mientras tanto hay dos copias del predicado (la vista y el módulo de `lib/queries`); los tests de paridad con un caso que las haga divergir son lo que las ata. Divergencias conocidas, todas del lado de la vista y documentadas: `semana` y `mes` de `envios` salen del día ancla (el módulo las calcula de `fecha_envio` sin respaldo); `abonos` incluye abonos vigentes de un deal anulado, como `hechos/abono`, y lo marca con `deal_vigente`.
- **Sin fórmula única de cifra:** una consulta libre no es una cifra del Hub. La respuesta lo dice; la cifra oficial sigue saliendo de `consultar_metrica` y `resumen_del_hub`.
- **Pruebas:** vistas, alcance, topes, paridad y herramienta en PGlite (`tests/mcp-lectura-vistas.test.ts`). El cierre del escape (`set_config('role', …)`, `SET ROLE`, `RESET ROLE`, `SET SESSION AUTHORIZATION`, `query_to_xml`, segunda llamada a `fijar_alcance`, tiempo, alcance concurrente) solo se prueba contra Postgres real con login real (`tests/mcp-lectura-postgres.test.ts`, `DATABASE_URL_PRUEBA_POSTGRES`, que el CI ya levanta). PGlite corre como superusuario y no puede.
- **Operación:** la sesión que aplica la migración 0152 debe después dar LOGIN y contraseña a `mcp_lectura_login`, poner `DATABASE_URL_MCP_LECTURA` en Vercel y revisar que el pooler acepte el usuario. Sin eso, la herramienta no aparece (no se rompe nada).
- **Límites aceptados:** memoria y CPU por consulta se acotan solo con el tiempo y las filas; un agente puede pedir un cruce caro dentro de los 5 s. Si la bitácora muestra abuso, se agrega `work_mem` por rol.
