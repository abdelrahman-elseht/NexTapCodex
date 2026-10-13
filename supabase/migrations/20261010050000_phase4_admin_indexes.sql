-- Phase 4 keyset/list queries. The id tie-breaker makes equal timestamps deterministic.
create index if not exists businesses_created_id_idx on public.businesses(created_at desc, id desc);
create index if not exists cards_created_id_idx on public.cards(created_at desc, id desc);
create index if not exists card_batches_created_id_idx on public.card_batches(created_at desc, id desc);
create index if not exists card_history_card_created_id_idx on public.card_assignment_history(card_id, created_at desc, id desc);
