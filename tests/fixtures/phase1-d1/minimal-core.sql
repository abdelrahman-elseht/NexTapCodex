INSERT INTO businesses (id, name, category, status, created_at, updated_at)
VALUES ('biz-test-01', 'Fixture Business', 'services', 'active', '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');

INSERT INTO business_pages (id, business_id, page_type, template, draft_revision, created_at, updated_at)
VALUES ('page-test-01', 'biz-test-01', 'main', 'professional', 1, '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');

INSERT INTO slug_registry (slug, page_id, kind, created_at) VALUES
  ('fixture-business', 'page-test-01', 'canonical', '2026-11-13T00:00:00Z'),
  ('fixture-old-name', 'page-test-01', 'alias', '2026-11-13T00:00:00Z');

INSERT INTO page_sections (id, page_id, section_key, title, position, enabled, kind, content_json, created_at, updated_at)
VALUES ('section-test-01', 'page-test-01', 'contact', 'Contact', 0, 1, 'contact', '{"phone":"+15550000000"}', '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');

INSERT INTO page_publications (id, page_id, version, snapshot_json, artifact_key, manifest_json, manifest_sha256, published_by_subject, verified_at, created_at)
VALUES ('pub-test-01', 'page-test-01', 1, '{"contact":{"version":1,"enabled":true,"displayName":"Fixture Business","organization":"","primaryPhone":"+15550000000","fields":[]},"page":{"hasMenu":false},"sections":[]}', 'publications/page-test-01/1/index.html', '{"objects":[]}', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'staff-test-01', '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');

UPDATE business_pages SET published_publication_id = 'pub-test-01', is_active = 1 WHERE id = 'page-test-01';

INSERT INTO card_batches (id, name, quantity, created_by_subject, created_at)
VALUES ('batch-test-01', 'Fixture batch', 1, 'staff-test-01', '2026-11-13T00:00:00Z');

INSERT INTO cards (id, batch_id, serial, token, page_id, status, created_at, updated_at)
VALUES ('card-test-01', 'batch-test-01', 'NT-20261113-000001', 'FixtureToken0123456789012345678901', 'page-test-01', 'active', '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');

INSERT INTO card_assignment_history (id, card_id, new_page_id, old_status, new_status, changed_by_subject, reason, created_at)
VALUES ('history-test-01', 'card-test-01', 'page-test-01', 'unassigned', 'active', 'staff-test-01', 'assignment', '2026-11-13T00:00:00Z');

INSERT INTO audit_events (id, actor_subject, action, entity_type, entity_id, details_json, created_at)
VALUES ('audit-test-01', 'staff-test-01', 'card.assign', 'card', 'card-test-01', '{"reason":"fixture"}', '2026-11-13T00:00:00Z');

INSERT INTO operation_receipts (actor_subject, operation, idempotency_key, request_fingerprint, entity_id, result_json, created_at)
VALUES ('staff-test-01', 'card.assign', 'request-test-01', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'card-test-01', '{"ok":true}', '2026-11-13T00:00:00Z');
