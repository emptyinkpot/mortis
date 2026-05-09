package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIngestOperatorEvent_Status(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	body := map[string]any{
		"event_type": "operator.command",
		"channel":    "telegram",
		"text":       "/status",
		"conversation": map[string]any{
			"id":   "telegram-chat-1",
			"type": "private",
		},
		"actor": map[string]any{
			"external_id":  "telegram-user-1",
			"display_name": "operator",
		},
	}

	w := httptest.NewRecorder()
	testHandler.IngestOperatorEvent(w, newRequest(http.MethodPost, "/api/operator-events", body))
	if w.Code != http.StatusCreated {
		t.Fatalf("IngestOperatorEvent: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp OperatorEventResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.EventID == "" {
		t.Fatalf("expected event_id")
	}
	if resp.Command != "/status" {
		t.Fatalf("expected /status command, got %q", resp.Command)
	}
	if resp.Reply.Channel != "telegram" {
		t.Fatalf("expected telegram reply channel, got %q", resp.Reply.Channel)
	}
	if !strings.Contains(resp.Reply.Text, "Mortis Operator Status") {
		t.Fatalf("expected status reply, got %q", resp.Reply.Text)
	}
	if resp.Artifact == nil || resp.Artifact.ArtifactType != "operator_status" {
		t.Fatalf("expected operator_status artifact, got %#v", resp.Artifact)
	}
	if len(resp.Timeline) < 4 {
		t.Fatalf("expected timeline entries, got %#v", resp.Timeline)
	}
}

func TestIngestOperatorEvent_UnsupportedCommand(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	w := httptest.NewRecorder()
	testHandler.IngestOperatorEvent(w, newRequest(http.MethodPost, "/api/operator-events", map[string]any{
		"channel": "telegram",
		"text":    "/unknown",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("IngestOperatorEvent: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp OperatorEventResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(resp.Reply.Text, "Supported command: /status") {
		t.Fatalf("expected unsupported command reply, got %q", resp.Reply.Text)
	}
}
