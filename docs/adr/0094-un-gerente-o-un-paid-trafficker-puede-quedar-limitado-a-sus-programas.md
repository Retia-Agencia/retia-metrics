# 0094: Un gerente o un paid trafficker puede quedar limitado a sus programas

- **Estado:** aceptado, 16-oct-2026 (Mani). Se construye en el 273.
- **Enmienda:** ADR 0048 punto 1 (quien administra y el paid trafficker veían todos los programas activos, sin
  excepción) y ADR 0052 punto 2 (el paid trafficker ve todos).
- **Confirma:** ADR 0025 (el developer es el dueño y no se le restringe nada), ADR 0028 (la vista solo estrecha), ADR
  0043 (el programa es frontera).

## Contexto

AI Second Brain Jurídico (EstadoX) es un programa que no tiene que ver con Retia y que corre en el mismo CRM (ADR 0092).
Sus gerentes y su paid trafficker no deben ver ComunicArte, Tactical ni Confianza, ni su pauta. Hasta hoy "gerente"
significa *administra todo*: `esAdministrador` le da todos los programas (`programasVisibles`) y además Ajustes
completo, con usuarios, roles, canales y Webhook Health. Si solo se filtraran los programas, un gerente de SBJ igual
podría entrar a `/ajustes/usuarios` y cambiarle el rol a alguien de Retia o volverse developer.

Se evaluó usar las membresías (`miembros_programa`): un gerente con membresías vería solo esas. Se descartó porque
`miembros_programa` significa *trabajo leads aquí*: la leen `duenos.ts`, `setter-por-defecto.ts`, `lib/calendly/` y la
captación, así que darle una membresía a un gerente lo volvería candidato a dueño o a setter. Además, agregarle un
programa a un gerente que hoy ve todo le recortaría los demás sin aviso.

## Decisión

1. **El alcance de un gerente o un paid trafficker es explícito y vive en su propia tabla**,
   `usuarios_programas_alcance (user_id, program_id)`, separada de las membresías. Sin filas, el usuario ve todos los
   programas, igual que hoy. Con filas, ve **solo esos**. Una fila solo se crea desde el selector "Programas que ve"
   de `/ajustes/usuarios`, así que restringir a alguien siempre es un acto deliberado y no el efecto de otra acción.
   Una fila no hace a nadie dueño, setter ni closer.
2. **Solo el developer edita ese alcance** (`esAccesoTotal`). El developer nunca queda limitado: aunque tenga filas,
   `programasVisibles` lo trata como "todos" (ADR 0025). Un closer o un customer success siguen con sus membresías y
   el selector no les aparece.
3. **La respuesta sigue viviendo en `lib/auth/alcance.ts`**: `programasVisibles` lee las filas para gerente y paid
   trafficker. Quien filtre por programa sigue importando ese módulo, así que el Hub, las listas, el selector y la
   vista "todos los programas" se limitan solos.
4. **Un usuario limitado no administra lo global, y nadie gana permisos que no tenía.** Dos preguntas nuevas en
   `lib/auth/roles.ts`, las dos con el alcance: `administraGlobal` la cumplen el developer y el gerente **sin** filas
   (es `esAdministrador` sin límite; el paid trafficker **nunca**, porque antes no administraba usuarios ni roles); y
   `manejaPautaGlobal`, que cumplen el developer, el gerente sin filas y el paid trafficker sin filas, para lo único
   de Ajustes que el paid trafficker ya veía (Canales y Meta). Ajustes completo se protege con `administraGlobal`;
   Canales y Meta, con `manejaPautaGlobal`. Crear un programa es global: `administraGlobal`. Dentro de sus programas,
   el gerente limitado sigue administrando igual (pestaña Programa, metas, plataformas, productos, recursos,
   cohortes, equipo), pero **toda acción que muta un programa resuelve el programa de la fila que toca** (programa,
   cohorte, membresía, fuente) y lo compara con el alcance; el slug de la ruta no cuenta, porque una server action se
   puede forjar. La lista de candidatos del equipo de un programa no muestra a quien solo pertenece a otros programas.
   🩸 La primera versión de este punto decía "el gerente o el paid trafficker sin filas" y la revisión adversarial del
   16-oct midió el efecto: un paid trafficker podía cambiarse el rol a developer.
5. **La sesión lleva si el usuario está limitado** (`alcanceLimitado`), que `revalidarToken` recalcula en cada
   emisión como hace con el rol (S-02): quitarle o ponerle programas a alguien rige en su próxima petición. Cada guarda
   decide con la sesión, pero toda lectura con programa vuelve a pasar por `programasVisibles`, que lee la base.
6. **Un programa fuera del alcance responde 404**, igual que hoy para un closer (ADR 0048): no se filtra qué slugs
   existen. Una ruta de Ajustes para un usuario limitado se comporta como cualquier ruta sin permiso: rebota a su vista.

## Consecuencias

- Hay dos conceptos que no se deben confundir: **membresía** (trabajo leads en este programa) y **alcance** (veo este
  programa). Un closer tiene alcance porque tiene membresías; un gerente puede tener alcance sin membresías.
- Los gerentes y el paid trafficker de Retia no cambian: no tienen filas.
- Los usuarios, los roles y lo global de un programa como SBJ los configura el developer. Si EstadoX necesita
  invitar a sus propios closers, eso es otra decisión (Ajustes filtrado por programa), y se descartó el 16-oct.
- Las 49 lecturas de `esAdministrador` se clasifican una por una: dentro de un programa (pasa por el alcance) o
  global (pasa a `administraGlobal`). Un uso nuevo de `esAdministrador` para una decisión global es el olor.
