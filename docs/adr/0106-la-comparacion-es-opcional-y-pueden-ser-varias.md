# 0106: La comparación es opcional y pueden ser varias; la gráfica no dibuja la meta

- **Estado:** aceptado · 24-oct-2026 (Mani, recorrido del Hub; anotaciones A-164 a A-166).
- **Enmienda:** ADR 0067, punto 3 ("la comparación por defecto es contra el mismo punto del periodo anterior") y
  punto 2 (un solo B). ADR 0091 en lo que dice del tooltip y de la meta dentro de la gráfica.
- **Confirma:** ADR 0067 puntos 1, 4, 5 y 6 (número y porcentaje, Bogotá, toda cifra abre su lista, "todos" se
  parte por programa). ADR 0023 (el periodo vive en la URL).

## Contexto

Recorriendo el Hub el 24-oct, Mani encontró que toda cifra llega ya con un B al lado aunque nadie lo haya pedido:
la pantalla se llena de flechas y porcentajes que no se leen, y para mirar "cómo va la cohorte" hay que quitar la
comparación a mano. Cuando sí quiere comparar, quiere poder poner la cohorte anterior **y** un rango suyo a la vez.
Las gráficas, además, tienen un tooltip de párrafos y una línea punteada de meta que aplana la serie real.

## Decisión

1. **Por defecto no hay comparación.** Sin parámetros, el Hub de un programa abre en **la cohorte en curso**
   (si no tiene ventana de venta cae a Hoy con el aviso de siempre). "Todos los programas" no tiene una cohorte
   común y conserva Hoy. Esto vale para todo lo que usa `lib/periodo.ts`: una regla, un lugar.
2. **Comparar es agregar.** "Comparar con" agrega una comparación, y luego "Agregar comparación" suma otra, hasta
   **tres**; cada una se quita con su ×. Tres es el tope porque cada comparación es otra corrida completa de las
   consultas del periodo y una cuarta columna de cambios ya no se lee en 375 px. Las clases son las de antes:
   - `anterior`: el mismo punto del periodo anterior, por día hábil (la regla del 0067 punto 3, ahora a pedido);
   - `cohorte`: la cohorte anterior al mismo día hábil;
   - un rango `AAAA-MM-DD_AAAA-MM-DD`, cortado tal como se escribió.
3. **En la URL es una sola clave**, `comparar`, con la lista separada por comas
   (`?comparar=cohorte,2026-09-01_2026-09-30`), validada con zod: un valor desconocido, un rango al revés o más de
   tres invalidan el periodo entero (cae a Hoy con aviso, como cualquier URL rota). Las repetidas se juntan en una.
4. **Las URLs viejas abren igual:** `comparar=no` es ninguna, `comparar=cohorte` es la cohorte anterior y
   `b_desde`/`b_hasta` son un rango, que va primero. La única que cambia de sentido es la que no decía nada: antes
   comparaba contra el periodo anterior, ahora no compara, que es justo lo decidido.
5. **`periodo.b` sigue existiendo: es la primera comparación o `null`.** Las pantallas que hoy leen `b` no
   cambian; `periodo.comparaciones` trae la lista completa, y una pantalla pasa a N cuando se adapte.
6. **La gráfica no dibuja la meta.** La meta va como número al lado del título ("Meta del mes · programa: USD X"):
   una línea horizontal de meta escala el eje a la meta y aplasta la serie que sí se está leyendo.
7. **El tooltip es corto:** la fecha real, el valor de cada serie y, solo si hay comparación, el cambio en una línea
   (`+3 · +12%`). Nada de "Sin comparación", nada de repetir la base: la base es la otra serie del mismo tooltip.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Dejar la comparación por defecto y solo hacerla quitable | Es lo que había: Mani la quiere fuera hasta que la pida |
| Una clave por comparación (`b1_desde`, `b2_desde`...) | Multiplica claves y validaciones; una lista en una clave se valida con un solo esquema |
| `comparar` repetido en la query | Next entrega un arreglo o un texto según cuántas haya, y los filtros de la URL escriben un valor por clave |
| Sin tope de comparaciones | Cada una es otra corrida de consultas y otra columna; tres ya cubre "anterior, cohorte y un rango mío" |
| La meta como `markLine` de ECharts | Sigue dentro del eje y lo sigue escalando |
