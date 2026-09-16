# 0012 — Contrato de extension: las instancias viven en la base, los tipos viven en el codigo

**Fecha:** 2026-09-16

Retia va a crecer en cosas que hoy estan escritas a mano: programas (hoy dos, `PROGRAMAS` en
`lib/nav.ts` y una pagina fija por programa), closers (Juanito avisa "closer sin mapear en
Calendly... agregalo a src/cal..."), plataformas de pago (PayPal, MercadoPago, Zelle, DollarApp,
Addi en camino), links de pago, brochures, motivos de perdida. Cada una de esas altas hoy
necesita un desarrollador, y eso las convierte en cuello de botella del negocio.

**Decidimos una regla unica para saber donde vive cada cosa:**

> Si el codigo toma una decision segun ese valor, es un **tipo** y vive en el codigo (enum, cambio
> con ADR + ticket). Si el codigo no toma ninguna decision segun ese valor, es una **instancia** y
> vive como fila en la base, editable desde la app sin tocar codigo.

Ejemplos de tipo: el rol (decide permisos), el resultado de llamada (`cerrada` abre el formulario
de venta y cuenta como cierre), el tipo de fuente (`google_sheet` decide que lector se usa).
Ejemplos de instancia: un programa, una cohorte, un closer, un producto, una plataforma de pago,
un motivo, un origen del lead, un recurso, un enlace de pago.

## El molde de toda entidad configurable

Toda instancia configurable cumple las cinco piezas, sin excepcion:

1. **Una tabla** con `id` uuid, `activo` boolean y `createdAt`.
2. **Un solo esquema zod** en `lib/catalogo/` que valida la entrada. Lo usan el formulario, el
   route handler o server action, y cualquier codigo generado por un agente. No hay dos
   validaciones de la misma entidad.
3. **Una pantalla de administracion** bajo `/ajustes/<entidad>` (o donde el ADR de la entidad
   diga), con su guard de rol en el servidor.
4. **Nunca se borra, se desactiva** (`activo = false`). Las metricas historicas siguen apuntando a
   la fila; lo inactivo solo desaparece de los selectores.
5. **Cada alta o cambio deja fila en `change_log`** con `origen = "app"`, para saber quien cambio
   que configuracion y cuando.

## Reglas verificables

- **Ningun slug ni nombre de programa escrito en `lib/`, `app/` ni `components/`.** Un test lo
  revisa (ticket 009). Los seeds y los tests quedan fuera de la regla.
- **Rutas por parametro, no por instancia:** `/programas/[slug]` reemplaza a `/comunicarte` y
  `/tactical-investor` (ticket 010).
- **Una fuente nueva se prueba antes de activarse:** leer encabezados y resolver el mapeo al
  guardar, no descubrir el `MapeoInvalidoError` en el cron del dia siguiente (ticket 016).

## Por que no enums para todo

Un `pgEnum` es barato y tipado, pero agregarle un valor es una migracion y un despliegue: solo un
desarrollador puede hacerlo. Una tabla de catalogo cuesta un join, pero un gerente la edita en un
minuto. Al volumen de Retia (~3.000 filas, 5 usuarios) el join no se nota.

## Consecuencias

- El ticket 001 (`plataformaPago` como enum de 6 valores) queda **reemplazado** por el catalogo
  `plataformas_pago` (ticket 011).
- `scripts/seed-datos.ts` deja de ser la unica via de alta: pasa a ser solo la semilla inicial.
- Agregar un **tipo** nuevo (rol, resultado, tipo de fuente, integracion, metrica) sigue siendo
  trabajo de codigo: se abre con un ADR y un ticket, y un agente (Kiro) puede implementarlo
  siguiendo el molde.
