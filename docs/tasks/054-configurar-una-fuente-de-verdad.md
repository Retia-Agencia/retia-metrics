---
id: 054
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-7 · insumo §5.2 y §5.3, amplia el ticket 016"
depends: [039]
status: todo
---

# 054 — Configurar una fuente sin adivinar: lista de pestanas, correo de la service account, paso a paso

## Objetivo

Que un gerente conecte la hoja de un programa nuevo **sin pedirle nada a un developer** y sin
poder equivocarse en silencio.

## Alcance

- **Dentro:** el gerente pega **el link** de la hoja; el CRM extrae el id (`/d/<id>/`) y lo muestra
  truncado. Se rechaza lo que no sea Sheets.
- **Dentro:** el **correo de la service account** lo da el servidor desde el `client_email` del
  JSON, con boton **Copiar**. 🩸 El vigente es `retia-metrics-sync@retia-growth.iam…`; el
  `@retia-metrics.iam…` de `docs/estructura-bbdd.md` **esta obsoleto y hay que corregirlo**.
- **Dentro:** la pestana se elige de una **lista que el CRM lee de la hoja**, no se teclea. Sin
  errores de tipeo, sin problemas con emojis, y **si la lista no carga, es que la hoja aun no esta
  compartida**: la lista es la prueba del permiso.
- **Dentro:** el selector de zona horaria (ticket 053) y el mapeo de los ~10 promovidos que
  **Probar propone y el gerente confirma**. Obligatorios: correo, fecha, estado, **token**. UTM en
  amarillo si faltan (sin UTM no hay CPI ni ROAS).
- **Dentro:** el paso a paso del insumo §5.3 como texto de la pantalla.
- **Fuera:** cambiar la garantia del ticket 016: **una fuente ACTIVA siempre tiene un mapeo que
  cuadra**, probado contra los encabezados reales en ese momento, y sin guardar bandera de "ultima
  prueba ok" (envejeceria).

## Done cuando

- [ ] Un gerente conecta una hoja nueva de punta a punta sin tocar codigo ni variables de entorno.
- [ ] Compartir la hoja mal se manifiesta como "la lista de pestanas no carga", con el texto que
      dice que hacer.
- [ ] Activar sin los cuatro obligatorios se rechaza con 422 y **sin tocar la fila**.
- [ ] Editar una fuente ACTIVA a un mapeo roto se rechaza; editar una INACTIVA a lo mismo se
      permite (`tests/fuentes.test.ts` sigue verde).
- [ ] El correo de la service account correcto queda tambien en `docs/estructura-bbdd.md`.

## Kiro

Si, con revision visual.
