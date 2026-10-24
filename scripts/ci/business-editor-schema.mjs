// Read-only probes: do not substitute legacy writers for the editor contract.
export async function assertBusinessEditorSchema(client) {
  for (const [table, columns] of [
    ["businesses", "id,name,category,status,provider_profiles,draft_revision"],
    ["business_pages", "id,slug,template,page_type,branch_name,is_active,published_snapshot_id,contact_config,draft_revision"],
    ["media_assets", "id,contact_photo_path"],
  ]) {
    const { error } = await client.from(table).select(columns).limit(0);
    if (error) throw new Error(`Staging business editor schema probe failed for ${table} (${error.code}). Apply the reviewed Contacts migration before deploying the app.`);
  }
  // An empty draft cannot resolve a page. The function must reject it before
  // any update, while a missing RPC fails with PGRST202 instead.
  const { error } = await client.rpc("save_contact_draft", {
    draft: {}, expected_page_revision: 0, expected_business_revision: 0, publish: false,
  });
  if (error?.code !== "P0001" || error.message !== "page not found") {
    throw new Error(`Staging business editor schema probe failed for save_contact_draft (${error?.code || "unexpected success"}). Apply the reviewed Contacts migration before deploying the app.`);
  }
}
