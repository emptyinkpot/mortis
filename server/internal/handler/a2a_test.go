package handler

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteA2ARuntimeRecords(t *testing.T) {
	runtimeRoot := t.TempDir()
	t.Setenv("MORTIS_RUNTIME_ROOT", runtimeRoot)

	resp := A2ADelegationResponse{
		EventID:    "event-123",
		ThreadID:   "thread-123",
		MailboxURI: "mailbox://codex-implementer/thread-123",
		Artifact: A2AArtifactRef{
			ArtifactID:   "artifact-123",
			ArtifactType: "delegation_contract",
			URI:          "a2a://thread-123/event-123",
			Status:       "created",
		},
		Delegation: A2ADelegationEvent{
			EventID:           "event-123",
			ThreadID:          "thread-123",
			FromAgentID:       "Claude Architect",
			ToAgentID:         "Codex Implementer",
			Intent:            "implementation_request",
			Goal:              "Implement mailbox",
			Summary:           "Create runtime mailbox records.",
			Status:            "queued",
			ArtifactRefs:      []string{"artifact://thread-123/plan.md"},
			RequiredArtifacts: []string{"patch.diff"},
			ReplyTo:           "mailbox://claude-architect/thread-123",
			CreatedAt:         "2026-05-09T10:15:00Z",
		},
		Timeline: []A2ATimelineEntry{
			{EventType: "a2a.delegation.requested", At: "2026-05-09T10:15:00Z", Summary: "delegated"},
		},
	}

	if err := writeA2ARuntimeRecords("workspace-123", resp); err != nil {
		t.Fatalf("write runtime records: %v", err)
	}

	eventPath := filepath.Join(runtimeRoot, "events", "workspace-123", "event-123.json")
	payload, err := os.ReadFile(eventPath)
	if err != nil {
		t.Fatalf("read event record: %v", err)
	}
	var event map[string]any
	if err := json.Unmarshal(payload, &event); err != nil {
		t.Fatalf("decode event record: %v", err)
	}
	if event["event_type"] != "delegation.requested" || event["to_agent_id"] != "Codex Implementer" {
		t.Fatalf("unexpected event record %#v", event)
	}

	mailboxPath := filepath.Join(runtimeRoot, "mailboxes", "workspace-123", "codex-implementer.jsonl")
	file, err := os.Open(mailboxPath)
	if err != nil {
		t.Fatalf("open mailbox: %v", err)
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		t.Fatalf("expected mailbox entry")
	}
	var mailboxEvent map[string]any
	if err := json.Unmarshal(scanner.Bytes(), &mailboxEvent); err != nil {
		t.Fatalf("decode mailbox entry: %v", err)
	}
	if mailboxEvent["event_id"] != "event-123" {
		t.Fatalf("unexpected mailbox event %#v", mailboxEvent)
	}
}

func TestCreateA2ADelegationAndMailbox(t *testing.T) {
	t.Setenv("MORTIS_RUNTIME_ROOT", t.TempDir())
	if testHandler == nil {
		t.Skip("database not available")
	}

	threadID := "test-a2a-thread"
	body := map[string]any{
		"thread_id":          threadID,
		"from_agent_id":      "claude-architect",
		"to_agent_id":        "codex-implementer",
		"intent":             "implementation_request",
		"goal":               "Implement drawer projection",
		"summary":            "Please implement drawer projection from architecture artifact.",
		"artifact_refs":      []string{"artifact://test-a2a-thread/architecture.md"},
		"required_artifacts": []string{"patch.diff", "test_report"},
	}

	w := httptest.NewRecorder()
	testHandler.CreateA2ADelegation(w, newRequest(http.MethodPost, "/api/a2a/delegations", body))
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateA2ADelegation: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp A2ADelegationResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.EventID == "" || resp.Artifact.ArtifactID == "" {
		t.Fatalf("expected event and artifact ids, got %#v", resp)
	}
	if resp.MailboxURI != "mailbox://codex-implementer/test-a2a-thread" {
		t.Fatalf("unexpected mailbox uri %q", resp.MailboxURI)
	}
	if resp.Delegation.FromAgentID != "claude-architect" || resp.Delegation.ToAgentID != "codex-implementer" {
		t.Fatalf("unexpected delegation %#v", resp.Delegation)
	}

	w = httptest.NewRecorder()
	testHandler.ListA2AMailbox(w, withURLParam(newRequest(http.MethodGet, "/api/a2a/threads/test-a2a-thread/mailbox", nil), "threadId", threadID))
	if w.Code != http.StatusOK {
		t.Fatalf("ListA2AMailbox: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var mailbox A2AMailboxResponse
	if err := json.NewDecoder(w.Body).Decode(&mailbox); err != nil {
		t.Fatalf("decode mailbox: %v", err)
	}
	if len(mailbox.Events) == 0 || len(mailbox.Artifacts) == 0 {
		t.Fatalf("expected mailbox events and artifacts, got %#v", mailbox)
	}
	if mailbox.Events[0].RequiredArtifacts[0] != "patch.diff" {
		t.Fatalf("expected required artifacts to roundtrip, got %#v", mailbox.Events[0].RequiredArtifacts)
	}
	if !strings.HasPrefix(mailbox.Artifacts[0].URI, "a2a://test-a2a-thread/") {
		t.Fatalf("expected a2a artifact uri, got %#v", mailbox.Artifacts[0])
	}
}
