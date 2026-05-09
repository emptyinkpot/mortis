package qqagents

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/multica-ai/multica/server/internal/roles"
)

func TestDecodeChatCompletionContent(t *testing.T) {
	body := `{"choices":[{"message":{"content":" Builder 接，我先看代码。 "}}]}`
	got, err := decodeChatCompletionContent(strings.NewReader(body))
	if err != nil {
		t.Fatalf("decodeChatCompletionContent returned error: %v", err)
	}
	if got != " Builder 接，我先看代码。 " {
		t.Fatalf("unexpected content: %q", got)
	}
}

func TestDecodeResponsesContentFromOutputText(t *testing.T) {
	body := `{"output_text":"我在，直接说要推进什么。"}`
	got, err := decodeResponsesContent(strings.NewReader(body))
	if err != nil {
		t.Fatalf("decodeResponsesContent returned error: %v", err)
	}
	if got != "我在，直接说要推进什么。" {
		t.Fatalf("unexpected content: %q", got)
	}
}

func TestDecodeResponsesContentFromOutputParts(t *testing.T) {
	body := `{"output":[{"type":"message","content":[{"type":"output_text","text":"Tester 后面验收。"}]}]}`
	got, err := decodeResponsesContent(strings.NewReader(body))
	if err != nil {
		t.Fatalf("decodeResponsesContent returned error: %v", err)
	}
	if got != "Tester 后面验收。" {
		t.Fatalf("unexpected content: %q", got)
	}
}


func TestCleanReplyCollapsesExactRepeatedReply(t *testing.T) {
	input := "抱歉抱歉！刚才的重复是推送bug导致的，我已经调整了发送逻辑。抱歉抱歉！刚才的重复是推送bug导致的，我已经调整了发送逻辑。"
	want := "抱歉抱歉！刚才的重复是推送bug导致的，我已经调整了发送逻辑。"
	if got := cleanReply(input); got != want {
		t.Fatalf("expected exact duplicated reply to collapse to %q, got %q", want, got)
	}
}

func TestCleanReplyKeepsNormalRepeatedWords(t *testing.T) {
	input := "你好你好，我在。"
	if got := cleanReply(input); got != input {
		t.Fatalf("expected normal repeated words to stay unchanged, got %q", got)
	}
}

func TestHumanMentionIgnoresConsecutiveSpeechCount(t *testing.T) {
	engine := InterestEngine{BotIDs: map[string]bool{"3974470627": true}}
	agent := defaultAgentsFromEnv()[0]
	state := AgentState{
		Role:                RoleCEO,
		ConsecutiveSpeeches: 2,
	}
	recent := []QQMessage{
		{
			MessageID: "human-mention",
			GroupID:   "474958794",
			SenderUIN: "1915791855",
			Text:      "[CQ:at,qq=3974470627] 在吗",
		},
	}

	thought := engine.Think(agent, state, recent, time.Now())
	if !thought.ShouldSpeak {
		t.Fatalf("expected human mention to ignore consecutive speech count, got reason=%q interest=%.2f", thought.Reason, thought.Interest)
	}
	if thought.Desire < 0.95 {
		t.Fatalf("expected strong desire for direct human mention, got %.2f", thought.Desire)
	}
	if thought.Reason != "human mentioned this agent" {
		t.Fatalf("unexpected reason: %q", thought.Reason)
	}
}

func TestPeerMentionIgnoresConsecutiveSpeechCount(t *testing.T) {
	engine := InterestEngine{BotIDs: map[string]bool{
		"3974470627": true,
		"3316734532": true,
	}}
	agent := defaultAgentsFromEnv()[1]
	state := AgentState{
		Role:                RoleBuilder,
		ConsecutiveSpeeches: 5,
	}
	recent := []QQMessage{
		{
			MessageID: "peer-mention",
			GroupID:   "474958794",
			SenderUIN: "3974470627",
			Text:      "@builder 这个接口你看一下",
		},
	}

	thought := engine.Think(agent, state, recent, time.Now())
	if !thought.ShouldSpeak {
		t.Fatalf("expected peer mention to ignore consecutive speech count, got reason=%q interest=%.2f", thought.Reason, thought.Interest)
	}
	if thought.Desire < 0.70 {
		t.Fatalf("expected peer mention to produce high desire, got %.2f", thought.Desire)
	}
	if thought.Reason != "peer or context drew attention" {
		t.Fatalf("unexpected reason: %q", thought.Reason)
	}
}

func TestCooldownDoesNotHardBlockHumanMention(t *testing.T) {
	engine := InterestEngine{BotIDs: map[string]bool{"3974470627": true}}
	agent := defaultAgentsFromEnv()[0]
	state := AgentState{
		Role:        RoleCEO,
		LastSpokeAt: time.Now(),
	}
	recent := []QQMessage{
		{
			MessageID: "fast-human-mention",
			GroupID:   "474958794",
			SenderUIN: "1915791855",
			Text:      "[CQ:at,qq=3974470627] 你别装死",
		},
	}

	thought := engine.Think(agent, state, recent, time.Now())
	if !thought.ShouldSpeak {
		t.Fatalf("expected fixed cooldown not to hard block human mention, got reason=%q desire=%.2f", thought.Reason, thought.Desire)
	}
}

