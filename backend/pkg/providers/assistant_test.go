package providers

import (
	"context"
	"encoding/json"
	"testing"

	"pentagi/pkg/database"
	"pentagi/pkg/providers/pconfig"
	"pentagi/pkg/providers/provider"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/vxcontrol/langchaingo/llms"
)

type freshAssistantChainDB struct {
	database.Querier
	created database.CreateMsgChainParams
}

func (db *freshAssistantChainDB) CreateMsgChain(
	_ context.Context,
	params database.CreateMsgChainParams,
) (database.Msgchain, error) {
	db.created = params
	return database.Msgchain{ID: 91}, nil
}

type freshAssistantProvider struct {
	provider.Provider
}

func (freshAssistantProvider) Type() provider.ProviderType {
	return provider.ProviderGLM
}

func (freshAssistantProvider) Model(pconfig.ProviderOptionsType) string {
	return "assistant-model"
}

func TestCreateFreshAgentChainDoesNotRestorePreviousConversation(t *testing.T) {
	db := &freshAssistantChainDB{}
	ap := &assistantProvider{fp: flowProvider{
		db:       db,
		flowID:   12,
		Provider: freshAssistantProvider{},
	}}

	chainID, err := ap.createFreshAgentChain(t.Context(), "new conversation system prompt")
	require.NoError(t, err)
	assert.Equal(t, int64(91), chainID)
	assert.Equal(t, database.MsgchainTypeAssistant, db.created.Type)
	assert.Equal(t, int64(12), db.created.FlowID)
	assert.False(t, db.created.TaskID.Valid)
	assert.False(t, db.created.SubtaskID.Valid)
	assert.Equal(t, "assistant-model", db.created.Model)
	assert.Equal(t, string(provider.ProviderGLM), db.created.ModelProvider)

	var chain []llms.MessageContent
	require.NoError(t, json.Unmarshal(db.created.Chain, &chain))
	require.Len(t, chain, 1, "a new assistant must contain no prior conversation messages")
	assert.Equal(t, llms.ChatMessageTypeSystem, chain[0].Role)
	require.Len(t, chain[0].Parts, 1)
	assert.Equal(t, llms.TextContent{Text: "new conversation system prompt"}, chain[0].Parts[0])
}
