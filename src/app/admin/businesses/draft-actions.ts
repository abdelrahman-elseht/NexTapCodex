"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireOwner } from "@/lib/auth/owner";
import { saveContactDraftWorkflow } from "@/lib/business/draft-workflow";
import { parseDraftPayload, type ParsedDraft } from "@/lib/business/draft";
import { captureOperationError } from "@/lib/observability/operations";
import { persistContactDraft } from "@/lib/supabase/contact-draft-persistence";

export async function parseDraft(fd: FormData) {
  return parseDraftPayload(String(fd.get("draft") || "{}"));
}

async function persistDraft(supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"], draft: ParsedDraft, publish = false) {
  return saveContactDraftWorkflow(draft, publish, (parsedDraft, shouldPublish) => persistContactDraft(supabase, parsedDraft, shouldPublish));
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
    if (isRedirectError(error)) return { ok: false, error: "Your account is not authorized to save drafts." };
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
    if (isRedirectError(error)) return { ok: false, error: "Your account is not authorized to publish this page." };
    return { ok: false, error: error instanceof Error ? error.message : "Could not publish this page." };
  }
}
