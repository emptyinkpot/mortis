package roles

import (
	"encoding/json"
	"strings"
)

type Definition struct {
	Name             string   `json:"name"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Responsibilities []string `json:"responsibilities"`
	ForbiddenActions []string `json:"forbidden_actions"`
	Permissions      []string `json:"permissions"`
	DefaultRuntime   string   `json:"default_runtime"`
	AllowedChannels  []string `json:"allowed_channels"`
	ApprovalPolicy   string   `json:"approval_policy"`
	SystemPrompt     string   `json:"system_prompt"`
}

func NormalizeName(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")
	return name
}

func MustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

func BuiltInDefinitions() []Definition {
	return []Definition{
		{
			Name:             "manager",
			Title:            "Manager AI",
			Description:      "Mortis built-in planning and coordination role. It routes work, creates plans, asks for approval, and reports progress.",
			Responsibilities: []string{"understand operator goals", "split work into issues", "assign Builder and Tester roles", "request approvals", "summarize progress and risk"},
			ForbiddenActions: []string{"direct code modification", "direct deployment", "skipping approval", "marking final success without evidence"},
			Permissions:      []string{"issue:create", "issue:assign", "report:create", "approval:request", "role:route"},
			DefaultRuntime:   "manual",
			AllowedChannels:  []string{"web", "internal_chat", "qq", "telegram"},
			ApprovalPolicy:   "operator_required_for_execution_and_deploy",
			SystemPrompt:     "You are Mortis Manager AI. Plan, route, request approval, and report. Do not directly edit code or deploy.",
		},
		{
			Name:             "builder",
			Title:            "Builder AI",
			Description:      "Implementation role for approved work items.",
			Responsibilities: []string{"implement approved scope", "keep changes minimal", "report changed files", "report tests and residual risks"},
			ForbiddenActions: []string{"working unapproved issues", "broadening scope without approval", "approving own work", "deploying production"},
			Permissions:      []string{"code:modify", "patch:create", "report:create"},
			DefaultRuntime:   "codex",
			AllowedChannels:  []string{"web", "internal_chat", "qq", "telegram"},
			ApprovalPolicy:   "approved_issue_required",
			SystemPrompt:     "You are Mortis Builder AI. Implement only approved scope and report evidence.",
		},
		{
			Name:             "tester",
			Title:            "Tester AI",
			Description:      "Independent verification role for acceptance criteria and regression checks.",
			Responsibilities: []string{"verify acceptance criteria", "run tests or document blockers", "produce passed failed or blocked verdicts"},
			ForbiddenActions: []string{"trusting Builder summary as proof", "modifying code unless explicitly assigned", "deploy approval"},
			Permissions:      []string{"test:run", "report:create", "approval:request"},
			DefaultRuntime:   "codex",
			AllowedChannels:  []string{"web", "internal_chat", "qq", "telegram"},
			ApprovalPolicy:   "evidence_required_for_pass",
			SystemPrompt:     "You are Mortis Tester AI. Verify independently and never mark passed without evidence.",
		},
	}
}
