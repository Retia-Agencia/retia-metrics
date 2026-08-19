# Estructura real de las dos BBDD

Leida el 19 de agosto de 2026 con `npm run descubrir`, via la cuenta de servicio
`retia-metrics-sync@retia-metrics.iam.gserviceaccount.com`.

Regenerar en cualquier momento con `npm run descubrir`.

---

## Tactical Investor

**ID:** `1DBKL4zwWWeJppe-6mzpJ4jT1G6MdEmT1Dd_uMiNBNwc`
**Nombre:** Aplicación De Cero a Tactical Investor

| Pestana | Filas | Col | Para que sirve |
|---|---|---|---|
| `De Cero a Tactical Investor` | 2954 | 42 | **Formulario de aplicacion.** Fuente de `people`. Cuadra con las 2.932 filas del analisis del 17 de agosto |
| `Registro de llamadas` | 1000 | 31 | **Fuente de `calls`.** La Fase 4 escribe aca |
| `📞 Setteo No Calificados` | 950 | 26 | Cola de setteo — el pozo de 883 personas sin tocar |
| `🗑️ Descartados` | 1752 | 26 | Descartados |
| `Estudiantes Cohort Julio` | 999 | 44 | Matriculados C1 |
| `Septiembre Estudiantes Cohort` | 969 | 44 | Matriculados C2 |
| `ROAS COHORT JULIO` | 990 | 25 | Pauta y atribucion C1 |
| `Dashboard Registros` · `Visualización Dashboard` · `_kpis` · `_dashboard_data` | 1000 | 26 | Vistas calculadas. **No leer**: son derivadas, no fuente |
| `_ListasDropdown` | 1000 | 26 | Catalogos (closers, categorias de rechazo) |
| `Copia de 📞 Setteo No Calificados` | 1000 | 27 | Duplicado. Ignorar |
| `BK_DeCeroaTacti_20260722_2010` · `BK_Descartados_20260722_2010` | — | — | Respaldos del 22 de julio. Ignorar |

---

## Comunicarte

**ID:** `1NN6rlZXJJcgvWXYsbP99vLt9aj7FXVPd6ep4ULAcK54`
**Nombre:** Aplicación Comunicarte BBDD

| Pestana | Filas | Col | Para que sirve |
|---|---|---|---|
| `New form` | 1243 | 42 | **Formulario actual.** Fuente de `people` |
| `Forms viejo` | 1000 | 26 | Formulario anterior. **Sin resolver:** confirmar si los 1.100 leads de C1 del analisis salen de aca, de `New form`, o de los dos |
| `Registro de llamadas` | 997 | 26 | **Fuente de `calls`.** Sin filas nuevas desde el 14 de agosto — el hueco #1 del negocio |
| `Estudiantes Agosto` | 998 | 43 | Matriculados. **Las 3 ventas de C2 viven aca**, bajo una fila de texto "Septiembre", no en pestana propia |
| `📞 Setteo No Calificados` | 1000 | 26 | Cola de setteo — los 259 calificados que nunca agendaron |
| `🗑️ Descartados` | 1000 | 26 | Descartados |
| `ROAS ESTUDIASTES AGOSTO` | 999 | 24 | Pauta y atribucion |
| `Dashboard Registros` · `Visualización Dashboard` · `_kpis` · `_dashboard_data` | 1000 | 26 | Vistas calculadas. **No leer** |
| `_ListasDropdown` | 1000 | 26 | Catalogos. Los closers listados son **Juanjo, Dana y Andrea** — sirve para el campo `closer_id` |

---

## Cosas a tener en cuenta al programar la Fase 1

1. **Hay emojis en los nombres de pestana** (`📞`, `🗑️`). Los rangos de la API van con el titulo entre comillas simples: `'📞 Setteo No Calificados'!A1:Z`.
2. **Los conteos de filas son del grid, no de datos.** Una pestana de 1000 filas puede tener 200 con contenido. Hay que leer y recortar por filas vacias.
3. **Las pestanas que empiezan con `_` y las de Dashboard son derivadas.** Leerlas duplicaria datos y romperia el dedup.
4. **Comunicarte tiene dos formularios.** Antes de calcular tasas de C1 hay que resolver cual es la fuente canonica, o unificar ambos con dedup por correo.
5. **Los respaldos `BK_` de Tactical Investor son de julio.** Si se leen, inflan los conteos.
