package telegrambridge

import (
	"strings"
	"testing"
)

func TestFormatMessageIncludesExecutionSummary(t *testing.T) {
	message := formatMessage(pendingNotification{Title: "Telegram loop proof", Runtime: "builder-local-codex", Status: "completed", Body: "status: completed\ncommit: abc123"})
	for _, want := range []string{"Mortis Telegram 任务已完成", "Telegram loop proof", "status: completed", "commit: abc123"} {
		if !strings.Contains(message, want) {
			t.Fatalf("formatted message missing %q: %s", want, message)
		}
	}
}

func TestFormatMessageForTesterVerification(t *testing.T) {
	message := formatMessage(pendingNotification{Title: "Verify Builder action abc", Runtime: "tester-local-verifier", Status: "completed", FinalSummary: "CEO 最终汇总\n实现结果: completed\n验证结果: completed\n剩余风险: 暂无已知剩余风险", Body: buildBody(notificationBodyInput{Status: "completed", Runtime: "tester-local-verifier", VerifiedFrom: "builder-invocation", WorkspaceDir: "/srv/multica/agent-workspaces/action-abc/repo", Logs: "$ git status --short\n$ git log -1 --oneline\nabc123 feat: work", CIStatus: "missing", StagingStatus: "missing", ObservabilityStatus: "missing", ArtifactGraphStatus: "linked"})})
	for _, want := range []string{"Mortis Telegram 验证已完成", "tester-local-verifier", "verified_from: builder-invocation", "logs:", "evidence: ci=missing", "artifact_graph=linked", "CEO 最终汇总", "剩余风险"} {
		if !strings.Contains(message, want) {
			t.Fatalf("formatted tester message missing %q: %s", want, message)
		}
	}
}

func TestBuildFinalSummaryReportsVerificationRisk(t *testing.T) {
	summary := buildFinalSummary(finalSummaryInput{BuilderStatus: "completed", VerificationStatus: "failed", VerificationError: "test failed"})
	for _, want := range []string{"验证阶段有错误：test failed", "验证未通过或未完成", "没有 commit 证据"} {
		if !strings.Contains(summary, want) {
			t.Fatalf("summary missing risk %q: %s", want, summary)
		}
	}
}

func TestSummarizeLogsBoundsOutput(t *testing.T) {
	longLine := strings.Repeat("测", 400)
	got := summarizeLogs(longLine)
	if len([]rune(got)) > 263 {
		t.Fatalf("expected bounded log summary, got %d runes", len([]rune(got)))
	}
	if !strings.HasSuffix(got, "...") {
		t.Fatalf("expected truncated summary suffix, got %q", got)
	}
}

func TestSummarizeEvidenceStatuses(t *testing.T) {
	got := summarizeEvidenceStatuses(notificationBodyInput{CIStatus: "missing", StagingStatus: "configured", ObservabilityStatus: "missing", ArtifactGraphStatus: "linked"})
	for _, want := range []string{"ci=missing", "staging=configured", "observability=missing", "artifact_graph=linked"} {
		if !strings.Contains(got, want) {
			t.Fatalf("evidence summary missing %q: %s", want, got)
		}
	}
}

func TestStartNotifierFromEnvSkipsMissingToken(t *testing.T) {
	t.Setenv("MORTIS_TELEGRAM_NOTIFY_ENABLED", "true")
	t.Setenv("TELEGRAM_BOT_TOKEN", "")
	if err := StartNotifierFromEnv(t.Context(), nil, nil); err != nil {
		t.Fatalf("expected missing token to skip notifier without crashing server, got %v", err)
	}
}
