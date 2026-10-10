package modelcredentials

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"pentagi/pkg/config"
	"pentagi/pkg/database"
	"pentagi/pkg/providers/provider"
)

var (
	ErrCredentialInUse = errors.New("model credential is used by a provider")
	ErrServiceInUse    = errors.New("model service still has credentials or providers")
	ErrBuiltinService  = errors.New("built-in model service cannot be modified or deleted")
)

type Credential struct {
	ID         int64  `json:"id"`
	ServiceID  int64  `json:"serviceId"`
	Name       string `json:"name"`
	Remark     string `json:"remark"`
	Masked     string `json:"masked"`
	Enabled    bool   `json:"enabled"`
	Source     string `json:"source"`
	UsageCount int64  `json:"usageCount"`
}

type Service struct {
	ID           int64                 `json:"id"`
	Name         string                `json:"name"`
	ProviderType provider.ProviderType `json:"providerType"`
	BaseURL      string                `json:"baseUrl"`
	Builtin      bool                  `json:"builtin"`
	Credentials  []Credential          `json:"credentials"`
}

type Resolved struct {
	ID           int64
	Name         string
	Secret       string
	ServiceID    int64
	ServiceName  string
	ProviderType provider.ProviderType
	BaseURL      string
	Version      string
}

type Store struct {
	db   database.Querier
	cfg  *config.Config
	aead cipher.AEAD
}

type builtinDefinition struct {
	name         string
	providerType provider.ProviderType
	baseURL      string
	secret       string
}

func New(cfg *config.Config, db database.Querier) (*Store, error) {
	if cfg == nil || db == nil {
		return nil, fmt.Errorf("model credential store requires config and database")
	}
	key := sha256.Sum256([]byte("pentagi:model-credentials:v1|" + cfg.AuthSalt()))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create credential cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create credential cipher mode: %w", err)
	}
	return &Store{db: db, cfg: cfg, aead: aead}, nil
}

func (s *Store) builtinDefinitions() []builtinDefinition {
	return []builtinDefinition{
		{"OpenAI", provider.ProviderOpenAI, s.cfg.OpenAIServerURL, s.cfg.OpenAIKey},
		{"Anthropic", provider.ProviderAnthropic, s.cfg.AnthropicServerURL, s.cfg.AnthropicAPIKey},
		{"Google Gemini", provider.ProviderGemini, s.cfg.GeminiServerURL, s.cfg.GeminiAPIKey},
		{"DeepSeek", provider.ProviderDeepSeek, s.cfg.DeepSeekServerURL, s.cfg.DeepSeekAPIKey},
		{"智谱 GLM", provider.ProviderGLM, s.cfg.GLMServerURL, s.cfg.GLMAPIKey},
		{"Kimi / Moonshot", provider.ProviderKimi, s.cfg.KimiServerURL, s.cfg.KimiAPIKey},
		{"通义千问 Qwen", provider.ProviderQwen, s.cfg.QwenServerURL, s.cfg.QwenAPIKey},
		{"MiniMax", provider.ProviderMiniMax, s.cfg.MiniMaxServerURL, s.cfg.MiniMaxAPIKey},
		{"Ollama", provider.ProviderOllama, s.cfg.OllamaServerURL, s.cfg.OllamaServerAPIKey},
		{"自定义模型服务（现有配置）", provider.ProviderCustom, s.cfg.LLMServerURL, s.cfg.LLMServerKey},
	}
}

func (s *Store) seal(secret string) ([]byte, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return s.aead.Seal(nonce, nonce, []byte(secret), nil), nil
}

func (s *Store) open(data []byte) (string, error) {
	if len(data) < s.aead.NonceSize() {
		return "", fmt.Errorf("encrypted credential is truncated")
	}
	nonce, ciphertext := data[:s.aead.NonceSize()], data[s.aead.NonceSize():]
	plain, err := s.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt credential: %w", err)
	}
	return string(plain), nil
}

func Mask(secret string) string {
	runes := []rune(secret)
	if len(runes) == 0 {
		return ""
	}
	if len(runes) <= 8 {
		return strings.Repeat("•", len(runes))
	}
	return string(runes[:3]) + "••••••" + string(runes[len(runes)-3:])
}

func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return "", fmt.Errorf("名称不能为空且不能超过 80 个字符")
	}
	return name, nil
}

