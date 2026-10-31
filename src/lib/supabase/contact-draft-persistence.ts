import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedDraft } from "@/lib/business/draft";
import type { ContactDraftPersistenceResult } from "@/lib/business/draft-workflow";
import { resolveContactPhoto } from "@/lib/media/resolve-contact-photo";

export async function persistContactDraft(
  client: SupabaseClient,
  draft: ParsedDraft,
  publish: boolean,
): Promise<ContactDraftPersistenceResult> {
  if (draft.contact?.enabled) await resolveContactPhoto(client, draft.businessId, draft.contact, draft.sections);

  const { data, error } = await client.rpc("save_contact_draft", {
    draft,
    expected_page_revision: draft.expectedPageRevision,
    expected_business_revision: draft.expectedBusinessRevision,
    publish,
  });

  if (error) return { ok: false, reason: error.code === "40001" ? "conflict" : "save-failed" };
  if (!data?.ok || !Number.isSafeInteger(data.pageRevision) || !Number.isSafeInteger(data.businessRevision)) {
    return { ok: false, reason: "not-committed" };
  }

  return { ok: true, saved: data as { ok: true; pageRevision: number; businessRevision: number; version?: number } };
}
