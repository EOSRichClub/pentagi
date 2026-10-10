-- name: GetUserModelServices :many
SELECT *
FROM model_services
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY builtin DESC, created_at ASC;

-- name: GetUserModelService :one
SELECT *
FROM model_services
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: GetUserModelServiceByType :one
SELECT *
FROM model_services
WHERE user_id = $1 AND provider_type = $2 AND builtin = true AND deleted_at IS NULL
ORDER BY created_at ASC
LIMIT 1;

-- name: CreateModelService :one
INSERT INTO model_services (user_id, name, provider_type, base_url, builtin)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateUserModelService :one
UPDATE model_services
SET name = $3, base_url = $4, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteUserModelService :one
UPDATE model_services
SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND builtin = false AND deleted_at IS NULL
RETURNING *;

-- name: GetUserModelCredentials :many
SELECT
  c.*,
  COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::BIGINT AS usage_count
FROM model_credentials c
LEFT JOIN providers p
  ON (p.config->>'model_credential_id')::BIGINT = c.id
  AND p.user_id = c.user_id
  AND p.deleted_at IS NULL
WHERE c.user_id = $1 AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY c.created_at ASC;

-- name: GetUserModelCredential :one
SELECT c.*
FROM model_credentials c
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL;

-- name: ResolveUserModelCredential :one
SELECT
  c.id,
  c.name,
  c.secret,
  c.enabled,
  s.id AS service_id,
  s.name AS service_name,
  s.provider_type,
  s.base_url
FROM model_credentials c
INNER JOIN model_services s ON s.id = c.service_id
WHERE c.id = $1
  AND c.user_id = $2
  AND c.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- name: CreateModelCredential :one
INSERT INTO model_credentials (user_id, service_id, name, remark, secret, masked, enabled, source)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateUserModelCredential :one
UPDATE model_credentials
SET name = $3,
    remark = $4,
    secret = $5,
    masked = $6,
    enabled = $7,
    source = $8,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteUserModelCredential :one
UPDATE model_credentials AS mc
SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE mc.id = $1
  AND mc.user_id = $2
  AND mc.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM providers p
    WHERE p.user_id = $2
      AND p.deleted_at IS NULL
      AND (p.config->>'model_credential_id')::BIGINT = mc.id
  )
RETURNING mc.*;

-- name: CountUserModelServiceCredentials :one
SELECT COUNT(*)
FROM model_credentials
WHERE service_id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: CountUserModelServiceProviders :one
SELECT COUNT(*)
FROM providers p
WHERE p.user_id = $2
  AND p.deleted_at IS NULL
  AND (p.config->>'model_service_id')::BIGINT = $1;

-- name: GetEnvironmentModelCredential :one
SELECT *
FROM model_credentials
WHERE service_id = $1 AND user_id = $2 AND source = 'environment'
ORDER BY created_at ASC
LIMIT 1;
