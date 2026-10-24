"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { parseDraftPayload, type ParsedDraft } from "@/lib/business/draft";
import { resolveContactPhoto } from "@/lib/media/resolve-contact-photo";
import { captureOperationError } from "@/lib/observability/operations";

export async function parseDraft(fd: FormData) {
  return parseDraftPayload(String(fd.get("draft") || "{}"));
}

async function persistDraft(supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"], draft: ParsedDraft, publish = false) {
  if (!Number.isSafeInteger(draft.expectedPageRevision) || !Number.isSafeInteger(draft.expectedBusinessRevision)) throw new Error("Reload the editor before saving. Your local edits are preserved.");
  if (draft.contact?.enabled) await resolveContactPhoto(supabase, draft.businessId, draft.contact, draft.sections);
  const { data, error } = await supabase.rpc("save_contact_draft", { draft, expected_page_revision: draft.expectedPageRevision, expected_business_revision: draft.expectedBusinessRevision, publish });
  if (error) throw new Error(error.code === "40001" ? "This draft changed in another session. Your local edits are preserved; reload in another tab to compare." : "Could not save. Check contact fields and retry.");
  if (!data?.ok || !Number.isSafeInteger(data.pageRevision) || !Number.isSafeInteger(data.businessRevision)) throw new Error("The draft was not committed. Your edits are preserved.");
  return data as { ok: true; pageRevision: number; businessRevision: number; version?: number };
}

/** Persist a complete local editor draft without redirecting or publishing it. */
export async function saveDraftState(fd: FormData): Promise<{ ok: boolean; error?: string; pageRevision?: number; businessRevision?: number }> {
  try {
    const { supabase } = await requireOwner("edit");
    const draft = await parseDraft(fd);
    const result = await persistDraft(supabase, draft);
    revalidatePath("/admin/businesses/" + draft.businessId);
    revalidatePath("/admin/businesses/" + draft.businessId + "/preview");
    return result;
  } catch (error) {
    captureOperationError(new Error("Draft save failed"), "admin.draft.save");
    return { ok: false, error: error instanceof Error ? error.message : "Could not save draft." };
  }
}

/** Save the local draft and publish the validated snapshot in one explicit action. */
export async function publishDraftState(fd: FormData): Promise<{ ok: boolean; error?: string; version?: number; pageRevision?: number; businessRevision?: number }> {
  try {
    const { supabase } = await requireOwner("publish");
    const draft = await parseDraft(fd);
    const result = await persistDraft(supabase, draft, true);
    revalidatePath("/b/[slug]", "page");
    revalidatePath("/admin/businesses/" + draft.businessId);
    return result;
  } catch (error) {
    captureOperationError(new Error("Page publication failed"), "admin.page.publish");
    return { ok: false, error: error instanceof Error ? error.message : "Could not publish this page." };
  }
}
