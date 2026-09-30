# 0060 — El origen es del envío; la venta hereda el del envío que abrió su deal

- **Estado:** aceptado · 29-sep-2026 (Mani). Cierra la ficha D5 de `docs/plan.md` §7.1.
- **Relacionadas:** ADR 0004 (se guarda como llegó), ADR 0005 (el dedup vive en un índice), ADR 0024
  (lo derivado no se guarda), ADR 0035 (a qué lead pertenece un envío), ADR 0037 (el deal y el cupo),
  ADR 0045 (el emparejador de atribución), ADR 0051 (la convención de UTM); ticket 115.

## Contexto

`leads` y `submissions` guardan las mismas tres UTM. La copia del lead la arma `resumirEnvios`
(`lib/ingesta/ingerir.ts`) **campo por campo con el último valor no vacío**, así que puede mezclar
envíos: si el primero trae `facebook / cpc / campana_a` y el segundo `instagram / cpc` sin campaña, el
lead queda `instagram / cpc / campana_a`, una combinación que no vino de ningún clic. No lanza error, y el
Kanban (`lib/queries/kanban.ts`) y el Inbox (`lib/queries/inbox-sin-dueno.ts`) leen esa copia.

Medido el 29-sep en producción: **1.220 leads tienen más de un envío** (2.797 envíos; uno tiene 18).

Se evaluó y **se descartó** la alternativa de no juntar los envíos (un deal por envío, fusión manual por
el closer): convertía 1.220 personas en ~2.800 tarjetas, pedía ~1.577 fusiones a mano y calculaba la
conversión sobre filas, que infla las tasas ~60% sin error (ADR 0005, primera regla dura de `AGENTS.md`).

## Decisión

Dos preguntas distintas, dos unidades distintas, y ninguna se mezcla:

1. **El origen es de cada envío y no se resume.** Cada fila de `submissions` guarda sus UTM como
   llegaron (ADR 0004). Nada combina campos de dos envíos.
2. **Las métricas de pauta cuentan envíos** (registros por canal y campaña, CPL): cada clic costó,
   aunque sea la misma persona.
3. **Las métricas de venta cuentan personas, o sea deals** (conversión, ventas por closer), y el origen de
   un deal es **el envío que lo abrió**: `deals.submission_origen_id`, que ya existe en el esquema.
   - Lo abre la ingesta: el envío que disparó la regla (`aplicarReglaDeDeal`).
   - Lo abre un humano o la migración: el envío más reciente del lead en ese momento; sin ninguno, nulo, y
     la pantalla dice "sin envío de origen", nunca un canal por defecto.
4. **`leads.utm_*` se elimina.** Lo que hoy lo lee pasa a leer el origen del deal (listas de deals) o los
   envíos (ficha y lista de leads). Primero se mueven los lectores, después la migración quita las
   columnas.
5. **El dedup no cambia** (ADR 0005, 0035): el correo junta automáticamente dentro del programa, el
   teléfono solo marca y un humano separa o confirma. **Mani, 29-sep:** esa pantalla de separar o
   confirmar (050, 072) debe poder usarla el closer, no solo el gerente.
6. **Un envío nuevo sobre un deal abierto** se guarda, avisa al dueño y no cambia la etapa (ADR 0037).
   **Sobre un deal cerrado** (Completo o Cierre Perdido) el lead no tiene deal abierto, así que la regla
   abre uno **nuevo** con su propio envío de origen; el cerrado queda intacto. Ya lo hace
   `dealAbiertoDelLead` y lo cubre `tests/ingesta-regla-de-deals.test.ts` ("un lead con deal completo
   (cerrado) es 'sin deal abierto'").

## Consecuencias

- Una venta se atribuye a una sola campaña real, la del clic que abrió su deal. Los envíos anteriores y
  posteriores se ven en la ficha del lead (073), pero no reparten la venta.
- Hoy **0 de 58 deals** tienen `submission_origen_id`: `aplicarReglaDeDeal` no lo pasa a `abrirDeal`.
  Se arregla y se rellena en el ticket 115 (la escritura en producción, con el ok de Mani).
- 087, 088, 090, 093 y 067 leen el origen según esta regla: pauta por envío, venta por
  `submission_origen_id`.
- 🩸 El olor, para revisar código: cualquier lectura de UTM que no venga de `submissions` directamente o a
  través de `deals.submission_origen_id`.
