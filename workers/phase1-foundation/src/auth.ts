export type StaffIdentity = {
  subject: string;
  active: boolean;
  globalCapabilities: readonly string[];
  businessCapabilities: Readonly<Record<string, readonly string[]>>;
};

export type AuthorizationRequest = {
  identity: StaffIdentity | null | undefined;
  capability: string;
  scope?: { kind: "global" } | { kind: "business"; businessId: string };
};

export type AuthorizationDecision =
  | { allowed: true; subject: string }
  | { allowed: false; reason: "unauthenticated" | "inactive" | "capability" | "business_scope" };

export type LegacyStaffRole = "administrator" | "publisher" | "editor" | "inventory" | "auditor";

const roleCapabilities: Readonly<Record<LegacyStaffRole, readonly string[]>> = {
  administrator: ["read", "edit", "media", "publish", "inventory", "export", "delete"],
  publisher: ["read", "edit", "media", "publish"],
  editor: ["read", "edit", "media"],
  inventory: ["read", "inventory", "export"],
  auditor: ["read"],
};

/** Maps known, server-verified legacy staff roles to their initial global capabilities. */
export function capabilitiesForLegacyRole(role: string | null | undefined): readonly string[] {
  if (!role || !Object.hasOwn(roleCapabilities, role)) return [];
  return roleCapabilities[role as LegacyStaffRole];
}

/**
 * `identity` must come from the server-side Access JWT verifier and staff lookup.
 * Request data, Access headers, and caller-supplied roles are never identities.
 */
export function authorizeStaffOperation({ identity, capability, scope }: AuthorizationRequest): AuthorizationDecision {
  if (!identity || !identity.subject) return { allowed: false, reason: "unauthenticated" };
  if (!identity.active) return { allowed: false, reason: "inactive" };
  if (!scope) return { allowed: false, reason: "business_scope" };
  if (scope.kind === "global") {
    if (!capability.startsWith("staff:")) return { allowed: false, reason: "business_scope" };
    if (!identity.globalCapabilities.includes(capability)) return { allowed: false, reason: "capability" };
  } else {
    if (typeof scope.businessId !== "string" || scope.businessId.trim() === "") {
      return { allowed: false, reason: "business_scope" };
    }
    if (!identity.globalCapabilities.includes(capability) && !identity.businessCapabilities[scope.businessId]?.includes(capability)) {
      return { allowed: false, reason: "business_scope" };
    }
  }

  return { allowed: true, subject: identity.subject };
}

export type ServiceCredentialVerifier = (request: Request) => Promise<boolean>;

/** Service access stays closed until a server-only credential verifier is supplied. */
export async function authorizeServiceRequest(
  request: Request,
  verifyCredential?: ServiceCredentialVerifier,
): Promise<boolean> {
  if (!verifyCredential) return false;
  try {
    return await verifyCredential(request);
  } catch {
    return false;
  }
}
