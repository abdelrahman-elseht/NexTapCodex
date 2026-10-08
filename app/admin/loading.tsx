export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل بيانات الإدارة">
      <div className="skeleton skeleton-line" style={{ width: "34%", height: 32, marginBottom: 28 }} />
      <div className="stats">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
      <div className="skeleton skeleton-block" style={{ height: 280 }} />
    </div>
  );
}