func TestSelfSpeechCreatesSoftSocialPressure(t *testing.T) {
	agent := defaultAgentsFromEnv()[1]
	recent := []QQMessage{
		{SenderUIN: agent.QQUIN, Text: "这个状态机炸了"},
		{SenderUIN: agent.QQUIN, Text: "而且 callback 也有问题"},
	}
	withoutPressure := socialDrive(agent, AgentState{Role: RoleBuilder}, nil, 0.55, false, false, false, time.Now())
	withPressure := socialDrive(agent, AgentState{Role: RoleBuilder}, recent, 0.55, false, false, false, time.Now())

	if withPressure >= withoutPressure {
		t.Fatalf("expected self speech pressure to lower desire: with=%.2f without=%.2f", withPressure, withoutPressure)
	}
	if withPressure <= 0 {
		t.Fatalf("expected self pressure to be soft, not a hard block: %.2f", withPressure)
	}
}

func TestPeerAddressingRaisesDesireAfterSelfSpeech(t *testing.T) {
	agent := defaultAgentsFromEnv()[1]
	recent := []QQMessage{
		{SenderUIN: agent.QQUIN, Text: "这个状态机炸了"},
		{SenderUIN: "3974470627", Text: "@builder 那你看一下接口"},
	}

	desire := socialDrive(agent, AgentState{Role: RoleBuilder}, recent, 0.45, true, true, false, time.Now())
	if desire < 0.80 {
		t.Fatalf("expected peer addressing to overcome self pressure, got %.2f", desire)
	}
}

func TestSocialPressureDoesNotNerfExecutiveDrive(t *testing.T) {
	agent := defaultAgentsFromEnv()[1]
	recent := []QQMessage{
		{SenderUIN: agent.QQUIN, Text: "这个状态机炸了"},
		{SenderUIN: agent.QQUIN, Text: "而且 callback 也有问题"},
	}
	social := socialDrive(agent, AgentState{Role: RoleBuilder}, recent, 0.40, false, false, false, time.Now())
	work := executiveDrive(agent, 0.40, false, true, false)

	if social >= work {
		t.Fatalf("expected work drive to dominate under social pressure: social=%.2f work=%.2f", social, work)
	}
	if work < 0.70 {
		t.Fatalf("expected task work drive to stay high, got %.2f", work)
	}
}

func TestClassifyIntentRoutesSocialAndResearchToGLM(t *testing.T) {
	profile := RoleRuntimeProfile{
		RoleSlug:        "watcher",
		ChatRuntime:     "glm",
		ResearchRuntime: "glm",
		PlanningRuntime: "glm",
		WorkRuntime:     "codex",
		TestRuntime:     "codex",
	}
	cases := []struct {
		text   string
		intent IntentKind
	}{
		{"你们觉得这个方向怎么样", IntentPlanning},
		{"查一下 B站 有没有类似项目", IntentResearch},
		{"今天群里水一下", IntentChat},
	}
	for _, tc := range cases {
		intent := classifyIntent(tc.text)
		if intent != tc.intent {
			t.Fatalf("classifyIntent(%q)=%s, want %s", tc.text, intent, tc.intent)
		}
		route := routeForIntent(profile, intent)
		if route.Runtime != "glm" {
			t.Fatalf("routeForIntent(%s) runtime=%q, want glm", intent, route.Runtime)
		}
		if route.AllowCodeIO {
			t.Fatalf("GLM route for %s must not allow code IO", intent)
		}
	}
}

func TestClassifyIntentRoutesCodeAndTestsToCodex(t *testing.T) {
	profile := RoleRuntimeProfile{
		RoleSlug:        "builder",
		ChatRuntime:     "glm",
		ResearchRuntime: "glm",
		PlanningRuntime: "glm",
		WorkRuntime:     "codex",
		TestRuntime:     "codex",
	}
	cases := []struct {
		text   string
		intent IntentKind
	}{
		{"修一下 Builder 不回复的问题", IntentCodeChange},
		{"跑测试看看哪里炸了", IntentTestExecution},
		{"根据日志排查仓库里的报错", IntentRepoDebug},
	}
	for _, tc := range cases {
		intent := classifyIntent(tc.text)
		if intent != tc.intent {
			t.Fatalf("classifyIntent(%q)=%s, want %s", tc.text, intent, tc.intent)
		}
		route := routeForIntent(profile, intent)
		if route.Runtime != "codex" {
			t.Fatalf("routeForIntent(%s) runtime=%q, want codex", intent, route.Runtime)
		}
		if !route.AllowCodeIO {
			t.Fatalf("Codex route for %s must allow code IO", intent)
		}
	}
}

func TestPGTaskRouterMapsWorkIntentsToExecutableActions(t *testing.T) {
	candidates := []roles.Candidate{
		{ID: "builder-id", Name: "builder", Title: "Builder"},
		{ID: "tester-id", Name: "tester", Title: "Tester"},
	}
	cases := []struct {
		name        string
		target      AgentRole
		intent      IntentKind
		commandType string
		riskLevel   string
		approval    bool
	}{
		{"code", RoleBuilder, IntentCodeChange, "code_change", "low", false},
		{"repo-debug", RoleBuilder, IntentRepoDebug, "code_change", "low", false},
		{"test", RoleTester, IntentTestExecution, "test_execution", "low", false},
		{"research", RoleWatcher, IntentResearch, "research", "low", false},
		{"planning", RoleCEO, IntentPlanning, "create_plan", "medium", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			route := routeToTargetRole(candidates, tc.target, tc.intent)
			if route.RoleName != string(tc.target) {
				t.Fatalf("role=%q, want %q", route.RoleName, tc.target)
			}
			if route.CommandType != tc.commandType {
				t.Fatalf("commandType=%q, want %q", route.CommandType, tc.commandType)
			}
			if route.RiskLevel != tc.riskLevel {
				t.Fatalf("riskLevel=%q, want %q", route.RiskLevel, tc.riskLevel)
			}
			if route.RequiresApproval != tc.approval {
				t.Fatalf("requiresApproval=%v, want %v", route.RequiresApproval, tc.approval)
			}
		})
	}
}

