"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarTokenMetaAccion } from "./acciones";

export function ConexionMeta() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        startTransition(async () => {
          const resultado = await guardarTokenMetaAccion(token);
          if (!resultado.ok) {
            toast.error("No se pudo conectar Meta", { description: resultado.error });
            return;
          }
          setToken("");
          toast.success(
            `Conectada como ${resultado.nombre}, ve ${resultado.cuentasVisibles} cuentas`,
          );
          router.refresh();
        });
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Token del usuario del sistema</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={token}
          onChange={(evento) => setToken(evento.target.value)}
          aria-label="Token de Meta"
          placeholder="Pega un token para probarlo y guardarlo"
        />
      </label>
      <Button type="submit" disabled={pendiente || !token.trim()}>
        {pendiente ? "Probando…" : "Probar y guardar"}
      </Button>
    </form>
  );
}
