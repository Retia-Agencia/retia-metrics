# ADR 0033 — Estructura por dominio y extracciones incrementales

- **Estado:** aceptada
- **Fecha:** 2026-09-19
- **Contexto:** auditoría de arquitectura y mantenibilidad

## Contexto

El repositorio creció desde el MVP y algunos componentes mezclan tipos, helpers, estado de UI,
formularios y presentación. Mover todo de una vez reduciría la trazabilidad y aumentaría el riesgo
de romper rutas, mocks y contratos. También crear una carpeta global para reutilizar cualquier cosa
solo escondería el acoplamiento.

## Decisión

La organización nueva es **por dominio**:

```text
components/
  admin/       # pantallas y piezas de administración
  resources/   # recursos, enlaces y piezas de su pantalla
  ui/          # primitivas visuales sin conocimiento del negocio
```

Las rutas de `app/` coordinan datos y renderizado. Las decisiones de negocio permanecen en `lib/`
(`queries`, `mutations`, `catalogo` y módulos de dominio). Los tipos y helpers puros se extraen al
folder del dominio cuando tienen un contrato propio; no se crea `shared/`, `common/` ni `utils/`
como destino por defecto.

La extracción es incremental:

1. identificar una frontera de dominio estable;
2. extraer tipos/helpers puros antes que estado o efectos;
3. mantener las exportaciones públicas durante la transición cuando existan consumidores;
4. añadir tests del comportamiento extraído;
5. ejecutar typecheck, lint, tests focalizados y suite completa;
6. eliminar el archivo anterior solo cuando no queden imports.

## Consecuencias

- `components/admin/` y `components/resources/` son el primer paso aplicado en el refactor del
  19-sep; las rutas públicas no cambiaron.
- Los componentes grandes restantes (`mi-dia-registro`, `dashboard-programa` y administradores)
  no se dividen por número de líneas. Se dividen únicamente al aparecer una frontera de dominio
  verificable.
- Un refactor estructural no cambia reglas de permisos, consultas, nombres de dominio ni contratos
  de datos. Si debe hacerlo, se trata como una tarea funcional separada.
- Cada extracción añade una superficie de importación; si solo mueve código sin reducir
  responsabilidades o mejorar una frontera, no se hace.
