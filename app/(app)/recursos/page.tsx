import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { categoriasDeRecurso } from "@/lib/catalogo/categorias-recurso";
import { plataformasDePago } from "@/lib/catalogo/plataformas";
import { programasActivos } from "@/lib/queries/programas";
import {
  enlacesDePagoVigentes,
  historialDeRecurso,
  recursosVigentes,
} from "@/lib/queries/recursos";
import { RecursosPantalla } from "@/components/recursos-pantalla";

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
  // Quien ve los controles de edicion lo decide `esAdministrador` sobre el ROL DE
  // VISTA, no sobre `session.user.rol` a mano (ticket 028, ADR 0024): un developer en
  // vista `closer` NO los ve (un closer no administra), en vista `gerente` o `todo` SI.
  // La decision es de servidor y las server actions vuelven a exigir el rol (ADR 0003).
  const puedeEditar = esAdministrador(await rolDeVista(session));

  const busqueda = await searchParams;
  const slug = texto(busqueda.programa);
  const q = texto(busqueda.q);

  // Los programas activos con id, slug y nombre: el filtro usa el slug (va a la URL,
  // id opaco) y los formularios de creacion usan el uuid.
  const programas = await programasActivos(db);

  // El slug de la URL se traduce a un uuid; un slug que no cuadra cae a "Todos".
  const programaFiltro = slug ? programas.find((p) => p.slug === slug) : undefined;
  const programId = programaFiltro?.id;

  const [recursos, enlaces, categorias, plataformas] = await Promise.all([
    recursosVigentes({ programId, q }, db),
    enlacesDePagoVigentes({ programId }, db),
    // Los catalogos del formulario solo hacen falta para el gerente (unico que crea).
    puedeEditar ? categoriasDeRecurso(db).listar({ soloActivos: true }) : Promise.resolve([]),
    puedeEditar ? plataformasDePago(db).listar({ soloActivos: true }) : Promise.resolve([]),
  ]);

  // El historial de cada recurso se resuelve en el servidor: el desplegable ya trae
  // sus versiones anteriores, sin un ida y vuelta de cliente.
  const historiales = await Promise.all(
    recursos.map((r) => historialDeRecurso(r.id, db)),
  );
  const conHistorial = recursos.map((r, i) => ({
    ...r,
    historial: historiales[i].map((v) => ({ id: v.id, url: v.url })),
  }));

  return (
    <PageShell
      titulo="Recursos"
      descripcion="Brochures, guiones y links de pago vigentes. Encuéntralos y cópialos en un clic."
    >
      <RecursosPantalla
        puedeEditar={puedeEditar}
        slugPrograma={slug ?? null}
        q={q ?? null}
        programas={programas.map((p) => ({ id: p.id, slug: p.slug, nombre: p.nombre }))}
        categorias={categorias.map((c) => ({ id: String(c.id), nombre: String(c.nombre) }))}
        plataformas={plataformas.map((p) => ({ id: String(p.id), nombre: String(p.nombre) }))}
        recursos={conHistorial}
        enlaces={enlaces.map((e) => ({
          id: e.id,
          url: e.url,
          monto: e.monto,
          moneda: e.moneda,
          programaNombre: e.programaNombre,
          productoNombre: e.productoNombre,
          plataformaNombre: e.plataformaNombre,
        }))}
      />
    </PageShell>
  );
}