func TestBuildHumanLikePromptIncludesRuntimeBoundary(t *testing.T) {
	t.Setenv("MORTIS_QQ_LLM_ENABLED", "true")
	t.Setenv("MORTIS_QQ_LLM_MODEL", "gpt-5.5")
	t.Setenv("MORTIS_QQ_LLM_BASE_URL", "https://sub2api.tengokukk.com/v1")
	t.Setenv("MORTIS_QQ_LLM_WIRE_API", "chat_completions")
	agent := defaultAgentsFromEnv()[0]
	req := ChatRequest{
		Agent: agent,
		Thought: Thought{
			Intent: IntentPlanning,
			Route: RuntimeRoute{
				Intent:      IntentPlanning,
				Runtime:     "glm",
				AllowCodeIO: false,
				Reason:      "planning and discussion stay in GLM runtime",
			},
		},
		MaxChars: 120,
	}
	prompt := BuildHumanLikePrompt(req)
	for _, want := range []string{"当前公开聊天模型：gpt-5.5", "https://sub2api.tengokukk.com/v1", "全权限披露模式", "生产操作权限", "GLM Runtime 是脑子和嘴", "Codex Runtime 是手", "你当前这次意图：planning", "路由 runtime：glm"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q:\n%s", want, prompt)
		}
	}
}

func TestBuildHumanLikePromptSeparatesTurnFocusFromHistory(t *testing.T) {
	agent := defaultAgentsFromEnv()[0]
	prompt := BuildHumanLikePrompt(ChatRequest{
		Agent: agent,
		Recent: []QQMessage{
			{SenderName: "operator", SenderUIN: "human", Text: "你现在能干活吗"},
			{SenderName: "Mortis", SenderUIN: agent.QQUIN, Text: "能，走 Builder/Tester。"},
			{SenderName: "operator", SenderUIN: "human", Text: "你为什么一次性回复好几条之前的问题"},
		},
		Focus:    QQMessage{SenderName: "operator", SenderUIN: "human", Text: "你为什么一次性回复好几条之前的问题"},
		Thought:  Thought{Intent: IntentChat, Route: RuntimeRoute{Runtime: "glm"}, Interest: 0.9, SocialDrive: 0.9, Reason: "user correction"},
		MaxChars: 120,
	})
	for _, want := range []string{"Turn Policy", "本轮焦点消息", "只回答“本轮焦点消息”", "不要逐条补答旧问题", "operator: 你为什么一次性回复好几条之前的问题"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q:\n%s", want, prompt)
		}
	}
}

func TestRuleBasedModelFailsWhenFallbackDisabled(t *testing.T) {
	_, err := (RuleBasedModel{}).Generate(context.Background(), ChatRequest{Agent: defaultAgentsFromEnv()[0]})
	if err == nil || !strings.Contains(err.Error(), "rule fallback disabled") {
		t.Fatalf("expected disabled fallback error, got %v", err)
	}
}

func TestActionContractPreservesRuntimeMetadata(t *testing.T) {
	payload := roles.BuildActionContractPayload(roles.ActionContractInput{
		Content:     "修一下 Builder 不回复的问题",
		Channel:     "qq_living_group",
		RoleName:    "builder",
		CommandType: "implementation",
		RiskLevel:   "low",
		Metadata: map[string]any{
			"intent":            "code_change",
			"chat_runtime":      "glm",
			"execution_runtime": "codex",
		},
	})
	contract, ok := payload["action_contract"].(map[string]any)
	if !ok {
		t.Fatalf("missing action_contract: %#v", payload)
	}
	if contract["intent"] != "code_change" {
		t.Fatalf("intent=%v, want code_change", contract["intent"])
	}
	if contract["runtime"] != "codex" {
		t.Fatalf("runtime=%v, want codex", contract["runtime"])
	}
	if contract["chat_runtime"] != "glm" {
		t.Fatalf("chat_runtime=%v, want glm", contract["chat_runtime"])
	}
	acceptance, ok := contract["acceptance"].([]string)
	if !ok {
		t.Fatalf("acceptance has unexpected type: %#v", contract["acceptance"])
	}
	if !testStringSliceContains(acceptance, "按 operator 授权范围执行，可包含生产写入/部署/回滚") {
		t.Fatalf("expected full operator authorization acceptance, got %#v", acceptance)
	}
}

func TestBotSelfMessagesDoNotTriggerCognition(t *testing.T) {
	messages := []QQMessage{
		{SenderUIN: "3974470627", Text: "在，先别刷测试了"},
		{SenderUIN: "3974470627", Text: "我在，重复回执先记一下"},
	}
	botIDs := map[string]bool{"3974470627": true}

	if hasCognitiveTrigger(messages, botIDs) {
		t.Fatal("expected pure bot self messages not to trigger cognition")
	}
}

