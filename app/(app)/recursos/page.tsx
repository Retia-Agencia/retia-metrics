import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programasVisibles } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { programasGestionablesPorUsuario } from "@/lib/queries/programas";
import {
  enlacesDePagoVigentes,
  historialesDeRecursos,
  recursosVigentes,
} from "@/lib/queries/recursos";
import { RecursosPantalla } from "@/components/resources/recursos-pantalla";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un parametro de la URL solo sirve si vino una vez y como texto no vacio. */
function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

/**
 * Pantalla de recursos (ticket 023, ADR 0017): brochures y links de pago vigentes.
 *
 * La ven gerente y closer (ADR 0009: "todos ven todo" en el CRM). Solo quien
 * ADMINISTRA ve los controles de edicion, y eso se decide con el rol de la SESION en
 * el servidor, no escondiendo un boton (ADR 0003): las server actions vuelven a
 * exigir el rol.
 *
 * La pregunta es `esAdministrador`, no `rol === "gerente"` (ADR 0025 punto 5). El
 * developer administra y SI podia escribir —las acciones pasan por `puedeAcceder`,
 * que lo deja entrar— pero la pantalla no le ofrecia los controles: podia hacerlo y
 * no tenia como. El nombre viejo de la variable, `esGerente`, era el bug en si: la
 * pregunta nunca fue de que rol es, sino si puede editar.
 *
 * El filtro por programa y la busqueda por titulo viven en la URL (`?programa=&q=`),
 * como el dashboard (ADR 0023) y a diferencia de `/mi-dia`: el titulo de un brochure
 * NO es un dato personal (a diferencia del nombre/correo de un lead que busca
 * `/mi-dia`), asi que aqui el filtro SI conviene que sea compartible y recargable.
 * El `programa` de la URL es un SLUG (id opaco de programa, nunca un dato personal),
 * que se resuelve a un uuid contra la base antes de consultar.
 */
export default async function RecursosPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  // Con que rol se proyecta la pantalla lo decide el ROL DE VISTA, no `session.user.rol`
  // a mano (ticket 028, ADR 0024). Un administrador (gerente o developer) edita todo,
  // incluido lo global; un closer solo los programas donde tiene membresia activa, y
  // nunca un recurso global. La decision es de servidor y las server actions vuelven a
  // exigir el rol y el acceso por programa (ADR 0003).
  const rolVista = await rolDeVista(session);
  const esAdmin = esAdministrador(rolVista);

  // El ALCANCE de la sesion (ADR 0048): los programas que esta sesion ve. Un admin ve
  // todos los activos; un closer, solo los de su membresia activa. La misma lista
  // alimenta el selector del filtro, acota los recursos (mas los globales) y los links
  // de pago (solo de estos programas) para que un closer no vea los de un programa ajeno.
  const programas = await programasVisibles(session.user.id, rolVista, db);
  const idsVisibles = programas.map((p) => p.id);

  // Los programas que un closer puede EDITAR: sus membresias activas (un subconjunto de
  // lo que ve, pero se consulta aparte porque un admin ve todo sin ser miembro). Para un
  // admin no importa (edita todo), asi que solo se consulta cuando es closer.
  const programasEditables =
    !esAdmin && rolVista === "closer"
      ? (await programasGestionablesPorUsuario(session.user.id, "closer", db)).map((p) => p.id)
      : [];

  const busqueda = await searchParams;
  const slug = texto(busqueda.programa);
  const q = texto(busqueda.q);

  // El slug de la URL se traduce a un uuid DENTRO del alcance; un slug que no cuadra
  // —no existe, o es de un programa que esta sesion no ve— cae a "Todos", igual que
  // hoy con un slug desconocido.
  const programaFiltro = slug ? programas.find((p) => p.slug === slug) : undefined;
  const programId = programaFiltro?.id;

  const [recursos, enlaces] = await Promise.all([
    // `programIds` acota al alcance e incluye SIEMPRE los globales; `programId` es el
    // filtro de la URL (un programa concreto) y tambien deja pasar los globales.
    recursosVigentes({ programId, programIds: idsVisibles, q }, db),
    // Un enlace de pago siempre es de un programa: `programIds` lo acota al alcance sin
    // globales. Un alcance vacio (un closer sin membresias) no trae ninguno.
    enlacesDePagoVigentes({ programId, programIds: idsVisibles }, db),
  ]);

  // El historial de cada recurso se resuelve en el servidor: el desplegable ya trae
  // sus versiones anteriores, sin un ida y vuelta de cliente.
  const historiales = await historialesDeRecursos(recursos.map((r) => r.id), db);
  const conHistorial = recursos.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    url: r.url,
    programId: r.programId,
    programaNombre: r.programaNombre,
    historial: (historiales.get(r.id) ?? []).map((v) => ({ id: v.id, url: v.url })),
  }));

  return (
    <PageShell
      titulo="Recursos"
      descripcion="Brochures, guiones y links de pago vigentes. Encuéntralos y cópialos en un clic."
    >
      <RecursosPantalla
        esAdmin={esAdmin}
        programasEditables={programasEditables}
        q={q ?? null}
        programas={programas.map((p) => ({ id: p.id, slug: p.slug, nombre: p.nombre }))}
        recursos={conHistorial}
        enlaces={enlaces.map((e) => ({
          id: e.id,
          url: e.url,
          monto: e.monto,
          moneda: e.moneda,
          programId: e.programId,
          programaNombre: e.programaNombre,
          plataformaNombre: e.plataformaNombre,
        }))}
      />
    </PageShell>
  );
}
