---
id: 286
etapa: origen
serves: "Cada 15 días Anderson recibe el top 10 de orígenes orgánicos por agendas y ventas, y el mismo ranking vive en Hub › Origen (Michael, 19-oct)"
depends: [246, 262, 260]
status: todo
---

# 286 — El top 10 de UTMs orgánicos cada 15 días

## Por qué

En el mensaje de Michael (19-oct): *"compártele a Anderson el top 10 orgánico cada 15 días"*. El orgánico con UTM ya
está en el CRM: el área Orgánico de la regla de `resolverCanal` (ADR 0087), con su canal y su cuenta (`instagram
rosario`).

## Alcance

- **Una consulta** sobre los hechos: los orígenes del área Orgánico de un programa, agrupados por `utm_source`,
  `utm_medium` y `utm_campaign` como llegaron, con envíos, agendas y ventas de la quincena, ordenados por agendas.
  Top 10.
- **WhatsApp:** Juanito lo manda los días 1 y 16 a las 9 a. m. al grupo del reporte de cada programa (la quincena que
  cerró). Pasa por el endpoint de máquina del semáforo o uno hermano con el mismo secreto y el mismo contrato sin
  datos personales (ADR 0089).
- **CRM:** el mismo ranking en Hub › Origen (248), con el periodo elegible.
- **Fuera:** el orgánico sin UTM (no se puede atribuir) y las métricas de los posts de Instagram.

## Done cuando

El día 16 llega al grupo un top 10 con sus cifras, y Hub › Origen muestra los mismos números para esa quincena.