func testStringSliceContains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func TestHumanMessagesTriggerCognition(t *testing.T) {
	messages := []QQMessage{
		{SenderUIN: "1915791855", Text: "你停，现在你又开始自己回复自己了"},
	}
	botIDs := map[string]bool{"3974470627": true}

	if !hasCognitiveTrigger(messages, botIDs) {
		t.Fatal("expected human message to trigger cognition")
	}
}

func TestHistoryReadersIncludeEveryOnlineRole(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
		Store:   newMemoryStoreMemory(),
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{
		RoleCEO:     true,
		RoleBuilder: false,
		RoleTester:  true,
		RoleWatcher: true,
	}

	readers := rt.historyReaders()
	if len(readers) != 3 {
		t.Fatalf("expected three online history readers, got %d: %#v", len(readers), readers)
	}
	got := map[AgentRole]bool{}
	for _, agent := range readers {
		got[agent.Role] = true
	}
	for _, role := range []AgentRole{RoleCEO, RoleTester, RoleWatcher} {
		if !got[role] {
			t.Fatalf("missing reader role %s in %#v", role, readers)
		}
	}
	if got[RoleBuilder] {
		t.Fatalf("offline builder should not be a history reader: %#v", readers)
	}
}

func TestHistoryReadersPreferLastSuccessfulRole(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
		Store:   newMemoryStoreMemory(),
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true}
	rt.lastHistoryRole = RoleTester

	readers := rt.historyReaders()
	if len(readers) != 3 {
		t.Fatalf("expected three readers, got %#v", readers)
	}
	if readers[0].Role != RoleTester {
		t.Fatalf("expected tester to be first after successful history read, got %#v", readers)
	}
}

func TestTalkativeStudioModeRaisesOrdinaryDiscussionReplies(t *testing.T) {
	agents := defaultAgentsFromEnv()
	engine := InterestEngine{BotIDs: map[string]bool{
		agents[0].QQUIN: true,
		agents[1].QQUIN: true,
		agents[2].QQUIN: true,
		agents[3].QQUIN: true,
	}}
	recent := []QQMessage{
		{SenderUIN: "1915791855", Text: "我需要你们像一个工作室一样，日常对话里多交换信息，说说你们觉得哪里需要改。@ceo @builder @tester @watcher"},
	}
	speakers := 0
	for _, agent := range agents {
		thought := engine.Think(agent, AgentState{Role: agent.Role}, recent, time.Now())
		if thought.ShouldSpeak {
			speakers++
		}
		if thought.Desire < 0.60 {
			t.Fatalf("expected talkative desire for %s, got %.2f reason=%s", agent.Role, thought.Desire, thought.Reason)
		}
	}
	if speakers < 3 {
		t.Fatalf("expected at least three agents willing to speak in talkative mode, got %d", speakers)
	}
}

func TestHumanPromptIncludesStudioAddressBook(t *testing.T) {
	agent := defaultAgentsFromEnv()[1]
	prompt := BuildHumanLikePrompt(ChatRequest{
		Agent: agent,
		Recent: []QQMessage{
			{SenderName: "human", SenderUIN: "1915791855", Text: "你们共用的数据库在哪里，权限缺口是什么？"},
		},
		Thought:  Thought{Interest: 0.9, WorkDrive: 0.9, SocialDrive: 0.8, Reason: "address book question"},
		MaxChars: 220,
	})

	for _, want := range []string{
		"/srv/multica",
		"127.0.0.1:55432",
		"/夸克网盘/Mortis-AI-Society",
		"role_actions",
		"builder-local-codex",
		"Artifact-first",
		"action-<id>/repo",
		"smoke test",
		"codex-cli 0.128.0",
		".mortis-smoke.txt",
		"Tester 当前能力",
		"tester-local-verifier",
		"Studio State",
		"Digital Human Behavior Layer",
		"agent_feed_items",
		"LangGraph",
		"Letta/MemGPT",
		"OpenHands",
		"browser-use",
		"NATS/Redis Streams",
		"ai_infra_langgraph",
		"ai_infra_letta_memory",
		"CI URL/API",
		"不要假装不知道",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to include %q, got:\n%s", want, prompt)
		}
	}
}

func TestFeedSignalScoring(t *testing.T) {
	text := "这个 GitHub repo 和 B站视频挺有用，笑死但确实能参考。"
	tags := strings.Join(feedTags(text), ",")
	for _, want := range []string{"repo", "video", "meme"} {
		if !strings.Contains(tags, want) {
			t.Fatalf("expected feed tags to include %s, got %q", want, tags)
		}
	}
	if feedEmotion(text) != "amused" {
		t.Fatalf("expected amused emotion, got %s", feedEmotion(text))
	}
	if memePotential(text) <= 0.50 {
		t.Fatalf("expected high meme potential")
	}
	if technicalValue(text) <= 0.40 {
		t.Fatalf("expected technical value")
	}
	if socialValue(text) <= 0.30 {
		t.Fatalf("expected social value")
	}
	if currentInterest(RoleWatcher, text) != "external_signal" {
		t.Fatalf("expected watcher external signal interest")
	}
}

func TestPeerRoleMentionTriggersCognition(t *testing.T) {
	messages := []QQMessage{
		{SenderUIN: "3974470627", Text: "@builder 查一下去重逻辑"},
	}
	botIDs := map[string]bool{"3974470627": true}

	if !hasCognitiveTrigger(messages, botIDs) {
		t.Fatal("expected bot role mention to trigger cognition")
	}
}

