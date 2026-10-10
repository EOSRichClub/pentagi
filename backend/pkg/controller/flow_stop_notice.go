package controller

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

const maxStopNoticeTechnicalLength = 600

var stopNoticeSecretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bsk-[a-z0-9_-]{8,}`),
	regexp.MustCompile(`(?i)\bBearer\s+[a-z0-9._~+/=-]{8,}`),
	regexp.MustCompile(`(?i)([?&](?:api_?key|token|secret|key)=)[^&\s]+`),
	regexp.MustCompile(`(?i)((?:api[-_ ]?key|authorization|access[-_ ]?token|secret)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+`),
}

type flowStopNotice struct {
	title      string
	reason     string
	suggestion string
}

func buildFlowStopNotice(err error) (string, string) {
	notice := classifyFlowStopError(err)
	message := "任务已停止：" + notice.title
	result := fmt.Sprintf(
		"**停止原因**：%s\n\n**当前状态**：任务已暂停并等待继续，已经完成的进度和文件不会丢失。\n\n**建议操作**：%s",
		notice.reason,
		notice.suggestion,
	)

	if technical := safeStopNoticeTechnicalError(err); technical != "" {
		result += "\n\n**技术摘要**：`" + strings.ReplaceAll(technical, "`", "'") + "`"
	}

	return message, result
}

func classifyFlowStopError(err error) flowStopNotice {
	if err == nil {
		return flowStopNotice{
			title:      "未知错误",
			reason:     "系统没有返回可识别的错误信息。",
			suggestion: "请重新发送一次“继续”；如果再次停止，请检查服务器日志。",
		}
	}

	text := strings.ToLower(err.Error())

	switch {
	case containsAny(text, "embedding", "vector store", "vectorstore", "向量"):
		return flowStopNotice{
			title:      "Embedding 服务异常",
			reason:     "向量化或向量检索服务不可用，任务无法准备或读取记忆上下文。",
			suggestion: "检查本地 Embedding 服务和模型是否运行正常，恢复后发送“继续”。",
		}
	case containsAny(text, "status code: 401", "http 401", "unauthorized", "invalid api key", "incorrect api key"):
		return flowStopNotice{
			title:      "模型 API 密钥无效（HTTP 401）",
			reason:     "模型提供商拒绝了身份验证，当前密钥可能无效、已撤销或填写错误。",
			suggestion: "在“模型 API 密钥”页面检查或更换该提供商的密钥，然后发送“继续”。",
		}
	case containsAny(text, "status code: 403", "http 403", "forbidden", "permission denied"):
		return flowStopNotice{
			title:      "模型访问权限不足（HTTP 403）",
			reason:     "密钥已被识别，但没有当前模型或接口的访问权限。",
			suggestion: "检查套餐、模型权限和模型名称，或切换到有权限的密钥后发送“继续”。",
		}
	case containsAny(text, "status code: 429", "http 429", "too many requests", "rate limit", "capacity is temporarily unavailable"):
		return flowStopNotice{
			title:      "模型限流或容量不足（HTTP 429）",
			reason:     "模型提供商当前限流、并发已满或暂时没有可用容量。",
			suggestion: "等待一会儿再发送“继续”，或切换到其他可用模型、提供商或 API 密钥。",
		}
	case containsAny(text,
		"status code: 500", "status code: 502", "status code: 503", "status code: 504",
		"http 500", "http 502", "http 503", "http 504", "temporarily unavailable",
		"service unavailable", "bad gateway", "gateway timeout", "five-minute retry window",
	):
		return flowStopNotice{
			title:      "模型服务暂时不可用（HTTP 5xx）",
			reason:     "模型提供商或中转线路在自动重试后仍未恢复。",
			suggestion: "稍后发送“继续”；如果反复出现，请切换模型线路、提供商或 API 密钥。",
		}
	case containsAny(text, "deadline exceeded", "context deadline", "readtimeout", "connecttimeout", "i/o timeout", "timed out", "timeout"):
		return flowStopNotice{
			title:      "模型或网络请求超时",
			reason:     "请求在允许的等待时间内没有收到完整响应。",
			suggestion: "检查网络出口和模型服务状态，恢复后发送“继续”。",
		}
	case containsAny(text, "connection refused", "connection reset", "no such host", "network is unreachable", "tls handshake"):
		return flowStopNotice{
			title:      "网络连接失败",
			reason:     "PentAGI 无法连接目标服务，可能是 DNS、出口节点、TLS 或对端网络异常。",
			suggestion: "检查服务器网络和代理出口，恢复后发送“继续”。",
		}
	case containsAny(text, "failed to exec tool", "failed to execute handler", "tool call"):
		return flowStopNotice{
			title:      "工具执行失败",
			reason:     "智能体调用终端、浏览器或其他工具时发生错误。",
			suggestion: "展开技术摘要检查具体工具；修复依赖或参数后发送“继续”。",
		}
	default:
		return flowStopNotice{
			title:      "执行过程中发生错误",
			reason:     "PentAGI 在处理当前步骤时遇到未分类的系统错误。",
			suggestion: "展开技术摘要查看线索，处理后发送“继续”。",
		}
	}
}

func containsAny(text string, candidates ...string) bool {
	for _, candidate := range candidates {
		if strings.Contains(text, candidate) {
			return true
		}
	}
	return false
}

func safeStopNoticeTechnicalError(err error) string {
	if err == nil {
		return ""
	}

	technical := strings.Join(strings.Fields(err.Error()), " ")
	for _, pattern := range stopNoticeSecretPatterns {
		technical = pattern.ReplaceAllString(technical, "[已隐藏]")
	}

	if utf8.RuneCountInString(technical) <= maxStopNoticeTechnicalLength {
		return technical
	}

	runes := []rune(technical)
	return string(runes[:maxStopNoticeTechnicalLength]) + "…"
}
