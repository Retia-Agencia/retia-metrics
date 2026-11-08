# 0123: Las ventanas de venta de las cohortes de un programa no se solapan

- **Estado:** aceptado · 8-nov-2026 (ticket 396, hijo del 385; auditoría F3-11). Migración 0122 (`EXCLUDE`). Decisión de Mani, 8-nov: no hay solape.
- **Enmienda:** el 0022 (la ventana de venta es dato de la cohorte): sigue siendo dato, pero con una restricción entre cohortes.
- **Concreta:** ADR 0115 N6 (lo que una métrica necesita se exige al escribir) y ADR 0005 (la garantía vive en la base).

## Contexto

Había dos solapes en producción (Tactical C2/C3, 28 y 29-sep; Confianza C1/C2, 16 al 20-nov) y ninguna regla de a qué cohorte
iba una venta de un día compartido. Efecto medido: la meta del mes de Confianza en noviembre sumaba la cohorte futura (43,43 cupos
en vez de 21,43) y «¿Vamos a llegar?» mostraba 9,2 % en vez de 18,7 % (F2B-04).

## Decisión

1. **Dos cohortes del mismo programa no comparten ningún día de venta.** `EXCLUDE USING gist (program_id WITH =,
   daterange(fecha_inicio_ventas, fecha_cierre_ventas, '[]') WITH &&) WHERE (ambas fechas no nulas)`, llamada
   `cohorts_sin_solape_de_ventas`. El rango es cerrado: el día de cierre se vende. Una cohorte sin las dos fechas (futura «por
   definir») no compite. Requiere la extensión `btree_gist` (la crea la migración).
2. **Se corrigieron las dos parejas con el molde del catálogo** (queda en `change_log`): C2 de Tactical cierra el 27-sep y C1 de
   Confianza cierra el 15-nov. Las ventas ya hechas no se mueven: se atribuyen por `deals.cohort_id`, no por fecha.
3. **El catálogo traduce el choque** (SQLSTATE `23P01`, `esViolacionExclusion`) a un 400 que dice que las fechas se solapan.
4. **Consecuencia:** a lo sumo una cohorte vende un día dado. `cohortesVendiendo` sigue devolviendo una lista, pero ya no puede
   tener más de un elemento por programa.

## Meta de leads por día (misma decisión, 8-nov)

Una cohorte nace con una meta de 50 leads por día hábil (`META_LEADS_DIA_POR_DEFECTO`, `lib/cohortes-por-defecto.ts`): default de la
columna (migración 0121), del esquema del catálogo y de la pantalla. Se puede cambiar o quitar por cohorte. Las 6 cohortes no
cerradas de hoy quedaron en 50; las cerradas siguen sin meta (no se inventa historia). Contra qué cifra se mide (Envíos o Leads)
sigue pendiente (354 alcance 3).
