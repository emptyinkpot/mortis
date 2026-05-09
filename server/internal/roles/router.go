package roles

import "strings"

type Candidate struct {
	ID    string
	Name  string
	Title string
}

type RouteResult struct {
	RoleID           string `json:"role_id"`
	RoleName         string `json:"role_name"`
	RoleTitle        string `json:"role_title"`
	CommandType      string `json:"command_type"`
	RiskLevel        string `json:"risk_level"`
	RequiresApproval bool   `json:"requires_approval"`
	Reason           string `json:"reason"`
}

func RouteMessage(content string, channel string, candidates []Candidate) RouteResult {
	lower := strings.ToLower(content)
	selected := firstRole(candidates, "manager")
	reason := "defaulted to Manager role"

	for _, candidate := range candidates {
		nameMention := "@" + strings.ToLower(candidate.Name)
		titleMention := "@" + strings.ToLower(candidate.Title)
		if strings.Contains(lower, nameMention) || (candidate.Title != "" && strings.Contains(lower, titleMention)) {
			selected = candidate
			reason = "explicit role mention"
			break
		}
	}

	commandType := "role_message"
	riskLevel := "low"
	requiresApproval := false

	if containsAny(lower, []string{"部署", "deploy", "production", "生产"}) {
		commandType = "deploy_production"
		riskLevel = "high"
		requiresApproval = true
	} else if containsAny(lower, []string{"删除", "delete", "drop", "清空"}) {
		commandType = "delete_or_destructive_change"
		riskLevel = "high"
		requiresApproval = true
	} else if containsAny(lower, []string{"付款", "支付", "payment", "pay invoice", "银行", "bank"}) {
		commandType = "finance_or_payment_request"
		riskLevel = "high"
		requiresApproval = true
	} else if looksLikeTestWork(lower) {
		selected = firstRole(candidates, "tester")
		commandType = "test_execution"
		reason = "test or verification work routed to Tester role"
	} else if looksLikeCodeWork(lower) {
		selected = firstRole(candidates, "builder")
		commandType = "code_change"
		reason = "implementation or repo-debug work routed to Builder role"
	} else if selected.Name == "manager" && containsAny(lower, []string{"规划", "计划", "拆", "plan", "issue"}) {
		commandType = "create_plan"
		riskLevel = "medium"
		requiresApproval = true
	}

	if channel == "qq" && requiresApproval {
		reason += "; QQ high-risk command converted to approval request"
	}

	return RouteResult{
		RoleID:           selected.ID,
		RoleName:         selected.Name,
		RoleTitle:        selected.Title,
		CommandType:      commandType,
		RiskLevel:        riskLevel,
		RequiresApproval: requiresApproval,
		Reason:           reason,
	}
}

func looksLikeCodeWork(lower string) bool {
	return containsAny(lower, []string{
		"修", "修复", "改", "实现", "开发", "写代码", "源码", "仓库", "提交", "commit", "diff", "patch",
		"modify", "change", "create file", "repository file", "repo file", "add file", "edit file",
		"bug", "报错", "异常", "排查", "定位", "日志", "dispatcher", "runtime", "backend", "frontend",
		"readme", "json", "部署脚本", "配置", "权限缺口", "action", "artifact",
	})
}

func looksLikeTestWork(lower string) bool {
	return containsAny(lower, []string{
		"测试", "验收", "验证", "回归", "跑一下", "跑测试", "ci", "test", "verify", "verification",
		"边界用例", "失败记录", "测试报告", "verification_report",
	})
}

func firstRole(candidates []Candidate, name string) Candidate {
	for _, candidate := range candidates {
		if candidate.Name == name {
			return candidate
		}
	}
	if len(candidates) > 0 {
		return candidates[0]
	}
	return Candidate{Name: "manager", Title: "Manager AI"}
}

func containsAny(value string, needles []string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}
	return false
}
