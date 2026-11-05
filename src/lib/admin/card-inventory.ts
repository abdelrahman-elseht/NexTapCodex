import {
  ADMIN_PAGE_SIZE,
  cursorFilter,
  cursorForRow,
  decodePageCursor,
  encodePageCursor,
  pageUrl,
} from "./pagination";

const cardStatuses = ["unassigned", "active", "disabled", "replaced"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InventoryQuery = Record<string, string | undefined>;
type InventorySupabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
type InventoryFilters = ReturnType<typeof parseCardInventoryQuery>;

export function parseCardInventoryQuery(query: InventoryQuery) {
  const searchText = (query.search || "").trim().slice(0, 64);
  const searchIsSafe = !searchText || /^[A-Za-z0-9_-]+$/.test(searchText);
  const status = cardStatuses.includes(query.status as (typeof cardStatuses)[number]) ? query.status : "";
  const batchId = query.batch && uuidPattern.test(query.batch) ? query.batch : "";
  const pageId = query.page_id && uuidPattern.test(query.page_id) ? query.page_id : "";
  return {
    searchText,
    searchIsSafe,
    search: searchIsSafe ? searchText : "",
    status,
    batchId,
    pageId,
    pageSearch: (query.page_search || "").trim().slice(0, 80),
    batchDirection: (query.batch_direction === "previous" ? "previous" : "next") as "previous" | "next",
    batchCursor: decodePageCursor(query.batch_cursor),
    direction: (query.direction === "previous" ? "previous" : "next") as "previous" | "next",
    cursor: decodePageCursor(query.cursor),
  };
}

async function queryBatches(supabase: InventorySupabase, filters: InventoryFilters) {
  const { batchDirection, batchCursor } = filters;
  let query = supabase.from("card_batches").select("id,name,quantity,batch_code,created_at,cards(count)")
    .order("created_at", { ascending: batchDirection === "previous" }).order("id", { ascending: batchDirection === "previous" }).limit(ADMIN_PAGE_SIZE + 1);
  if (batchCursor) query = query.or(cursorFilter(batchCursor, batchDirection));
  const { data: batches } = await query;
  let batchRows = batches || [];
  const hasMore = batchRows.length > ADMIN_PAGE_SIZE;
  if (hasMore) batchRows = batchRows.slice(0, ADMIN_PAGE_SIZE);
  if (batchDirection === "previous") batchRows.reverse();
  return { batchRows, hasMore };
}

async function queryPageOptions(supabase: InventorySupabase, pageSearch: string) {
  const { data } = await supabase.from("business_pages")
    .select("id,slug,branch_name,is_active,published_snapshot_id,businesses!inner(name,status)")
    .ilike("slug", `%${pageSearch.replace(/[%_]/g, "")}%`).order("slug").limit(101);
  return data || [];
}

async function queryCards(supabase: InventorySupabase, filters: InventoryFilters) {
  const { search, status, batchId, pageId, cursor, direction } = filters;
  let query = supabase.from("cards").select("id,serial,token,page_id,batch_id,status,created_at")
    .order("created_at", { ascending: direction === "previous" })
    .order("id", { ascending: direction === "previous" }).limit(ADMIN_PAGE_SIZE + 1);
  if (search) query = query.or(`serial.ilike.%${search}%,token.ilike.%${search}%`);
  if (status) query = query.eq("status", status);
  if (batchId) query = query.eq("batch_id", batchId);
  if (pageId) query = query.eq("page_id", pageId);
  if (cursor) query = query.or(cursorFilter(cursor, direction));
  const { data } = await query;
  let cardRows = data || [];
  const hasMore = cardRows.length > ADMIN_PAGE_SIZE;
  if (hasMore) cardRows = cardRows.slice(0, ADMIN_PAGE_SIZE);
  if (direction === "previous") cardRows.reverse();
  return { cardRows, hasMore };
}

async function includeAssignedPages(supabase: InventorySupabase, pages: any[], cards: any[]) {
  const visiblePageIds = new Set(cards.map((card) => card.page_id).filter(Boolean));
  const missingPageIds = [...visiblePageIds].filter((id) => !pages.some((page) => page.id === id));
  if (!missingPageIds.length) return pages;
  const { data } = await supabase.from("business_pages")
    .select("id,slug,branch_name,is_active,published_snapshot_id,businesses!inner(name,status)")
    .in("id", missingPageIds);
  return pages.concat(data || []);
}

async function includeSelectedBatch(supabase: InventorySupabase, batchRows: any[], batchId: string) {
  if (!batchId || batchRows.some((batch) => batch.id === batchId)) return batchRows;
  const { data } = await supabase.from("card_batches").select("id,name,quantity,batch_code,created_at,cards(count)")
    .eq("id", batchId).maybeSingle();
  return data ? [data, ...batchRows] : batchRows;
}

function batchNavigation(filters: InventoryFilters, batchRows: any[], hasMore: boolean) {
  const { search, status, batchId, pageId, batchCursor } = filters;
  const first = batchRows[0];
  const last = batchRows.at(-1);
  const shared = { search: search || undefined, status: status || undefined, batch: batchId || undefined, page_id: pageId || undefined };
  return {
    nextBatchesHref: hasMore && last ? pageUrl("/admin/cards", { ...shared, batch_cursor: encodePageCursor(cursorForRow(last)), batch_direction: "next" }) : undefined,
    previousBatchesHref: batchCursor && first ? pageUrl("/admin/cards", { ...shared, batch_cursor: encodePageCursor(cursorForRow(first)), batch_direction: "previous" }) : undefined,
  };
}

function cardNavigation(filters: InventoryFilters, cardRows: any[], hasMore: boolean) {
  const { search, status, batchId, pageId, pageSearch, cursor } = filters;
  const first = cardRows[0];
  const last = cardRows.at(-1);
  const cardFilters = { search: search || undefined, status: status || undefined, batch: batchId || undefined, page_id: pageId || undefined, page_search: pageSearch || undefined };
  return {
    cardFilters,
    nextCardsHref: hasMore && last ? pageUrl("/admin/cards", { ...cardFilters, cursor: encodePageCursor(cursorForRow(last)), direction: "next" }) : undefined,
    previousCardsHref: cursor && first ? pageUrl("/admin/cards", { ...cardFilters, cursor: encodePageCursor(cursorForRow(first)), direction: "previous" }) : undefined,
  };
}

export async function loadCardInventory(supabase: InventorySupabase, query: InventoryQuery) {
  const filters = parseCardInventoryQuery(query);
  const [{ batchRows: initialBatches, hasMore: batchesHasMore }, candidatePages] = await Promise.all([
    queryBatches(supabase, filters),
    queryPageOptions(supabase, filters.pageSearch),
  ]);
  const batchRows = await includeSelectedBatch(supabase, initialBatches, filters.batchId);
  const { cardRows, hasMore: cardsHasMore } = await queryCards(supabase, filters);
  const allPages = await includeAssignedPages(supabase, candidatePages, cardRows);
  const eligiblePages = allPages.filter((page) => page.is_active && page.published_snapshot_id && page.businesses?.status === "active");
  const pageById = new Map(allPages.map((page) => [page.id, page]));
  const links = cardNavigation(filters, cardRows, cardsHasMore);
  return {
    ...filters,
    batchRows,
    ...batchNavigation(filters, batchRows, batchesHasMore),
    cardRows,
    allPages,
    eligiblePages,
    pageById,
    ...links,
    filtersActive: Boolean(filters.search || filters.status || filters.batchId || filters.pageId),
  };
}