func TestCQAtBotMentionTriggersCognition(t *testing.T) {
	messages := []QQMessage{
		{SenderUIN: "3974470627", Text: "[CQ:at,qq=3316734532] 说话"},
	}
	botIDs := map[string]bool{"3974470627": true, "3316734532": true}

	if !hasCognitiveTrigger(messages, botIDs) {
		t.Fatal("expected CQ at mention for a bot account to trigger cognition")
	}
}

func TestCQAtBotMentionFromPeerRemainsFocus(t *testing.T) {
	agents := defaultAgentsFromEnv()
	botIDs := map[string]bool{
		agents[0].QQUIN: true,
		agents[1].QQUIN: true,
	}
	recent := []QQMessage{
		{SenderUIN: "1915791855", Text: "都报数"},
		{SenderUIN: agents[0].QQUIN, Text: "[CQ:at,qq=" + agents[1].QQUIN + "] 说话"},
	}

	focus, ok := latestFocusMessage(recent, botIDs)
	if !ok {
		t.Fatal("expected peer CQ at mention to remain focus")
	}
	if focus.Text != recent[1].Text {
		t.Fatalf("expected CQ at mention focus, got %#v", focus)
	}

	thought := (InterestEngine{BotIDs: botIDs}).Think(agents[1], AgentState{Role: RoleBuilder}, recent, time.Now())
	if !thought.ShouldSpeak {
		t.Fatalf("expected builder to speak when directly CQ mentioned, thought=%#v", thought)
	}
}

func TestRepeatedOnlineCheckDoesNotKeepSpeaking(t *testing.T) {
	agent := defaultAgentsFromEnv()[0]
	engine := InterestEngine{BotIDs: map[string]bool{agent.QQUIN: true}}
	now := time.Now()
	recent := []QQMessage{
		{SenderUIN: "1915791855", Text: "在吗", Time: now.Add(-70 * time.Second)},
		{SenderUIN: agent.QQUIN, Text: "在，我这边在线。", Time: now.Add(-65 * time.Second)},
		{SenderUIN: "1915791855", Text: "在不在", Time: now.Add(-3 * time.Second)},
	}

	thought := engine.Think(agent, AgentState{Role: RoleCEO}, recent, now)
	if thought.ShouldSpeak {
		t.Fatalf("expected repeated online check to be observed without another reply, reason=%q desire=%.2f", thought.Reason, thought.Desire)
	}
	if thought.Reason != "repeated online check already answered" {
		t.Fatalf("unexpected reason: %q", thought.Reason)
	}
}

func TestOfflineRolesAreNotSelectedToSpeak(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: false}
	speakers := rt.speakingAgents(map[AgentRole]Thought{
		RoleCEO:     {ShouldSpeak: true},
		RoleBuilder: {ShouldSpeak: true},
	}, nil)
	if len(speakers) != 1 || speakers[0].Role != RoleCEO {
		t.Fatalf("expected only online CEO to speak, got %#v", speakers)
	}
}

func TestBuildTurnEnvelopeUsesStableMessageIdentity(t *testing.T) {
	focus := QQMessage{MessageID: "42", GroupID: "474958794", SenderUIN: "1915791855", Text: "当前问题", Time: time.Now()}
	turn := buildTurnEnvelope("qq", "474958794", focus)
	if turn.TurnID != "qq:474958794:42" {
		t.Fatalf("turn id=%q", turn.TurnID)
	}
	if turn.FocusPolicy != "latest_message" || turn.ReplyBudget != 1 || turn.ActorID != "1915791855" || turn.Text != "当前问题" {
		t.Fatalf("unexpected turn envelope: %#v", turn)
	}
}

func TestSpeakerGateCorrectionSelectsCEO(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	speakers := rt.speakingAgents(map[AgentRole]Thought{
		RoleCEO:     {ShouldSpeak: true, Desire: 0.40},
		RoleBuilder: {ShouldSpeak: true, Desire: 0.99},
		RoleTester:  {ShouldSpeak: true, Desire: 0.90},
		RoleWatcher: {ShouldSpeak: true, Desire: 0.80},
	}, []QQMessage{{SenderUIN: "1915791855", Text: "你现在令我感到不满意，为什么又重复回答旧问题", Time: time.Now()}})
	if len(speakers) != 1 || speakers[0].Role != RoleCEO {
		t.Fatalf("expected CEO to handle correction alone, got %#v", speakers)
	}
}

func TestSpeakerGateDirectHumanMentionSelectsOneAddressedSpeaker(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	speakers := rt.speakingAgents(map[AgentRole]Thought{
		RoleCEO:     {ShouldSpeak: true, Desire: 0.95},
		RoleBuilder: {ShouldSpeak: true, Desire: 0.60},
		RoleTester:  {ShouldSpeak: true, Desire: 0.70},
		RoleWatcher: {ShouldSpeak: true, Desire: 0.80},
	}, []QQMessage{{SenderUIN: "1915791855", Text: "@builder 说话", Time: time.Now()}})
	if len(speakers) != 1 || speakers[0].Role != RoleBuilder {
		t.Fatalf("expected one addressed speaker, got %#v", speakers)
	}
}

func TestSpeakerGateAllowsExplicitRound(t *testing.T) {
	agents := defaultAgentsFromEnv()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	speakers := rt.speakingAgents(map[AgentRole]Thought{
		RoleCEO:     {ShouldSpeak: true, Desire: 0.95},
		RoleBuilder: {ShouldSpeak: true, Desire: 0.60},
		RoleTester:  {ShouldSpeak: true, Desire: 0.70},
		RoleWatcher: {ShouldSpeak: true, Desire: 0.80},
	}, []QQMessage{{SenderUIN: "1915791855", Text: "你们轮流说一下", Time: time.Now()}})
	if len(speakers) != 4 {
		t.Fatalf("expected explicit round to keep all speakers, got %#v", speakers)
	}
}

