---
id: 157
etapa: O2
serves: "docs/anotaciones.md A-40 · ADR 0076"
depends: [156]
status: in_progress
---

# 157 — El setter entrega el deal al closer por la cita: handoff, crédito y los cuatro caminos de una llamada

## Objetivo

Que un deal con llamada sea siempre de quien da la llamada, que el setter quede con su crédito, que ningún deal
quede quieto sin que alguien lo vea y que cada camino por el que entra una llamada esté mapeado y probado. Lo
decide el ADR 0076 (aceptado por Mani el 2-oct). Listo cuando el 156 esté en `main` (comparten la Transición).

## Alcance

1. **Migración** (la aplica la sesión principal, nunca Codex): `deals.setter_user_id uuid null references users` y
   `deals.handoff_en timestamptz null`. Empieza con `SET lock_timeout = '5s';`.
2. **Handoff.** En la Transición (156), el botón "Agendado" de un deal sin llamada vigente muestra el link de agenda
   para copiar y el botón "Ya se lo mandé", que escribe `handoff_en` con rastro. El deal no cambia de dueño ni de
   etapa. "Agregar la cita a mano" sigue ahí para lo hablado con la persona (camino D).
3. **Alerta "Link enviado sin cita":** con `handoff_en` y sin llamada vigente, pasado **1 día hábil** (Bogotá,
   `lib/format.ts` y los hábiles de siempre). Una sola función la responde; la leen la ficha, la tarjeta y el Inbox
   (motivo nuevo en `lib/queries/inbox.ts`).
4. **Crédito.** `darDealAlHost` (`lib/calendly/colgar-llamada.ts`): al cambiar el dueño de A a B con
   `setter_user_id` vacío, escribe `setter_user_id = A` en la misma edición con rastro.
5. **Link de agenda (camino B):** función pura en `lib/calendly/` que arma `programs.calendly_url` +
   `utm_source=crm&utm_medium=setter&utm_content=<código opaco del deal>`. El emparejador
   (`lib/calendly/emparejar-llamada.ts`) prueba primero `tracking.utm_content`; si casa con un deal abierto del MISMO
   programa, es sin duda; si no, sigue por correo. El guardián de UTM nombra esta lectura como excepción.
6. **Sueltas (camino C):** solo el host (por `calls.calendly_host_email` contra la membresía) o quien administra
   cuelga una suelta; la pregunta vive en `lib/` y la usan la acción y la pantalla. La fila sugiere deals abiertos del
   programa con el mismo nombre o teléfono, con "Colgar aquí".
7. **Ficha:** "Setteado por: <nombre>" en la cabecera cuando hay setter; "Link enviado el <fecha>" cuando hay handoff.
8. **Documentación:** el diagrama de los cuatro caminos (ADR 0076 punto 4) en `docs/structure.md`, sección de
   llamadas, y la misma explicación en el manual de operación comercial (154).

## Done cuando

- Una prueba por camino (A, B, C, D) con su resultado: dueño final, llamada colgada, setter escrito o no.
- Crédito escrito una vez y no pisado por un re-agendamiento; sin setter cuando el deal llegó agendado.
- Código de otro programa no casa; código válido casa aunque el correo sea otro.
- Alerta: aparece al día hábil siguiente (un viernes con handoff alerta el lunes) y desaparece cuando entra la cita.
- **Forjada:** un closer que no es el host cuelga una suelta → 403 y la base quieta.
- Typecheck, lint, build y tests del cambio; recorrido en `dev:local` con un webhook de Calendly firmado contra el seed.
