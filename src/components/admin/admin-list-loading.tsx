export function AdminListLoading() {
  return <div className="admin-list-loading" aria-busy="true">
    <p role="status" className="route-status">Loading list · جارٍ تحميل القائمة</p>
    <div aria-hidden="true"><div className="admin-title"><div className="skeleton skeleton-line" style={{ width: "40%", height: 40 }} /></div>
      <div className="skeleton skeleton-block" style={{ height: 88 }} />
      <div className="table-wrap">{[0,1,2,3,4].map(key => <div className="list-loading-row" key={key}>{[0,1,2].map(column => <div className="skeleton skeleton-line" key={column} />)}</div>)}</div>
    </div>
  </div>;
}
