import Link from "next/link";
import { PublicSnapshot } from "@/components/public-snapshot";

const snapshot = { business: { name: "Coffee & Mood", category: "Coffee shop — New Cairo" }, sections: [
  { key: "hero", kind: "hero", title: "Hero", position: 0, enabled: true, content: { tagline: "Specialty coffee and fresh bakes every day.", language: "en", location: "New Cairo", openingSummary: "Open today — 8am–12am" } },
  { key: "social", kind: "social", title: "Social & Community", position: 1, enabled: true, content: { items: [
    { label: "Instagram", provider: "instagram", url: "https://instagram.com/" }, { label: "Facebook", provider: "facebook", url: "https://facebook.com/" },
    { label: "WhatsApp", provider: "whatsapp", url: "https://wa.me/201000000000", value: "+20 100 000 0000" }, { label: "TikTok", provider: "tiktok", url: "https://tiktok.com/" },
    { label: "Snapchat", provider: "snapchat", url: "https://snapchat.com/" }, { label: "YouTube", provider: "youtube", url: "https://youtube.com/" },
    { label: "X", provider: "x", url: "https://x.com/" }, { label: "Website", provider: "website", url: "https://example.com/" },
  ] } },
  { key: "payments", kind: "payments", title: "Easy & Secure Payments", position: 2, enabled: true, content: { items: [
    { label: "InstaPay", provider: "instapay", value: "coffee.mood@instapay" }, { label: "Vodafone Cash", provider: "vodafone", value: "+20 100 000 0000" },
    { label: "Bank instructions", provider: "bank", value: "Ask the team for account details" },
  ] } },
  { key: "reviews", kind: "reviews", title: "Loved by our customers", position: 3, enabled: true, content: { url: "https://www.google.com/maps/search/?api=1&query=coffee+shop+Cairo" } },
  { key: "contact", kind: "contact", title: "Find Us", position: 4, enabled: true, content: { mapsUrl: "https://maps.google.com/?q=Cairo", address: "New Cairo, Egypt" } },
  { key: "hours", kind: "hours", title: "Open Daily", position: 5, enabled: true, content: { items: [
    { label: "Mon — Thu", value: "8:00 am — 11:00 pm" }, { label: "Friday", value: "8:00 am — 12:00 am" },
    { label: "Saturday", value: "8:00 am — 12:00 am" }, { label: "Sunday", value: "8:00 am — 11:00 pm" },
  ] } },
] };

export default function Demo() { return <><p className="demo-disclaimer" role="note">Demo — illustrative content for preview only</p><PublicSnapshot snapshot={snapshot} /><p className="demo-back-link"><Link href="/" className="muted">Back to NexTap</Link></p></>; }
