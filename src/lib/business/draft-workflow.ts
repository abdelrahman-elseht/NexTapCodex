import type { ParsedDraft } from "./draft";

export type SavedContactDraft = {
  ok: true;
  pageRevision: number;
  businessRevision: number;
  version?: number;
};

export type ContactDraftPersistenceResult =
  | { ok: true; saved: SavedContactDraft }
  | { ok: false; reason: "conflict" | "save-failed" | "not-committed" };

export type ContactDraftPersistence = (
  draft: ParsedDraft,
  publish: boolean,
) => Promise<ContactDraftPersistenceResult>;

export async function saveContactDraftWorkflow(
  draft: ParsedDraft,
  publish: boolean,
  persist: ContactDraftPersistence,
): Promise<SavedContactDraft> {
  if (!Number.isSafeInteger(draft.expectedPageRevision) || !Number.isSafeInteger(draft.expectedBusinessRevision)) {
    throw new Error("Reload the editor before saving. Your local edits are preserved.");
  }

  const result = await persist(draft, publish);
  if (!result.ok) {
    if (result.reason === "conflict") {
      throw new Error("This draft changed in another session. Your local edits are preserved; reload in another tab to compare.");
    }
    if (result.reason === "save-failed") throw new Error("Could not save. Check contact fields and retry.");
    throw new Error("The draft was not committed. Your edits are preserved.");
  }

  if (!Number.isSafeInteger(result.saved.pageRevision) || !Number.isSafeInteger(result.saved.businessRevision)) {
    throw new Error("The draft was not committed. Your edits are preserved.");
  }
  return result.saved;
}
