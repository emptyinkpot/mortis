package qqbridge

import (
	"strings"
	"testing"
)

func TestNormalizeTargetType(t *testing.T) {
	cases := map[string]string{
		"group":    "group",
		"group_id": "group",
		"private":  "private",
		"user_id":  "private",
		"friend":   "private",
		"unknown":  "",
	}
	for input, want := range cases {
		if got := normalizeTargetType(input); got != want {
			t.Fatalf("normalizeTargetType(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestFormatMessageIncludesExecutionSummary(t *testing.T) {
	message := formatMessage(pendingNotification{
		Title:   "QQ loop proof",
		Runtime: "builder-local-codex",
		Status:  "completed",
		Body:    "status: completed\ncommit: abc123",
	})
	for _, want := range []string{"Mortis 任务已完成", "QQ loop proof", "status: completed", "commit: abc123"} {
		if !strings.Contains(message, want) {
			t.Fatalf("formatted message missing %q: %s", want, message)
		}
	}
}

func TestFormatMessageForTesterVerification(t *testing.T) {
	message := formatMessage(pendingNotification{
		Title:        "Verify Builder action abc",
		Runtime:      "tester-local-verifier",
		Status:       "completed",
		FinalSummary: "CEO 最终汇总\n实现结果: completed\n验证结果: completed\n剩余风险: 暂无已知剩余风险",
		Body: buildBody(notificationBodyInput{
			Status:              "completed",
			Runtime:             "tester-local-verifier",
			VerifiedFrom:        "builder-invocation",
			WorkspaceDir:        "/srv/multica/agent-workspaces/action-abc/repo",
			Logs:                "$ git status --short\n$ git log -1 --oneline\nabc123 feat: work",
			CIStatus:            "missing",
			StagingStatus:       "missing",
			ObservabilityStatus: "missing",
			ArtifactGraphStatus: "linked",
		}),
	})
	for _, want := range []string{"Mortis 验证已完成", "tester-local-verifier", "verified_from: builder-invocation", "logs:", "evidence: ci=missing", "artifact_graph=linked", "CEO 最终汇总", "剩余风险"} {
		if !strings.Contains(message, want) {
			t.Fatalf("formatted tester message missing %q: %s", want, message)
		}
	}
}

func TestBuildFinalSummaryCombinesImplementationVerificationAndRisk(t *testing.T) {
	summary := buildFinalSummary(finalSummaryInput{
		BuilderStatus:      "completed",
		BuilderRuntime:     "builder-local-codex",
		Commit:             "abc123",
		Branch:             "mortis/action-1",
		ChangedFiles:       `["README.md"]`,
		BuilderLogs:        "$ go test ./internal/roles\nok",
		VerificationStatus: "completed",
		VerificationLogs:   "$ git status --short\n$ git log -1 --oneline",
	})
	for _, want := range []string{"CEO 最终汇总", "实现结果: completed / builder-local-codex", "commit: abc123", "验证结果: completed", "剩余风险: 暂无已知剩余风险"} {
		if !strings.Contains(summary, want) {
			t.Fatalf("summary missing %q: %s", want, summary)
		}
	}
}

func TestBuildFinalSummaryReportsVerificationRisk(t *testing.T) {
	summary := buildFinalSummary(finalSummaryInput{
		BuilderStatus:      "completed",
		VerificationStatus: "failed",
		VerificationError:  "test failed",
	})
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
	got := summarizeEvidenceStatuses(notificationBodyInput{
		CIStatus:            "missing",
		StagingStatus:       "configured",
		ObservabilityStatus: "missing",
		ArtifactGraphStatus: "linked",
	})
	for _, want := range []string{"ci=missing", "staging=configured", "observability=missing", "artifact_graph=linked"} {
		if !strings.Contains(got, want) {
			t.Fatalf("evidence summary missing %q: %s", want, got)
		}
	}
}

func TestParseOneBotURLMap(t *testing.T) {
	raw := `{"3974470627":"http://napcat-qq1:3000/","2264869713":"http://napcat-qq4:3000"}`
	got := parseOneBotURLMap(raw)
	if got["3974470627"] != "http://napcat-qq1:3000" {
		t.Fatalf("expected qq1 url to be normalized, got %q", got["3974470627"])
	}
	if got["2264869713"] != "http://napcat-qq4:3000" {
		t.Fatalf("expected qq4 url, got %q", got["2264869713"])
	}
}

func TestInboundHandlerOneBotURLForSelfID(t *testing.T) {
	h := &InboundHandler{
		oneBotURL: "http://napcat-qq1:3000",
		oneBotURLs: map[string]string{
			"2264869713": "http://napcat-qq4:3000",
		},
	}
	if got := h.oneBotURLForSelfID("2264869713"); got != "http://napcat-qq4:3000" {
		t.Fatalf("expected mapped qq4 url, got %q", got)
	}
	if got := h.oneBotURLForSelfID("missing"); got != "http://napcat-qq1:3000" {
		t.Fatalf("expected fallback url, got %q", got)
	}
}

func TestInboundHandlerIgnoresBotAndBridgeMessages(t *testing.T) {
	h := &InboundHandler{
		botUserIDs: map[string]bool{
			"3974470627": true,
		},
	}
	cases := []struct {
		userID  string
		content string
	}{
		{"3974470627", "@builder do work"},
		{"1915791855", "Mortis 已收到: Manager AI / proposed"},
		{"1915791855", "Mortis 任务已完成\n\nstatus: completed"},
		{"1915791855", "[CQ:reply,id=565339642]Mortis 已收到: Manager AI / proposed"},
		{"1915791855", "[NapCat] 温馨提示: token"},
	}
	for _, tc := range cases {
		if !h.isBotMessage(tc.userID, tc.content) {
			t.Fatalf("expected message from %s with content %q to be ignored", tc.userID, tc.content)
		}
	}
	if h.isBotMessage("1915791855", "@builder do work") {
		t.Fatal("expected operator builder command to be accepted")
	}
}

func TestInboundHandlerRequiredMentionAcceptsCQAtBotID(t *testing.T) {
	h := &InboundHandler{
		botUserIDs: map[string]bool{
			"3974470627": true,
		},
	}
	if !h.hasRequiredMention("[CQ:at,qq=3974470627] 帮我看一下") {
		t.Fatal("expected CQ at mention for a bot id to satisfy required mention")
	}
	if h.hasRequiredMention("[CQ:at,qq=123] 普通聊天") {
		t.Fatal("expected unrelated CQ at mention not to satisfy required mention")
	}
	if !h.hasRequiredMention("@builder do work") {
		t.Fatal("expected textual role mention to satisfy required mention")
	}
}

func TestQQDedupeKeyIgnoresSelfIDAndWhitespace(t *testing.T) {
	base := oneBotMessageEvent{
		MessageType: "group",
		GroupID:     "12345",
		UserID:      "1915791855",
		SelfID:      "3974470627",
	}
	otherReceiver := base
	otherReceiver.SelfID = "2264869713"

	first := qqDedupeKey(base, "@builder   do\nwork")
	second := qqDedupeKey(otherReceiver, "@builder do work")
	if first == "" {
		t.Fatal("expected dedupe key")
	}
	if first != second {
		t.Fatalf("expected same logical QQ message to dedupe across receiving bot accounts: %q != %q", first, second)
	}
}

func TestQQDedupeKeySeparatesSenderAndGroup(t *testing.T) {
	base := oneBotMessageEvent{
		MessageType: "group",
		GroupID:     "12345",
		UserID:      "1915791855",
	}
	otherSender := base
	otherSender.UserID = "222"
	otherGroup := base
	otherGroup.GroupID = "67890"

	key := qqDedupeKey(base, "@builder do work")
	if key == qqDedupeKey(otherSender, "@builder do work") {
		t.Fatal("expected different senders not to dedupe")
	}
	if key == qqDedupeKey(otherGroup, "@builder do work") {
		t.Fatal("expected different groups not to dedupe")
	}
}

func TestExtractMessageTextFromArray(t *testing.T) {
	text := extractMessageText(oneBotMessageEvent{
		Message: []byte(`[{"type":"text","data":{"text":"@builder do work"}},{"type":"image","data":{"file":"x.png"}}]`),
	})
	if text != "@builder do work" {
		t.Fatalf("extractMessageText = %q", text)
	}
}
