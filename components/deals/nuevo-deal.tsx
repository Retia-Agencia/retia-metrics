"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buscarLeadsAccion } from "@/app/(app)/p/[programa]/leads/acciones";
import { crearDeal } from "@/app/(app)/p/[programa]/deals/acciones";
import type { LeadEncontrado } from "@/lib/queries/leads";
import { cn } from "@/lib/utils";

/**
 * "Nuevo deal" (ticket 140, el "Add deals" de HubSpot). Nunca un deal suelto: o se elige
 * un lead del programa, o se crea primero con el alta manual. El deal nace en la etapa de
 * entrada; las rejas (alcance, deal abierto, quien puede crear un lead) son del servidor,
 * esta pantalla solo las explica.
 *
 * El texto de busqueda NO va a la URL (dato personal, AGENTS.md): viaja en el payload de
 * la server action de Leads.
 */

export interface NuevoDealProps {
  programId: string;
  programaSlug: string;
  nombreEtapaDeEntrada: string;
  /** Crear un lead es de quien trabaja leads (ADR 0003): el gerente solo elige uno existente. */
  puedeCrearLead: boolean;
}

type Modo = "existente" | "nuevo";

export function NuevoDeal({ programId, programaSlug, nombreEtapaDeEntrada, puedeCrearLead }: NuevoDealProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>("existente");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<LeadEncontrado[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ correo: "", nombre: "", telefono: "" });
  const [error, setError] = useState<string | null>(null);
  const [dealExistente, setDealExistente] = useState<string | null>(null);
  const [buscando, empezarBusqueda] = useTransition();
  const [creando, empezarCreacion] = useTransition();

  function reiniciar() {
    setModo("existente");
    setTexto("");
    setResultados(null);
    setElegido(null);
    setNuevo({ correo: "", nombre: "", telefono: "" });
    setError(null);
    setDealExistente(null);
  }

  function buscar() {
    const q = texto.trim();
    if (q.length < 2) {
      setError("Escribe al menos 2 caracteres.");
      return;
    }
    setError(null);
    setDealExistente(null);
    empezarBusqueda(async () => {
      const res = await buscarLeadsAccion({ programaSlug, texto: q });
      if (!res.ok) {
        setError(res.error);
        setResultados([]);
        return;
      }
      setResultados(res.leads);
      setElegido(null);
    });
  }

  function crear() {
    setError(null);
    setDealExistente(null);
    const lead =
      modo === "existente"
        ? { tipo: "existente" as const, leadId: elegido ?? "" }
        : { tipo: "nuevo" as const, correo: nuevo.correo, nombre: nuevo.nombre, telefono: nuevo.telefono };
    empezarCreacion(async () => {
      const res = await crearDeal({ programId, lead });
      if (!res.ok) {
        setError(res.error);
        setDealExistente(res.dealExistenteId ?? null);
        return;
      }
      toast.success(res.leadCreado ? "Lead y deal creados." : "Deal creado.");
      setAbierto(false);
      reiniciar();
      router.push(`/p/${programaSlug}/deals/${res.dealId}`);
    });
  }

  const listo = modo === "existente" ? Boolean(elegido) : nuevo.correo.trim().length > 0;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) reiniciar();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus aria-hidden />
        Nuevo deal
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo deal</DialogTitle>
          <DialogDescription>
            Nace en {nombreEtapaDeEntrada}. Todo deal es de un lead: elige uno del programa
            {puedeCrearLead ? " o créalo aquí" : ""}.
          </DialogDescription>
        </DialogHeader>

        {puedeCrearLead ? (
          <div className="flex gap-2" role="group" aria-label="De dónde sale el lead">
            <Button
              type="button"
              size="sm"
              variant={modo === "existente" ? "secondary" : "ghost"}
              aria-pressed={modo === "existente"}
              onClick={() => setModo("existente")}
            >
              Lead existente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={modo === "nuevo" ? "secondary" : "ghost"}
              aria-pressed={modo === "nuevo"}
              onClick={() => setModo("nuevo")}
            >
              Lead nuevo
            </Button>
          </div>
        ) : null}

        {modo === "existente" ? (
          <div className="min-w-0 space-y-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                buscar();
              }}
            >
              <div className="flex-1 space-y-1">
                <label htmlFor="nuevo-deal-q" className="block text-xs font-medium text-muted-foreground">
                  Nombre o correo del lead
                </label>
                <Input
                  id="nuevo-deal-q"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Al menos 2 caracteres"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={buscando || texto.trim().length < 2}>
                {buscando ? "Buscando…" : "Buscar"}
              </Button>
            </form>

            {resultados && resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningún lead de este programa coincide.
                {puedeCrearLead ? " Créalo en «Lead nuevo»." : ""}
              </p>
            ) : null}

            {resultados && resultados.length > 0 ? (
              <ul className="divide-y rounded-lg border" role="listbox" aria-label="Leads encontrados">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={elegido === p.id}
                      onClick={() => setElegido(p.id)}
                      className={cn(
                        "flex w-full min-w-0 flex-col items-start px-3 py-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        elegido === p.id && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="w-full truncate font-medium">{p.nombre ?? p.emailNormalizado}</span>
                      {p.nombre ? (
                        <span className="w-full truncate text-xs text-muted-foreground">{p.emailNormalizado}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <label htmlFor="nuevo-deal-correo" className="block text-xs font-medium text-muted-foreground">
                Correo
              </label>
              <Input
                id="nuevo-deal-correo"
                type="email"
                required
                value={nuevo.correo}
                onChange={(e) => setNuevo((n) => ({ ...n, correo: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="nuevo-deal-nombre" className="block text-xs font-medium text-muted-foreground">
                Nombre (opcional)
              </label>
              <Input
                id="nuevo-deal-nombre"
                value={nuevo.nombre}
                maxLength={120}
                onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="nuevo-deal-telefono" className="block text-xs font-medium text-muted-foreground">
                Teléfono (opcional)
              </label>
              <Input
                id="nuevo-deal-telefono"
                value={nuevo.telefono}
                maxLength={40}
                onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Si el correo ya es de un lead del programa, se usa ese lead.
            </p>
          </div>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}{" "}
            {dealExistente ? (
              <Link
                href={`/p/${programaSlug}/deals/${dealExistente}`}
                className="font-medium text-marca-texto underline underline-offset-4"
              >
                Abrir el deal existente
              </Link>
            ) : null}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={creando}>
            Cancelar
          </Button>
          <Button type="button" onClick={crear} disabled={creando || !listo}>
            {creando ? "Creando…" : "Crear deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
