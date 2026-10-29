---
id: 350
etapa: pauta
serves: "Paid Ads Trafficker (29-oct): ROAS atribuido a su origen y el registro de llamadas por anuncio y campaña · 123, 125, 288"
depends: [123, 247, 349]
status: todo
---

# 350 — ROAS por anuncio y campaña, y el registro de llamadas exportable

Pedido por Pauta el 29-oct: *"nos pueden pasar el registro de llamadas de las personas, quisiera analizar de qué
anuncios y campañas llegan más no shows"* y ver el **ROAS atribuido a su origen** (hoy, global, ≈ 0,2).
Grill del 29-oct con Mani: las decisiones de abajo están cerradas; absorbe la parte de ROAS del 123 y del 288.

## Decisiones (grill 29-oct)

1. **Numerador = contratado**, el valor vendido que escribe el closer en deals Abonado o Completo (la definición de
   `docs/metricas.md`, "ROAS sobre contrato"). La caja no entra al ROAS.
2. **Ancla = fecha de registro** del envío que abrió el deal (ADR 0060): el ROAS de octubre es el contratado de los
   registros de octubre, compren cuando compren, sobre el gasto de octubre. Gasto COP convertido día a día con la TRM de
   ese día (244, ADR 0088); la TRM usada se muestra.
3. **Sin anuncio:** el ROAS TOTAL de Paid cuenta todas las ventas pagas contra todo el gasto. Cada campaña, conjunto o
   anuncio muestra solo lo que su `utm_id` resuelve en el árbol de Meta (247), más una fila "sin anuncio" con su
   contratado y su cobertura ("12 de 40 sin anuncio", ADR 0099). Nunca se reparte a la fuerza (ADR 0045).
   Gasto sin ventas = ROAS 0; sin gasto = "sin pauta".
4. **Dónde:** una tarjeta nueva en Hub › Pauta, bajo la de origen, solo Paid: campaña › conjunto › anuncio con
   registros, agendas, shows, no shows, % no show (con "n de m citas"), ventas (en llamada o después, completas o parciales, como ya muestra la tabla de origen desde el 349), contratado, gasto y ROAS. La de origen sigue para
   el canal. **Cada cifra abre las personas** (los leads exactos) con un filtro nuevo por anuncio o campaña de Meta, en la
   misma pantalla de registros del Hub (`hub/lista`) que ya usan Hoy y Comercial. Piso (Mani, 29-oct): **Gerencia** ve esas
   personas; hoy lo cumplen también closer y developer (`veEquipoComercial`, igual que en el 349). Ver la decisión abierta
   sobre el paid trafficker.
5. **Madurez por fila:** debajo del ROAS, "registros de hace X a Y días" y la marca "aún madurando" si el registro más
   reciente tiene menos días que la ventana de cierre del programa. Esa ventana NO se escribe en el código: sale de los
   deals del programa (mediana de días de registro a venta).
6. **Exportación = CSV anonimizado:** una fila por cita con día y hora, resultado, campaña, conjunto, anuncio y canal;
   sin nombre, correo, teléfono ni closer. Respeta DP-12 (el paid trafficker no ve llamadas sueltas); quién es la persona
   lo sigue diciendo la lista del Hub para quien tiene permiso. Mismo universo que la tabla.

## Decidido (Mani, 29-oct): el paid trafficker ve el lead, nada más

- Detrás de cada cifra de Pauta (registros, agendas, shows, no shows, ventas) el paid trafficker ve **el lead: nombre y
  etapa**. **Sin closer, sin deal y sin monto.** Enmienda DP-12 y el ADR 0052 solo en eso: deals, llamadas y abonos
  sueltos siguen cerrados. Consecuencia aceptada: en la lista de no shows, nombre más cifra dicen el resultado de la cita
  de esa persona; es justo lo que Pauta pidió. Gerencia, closer y developer siguen viendo lo de hoy (`veEquipoComercial`).
- Construirlo es parte del 350: una pregunta nueva en `lib/auth/roles.ts` (no un `rol ===` en la página), la proyección
  de `hub/lista` que le deje la persona y le anule closer, deal y monto, la enmienda escrita en el ADR 0052 y en DP-12, y
  el test que lo muerda forjando la petición como paid trafficker. El CSV anonimizado sigue igual.

## Fuera

- Atribuir caja por abono (queda en Dinero). Repartir ventas sin anuncio. Cualquier dato personal en el CSV.

## Done cuando

- [ ] El ROAS de un caso armado a mano (un deal pago con `utm_id` válido, TRM de dos días distintos) da lo mismo en la
      pantalla; el total de Paid cuenta una venta sin anuncio y la fila de campaña no.
- [ ] Un deal anulado o de otro programa no entra; un parcial y su completa son un registro.
- [ ] El CSV no trae ninguna columna de persona (test que recorre la cabecera) y cuadra con el conteo de la tabla.
- [ ] La cobertura se muestra siempre que haya ventas sin anuncio.
- [ ] Recorrido con clic en todo lo que se abre, claro y oscuro; `npm run build` (hay un componente cliente).
