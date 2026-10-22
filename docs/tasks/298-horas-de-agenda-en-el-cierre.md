---
id: 298
etapa: semaforo
serves: "Michael, daily de tech 22-oct: al cierre del día, un mensaje con la hora exacta de cada agenda, para ver en qué franjas agenda la gente"
depends: [259, 267, 274]
status: en main
---

# 298 — Las horas de agenda, en un mensaje aparte del cierre

## Por qué

Michael (22-oct) quiere saber a qué horas del día agenda la gente. A la hora del cierre del semáforo, el grupo de
pauta recibe un segundo mensaje con la hora exacta de cada agenda del día cerrado, agrupada en franjas.

**La fuente es el CRM, no Meta** (medido el 22-oct, solo lecturas):

- Meta da conversiones por hora (`hourly_stats_aggregated_by_advertiser_time_zone`), pero en la zona de cada cuenta
  publicitaria, sin minutos ni persona, solo pauta, y atribuidas al momento del anuncio (como el conteo por día, ver la
  nota final de `armarMensajeDeLaHora`), no al de agendar.
- `calls.createdAt` es la hora real de agendar: de 446 citas de Calendly en 14 días, la llamada se creó 2 s después
  del `created_at` del invitado en la mediana y 7 s en el peor caso.
- **Una reagenda conserva la hora de la primera agenda** (`reagendar` en `lib/calendly/eventos-de-cita.ts` reusa la
  fila de `calls`). Es a propósito: el mensaje cuenta lo mismo que la cifra "CRM" del semáforo, que cuenta la agenda una
  vez, el día en que se creó. Fueron 33 de 446 en 14 días.

## Qué

**Sin migración.** Solo agendas de pauta (`area = paid`), como la cifra "CRM" del semáforo.

1. **Dimensión `hora`** en `dimensionesDeFecha` (`lib/queries/hechos/fechas.ts`), la misma que pide el 285: la hora de
   Bogotá (`'00'` a `'23'`, texto como las otras dimensiones). El hecho de agenda (`lib/queries/hechos/agenda.ts`,
   contrato C-2 de `docs/hub.md` §8) la agrega a `DimensionAgenda`; los demás hechos que usan `dimensionesDeFecha` no
   la exponen en su tipo hasta que alguien la pida. La lista (`listar`) devuelve además la hora con minutos (`HH:MM`,
   Bogotá) de cada agenda y se puede ordenar por ella. Bogotá explícito en SQL; nada de `new Date(a, m, d)` ni
   `toISOString().slice`. Si `dia_semana` del 285 sale gratis en el mismo cambio, no se agrega: es de ese ticket.
2. **El texto** `armarMensajeDeHorasDeAgenda` en `lib/reporte-whatsapp/horas-de-agenda.ts`, puro, con la plantilla
   aprobada por Mani (22-oct):

   ```
   🕒 Horas de agenda · martes 21-oct

   *Comunícate con Confianza* · 16 agendas
   🌅 Mañana (6 a 12): 06:14 · 07:05 · 07:48
   ☀️ Tarde (12 a 18): 13:10 · 13:52 · 14:03 · 14:20 · 14:41 · 14:58 · 15:30
   🌙 Noche (18 a 24): 20:15 · 22:02 · 22:19 · 22:40 · 22:51 · 23:30
   Hora pico: 14h y 22h (4 cada una)
   ━━━━━━━━━━
   *Tactical Investor* · 8 agendas
   ...

   ℹ️ Hora en que la persona agendó en Calendly (CRM), hora de Bogotá.
   ```

   - Franjas en orden de reloj: 🌑 Madrugada (0 a 6), 🌅 Mañana (6 a 12), ☀️ Tarde (12 a 18), 🌙 Noche (18 a 24).
     **Una franja sin agendas no sale.**
   - Hora pico: la hora (`HH`h) con más agendas; si empatan, todas, unidas con "y" y "(N cada una)". Con una sola
     agenda, sin línea de pico.
   - Programa sin agendas ese día: `*Programa* · sin agendas`. La fecha, con el mismo formato de `fechaDeCierre`
     de `mensaje.ts` (reutilizarla, no copiarla).
   - El separador entre programas es el mismo `━━━━━━━━━━` del cierre.
3. **El endpoint** (`app/api/semaforo/envios/route.ts`): por cada destino que lleva al menos un bloque `cierre`, un
   envío más con la misma `hora` y `destino`, `bloques: []` y el texto del punto 2 para los programas de cierre de ese
   destino, sobre el día calendario anterior (`diaCalendarioAnterior`, el mismo día que relee el cierre). Va **después**
   del envío del semáforo de ese destino. Si las horas de un programa fallan, ese programa sale como
   `*Programa* · no se pudieron leer las agendas` y los demás siguen; nunca tumba el envío del semáforo.
4. **Contrato** (`lib/reporte-whatsapp/contrato.ts`): el envío gana `tipo: "semaforo" | "horas_agenda"`. Juanito no
   cambia: ya manda cada envío de la lista con su texto (`30X/repos/Juanito/src/scheduler/semaforo-retia.js`).
   Actualizar la fila "Que sale por el endpoint del semaforo" de la tabla de Contratos de `AGENTS.md` (ya no es un
   envío por destino y hora: el cierre lleva dos).
5. **`docs/metricas.md`**: una línea para "Horas de agenda": tabla `calls`, fecha `createdAt` en Bogotá, solo pauta,
   vigentes, la reagenda conserva la primera hora.

**Relación con el 285** (19-oct, mismo pedido de Michael): el 298 es el día cerrado, hora por hora, en su propio
mensaje; el 285 se queda con el patrón de 28 días (hora × día de la semana) y el mapa de calor de Hub › Pauta, y su
línea de franjas del cierre, si se hace, va en este mensaje de horas y no en el del semáforo.

**Fuera de alcance:** la vista previa de Programa › General (sigue mostrando solo el semáforo), agendas que no son de
pauta, y la hora que reporta Calendly (no hace falta: el desfase medido es de segundos).

## Done cuando

- [ ] Test (`tests/capa-hechos.test.ts` o el suyo): agrupar agendas por `hora` cuenta en hora de Bogotá (una agenda a
      las 23:30 de Bogotá cae en 23, no en 04 del día siguiente); excluye anuladas, otro programa y áreas no pagas; la
      lista devuelve `HH:MM` y la suma por hora es igual al largo de la lista.
- [ ] Test (`tests/reporte-whatsapp-horas-de-agenda.test.ts`): la plantilla exacta de arriba con datos fijos;
      madrugada sale primera cuando tiene agendas; franja vacía no sale; empate de pico; una sola agenda sin pico;
      programa sin agendas; programa con error.
- [ ] Test (`tests/semaforo-endpoint.test.ts`): a la hora de cierre sale el envío `horas_agenda` después del
      `semaforo` del mismo destino; a una hora `dia` no sale; dos destinos, cada uno con sus programas; la lista
      blanca del contrato sigue sin un solo dato de persona.
- [ ] Typecheck y lint limpios.
