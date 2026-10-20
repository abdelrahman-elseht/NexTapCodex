import { downloadContact } from "@/lib/business/contact-download";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) { return downloadContact(await params, false, new URL(request.url).searchParams.get("download") === "1"); }
export async function HEAD(request: Request, { params }: { params: Promise<{ slug: string }> }) { return downloadContact(await params, true, new URL(request.url).searchParams.get("download") === "1"); }
