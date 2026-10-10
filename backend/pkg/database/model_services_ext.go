package database

import (
	"context"
	"database/sql"
	"time"
)

type ModelService struct {
	ID           int64        `json:"id"`
	UserID       int64        `json:"user_id"`
	Name         string       `json:"name"`
	ProviderType ProviderType `json:"provider_type"`
	BaseUrl      string       `json:"base_url"`
	Builtin      bool         `json:"builtin"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	DeletedAt    sql.NullTime `json:"deleted_at"`
}

type ModelCredential struct {
	ID        int64        `json:"id"`
	UserID    int64        `json:"user_id"`
	ServiceID int64        `json:"service_id"`
	Name      string       `json:"name"`
	Remark    string       `json:"remark"`
	Secret    []byte       `json:"-"`
	Masked    string       `json:"masked"`
	Enabled   bool         `json:"enabled"`
	Source    string       `json:"source"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
	DeletedAt sql.NullTime `json:"deleted_at"`
}

type GetUserModelServiceParams struct {
	ID     int64 `json:"id"`
	UserID int64 `json:"user_id"`
}

type GetUserModelServiceByTypeParams struct {
	UserID       int64        `json:"user_id"`
	ProviderType ProviderType `json:"provider_type"`
}

type CreateModelServiceParams struct {
	UserID       int64        `json:"user_id"`
	Name         string       `json:"name"`
	ProviderType ProviderType `json:"provider_type"`
	BaseUrl      string       `json:"base_url"`
	Builtin      bool         `json:"builtin"`
}

type UpdateUserModelServiceParams struct {
	ID      int64  `json:"id"`
	UserID  int64  `json:"user_id"`
	Name    string `json:"name"`
	BaseUrl string `json:"base_url"`
}

type DeleteUserModelServiceParams struct {
	ID     int64 `json:"id"`
	UserID int64 `json:"user_id"`
}

type GetUserModelCredentialsRow struct {
	ModelCredential
	UsageCount int64 `json:"usage_count"`
}

type GetUserModelCredentialParams struct {
	ID     int64 `json:"id"`
	UserID int64 `json:"user_id"`
}

type ResolveUserModelCredentialParams struct {
	ID     int64 `json:"id"`
	UserID int64 `json:"user_id"`
}

type ResolveUserModelCredentialRow struct {
	ID           int64        `json:"id"`
	Name         string       `json:"name"`
	Secret       []byte       `json:"-"`
	Enabled      bool         `json:"enabled"`
	ServiceID    int64        `json:"service_id"`
	ServiceName  string       `json:"service_name"`
	ProviderType ProviderType `json:"provider_type"`
	BaseUrl      string       `json:"base_url"`
}

type CreateModelCredentialParams struct {
	UserID    int64  `json:"user_id"`
	ServiceID int64  `json:"service_id"`
	Name      string `json:"name"`
	Remark    string `json:"remark"`
	Secret    []byte `json:"-"`
	Masked    string `json:"masked"`
	Enabled   bool   `json:"enabled"`
	Source    string `json:"source"`
}

type UpdateUserModelCredentialParams struct {
	ID      int64  `json:"id"`
	UserID  int64  `json:"user_id"`
	Name    string `json:"name"`
	Remark  string `json:"remark"`
	Secret  []byte `json:"-"`
	Masked  string `json:"masked"`
	Enabled bool   `json:"enabled"`
	Source  string `json:"source"`
}

type DeleteUserModelCredentialParams struct {
	ID     int64 `json:"id"`
	UserID int64 `json:"user_id"`
}

type CountUserModelServiceCredentialsParams struct {
	ServiceID int64 `json:"service_id"`
	UserID    int64 `json:"user_id"`
}

type CountUserModelServiceProvidersParams struct {
	ServiceID int64 `json:"service_id"`
	UserID    int64 `json:"user_id"`
}

type GetEnvironmentModelCredentialParams struct {
	ServiceID int64 `json:"service_id"`
	UserID    int64 `json:"user_id"`
}

