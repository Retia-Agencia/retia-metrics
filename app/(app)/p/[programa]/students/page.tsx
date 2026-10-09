import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { studentsDelPrograma, type FiltroStudents } from "@/lib/queries/estudiantes";
import { totalesDeStudents } from "@/lib/queries/estudiantes-totales";
import { fecha, fechaDeInstanteEnBogota, monto, num, saldoLegible } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * La tab Students (ticket 099): reemplaza las pestañas `Estudiantes <cohorte>` de las hojas.
 * Un estudiante es un deal vigente en Ganado Pago Parcial o Ganado Pagado Completo (ticket 063); la cohorte define la
 * lista (Mani, 24-sep), y por defecto se ve la activa.
 *
 * Solo muestra y filtra: el onboarding se marca y la cohorte se cambia en la ficha del deal,
 * donde ya viven esas acciones con su reja (dueño o administrador). El alcance es el de Deals
 * (ADR 0048): un programa fuera del alcance de la sesión es 404.
 */
export default async function StudentsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const query = await searchParams;
  const cohortes = (await listarCohortes(db, programa.id)).sort((a, b) =>
    (b.fechaInicioVentas ?? "").localeCompare(a.fechaInicioVentas ?? ""),
  );
  const activa = cohortes.find((c) => c.estado === "activo") ?? null;
  const cohortePedida = uno(query.cohorte);
  // Una cohorte que no es de este programa no filtra nada raro: vuelve a la de por defecto.
  const cohorte =
    cohortePedida === "todas" ? null : (cohortes.find((c) => c.id === cohortePedida) ?? activa);
  const onboardedPedido = uno(query.onboarding);
  const filtro: FiltroStudents = {
    cohortId: cohorte?.id ?? null,
    onboarded: onboardedPedido === "si" || onboardedPedido === "no" ? onboardedPedido : null,
  };
  const filas = await studentsDelPrograma(db, programa.id, filtro);
  const totales = totalesDeStudents(filas);

  // El origen de ESTA lista para los enlaces al detalle (ticket 174).
  const origen = origenDeLaPagina(`/p/${programa.slug}/students`, query);

  const completos = filas.filter((f) => f.etapa === "ganado_completo").length;
  const sinOnboarding = filas.filter((f) => f.onboardedAt == null).length;
  const vencidos = filas.filter((f) => f.vencido != null).length;
  // Los filtros declarados de Students (ticket 202): Cohorte a la vista, Onboarding en el
  // popover. El resumen (completos, sin onboarding, cartera vencida) va a la línea de
  // estado cuando no hay filtros activos.
  const filtrosStudents: FiltroDeclarado[] = [
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Cohorte",
      todos: "Todas las cohortes",
      valorTodos: "todas",
      porDefecto: activa
        ? { valor: activa.id, etiqueta: `${activa.codigo} (activa)`, valorTodos: "todas" }
        : undefined,
      opciones: cohortes.map((c) => ({ value: c.id, label: `${c.codigo}${c.estado === "activo" ? " (activa)" : ""}` })),
    },
    {
      tipo: "select",
      nombre: "onboarding",
      etiqueta: "Onboarding",
      opciones: [
        { value: "no", label: "Sin onboarding" },
        { value: "si", label: "Con onboarding" },
      ],
    },
  ];
  const resumen = (
    <>
      <span>Completos <span className="cifra font-semibold text-foreground">{num(completos)}</span></span>
      <span>Sin onboarding <span className="cifra font-semibold text-foreground">{num(sinOnboarding)}</span></span>
      <span>En cartera vencida <span className="cifra font-semibold text-foreground">{num(vencidos)}</span></span>
    </>
  );
  return (
    <PageShell titulo={programa.nombre} descripcion="Students" fija>
      <PantallaFija>
        <div className="shrink-0">
          <BarraDeLista
            total={filas.length}
            sustantivo={{ singular: "estudiante", plural: "estudiantes" }}
            filtros={filtrosStudents}
            resumen={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">{resumen}</span>}
          />
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="shrink-0">
            <CardTitle className="text-base">
              {cohorte ? `Cohorte ${cohorte.codigo}` : "Todas las cohortes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {cohortes.length === 0
                  ? "Este programa no tiene cohortes todavía. Créalas en Ajustes → Programas y cohortes."
                  : "No hay estudiantes con estos filtros. Un deal aparece aquí cuando entra en Ganado Pago Parcial o Ganado Pagado Completo."}
              </p>
            ) : (
              <table className="min-w-[72rem] w-full border-collapse whitespace-nowrap text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 font-medium">Nombre</th>
                    <th className="px-2 py-1.5 font-medium">Etapa</th>
                    {!cohorte ? <th className="px-2 py-1.5 font-medium">Cohorte</th> : null}
                    <th className="px-2 py-1.5 font-medium">Onboarding</th>
                    <th className="px-2 py-1.5 font-medium">Closer</th>
                    <th className="px-2 py-1.5 font-medium">Saldo</th>
                    <th className="px-2 py-1.5 font-medium">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                {filas.map((f) => {
                  const saldo = saldoLegible(
                    f.saldo?.saldo ?? null,
                    f.saldo?.moneda ?? "USD",
                    f.saldo?.sinSaldoPorque,
                  );
                  const href = enlaceConVuelta(`/p/${programa.slug}/deals/${f.dealId}`, origen);
                  const clase = "block px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
                  return (
                    <tr key={f.dealId} className="cursor-pointer border-b hover:bg-muted/50">
                      <td>
                        <Link href={href} className={`${clase} font-medium text-marca-texto`} title={f.email}>
                          {f.nombre ?? f.email}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} tabIndex={-1} className={clase}>
                          <Badge variant={TONO_DE_ETAPA[f.etapa]}>{NOMBRE_DE_ETAPA[f.etapa]}</Badge>
                        </Link>
                      </td>
                      {!cohorte ? (
                        <td>
                          <Link href={href} tabIndex={-1} className={clase}>
                            {f.codigoCohorte ?? "Sin cohorte"}
                          </Link>
                        </td>
                      ) : null}
                      <td>
                        <Link href={href} tabIndex={-1} className={clase}>
                          {f.onboardedAt ? (
                            <Badge variant="exito">
                              <span className="cifra">{fecha(fechaDeInstanteEnBogota(f.onboardedAt))}</span>
                            </Badge>
                          ) : (
                            <Badge variant="alerta">Sin onboarding</Badge>
                          )}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} tabIndex={-1} className={clase}>
                          {f.ownerNombre ?? (f.ownerUserId ? "Closer sin nombre" : "Sin dueño")}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} tabIndex={-1} className={`${clase} cifra`} title={saldo.etiqueta}>
                          {saldo.valor}
                        </Link>
                      </td>
                      <td title={f.acuerdoPago ?? undefined}>
                        <Link href={href} tabIndex={-1} className={clase}>
                          {f.vencido ? (
                            <Badge variant="peligro">
                              Vencida el <span className="cifra">{fecha(f.vencido.fechaLimite)}</span> · <span className="cifra">{num(f.vencido.diasDeAtraso)}</span> días
                            </Badge>
                          ) : f.fechaLimitePago && f.etapa !== "ganado_completo" ? (
                            <span className="text-xs text-muted-foreground">
                              Límite <span className="cifra">{fecha(f.fechaLimitePago)}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </CardContent>
          {filas.length > 0 ? (
            <CardFooter className="shrink-0 flex-col items-stretch gap-1 text-xs text-muted-foreground">
              {totales.porMoneda.map((total) => (
                <div key={total.moneda} className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1">
                  <span>
                    Recaudado{" "}
                    <span className="cifra font-semibold text-foreground">
                      {monto(total.recaudado, total.moneda)}
                    </span>
                  </span>
                  <span>
                    Por cobrar{" "}
                    <span className="cifra font-semibold text-foreground">
                      {monto(total.porCobrar, total.moneda)}
                    </span>
                  </span>
                </div>
              ))}
              {totales.sinValorVendido > 0 ? (
                <p className="text-right text-muted-foreground">
                  <span className="cifra">{num(totales.sinValorVendido)}</span> sin valor vendido
                </p>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      </PantallaFija>
    </PageShell>
  );
}
