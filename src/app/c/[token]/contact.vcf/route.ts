import { downloadContact } from "@/lib/business/contact-download";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) { return downloadContact(await params); }
export async function HEAD(_: Request, { params }: { params: Promise<{ token: string }> }) { return downloadContact(await params, true); }