const modelServiceColumns = `id, user_id, name, provider_type, base_url, builtin, created_at, updated_at, deleted_at`
const modelCredentialColumns = `id, user_id, service_id, name, remark, secret, masked, enabled, source, created_at, updated_at, deleted_at`

func scanModelService(row interface{ Scan(...any) error }) (ModelService, error) {
	var v ModelService
	err := row.Scan(&v.ID, &v.UserID, &v.Name, &v.ProviderType, &v.BaseUrl, &v.Builtin, &v.CreatedAt, &v.UpdatedAt, &v.DeletedAt)
	return v, err
}

func scanModelCredential(row interface{ Scan(...any) error }) (ModelCredential, error) {
	var v ModelCredential
	err := row.Scan(
		&v.ID, &v.UserID, &v.ServiceID, &v.Name, &v.Remark, &v.Secret, &v.Masked,
		&v.Enabled, &v.Source, &v.CreatedAt, &v.UpdatedAt, &v.DeletedAt,
	)
	return v, err
}

func (q *Queries) GetUserModelServices(ctx context.Context, userID int64) ([]ModelService, error) {
	rows, err := q.db.QueryContext(ctx, `SELECT `+modelServiceColumns+`
		FROM model_services WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY builtin DESC, created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]ModelService, 0)
	for rows.Next() {
		item, err := scanModelService(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (q *Queries) GetUserModelService(ctx context.Context, arg GetUserModelServiceParams) (ModelService, error) {
	return scanModelService(q.db.QueryRowContext(ctx, `SELECT `+modelServiceColumns+`
		FROM model_services WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, arg.ID, arg.UserID))
}

func (q *Queries) GetUserModelServiceByType(ctx context.Context, arg GetUserModelServiceByTypeParams) (ModelService, error) {
	return scanModelService(q.db.QueryRowContext(ctx, `SELECT `+modelServiceColumns+`
		FROM model_services
		WHERE user_id = $1 AND provider_type = $2 AND builtin = true AND deleted_at IS NULL
		ORDER BY created_at ASC LIMIT 1`, arg.UserID, arg.ProviderType))
}

func (q *Queries) CreateModelService(ctx context.Context, arg CreateModelServiceParams) (ModelService, error) {
	return scanModelService(q.db.QueryRowContext(ctx, `INSERT INTO model_services
		(user_id, name, provider_type, base_url, builtin) VALUES ($1, $2, $3, $4, $5)
		RETURNING `+modelServiceColumns, arg.UserID, arg.Name, arg.ProviderType, arg.BaseUrl, arg.Builtin))
}

func (q *Queries) UpdateUserModelService(ctx context.Context, arg UpdateUserModelServiceParams) (ModelService, error) {
	return scanModelService(q.db.QueryRowContext(ctx, `UPDATE model_services
		SET name = $3, base_url = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		RETURNING `+modelServiceColumns, arg.ID, arg.UserID, arg.Name, arg.BaseUrl))
}

func (q *Queries) DeleteUserModelService(ctx context.Context, arg DeleteUserModelServiceParams) (ModelService, error) {
	return scanModelService(q.db.QueryRowContext(ctx, `UPDATE model_services
		SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2 AND builtin = false AND deleted_at IS NULL
		RETURNING `+modelServiceColumns, arg.ID, arg.UserID))
}

func (q *Queries) GetUserModelCredentials(ctx context.Context, userID int64) ([]GetUserModelCredentialsRow, error) {
	rows, err := q.db.QueryContext(ctx, `SELECT c.id, c.user_id, c.service_id, c.name, c.remark, c.secret,
		c.masked, c.enabled, c.source, c.created_at, c.updated_at, c.deleted_at,
		COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::BIGINT AS usage_count
		FROM model_credentials c
		LEFT JOIN providers p ON (p.config->>'model_credential_id')::BIGINT = c.id
		AND p.user_id = c.user_id AND p.deleted_at IS NULL
		WHERE c.user_id = $1 AND c.deleted_at IS NULL
		GROUP BY c.id ORDER BY c.created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]GetUserModelCredentialsRow, 0)
	for rows.Next() {
		var v GetUserModelCredentialsRow
		err := rows.Scan(
			&v.ID, &v.UserID, &v.ServiceID, &v.Name, &v.Remark, &v.Secret, &v.Masked,
			&v.Enabled, &v.Source, &v.CreatedAt, &v.UpdatedAt, &v.DeletedAt, &v.UsageCount,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

func (q *Queries) GetUserModelCredential(ctx context.Context, arg GetUserModelCredentialParams) (ModelCredential, error) {
	return scanModelCredential(q.db.QueryRowContext(ctx, `SELECT `+modelCredentialColumns+`
		FROM model_credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, arg.ID, arg.UserID))
}

