import Link from "next/link";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programasActivos } from "@/lib/queries/programas";
import { LIMITE_DE_RAREZAS, nombreDeRareza, rarezasDelPrograma } from "@/lib/migracion/rarezas";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { FiltroSelect } from "@/components/filtros/filtro-select";

export const dynamic = "force-dynamic";

/**
 * `/ajustes/migracion`: lo que la migracion de las pestañas de gestion no pudo clasificar
 * (ticket 080, ADR 0059). Solo lectura: una rareza no se anula (de la hoja si paso, ADR
 * 0038); se corrige en el deal o en el template antes de volver a correr.
 *
 * La ve quien administra (`paginaConRol("gerente")`: el developer pasa por `puedeAcceder`,
 * ADR 0025). Un programa a la vez: el programa es frontera (ADR 0043) y sale del slug de la
 * URL, no de la sesion. El filtro por tipo es un formulario GET: no hay dato personal en la
 * URL, solo el slug y el tipo.
 */
export default async function MigracionPage(props: {
  searchParams: Promise<{ programa?: string; tipo?: string }>;
}) {
  // La guarda antes de leer cualquier cosa, tambien las props.
  await paginaConRol("gerente");

  const programas = await programasActivos();
  if (programas.length === 0) {
    return (
      <PageShell
        titulo="Rarezas de la migración"
        descripcion="Lo que la migración de la hoja no pudo clasificar."
        volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
        fija
      >
        <PantallaFija>
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No hay programas activos todavía. Crea uno en Ajustes → Programas y cohortes.
            </CardContent>
          </Card>
        </PantallaFija>
      </PageShell>
    );
  }

  const { programa: slugPedido, tipo: tipoPedido } = await props.searchParams;
  const programa = programas.find((p) => p.slug === slugPedido) ?? programas[0];
  const rarezas = await rarezasDelPrograma(programa.id, tipoPedido || null);
  const { tipo } = rarezas;
  const enLaLista = tipo ? (rarezas.porTipo.find((t) => t.tipo === tipo)?.total ?? 0) : rarezas.total;

  return (
    <PageShell
      titulo="Rarezas de la migración"
      descripcion="Lo que la migración de las pestañas de gestión no pudo clasificar. Nada de esto se adivinó: cada fila dice qué tenía de raro y qué se hizo con ella."
      acciones={<Filtros programas={programas} tipos={rarezas.porTipo} />}
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <Card className="shrink-0">
          <CardHeader>
            <CardTitle className="text-base">
              Por tipo — {programa.nombre} · <span className="cifra">{num(rarezas.total)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rarezas.porTipo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este programa no tiene rarezas: la migración todavía no corrió aquí, o todo lo que trajo se pudo
                clasificar.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rarezas.porTipo.map((t) => (
                  <Link
                    key={t.tipo}
                    href={`/ajustes/migracion?programa=${encodeURIComponent(programa.slug)}&tipo=${encodeURIComponent(t.tipo)}`}
                    className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Badge variant={t.tipo === tipo ? "secondary" : "neutro"}>
                      {nombreDeRareza(t.tipo)} <span className="cifra">{num(t.total)}</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {rarezas.filas.length > 0 ? (
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="text-base">
                {tipo ? nombreDeRareza(tipo) : "Todas"} · <span className="cifra">{num(enLaLista)}</span>
              </CardTitle>
              {enLaLista > rarezas.filas.length ? (
                <p className="text-xs text-muted-foreground">
                  Se muestran las primeras <span className="cifra">{num(LIMITE_DE_RAREZAS)}</span>: filtra por tipo
                  para ver el resto.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="md:min-h-0 md:flex-1 md:overflow-y-auto">
              <ul className="divide-y divide-border">
                {rarezas.filas.map((r) => (
                  <li key={r.id} className="space-y-1 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="alerta">{nombreDeRareza(r.tipo)}</Badge>
                      {r.dealId ? (
                        <Link
                          href={`/p/${programa.slug}/deals/${r.dealId}`}
                          className="text-marca-texto underline-offset-2 hover:underline"
                        >
                          Ver deal
                        </Link>
                      ) : null}
                      {r.leadId ? (
                        <Link href={`/p/${programa.slug}/leads/${r.leadId}`} className="text-marca-texto underline-offset-2 hover:underline">
                          Ver lead
                        </Link>
                      ) : null}
                    </div>
                    <p>{r.detalle}</p>
                    <p className="cifra break-all text-xs text-muted-foreground">{r.huella}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </PantallaFija>
    </PageShell>
  );
}

/** Programa y tipo viven en la URL, sin datos personales. */
function Filtros({
  programas,
  tipos,
}: {
  programas: { slug: string; nombre: string }[];
  tipos: { tipo: string; total: number }[];
}) {
  const primero = programas[0];
  return (
    <BarraDeFiltros nombres={["programa", "tipo"]}>
      <FiltroSelect
        nombre="programa"
        etiqueta="Programa"
        todos={primero.nombre}
        opciones={programas.map((p) => ({ value: p.slug, label: p.nombre }))}
        className="w-44"
      />
      <FiltroSelect
        nombre="tipo"
        etiqueta="Tipo de rareza"
        todos="Todos los tipos"
        opciones={tipos.map((t) => ({ value: t.tipo, label: nombreDeRareza(t.tipo) }))}
        className="w-44"
      />
    </BarraDeFiltros>
  );
}
