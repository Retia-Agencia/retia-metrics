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
import { fecha, fechaDeInstanteEnBogota, num, saldoLegible } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";

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
 * Un estudiante es un deal vigente en Abonado o Completo (ticket 063); la cohorte define la
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

  const completos = filas.filter((f) => f.etapa === "completo").length;
  const sinOnboarding = filas.filter((f) => f.onboardedAt == null).length;
  const vencidos = filas.filter((f) => f.vencido != null).length;
  const control =
    "h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <PageShell titulo={programa.nombre} descripcion="Students">
      <div className="space-y-4">
        <form className="grid gap-3 rounded-xl bg-card p-4 shadow-tarjeta sm:grid-cols-3" method="get">
          <label className="grid gap-1 text-sm">
            Cohorte
            <select name="cohorte" defaultValue={cohorte?.id ?? "todas"} className={control}>
              <option value="todas">Todas las cohortes</option>
              {cohortes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                  {c.estado === "activo" ? " (activa)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Onboarding
            <select name="onboarding" defaultValue={filtro.onboarded ?? ""} className={control}>
              <option value="">Todos</option>
              <option value="no">Sin onboarding</option>
              <option value="si">Con onboarding</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              type="submit"
            >
              Filtrar
            </button>
          </div>
        </form>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi etiqueta="Estudiantes" valor={filas.length} />
          <Kpi etiqueta="Completos" valor={completos} />
          <Kpi etiqueta="Sin onboarding" valor={sinOnboarding} />
          <Kpi etiqueta="En cartera vencida" valor={vencidos} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {cohorte ? `Cohorte ${cohorte.codigo}` : "Todas las cohortes"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {cohortes.length === 0
                  ? "Este programa no tiene cohortes todavía. Créalas en Ajustes → Programas y cohortes."
                  : "No hay estudiantes con estos filtros. Un deal aparece aquí cuando entra en Abonado o Completo."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filas.map((f) => {
                  const saldo = f.saldo ? saldoLegible(f.saldo.saldo, f.saldo.moneda ?? "USD") : null;
                  return (
                    <li key={f.dealId} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/p/${programa.slug}/deals/${f.dealId}`}
                          className="block truncate font-medium text-marca-texto underline-offset-2 outline-none hover:underline focus-visible:underline"
                        >
                          {f.nombre ?? f.email}
                        </Link>
                        {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={TONO_DE_ETAPA[f.etapa]}>{NOMBRE_DE_ETAPA[f.etapa]}</Badge>
                          {!cohorte ? <Badge variant="neutro">{f.codigoCohorte ?? "Sin cohorte"}</Badge> : null}
                          {f.onboardedAt ? (
                            <Badge variant="exito">Onboarding {fecha(fechaDeInstanteEnBogota(f.onboardedAt))}</Badge>
                          ) : (
                            <Badge variant="alerta">Sin onboarding</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{f.ownerNombre ?? (f.ownerUserId ? "Closer sin nombre" : "Sin dueño")}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{saldo?.etiqueta ?? "Saldo pendiente"}</p>
                        <p className="cifra">{saldo?.valor ?? "sin precio de contrato registrado"}</p>
                      </div>
                      <div className="space-y-1">
                        {f.vencido ? (
                          <Badge variant="peligro">
                            Vencida el {fecha(f.vencido.fechaLimite)} · <span className="cifra">{num(f.vencido.diasDeAtraso)}</span> días
                          </Badge>
                        ) : f.fechaLimitePago ? (
                          <p className="text-xs text-muted-foreground">Fecha límite {fecha(f.fechaLimitePago)}</p>
                        ) : null}
                        {f.acuerdoPago ? <p className="text-xs whitespace-pre-line">{f.acuerdoPago}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className="cifra text-2xl font-semibold">{num(valor)}</p>
      </CardContent>
    </Card>
  );
}
