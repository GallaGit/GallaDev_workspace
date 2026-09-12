"use client";

import {
  Building2,
  CalendarPlus,
  CalendarSync,
  CircleDashed,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { LeadFilters } from "@/lib/domain/lead";

export type FilterKey =
  | "status"
  | "province"
  | "city"
  | "employees"
  | "hasEmail"
  | "hasPhone"
  | "hasWebsite"
  | "hasLinkedin"
  | "favorite"
  | "created"
  | "activity";

export type FilterKind = "multi" | "boolean" | "range-num" | "range-date";

export interface FilterDimension {
  key: FilterKey;
  label: string;
  icon: LucideIcon;
  kind: FilterKind;
  /** Which LeadFilters fields this dimension owns (for reset). */
  fields: (keyof LeadFilters)[];
  /** For `multi`: which LeadFilters array field it maps to. */
  arrayField?: "status" | "province" | "city";
  /** For `boolean`: which LeadFilters boolean field it maps to. */
  boolField?: "hasEmail" | "hasPhone" | "hasWebsite" | "hasLinkedin" | "favorite";
  /** For `range-num` / `range-date`: [fromField, toField]. */
  rangeFields?: [keyof LeadFilters, keyof LeadFilters];
  isActive: (f: LeadFilters) => boolean;
  summary: (f: LeadFilters) => string;
}

function fmtDate(d: string): string {
  // input value is YYYY-MM-DD; show DD/MM
  const [, m, day] = d.split("-");
  if (!m || !day) return d;
  return `${day}/${m}`;
}

export const FILTER_DIMENSIONS: FilterDimension[] = [
  {
    key: "status",
    label: "Estado",
    icon: CircleDashed,
    kind: "multi",
    fields: ["status"],
    arrayField: "status",
    isActive: (f) => (f.status?.length ?? 0) > 0,
    summary: (f) => {
      const v = f.status ?? [];
      return v.length === 1 ? v[0] : `${v.length} seleccionados`;
    },
  },
  {
    key: "province",
    label: "Provincia",
    icon: MapPin,
    kind: "multi",
    fields: ["province"],
    arrayField: "province",
    isActive: (f) => (f.province?.length ?? 0) > 0,
    summary: (f) => {
      const v = f.province ?? [];
      return v.length === 1 ? v[0] : `${v.length} seleccionadas`;
    },
  },
  {
    key: "city",
    label: "Ciudad",
    icon: Building2,
    kind: "multi",
    fields: ["city"],
    arrayField: "city",
    isActive: (f) => (f.city?.length ?? 0) > 0,
    summary: (f) => {
      const v = f.city ?? [];
      return v.length === 1 ? v[0] : `${v.length} seleccionadas`;
    },
  },
  {
    key: "employees",
    label: "Empleados",
    icon: Users,
    kind: "range-num",
    fields: ["employeesMin", "employeesMax"],
    rangeFields: ["employeesMin", "employeesMax"],
    isActive: (f) => f.employeesMin != null || f.employeesMax != null,
    summary: (f) => {
      const min = f.employeesMin ?? null;
      const max = f.employeesMax ?? null;
      if (min != null && max != null) return `${min}–${max}`;
      if (min != null) return `≥ ${min}`;
      if (max != null) return `≤ ${max}`;
      return "";
    },
  },
  {
    key: "hasEmail",
    label: "Con email",
    icon: Mail,
    kind: "boolean",
    fields: ["hasEmail"],
    boolField: "hasEmail",
    isActive: (f) => f.hasEmail != null,
    summary: (f) => (f.hasEmail ? "Sí" : "No"),
  },
  {
    key: "hasPhone",
    label: "Con teléfono",
    icon: Phone,
    kind: "boolean",
    fields: ["hasPhone"],
    boolField: "hasPhone",
    isActive: (f) => f.hasPhone != null,
    summary: (f) => (f.hasPhone ? "Sí" : "No"),
  },
  {
    key: "hasWebsite",
    label: "Con web",
    icon: Globe,
    kind: "boolean",
    fields: ["hasWebsite"],
    boolField: "hasWebsite",
    isActive: (f) => f.hasWebsite != null,
    summary: (f) => (f.hasWebsite ? "Sí" : "No"),
  },
  {
    key: "hasLinkedin",
    label: "Con LinkedIn",
    icon: Link2,
    kind: "boolean",
    fields: ["hasLinkedin"],
    boolField: "hasLinkedin",
    isActive: (f) => f.hasLinkedin != null,
    summary: (f) => (f.hasLinkedin ? "Sí" : "No"),
  },
  {
    key: "favorite",
    label: "Favoritos",
    icon: Star,
    kind: "boolean",
    fields: ["favorite"],
    boolField: "favorite",
    isActive: (f) => f.favorite != null,
    summary: (f) => (f.favorite ? "Sí" : "No"),
  },
  {
    key: "created",
    label: "Creación",
    icon: CalendarPlus,
    kind: "range-date",
    fields: ["createdFrom", "createdTo"],
    rangeFields: ["createdFrom", "createdTo"],
    isActive: (f) => Boolean(f.createdFrom || f.createdTo),
    summary: (f) => {
      if (f.createdFrom && f.createdTo)
        return `${fmtDate(f.createdFrom)}–${fmtDate(f.createdTo)}`;
      if (f.createdFrom) return `desde ${fmtDate(f.createdFrom)}`;
      if (f.createdTo) return `hasta ${fmtDate(f.createdTo)}`;
      return "";
    },
  },
  {
    key: "activity",
    label: "Actividad",
    icon: CalendarSync,
    kind: "range-date",
    fields: ["activityFrom", "activityTo"],
    rangeFields: ["activityFrom", "activityTo"],
    isActive: (f) => Boolean(f.activityFrom || f.activityTo),
    summary: (f) => {
      if (f.activityFrom && f.activityTo)
        return `${fmtDate(f.activityFrom)}–${fmtDate(f.activityTo)}`;
      if (f.activityFrom) return `desde ${fmtDate(f.activityFrom)}`;
      if (f.activityTo) return `hasta ${fmtDate(f.activityTo)}`;
      return "";
    },
  },
];

export const FILTER_DIMENSION_BY_KEY: Record<FilterKey, FilterDimension> =
  Object.fromEntries(FILTER_DIMENSIONS.map((d) => [d.key, d])) as Record<
    FilterKey,
    FilterDimension
  >;

/** Cleared value for every field owned by a dimension. */
export function clearedFields(dim: FilterDimension): Partial<LeadFilters> {
  const patch: Partial<LeadFilters> = {};
  for (const field of dim.fields) {
    // undefined removes multi-select arrays; null clears scalars/booleans
    if (dim.kind === "multi") {
      (patch as Record<string, unknown>)[field] = undefined;
    } else {
      (patch as Record<string, unknown>)[field] = null;
    }
  }
  return patch;
}
