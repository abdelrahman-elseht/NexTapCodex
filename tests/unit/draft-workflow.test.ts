import { describe, expect, it, vi } from "vitest";
import { parseDraftPayload } from "@/lib/business/draft";
import { saveContactDraftWorkflow } from "@/lib/business/draft-workflow";

const createDraft = (revisions = true) => parseDraftPayload(JSON.stringify({
  businessId: "business",
  pageId: "page",
  name: "Synthetic QA",
  slug: "synthetic-qa",
  template: "professional",
  ...(revisions ? { expectedPageRevision: 2, expectedBusinessRevision: 4 } : {}),
  sections: [{ section_key: "hero", kind: "hero", title: "Hero", enabled: true, content: {} }],
}));

describe("save contact draft workflow", () => {
  it("checks revisions before asking persistence to save or publish", async () => {
    const persist = vi.fn();

    await expect(saveContactDraftWorkflow(createDraft(false), true, persist)).rejects.toThrow("Reload the editor before saving.");
    expect(persist).not.toHaveBeenCalled();
  });

  it("passes the validated draft and publish intent through and returns the committed revisions", async () => {
    const draft = createDraft();
    const saved = { ok: true as const, pageRevision: 3, businessRevision: 5, version: 8 };
    const persist = vi.fn().mockResolvedValue({ ok: true as const, saved });

    await expect(saveContactDraftWorkflow(draft, true, persist)).resolves.toEqual(saved);
    expect(persist).toHaveBeenCalledWith(draft, true);
  });

  it("preserves conflict and persistence failure messages", async () => {
    const draft = createDraft();
    const conflict = vi.fn().mockResolvedValue({ ok: false as const, reason: "conflict" as const });
    const failed = vi.fn().mockResolvedValue({ ok: false as const, reason: "save-failed" as const });
    const uncommitted = vi.fn().mockResolvedValue({ ok: false as const, reason: "not-committed" as const });

    await expect(saveContactDraftWorkflow(draft, false, conflict)).rejects.toThrow("changed in another session");
    await expect(saveContactDraftWorkflow(draft, false, failed)).rejects.toThrow("Could not save.");
    await expect(saveContactDraftWorkflow(draft, false, uncommitted)).rejects.toThrow("was not committed");
  });
});
