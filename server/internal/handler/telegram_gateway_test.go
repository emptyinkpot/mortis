package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIngestTelegramOperatorMessageRoutesCodeWork(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-test-secret")
	t.Setenv("MORTIS_TELEGRAM_AUTO_APPROVE_LOW_RISK", "true")

	body := map[string]any{
		"message": map[string]any{
			"message_id": 987654,
			"text":       "帮我修一下 Telegram 自然语言入口的 README",
			"chat": map[string]any{
				"id":   "telegram-chat-natural-language",
				"type": "private",
			},
			"from": map[string]any{
				"id":         "telegram-user-natural-language",
				"username":   "operator",
				"first_name": "Operator",
			},
		},
	}

	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/telegram/operator-message", body)
	req.Header.Set("X-Mortis-Operator-Secret", "telegram-test-secret")
	testHandler.IngestTelegramOperatorMessage(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("IngestTelegramOperatorMessage: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp TelegramOperatorMessageResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.OK || resp.ActionID == "" || resp.InvocationID == "" {
		t.Fatalf("expected routed action, got %#v", resp)
	}
	if resp.Route.RoleName != "builder" {
		t.Fatalf("expected builder route, got %#v", resp.Route)
	}
	if resp.ActionStatus != "approved" {
		t.Fatalf("expected low-risk builder action auto-approved, got %q", resp.ActionStatus)
	}
	if !strings.Contains(resp.Reply.Text, "已进入后台 Codex 执行队列") {
		t.Fatalf("expected codex queue ack, got %q", resp.Reply.Text)
	}
}

func TestIngestTelegramOperatorMessageRejectsUnauthorizedGateway(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-test-secret")
	w := httptest.NewRecorder()
	testHandler.IngestTelegramOperatorMessage(w, newRequest(http.MethodPost, "/api/telegram/operator-message", map[string]any{
		"message": map[string]any{"text": "status", "chat": map[string]any{"id": "1"}, "from": map[string]any{"id": "2"}},
	}))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}
