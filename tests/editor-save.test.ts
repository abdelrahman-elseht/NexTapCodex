import { expect, it } from "vitest";
import { needsExitWarning, saveCompletionMessage } from "../lib/editor-save";
it("warns for newer edits, pending uploads and saves even with an otherwise clean draft", () => {
  expect(needsExitWarning(3, 2, 0, false)).toBe(true);
  expect(needsExitWarning(2, 2, 1, false)).toBe(true);
  expect(needsExitWarning(2, 2, 0, true)).toBe(true);
  expect(needsExitWarning(2, 2, 0, false)).toBe(false);
});
it("never reports newer input as saved or published by an older request", () => {
  expect(saveCompletionMessage(false, 1, 2)).toContain("Newer edits remain unsaved");
  expect(saveCompletionMessage(true, 1, 2)).toContain("Newer edits remain unsaved");
  expect(saveCompletionMessage(false, 2, 2)).toBe("Draft saved");
});
