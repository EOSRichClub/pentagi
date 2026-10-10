package modelcredentials

import (
	"testing"

	"pentagi/pkg/config"
	"pentagi/pkg/database"

	"github.com/stretchr/testify/require"
)

type credentialStoreTestDB struct {
	database.Querier
}

func TestCredentialEncryptionRoundTrip(t *testing.T) {
	store, err := New(
		&config.Config{CookieSigningSalt: "unit-test-salt", TenantID: "unit-test-tenant"},
		credentialStoreTestDB{},
	)
	require.NoError(t, err)

	sealed, err := store.seal("sk-secret-value")
	require.NoError(t, err)
	require.NotContains(t, string(sealed), "sk-secret-value")

	opened, err := store.open(sealed)
	require.NoError(t, err)
	require.Equal(t, "sk-secret-value", opened)
}

func TestCredentialEncryptionIsTenantScoped(t *testing.T) {
	db := credentialStoreTestDB{}
	first, err := New(&config.Config{CookieSigningSalt: "same-salt", TenantID: "first"}, db)
	require.NoError(t, err)
	second, err := New(&config.Config{CookieSigningSalt: "same-salt", TenantID: "second"}, db)
	require.NoError(t, err)

	sealed, err := first.seal("secret")
	require.NoError(t, err)
	_, err = second.open(sealed)
	require.Error(t, err)
}

func TestMask(t *testing.T) {
	require.Equal(t, "••••", Mask("tiny"))
	require.Equal(t, "sk-••••••789", Mask("sk-123456789"))
	require.Empty(t, Mask(""))
}
