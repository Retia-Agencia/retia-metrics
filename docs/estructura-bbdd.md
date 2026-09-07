# Estructura real de las dos BBDD

Leida el 19 de agosto de 2026 con `npm run descubrir`, via la cuenta de servicio
`retia-metrics-sync@retia-metrics.iam.gserviceaccount.com`.

Regenerar en cualquier momento con `npm run descubrir`.

> **Los IDs completos no van en el repo** (S-13). No son credenciales —quien tenga el ID sigue
> necesitando permiso de Google— pero son la direccion exacta de las dos BBDD con todos los leads,
> y el permiso de una hoja es una casilla que alguien puede cambiar a "cualquiera con el enlace"
> sin enterarse de que el enlace ya esta publicado. Viven en `.env.local` como
> `SHEET_ID_COMUNICARTE` y `SHEET_ID_TACTICAL`; el prefijo de aca alcanza para saber cual es cual.

---

## Tactical Investor

**ID:** `1DBKL4zw…` (completo en `SHEET_ID_TACTICAL`, ver `.env.example`)
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

**ID:** `1NN6rlZX…` (completo en `SHEET_ID_COMUNICARTE`, ver `.env.example`)
**Nombre:** Aplicación Comunicarte BBDD

| Pestana | Filas | Col | Para que sirve |
|---|---|---|---|
| `New form` | 1253 | 18 | **Formulario actual.** Fuente de `people`. Del 23-jul a hoy. 1.195 personas unicas (58 duplicados) |
| `Forms viejo` | 67 | 17 | Formulario anterior, del 20 al 22-jul. **Tambien hay que leerlo:** 58 de sus 65 personas NO estan en `New form` |
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
4. **Comunicarte tiene dos formularios y hay que leer los dos.** Resuelto el 19 de agosto con `npm run comparar`: son secuenciales, no duplicados. `Forms viejo` cubre del 20 al 22 de julio (65 personas unicas) y `New form` arranca el 23 de julio. Solo 7 personas aparecen en ambos; **58 de `Forms viejo` no estan en `New form`**. Ignorarlo perderia el arranque del embudo de C1. Union deduplicada: **1.253 personas**.

   Los dos tienen el mismo esquema de 17-18 columnas, asi que un solo mapeo sirve para ambos. La unica diferencia: `New form` agrega la columna `Estado`.
5. **Los respaldos `BK_` de Tactical Investor son de julio.** Si se leen, inflan los conteos.


---

## Tasa de duplicados por programa

Medida el 19 de agosto sobre los formularios reales:

| Programa | Filas | Personas unicas | Duplicados |
|---|---|---|---|
| Comunicarte (`New form` + `Forms viejo`) | 1.320 | **1.253** | 5,1% |
| Tactical Investor | 2.954 | *pendiente de medir* | ~37,8% segun el analisis del 17-ago |

La diferencia entre programas es enorme y **no se puede asumir una tasa comun**. El dedup se aplica igual en los dos, pero al validar los conteos hay que usar el numero de cada uno.
