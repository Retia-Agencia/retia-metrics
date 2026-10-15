---
id: 263
etapa: hub
serves: "docs/hub.md (gasto de pauta al día), ticket 120 y 245 · R3 (la corrida cabe en la función de Vercel)"
depends: [120, 245]
status: done
---

# 263 — La sincronización de pauta pide a Meta solo lo que cambió, y las cuentas en paralelo

## Objetivo

Que la corrida de pauta tarde segundos y no minutos, y deje de crecer con el número de anuncios: el 14-oct tardó
2 min 18 s para 6 cuentas (la función tiene 300 s) y una cuenta la tumbó por pedir creativos pesados.

## Medido (14-oct, solo lecturas a Meta con el token del sistema)

- Lo lento es expandir `creative{...}` en el borde `ads`: Milena 815 anuncios en 36 s y Tactical 818 en 52 s con
  creativo; **sin creativo, 1,0 y 1,3 s** (500 por página). Recortar `asset_feed_spec` baja los bytes (2,2 MB → 250 KB)
  pero no el tiempo.
- El creativo solo sirve para `formato` (video, imagen, carrusel) y para el `url_tags` de respaldo, y no cambia
  salvo que el anuncio cambie. `updated_time` de cada anuncio sí cambia: 12 de 818 en Tactical en 7 días.
- `ads?filtering=[{field:"id",operator:"IN",value:[...50 ids]}]` con el creativo: 50 anuncios en 3,7 s. El parámetro
  `ids` (multi-id) **está deprecado en v26**.
- Los límites de Meta (Business Use Case) se cuentan **por cuenta publicitaria**, así que las cuentas pueden ir en
  paralelo. Los insights tardan 7 a 8 s en las cuentas grandes y no cambian aquí.

## Alcance

- **Dentro:** la lista de anuncios sin creativo (con `updated_time`); el creativo solo para anuncios nuevos o con
  `updated_time` posterior a su `actualizado_en` guardado, en lotes de 50 por `filtering`; los demás conservan su
  `formato` y su `url_tags` guardados. Las cuentas en paralelo: una cuenta que falla no frena a las otras y la corrida
  termina en error nombrando la cuenta.
- **Fuera:** insights asíncronos (`report_run`): hoy no hacen falta; partir la corrida por cuenta en varias
  funciones; cambiar el cron.

## Done cuando

- [x] Un anuncio sin cambios no vuelve a pedir creativo y conserva su formato, con test.
- [x] Un anuncio nuevo o cambiado sí lo pide, en lotes de 50, con test.
- [x] Una cuenta que falla deja las otras escritas y la corrida en error con el nombre de la cuenta, con test.
- [x] La corrida real en producción tarda menos de 30 s (nota de cierre).

## Nota de cierre (14-oct, parcial)

Codex implementó; la sesión revisó e integró (`85c5213`, CI verde). Medido contra Meta con los anuncios guardados
en producción (solo lectura, el código nuevo): las 6 cuentas en **12,1 s** (Tactical 12,1 s, Milena 9,7 s), 0 lotes
de creativos (nada cambió desde la última corrida) y 0 anuncios con un formato distinto al guardado. Corrida real desde la app
(Mani, 14-oct 22:36): **ok en 12,1 s, 446 filas**, igual que la corrida anterior de 2 min 18 s.
