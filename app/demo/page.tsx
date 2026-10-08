import Link from "next/link";
import { PublicSnapshot } from "@/components/public-snapshot";

const snapshot = {
  business: { name: "قهوة ومزاج", category: "مقهى · القاهرة الجديدة" },
  sections: [
    { key: "hero", kind: "hero", title: "الرئيسية", position: 0, enabled: true, content: { tagline: "قهوة مختصة ومخبوزات طازجة كل يوم.", language: "ar", color: "#bb9659" } },
    { key: "about", kind: "about", title: "عن النشاط", position: 1, enabled: true, content: { description: "نموذج تجريبي يوضح كيف يمكن للنشاط عرض معلوماته وخدماته." } },
    { key: "contact", kind: "contact", title: "تواصل معنا", position: 2, enabled: true, content: { mapsUrl: "https://maps.google.com/?q=Cairo", address: "القاهرة الجديدة" } },
    { key: "hours", kind: "hours", title: "مواعيد العمل", position: 3, enabled: true, content: { items: [{ label: "يومياً", value: "8 صباحاً حتى 12 مساءً" }] } },
    { key: "services", kind: "services", title: "قائمتنا", position: 4, enabled: true, content: { items: [{ label: "قهوة اليوم", value: "مثال على عنصر في القائمة" }, { label: "لاتيه", value: "مثال على مشروب" }] } },
    { key: "payments", kind: "payments", title: "طرق الدفع", position: 5, enabled: true, content: { items: [{ label: "InstaPay", value: "تُضاف بيانات الدفع الخاصة بالنشاط" }] } },
    { key: "social", kind: "social", title: "تابعنا", position: 6, enabled: true, content: { items: [{ label: "Instagram", url: "https://instagram.com/" }, { label: "TikTok", url: "https://tiktok.com/" }] } },
    { key: "reviews", kind: "reviews", title: "رأيك يهمنا", position: 7, enabled: true, content: { url: "https://www.google.com/maps/search/?api=1&query=coffee+shop+Cairo" } },
  ],
};

export default function Demo() {
  return (
    <>
      <p className="demo-disclaimer" role="note">نموذج تجريبي · البيانات توضيحية للاستخدام</p>
      <PublicSnapshot snapshot={snapshot} />
      <p className="demo-back-link"><Link href="/" className="muted">العودة إلى NexTap</Link></p>
    </>
  );
}
