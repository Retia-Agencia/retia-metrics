"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { etiquetaDeRol, puedeConfigurarOperaComoCloser, ROLES, tieneAlcanceConfigurable, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { fecha, fechaDeInstanteEnBogota } from "@/lib/format";
import { clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
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

export interface UsuarioVista {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  operaComoCloser: boolean;
  closerId: string | null;
  calendlyEmail: string | null;
  activo: boolean;
  /** Programas donde tiene membresia activa. */
  programas: string[];
  /** Alcance explicito de un gerente o paid trafficker; vacio = todos. */
  programasQueVe: string[];
  /** Instante de creacion, ISO. */
  creadoEn: string;
}

type FiltroPrograma = "todos" | "sin_programa" | (string & {});
type FiltroEstado = "activos" | "inactivos" | "todos";

const POR_PAGINA = 25;

/** Programas de un usuario: membresias, o su alcance si el rol lo configura (vacio = todos). */
function programasDe(u: UsuarioVista, todos: ProgramaParaAlcance[]): { ids: string[]; todos: boolean } {
  if (tieneAlcanceConfigurable(u.rol)) {
    return u.programasQueVe.length === 0
      ? { ids: todos.map((p) => p.id), todos: true }
      : { ids: u.programasQueVe, todos: false };
  }
  return { ids: u.programas, todos: false };
}

interface ProgramaParaAlcance {
  id: string;
  nombre: string;
}

interface Borrador {
  email: string;
  nombre: string;
  rol: Rol;
  operaComoCloser: boolean;
  closerId: string;
  calendlyEmail: string;
  alcance: "todos" | "solo";
  programasQueVe: string[];
  /** Membresias iniciales: solo se piden al crear (despues se manejan en la tab Programa). */
  membresias: string[];
}

const BORRADOR_VACIO: Borrador = {
  email: "",
  nombre: "",
  rol: "closer",
  operaComoCloser: false,
  closerId: "",
  calendlyEmail: "",
  alcance: "todos",
  programasQueVe: [],
  membresias: [],
};

function aBorrador(u: UsuarioVista): Borrador {
  return {
    email: u.email,
    nombre: u.nombre ?? "",
    rol: u.rol,
    operaComoCloser: u.operaComoCloser,
    closerId: u.closerId ?? "",
    calendlyEmail: u.calendlyEmail ?? "",
    alcance: u.programasQueVe.length > 0 ? "solo" : "todos",
    programasQueVe: u.programasQueVe,
    membresias: [],
  };
}

export function UsuariosAdmin({
  usuarios,
  usuarioActualId,
  programas,
  puedeEditarAlcance,
}: {
  usuarios: UsuarioVista[];
  usuarioActualId: string;
  programas: ProgramaParaAlcance[];
  puedeEditarAlcance: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [programa, setPrograma] = useState<FiltroPrograma>("todos");
  const [rol, setRol] = useState<Rol | "todos">("todos");
  const [estado, setEstado] = useState<FiltroEstado>("activos");
  const [pagina, setPagina] = useState(1);
  const [aDesactivar, setADesactivar] = useState<UsuarioVista | null>(null);
  const usuarioEditado = usuarios.find((u) => u.id === editando) ?? null;
  const nombrePrograma = useMemo(() => new Map(programas.map((p) => [p.id, p.nombre])), [programas]);

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

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios
      .filter((u) => {
        if (estado !== "todos" && u.activo !== (estado === "activos")) return false;
        if (rol !== "todos" && u.rol !== rol) return false;
        if (q && !`${u.nombre ?? ""} ${u.email}`.toLowerCase().includes(q)) return false;
        const { ids } = programasDe(u, programas);
        if (programa === "sin_programa") return ids.length === 0;
        if (programa !== "todos") return ids.includes(programa);
        return true;
      })
      .sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return (a.nombre ?? a.email).localeCompare(b.nombre ?? b.email, "es");
      });
  }, [usuarios, programas, busqueda, programa, rol, estado]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const claseFiltro =
    "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  const cambiar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => cambiar(setBusqueda)(e.target.value)}
              placeholder="Buscar por nombre o correo"
              aria-label="Buscar usuario"
              className={cn(claseFiltro, "w-full pl-8")}
            />
          </label>
          <select
            value={programa}
            onChange={(e) => cambiar(setPrograma)(e.target.value)}
            aria-label="Filtrar por programa"
            className={claseFiltro}
          >
            <option value="todos">Todos los programas</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
            <option value="sin_programa">Sin programa</option>
          </select>
          <select
            value={rol}
            onChange={(e) => cambiar(setRol)(e.target.value as Rol | "todos")}
            aria-label="Filtrar por rol"
            className={claseFiltro}
          >
            <option value="todos">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{etiquetaDeRol(r)}</option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => cambiar(setEstado)(e.target.value as FiltroEstado)}
            aria-label="Filtrar por estado"
            className={claseFiltro}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtrados.length} de {usuarios.length}
          </span>
          <Button size="sm" disabled={pendiente} onClick={() => setCreando(true)}>
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        </div>

        <Dialog open={creando} onOpenChange={(abierto) => !abierto && setCreando(false)}>
          <DialogContent className="max-w-xl">
            {creando ? (
              <FormularioUsuario
                titulo="Nuevo usuario"
                inicial={BORRADOR_VACIO}
                pendiente={pendiente}
                programas={programas}
                puedeEditarAlcance={false}
                onCancelar={() => setCreando(false)}
                onGuardar={(borrador) =>
                  correr(() => crearUsuarioAccion(aEntrada(borrador, true)), "Usuario creado", () =>
                    setCreando(false),
                  )
                }
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={usuarioEditado !== null} onOpenChange={(abierto) => !abierto && setEditando(null)}>
          <DialogContent className="max-w-xl">
            {usuarioEditado ? (
              <FormularioUsuario
                key={usuarioEditado.id}
                titulo={`Editar ${usuarioEditado.nombre ?? usuarioEditado.email}`}
                inicial={aBorrador(usuarioEditado)}
                pendiente={pendiente}
                programas={programas}
                puedeEditarAlcance={puedeEditarAlcance}
                emailBloqueado
                onCancelar={() => setEditando(null)}
                onGuardar={(borrador) =>
                  correr(
                    () => editarUsuarioAccion(
                      usuarioEditado.id,
                      aEntrada(borrador, false),
                      puedeEditarAlcance && tieneAlcanceConfigurable(borrador.rol)
                        ? borrador.alcance === "todos" ? null : borrador.programasQueVe
                        : undefined,
                    ),
                    "Usuario actualizado",
                    () => setEditando(null),
                  )
                }
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={aDesactivar !== null} onOpenChange={(abierto) => !abierto && setADesactivar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desactivar usuario</DialogTitle>
              <DialogDescription>
                {aDesactivar?.nombre ?? aDesactivar?.email} no podrá entrar al CRM hasta que lo reactives.
                Su historial no se borra.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setADesactivar(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pendiente}
                onClick={() => {
                  if (!aDesactivar) return;
                  correr(() => desactivarUsuarioAccion(aDesactivar.id), "Usuario desactivado", () =>
                    setADesactivar(null),
                  );
                }}
              >
                Desactivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className={clasesDeZonaConScroll("space-y-6")}>
        <ul className="divide-y rounded-md border">
          {visibles.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              {usuarios.length === 0 ? "Todavía no hay usuarios." : "Ningún usuario coincide con los filtros."}
            </li>
          ) : (
            visibles.map((u) => (
            <li key={u.id} className={cn("px-3 py-3 text-sm", !u.activo && "opacity-50")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{u.nombre ?? u.email}</span>
                      <Badge variant={u.rol === "gerente" ? "secondary" : "outline"}>
                        {etiquetaDeRol(u.rol)}
                      </Badge>
                      {!u.activo ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          inactivo
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.email} · entró el {fecha(fechaDeInstanteEnBogota(u.creadoEn))}
                    </span>
                    <ProgramasDelUsuario usuario={u} programas={programas} nombres={nombrePrograma} />
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
                          onClick={() => setADesactivar(u)}
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
            </li>
            ))
          )}
        </ul>
        {paginas > 1 ? (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
              Anterior
            </Button>
            <span>Página {paginaActual} de {paginas}</span>
            <Button size="sm" variant="ghost" disabled={paginaActual >= paginas} onClick={() => setPagina(paginaActual + 1)}>
              Siguiente
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProgramasDelUsuario({
  usuario,
  programas,
  nombres,
}: {
  usuario: UsuarioVista;
  programas: ProgramaParaAlcance[];
  nombres: Map<string, string>;
}) {
  const { ids, todos } = programasDe(usuario, programas);
  if (todos) {
    return <span className="mt-1 block text-xs text-muted-foreground">Ve todos los programas</span>;
  }
  if (ids.length === 0) {
    return <span className="mt-1 block text-xs text-muted-foreground">Sin programa</span>;
  }
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {ids.map((id) => (
        <Badge key={id} variant="outline">{nombres.get(id) ?? "Programa"}</Badge>
      ))}
    </span>
  );
}

/** Convierte el borrador del formulario a la entrada que espera la server action. */
function aEntrada(b: Borrador, alCrear: boolean) {
  return {
    // Las membresias solo se mandan al crear; editar las deja intactas (tab Programa).
    ...(alCrear && trabajaLeads(b) ? { programas: b.membresias } : {}),
    email: b.email,
    nombre: b.nombre,
    rol: b.rol,
    operaComoCloser: b.operaComoCloser,
    closerId: b.closerId,
    calendlyEmail: b.calendlyEmail,
  };
}

function FormularioUsuario({
  titulo,
  inicial,
  pendiente,
  programas,
  puedeEditarAlcance,
  emailBloqueado,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: Borrador;
  pendiente: boolean;
  programas: ProgramaParaAlcance[];
  puedeEditarAlcance: boolean;
  emailBloqueado?: boolean;
  onCancelar: () => void;
  onGuardar: (borrador: Borrador) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  // El closer_id ya no se captura: el borrador lo conserva tal cual para que editar
  // otro campo no lo borre de la fila.
  const muestraAlcance = Boolean(emailBloqueado && puedeEditarAlcance && tieneAlcanceConfigurable(borrador.rol));
  const alcanceInvalido = muestraAlcance && borrador.alcance === "solo" && borrador.programasQueVe.length === 0;

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{titulo}</DialogTitle>
      </DialogHeader>
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
              {/* Las opciones salen de ROLES: sumar un rol no vuelve a tocar esta pantalla. */}
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {etiquetaDeRol(r)}
                </option>
              ))}
            </select>
          </label>

          {puedeConfigurarOperaComoCloser(borrador.rol) ? (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="block text-muted-foreground">Opera como closer</span>
                <span className="block text-xs text-muted-foreground">
                  Puede trabajar leads sin cambiar de rol.
                </span>
              </span>
              <Switch
                checked={borrador.operaComoCloser}
                onCheckedChange={(operaComoCloser) =>
                  setBorrador({ ...borrador, operaComoCloser })
                }
                aria-label="Opera como closer"
              />
            </label>
          ) : null}

          {!emailBloqueado && trabajaLeads(borrador) ? (
            <fieldset className="space-y-2 rounded-lg border border-border p-3 sm:col-span-2">
              <legend className="px-1 text-sm text-muted-foreground">Programas donde trabaja</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {programas.map((programa) => (
                  <label key={programa.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={borrador.membresias.includes(programa.id)}
                      onChange={(evento) => setBorrador({
                        ...borrador,
                        membresias: evento.target.checked
                          ? [...borrador.membresias, programa.id]
                          : borrador.membresias.filter((id) => id !== programa.id),
                      })}
                    />
                    {programa.nombre}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                La cuenta de Calendly se vincula después, en la tab Programa.
              </p>
            </fieldset>
          ) : null}

          {muestraAlcance ? (
            <fieldset className="space-y-2 rounded-lg border border-border p-3 sm:col-span-2">
              <legend className="px-1 text-sm text-muted-foreground">Programas que ve</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`alcance-${borrador.email}`}
                    checked={borrador.alcance === "todos"}
                    onChange={() => setBorrador({ ...borrador, alcance: "todos" })}
                  />
                  Todos
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`alcance-${borrador.email}`}
                    checked={borrador.alcance === "solo"}
                    onChange={() => setBorrador({ ...borrador, alcance: "solo" })}
                  />
                  Solo estos
                </label>
              </div>
              {borrador.alcance === "solo" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {programas.map((programa) => (
                    <label key={programa.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={borrador.programasQueVe.includes(programa.id)}
                        onChange={(evento) => setBorrador({
                          ...borrador,
                          programasQueVe: evento.target.checked
                            ? [...borrador.programasQueVe, programa.id]
                            : borrador.programasQueVe.filter((id) => id !== programa.id),
                        })}
                      />
                      {programa.nombre}
                    </label>
                  ))}
                </div>
              ) : null}
              {alcanceInvalido ? (
                <p className="text-xs text-muted-foreground">Elige al menos un programa.</p>
              ) : null}
            </fieldset>
          ) : null}

          {/* La cuenta de Calendly es de cada membresia (ticket 096): se vincula en la tab Programa. */}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pendiente || !borrador.email.trim() || alcanceInvalido}>
              Guardar
            </Button>
          </div>
        </form>
    </>
  );
}
