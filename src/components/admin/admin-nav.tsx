import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

export function AdminNav() {
  return (
    <header className="admin-top">
      <div className="admin-top-inner">
        <BrandLogo href="/admin" />
        <nav className="admin-nav" aria-label="القائمة الإدارية">
          <Link href="/admin">الرئيسية</Link>
          <Link href="/admin/businesses">الأنشطة</Link>
          <Link href="/admin/businesses/new">نشاط جديد</Link>
          <Link href="/admin/cards">البطاقات</Link>
          <form action="/auth/signout" method="post">
            <button className="small-button signout" type="submit">خروج</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
