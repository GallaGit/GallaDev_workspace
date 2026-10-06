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
}

export const FILTER_DIMENSIONS: FilterDimension[] = [
  {
    key: "status",
    icon: CircleDashed,
    kind: "multi",
    fields: ["status"],
    arrayField: "status",
    isActive: (f) => (f.status?.length ?? 0) > 0,
  },
  {
    key: "province",
    icon: MapPin,
    kind: "multi",
    fields: ["province"],
    arrayField: "province",
    isActive: (f) => (f.province?.length ?? 0) > 0,
  },
  {
    key: "city",
    icon: Building2,
    kind: "multi",
    fields: ["city"],
    arrayField: "city",
    isActive: (f) => (f.city?.length ?? 0) > 0,
  },
  {
    key: "employees",
    icon: Users,
    kind: "range-num",
    fields: ["employeesMin", "employeesMax"],
    rangeFields: ["employeesMin", "employeesMax"],
    isActive: (f) => f.employeesMin != null || f.employeesMax != null,
  },
  {
    key: "hasEmail",
    icon: Mail,
    kind: "boolean",
    fields: ["hasEmail"],
    boolField: "hasEmail",
    isActive: (f) => f.hasEmail != null,
  },
  {
    key: "hasPhone",
    icon: Phone,
    kind: "boolean",
    fields: ["hasPhone"],
    boolField: "hasPhone",
    isActive: (f) => f.hasPhone != null,
  },
  {
    key: "hasWebsite",
    icon: Globe,
    kind: "boolean",
    fields: ["hasWebsite"],
    boolField: "hasWebsite",
    isActive: (f) => f.hasWebsite != null,
  },
  {
    key: "hasLinkedin",
    icon: Link2,
    kind: "boolean",
    fields: ["hasLinkedin"],
    boolField: "hasLinkedin",
    isActive: (f) => f.hasLinkedin != null,
  },
  {
    key: "favorite",
    icon: Star,
    kind: "boolean",
    fields: ["favorite"],
    boolField: "favorite",
    isActive: (f) => f.favorite != null,
  },
  {
    key: "created",
    icon: CalendarPlus,
    kind: "range-date",
    fields: ["createdFrom", "createdTo"],
    rangeFields: ["createdFrom", "createdTo"],
    isActive: (f) => Boolean(f.createdFrom || f.createdTo),
  },
  {
    key: "activity",
    icon: CalendarSync,
    kind: "range-date",
    fields: ["activityFrom", "activityTo"],
    rangeFields: ["activityFrom", "activityTo"],
    isActive: (f) => Boolean(f.activityFrom || f.activityTo),
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
