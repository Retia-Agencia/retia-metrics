---
id: 079
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-3 · ADR 0039 (D2)"
depends: [078]
status: todo
---

# 079 — Recuperar las 55 personas exclusivas de `Forms viejo`, con sus envios

## Objetivo

Cerrar el unico cabo que deja la decision D2.

## Los numeros (medidos el 21-sep leyendo las dos pestanas)

```
New form      2.258 filas → 2.070 personas unicas   (6/8/2026 a 21/9/2026, VIVA)
Forms viejo      67 filas →    65 personas unicas   (20/7/2026 a 22/7/2026, MUERTA)
  de esas 65:  10 ya estan en New form
               55 NO estan en New form
```

**Las 55 no se pierden: ya estan en la base** (el CRM nunca borra un lead, F-06). Lo que les falta
es **envio**, porque `submissions` se reconstruye desde la hoja que si se lee.

## Alcance

- **Dentro:** leer `Forms viejo` y crear sus envios apuntando a la fuente **inactiva**
  `Formulario anterior` (por eso no se borro, ADR 0039).
- **Dentro:** las 10 que **ya estan** en `New form` no se duplican: es la regla de identidad de
  siempre, correo manda (ticket 050).
- **Dentro:** `posicion_en_hoja` y `fecha_envio` con la zona de esa fuente.
- **Fuera:** reactivar la fuente. Sigue inactiva: la pestana esta muerta desde julio.

## Done cuando

- [ ] Las 55 tienen envio y su ficha muestra de donde salieron.
- [ ] Las 10 repetidas no crean un lead nuevo ni un envio duplicado.
- [ ] El conteo de leads de ComunicArte **no cambia**: no se crea gente, se completa historia.

## Kiro

Si.
