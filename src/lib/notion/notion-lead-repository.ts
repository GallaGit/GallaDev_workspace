import type {
  BlockObjectRequest,
  RichTextItemRequest,
  SelectColor,
} from "@notionhq/client/build/src/api-endpoints";
import type { TextRequest, StringRequest } from "@notionhq/client/build/src/api-endpoints/common";

type NotionPageProperty =
  | { title: Array<RichTextItemRequest>; type?: "title" }
  | { rich_text: Array<RichTextItemRequest>; type?: "rich_text" }
  | { number: number | null; type?: "number" }
  | { url: TextRequest | null; type?: "url" }
  | {
      select: {
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | null;
      type?: "select";
    }
  | {
      multi_select: Array<{
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      }>;
      type?: "multi_select";
    }
  | { email: TextRequest | null; type?: "email" }
  | { phone_number: TextRequest | null; type?: "phone_number" }
  | { date: { start: string; end?: string | null } | null; type?: "date" }
  | { checkbox: boolean; type?: "checkbox" }
  | {
      status: {
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | null;
      type?: "status";
    };

type NotionPageProperties = Record<string, NotionPageProperty>;
import {
  getNotionClient,
  getNotionDataSourceId,
} from "@/lib/notion/client";
import {
  leadCreateToNotionProperties,
  leadPatchToNotionProperties,
  mapNotionPageToLead,
  mapResultsToLeads,
} from "@/lib/notion/mapper";
import {
  ACTIVITY_TYPE_AI_ANALYZED,
  type Lead,
  type LeadCreateInput,
  type LeadPatch,
} from "@/lib/domain/lead";
import type { LeadRepository } from "@/lib/repository/lead-repository";
import { splitNotes } from "@/lib/utils/email-plain";

const ACTIVITY_HEADING = "Actividad";
const NOTES_HEADING = "Notas";

type AnyBlock = {
  id: string;
  type?: string;
  [key: string]: unknown;
};

async function listAllBlocks(pageId: string): Promise<AnyBlock[]> {
  const notion = getNotionClient();
  const blocks: AnyBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const b of res.results) {
      blocks.push(b as AnyBlock);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

function blockPlain(block: AnyBlock): string {
  const type = block.type;
  if (!type) return "";
  const inner = block[type] as
    | { rich_text?: { plain_text: string }[] }
    | undefined;
  return inner?.rich_text?.map((r) => r.plain_text).join("") ?? "";
}

export class NotionLeadRepository implements LeadRepository {
  async list(options?: { includeArchived?: boolean }): Promise<Lead[]> {
    const notion = getNotionClient();
    const data_source_id = getNotionDataSourceId();
    const includeArchived = Boolean(options?.includeArchived);

    async function queryPages(inTrash: boolean): Promise<Lead[]> {
      const leads: Lead[] = [];
      let cursor: string | undefined;
      do {
        // Notion rejects `in_trash: false` — omit the field for active pages.
        const res = await notion.dataSources.query({
          data_source_id,
          start_cursor: cursor,
          page_size: 100,
          ...(inTrash ? { in_trash: true as const } : {}),
        });
        leads.push(...mapResultsToLeads(res.results));
        cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      } while (cursor);
      return leads;
    }

    const active = await queryPages(false);
    if (!includeArchived) {
      return active.filter((lead) => !lead.archived);
    }

    const archived = await queryPages(true);
    const byId = new Map<string, Lead>();
    for (const lead of [...active, ...archived]) {
      byId.set(lead.id, lead);
    }
    return [...byId.values()];
  }

  async get(id: string): Promise<Lead | null> {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: id });
    const lead = mapNotionPageToLead(page);
    if (!lead) return null;
    lead.notesOverflow = await this.getNotesOverflow(id);
    return lead;
  }

  async create(input: LeadCreateInput): Promise<Lead> {
    const notion = getNotionClient();
    const data_source_id = getNotionDataSourceId();
    const { properties, notesOverflow } = leadCreateToNotionProperties(input);

    const page = await notion.pages.create({
      parent: { data_source_id },
      properties: properties as NotionPageProperties,
    });

    const lead = mapNotionPageToLead(page);
    if (!lead) throw new Error("No se pudo mapear el lead creado");

    if (notesOverflow) {
      await this.setNotesOverflow(lead.id, notesOverflow);
      lead.notesOverflow = notesOverflow;
    }

    await this.appendActivity(lead.id, "Lead creado manualmente", "create");
    await this.addComment(
      lead.id,
      input.source?.trim() === "web-galladev"
        ? "Lead recibido desde el formulario de galladev.com"
        : "Lead creado manualmente desde Leads_CRM",
    );

    return lead;
  }

  async update(id: string, patch: LeadPatch): Promise<Lead> {
    const notion = getNotionClient();
    let working: LeadPatch = { ...patch };

    if (working.notes !== undefined) {
      const notesValue = working.notes ?? "";
      const { observaciones, overflow } = splitNotes(notesValue);
      working = { ...working, notes: observaciones };
      await this.setNotesOverflow(id, overflow);
    }

    const properties = leadPatchToNotionProperties(working);
    const page = await notion.pages.update({
      page_id: id,
      properties: properties as NotionPageProperties,
    });

    if (patch.status !== undefined) {
      await this.appendActivity(
        id,
        `Estado → ${patch.status}`,
        "status_changed",
      );
      await this.addComment(id, `Estado cambiado a ${patch.status}`);
    } else if (patch.notes !== undefined) {
      await this.appendActivity(id, "Notas actualizadas", "note_updated");
      await this.addComment(id, "Notas actualizadas");
    } else if (patch.favorite !== undefined) {
      await this.appendActivity(
        id,
        patch.favorite ? "Marcado como favorito" : "Quitado de favoritos",
        "favorite",
      );
    } else if (
      patch.emailBody !== undefined ||
      patch.emailSubject !== undefined
    ) {
      await this.appendActivity(id, "Email editado", "email_edited");
    } else if (patch.aiAnalysis !== undefined) {
      try {
        await this.appendActivity(
          id,
          "Análisis IA de dolores actualizado",
          ACTIVITY_TYPE_AI_ANALYZED,
        );
      } catch (error) {
        console.error(`[activity] ${ACTIVITY_TYPE_AI_ANALYZED} failed`, {
          id,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
      await this.addComment(id, "Análisis IA de dolores actualizado");
    }

    const lead = mapNotionPageToLead(page);
    if (!lead) throw new Error("No se pudo mapear el lead actualizado");
    lead.notesOverflow = await this.getNotesOverflow(id);
    return lead;
  }

  async archive(id: string): Promise<void> {
    const notion = getNotionClient();
    await this.appendActivity(id, "Lead archivado", "archived");
    await this.addComment(id, "Lead archivado desde Leads_CRM");
    await notion.pages.update({ page_id: id, archived: true });
  }

  async appendActivity(
    id: string,
    message: string,
    type = "event",
  ): Promise<void> {
    const notion = getNotionClient();
    const at = new Date().toISOString();
    const line = `[${at}] (${type}) ${message}`;

    const blocks = await listAllBlocks(id);
    let hasActivityHeading = false;
    for (const b of blocks) {
      if (b.type === "heading_2" && blockPlain(b) === ACTIVITY_HEADING) {
        hasActivityHeading = true;
        break;
      }
    }

    const paragraph: BlockObjectRequest = {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: line.slice(0, 2000) } }],
      },
    };

    if (!hasActivityHeading) {
      await notion.blocks.children.append({
        block_id: id,
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: ACTIVITY_HEADING } }],
            },
          },
          paragraph,
        ],
      });
      return;
    }

    await notion.blocks.children.append({
      block_id: id,
      children: [paragraph],
    });
  }

  async getActivity(
    id: string,
  ): Promise<{ at: string; type: string; message: string }[]> {
    const blocks = await listAllBlocks(id);
    const events: { at: string; type: string; message: string }[] = [];
    let inActivity = false;
    for (const b of blocks) {
      if (b.type === "heading_2" && blockPlain(b) === ACTIVITY_HEADING) {
        inActivity = true;
        continue;
      }
      if (b.type === "heading_2" && blockPlain(b) === NOTES_HEADING) {
        inActivity = false;
        continue;
      }
      if (inActivity && b.type === "paragraph") {
        const text = blockPlain(b);
        const m = text.match(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*(.*)$/);
        if (m) {
          events.push({ at: m[1], type: m[2], message: m[3] });
        } else if (text) {
          events.push({ at: "", type: "event", message: text });
        }
      }
    }
    return events.reverse();
  }

  async setNotesOverflow(id: string, overflow: string | null): Promise<void> {
    const notion = getNotionClient();
    const blocks = await listAllBlocks(id);
    const toDelete: string[] = [];
    let inNotes = false;
    let notesHeadingId: string | null = null;

    for (const b of blocks) {
      if (b.type === "heading_2" && blockPlain(b) === NOTES_HEADING) {
        inNotes = true;
        notesHeadingId = b.id;
        continue;
      }
      if (b.type === "heading_2" && blockPlain(b) === ACTIVITY_HEADING) {
        inNotes = false;
        continue;
      }
      if (inNotes) {
        toDelete.push(b.id);
      }
    }

    for (const blockId of toDelete) {
      await notion.blocks.delete({ block_id: blockId });
    }

    if (!overflow) return;

    const children: BlockObjectRequest[] = [];
    if (!notesHeadingId) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: NOTES_HEADING } }],
        },
      });
    }

    for (let i = 0; i < overflow.length; i += 1900) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: overflow.slice(i, i + 1900) },
            },
          ],
        },
      });
    }

    await notion.blocks.children.append({
      block_id: id,
      children,
    });
  }

  async getNotesOverflow(id: string): Promise<string | null> {
    const blocks = await listAllBlocks(id);
    const parts: string[] = [];
    let inNotes = false;
    for (const b of blocks) {
      if (b.type === "heading_2" && blockPlain(b) === NOTES_HEADING) {
        inNotes = true;
        continue;
      }
      if (b.type === "heading_2") {
        inNotes = false;
        continue;
      }
      if (inNotes && b.type === "paragraph") {
        parts.push(blockPlain(b));
      }
    }
    const text = parts.join("\n");
    return text || null;
  }

  private async addComment(pageId: string, text: string): Promise<void> {
    try {
      const notion = getNotionClient();
      await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
      });
    } catch {
      // Comments may require extra integration capabilities
    }
  }
}

let repo: NotionLeadRepository | null = null;

export function getLeadRepository(): LeadRepository {
  if (!repo) repo = new NotionLeadRepository();
  return repo;
}
