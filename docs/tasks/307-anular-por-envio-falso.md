---
id: 307
etapa: envios-falsos
serves: "ADR 0105 punto 5"
depends: [302, 306]
status: todo
---

# 307 — Anular por envío falso, en cascada

## Por qué

Que el envío falso desaparezca de todo y no ocupe la agenda de nadie, sin borrar nada (ADR 0105 punto 5). La
evidencia se queda: el troll del 22-oct dejó una amenaza que puede terminar en una denuncia.

## Alcance

1. `anularPorEnvioFalso` en `lib/sospecha/` (o `lib/deals/`), en UNA transacción:
   - anula el deal y sus llamadas con `anularDeal` (ya existe, `lib/deals/anular-deal.ts`), motivo "Envío falso: …";
   - anula los envíos sospechosos del deal (301);
   - anula el lead si todos sus envíos quedan anulados (302);
   - guarda la resolución en el veredicto (304).
   Un deal con abonos vigentes se rechaza, como ya hace `anularDeal`.
2. **Después de la transacción:** cancela la cita futura en Calendly con `cancelarCita`
   (`lib/calendly/escritura.ts`), en el orden del ADR 0096. Si Calendly falla, el CRM queda anulado y el deal lo dice
   para cancelarla a mano.
3. El botón en la ficha y en la pestaña de Inbox (306), con confirmación que dice qué se va a anular y que la cita se
   cancela (Calendly le avisa al invitado).
4. Permiso `puedeTrabajarDeal`, exigido en el servidor.
5. **Anular por cita falsa** (ADR 0105 punto 7), para una llamada suelta sospechosa: anula la llamada (ya se anula,
   ADR 0026), guarda la resolución en su veredicto y cancela la cita en Calendly después. La suelta no tiene dueño:
   la resuelve quien puede asignar sueltas hoy en el Inbox.

## Done cuando

- [ ] Test: después de anular, el deal, sus llamadas, el envío y el lead no cuentan en ninguna métrica y siguen en la
  ficha tachados; nada se borró.
- [ ] Test: la cita se cancela después de la transacción; un error de Calendly no deshace la anulación.
- [ ] Test: anular por cita falsa una suelta la saca del Inbox y de las métricas de agenda, y cancela su cita.
- [ ] Forjando la acción desde un closer que no es el dueño: 403 y la base sin moverse.
- [ ] Recorrido en `dev:local`; typecheck, lint, los tests y `npm run build`.
