---
id: 159
etapa: después del corte
serves: "ADR 0030, ADR 0011; pregunta de Mani del 2-oct; alcance remedido el 15-oct"
depends: [203, 167]
status: todo
---

# 159 — `closer_id` se retira: quién cobró y quién vendió son FK a `users`

## Por qué existe

Mani preguntó el 2-oct si `closer_id` es solo para las hojas. **Hoy no**: es texto copiado (ADR 0030) y el CRM
todavía decide con él en vivo:

- `lib/deals/abonos.ts` sella cada abono con el `closer_id` de la cuenta (`abonos.closer_id`, texto). `abonos`
  **no tiene FK a `users`**, así que es la única marca de quién cobró.
- La caja por closer del dashboard filtra por ese texto (`delCloser` en `lib/queries/metricas-filtros.ts`) y la
  comisión agrupa por `claveDeCloser(users.closerId)` (`lib/queries/comision.ts`).
- Crear un deal a mano con alta del lead lo exige (`lib/deals/crear-a-mano.ts`, ADR 0011): un closer sin
  `closer_id` no puede.
- La migración de las hojas (078) lo usa para reconocer al closer escrito a mano en la hoja (`lib/deals/historico.ts`).

Las llamadas ya tienen la FK (`calls.closer_user_id`, 057) y los deals su dueño (`owner_user_id`). El texto quedó
como herencia del MVP y de las hojas.

**Mientras tanto:** todo closer nuevo se da de alta con `closer_id` (su nombre, una vez). Sin él, sus abonos
salen sin closer y su caja no aparece en el comparativo.

**2-oct (Mani): se parte en dos.** La primera mitad (FK en abonos, lecturas por la FK y alta sin `closer_id`)
va YA como el [167](./167-quien-cobro-es-una-fk.md). Este ticket queda con lo que espera al corte: borrar
`users.closer_id`, su índice y el guardián que ya no tenga objeto.

## Lo que sigue vivo (medido el 15-oct)

El 078 no se aplicó: lo reemplazó el corte en cero (203, 7-oct). Pero el escritor histórico **sí corrió después**:
el 208 (8-oct) cargó los Estudiantes del corte 3 por `importarGestion` → `lib/deals/historico.ts`, y esos abonos
quedaron con el closer como texto, sin FK. El 167 ya movió las lecturas a la FK con el texto como respaldo; lo
que queda:

**Datos en producción (lectura del 15-oct):**

- `abonos`: 35, de los cuales **26 sin `registrado_por_user_id` y con `closer_id`** (CA 17, TI 9; fechas del
  16-sep al 8-oct, ninguno anulado). Son los del 208. Usan 6 textos de closer distintos; 2 casan con un
  `users.closer_id`.
- `calls`: 433, **ninguna** con `closer_id` (todas por la FK).
- `users` activos con `closer_id`: 4 (3 closers y 1 gerente); 2 closers activos ya trabajan sin él.

**Código que todavía lee el texto** (`rg closerId lib app components`):

- **Decide:** `lib/deals/abonos.ts` sella `abonos.closer_id` en cada abono nuevo (`closerDeLaCuenta`) y la
  anulación por un closer cae al texto (`mismoCloser`) cuando el abono no tiene FK, es decir, en los 26.
- **Cuenta y agrupa con respaldo:** `claveCloserSql(fk, texto)` y `porClaveConFk` en
  `lib/queries/metricas-filtros.ts`, `dashboard.ts`, `tasas-del-grupo.ts`, `metricas-con-filas.ts`;
  `comision.ts` y `embudo-etapas.ts` usan `users.closer_id` como etiqueta.
- **Identidad y perfil:** la sesión (`lib/auth/config.ts`, `vista.ts`, `revalidacion.ts`, `api/me`), el campo en
  Ajustes › Usuarios, Perfil y Mi espacio, y el catálogo de usuarios (`lib/catalogo/usuarios.ts`, opcional
  desde el 167).
- **Histórico:** `lib/deals/historico.ts`, llamado por `lib/migracion/importar.ts` (`scripts/migrar-gestion.ts`,
  `/ajustes/migracion`) y por `scripts/seed-local.ts`; `lib/deals/estado-de-llamada.ts` lo nombra
  "Closer (hoja)".
- **Sin llamadores:** `closerDeLaSesion` en `lib/auth/closer.ts` no la importa nadie (solo un comentario de
  `lib/closers/identidad.ts`). Deuda previa, no se borra en este ticket sin decidirlo.

## Objetivo

Después del corte, quién registró un abono y a quién cuenta una venta son FK a `users`; `closer_id` deja
de decidir nada y se retira.

## Alcance

La columna FK ya existe (0065, 167). Lo que falta, en este orden:

1. **Relleno de los 26 abonos sin FK**, con `mismoCloser` contra `users.closer_id` y sin adivinar: lo que no
   case se lista y lo asigna Mani a mano (pide su ok: es escritura en producción). Después, ningún abono
   vigente sin FK.
2. **El histórico escribe la FK**: `historico.ts` resuelve el closer a `users.id` al escribir (ya tiene la
   búsqueda en la línea 42) y deja de guardar el texto, o se retira si Mani decide que no habrá otro traslado.
3. **Lecturas sin texto**: `abonos.ts` deja de sellar `closer_id` y la anulación decide solo por la FK;
   `claveCloserSql` y `porClaveConFk` pierden la rama del texto; comisión y embudo etiquetan por nombre/correo.
4. **Migración aparte** cuando nada lo lea: salen `abonos.closer_id`, `calls.closer_id`, `users.closer_id` y su
   índice; el campo sale de Ajustes, Perfil y Mi espacio; el guardián de `tests/closer-identidad.test.ts`
   cambia de propósito o se retira. Lleva `lock_timeout` y se despliega primero el código sin las columnas.

**No es un quick win:** lleva relleno de datos y migración, así que lo aplica la sesión principal con el ok de
Mani (AGENTS.md). El orden 1 → 4 permite cortar después del 3 sin migración.

## Done cuando

- Ninguna lectura que decide (caja, comisión, permisos, crear a mano) usa `closer_id`.
- Un closer dado de alta sin `closer_id` registra abonos y aparece en caja y comisión.
- Las cifras de caja y comisión por closer antes y después del cambio cuadran contra producción.
