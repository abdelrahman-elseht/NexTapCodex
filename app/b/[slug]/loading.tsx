export default function BusinessLoading() {
  return <main className="public-page premium-public public-loading" aria-busy="true">
    <p role="status" className="route-status">Loading business page · جارٍ تحميل صفحة النشاط</p>
    <article className="business-wrap" aria-hidden="true">
      <div className="business-hero"><div className="hero-content"><div className="business-logo skeleton" /><div className="skeleton skeleton-line" style={{ width: 210, height: 32 }} /><div className="skeleton skeleton-line" style={{ width: 260 }} /></div></div>
      <div className="quick-actions">{[0,1,2,3].map(key => <div className="skeleton skeleton-block" key={key} style={{ margin: 0, height: 60 }} />)}</div>
      {[0,1].map(key => <div className="business-section" key={key}><div className="skeleton skeleton-line" style={{ width: "55%", height: 24 }} /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line" /></div>)}
    </article>
  </main>;
}
