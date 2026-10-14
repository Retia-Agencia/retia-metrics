---
id: 255
etapa: hub
serves: "docs/hub.md H-8, O5 (Mani: las gráficas están pésimas; ticket aparte para escoger la herramienta)"
depends: []
status: en curso
quien: Mani (14-oct)
---

# 255 — Elegir la librería de gráficas, con criterios escritos

## Objetivo

Que el CRM tenga una librería de gráficas elegida con criterios medidos, con su ADR, y un prototipo de la misma gráfica
real en cada candidata, para dejar de dibujar SVG a mano (`components/series-lineales.tsx`).

## Alcance

- **Dentro:** los criterios, escritos antes de probar: funciona con React 19 y Next 16 (cliente, sin romper el build,
  `AGENTS.md`); usa los tokens de color de Tinta y el modo oscuro (`structure.md` §9); ejes lineales y que se pueda
  poner número y % en el punto o el tooltip (ADR 0067); un clic en una barra o un punto abre la lista de la cifra;
  accesible (tabla alternativa, teclado); peso en el bundle; licencia; mantenimiento (versión y actividad).
- **Dentro:** tres candidatas como mínimo: **Recharts**, **ECharts** (con su envoltorio de React) y **visx**. Si
  aparece otra que cumpla mejor, entra. **Claude Dashboards** se documenta como referencia de diseño (cifra que muestra
  su consulta, frescura a la vista), no como candidata: vive fuera del CRM y se salta su rol y su frontera de programa
  (H-8).
- **Dentro:** el mismo prototipo en cada una, en una rama: "agendas creadas por día, este mes contra el mismo punto del
  anterior", con la meta como línea y clic que abre la lista. Capturas en claro y oscuro, 375 px y escritorio.
- **Dentro:** la decisión como ADR (el siguiente número libre), con la tabla de criterios llena.
- **Fuera:** migrar las gráficas existentes (256). El paquete no se instala en `main` antes del 256 (ADR 0006).

## Done cuando

- [ ] La tabla de criterios llena para cada candidata, con lo medido (peso, tiempo de render del prototipo).
- [ ] Mani eligió viendo los prototipos; el ADR está escrito.
- [ ] La rama del prototipo se borra después de decidir.
