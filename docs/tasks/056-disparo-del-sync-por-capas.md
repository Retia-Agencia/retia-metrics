---
id: 056
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-9 · ADR 0040 (D4), enmienda al ADR 0007"
depends: [048]
status: todo
---

# 056 — El sync se dispara por capas: la hoja avisa, la app despierta, el cron es la red

## Objetivo

Que un lead que llega a las 9am este en el CRM en minutos, **sin pagar Vercel Pro**.

🎯 Verificado por API el 21-sep: el team `agencia-dani` esta en plan **`hobby`**, donde el cron
solo corre **una vez al dia**. Los 15 minutos del insumo §5.5 no existen sin Pro, asi que las
otras capas dejan de ser refuerzo y **pasan a ser el mecanismo** (ADR 0040).

## Las cuatro capas, todas sobre la misma funcion HTTP

| Capa | Que hay que construir |
|---|---|
| **Aviso de la hoja** | trigger `onChange` de Apps Script que hace `POST /api/cron/sync` con `CRON_SECRET`. **El mecanismo principal** |
| **Sync perezoso** | al abrir la app, si el ultimo sync tiene mas de 15 min, se dispara en segundo plano |
| **Boton manual** | ya existe, se conserva |
| **Cron diario** | ya existe, se conserva como red |
| **Webhook propio** | solo el enganche (ticket 048). Se activa con Dapta |

## Alcance

- **Dentro:** el script de Apps Script, **documentado completo en `docs/estructura-bbdd.md`**,
  porque vive fuera del repo y nadie lo versiona.
- **Dentro:** el secreto en las **Script Properties** del proyecto de Apps Script, **nunca en el
  cuerpo del script**. Se sigue rotando con `npm run cron-secret` (no con `npm run rotar`).
- **Dentro:** el sync perezoso, con su umbral de 15 minutos.
- **Fuera:** subir de plan. Si algun dia se paga Pro, el cron de 15 min entra como una capa mas.

## Lo que ya esta resuelto y no hay que tocar

El candado del **ADR 0031**: el INSERT de la corrida **es** el candado. Dos disparos simultaneos no
se pisan; el segundo recibe **409 y eso no es un fallo**, el cron lo cuenta como `omitidos`.
Multiplicar relojes es seguro **porque esa decision ya se tomo**.

## Done cuando

- [ ] El `onChange` de la hoja dispara el sync **de verdad, medido**, no asumido.
- [ ] Sin el secreto, el endpoint responde **401**.
- [ ] Abrir la app con el ultimo sync viejo dispara una corrida en segundo plano; con uno reciente,
      no dispara nada.
- [ ] Dos disparos simultaneos siguen dando una corrida y un 409, con `tests/sync-candado.test.ts`
      verde.
- [ ] El script de Apps Script esta escrito en `docs/estructura-bbdd.md`.

## Kiro

Si, salvo pegar el script en la hoja (eso es de Mani, con su cuenta).
