-- +goose Up
-- +goose StatementBegin
CREATE TABLE model_services (
  id             BIGINT        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id        BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  provider_type  PROVIDER_TYPE NOT NULL,
  base_url       TEXT          NOT NULL DEFAULT '',
  builtin        BOOLEAN       NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMPTZ   NULL
);

CREATE INDEX model_services_user_id_idx ON model_services(user_id);
CREATE INDEX model_services_provider_type_idx ON model_services(provider_type);
CREATE UNIQUE INDEX model_services_name_user_id_unique
  ON model_services(user_id, LOWER(name)) WHERE deleted_at IS NULL;

CREATE TABLE model_credentials (
  id             BIGINT      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id     BIGINT      NOT NULL REFERENCES model_services(id) ON DELETE RESTRICT,
  name           TEXT        NOT NULL,
  remark         TEXT        NOT NULL DEFAULT '',
  secret         BYTEA       NOT NULL,
  masked         TEXT        NOT NULL,
  enabled        BOOLEAN     NOT NULL DEFAULT true,
  source         TEXT        NOT NULL DEFAULT 'user',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMPTZ NULL
);

CREATE INDEX model_credentials_user_id_idx ON model_credentials(user_id);
CREATE INDEX model_credentials_service_id_idx ON model_credentials(service_id);
CREATE UNIQUE INDEX model_credentials_name_service_id_unique
  ON model_credentials(service_id, LOWER(name)) WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS model_credentials;
DROP TABLE IF EXISTS model_services;
-- +goose StatementEnd
