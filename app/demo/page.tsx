import Link from "next/link";
import { PublicSnapshot } from "@/components/public-snapshot";

const snapshot = {
  business: { name: "قهوة ومزاج", category: "مقهى · القاهرة الجديدة" },
  sections: [
    { key: "hero", kind: "hero", title: "الرئيسية", position: 0, enabled: true, content: { tagline: "قهوة مختصة ومخبوزات طازجة كل يوم.", color: "#bb9659" } },
    { key: "contact", kind: "contact", title: "تواصل معنا", position: 1, enabled: true, content: { whatsapp: "201000000000", mapsUrl: "https://maps.google.com/?q=Cairo", address: "القاهرة الجديدة" } },
    { key: "hours", kind: "hours", title: "مواعيد العمل", position: 2, enabled: true, content: { items: [{ label: "يومياً", value: "8 صباحاً حتى 12 مساءً" }] } },
    { key: "services", kind: "services", title: "قائمتنا", position: 3, enabled: true, content: { items: [{ label: "قهوة اليوم", value: "ابتداءً من 80 ج.م" }, { label: "لاتيه", value: "ابتداءً من 90 ج.م" }] } },
    { key: "social", kind: "social", title: "تابعنا", position: 4, enabled: true, content: { items: [{ label: "Instagram", url: "https://instagram.com/" }, { label: "TikTok", url: "https://tiktok.com/" }] } },
    { key: "reviews", kind: "reviews", title: "رأيك يهمنا", position: 5, enabled: true, content: { url: "https://www.google.com/maps/search/?api=1&query=coffee+shop+Cairo" } },
  ],
};

export default function Demo() {
  return <><PublicSnapshot snapshot={snapshot}/><p style={{ textAlign: "center", margin: "-28px 0 24px" }}><Link href="/" className="muted">العودة للرئيسية</Link></p></>;
}
