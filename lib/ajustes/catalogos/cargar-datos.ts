import type { CatalogoVista } from "@/components/catalogos-admin";
import { vinculosDePlataformas } from "@/lib/catalogo/plataformas";
import { REGISTRO_CATALOGOS } from "@/lib/catalogo/registro";
import type { Db } from "@/lib/db/tipos";
import { programasActivos } from "@/lib/queries/programas";

export async function cargarDatosDeCatalogos(db: Db) {
  const programas = await programasActivos(db);
  const necesitaVinculos = REGISTRO_CATALOGOS.some((catalogo) => catalogo.vinculadoAProgramas);
  const vinculos = necesitaVinculos ? await vinculosDePlataformas(db) : new Map<string, string[]>();
  const catalogos: CatalogoVista[] = await Promise.all(REGISTRO_CATALOGOS.map(async (def) => {
    const items = await def.fabrica(db).listar();
    return {
      slug: def.slug,
      nombre: def.nombre,
      puedeAdministrar: true,
      camposBooleanos: def.camposBooleanos,
      camposOpciones: def.camposOpciones,
      programas: def.vinculadoAProgramas ? programas.map((programa) => ({ id: programa.id, nombre: programa.nombre })) : undefined,
      items: items.map((item) => ({
        id: item.id,
        nombre: String(item.nombre),
        activo: item.activo,
        booleanos: Object.fromEntries(def.camposBooleanos.map(({ campo }) => [campo, item[campo] === true])),
        opciones: Object.fromEntries(def.camposOpciones.map(({ campo }) => [campo, String(item[campo] ?? "")])),
        programas: def.vinculadoAProgramas ? (vinculos.get(item.id) ?? []) : undefined,
      })),
    };
  }));
  return { catalogos };
}
