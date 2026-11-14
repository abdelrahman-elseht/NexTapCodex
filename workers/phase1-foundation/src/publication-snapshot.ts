export type ContactProjectionV1 = {
  version: 1;
  enabled: true;
  displayName: string;
  organization: string;
  primaryPhone: string;
  primaryPhoneType?: string;
  fields: readonly {
    kind: string;
    label: string;
    value: string;
    phoneType?: string;
  }[];
  photoPath?: string;
  showDownloadLink?: boolean;
};

export type PublicationSnapshotInput = {
  business?: Record<string, unknown>;
  contactProjection?: Omit<ContactProjectionV1, "version"> & { version: number };
  page: {
    has_menu: boolean;
    [key: string]: unknown;
  };
  providerProfiles?: Record<string, unknown>;
  sections?: readonly Record<string, unknown>[];
  publicationId?: string;
  version?: number;
};

/** Serializes the single immutable snapshot record, including published-only contact data. */
export function serializePublicationSnapshot(input: PublicationSnapshotInput): string {
  if (typeof input.page.has_menu !== "boolean") {
    throw new TypeError("Page has_menu must be a boolean.");
  }
  if (input.contactProjection && input.contactProjection.version !== 1) {
    throw new TypeError("Unsupported contact projection version.");
  }

  const { has_menu: hasMenu, ...page } = input.page;
  return JSON.stringify({
    ...(input.business ? { business: input.business } : {}),
    ...(input.contactProjection ? { contact: input.contactProjection } : {}),
    page: { ...page, hasMenu },
    ...(input.providerProfiles ? { providerProfiles: input.providerProfiles } : {}),
    ...(input.sections ? { sections: input.sections } : {}),
    ...(input.publicationId ? { publicationId: input.publicationId } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  });
}