func TestLooksLikeStatusProbeRequest(t *testing.T) {
	cases := []string{
		"@東風 ソラ 你怎么不回",
		"看看他的情况",
		"你们看看他怎么了",
		"Builder 是不是卡住了",
		"/check builder",
	}
	for _, text := range cases {
		if !looksLikeStatusProbeRequest(text) {
			t.Fatalf("expected status probe trigger for %q", text)
		}
	}
}

func TestStatusProbeTargetsBuilderFromAlias(t *testing.T) {
	recent := []QQMessage{
		{SenderUIN: "1915791855", Text: "@東風 ソラ 你怎么不说"},
		{SenderUIN: "1915791855", Text: "你们看看他的情况"},
	}
	if got := targetRoleForStatusProbe("他怎么不回", recent); got != RoleBuilder {
		t.Fatalf("expected builder target from recent alias, got %s", got)
	}
}

func TestStatusProbeWorkflowReportsOperationalState(t *testing.T) {
	agents := defaultAgentsFromEnv()
	store := newMemoryStoreMemory()
	var sent []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/send_group_msg" {
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		sent = append(sent, anyString(payload["message"]))
		_, _ = w.Write([]byte(`{"status":"ok","retcode":0}`))
	}))
	defer server.Close()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
		Store:   store,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.clients[RoleCEO] = &OneBotClient{BaseURL: server.URL, Client: server.Client()}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	recent := []QQMessage{
		{MessageID: "ask-builder", GroupID: "474958794", SenderUIN: "1915791855", Text: "@東風 ソラ 你怎么不说", Time: time.Now().Add(-30 * time.Second)},
		{MessageID: "builder-last", GroupID: "474958794", SenderUIN: agents[1].QQUIN, Text: "我在等 action contract。", Time: time.Now().Add(-20 * time.Second)},
		{MessageID: "probe", GroupID: "474958794", SenderUIN: "1915791855", Text: "你们看看他的情况", Time: time.Now()},
	}

	if !rt.tryStudioWorkflow(context.Background(), recent) {
		t.Fatal("expected status probe workflow to handle request")
	}
	if len(sent) != 1 {
		t.Fatalf("expected one CEO status report, got %d: %#v", len(sent), sent)
	}
	if !strings.Contains(sent[0], "状态探针：Builder") {
		t.Fatalf("expected builder status report, got %q", sent[0])
	}
	if !strings.Contains(sent[0], "QQ 在线：是") {
		t.Fatalf("expected online evidence, got %q", sent[0])
	}
	if !strings.Contains(sent[0], "我在等 action contract") {
		t.Fatalf("expected last speech evidence, got %q", sent[0])
	}
	if len(store.threads) != 1 {
		t.Fatalf("expected status thread, got %d", len(store.threads))
	}
	if len(store.events) != 1 || store.events[0].Intent != "status_probe" {
		t.Fatalf("expected status probe cognitive event, got %#v", store.events)
	}
}

func TestOneBotPostRejectsFailedEnvelope(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/send_group_msg" {
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		_, _ = w.Write([]byte(`{"status":"failed","retcode":200,"message":"Timeout: NTEvent serviceAndMethod:NodeIKernelMsgService/sendMsg"}`))
	}))
	defer server.Close()
	client := &OneBotClient{BaseURL: server.URL, Client: server.Client()}

	err := client.SendGroupMessage(context.Background(), "474958794", "builder-visible-test")
	if err == nil {
		t.Fatal("expected failed onebot envelope to return an error")
	}
	if !strings.Contains(err.Error(), "sendMsg") {
		t.Fatalf("expected sendMsg evidence in error, got %v", err)
	}
}

func TestGroupFileWorkflowUploadsTxt(t *testing.T) {
	agents := defaultAgentsFromEnv()
	store := newMemoryStoreMemory()
	var uploaded map[string]any
	var sent []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		switch req.URL.Path {
		case "/upload_group_file":
			uploaded = payload
			fileURI := anyString(payload["file"])
			if !strings.HasPrefix(fileURI, "base64://") {
				t.Fatalf("expected base64 URI, got %q", fileURI)
			}
			decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(fileURI, "base64://"))
			if err != nil {
				t.Fatalf("decode upload payload: %v", err)
			}
			if !strings.Contains(string(decoded), "当前结论") {
				t.Fatalf("expected generated summary content, got %q", string(decoded))
			}
			if anyString(payload["name"]) != "当前情况总结.txt" {
				t.Fatalf("unexpected upload name: %#v", payload["name"])
			}
		case "/send_group_msg":
			sent = append(sent, anyString(payload["message"]))
		default:
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		_, _ = w.Write([]byte(`{"status":"ok","retcode":0}`))
	}))
	defer server.Close()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID: "474958794",
		Agents:  agents,
		Store:   store,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.clients[RoleBuilder] = &OneBotClient{BaseURL: server.URL, Client: server.Client()}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	recent := []QQMessage{
		{MessageID: "context", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "先把现在情况总结一下", Time: time.Now().Add(-10 * time.Second)},
		{MessageID: "file", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "你把现在的情况总结一遍然后写成txt文档发到群里", Time: time.Now()},
	}

	if !rt.tryStudioWorkflow(context.Background(), recent) {
		t.Fatal("expected group file workflow to handle request")
	}
	if uploaded == nil {
		t.Fatal("expected upload_group_file call")
	}
	if anyString(uploaded["group_id"]) != "474958794" {
		t.Fatalf("unexpected group_id: %#v", uploaded["group_id"])
	}
	if len(sent) != 1 || !strings.Contains(sent[0], "已上传群文件：当前情况总结.txt") {
		t.Fatalf("expected upload confirmation, got %#v", sent)
	}
	if len(store.threads) != 1 {
		t.Fatalf("expected one thread, got %d", len(store.threads))
	}
	for _, thread := range store.threads {
		if thread.ClosureReason != "group_file_uploaded" {
			t.Fatalf("expected group file closure, got %#v", thread)
		}
	}
}

