import Link from "next/link";

export function BrandLogo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return <Link className={`brand-logo-link ${className}`} href={href} aria-label="NexTap الرئيسية">
    <img className="brand-logo" src="/nextap_logo_vector.svg" alt="NexTap" width="1310" height="341" />
  </Link>;
}
