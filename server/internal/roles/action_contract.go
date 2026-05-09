package roles

import (
	"strings"
)

type ActionContractInput struct {
	Content     string
	Channel     string
	RoleName    string
	CommandType string
	RiskLevel   string
	ActionID    string
	Metadata    map[string]any
}

func BuildActionContractPayload(input ActionContractInput) map[string]any {
	title := firstContractLine(input.Content)
	owner := strings.TrimSpace(input.RoleName)
	if owner == "" {
		owner = "builder"
	}
	branch := ""
	if input.ActionID != "" {
		branch = "mortis/action-" + sanitizeContractID(input.ActionID)
	}
	intent := firstContractString(input.Metadata, "intent", "code_change")
	runtime := firstContractString(input.Metadata, "execution_runtime", "codex")
	chatRuntime := firstContractString(input.Metadata, "chat_runtime", "glm")
	if intent == "chat" || intent == "research" || intent == "planning" {
		runtime = chatRuntime
	}
	commands := extractInlineTestCommands(input.Content)
	if len(commands) == 0 {
		commands = []string{"git diff --check HEAD"}
	}
	acceptance := []string{
		"目标行为可复现或可验收",
		"按 operator 授权范围执行，可包含生产写入/部署/回滚",
		"secret/token/password 只从环境或主机文件读取，不在聊天或报告中明文输出",
		"测试命令有结果；没有真实命令/CI 证据不得声称通过",
	}
	return map[string]any{
		"content":  input.Content,
		"channel":  input.Channel,
		"role":     owner,
		"title":    title,
		"metadata": input.Metadata,
		"action_contract": map[string]any{
			"action_type":       firstContractNonEmpty(input.CommandType, "role_message"),
			"owner":             owner,
			"repo":              "mortis",
			"branch":            branch,
			"objective":         input.Content,
			"intent":            intent,
			"runtime":           runtime,
			"chat_runtime":      chatRuntime,
			"runtime_boundary":  "GLM handles personality/research/planning; Codex handles only approved code/test/repo actions.",
			"acceptance":        acceptance,
			"commands":          commands,
			"risk_level":        firstContractNonEmpty(input.RiskLevel, "low"),
			"artifact_required": true,
			"artifact_types":    []string{"diff", "commit", "test_report"},
			"status":            "queued_or_approved",
		},
	}
}

func firstContractString(values map[string]any, key string, fallback string) string {
	if values != nil {
		if value, ok := values[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return fallback
}

func firstContractLine(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "role action"
	}
	if idx := strings.IndexByte(value, '\n'); idx >= 0 {
		value = value[:idx]
	}
	runes := []rune(value)
	if len(runes) > 80 {
		return string(runes[:80])
	}
	return value
}

func sanitizeContractID(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return "<action_id>"
	}
	var b strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "<action_id>"
	}
	return out
}

func firstContractNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
