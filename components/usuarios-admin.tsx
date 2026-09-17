"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  crearUsuarioAccion,
  desactivarUsuarioAccion,
  editarUsuarioAccion,
  reactivarUsuarioAccion,
  type ResultadoAccion,
} from "@/app/(app)/ajustes/usuarios/acciones";

/**
 * Administracion de usuarios y closers (ticket 015), solo gerente.
 *
 * Lista los usuarios (activos e inactivos, estos ultimos atenuados), permite crear,
 * editar, desactivar y reactivar. Los programas de los checkboxes llegan como dato
 * desde la base (no hay ningun literal de programa aca — ADR 0012). Las mutaciones
 * son server actions que ya enforzan `requireRole("gerente")` en el servidor.
 */

export interface ProgramaOpcion {
  id: string;
  nombre: string;
}

export interface UsuarioVista {
  id: string;
  email: string;
  nombre: string | null;
  rol: "gerente" | "closer";
  closerId: string | null;
  calendlyEmail: string | null;
  activo: boolean;
  programas: string[];
}

interface Borrador {
  email: string;
  nombre: string;
  rol: "gerente" | "closer";
  closerId: string;
  calendlyEmail: string;
  programas: string[];
}

const BORRADOR_VACIO: Borrador = {
  email: "",
  nombre: "",
  rol: "closer",
  closerId: "",
  calendlyEmail: "",
  programas: [],
};

function aBorrador(u: UsuarioVista): Borrador {
  return {
    email: u.email,
    nombre: u.nombre ?? "",
    rol: u.rol,
    closerId: u.closerId ?? "",
    calendlyEmail: u.calendlyEmail ?? "",
    programas: [...u.programas],
  };
}

export function UsuariosAdmin({
  usuarios,
  programas,
  usuarioActualId,
}: {
  usuarios: UsuarioVista[];
  programas: ProgramaOpcion[];
  usuarioActualId: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  function correr(accion: () => Promise<ResultadoAccion>, exito: string, alExito?: () => void) {
    startTransition(async () => {
      const res = await accion();
      if (res.ok) {
        toast.success(exito);
        alExito?.();
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    });
  }

  const ordenados = [...usuarios].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.email.localeCompare(b.email, "es");
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" disabled={pendiente || creando} onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {creando ? (
        <FormularioUsuario
          titulo="Nuevo usuario"
          inicial={BORRADOR_VACIO}
          programas={programas}
          pendiente={pendiente}
          onCancelar={() => setCreando(false)}
          onGuardar={(borrador) =>
            correr(() => crearUsuarioAccion(aEntrada(borrador)), "Usuario creado", () =>
              setCreando(false),
            )
          }
        />
      ) : null}

      <ul className="divide-y rounded-md border">
        {ordenados.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">Todavía no hay usuarios.</li>
        ) : (
          ordenados.map((u) => (
            <li key={u.id} className={cn("px-3 py-3 text-sm", !u.activo && "opacity-50")}>
              {editando === u.id ? (
                <FormularioUsuario
                  titulo={`Editar ${u.email}`}
                  inicial={aBorrador(u)}
                  programas={programas}
                  pendiente={pendiente}
                  emailBloqueado
                  onCancelar={() => setEditando(null)}
                  onGuardar={(borrador) =>
                    correr(
                      () => editarUsuarioAccion(u.id, aEntrada(borrador)),
                      "Usuario actualizado",
                      () => setEditando(null),
                    )
                  }
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{u.nombre ?? u.email}</span>
                      <Badge variant={u.rol === "gerente" ? "secondary" : "outline"}>
                        {u.rol}
                      </Badge>
                      {!u.activo ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          inactivo
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.email}
                      {u.closerId ? ` · closer_id: ${u.closerId}` : ""}
                      {u.programas.length > 0
                        ? ` · ${u.programas.length} programa(s)`
                        : ""}
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    {u.activo ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendiente}
                          onClick={() => setEditando(u.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendiente || u.id === usuarioActualId}
                          title={
                            u.id === usuarioActualId ? "No puedes desactivarte a ti mismo." : undefined
                          }
                          onClick={() =>
                            correr(() => desactivarUsuarioAccion(u.id), "Usuario desactivado")
                          }
                        >
                          Desactivar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendiente}
                        onClick={() => correr(() => reactivarUsuarioAccion(u.id), "Usuario reactivado")}
                      >
                        <RotateCcw className="size-4" />
                        Reactivar
                      </Button>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Convierte el borrador del formulario a la entrada que espera la server action. */
function aEntrada(b: Borrador) {
  return {
    email: b.email,
    nombre: b.nombre,
    rol: b.rol,
    closerId: b.closerId,
    calendlyEmail: b.calendlyEmail,
    programas: b.programas,
  };
}

function FormularioUsuario({
  titulo,
  inicial,
  programas,
  pendiente,
  emailBloqueado,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: Borrador;
  programas: ProgramaOpcion[];
  pendiente: boolean;
  emailBloqueado?: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const esCloser = borrador.rol === "closer";

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  function alternarPrograma(id: string) {
    setBorrador((b) => ({
      ...b,
      programas: b.programas.includes(id)
        ? b.programas.filter((p) => p !== id)
        : [...b.programas, id],
    }));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onCancelar} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(borrador);
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Correo</span>
            <input
              type="email"
              value={borrador.email}
              onChange={(e) => setBorrador({ ...borrador, email: e.target.value })}
              disabled={emailBloqueado}
              required
              className={claseInput}
              aria-label="Correo"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Nombre</span>
            <input
              value={borrador.nombre}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              maxLength={120}
              className={claseInput}
              aria-label="Nombre"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Rol</span>
            <select
              value={borrador.rol}
              onChange={(e) =>
                setBorrador({ ...borrador, rol: e.target.value as Borrador["rol"] })
              }
              className={claseInput}
              aria-label="Rol"
            >
              <option value="closer">closer</option>
              <option value="gerente">gerente</option>
            </select>
          </label>

          {esCloser ? (
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">closer_id (en la BBDD)</span>
              <input
                value={borrador.closerId}
                onChange={(e) => setBorrador({ ...borrador, closerId: e.target.value })}
                maxLength={80}
                className={claseInput}
                aria-label="closer_id"
              />
            </label>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Correo de Calendly (opcional)</span>
            <input
              type="email"
              value={borrador.calendlyEmail}
              onChange={(e) => setBorrador({ ...borrador, calendlyEmail: e.target.value })}
              className={claseInput}
              aria-label="Correo de Calendly"
            />
          </label>

          {esCloser ? (
            <fieldset className="space-y-1 text-sm sm:col-span-2">
              <legend className="text-muted-foreground">Programas donde vende</legend>
              {programas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay programas activos. Crea uno antes de asignar closers.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {programas.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={borrador.programas.includes(p.id)}
                        onChange={() => alternarPrograma(p.id)}
                        className="size-4 rounded border-border"
                      />
                      <span>{p.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pendiente || !borrador.email.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
