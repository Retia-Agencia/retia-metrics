---
id: 110
etapa: E3
serves: "ADR 0058 (el webhook no pierde nada) · ADR 0055 · pedido de Mani del 28-sep"
depends: [106]
status: en curso
---

# 110 — La salud del CRM: cada entrega de webhook, a la vista

## Objetivo

Mani, 28-sep: *"un lugar donde ver los logs de todos los webhooks, por programa, el código que suelta el
método HTTP y el lead que trae, para hacer seguimiento al comienzo y ver que lo que entra al Sheets
siempre va al CRM también"*.

Hoy esa respuesta solo existe en los logs de Vercel (`vercel logs --query webhooks`), que nadie del
negocio ve y que no dicen qué lead trajo cada entrega. Así se descubrió el 28-sep que las primeras
entregas daban 401: leyendo logs a mano.

## Lo que se ve (una pantalla por programa, con el selector de programa: el programa es frontera)

1. **Cada entrega del webhook**, la más reciente arriba: hora (Bogotá), fuente, código HTTP (200, 401,
   404), qué pasó (procesado, sin correo, falló la ingesta, firma ausente, firma que no cuadra) y el lead
   que trajo, con enlace a su ficha. Las que fallaron con firma buena muestran su error y se pueden
   reprocesar desde el sobre crudo.
2. **La conciliación con Sheets** mientras las dos convivan (hasta el hito B): los tokens de envío que
   están en la hoja del programa y **no** en el CRM, y al revés. Es la prueba de "todo lo que entra a
   Sheets va al CRM". Lee la hoja con el cliente de `lib/sheets/` que ya existe; no escribe en ella.
3. **El aviso del 107** (fuente sin envíos en 48 h / 5 días) vive en esta misma pantalla.

## Las reglas

- **Una entrega rechazada también se registra** (401/404), pero **sin su cuerpo**: un cuerpo sin firma
  válida es de cualquiera y no entra a la base. Se guarda la hora, la fuente (si el id existe), el código
  y el motivo. Hoy un 401 no deja rastro en la base; es la mitad que falta.
- Registrar la entrega **nunca** tumba la ingesta del lead (mismo principio que la caja negra, ADR 0058).
- La distinción "firma ausente" / "firma que no cuadra" se decide aquí (quedó propuesta en el 106).
- La ve quien administra (`esAdministrador`: gerente y developer). Nunca `rol === ...` a mano.
- Ningún dato personal en la URL: los filtros van por id opaco.

## Por decidir

1. ¿Los closers ven esta pantalla? Recomendación: no, es de operación del sistema.
2. ¿Cuánto tiempo se guardan las entregas rechazadas? Recomendación: 90 días; las procesadas quedan con
   su sobre crudo (ADR 0058).
3. ¿La conciliación con Sheets corre sola (cron) o al abrir la pantalla? Recomendación: al abrir la
   pantalla, con botón de refrescar; así no hay otro cron que escriba en producción.

## Done cuando

- [ ] Una entrega 200, una 401 y una 404 aparecen en la pantalla del programa con su código y motivo; la
      200 con su lead.
- [ ] Un token que está en la hoja y no en el CRM aparece en la conciliación.
- [ ] Una sesión de closer no carga la pantalla (se forja la petición, no se mira el botón).
- [ ] `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` limpios.

## Kiro

Sí el código y los tests, con revisión. La migración (la tabla de entregas) la escribe y aplica la
sesión principal.
