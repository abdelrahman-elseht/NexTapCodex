import { requireOwner } from "@/lib/auth/owner";
import { headers } from "next/headers";
import { cardUrls, getCardOrigin } from "@/lib/card-manufacturing";
import { CopyNfcUrl } from "@/components/copy-nfc-url";
import { assignCard, createBatch } from "../businesses/actions";
import { randomUUID } from "node:crypto";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CardHistory } from "./card-history";
import { ADMIN_PAGE_SIZE, cursorFilter, cursorForRow, decodePageCursor, encodePageCursor, pageUrl } from "@/lib/admin-pagination";

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
  const requestOrigin = getCardOrigin(undefined, await headers());
  const searchText = (query.search || "").trim().slice(0, 64);
  const searchIsSafe = !searchText || /^[A-Za-z0-9_-]+$/.test(searchText);
  const search = searchIsSafe ? searchText : "";
  const status = cardStatuses.includes(query.status as (typeof cardStatuses)[number])
    ? query.status
    : "";
  const batchId = query.batch && uuidPattern.test(query.batch) ? query.batch : "";
  const pageId = query.page_id && uuidPattern.test(query.page_id) ? query.page_id : "";
  const pageSearch = (query.page_search || "").trim().slice(0, 80);
  const batchDirection = query.batch_direction === "previous" ? "previous" : "next";
  const batchCursor = decodePageCursor(query.batch_cursor);
  const direction = query.direction === "previous" ? "previous" : "next";
  const cursor = decodePageCursor(query.cursor);

  let batchQuery = supabase.from("card_batches").select("id,name,quantity,batch_code,created_at")
    .order("created_at", { ascending: batchDirection === "previous" }).order("id", { ascending: batchDirection === "previous" }).limit(ADMIN_PAGE_SIZE + 1);
  if (batchCursor) batchQuery = batchQuery.or(cursorFilter(batchCursor, batchDirection));
  const [{ data: batches }, { data: pages }] = await Promise.all([
    batchQuery,
    supabase.from("business_pages").select("id,slug,branch_name,is_active,published_snapshot_id,businesses!inner(name,status)").ilike("slug", `%${pageSearch.replace(/[%_]/g, "")}%`).order("slug").limit(101),
  ]);
  let batchRows = batches || [];
  const batchesHasMore = batchRows.length > ADMIN_PAGE_SIZE;
  if (batchesHasMore) batchRows = batchRows.slice(0, ADMIN_PAGE_SIZE);
  if (batchDirection === "previous") batchRows.reverse();
  if (batchId && !batchRows.some((batch: any) => batch.id === batchId)) {
    const { data: selectedBatch } = await supabase.from("card_batches").select("id,name,quantity,batch_code,created_at").eq("id", batchId).maybeSingle();
    if (selectedBatch) batchRows = [selectedBatch, ...batchRows];
  }
  const firstBatch = batchRows[0];
  const lastBatch = batchRows[batchRows.length - 1];
  const nextBatchesHref = batchesHasMore && lastBatch ? pageUrl("/admin/cards", { search: search || undefined, status: status || undefined, batch: batchId || undefined, page_id: pageId || undefined, batch_cursor: encodePageCursor(cursorForRow(lastBatch)), batch_direction: "next" }) : undefined;
  const previousBatchesHref = batchCursor && firstBatch ? pageUrl("/admin/cards", { search: search || undefined, status: status || undefined, batch: batchId || undefined, page_id: pageId || undefined, batch_cursor: encodePageCursor(cursorForRow(firstBatch)), batch_direction: "previous" }) : undefined;

  let cardQuery = supabase
    .from("cards")
    .select("id,serial,token,page_id,batch_id,status,created_at")
    .order("created_at", { ascending: direction === "previous" })
    .order("id", { ascending: direction === "previous" })
    .limit(ADMIN_PAGE_SIZE + 1);

  if (search) {
    // The search alphabet excludes PostgREST filter syntax characters.
    cardQuery = cardQuery.or(`serial.ilike.%${search}%,token.ilike.%${search}%`);
  }
  if (status) cardQuery = cardQuery.eq("status", status);
  if (batchId) cardQuery = cardQuery.eq("batch_id", batchId);
  if (pageId) cardQuery = cardQuery.eq("page_id", pageId);
  if (cursor) cardQuery = cardQuery.or(cursorFilter(cursor, direction));

  const { data: cards } = await cardQuery;
  let cardRows = cards || [];
  const cardsHasMore = cardRows.length > ADMIN_PAGE_SIZE;
  if (cardsHasMore) cardRows = cardRows.slice(0, ADMIN_PAGE_SIZE);
  if (direction === "previous") cardRows.reverse();
  let allPages = (pages || []) as any[];
  const visiblePageIds = new Set(cardRows.map((card: any) => card.page_id).filter(Boolean));
  const missingPageIds = [...visiblePageIds].filter((id) => !allPages.some((page) => page.id === id));
  if (missingPageIds.length) {
    const { data: assignedPages } = await supabase.from("business_pages").select("id,slug,branch_name,is_active,published_snapshot_id,businesses!inner(name,status)").in("id", missingPageIds);
    allPages = allPages.concat(assignedPages || []);
  }
  const pageFilterParams = { search: search || undefined, status: status || undefined, batch: batchId || undefined, page_id: pageId || undefined, page_search: pageSearch || undefined };
  const eligiblePages = allPages.filter((page: any) =>
    page.is_active && page.published_snapshot_id && page.businesses?.status === "active",
  );
  const pageById = new Map(allPages.map((page: any) => [page.id, page]));
  const filtersActive = Boolean(search || status || batchId || pageId);
  const firstCard = cardRows[0];
  const lastCard = cardRows[cardRows.length - 1];
  const cardFilters = pageFilterParams;
  const nextCardsHref = cardsHasMore && lastCard ? pageUrl("/admin/cards", { ...cardFilters, cursor: encodePageCursor(cursorForRow(lastCard)), direction: "next" }) : undefined;
  const previousCardsHref = cursor && firstCard ? pageUrl("/admin/cards", { ...cardFilters, cursor: encodePageCursor(cursorForRow(firstCard)), direction: "previous" }) : undefined;
  const errorMessages: Record<string, string> = {
    name: "اكتب اسماً صالحاً للدفعة.",
    quantity: "اختر كمية بين 1 و1,000 بطاقة.",
    request: "تعذر التحقق من طلب الدفعة. أعد تحميل الصفحة وحاول مرة أخرى.",
    batch: "تعذر إنشاء دفعة البطاقات. تأكد من تحديث قاعدة البيانات ثم حاول مرة أخرى.",
    confirmation: "فعّل خانة التأكيد قبل تحديث تعيين البطاقة.",
    assignment: "تعذر تحديث تعيين البطاقة. راجع الصفحة المنشورة المحددة.",
  };

  return (
    <>
      <div className="admin-title"><h1>البطاقات</h1></div>
      {query.error && <div className="alert" role="alert">{errorMessages[query.error] || "تعذر تنفيذ العملية. حاول مرة أخرى."}</div>}
      {query.assigned && <div className="alert success" role="status">تم تحديث تعيين البطاقة.</div>}

      <nav className="card-section-tabs" aria-label="أقسام البطاقات">
        <a href="#overview">نظرة عامة</a><a href="#production">دفعات الإنتاج</a><a href="#inventory">المخزون</a>
      </nav>
      <section id="overview" className="form-card">
        <h2>نظرة عامة</h2>
        <p>أنشئ بطاقات غير معيّنة للتصنيع الخارجي. تبقى روابط QR وNFC ثابتة، ولا يحدث التفعيل أو التعيين أثناء التصنيع.</p>
        <div className="stats">
          <div className="stat"><strong>{batchRows.length}</strong><span>دفعات الإنتاج</span></div>
          <div className="stat"><strong>{cardRows.length}</strong><span>{filtersActive ? "بطاقات مطابقة" : "بطاقات ظاهرة في المخزون"}</span></div>
          <div className="stat"><strong>{(cardRows as any[]).filter((card) => card.status === "unassigned").length}</strong><span>غير معيّنة في النتائج</span></div>
        </div>
      </section>

      <section id="production" className="form-card">
        <h2>دفعات الإنتاج</h2>
        <form action={createBatch} className="form-grid batch-create-form">
          <input type="hidden" name="idempotency_key" value={randomUUID()} />
          <label className="field">اسم الدفعة
            <input className="control" name="name" placeholder="مثال: دفعة المطبعة الأولى" minLength={1} maxLength={100} required />
          </label>
          <label className="field">الكمية (من 1 إلى 1,000)
            <input className="control" name="quantity" type="number" min="1" max="1000" defaultValue="100" required />
          </label>
          <div className="batch-output-review">
            <strong>مراجعة ملفات التصنيع</strong>
            <span>ملف ZIP يتضمن qr-index.html لمطابقة كل QR مع الرقم التسلسلي، وmanifest.csv وnfc-encoding.csv وملف SVG لكل بطاقة.</span>
            <span>كل بطاقة تبدأ بحالة غير معيّنة، مع رقم تسلسلي ثابت ورابطين دائمين.</span>
          </div>
          <SubmitButton className="button gold" pendingText="جارٍ التنفيذ...">إنشاء دفعة</SubmitButton>
        </form>
      </section>

      <section className="production-batches" aria-label="دفعات الإنتاج">
        {(batchRows as any[]).map((batch: any) => (
          <article className="form-card batch-summary" key={batch.id}>
            <div><strong>{batch.name}</strong><div className="muted" dir="ltr">{batch.batch_code} · {new Date(batch.created_at).toLocaleDateString("ar-EG")} · {batch.quantity} بطاقة</div></div>
            <div className="inline">
              <a className="button gold" href={`/admin/cards/batches/${batch.id}`}>تفاصيل وتنزيل ZIP</a>
              <a className="button secondary" href={`/admin/cards/export?batch=${batch.id}`}>تنزيل CSV</a>
              <a className="button secondary" href={`/admin/cards/batches/${batch.id}#preview`}>معاينة QR</a>
            </div>
          </article>
        ))}
        {batchRows.length === 0 && <p className="notice">لا توجد دفعات إنتاج بعد.</p>}
        {(nextBatchesHref || previousBatchesHref || batchCursor) && <nav className="pagination" aria-label="تنقل دفعات الإنتاج"><a className={previousBatchesHref ? "button secondary" : "button secondary disabled"} aria-disabled={!previousBatchesHref} href={previousBatchesHref || "/admin/cards"}>السابق</a><a className="button secondary" href="/admin/cards">الأولى</a><a className={nextBatchesHref ? "button secondary" : "button secondary disabled"} aria-disabled={!nextBatchesHref} href={nextBatchesHref || "/admin/cards"}>التالي</a></nav>}
      </section>

      <section id="inventory" className="form-card" aria-labelledby="card-filters-title">
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
            <input className="control" name="page_search" defaultValue={pageSearch} maxLength={80} placeholder="ابحث في المواقع" dir="auto" />
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

      <h2>المخزون · {filtersActive ? `${cardRows.length} نتيجة معروضة` : `${cardRows.length} بطاقة معروضة`}</h2>
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
              <th>رابط QR</th>
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
                    <CardHistory cardId={card.id} />
                  </td>
                  <td>{card.status}</td>
                  <td>{assignedPage
                    ? `${assignedBusiness?.name || ""} / ${assignedPage.slug}${(!assignedPage.is_active || !assignedPage.published_snapshot_id || assignedBusiness?.status !== "active") ? " (غير متاح)" : ""}`
                    : "—"}</td>
                  <td dir="ltr"><a className="encoded-url" href={cardUrls(card.token, requestOrigin).qrUrl} target="_blank" rel="noreferrer">{cardUrls(card.token, requestOrigin).qrUrl}</a></td>
                  <td><CopyNfcUrl token={card.token} /></td>
                  <td>
                    <form id={`assign-card-${card.id}`} action={assignCard} className="inline card-assignment-form">
                      <input type="hidden" name="card_id" value={card.id} />
                      <input type="hidden" name="confirm" value="on" />
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
                      <ConfirmSubmitButton targetForm={`assign-card-${card.id}`} disabled={eligiblePages.length === 0} className="button" title="تأكيد تعيين البطاقة" message={`سيتم تفعيل البطاقة ${card.serial} وربطها بالصفحة المختارة.`} confirmLabel="تأكيد التعيين" cancelLabel="إلغاء" dialogLabel="تأكيد" pendingText="جارٍ تحديث البطاقة...">تفعيل / نقل</ConfirmSubmitButton>
                    </form>
                    <form id={`disable-card-${card.id}`} action={assignCard} className="inline card-disable-form">
                      <input type="hidden" name="card_id" value={card.id} />
                      <input type="hidden" name="mode" value="disable" />
                      <input type="hidden" name="confirm" value="on" />
                      <ConfirmSubmitButton targetForm={`disable-card-${card.id}`} className="small-button danger" title="تعطيل البطاقة" message={`سيتم تعطيل البطاقة ${card.serial}. يمكنك إعادة تفعيلها من لوحة البطاقات.`} confirmLabel="تعطيل البطاقة" cancelLabel="إلغاء" dialogLabel="تأكيد" pendingText="جارٍ التعطيل...">تعطيل</ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {cardRows.length === 0 && (
              <tr><td colSpan={6}>لا توجد بطاقات تطابق عوامل التصفية.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(nextCardsHref || previousCardsHref || cursor) && <nav className="pagination" aria-label="تنقل المخزون">
        <a className={previousCardsHref ? "button secondary" : "button secondary disabled"} aria-disabled={!previousCardsHref} href={previousCardsHref || "/admin/cards"}>السابق</a>
        <a className="button secondary" href={pageUrl("/admin/cards", cardFilters)}>الأولى</a>
        <a className={nextCardsHref ? "button secondary" : "button secondary disabled"} aria-disabled={!nextCardsHref} href={nextCardsHref || pageUrl("/admin/cards", cardFilters)}>التالي</a>
      </nav>}
    </>
  );
}