func TestGroupFileWorkflowFallsBackWhenBuilderUploadFails(t *testing.T) {
	agents := defaultAgentsFromEnv()
	store := newMemoryStoreMemory()
	calls := map[string]int{}
	var sent []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
		if len(parts) != 2 {
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		role := parts[0]
		action := "/" + parts[1]
		switch action {
		case "/upload_group_file":
			calls[role]++
			if role == string(RoleBuilder) {
				_, _ = w.Write([]byte(`{"status":"failed","retcode":200,"message":"Group not found"}`))
				return
			}
		case "/send_group_msg":
			sent = append(sent, role+":"+anyString(payload["message"]))
		default:
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		_, _ = w.Write([]byte(`{"status":"ok","retcode":0}`))
	}))
	defer server.Close()

	clients := map[AgentRole]*OneBotClient{}
	for _, agent := range agents {
		clients[agent.Role] = &OneBotClient{BaseURL: server.URL + "/" + string(agent.Role), Client: server.Client()}
	}
	runtime, err := NewRuntime(RuntimeConfig{
		GroupID:      "474958794",
		Agents:       agents,
		Store:        store,
		LLM:          RuleBasedModel{},
		PollInterval: time.Hour,
		MaxMessages:  20,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	runtime.clients = clients
	runtime.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}

	focus := QQMessage{MessageID: "msg-1", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "你把现在的情况总结一遍然后写成txt文档发到群里", Time: time.Now()}
	if !runtime.runGroupFileWorkflow(context.Background(), focus, []QQMessage{focus}) {
		t.Fatal("expected group file workflow to handle request")
	}
	if calls[string(RoleBuilder)] != 1 {
		t.Fatalf("expected builder upload attempt, got %#v", calls)
	}
	if calls[string(RoleCEO)] != 1 {
		t.Fatalf("expected CEO fallback upload attempt, got %#v", calls)
	}
	if len(sent) != 1 || !strings.Contains(sent[0], "ceo:已上传群文件：当前情况总结.txt") {
		t.Fatalf("expected CEO upload confirmation, got %#v", sent)
	}
}

func TestGroupFileWorkflowTreatsSendAsContinuation(t *testing.T) {
	recent := []QQMessage{
		{MessageID: "context", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "你把现在的情况总结一遍然后写成txt文档发到群里", Time: time.Now().Add(-10 * time.Second)},
		{MessageID: "send", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "发", Time: time.Now()},
	}
	if !looksLikeGroupFileWorkflowRequest("发", recent) {
		t.Fatal("expected bare send request to continue recent group-file workflow")
	}
	if looksLikeGroupFileWorkflowRequest("发", []QQMessage{{SenderUIN: "1915791855", Text: "普通闲聊"}}) {
		t.Fatal("bare send should not trigger file upload without recent file context")
	}
	if !looksLikeGroupFileWorkflowRequest("[CQ:at,qq=3615811141] 你发", recent) {
		t.Fatal("expected at-mention send request to continue recent group-file workflow")
	}
}

func TestGroupFileWorkflowTreatsMissingArtifactQuestionAsContinuation(t *testing.T) {
	recent := []QQMessage{
		{MessageID: "context", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "你把现在的情况总结一遍然后写成txt文档发到群里", Time: time.Now().Add(-20 * time.Second)},
		{MessageID: "bot", GroupID: "474958794", SenderUIN: "3615811141", SenderName: "tester", Text: "没看到《当前情况总结.txt》真实落到群文件前，都只能算待验收", Time: time.Now().Add(-10 * time.Second)},
		{MessageID: "ask", GroupID: "474958794", SenderUIN: "1915791855", SenderName: "owner", Text: "你们现在还缺什么", Time: time.Now()},
	}
	if !looksLikeGroupFileWorkflowRequest("你们现在还缺什么", recent) {
		t.Fatal("expected missing-artifact question to continue recent group-file workflow")
	}
	if got := groupFileNameForWorkflow(recent[2], recent); got != "当前情况总结.txt" {
		t.Fatalf("expected current summary filename, got %q", got)
	}
}

