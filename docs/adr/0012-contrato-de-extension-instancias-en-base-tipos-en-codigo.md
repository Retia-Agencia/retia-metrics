# 0012 — Contrato de extensión: las instancias viven en la base, los tipos en el código

**Fecha:** 2026-09-16 · **Reescrito:** 2026-09-27 (consolida la enmienda del ADR 0026 sobre borrar) ·
**Estado:** aceptado

Retia crece en cosas que antes estaban escritas a mano: programas, closers, plataformas de pago,
links de pago, brochures, motivos. Cada alta necesitaba un desarrollador y eso volvía al desarrollador
el cuello de botella del negocio.

## Decidimos una regla única para saber dónde vive cada cosa

> Si el código toma una decisión según ese valor, es un **tipo** y vive en el código (enum; cambiarlo
> es un ADR y un ticket). Si el código no decide nada según ese valor, es una **instancia** y vive
> como fila en la base, editable desde la app sin tocar código.

- **Tipos:** el rol (decide permisos), el resultado de llamada (decide métricas y el motor), la etapa
  del deal (el embudo, Students, la cartera deciden con ella), el tipo de fuente, la calificación del
  envío.
- **Instancias:** programa, cohorte, closer, producto, plataforma de pago, motivo, área, canal,
  campaña, recurso, enlace de pago, tasa de comisión.

## El molde de toda entidad configurable (`lib/catalogo/`)

1. **Una tabla** con `id` uuid, `activo` y `createdAt`.
2. **Un solo esquema zod** que valida la entrada: lo usan el formulario, la server action y
   cualquier script. No hay dos validaciones de la misma entidad.
3. **Una pantalla de administración** con su guarda de rol en el servidor.
4. **Lo que ya se usó no se borra, se desactiva.** Lo que nunca se usó se borra de verdad
   (`borrarSiNoSeUso`, ADR 0026). La app dice cuántas referencias tiene una fila y nunca dice
   "borrado" habiendo desactivado.
5. **Cada alta o cambio deja fila en `change_log`**, con quién y cuándo, en la misma operación.

## Reglas verificables

- **Ningún slug ni nombre de programa escrito en `lib/`, `app/` ni `components/`.** Lo revisa
  `tests/contrato-extension.test.ts`. Las semillas y los tests quedan fuera de la regla.
- **Rutas por parámetro, no por instancia.**
- **Una fuente se prueba antes de activarse**, no se descubre rota en la corrida del día siguiente.

## Por qué no enums para todo

Un `pgEnum` es barato y tipado, pero agregarle un valor es una migración y un despliegue: solo un
desarrollador puede hacerlo. Una tabla de catálogo cuesta un join, y un gerente la edita en un
minuto. A la escala de Retia (miles de filas, 5 usuarios) el join no se nota. Y al revés: un
catálogo editable de algo con lo que el código razona es un enum al que le quitaron la garantía; por
eso las etapas del deal son enum (ADR 0037).
