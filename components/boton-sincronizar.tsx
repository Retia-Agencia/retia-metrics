"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BotonSincronizar({ programa }: { programa: string }) {
  const router = useRouter();
  const [corriendo, setCorriendo] = useState(false);
  const [, startTransition] = useTransition();

  async function sincronizar() {
    setCorriendo(true);
    try {
      const res = await fetch(`/api/sync/${programa}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error("No se pudo sincronizar", { description: data.error, duration: 12000 });
        return;
      }

      const r = data.resultado;
      toast.success(`${r.personasEnHoja} personas`, {
        description:
          `${r.filasLeidas} filas leídas · ${r.nuevas} nuevas · ` +
          `${r.actualizadas} actualizadas · ${r.cambiosRegistrados} cambios registrados`,
        duration: 8000,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error("Falló la conexión", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={sincronizar} disabled={corriendo}>
      <RefreshCw className={corriendo ? "size-4 animate-spin" : "size-4"} />
      {corriendo ? "Sincronizando…" : "Sincronizar ahora"}
    </Button>
  );
}
