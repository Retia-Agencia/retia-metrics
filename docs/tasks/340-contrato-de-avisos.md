---
id: 340
etapa: avisos
serves: "ADR 0114 puntos 1, 3, 4, 8 y 9"
depends: []
status: todo
---

# 340 — El contrato de avisos: "¿qué mando ahora?"

## Por qué

Es el cimiento de los avisos (341 a 345): el CRM decide y Juanito entrega. Sin un contrato único, cada aviso nuevo
sería un endpoint suelto y un cambio en el VPS.

## Alcance

- **Migración** (la aplica la sesión principal): tabla `avisos` con la llave única del aviso, programa, tipo, destino
  (correo de usuario o grupo del programa), texto, enlace, `servido_en`, `entregado_en` y `vencido_en`; la última
  consulta de Juanito (un solo registro); y en `programs` la configuración de avisos: encendido, grupo de ventas y
  horas del pulso (molde del reporte del semáforo, 265).
- `POST /api/avisos/pendientes`, segunda puerta del molde del semáforo (ADR 0089): secreto en cabecera comparado en
  tiempo constante, 401 sin cuerpo. Devuelve los avisos que tocan ahora, cada uno con su llave, y guarda la consulta.
  Una regla pura por tipo de aviso decide (molde de `queTocaAhora`); el endpoint solo junta.
- `POST /api/avisos/entregados`: Juanito confirma por llave (entregado, o no entregado con el motivo, por ejemplo
  "correo sin número"). Idempotente.
- Contrato zod `.strict()` en `lib/avisos/contrato.ts`: ninguna llave de persona del lead.
- `AGENTS.md`: nombrar las dos excepciones nuevas a "nada es público".

## Done cuando

- Test del endpoint: sin secreto, 401 y nada se mueve; con secreto, la respuesta pasa el esquema y una llave fuera de
  la lista blanca lo hace fallar.
- Dos consultas seguidas devuelven el mismo aviso con la misma llave; la confirmación lo saca de la siguiente.
- Un programa con avisos apagados no devuelve nada.
