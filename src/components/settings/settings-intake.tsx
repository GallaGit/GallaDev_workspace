"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { IntakeSettings } from "@/lib/intake/types";

async function fetchIntake(): Promise<IntakeSettings> {
  const res = await fetch("/api/settings/intake");
  const data = (await res.json()) as IntakeSettings & { error?: string };
  if (!res.ok) throw new Error(data.error || "No se pudo cargar captación");
  return data;
}

/** datetime-local value from ISO (Europe/Berlin wall clock approximation via local). */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function SettingsIntake() {
  const query = useQuery({
    queryKey: ["settings", "intake"],
    queryFn: fetchIntake,
  });

  if (query.isPending) {
    return <p className="text-sm text-(--muted-fg)">Cargando captación…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="text-sm text-red-400">
        {query.error instanceof Error
          ? query.error.message
          : "No se pudo cargar captación"}
      </p>
    );
  }

  return <IntakeForm initial={query.data} />;
}

function IntakeForm({ initial }: { initial: IntakeSettings }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [message, setMessage] = useState(initial.message);
  const [reopensLocal, setReopensLocal] = useState(
    toDatetimeLocalValue(initial.reopensAt),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsOpen(initial.isOpen);
    setMessage(initial.message);
    setReopensLocal(toDatetimeLocalValue(initial.reopensAt));
  }, [initial]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOpen,
          message,
          reopensAt: fromDatetimeLocalValue(reopensLocal),
        }),
      });
      const data = (await res.json()) as IntakeSettings & {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok) {
        const first = data.fieldErrors
          ? Object.values(data.fieldErrors)[0]
          : data.error;
        throw new Error(first || "No se pudo guardar");
      }
      queryClient.setQueryData(["settings", "intake"], data);
      setIsOpen(data.isOpen);
      setMessage(data.message);
      setReopensLocal(toDatetimeLocalValue(data.reopensAt));
      toast.success(
        data.isOpen ? "Captación abierta" : "Captación pausada",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-(--border) bg-(--panel) p-4">
      <div>
        <h2 className="text-[13px] font-medium tracking-tight">
          Captación (landing)
        </h2>
        <p className="text-[11px] text-(--muted-fg)">
          Controla si galladev.com acepta leads. Persistido en Supabase (no en
          el fichero local). Si pausas, la landing muestra el mensaje y la
          cuenta atrás hasta la fecha de reapertura. No hay lista de espera.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-(--border) bg-(--bg) px-3 py-2">
        <div>
          <p className="text-sm font-medium">
            {isOpen ? "Abierta" : "Pausada"}
          </p>
          <p className="text-[11px] text-(--muted-fg)">
            {isOpen
              ? "El formulario de la landing está activo."
              : "La landing muestra mensaje + countdown."}
          </p>
        </div>
        <Switch
          id="intake-open"
          label={isOpen ? "Abierta" : "Pausada"}
          checked={isOpen}
          onCheckedChange={setIsOpen}
          disabled={saving}
        />
      </div>

      {!isOpen ? (
        <>
          <div>
            <label
              htmlFor="intake-message"
              className="mb-1 block text-[11px] font-medium text-(--muted-fg)"
            >
              Mensaje (pausada)
            </label>
            <Textarea
              id="intake-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={saving}
              placeholder="La captación está pausada. Reabrimos el {fecha}."
            />
            <p className="mt-1 text-[11px] text-(--muted-fg)">
              Usa {"{fecha}"} para insertar la fecha/hora de reapertura
              formateada.
            </p>
          </div>
          <div>
            <label
              htmlFor="intake-reopens"
              className="mb-1 block text-[11px] font-medium text-(--muted-fg)"
            >
              Reabre el
            </label>
            <Input
              id="intake-reopens"
              type="datetime-local"
              value={reopensLocal}
              onChange={(e) => setReopensLocal(e.target.value)}
              disabled={saving}
            />
            <p className="mt-1 text-[11px] text-(--muted-fg)">
              Cuando llegue esta fecha, el endpoint público pasa a{" "}
              <code>open: true</code> automáticamente.
            </p>
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar captación"}
        </Button>
      </div>
    </section>
  );
}
