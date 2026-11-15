# 0132 — El estado del programa decide qué pantallas ofrece, y los pasos para activarlo viven en un registro

- **Estado:** aceptada · 14-nov-2026 (Mani)
- **Relacionadas:** ADR 0057 (token de Calendly), ADR 0068 (fuente principal), ADR 0094 punto 4 (la ficha admite un inactivo), ADR 0050 (navegación por objetos), ADR 0077 (cada dato en la pantalla de su objeto), ADR 0115 N1, N2 y N7, tickets 430 a 434, análisis en `docs/onboarding-de-programa.md`

## Contexto

Con un programa inactivo elegido, el selector mostraba el inactivo y el menú se armaba con el último programa activo:
Hub, Deals y Leads apuntaban a otro programa o a rutas que respondían 404. Lo que faltaba para activar estaba escrito
dos veces (`faltaParaActivar` en la pantalla, `exigirPrincipalYToken` en el servidor), y el procedimiento completo solo
existía a mano en `docs/operations.md` §2.1. La ficha tenía cinco pestañas y las integraciones partidas en dos.

## Decisión

1. **Un registro de pasos de configuración** (`lib/programas/configuracion.ts`), exhaustivo y tipado, con la propiedad
   `exigidoParaActivar` en cada paso. Es la única respuesta a "¿qué le falta a este programa?": la pantalla, el
   recorrido y la reja de `reactivarPrograma` la leen. Los hechos que el registro evalúa salen de UNA función que lee la
   base (`lib/programas/hechos.ts`). Las dos copias anteriores se borran (N7).
2. **Bloquean la activación solo los dos de hoy:** token de Calendly (ADR 0057) y fuente principal (ADR 0068). Los demás
   pasos (datos comerciales, avisos de Calendly, equipo, cohorte activa, plataforma de pago, cuenta de Meta) son
   **recomendados**: se ven como pendientes, nunca impiden nada.
3. **El estado del programa decide las tabs.** Con un programa inactivo, el menú solo ofrece la tab Programa, que en ese
   estado es un recorrido paso a paso. Quien administra y abre por URL otra tab de un inactivo es redirigido a la
   configuración; para cualquier otro sigue siendo 404 (ADR 0048). La pregunta vive en `lib/nav.ts`.
4. **Un programa activo tiene tres pestañas:** Programa (datos, destinos, equipo, pendientes recomendados), Ventas
   (cohortes, cobro, objetivos, alertas) e Integraciones (formularios y sus secretos, Calendly, Meta, Meta CAPI,
   Typeform, Dapta y el reporte por WhatsApp). `?seccion=ventas` conserva su nombre; `general`, `equipo` y `captacion`
   se traducen a la nueva.
5. **El alta no pide slug:** se deriva del nombre con una función única (`lib/programas/slug.ts`), se muestra y se puede
   corregir antes de crear. La reja del esquema y el índice único no cambian.

## Consecuencias

- Un paso nuevo se agrega en el registro y la exhaustividad obliga a darle pantalla; si debe bloquear, se enmienda este
  ADR y el del requisito.
- Un programa nuevo hereda el recorrido sin código (C-1, ADR 0012).
- `docs/operations.md` §2.1 cita el registro en vez de ser la única lista.
