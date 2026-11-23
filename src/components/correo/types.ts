export type LeadLinkSource = "manual" | "auto";

export interface EmailThread {
  id: string;
  subject: string;
  from_address: string;
  from_name: string | null;
  mailbox_address: string;
  last_message_at: string;
  is_read: boolean;
  message_count: number;
  lead_id: string | null;
  /** Origen de la vinculación; solo viene en el detalle del hilo. */
  lead_link_source?: LeadLinkSource | null;
  created_at: string;
  archived_at?: string | null;
  trashed_at?: string | null;
  last_snippet?: string | null;
  has_attachments?: boolean;
}

export interface EmailMessage {
  id: string;
  resend_email_id: string;
  message_id: string | null;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses?: string[];
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  send_status: string;
  received_at: string;
  created_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size_bytes: number | null;
}
