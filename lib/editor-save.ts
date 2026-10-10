/** A completed request acknowledges only the revision it actually submitted. */
export function saveCompletionMessage(published: boolean, submittedRevision: number, currentRevision: number) {
  const result = published ? "Published" : "Draft saved";
  return submittedRevision === currentRevision ? result : `${result}. Newer edits remain unsaved.`;
}
export function needsExitWarning(revision: number, savedRevision: number, uploads: number, saving: boolean) {
  return revision !== savedRevision || uploads > 0 || saving;
}
