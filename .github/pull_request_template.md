## Qué cambia

<!-- El ticket (docs/tasks/NNN-...) y en una o dos frases qué hace este PR. -->

Ticket: 

## Contratos de AGENTS.md que toca

Marca solo los que aplican y di cómo se cumplen. Uno que aplica y no se marcó es el olor.
La tabla completa vive en `AGENTS.md` (Restricciones y Contratos); esto es su índice.

**Datos y métricas**

- [ ] **Programa = frontera.** Nada cruza programas; una lista nueva lleva selector de programa. Una cifra de "todos los programas" solo suma magnitudes en la misma unidad (ADR 0048): nunca una tasa, meta, CPL, ROAS ni comisión.
- [ ] **Alcance de la sesión.** Qué programas ve sale de `lib/auth/alcance.ts`; un programa ajeno responde 404. Ningún filtro de membresía copiado.
- [ ] **Dedup por `(programa, correo)`.** Toda tasa sobre personas, nunca sobre filas.
- [ ] **Vigencia.** Toda lectura de `calls`, `deals` o `abonos` pasa por `vigente()` o `incluyendoAnulados()`, escrita en la misma cadena (no izada a un `const`).
- [ ] **Una pregunta, un módulo.** Si dos lugares dan la misma cifra, la cifra vive en un módulo y los dos la importan (saldo, `programasActivos`, última actividad…).
- [ ] **Dinero.** Saldo y abonado desde `lib/queries/saldo.ts`; la moneda al lado del número; caja ≠ ventas; una venta es un deal en Abonado o Completo.
- [ ] **Cifras de pantalla (ADR 0067).** Período A contra B por `lib/periodo.ts` y `lib/variacion.ts`; número y %; la cifra abre su lista con el universo de `lib/queries/metricas-filtros.ts`, no con otra consulta.
- [ ] **Closers.** "¿Son el mismo closer?" solo por `lib/closers/identidad.ts`; nada de comparar `closer_id` crudo.
- [ ] **Fechas de Bogotá.** `parsearFecha` y `hoyEnBogota()`; nada de `new Date(a, m, d)` ni `toISOString().slice(0, 10)` para una fecha de negocio.
- [ ] **Centinelas.** Un dato nuevo que entra de una fuente: ¿qué escribe esa fuente cuando no sabe? (`1/1/0001`, una macro `{{...}}`, un vacío). Se lee como ausente, no como dato.

**Escrituras**

- [ ] **Rastro.** Toda escritura de `deals`, `calls`, `abonos` o `deal_actividades` va por `crearConRastro` / `editarConRastro`; el valor en `change_log` por `textoDeBitacora`.
- [ ] **Catálogo.** Una fila configurable se crea por `lib/catalogo/`, también desde un script (`actorDelScript()`); se borra solo por `borrarSiNoSeUso`.
- [ ] **`deals.etapa` solo por `moverEtapa()`.** Anular no es Cierre Perdido.
- [ ] **Ingesta.** Envíos, contactos y leads los escribe solo `ingerirEntradas`; el Estado de llegada lo decide `estados_llegada`, nunca una comparación contra un texto en el código.
- [ ] **Atribución.** Canal por `resolverCanal`, envío por `emparejar`, determinista (un empate es un error visible). No se lee `utm_term`, ni `utm_content` fuera de `lib/atribucion/`. Un link de captación sale del generador, nunca concatenado a mano.

**Seguridad**

- [ ] **Roles.** Guarda en el servidor (`requireRole` / `paginaConRol`); ningún `rol === "..."` a mano (`esAdministrador`, `trabajaLeads`, `esAccesoTotal`, `rolDeVista`). El developer no pierde nada.
- [ ] **Regla de datos.** "¿Este actor puede tocar esta fila?" por `exigirAccesoAlPrograma`; el objetivo sale de la sesión, no del input.
- [ ] **Errores.** Hacia el cliente por `respuestaDeError`; zod por `normalizando`; códigos de Postgres por `lib/db/errores.ts`. Nada de un `catch` local con `instanceof z.ZodError`.
- [ ] **Datos personales.** Ningún correo ni dato personal en URLs; secretos solo en `.env.local` / Vercel (o en las columnas nombradas del ADR 0055/0057, sin pasar por `change_log`).

**Base y código**

- [ ] **Migración.** SQL de `drizzle-kit` leído a mano (un `generate` es un borrador), probado en PGlite, `SET lock_timeout = '5s'` si toca una tabla caliente, `CHECK` después de arreglar los datos; generada y aplicada por la sesión principal con el ok de Mani, mirando el ref.
- [ ] **Plantillas `sql`.** Sin subconsultas correlacionadas ni tablas interpoladas; un `Date` nunca va en `sql`, va por `gte` / `lt` / `eq`.
- [ ] **Sistema de diseño Tinta** (`docs/structure.md` §9) y `docs/anotaciones.md` si toca una pantalla: ningún color, sombra ni radio a mano; cifras en `cifra`.

## Cómo se probó

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (el CI los corre).
- [ ] Una función nueva de `lib/`: alguien la llama (`grep`), y el guardián que la cubre muerde en los dos sentidos.
- [ ] Si toca una pantalla: se hizo clic en todo lo que se abre (menús, selects, diálogos), claro y oscuro, 390 px, y se miró la consola.
- [ ] Si toca un permiso: se forjó la petición desde la vista que NO debería poder (403 o 404 y la base quieta).
- [ ] Si toca Postgres de verdad (pooler, `Date`, regex): se probó contra la base local (`npm run db:local`), no solo PGlite.

## Tracker

- [ ] `docs/tasks/README.md` y el `status` del ticket actualizados.