func validateBaseURL(raw string) (string, error) {
	raw = strings.TrimRight(strings.TrimSpace(raw), "/")
	if raw == "" {
		return "", fmt.Errorf("API Base URL 不能为空")
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil {
		return "", fmt.Errorf("API Base URL 必须是有效的 HTTP 或 HTTPS 地址")
	}
	return raw, nil
}

func (s *Store) EnsureBuiltins(ctx context.Context, userID int64) error {
	for _, def := range s.builtinDefinitions() {
		service, err := s.db.GetUserModelServiceByType(ctx, database.GetUserModelServiceByTypeParams{
			UserID: userID, ProviderType: database.ProviderType(def.providerType),
		})
		if errors.Is(err, sql.ErrNoRows) {
			service, err = s.db.CreateModelService(ctx, database.CreateModelServiceParams{
				UserID: userID, Name: def.name, ProviderType: database.ProviderType(def.providerType),
				BaseUrl: strings.TrimRight(def.baseURL, "/"), Builtin: true,
			})
		}
		if err != nil {
			return fmt.Errorf("ensure built-in model service %s: %w", def.name, err)
		}
		if strings.TrimSpace(def.secret) == "" {
			continue
		}
		_, err = s.db.GetEnvironmentModelCredential(ctx, database.GetEnvironmentModelCredentialParams{
			ServiceID: service.ID, UserID: userID,
		})
		if err == nil {
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("check imported credential for %s: %w", def.name, err)
		}
		sealed, err := s.seal(strings.TrimSpace(def.secret))
		if err != nil {
			return err
		}
		_, err = s.db.CreateModelCredential(ctx, database.CreateModelCredentialParams{
			UserID: userID, ServiceID: service.ID, Name: "环境变量默认密钥",
			Remark: "从服务器现有环境变量导入", Secret: sealed, Masked: Mask(strings.TrimSpace(def.secret)),
			Enabled: true, Source: "environment",
		})
		if err != nil {
			return fmt.Errorf("import environment credential for %s: %w", def.name, err)
		}
	}
	return nil
}

func (s *Store) List(ctx context.Context, userID int64) ([]Service, error) {
	if err := s.EnsureBuiltins(ctx, userID); err != nil {
		return nil, err
	}
	services, err := s.db.GetUserModelServices(ctx, userID)
	if err != nil {
		return nil, err
	}
	credentials, err := s.db.GetUserModelCredentials(ctx, userID)
	if err != nil {
		return nil, err
	}
	byService := make(map[int64][]Credential)
	for _, item := range credentials {
		byService[item.ServiceID] = append(byService[item.ServiceID], Credential{
			ID: item.ID, ServiceID: item.ServiceID, Name: item.Name, Remark: item.Remark,
			Masked: item.Masked, Enabled: item.Enabled, Source: item.Source, UsageCount: item.UsageCount,
		})
	}
	result := make([]Service, 0, len(services))
	for _, item := range services {
		items := byService[item.ID]
		if items == nil {
			items = make([]Credential, 0)
		}
		result = append(result, Service{
			ID: item.ID, Name: item.Name, ProviderType: provider.ProviderType(item.ProviderType),
			BaseURL: item.BaseUrl, Builtin: item.Builtin, Credentials: items,
		})
	}
	return result, nil
}

func (s *Store) CreateService(ctx context.Context, userID int64, name, baseURL string) (database.ModelService, error) {
	var result database.ModelService
	name, err := validateName(name)
	if err != nil {
		return result, err
	}
	baseURL, err = validateBaseURL(baseURL)
	if err != nil {
		return result, err
	}
	return s.db.CreateModelService(ctx, database.CreateModelServiceParams{
		UserID: userID, Name: name, ProviderType: database.ProviderType(provider.ProviderCustom),
		BaseUrl: baseURL, Builtin: false,
	})
}

func (s *Store) UpdateService(ctx context.Context, userID, id int64, name, baseURL string) (database.ModelService, error) {
	var result database.ModelService
	current, err := s.db.GetUserModelService(ctx, database.GetUserModelServiceParams{ID: id, UserID: userID})
	if err != nil {
		return result, err
	}
	name, err = validateName(name)
	if err != nil {
		return result, err
	}
	if current.Builtin {
		name = current.Name
	}
	baseURL, err = validateBaseURL(baseURL)
	if err != nil {
		return result, err
	}
	return s.db.UpdateUserModelService(ctx, database.UpdateUserModelServiceParams{
		ID: id, UserID: userID, Name: name, BaseUrl: baseURL,
	})
}

func (s *Store) DeleteService(ctx context.Context, userID, id int64) error {
	current, err := s.db.GetUserModelService(ctx, database.GetUserModelServiceParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if current.Builtin {
		return ErrBuiltinService
	}
	credentials, err := s.db.CountUserModelServiceCredentials(ctx, database.CountUserModelServiceCredentialsParams{
		ServiceID: id, UserID: userID,
	})
	if err != nil {
		return err
	}
	providers, err := s.db.CountUserModelServiceProviders(ctx, database.CountUserModelServiceProvidersParams{
		ServiceID: id, UserID: userID,
	})
	if err != nil {
		return err
	}
	if credentials > 0 || providers > 0 {
		return ErrServiceInUse
	}
	_, err = s.db.DeleteUserModelService(ctx, database.DeleteUserModelServiceParams{ID: id, UserID: userID})
	return err
}

func (s *Store) CreateCredential(
	ctx context.Context, userID, serviceID int64, name, remark, secret string,
) (database.ModelCredential, error) {
	var result database.ModelCredential
	if _, err := s.db.GetUserModelService(ctx, database.GetUserModelServiceParams{ID: serviceID, UserID: userID}); err != nil {
		return result, err
	}
	name, err := validateName(name)
	if err != nil {
		return result, err
	}
	secret = strings.TrimSpace(secret)
	if secret == "" || len(secret) > 8192 || strings.ContainsAny(secret, "\r\n\x00") {
		return result, fmt.Errorf("API 密钥不能为空、不能包含换行且不能超过 8192 个字符")
	}
	if len([]rune(remark)) > 500 {
		return result, fmt.Errorf("备注不能超过 500 个字符")
	}
	sealed, err := s.seal(secret)
	if err != nil {
		return result, err
	}
	return s.db.CreateModelCredential(ctx, database.CreateModelCredentialParams{
		UserID: userID, ServiceID: serviceID, Name: name, Remark: strings.TrimSpace(remark),
		Secret: sealed, Masked: Mask(secret), Enabled: true, Source: "user",
	})
}

func (s *Store) UpdateCredential(
	ctx context.Context, userID, id int64, name, remark string, enabled bool, newSecret *string,
) (database.ModelCredential, error) {
	current, err := s.db.GetUserModelCredential(ctx, database.GetUserModelCredentialParams{ID: id, UserID: userID})
	if err != nil {
		return database.ModelCredential{}, err
	}
	name, err = validateName(name)
	if err != nil {
		return database.ModelCredential{}, err
	}
	if len([]rune(remark)) > 500 {
		return database.ModelCredential{}, fmt.Errorf("备注不能超过 500 个字符")
	}
	secret, masked := current.Secret, current.Masked
	if newSecret != nil {
		value := strings.TrimSpace(*newSecret)
		if value == "" || len(value) > 8192 || strings.ContainsAny(value, "\r\n\x00") {
			return database.ModelCredential{}, fmt.Errorf("API 密钥不能为空、不能包含换行且不能超过 8192 个字符")
		}
		secret, err = s.seal(value)
		if err != nil {
			return database.ModelCredential{}, err
		}
		masked = Mask(value)
	}
	return s.db.UpdateUserModelCredential(ctx, database.UpdateUserModelCredentialParams{
		ID: id, UserID: userID, Name: name, Remark: strings.TrimSpace(remark), Secret: secret,
		Masked: masked, Enabled: enabled, Source: current.Source,
	})
}

func (s *Store) DeleteCredential(ctx context.Context, userID, id int64) error {
	_, err := s.db.DeleteUserModelCredential(ctx, database.DeleteUserModelCredentialParams{ID: id, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		if _, getErr := s.db.GetUserModelCredential(ctx, database.GetUserModelCredentialParams{ID: id, UserID: userID}); getErr == nil {
			return ErrCredentialInUse
		}
	}
	return err
}

func (s *Store) Resolve(ctx context.Context, userID, credentialID int64) (Resolved, error) {
	row, err := s.db.ResolveUserModelCredential(ctx, database.ResolveUserModelCredentialParams{
		ID: credentialID, UserID: userID,
	})
	if err != nil {
		return Resolved{}, err
	}
	if !row.Enabled {
		return Resolved{}, fmt.Errorf("API 密钥“%s”已停用", row.Name)
	}
	secret, err := s.open(row.Secret)
	if err != nil {
		return Resolved{}, err
	}
	return Resolved{
		ID: row.ID, Name: row.Name, Secret: secret, ServiceID: row.ServiceID,
		ServiceName: row.ServiceName, ProviderType: provider.ProviderType(row.ProviderType), BaseURL: row.BaseUrl,
		Version: fmt.Sprintf("%x", sha256.Sum256(row.Secret)),
	}, nil
}
