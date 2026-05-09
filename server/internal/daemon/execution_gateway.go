package daemon

import (
	"fmt"
	"strings"

	"github.com/multica-ai/multica/server/pkg/agent"
)

const browserRunToolName = "browser.run"

var browserRunHints = []string{
	"browser.run",
	"playwright",
	"browser mcp",
	"browser",
	"screenshot",
	"console error",
	"console errors",
	"click",
	"fill form",
	"visual verify",
	"ui verify",
	"打开页面",
	"打开网页",
	"浏览器",
	"页面",
	"网页",
	"截图",
	"点击",
	"表单",
	"控制台错误",
	"视觉验证",
	"前端验证",
}

type executionGateway struct {
	requiresBrowserRun bool
	systemPrompt       string
}

type executionToolSummary struct {
	Count     int32
	UsedTools map[string]struct{}
}

func (s executionToolSummary) HasTool(name string) bool {
	if s.UsedTools == nil {
		return false
	}
	_, ok := s.UsedTools[name]
	return ok
}

func buildExecutionGateway(task Task, provider string) executionGateway {
	if provider != "codex" || !taskRequiresBrowserRun(task) {
		return executionGateway{}
	}

	return executionGateway{
		requiresBrowserRun: true,
		systemPrompt: strings.Join([]string{
			"Execution Gateway: this task requires real browser interaction or verification.",
			"You MUST use the MCP tool `browser.run` before finishing.",
			"Do not answer from reasoning alone and do not explain what you would have done instead.",
			"If the browser path is unavailable, stop and report the task as blocked.",
			"Ground the final answer in the observed browser result and mention what page state you verified.",
		}, "\n"),
	}
}

func (g executionGateway) Enforce(result agent.Result, summary executionToolSummary) error {
	if !g.requiresBrowserRun || result.Status != "completed" {
		return nil
	}
	if summary.HasTool(browserRunToolName) {
		return nil
	}
	return fmt.Errorf(
		"execution gateway blocked completion: browser-scoped task must call %s instead of finishing with reasoning-only output",
		browserRunToolName,
	)
}

func taskRequiresBrowserRun(task Task) bool {
	text := strings.ToLower(strings.Join([]string{
		task.ChatMessage,
		task.TriggerCommentContent,
		taskAgentInstructions(task),
	}, "\n"))
	if text == "" {
		return false
	}
	for _, hint := range browserRunHints {
		if strings.Contains(text, hint) {
			return true
		}
	}
	return false
}

func taskAgentInstructions(task Task) string {
	if task.Agent == nil {
		return ""
	}
	return task.Agent.Instructions
}