func TestInternalDeliberationUsesPrivateBus(t *testing.T) {
	agents := defaultAgentsFromEnv()
	store := newMemoryStoreMemory()
	var sent []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/send_group_msg" {
			t.Fatalf("unexpected onebot path: %s", req.URL.Path)
		}
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		sent = append(sent, anyString(payload["message"]))
		_, _ = w.Write([]byte(`{"status":"ok","retcode":0}`))
	}))
	defer server.Close()
	router := &recordingTaskRouter{}
	rt, err := NewRuntime(RuntimeConfig{
		GroupID:    "474958794",
		Agents:     agents,
		Store:      store,
		TaskRouter: router,
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.clients[RoleCEO] = &OneBotClient{BaseURL: server.URL, Client: server.Client()}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	focus := QQMessage{
		MessageID:  "human-task",
		GroupID:    "474958794",
		SenderUIN:  "1915791855",
		SenderName: "owner",
		Text:       "帮我实现登录系统",
		Time:       time.Now(),
	}
	_ = store.AppendTranscript(context.Background(), focus)

	if !rt.tryInternalDeliberation(context.Background(), []QQMessage{focus}) {
		t.Fatal("expected task-like human message to enter internal deliberation")
	}
	if len(sent) != 2 {
		t.Fatalf("expected exactly two public CEO messages, got %d: %#v", len(sent), sent)
	}
	if !strings.Contains(sent[0], "内部过一下") {
		t.Fatalf("expected reflex ack, got %q", sent[0])
	}
	if !strings.Contains(sent[1], "方案先定") {
		t.Fatalf("expected consensus summary, got %q", sent[1])
	}
	if router.created != 1 {
		t.Fatalf("expected one routed task, got %d", router.created)
	}
	if len(store.threads) != 1 {
		t.Fatalf("expected one shared thread, got %d", len(store.threads))
	}
	for _, thread := range store.threads {
		if thread.Status != "routed" {
			t.Fatalf("expected routed shared thread, got %q", thread.Status)
		}
		if thread.Consensus["executor"] != string(RoleBuilder) {
			t.Fatalf("expected builder consensus executor, got %#v", thread.Consensus)
		}
		if thread.Consensus["execution_station"] != "builder-local-codex" {
			t.Fatalf("expected Codex worker execution station in consensus, got %#v", thread.Consensus)
		}
		if thread.Consensus["workspace_root"] != "/srv/multica/agent-workspaces" {
			t.Fatalf("expected worker workspace root in consensus, got %#v", thread.Consensus)
		}
	}
	if len(store.events) != 4 {
		t.Fatalf("expected four private cognitive events, got %d", len(store.events))
	}
	journals := store.transcript
	if len(journals) != 1 {
		t.Fatalf("expected internal bus not to append public transcript messages directly, got %d", len(journals))
	}
}

func TestInternalDeliberationReportsTaskRouterFailure(t *testing.T) {
	agents := defaultAgentsFromEnv()
	store := newMemoryStoreMemory()
	var sent []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		sent = append(sent, anyString(payload["message"]))
		_, _ = w.Write([]byte(`{"status":"ok","retcode":0}`))
	}))
	defer server.Close()
	rt, err := NewRuntime(RuntimeConfig{
		GroupID:    "474958794",
		Agents:     agents,
		Store:      store,
		TaskRouter: &failingTaskRouter{},
	})
	if err != nil {
		t.Fatalf("NewRuntime returned error: %v", err)
	}
	rt.clients[RoleCEO] = &OneBotClient{BaseURL: server.URL, Client: server.Client()}
	rt.onlineRoles = map[AgentRole]bool{RoleCEO: true, RoleBuilder: true, RoleTester: true, RoleWatcher: true}
	focus := QQMessage{MessageID: "human-task-fail", GroupID: "474958794", SenderUIN: "1915791855", Text: "帮我修复部署失败", Time: time.Now()}
	_ = store.AppendTranscript(context.Background(), focus)

	if !rt.tryInternalDeliberation(context.Background(), []QQMessage{focus}) {
		t.Fatal("expected task-like human message to enter internal deliberation")
	}
	if len(sent) != 3 {
		t.Fatalf("expected ack, summary, and one blocked report, got %d: %#v", len(sent), sent)
	}
	var thread SharedThread
	for _, th := range store.threads {
		thread = th
	}
	if thread.Status != "blocked" || !strings.Contains(thread.BlockedReason, "create_task_failed") {
		t.Fatalf("expected blocked thread after router failure, got %#v", thread)
	}
}

func TestLearningSignalsAvoidPersonalImpersonation(t *testing.T) {
	text := "我觉得这个群讨论架构时喜欢先讲边界，再贴 GitHub 链接 https://github.com/example/project"
	if !looksLikeSocialSignal(text) {
		t.Fatal("expected group style signal")
	}
	if !looksLikeKnowledgeSignal(text) {
		t.Fatal("expected knowledge signal")
	}
	style := summarizeGroupStyle(text)
	if !strings.Contains(style, "群体风格观察") {
		t.Fatalf("expected abstract group style summary, got %q", style)
	}
	if strings.Contains(style, "模仿") || strings.Contains(style, "冒充") {
		t.Fatalf("style summary should not imply impersonation: %q", style)
	}
	builder := roleDigest(RoleBuilder, text)
	tester := roleDigest(RoleTester, text)
	if builder == tester {
		t.Fatal("expected role-specific digestion")
	}
}

type recordingTaskRouter struct {
	created int
}

func (r *recordingTaskRouter) CreateTask(ctx context.Context, source QQMessage, target AgentRole, objective string) (TaskResult, error) {
	r.created++
	return TaskResult{Status: "created"}, nil
}

type failingTaskRouter struct{}

func (r *failingTaskRouter) CreateTask(ctx context.Context, source QQMessage, target AgentRole, objective string) (TaskResult, error) {
	return TaskResult{}, errors.New("route unavailable")
}
