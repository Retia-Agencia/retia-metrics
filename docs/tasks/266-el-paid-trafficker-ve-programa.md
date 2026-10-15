---
id: 266
etapa: hub
serves: "ADR 0082, enmienda del 15-oct (el paid trafficker abre Programa); ADR 0089 (los umbrales del semáforo)"
depends: [122, 265]
status: en curso
---

# 266 — El Paid Trafficker ve Programa y edita las metas de pauta

## Objetivo

Que quien maneja la pauta vea la ficha del programa que alimenta su semáforo (cohortes, fuentes, Calendly, cuentas de
Meta, reporte por WhatsApp) y escriba él mismo la meta y el aceptable de las métricas de pauta, sin tocar lo comercial.

## Decisiones (Mani, 15-oct)

1. **Abre Programa** el gerente, el developer y el paid trafficker. Pregunta nueva en `lib/auth/roles.ts`:
   `leePrograma(rol) = configuraPrograma(rol) || manejaPauta(rol)`. La página, el menú (`lib/nav.ts`) y la guarda de
   ruta usan `leePrograma`; quien **configura** sigue siendo `configuraPrograma`. El closer sigue con 404.
2. **Qué ve el paid trafficker, siempre en solo lectura salvo el punto 3:** las pestañas **General** y **Ventas**.
   Equipo y Captación no aparecen (y por URL caen a General). En General no ve el KPI "Comisión del closer" (es del
   equipo comercial, `veEquipoComercial`). Ve el reporte por WhatsApp y las cuentas de Meta mapeadas, sin editar.
3. **Edita solo los objetivos de las métricas de pauta.** Cada métrica de `DEFINICION_METRICAS_OBJETIVO` gana un campo
   `dePauta: boolean`: `true` para `costo_por_agenda`, `costo_por_lead`, `costo_por_venta` y `roas`; `false` para
   `cupos`, `agendas_por_dia` y `conversion_agenda_venta`. Pregunta nueva `editaObjetivo(rol, metrica)`:
   quien administra, cualquiera; quien `manejaPauta`, solo las `dePauta`. La reja vive en `lib/catalogo/objetivos.ts`
   (reemplaza a `exigirAdministrador` en crear, editar y desactivar; al editar se mira la métrica de la fila guardada
   y la entrante). La pantalla muestra los controles de editar solo donde la reja deja.
4. Umbrales de "Alertas por persistencia" (147), reporte por WhatsApp (265), cohortes, fuentes y cuentas de Meta:
   siguen siendo de quien administra; el paid trafficker los lee.
5. Las server actions de objetivos admiten al paid trafficker en `requireRole` (nunca se escribe `"developer"`).

## Done cuando

- [ ] `tests/roles.test.ts`: `leePrograma` y `editaObjetivo` en los cinco roles (developer siempre sí).
- [ ] `tests/paginas.test.ts`: el paid trafficker abre Programa (General y Ventas), no ve Equipo ni Captación ni la
      comisión; el closer sigue con 404.
- [ ] Mordida en el servidor (test del catálogo, no de la pantalla): el paid trafficker crea y edita un objetivo de
      `costo_por_agenda` y recibe 403 en uno de `cupos`, sin que la base se mueva; editar una fila de `cupos`
      mandando `costo_por_agenda` como métrica también da 403.
- [ ] Recorrido local con un paid trafficker: ve las dos pestañas y edita la meta del costo por agenda.

## Fuera

Que el paid trafficker edite el reporte por WhatsApp (destino, horas): sigue siendo de Mani y Gerencia (HQ-2, HQ-3).
