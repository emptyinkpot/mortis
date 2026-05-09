package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func withTelegramLivingTestModel(t *testing.T) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected model path: %s", req.URL.Path)
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Builder 在线，这句来自测试模型。"}}]}`))
	}))
	t.Cleanup(server.Close)
	t.Setenv("MORTIS_QQ_LLM_ENABLED", "true")
	t.Setenv("MORTIS_QQ_LLM_API_KEY", "test-key")
	t.Setenv("MORTIS_QQ_LLM_BASE_URL", server.URL)
	t.Setenv("MORTIS_QQ_LLM_MODEL", "test-model")
	t.Setenv("MORTIS_QQ_LLM_WIRE_API", "chat_completions")
}

func TestIngestTelegramLivingMessageRoutesRoleHint(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-living-secret")
	withTelegramLivingTestModel(t)

	body := map[string]any{
		"metadata": map[string]any{"role_hint": "builder"},
		"message": map[string]any{
			"message_id": 1001,
			"text":       "这个代码入口你怎么看",
			"chat": map[string]any{
				"id":   "telegram-living-chat",
				"type": "private",
			},
			"from": map[string]any{
				"id":         "telegram-living-user",
				"username":   "operator",
				"first_name": "Operator",
			},
		},
	}

	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/telegram/living-message?workspace_slug=mortis", body)
	req.Header.Set("X-Mortis-Operator-Secret", "telegram-living-secret")
	testHandler.IngestTelegramLivingMessage(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("IngestTelegramLivingMessage: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp TelegramLivingMessageResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.OK || resp.Living.Role != "builder" || resp.Reply.Text == "" {
		t.Fatalf("expected builder living reply, got %#v", resp)
	}
}

func TestIngestTelegramLivingMessageRejectsUnauthorizedGateway(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-living-secret")
	w := httptest.NewRecorder()
	testHandler.IngestTelegramLivingMessage(w, newRequest(http.MethodPost, "/api/telegram/living-message", map[string]any{
		"message": map[string]any{"text": "hello", "chat": map[string]any{"id": "1"}, "from": map[string]any{"id": "2"}},
	}))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestIngestTelegramLivingMessageRejectsN8NBodyWrapper(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-living-secret")

	body := map[string]any{
		"body": map[string]any{
			"metadata": map[string]any{"role_hint": "builder"},
			"message": map[string]any{
				"message_id": 1002,
				"text":       "n8n wrapper hello",
				"chat": map[string]any{
					"id":   "telegram-living-chat-wrapper",
					"type": "private",
				},
				"from": map[string]any{
					"id":         "telegram-living-user-wrapper",
					"username":   "operator",
					"first_name": "Operator",
				},
			},
		},
	}

	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/telegram/living-message?workspace_slug=mortis", body)
	req.Header.Set("X-Mortis-Operator-Secret", "telegram-living-secret")
	testHandler.IngestTelegramLivingMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected strict payload rejection, got %d: %s", w.Code, w.Body.String())
	}
}

func TestIngestTelegramLivingMessageRejectsN8NJsonWrapper(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-living-secret")

	body := map[string]any{
		"json": map[string]any{
			"message": map[string]any{
				"message_id": 1003,
				"text":       "json wrapper hello",
				"chat":       map[string]any{"id": "telegram-living-chat-json", "type": "private"},
				"from":       map[string]any{"id": "telegram-living-user-json", "first_name": "Operator"},
			},
		},
	}

	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/telegram/living-message?workspace_slug=mortis", body)
	req.Header.Set("X-Mortis-Operator-Secret", "telegram-living-secret")
	testHandler.IngestTelegramLivingMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected strict payload rejection, got %d: %s", w.Code, w.Body.String())
	}
}

func TestIngestTelegramLivingMessageReportsMissingMessage(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}
	t.Setenv("MORTIS_OPERATOR_EVENT_SECRET", "telegram-living-secret")
	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/telegram/living-message?workspace_slug=mortis", map[string]any{"body": map[string]any{"hello": "world"}})
	req.Header.Set("X-Mortis-Operator-Secret", "telegram-living-secret")
	testHandler.IngestTelegramLivingMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected concrete 400, got %d: %s", w.Code, w.Body.String())
	}
}
