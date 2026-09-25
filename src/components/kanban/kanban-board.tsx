"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/domain/lead";
import { useSessionAccess } from "@/components/session-access";
import { statusColor, useUiStore } from "@/store/ui-store";
import { motionPresets } from "@/lib/motion/presets";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

async function patchStatus(id: string, status: LeadStatus): Promise<Lead> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar estado");
  return data.lead as Lead;
}

interface KanbanCardProps {
  lead: Lead;
  draggingId: string | null;
  canWrite: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({
  lead,
  draggingId,
  canWrite,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  const reduced = useReducedMotion();
  const isDragging = draggingId === lead.id;

  return (
    <motion.div
      layout
      layoutId={lead.id}
      draggable={canWrite}
      onDragStart={() => {
        if (!canWrite) return;
        onDragStart(lead.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        canWrite ? "cursor-grab" : "cursor-pointer",
        "rounded-lg border border-gris-200 dark:border-gris-700",
        "bg-blanco dark:bg-gris-800 p-3 text-left",
        "active:cursor-grabbing transition-shadow duration-150",
        isDragging ? "opacity-50 shadow-xl z-50 ring-2 ring-rojo" : "hover:shadow-md",
      )}
      initial={reduced ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
      animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.96 }}
      transition={reduced ? { duration: 0 } : motionPresets.cardEnter.transition}
      whileDrag={{ boxShadow: "var(--shadow-xl)", zIndex: 100 }}
    >
      <div className="flex items-start gap-1">
        <span className="line-clamp-2 flex-1 text-sm font-medium leading-snug text-grafito dark:text-gris-100">
          {lead.companyName}
        </span>
        {lead.favorite && (
          <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorito" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gris-500 dark:text-gris-400">
        <span className="truncate">{lead.cityCanonical ?? lead.city ?? "—"}</span>
        <span className="tabular-nums font-mono">
          {lead.score != null ? lead.score : "—"}
        </span>
      </div>
      {lead.email && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gris-500 dark:text-gris-400">
          <span className="truncate">{lead.email}</span>
        </div>
      )}
    </motion.div>
  );
}

interface DropIndicatorProps {
  isOver: boolean;
}

function DropIndicator({ isOver }: DropIndicatorProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="h-1 w-full rounded-full bg-rojo/20"
      initial={reduced ? undefined : { opacity: 0, scaleX: 0 }}
      animate={{ opacity: isOver ? 1 : 0, scaleX: isOver ? 1 : 0 }}
      exit={{ opacity: 0, scaleX: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      style={{ transformOrigin: "center" }}
      aria-hidden="true"
    />
  );
}

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  overStatus: LeadStatus | null;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, status: LeadStatus) => void;
  onDragLeave: () => void;
  onMoveLead: (leadId: string, status: LeadStatus) => void;
  onOpenLead: (lead: Lead) => void;
  canWrite: boolean;
}

function KanbanColumn({
  status,
  leads,
  overStatus,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onMoveLead,
  onOpenLead,
  canWrite,
}: KanbanColumnProps) {
  const reduced = useReducedMotion();
  const isOver = overStatus === status;

  return (
    <motion.div
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border bg-blanco dark:bg-grafito",
        isOver ? "border-rojo shadow-lg shadow-rojo/10" : "border-gris-200 dark:border-gris-700",
      )}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        if (!canWrite) return;
        const id = e.dataTransfer.getData("text/lead-id") || draggingId;
        if (id) onMoveLead(id, status);
      }}
      initial={reduced ? undefined : { opacity: 0, x: 20 }}
      animate={reduced ? undefined : { opacity: 1, x: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center justify-between border-b border-gris-200 dark:border-gris-700 px-3 py-2.5">
        <h3 className={cn("text-sm font-semibold", statusColor(status))}>
          {status}
        </h3>
        <span className="text-xs font-mono tabular-nums text-gris-500 dark:text-gris-400 bg-gris-100 dark:bg-gris-800 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      <DropIndicator isOver={isOver} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        <AnimatePresence>
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              draggingId={draggingId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              canWrite={canWrite}
              onClick={() => onOpenLead(lead)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function KanbanBoard() {
  useEnsureLeadsSynced();
  const router = useRouter();
  const leads = useUiStore((s) => s.leads);
  const upsertLead = useUiStore((s) => s.upsertLead);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<LeadStatus | null>(null);
  const reduced = useReducedMotion();
  const { canWriteLeads, isVisitor } = useSessionAccess();
  const canDrag = canWriteLeads || isVisitor;

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, [] as Lead[]]),
    ) as Record<LeadStatus, Lead[]>;
    for (const lead of leads) {
      if (!lead.archived) {
        map[lead.status]?.push(lead);
      }
    }
    return map;
  }, [leads]);

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
    // Note: With framer-motion's drag, we need to manually set dataTransfer
    // This is a limitation - we'll handle it in the drop zone
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverStatus(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, status: LeadStatus) => {
    e.preventDefault();
    setOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setOverStatus(null);
  }, []);

  const moveLead = async (leadId: string, status: LeadStatus) => {
    if (isVisitor) {
      toast("En la demo los cambios no se guardan", {
        description: "Los datos son ficticios y de solo lectura.",
      });
      return;
    }
    if (!canWriteLeads) return;
    const current = leads.find((l) => l.id === leadId);
    if (!current || current.status === status) return;

    const previous = { ...current };
    upsertLead({ ...current, status });
    try {
      const updated = await patchStatus(leadId, status);
      upsertLead(updated);
      toast.success("Estado actualizado", { description: `${updated.companyName} → ${status}` });
    } catch (e) {
      upsertLead(previous);
      toast.error(e instanceof Error ? e.message : "Error al mover");
    }
  };

  const handleOpenLead = (lead: Lead) => {
    router.push(`/leads?lead=${lead.id}`);
  };

  return (
    <>
      <Topbar title="Kanban" subtitle={`${leads.filter(l => !l.archived).length} leads activos`} />
      <div className="min-h-0 flex-1 overflow-x-auto p-4">
        <motion.div
          className="flex h-full min-w-max gap-3"
          initial={reduced ? undefined : { opacity: 0, y: 12 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.05 }}
        >
          {LEAD_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={byStatus[status]}
              overStatus={overStatus}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onMoveLead={moveLead}
              onOpenLead={handleOpenLead}
              canWrite={canDrag}
            />
          ))}
        </motion.div>
      </div>
    </>
  );
}