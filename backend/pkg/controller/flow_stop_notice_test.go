package controller

import (
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildFlowStopNoticeClassifiesProviderFailures(t *testing.T) {
	tests := []struct {
		name    string
		err     string
		message string
	}{
		{"rate limited", "API returned unexpected status code: 429: Model capacity is temporarily unavailable", "任务已停止：模型限流或容量不足（HTTP 429）"},
		{"provider unavailable", "API returned unexpected status code: 503: Kitani is temporarily unavailable after a five-minute retry window", "任务已停止：模型服务暂时不可用（HTTP 5xx）"},
		{"authentication", "unexpected status code: 401: unauthorized", "任务已停止：模型 API 密钥无效（HTTP 401）"},
		{"embedding", "failed to store vector: embedding request timeout", "任务已停止：Embedding 服务异常"},
		{"network", "dial tcp: connection refused", "任务已停止：网络连接失败"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message, result := buildFlowStopNotice(errors.New(tt.err))
			assert.Equal(t, tt.message, message)
			assert.Contains(t, result, "已经完成的进度和文件不会丢失")
		})
	}
}

func TestBuildFlowStopNoticeRedactsSecretsAndLimitsDetails(t *testing.T) {
	secret := "sk-1234567890abcdefghijklmnop"
	err := errors.New("request failed api_key=" + secret + " Authorization: Bearer abcdefghijklmnop " + strings.Repeat("x", 900))
	_, result := buildFlowStopNotice(err)

	assert.NotContains(t, result, secret)
	assert.NotContains(t, result, "abcdefghijklmnop")
	assert.Contains(t, result, "[已隐藏]")
	assert.LessOrEqual(t, len([]rune(safeStopNoticeTechnicalError(err))), maxStopNoticeTechnicalLength+1)
}
