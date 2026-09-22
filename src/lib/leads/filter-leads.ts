import type { Lead, LeadFilters } from "@/lib/domain/lead";
import { canonicalizeCity } from "@/lib/geo/cities";
import { domainFromUrl } from "@/lib/utils/email-plain";
import {
  getDuplicateLeadIds,
  matchesWorkQueue,
  type WorkQueueId,
} from "@/lib/leads/work-queues";

export function filterLeads(
  leads: Lead[],
  filters: LeadFilters,
  activeQueue?: WorkQueueId | null,
): Lead[] {
  const duplicateIds = activeQueue
    ? getDuplicateLeadIds(leads)
    : new Set<string>();

  return leads.filter((lead) => {
    if (activeQueue && !matchesWorkQueue(lead, activeQueue, duplicateIds)) {
      return false;
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const hay = [
        lead.companyName,
        lead.website,
        domainFromUrl(lead.website),
        lead.email,
        lead.city,
        lead.cityCanonical,
        lead.province,
        lead.linkedin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (filters.status?.length && !filters.status.includes(lead.status)) {
      return false;
    }

    if (filters.province?.length) {
      if (!lead.province || !filters.province.includes(lead.province)) {
        return false;
      }
    }

    if (filters.city?.length) {
      const c = lead.cityCanonical ?? canonicalizeCity(lead.city);
      if (!c || !filters.city.some((f) => canonicalizeCity(f) === c)) {
        return false;
      }
    }

    if (filters.employeesMin != null && filters.employeesMin !== undefined) {
      if (lead.employees == null || lead.employees < filters.employeesMin) {
        return false;
      }
    }
    if (filters.employeesMax != null && filters.employeesMax !== undefined) {
      if (lead.employees == null || lead.employees > filters.employeesMax) {
        return false;
      }
    }

    if (filters.createdFrom && lead.createdAt) {
      if (lead.createdAt.slice(0, 10) < filters.createdFrom) return false;
    }
    if (filters.createdTo && lead.createdAt) {
      if (lead.createdAt.slice(0, 10) > filters.createdTo) return false;
    }
    if (filters.activityFrom && lead.lastActivity) {
      if (lead.lastActivity.slice(0, 10) < filters.activityFrom) return false;
    }
    if (filters.activityTo && lead.lastActivity) {
      if (lead.lastActivity.slice(0, 10) > filters.activityTo) return false;
    }

    if (filters.hasEmail === true && !lead.email) return false;
    if (filters.hasEmail === false && lead.email) return false;
    if (filters.hasPhone === true && !lead.phone) return false;
    if (filters.hasPhone === false && lead.phone) return false;
    if (filters.hasWebsite === true && !lead.website) return false;
    if (filters.hasWebsite === false && lead.website) return false;
    if (filters.hasLinkedin === true && !lead.linkedin) return false;
    if (filters.hasLinkedin === false && lead.linkedin) return false;
    if (filters.favorite === true && !lead.favorite) return false;
    if (filters.favorite === false && lead.favorite) return false;
    if (
      filters.responsibleId != null &&
      lead.responsibleId !== filters.responsibleId
    )
      return false;

    return true;
  });
}
