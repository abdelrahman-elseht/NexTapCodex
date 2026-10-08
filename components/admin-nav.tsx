import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
export function AdminNav() {
  return <div className="admin-top"><div className="container"><BrandLogo href="/admin"/><nav className="admin-nav"><Link href="/admin">الرئيسية</Link><Link href="/admin/businesses/new">إضافة نشاط</Link><Link href="/admin/cards">البطاقات</Link><form action="/auth/signout" method="post"><button className="small-button">خروج</button></form></nav></div></div>;
}
