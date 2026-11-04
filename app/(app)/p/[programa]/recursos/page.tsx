import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { administraGlobal, esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import {
  Pestanas,
  pestanaActiva,
  urlConSeccion,
  type GrupoDePestanas,
} from "@/components/layout/pestanas";
import { rutaDePrograma } from "@/lib/nav";
import { programasGestionablesPorUsuario } from "@/lib/queries/programas";
import {
  enlacesDePagoVigentes,
  historialesDeRecursos,
  recursosVigentes,
} from "@/lib/queries/recursos";
import { RecursosPantalla } from "@/components/resources/recursos-pantalla";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
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
 * El programa es el de la ruta (`/p/<programa>/recursos`): el selector del menu ya lo
 * eligio, asi que aqui no se vuelve a preguntar. La lista trae los de ese programa y los
 * globales; un programa fuera del alcance de la sesion es 404 (ADR 0048).
 *
 * La busqueda por titulo vive en la URL (`?q=`), como el dashboard (ADR 0023) y a
 * diferencia de `/mi-dia`: el titulo de un brochure NO es un dato personal, asi que aqui
 * si conviene que sea compartible y recargable.
 */
export default async function RecursosPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  // Con que rol se proyecta la pantalla lo decide el ROL DE VISTA, no `session.user.rol`
  // a mano (ticket 028, ADR 0024). Un administrador (gerente o developer) edita todo,
  // incluido lo global; un closer solo los programas donde tiene membresia activa, y
  // nunca un recurso global. La decision es de servidor y las server actions vuelven a
  // exigir el rol y el acceso por programa (ADR 0003).
  const rolVista = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rolVista, slug);
  if (!programa) notFound();
  const esAdmin = esAdministrador(rolVista);
  const administraLoGlobal = administraGlobal({
    rol: rolVista,
    alcanceLimitado: session.user.alcanceLimitado,
  });

  // Los programas que un closer puede EDITAR son sus membresias activas, un subconjunto
  // de lo que ve. Quien administra edita todo sin ser miembro.
  const editaPrograma =
    esAdmin ||
    (await programasGestionablesPorUsuario(session.user.id, "closer", db)).some((p) => p.id === programa.id);

  const busqueda = await searchParams;
  const q = texto(busqueda.q);

  const [recursos, enlaces] = await Promise.all([
    // `programId` trae los de este programa y SIEMPRE los globales.
    recursosVigentes({ programId: programa.id, q }, db),
    enlacesDePagoVigentes({ programId: programa.id }, db),
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

  // Dos listas con acciones propias son DOS pestañas (regla de §9, ticket 193): la activa
  // la decide `pestanaActiva` desde `?seccion=` en el SERVIDOR, y los href conservan la
  // búsqueda con `urlConSeccion`. `Pestanas` es server-friendly, así que se
  // renderiza aquí y se pasa como nodo al componente cliente: no arrastra nada de `lib/db`.
  const ruta = rutaDePrograma(programa.slug, "recursos");
  const grupos: GrupoDePestanas[] = [
    {
      pestanas: [
        {
          id: "recursos",
          etiqueta: "Recursos",
          total: conHistorial.length,
          descripcion: "Brochures, guiones y material del programa. Cópialos en un clic.",
          href: urlConSeccion(ruta, busqueda, "recursos"),
        },
        {
          id: "links-de-pago",
          etiqueta: "Links de pago",
          total: enlaces.length,
          descripcion: "Los links de cobro vigentes por programa y plataforma.",
          href: urlConSeccion(ruta, busqueda, "links-de-pago"),
        },
      ],
    },
  ];
  const pestanas = grupos.flatMap((grupo) => grupo.pestanas);
  const seccion = pestanaActiva(texto(busqueda.seccion), pestanas);

  return (
    <PageShell
      titulo="Recursos"
      descripcion="Brochures, guiones y links de pago vigentes. Encuéntralos y cópialos en un clic."
      fija
    >
      <RecursosPantalla
        esAdmin={administraLoGlobal}
        editaPrograma={editaPrograma}
        q={q ?? null}
        seccion={seccion}
        pestanas={<Pestanas grupos={grupos} activa={seccion} etiqueta="Sección de recursos" />}
        programa={{ id: programa.id, nombre: programa.nombre }}
        recursos={conHistorial}
        enlaces={enlaces.map((e) => ({
          id: e.id,
          nombre: e.nombre,
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
