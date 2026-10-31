import type { ContactProjectionV1 } from "@/lib/contracts/contact-projection-v1";
import type { ProviderProfile } from "./providers";

export type PublicationSection = { key?: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
/** Read model shared by public rendering and publication RPC consumers. */
export type PublicationSnapshot = { business?: { name?: string; category?: string }; contact?: ContactProjectionV1; page?: { slug?: string; branchName?: string; template?: string }; providerProfiles?: Record<string, ProviderProfile>; sections?: PublicationSection[]; publicationId?: string; version?: number };
