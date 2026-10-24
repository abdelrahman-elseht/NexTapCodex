import type { ContactProjection } from "./contact";
import type { ProviderProfile } from "./providers";

export type PublicationSection = { key?: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
/** Read model shared by public rendering and publication RPC consumers. */
export type PublicationSnapshot = { business?: { name?: string; category?: string }; contact?: ContactProjection; page?: { slug?: string; branchName?: string; template?: string }; providerProfiles?: Record<string, ProviderProfile>; sections?: PublicationSection[]; publicationId?: string; version?: number };
