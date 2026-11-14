-- Every stored historical slug remains a resolving alias; there is no reserved-only state.
-- Canonical and alias slugs share one unique namespace and point to their owning page.

ALTER TABLE slug_registry RENAME TO slug_registry_v1;

CREATE TABLE slug_registry (
  slug TEXT PRIMARY KEY NOT NULL CHECK (length(slug) > 0),
  page_id TEXT NOT NULL REFERENCES business_pages(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('canonical', 'alias')),
  created_at TEXT NOT NULL
);

INSERT INTO slug_registry (slug, page_id, kind, created_at)
SELECT slug, page_id, CASE WHEN kind = 'reserved' THEN 'alias' ELSE kind END, created_at
FROM slug_registry_v1;

DROP TABLE slug_registry_v1;

CREATE UNIQUE INDEX slug_registry_one_canonical_per_page_idx
  ON slug_registry(page_id) WHERE kind = 'canonical';
CREATE INDEX slug_registry_page_idx ON slug_registry(page_id);
