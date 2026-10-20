---
id: 270
etapa: calendly
serves: "Incidente del 15-oct (cita de Edwin Yesod sin llamada): que una cita sin llamada o una suscripción caída se vean sin buscarlas a mano"
depends: [096, 110]
status: done
---

# 270 — La auditoría de Calendly en Webhook Health

## Por qué

El 15-oct la cita de Calendly de Edwin Yesod (Tactical, 2-oct) no tenía llamada. El webhook sí funcionó: la
llamada se creó y la borró el corte en cero del 7-oct (203); la recuperación del 8-oct solo trajo citas futuras.
Después del corte no se perdió ninguna cita. Pero dos cosas que el código no vigila romperían lo mismo **sin un
solo error**: que Calendly deshabilite la suscripción por fallos repetidos, o que un borrado masivo deje citas sin
llamada. Hoy nadie se enteraría hasta notar el hueco a mano. Esta auditoría es la alarma.

## Decisiones

1. **Derivada, no guardada** (ADR 0024): se calcula al abrir la pantalla, sin migración ni tabla nueva.
2. **Solo avisa.** No escribe llamadas, no reconecta la suscripción. Arreglar es de una persona.
3. **Por programa** (el programa es frontera): la pantalla audita el programa que tiene elegido, con su
   `programs.calendly_token` (ADR 0057). Un programa sin token dice "sin token de Calendly", no audita.
4. **Citas:** los invitados (activos y cancelados) de los eventos de la organización cuyo `created_at` cae en las
   últimas **48 h**, menos los creados hace menos de **10 min** (el webhook puede ir en camino). Cada uno debe
   tener una llamada con `calls.huella_fila = huellaDeCita(uuid)` en ese programa. Se cuentan también las
   anuladas (`incluyendoAnulados(calls)`): anular es una decisión humana, el webhook hizo su parte.
5. **Reagenda:** un invitado con `rescheduled: true` es la mitad vieja; la reagenda mueve la huella de la MISMA
   llamada a la cita nueva. No es faltante si la cadena `new_invitee` (seguida hasta 5 saltos) llega a un
   invitado con llamada. Si la cadena no llega, el faltante es la mitad vieja con su motivo.
6. **Suscripción:** entre las suscripciones de la organización, la que apunta a
   `rutaDelWebhookDeCalendly(programId)` (por sufijo de la URL: la base cambia entre local y producción) debe
   estar `state: "active"` y cubrir los cuatro `EVENTOS_CALENDLY`. Ninguna, deshabilitada o con eventos de menos
   es un aviso, cada uno con su texto.
7. **Un fallo de Calendly se ve** (401, 5xx, forma rara): la tarjeta dice el error y el resto de la pantalla
   carga igual. Nunca un "todo bien" silencioso.
8. Molde de `lib/calendly/cita.ts`: `fetch` inyectable, `coleccionCompleta`, `organizacionDelToken`.

## Done cuando

- [x] `lib/calendly/auditoria.ts` con tests (`tests/calendly-auditoria.test.ts`, fetch falso y PGlite): faltante
      contado y listado; reagenda normal no cuenta; reagenda cuya cita nueva no tiene llamada sí cuenta;
      suscripción deshabilitada, ausente y con eventos de menos; error de Calendly visible; creados hace menos de
      10 min no cuentan; anulada cuenta como presente.
- [x] Tarjeta "Calendly" en `/ajustes/salud`: estado de la suscripción + conteo de citas sin llamada con su lista
      (nombre del invitado, correo, inicio y creación en hora de Bogotá, cancelada o no).
- [x] Typecheck, lint y los tests del cambio en verde; build (la página es servidor, pero toca un componente).
- [x] Recorrido en `dev:local` (15-oct): la tarjeta carga aparte con `Suspense` y, con los tokens falsos del seed, muestra
      el 401 sin tumbar la pantalla; consola limpia. El camino feliz se midió contra Calendly real y la base de producción
      (solo lectura): los tres programas con suscripción activa y 0 citas sin llamada, 2 a 5 s por programa (por eso el
      `Suspense`). La lista con faltantes reales no se vio en pantalla: la cubren los tests.

## Datos reales (15-oct, solo lectura)

Se corrió `auditarCalendly` contra Calendly y la base de producción moviendo `ahora` del 4 al 15-oct (ventanas de
48 h). Hoy los tres programas tienen la suscripción activa y **0 citas sin llamada**. Desde la ventana del 8-oct en
adelante, cero en todas. La ventana del 4-oct y la del 6-oct encuentran **6 citas sin llamada** (ComunicArte 3,
Tactical 3), creadas el 4 y 6-oct con inicio el 7 y 8-oct, ninguna cancelada. Las seis tienen lead y **ninguna
llamada en el programa**, ni por huella ni por correo. Es el mismo hueco del caso de Edwin Yesod: el corte en cero del
7-oct (203) borró la llamada y la recuperación del 8-oct solo trajo citas futuras, así que se quedaron afuera las que
empezaban el 7 y el 8. No es una falla del webhook. Las reagendas viejas de ese periodo no salieron como faltantes
(la cadena `new_invitee` las resolvió). Las seis resultaron ser estudiantes que importó el 208, con deal ya vendido (3 Abonado, 3 Completo).
Registrarlas por el escritor de Calendly le habría cambiado el dueño a un deal vendido (comisión) y habría dejado
sueltas las de Completo. **Corregido el 15-oct con el ok de Mani:** un script desechable creó las 6 llamadas
directo en su deal con `crearConRastro` (actor: Mani por `SCRIPT_ACTOR_EMAIL`), resultado **Cerrada**, fecha de la
cita, closer la dueña de la cuenta host, huella `calendly:<uuid>` y origen `calendly`, sin tocar etapa, dueño ni
notificaciones. Re-corrida la auditoría sobre esas ventanas: 0 faltantes.

## Fuera

- Escribir las llamadas que faltan (un botón "recuperar" sería otro ticket).
- Correrla sola por cron o mandarla por WhatsApp.
- Cualquier migración.
