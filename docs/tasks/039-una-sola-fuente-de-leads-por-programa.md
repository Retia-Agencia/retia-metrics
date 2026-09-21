---
id: 039
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-4 · ADR 0039 (decidido por Mani el 21-sep)"
depends: [036]
status: todo
---

# 039 — `sources` significa una cosa: el intake de leads crudos de un programa

> Parte de la etapa 1: **una rama, una migracion** (`0020`).

## La decision que este ticket ejecuta (Mani, 21-sep)

> *"Borrar todas. Porque eso era solo para la migracion inicial ya que todo se manejaba manual en
> Sheets... Pero cuando el CRM se vuelva el centro, las llamadas, etc. solo van a vivir aqui. Lo
> unico que va a entrar de afuera son Leads crudos que llenan un forms de un programa."*

Detalle completo y argumentos en el **ADR 0039**.

## Las 10 filas reales (medidas contra `dev` el 21-sep) — COPIAR AL TICKET 077 ANTES DE BORRAR

| programa | fuente | destino | activo | pestana |
|---|---|---|---|---|
| comunicarte | Formulario actual | people | si | `New form` |
| comunicarte | Formulario anterior | people | si | `Forms viejo` |
| comunicarte | Estudiantes | sales | no | `Estudiantes Agosto` |
| comunicarte | Pauta | ad_spend | no | `ROAS ESTUDIASTES AGOSTO` |
| comunicarte | Registro de llamadas | calls | no | `Registro de llamadas` |
| tactical-investor | Formulario | people | si | `De Cero a Tactical Investor` |
| tactical-investor | Estudiantes C1 | sales | no | `Estudiantes Cohort Julio` |
| tactical-investor | Estudiantes C2 | sales | no | `Septiembre Estudiantes Cohort` |
| tactical-investor | Pauta C1 | ad_spend | no | `ROAS COHORT JULIO` |
| tactical-investor | Registro de llamadas | calls | no | `Registro de llamadas` |

⚠️ Son **7** con `destino != people`, no 5: el plan v2 §10 conto mal (contaba las 5 filas de
ComunicArte). La decision no cambia.

## Alcance

- **Dentro:** borrar las **7** filas con `destino != people` y **eliminar la columna `destino`**.
- **Dentro:** desactivar `Formulario anterior` (`Forms viejo`). **No se borra**: la etapa 7 va a
  recuperar sus 55 personas con sus envios, y esos `submissions.source_id` tienen que apuntar a
  algo que diga la verdad.
- **Dentro:** el indice unico **parcial** `unique (program_id) WHERE activo`. ⚠️ **Se crea DESPUES
  de desactivar `Forms viejo`, en la misma migracion**, o falla: hoy ComunicArte tiene dos fuentes
  de leads activas. Misma leccion que el `CHECK` de la migracion 0009.
- **Dentro:** `sources.tz_fechas` (default `America/Bogota`) y `sources.estado` (`activa | rota`).
  Quien los usa es la etapa 3 (tickets 053 y 055).
- **Dentro:** copiar la tabla de arriba al ticket **077** antes de borrar nada.
- **Fuera:** la pauta. `ad_spend` sobrevive como tabla y deja de ser fuente de Sheets: pasa a
  capturarse en el CRM (ADR 0039 punto 4). Su pantalla y su forma se deciden en el ticket 067.
- **Fuera:** tocar `ad_spend_huella_idx`. Tiene 0 filas y se re-piensa en la etapa 5.

## Done cuando

- [ ] `sources` tiene 3 filas: 2 activas (una por programa) y `Forms viejo` inactiva.
- [ ] La columna `destino` no existe.
- [ ] Un test **muerde el indice**: dos fuentes activas del mismo programa chocan; una activa y una
      inactiva conviven.
- [ ] Las coordenadas de las 7 pestanas borradas estan escritas en el ticket 077.

## Kiro

La migracion no. El resto, con revision.
