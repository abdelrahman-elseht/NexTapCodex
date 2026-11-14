-- Candidate Phase 1 schema. Application services own workflows and authorization.
-- IDs and timestamps are supplied by the application to preserve imported identity.

CREATE TABLE businesses (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  category TEXT NOT NULL DEFAULT 'business' CHECK (length(category) <= 80),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  provider_profiles_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(provider_profiles_json) AND length(CAST(provider_profiles_json AS BLOB)) <= 65536),
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_pages (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  parent_page_id TEXT,
  page_type TEXT NOT NULL CHECK (page_type IN ('main', 'branch')),
  branch_name TEXT,
  contact_config_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(contact_config_json) AND length(CAST(contact_config_json AS BLOB)) <= 65536),
  template TEXT NOT NULL CHECK (template IN ('cafe', 'restaurant', 'salon', 'retail', 'professional')),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  published_publication_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, business_id),
  CHECK (
    (page_type = 'main' AND parent_page_id IS NULL AND branch_name IS NULL)
    OR (page_type = 'branch' AND branch_name IS NOT NULL AND length(branch_name) > 0)
  ),
  CHECK (is_active = 0 OR published_publication_id IS NOT NULL),
  FOREIGN KEY (parent_page_id, business_id)
    REFERENCES business_pages(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (published_publication_id, id)
    REFERENCES page_publications(id, page_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX business_pages_one_main_per_business_idx
  ON business_pages(business_id) WHERE page_type = 'main';
CREATE UNIQUE INDEX business_pages_branch_name_idx
  ON business_pages(business_id, branch_name) WHERE page_type = 'branch';
CREATE INDEX business_pages_business_idx ON business_pages(business_id);

CREATE TABLE page_sections (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES business_pages(id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL CHECK (length(section_key) BETWEEN 1 AND 40),
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 32767),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  kind TEXT NOT NULL CHECK (kind IN (
    'hero', 'about', 'hours', 'contact', 'quick_actions', 'social', 'payments',
    'links', 'services', 'gallery', 'reviews', 'branch'
  )),
  content_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(content_json) AND length(CAST(content_json AS BLOB)) <= 65536),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (page_id, section_key),
  UNIQUE (page_id, position)
);
CREATE INDEX page_sections_order_idx ON page_sections(page_id, position);

-- Canonical slugs and aliases share one globally unique namespace. A reserved row
-- keeps a historical slug unavailable if a future approved policy stops resolving it.
CREATE TABLE slug_registry (
  slug TEXT PRIMARY KEY NOT NULL CHECK (length(slug) > 0),
  page_id TEXT NOT NULL REFERENCES business_pages(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('canonical', 'alias', 'reserved')),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX slug_registry_one_canonical_per_page_idx
  ON slug_registry(page_id) WHERE kind = 'canonical';
CREATE INDEX slug_registry_page_idx ON slug_registry(page_id);

CREATE TABLE page_publications (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES business_pages(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot_json TEXT NOT NULL
    CHECK (json_valid(snapshot_json) AND length(CAST(snapshot_json AS BLOB)) <= 262144),
  artifact_key TEXT NOT NULL UNIQUE,
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  published_by_subject TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (page_id, version),
  UNIQUE (id, page_id)
);
CREATE INDEX page_publications_latest_idx ON page_publications(page_id, version DESC);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
  created_at TEXT NOT NULL
);
CREATE INDEX media_assets_business_idx ON media_assets(business_id);

CREATE TABLE publication_media (
  publication_id TEXT NOT NULL REFERENCES page_publications(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  PRIMARY KEY (publication_id, object_key)
);
CREATE INDEX publication_media_object_idx ON publication_media(object_key, publication_id);

CREATE TABLE card_batches (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  created_by_subject TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY NOT NULL,
  batch_id TEXT NOT NULL REFERENCES card_batches(id) ON DELETE RESTRICT,
  serial TEXT NOT NULL UNIQUE CHECK (length(serial) = 18 AND substr(serial, 1, 3) = 'NT-' AND substr(serial, 4, 8) NOT GLOB '*[^0-9]*' AND substr(serial, 12, 1) = '-' AND substr(serial, 13, 6) NOT GLOB '*[^0-9]*'),
  token TEXT NOT NULL UNIQUE CHECK (length(token) BETWEEN 32 AND 64 AND token NOT GLOB '*[^A-Za-z0-9_-]*'),
  page_id TEXT REFERENCES business_pages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned', 'active', 'disabled', 'replaced')),
  inventory_revision INTEGER NOT NULL DEFAULT 0 CHECK (inventory_revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status <> 'active' OR page_id IS NOT NULL)
);
CREATE INDEX cards_page_status_idx ON cards(page_id, status);
CREATE INDEX cards_batch_created_idx ON cards(batch_id, created_at);

CREATE TABLE card_assignment_history (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  old_page_id TEXT REFERENCES business_pages(id) ON DELETE RESTRICT,
  new_page_id TEXT REFERENCES business_pages(id) ON DELETE RESTRICT,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by_subject TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('assignment', 'activation', 'deactivation', 'reassignment', 'replacement')
  ),
  created_at TEXT NOT NULL
);
CREATE INDEX card_history_card_created_idx
  ON card_assignment_history(card_id, created_at DESC, id DESC);
CREATE INDEX card_history_new_page_idx ON card_assignment_history(new_page_id);
CREATE INDEX card_history_old_page_idx ON card_assignment_history(old_page_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_subject TEXT NOT NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(details_json) AND length(CAST(details_json AS BLOB)) <= 8192),
  created_at TEXT NOT NULL
);
CREATE INDEX audit_events_created_idx ON audit_events(created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events(actor_subject);

CREATE TABLE operation_receipts (
  actor_subject TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  entity_id TEXT,
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (actor_subject, operation, idempotency_key)
);
