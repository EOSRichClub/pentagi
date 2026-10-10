-- +goose Up
ALTER TABLE assistants
    ADD COLUMN IF NOT EXISTS flow_control_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE assistants
    DROP COLUMN IF EXISTS flow_control_enabled;
