import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function NotFound() {
  return <main className="status-screen"><section className="card"><BrandLogo/><h1>الصفحة غير موجودة</h1><p>تحقق من الرابط أو عُد إلى الصفحة الرئيسية.</p><Link className="button secondary" href="/">العودة للرئيسية</Link></section></main>;
}
