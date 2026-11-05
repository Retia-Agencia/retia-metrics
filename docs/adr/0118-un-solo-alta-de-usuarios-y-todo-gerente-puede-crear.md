# 0118: Un solo alta de usuarios, y todo gerente puede crear usuarios dentro de su alcance

- **Estado:** aceptado, 5-nov-2026 (Mani). Pendiente de ticket.
- **Enmienda:** ADR 0094 puntos 2 y 4 y su consecuencia "otra decisión (Ajustes filtrado por programa), descartada el
  16-oct": un gerente limitado ya no queda fuera de usuarios, y el alcance ya no lo edita solo el developer.
- **Confirma:** ADR 0025 (el developer no se restringe), ADR 0043 (el programa es frontera), ADR 0077 (cada dato en la
  pantalla de su objeto; antes de agregar, quitar).

## Contexto

Dar de alta a alguien hoy son dos pasos en dos pantallas: `/ajustes/usuarios` crea la persona con su rol, y la
pestaña Equipo del programa crea la membresía. Entre una y otra el usuario existe sin trabajar en ningún programa.
Además un gerente con alcance limitado (ej. EstadoX) no entra a Ajustes (ADR 0094) y no puede invitar a su propia
gente. Mani (5-nov): el gerente siempre debe poder crear usuarios, sin excepción, desde una sola pestaña.

## Decisión

1. **Un solo alta, en `/ajustes/usuarios`**, abierta a todo gerente. Una sola transacción escribe usuario, membresías
   o alcance, y el Calendly por programa si es closer. La pestaña Equipo del programa queda como vista de esos datos
   más "Agregar existente". El resto de Ajustes (canales, salud, catálogos, áreas) sigue siendo de `administraGlobal`.
2. **Un selector de programas, el rol decide qué escribe.** Closer, customer success y media: crea membresías.
   Gerente y paid trafficker: crea alcance (vacío = ve todos, solo lo deja vacío un administrador global). Las tablas
   siguen separadas (ADR 0094): una membresía no se le da a un gerente.
3. **Un gerente limitado crea y gestiona solo dentro de su alcance.** Los programas que asigna salen de los suyos, y
   nadie nace viendo más de lo que ve quien lo crea. Puede crear cualquier rol salvo developer, incluido gerente y paid
   trafficker (nacen con alcance fijo a un subconjunto del suyo). Puede editar y desactivar usuarios cuyos programas
   estén todos dentro de su alcance. **Cambiar el rol de alguien existente a gerente, paid trafficker o developer es
   solo de `administraGlobal`.**
4. **El alcance lo fija el gerente global y el developer.** Un limitado solo asigna subconjuntos del suyo y no puede
   dejar a nadie sin límite. Reemplaza "solo el developer" del 0094 punto 2. El developer nunca queda limitado.
5. **Un correo que ya existe responde "ya existe"**, también cuando pertenece a programas fuera del alcance de quien
   crea. Se acepta que filtre la existencia; no se le suma a su programa.
6. **Se enforza en el servidor y por la fila que toca, no por la ruta**: cada acción resuelve los programas del usuario
   objetivo y los compara con el alcance de la sesión, igual que el 0094 punto 4.

## Consecuencias

- `requireRole("gerente")` y `paginaConAdministracionGlobal` de usuarios se reemplazan por una pregunta nueva en
  `lib/auth/roles.ts` ("administra usuarios en este alcance"), nunca un `rol === "gerente"` a mano.
- Hay que probar forjando la petición: un limitado que intenta crear un developer, ampliar un alcance, o tocar a un
  usuario con programas ajenos recibe 403 y la base no se mueve.
- El 0094 queda enmendado en el título y el índice en el mismo commit que se construya.
