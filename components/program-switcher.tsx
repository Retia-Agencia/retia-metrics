"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { crearProgramaInactivoAccion } from "@/app/(app)/ajustes/programas/acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RUTA_DASHBOARD_TODOS,
  VALOR_PROGRAMA_TODOS,
  rutaAlCambiarDePrograma,
} from "@/lib/nav";

type Programa = { slug: string; nombre: string };

/**
 * El selector de programa, arriba de la barra (ADR 0050, ticket 097). Los programas
 * nunca se suman ni se promedian entre si, asi que se navega de uno a otro: elegir otro
 * cambia la URL y mantiene la tab (`rutaAlCambiarDePrograma`). La lista llega ya acotada
 * al alcance de la sesion (ADR 0048) y como dato (ADR 0012): este componente no conoce
 * ningun programa. Ofrecer solo los visibles es comodidad; la reja es el 404 de la ruta.
 */
export function ProgramSwitcher({
  programas,
  actual,
  inactivos,
  puedeCrear,
}: {
  programas: readonly Programa[];
  inactivos: readonly Programa[];
  puedeCrear: boolean;
  /** El programa de la URL, o el que abren las tabs de programa si la ruta no tiene uno. */
  actual: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [nuevo, setNuevo] = useState({ nombre: "", slug: "", ticketUsd: "" });

  const ofreceTodos = programas.length >= 2;
  const enTodos = pathname === RUTA_DASHBOARD_TODOS || pathname.startsWith(`${RUTA_DASHBOARD_TODOS}/`);
  const seleccionado = ofreceTodos && enTodos ? VALOR_PROGRAMA_TODOS : actual;
  const items = [
    ...(ofreceTodos ? [{ value: VALOR_PROGRAMA_TODOS, label: "Todos los programas" }] : []),
    ...programas.map((p) => ({ value: p.slug, label: p.nombre })),
    ...inactivos.map((p) => ({ value: p.slug, label: `${p.nombre} (inactivo)` })),
  ];
  const slugsInactivos = new Set(inactivos.map((programa) => programa.slug));

  if (items.length === 0 && !puedeCrear) return null;

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <Select
          value={seleccionado}
          // Sin `items`, Base UI pinta el VALOR (el slug) en el trigger, no el nombre.
          items={items}
          onValueChange={(slug) => {
            if (typeof slug !== "string" || slug === seleccionado) return;
            router.push(
              slugsInactivos.has(slug)
                ? `/p/${slug}/programa`
                : rutaAlCambiarDePrograma(pathname, slug),
            );
          }}
        >
          <SelectTrigger className="w-full" aria-label="Programa">
            <SelectValue placeholder="Selecciona un programa" />
          </SelectTrigger>
          <SelectContent>
            {ofreceTodos ? (
              <SelectItem value={VALOR_PROGRAMA_TODOS}>Todos los programas</SelectItem>
            ) : null}
            {programas.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.nombre}
              </SelectItem>
            ))}
            {inactivos.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.nombre} (inactivo)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {puedeCrear ? (
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button size="sm" variant="outline" className="w-full" />}>
            <Plus />
            Nuevo programa
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Nuevo programa</DialogTitle>
            <DialogDescription>
              Se crea inactivo. Completa Formularios y Calendly en su ficha antes de activarlo.
            </DialogDescription>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const resultado = await crearProgramaInactivoAccion(nuevo);
                  if (!resultado.ok) {
                    toast.error("No se pudo crear", { description: resultado.error });
                    return;
                  }
                  setAbierto(false);
                  router.push(`/p/${resultado.slug}/programa`);
                  router.refresh();
                });
              }}
            >
              {[
                ["nombre", "Nombre"],
                ["slug", "Slug"],
                ["ticketUsd", "Ticket (USD)"],
              ].map(([campo, etiqueta]) => (
                <label key={campo} className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{etiqueta}</span>
                  <Input
                    value={nuevo[campo as keyof typeof nuevo]}
                    onChange={(event) => setNuevo({ ...nuevo, [campo]: event.target.value })}
                    required
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={pendiente}>
                  Crear
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
