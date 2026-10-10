import { requireOwner } from "@/lib/auth/owner";
import { AdminNav } from "@/components/admin/admin-nav";
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireOwner();
  return <div className="admin-shell"><AdminNav/><main className="admin-main"><div className="container">{children}</div></main></div>;
}