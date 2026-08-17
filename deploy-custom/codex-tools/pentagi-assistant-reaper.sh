#!/bin/sh
set -eu

docker exec -i pgvector psql -U postgres -d pentagidb -v ON_ERROR_STOP=1 -q <<'SQL'
UPDATE assistants
SET deleted_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND status = 'created'
  AND msgchain_id IS NULL
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes';
SQL
