## Contrato de tests

Vigente desde el 25-nov-2026 (Mani). Define cuándo un test entra al repo, cuándo sale y cuánto puede crecer la suite.
Manda sobre cualquier hábito anterior de "un test por ticket".

### Por qué existe

Medido en el CI del 26-nov (run 45728813994): 453 archivos, 4.975 tests, 84.234 líneas, ~976 s de CPU en tests
más ~306 s solo importando módulos, repartidos en 3 shards de ~4 min. El 94 % del tiempo (920 s) está en los
280 archivos que levantan base (PGlite); los 119 archivos puros cuestan 42 s en total.

Y el número no mide protección: el recorrido del 20-sep encontró dos bugs con 669 tests en verde, y el menú del
sidebar estuvo roto días con 543 en verde (`convenciones.md`, líneas 15 a 27). Un test verde que no puede
fallar por un bug real es costo sin protección.

### La pregunta que decide todo

**¿Qué bug real hace fallar este test, y qué se rompe para el negocio si ese bug llega a producción?**
Si no se puede escribir en una línea ("si alguien quita el filtro de anulados en `ventas`, esto falla; si no,
el Hub cuenta ventas anuladas"), el test no entra.

### Los cinco filtros (todos deben pasar)

1. **Atrapa un bug con nombre.** Rompe una regla de negocio, una restricción de `AGENTS.md`, un contrato entre
   capas o un incidente que ya pasó. "Cubre la función" no es un bug.
2. **Nadie más lo atrapa ya.** Si lo ve el typecheck, el lint, un schema de zod, una constraint de la base u
   otro test, no se duplica. Cada comportamiento tiene **un solo test dueño**; los demás no lo vuelven a afirmar.
3. **Vive en el nivel más barato que lo ve.** En orden: función pura (ms) → base PGlite (~25 ms de vaciado más
   imports) → route handler / server action → humo de Playwright. Subir de nivel exige decir qué ve ese nivel
   que el de abajo no.
4. **Prueba por la puerta pública.** Entrada y salida de la función, del endpoint o de la acción. No mockea
   módulos propios del repo (solo bordes: `auth`, `next/headers`, red externa), no espía funciones internas.
5. **Sobrevive a un refactor que no cambia comportamiento.** Si renombrar una variable, mover un archivo o
   cambiar un texto de UI lo pone rojo, es ruido.

### Cuándo SÍ es obligatorio

| Caso | Qué se prueba | Nivel |
|---|---|---|
| Regla de métrica (N1 a N9, dedup por correo, vigencia, caja vs ventas) | La cifra con datos que distinguen la regla: duplicados, anulados, otro programa, borde de día en Bogotá | Base, en la función central |
| `moverEtapa` y toda transición del Deal | Transiciones válidas, inválidas y su efecto en dinero | Base |
| Rol en servidor | Una matriz rol × ruta/acción, guiada por tabla; forjando la petición, no mirando botones | Handler o acción |
| Contrato entre capas (webhook entrante, endpoint público, herramienta MCP ↔ pantalla) | Forma de entrada y salida, auth, error con payload inválido, paridad de cifras por las puertas | Handler |
| Lógica de front | Se extrae a función pura (filtros de URL, formato, estado derivado) y se prueba pura | Puro |
| Bug arreglado | Un test de regresión solo si el bug puede volver por el mismo camino; nombrado por el comportamiento, con el incidente en el comentario | El del bug |
| Migración que transforma datos | El backfill sobre datos con la forma vieja | Base nueva, mientras no esté aplicada en producción |
| Restricción estructural sin lint posible | Guardián con excepciones nombradas, nacido de un incidente o de una restricción | Fuente |

### Cuándo NO entra (ruido)

- **Texto de UI literal.** Solo se afirma un texto si es contrato: la unidad de moneda, "—" como "no se puede
  calcular", un mensaje que el MCP devuelve a otra máquina. El resto cambia con el copy y no protege nada.
- **Re-afirmar lo que tiene otro dueño.** Si `metricas-con-filas` ya prueba que una venta anulada no cuenta,
  el test del dashboard no lo repite: prueba solo lo que el dashboard agrega.
- **Tests por ticket.** No hay archivos `NNN-*.test.ts`. Los tests se organizan por dominio y comportamiento;
  el ticket va en el commit.
- Constantes, getters, formas de tipos, mocks que devuelven mocks, snapshots.
- **Guardianes por regex que un lint o un tipo pueden hacer.** Si la regla cabe en ESLint
  (`no-restricted-imports`, `no-restricted-syntax`) o en el tipo, va ahí: falla en el editor y no cuesta suite.
- Casos que solo cambian el dato sin cambiar la rama (`it.each` con diez correos válidos prueba lo mismo diez veces).

### Cuándo un test sale

Se borra, sin pedir permiso aparte, si cumple uno de estos:

1. Afirma lo mismo que el test dueño de ese comportamiento.
2. Prueba una migración de datos ya aplicada en producción (no puede volver a correr).
3. Prueba una función, pantalla o regla retirada.
4. Es un guardián por regex cuya regla ya enforza el lint o el tipo.
5. Falla por cambios de texto, orden o nombres sin cambio de comportamiento.

Borrar un test nunca baja la protección de una restricción de `AGENTS.md`: antes de borrar, se confirma que la
restricción conserva su test dueño.

### Presupuesto de crecimiento

- **Todo test nuevo declara su bug.** El PR lista, por test nuevo, una línea: "falla si ___". El revisor
  (cadenero, `AGENTS.md` §Review principle) rechaza el que no la tenga o el que no pase los cinco filtros.
- **Extender antes de crear.** Un archivo nuevo solo si el comportamiento no tiene dueño. Primero se busca el
  dueño (`rg` por la función central).
- **Un archivo de base nuevo dice por qué no es puro**, en su comentario de cabecera.
- **Techo de tiempo:** ningún shard del CI pasa de 2 min de `npm test` (6 shards desde el 25-nov). Si un PR lo cruza, ese PR recorta o
  baja de nivel antes de entrar.
- **Un agente delegado (Codex) recibe este contrato en el brief** y entrega la línea "falla si ___" por test.

### Cómo se mide la calidad (no la cantidad)

La cobertura de líneas no dice si un test protege: una línea ejecutada sin afirmación cuenta igual. La medida
útil es **mutación**: cambiar el código a propósito (un `>` por `>=`, quitar un filtro) y ver si algún test
falla. Un mutante que sobrevive es una regla sin test dueño. Se corre por módulo crítico, no en cada PR.
