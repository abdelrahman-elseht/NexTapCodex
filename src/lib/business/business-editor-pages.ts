import { emptyContact, type ContactConfig } from "./contact";

const BASE_PAGE_COLUMNS = "id,slug,template,page_type,branch_name,is_active,published_snapshot_id";
const OPTIONAL_EDITOR_COLUMNS = ["contact_config", "draft_revision"] as const;

type MissingEditorColumn = (typeof OPTIONAL_EDITOR_COLUMNS)[number];

type QueryError = { code?: string; message?: string };
export type BusinessEditorPageRow = {
  id: string;
  slug: string;
  template: string;
  page_type: string;
  branch_name: string | null;
  is_active: boolean;
  published_snapshot_id: string | null;
  contact_config?: ContactConfig;
  draft_revision?: number;
};
type QueryResult<T> = { data: T | null; error: QueryError | null };

function missingOptionalEditorColumn(error: QueryError): MissingEditorColumn | undefined {
  if (error.code !== "42703" && error.code !== "PGRST204") return undefined;
  return OPTIONAL_EDITOR_COLUMNS.find(column => error.message?.includes(column));
}

/** Load page rows across deployments where the optional Contacts migration is not yet installed. */
export async function loadBusinessEditorPages(
  load: (columns: string) => PromiseLike<QueryResult<BusinessEditorPageRow[]>>,
): Promise<QueryResult<BusinessEditorPageRow[]>> {
  const columns = new Set<string>(OPTIONAL_EDITOR_COLUMNS);
  let result: QueryResult<BusinessEditorPageRow[]>;

  while (true) {
    const selectedColumns = [BASE_PAGE_COLUMNS, ...[...columns].filter(column => OPTIONAL_EDITOR_COLUMNS.includes(column as MissingEditorColumn))].join(",");
    result = await load(selectedColumns);
    if (!result.error) break;

    const missingColumn = missingOptionalEditorColumn(result.error);
    if (!missingColumn || !columns.has(missingColumn)) return result;
    columns.delete(missingColumn);
  }

  const defaults: { contact_config: ContactConfig; draft_revision: number } = {
    contact_config: emptyContact(),
    draft_revision: 0,
  };
  const data = (result.data || []).map(page => {
    const compatible: BusinessEditorPageRow = { ...page };
    for (const column of OPTIONAL_EDITOR_COLUMNS) {
      if (!columns.has(column)) {
        if (column === "contact_config") compatible.contact_config = defaults.contact_config;
        else compatible.draft_revision = defaults.draft_revision;
      }
    }
    return compatible;
  });
  return { ...result, data };
}