func (q *Queries) ResolveUserModelCredential(ctx context.Context, arg ResolveUserModelCredentialParams) (ResolveUserModelCredentialRow, error) {
	row := q.db.QueryRowContext(ctx, `SELECT c.id, c.name, c.secret, c.enabled,
		s.id, s.name, s.provider_type, s.base_url
		FROM model_credentials c INNER JOIN model_services s ON s.id = c.service_id
		WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL AND s.deleted_at IS NULL`, arg.ID, arg.UserID)
	var v ResolveUserModelCredentialRow
	err := row.Scan(&v.ID, &v.Name, &v.Secret, &v.Enabled, &v.ServiceID, &v.ServiceName, &v.ProviderType, &v.BaseUrl)
	return v, err
}

func (q *Queries) CreateModelCredential(ctx context.Context, arg CreateModelCredentialParams) (ModelCredential, error) {
	return scanModelCredential(q.db.QueryRowContext(ctx, `INSERT INTO model_credentials
		(user_id, service_id, name, remark, secret, masked, enabled, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING `+modelCredentialColumns,
		arg.UserID, arg.ServiceID, arg.Name, arg.Remark, arg.Secret, arg.Masked, arg.Enabled, arg.Source))
}

func (q *Queries) UpdateUserModelCredential(ctx context.Context, arg UpdateUserModelCredentialParams) (ModelCredential, error) {
	return scanModelCredential(q.db.QueryRowContext(ctx, `UPDATE model_credentials SET
		name = $3, remark = $4, secret = $5, masked = $6, enabled = $7, source = $8,
		updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING `+modelCredentialColumns,
		arg.ID, arg.UserID, arg.Name, arg.Remark, arg.Secret, arg.Masked, arg.Enabled, arg.Source))
}

func (q *Queries) DeleteUserModelCredential(ctx context.Context, arg DeleteUserModelCredentialParams) (ModelCredential, error) {
	return scanModelCredential(q.db.QueryRowContext(ctx, `UPDATE model_credentials AS mc
		SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE mc.id = $1 AND mc.user_id = $2 AND mc.deleted_at IS NULL
		AND NOT EXISTS (SELECT 1 FROM providers p WHERE p.user_id = $2 AND p.deleted_at IS NULL
		AND (p.config->>'model_credential_id')::BIGINT = mc.id)
		RETURNING `+modelCredentialColumns, arg.ID, arg.UserID))
}

func (q *Queries) CountUserModelServiceCredentials(ctx context.Context, arg CountUserModelServiceCredentialsParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM model_credentials
		WHERE service_id = $1 AND user_id = $2 AND deleted_at IS NULL`, arg.ServiceID, arg.UserID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

func (q *Queries) CountUserModelServiceProviders(ctx context.Context, arg CountUserModelServiceProvidersParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM providers p WHERE p.user_id = $2 AND p.deleted_at IS NULL
		AND (p.config->>'model_service_id')::BIGINT = $1`, arg.ServiceID, arg.UserID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

func (q *Queries) GetEnvironmentModelCredential(ctx context.Context, arg GetEnvironmentModelCredentialParams) (ModelCredential, error) {
	return scanModelCredential(q.db.QueryRowContext(ctx, `SELECT `+modelCredentialColumns+`
		FROM model_credentials WHERE service_id = $1 AND user_id = $2
		AND source = 'environment' ORDER BY created_at ASC LIMIT 1`, arg.ServiceID, arg.UserID))
}
