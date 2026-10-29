-- Library identifiers are validated against the application catalog on import.
-- Existing custom exercises stay unlinked; their names never infer animations.
alter table app.exercises add column catalog_id text
  check(catalog_id is null or catalog_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index exercises_tenant_catalog
  on app.exercises(tenant_id,catalog_id) where catalog_id is not null;
comment on column app.exercises.catalog_id is
  'Canonical FitCore catalog identifier, assigned only by the server import flow.';
