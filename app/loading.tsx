export default function Loading() {
  return (
    <main className="status-screen" aria-busy="true" aria-label="جارٍ تحميل الصفحة">
      <section className="status-card" style={{ width: "min(680px, 100%)" }}>
        <div className="skeleton skeleton-line" style={{ width: "35%" }} />
        <div className="skeleton skeleton-line" style={{ width: "68%", height: 30 }} />
        <div className="skeleton skeleton-line" style={{ width: "88%" }} />
        <div className="skeleton skeleton-block" />
      </section>
    </main>
  );
}
