-- Approved page-level Menu flag. Publication services copy this value into
-- each immutable snapshot when constructing the published representation.
ALTER TABLE business_pages ADD COLUMN has_menu INTEGER NOT NULL DEFAULT 0
  CHECK (has_menu IN (0, 1));
