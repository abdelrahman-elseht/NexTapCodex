import Link from "next/link";
export function AdminNav() {
  return <div className="admin-top"><div className="container"><Link className="brand" href="/admin">Nex<span className="brand-mark">Tap</span></Link><nav className="admin-nav"><Link href="/admin">الرئيسية</Link><Link href="/admin/businesses/new">إضافة نشاط</Link><Link href="/admin/cards">البطاقات</Link><form action="/auth/signout" method="post"><button className="small-button">خروج</button></form></nav></div></div>;
}