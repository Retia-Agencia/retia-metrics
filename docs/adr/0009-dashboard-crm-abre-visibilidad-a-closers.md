# 0009 — El dashboard del CRM abre a los closers lo que ADR 0003 les prohibia ver

**Fecha:** 2026-09-15

**Status:** accepted — confirmado por Mani (dueño del repo) el 15 de septiembre de 2026, con la
evidencia de que esto ya estaba escrito como no-negociable en `AGENTS.md`. Sigue pendiente la
confirmación de negocio con Michael y Alejandro Carvajal antes de dar acceso real a los closers
(ver `docs/spec.md`, bloque de supuestos) — lo que se aceptó aquí es la dirección de diseño, no
la validación de negocio final.

ADR 0003 fijo que un closer nunca ve el comparativo entre closers, el ranking, la caja ni la
pauta, como politica de negocio de Retia. En la sesion de spec del CRM (14-15 sep 2026), el dueno
del proyecto decidio la politica contraria para el nuevo dashboard: "todos ven todo", cualquier
closer puede ver cierres, caja recaudada y comparativo de cualquier otro closer y programa.

**Decidimos que esta politica de visibilidad reemplaza, para el dashboard del CRM, la restriccion
que cito ADR 0003.** El mecanismo de ADR 0003 sigue vigente sin cambios: `gerente` y `closer`
siguen siendo roles disjuntos sin herencia, y un closer sigue sin poder entrar a rutas exclusivas
de gerente como `/ajustes/fuentes`. Lo que cambia es el contenido que la ruta de dashboard le
muestra a un closer.

Esta decision no salio de la reunion de Granola citada en ADR 0008 (ahi no se discutio visibilidad
por rol); se tomo en esta sesion de diseno, resolviendo con la opcion mas transparente por defecto.
Queda marcada como riesgo a confirmar con Michael y Alejandro Carvajal antes de dar acceso real a
los closers (ver `docs/spec.md`, bloque de supuestos). Si la respuesta cambia, este ADR pasa a
`superseded` y ADR 0003 vuelve a regir sin excepcion.

---

## ⚠️ Enmienda 2026-09-24 (ADR 0048): "todos ven todo" rige DENTRO del programa

Mani: *"no todos los closers pertenecen a ambos programas; es clave definir el alcance"*. Un closer ve
**solo los programas donde tiene membresía activa**, en operación y en métricas. Dentro de su programa
esta política sigue intacta: ve deals, caja, pauta y el comparativo entre closers. El gerente ve todos
los programas. La implementación es el ticket 094.
