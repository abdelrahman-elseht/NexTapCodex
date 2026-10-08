import { requireOwner } from "@/lib/auth/owner";
import { CopyNfcUrl } from "@/components/copy-nfc-url";
import { assignCard, createBatch } from "../businesses/actions";

export const dynamic = "force-dynamic";

const cardStatuses = ["unassigned", "active", "disabled", "replaced"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function Cards({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const { supabase } = await requireOwner();
  const searchText = (query.search || "").trim().slice(0, 64);
  const searchIsSafe = !searchText || /^[A-Za-z0-9_-]+$/.test(searchText);
  const search = searchIsSafe ? searchText : "";
  const status = cardStatuses.includes(query.status as (typeof cardStatuses)[number])
    ? query.status
    : "";
  const batchId = query.batch && uuidPattern.test(query.batch) ? query.batch : "";
  const pageId = query.page_id && uuidPattern.test(query.page_id) ? query.page_id : "";

  const [{ data: batches }, { data: pages }] = await Promise.all([
    supabase
      .from("card_batches")
      .select("id,name,quantity")
      .order("created_at", { ascending: false }),
    supabase
      .from("business_pages")
      .select("id,slug,branch_name,is_active,published_snapshot_id,businesses!inner(name,status)")
      .order("slug"),
  ]);

  let cardQuery = supabase
    .from("cards")
    .select("id,serial,token,page_id,batch_id,status")
    .order("created_at", { ascending: false })
    .limit(300);

  if (search) {
    // The search alphabet excludes PostgREST filter syntax characters.
    cardQuery = cardQuery.or(`serial.ilike.%${search}%,token.ilike.%${search}%`);
  }
  if (status) cardQuery = cardQuery.eq("status", status);
  if (batchId) cardQuery = cardQuery.eq("batch_id", batchId);
  if (pageId) cardQuery = cardQuery.eq("page_id", pageId);

  const { data: cards } = await cardQuery;
  const allPages = (pages || []) as any[];
  const eligiblePages = allPages.filter((page: any) =>
    page.is_active && page.published_snapshot_id && page.businesses?.status === "active",
  );
  const pageById = new Map(allPages.map((page: any) => [page.id, page]));
  const cardRows = cards || [];
  const batchRows = batches || [];
  const filtersActive = Boolean(search || status || batchId || pageId);

  return (
    <>
      <div className="admin-title"><h1>البطاقات</h1></div>
      {query.error && <div className="alert" role="alert">تعذر تنفيذ العملية. راجع التأكيد والصفحة المنشورة المحددة.</div>}
      {query.assigned && <div className="alert success" role="status">تم تحديث تعيين البطاقة.</div>}

      <form className="form-card" action={createBatch}>
        <h2>إنشاء دفعة بطاقات</h2>
        <div className="inline">
          <input className="control" name="name" placeholder="اسم الدفعة" maxLength={100} />
          <input className="control" name="quantity" type="number" min="1" max="10000" defaultValue="100" required />
          <button className="button gold">إنشاء دفعة</button>
        </div>
      </form>

      {(batchRows as any[]).map((batch: any) => (
        <div className="form-card inline" key={batch.id}>
          {batch.name} · {batch.quantity}
          <a className="button secondary" href={`/admin/cards/export?batch=${batch.id}`}>تنزيل CSV</a>
        </div>
      ))}

      <section className="form-card" aria-labelledby="card-filters-title">
        <h2 id="card-filters-title">البحث والتصفية</h2>
        <form method="get" action="/admin/cards" className="form-grid">
          <label className="field">
            الرقم التسلسلي أو الرمز
            <input
              className="control"
              name="search"
              defaultValue={searchText}
              maxLength={64}
              pattern="[A-Za-z0-9_-]+"
              placeholder="مثال: NT-20261008 أو جزء من الرمز"
            />
          </label>
          <label className="field">
            الحالة
            <select name="status" defaultValue={status}>
              <option value="">كل الحالات</option>
              <option value="unassigned">غير معيّنة</option>
              <option value="active">مفعّلة</option>
              <option value="disabled">معطّلة</option>
              <option value="replaced">مستبدلة</option>
            </select>
          </label>
          <label className="field">
            الدفعة
            <select name="batch" defaultValue={batchId}>
              <option value="">كل الدفعات</option>
              {(batchRows as any[]).map((batch: any) => (
                <option key={batch.id} value={batch.id}>{batch.name} · {batch.quantity}</option>
              ))}
            </select>
          </label>
          <label className="field">
            الموقع المعيّن
            <select name="page_id" defaultValue={pageId}>
              <option value="">كل المواقع</option>
              {allPages.map((page: any) => (
                <option key={page.id} value={page.id}>
                  {page.businesses?.name} {page.branch_name || ""} / {page.slug}
                  {(!page.is_active || !page.published_snapshot_id || page.businesses?.status !== "active") ? " (غير متاح)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="inline">
            <button className="button">تطبيق التصفية</button>
            <a className="button secondary" href="/admin/cards">مسح التصفية</a>
          </div>
        </form>
        {!searchIsSafe && (
          <p className="notice" role="alert">استخدم أحرفاً إنجليزية أو أرقاماً أو شرطة فقط في البحث.</p>
        )}
      </section>

      <h2>المخزون · {filtersActive ? `${cardRows.length} نتيجة مطابقة` : `آخر ${cardRows.length} بطاقة (حتى 300)`}</h2>
      {eligiblePages.length === 0 && (
        <p className="notice" role="status">لا توجد صفحة منشورة ونشطة. انشر صفحة من لوحة النشاط قبل تفعيل البطاقات.</p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الرقم التسلسلي</th>
              <th>الحالة</th>
              <th>الموقع المعيّن</th>
              <th>رابط NFC</th>
              <th>التعيين</th>
            </tr>
          </thead>
          <tbody>
            {(cardRows as any[]).map((card: any) => {
              const currentPageIsEligible = eligiblePages.some((page: any) => page.id === card.page_id);
              const selectedPageId = currentPageIsEligible
                ? card.page_id
                : eligiblePages.length === 1
                  ? eligiblePages[0].id
                  : "";
              const assignedPage: any = pageById.get(card.page_id);
              const assignedBusiness = Array.isArray(assignedPage?.businesses)
                ? assignedPage.businesses[0]
                : assignedPage?.businesses;

              return (
                <tr key={card.id}>
                  <td dir="ltr">
                    <strong>{card.serial}</strong>
                    <div className="muted" dir="ltr">{card.token.slice(0, 8)}…</div>
                  </td>
                  <td>{card.status}</td>
                  <td>{assignedPage
                    ? `${assignedBusiness?.name || ""} / ${assignedPage.slug}${(!assignedPage.is_active || !assignedPage.published_snapshot_id || assignedBusiness?.status !== "active") ? " (غير متاح)" : ""}`
                    : "—"}</td>
                  <td><CopyNfcUrl token={card.token} /></td>
                  <td>
                    <form action={assignCard} className="inline">
                      <input type="hidden" name="card_id" value={card.id} />
                      <select
                        name="page_id"
                        required
                        defaultValue={selectedPageId}
                        aria-label={`الصفحة للبطاقة ${card.serial}`}
                      >
                        <option value="">صفحة منشورة</option>
                        {eligiblePages.map((page: any) => (
                          <option key={page.id} value={page.id}>
                            {page.businesses?.name} {page.branch_name || ""} / {page.slug}
                          </option>
                        ))}
                      </select>
                      <label><input type="checkbox" name="confirm" required /> أؤكد</label>
                      <button className="button" disabled={eligiblePages.length === 0}>تفعيل / نقل</button>
                      <button className="small-button danger" name="mode" value="disable" formNoValidate>تعطيل</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {cardRows.length === 0 && (
              <tr><td colSpan={5}>لا توجد بطاقات تطابق عوامل التصفية.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
