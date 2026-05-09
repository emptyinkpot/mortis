package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type A2ADelegationRequest struct {
	ThreadID          string          `json:"thread_id"`
	FromAgentID       string          `json:"from_agent_id"`
	ToAgentID         string          `json:"to_agent_id"`
	Intent            string          `json:"intent"`
	Goal              string          `json:"goal"`
	Summary           string          `json:"summary"`
	ArtifactRefs      []string        `json:"artifact_refs"`
	RequiredArtifacts []string        `json:"required_artifacts"`
	ReplyTo           string          `json:"reply_to"`
	Metadata          json.RawMessage `json:"metadata"`
}

type A2ADelegationResponse struct {
	EventID    string             `json:"event_id"`
	ThreadID   string             `json:"thread_id"`
	MailboxURI string             `json:"mailbox_uri"`
	Artifact   A2AArtifactRef     `json:"artifact"`
	Timeline   []A2ATimelineEntry `json:"timeline"`
	Delegation A2ADelegationEvent `json:"delegation"`
}

type A2ADelegationEvent struct {
	EventID           string   `json:"event_id"`
	ThreadID          string   `json:"thread_id"`
	FromAgentID       string   `json:"from_agent_id"`
	ToAgentID         string   `json:"to_agent_id"`
	Intent            string   `json:"intent"`
	Goal              string   `json:"goal"`
	Summary           string   `json:"summary"`
	Status            string   `json:"status"`
	ArtifactRefs      []string `json:"artifact_refs"`
	RequiredArtifacts []string `json:"required_artifacts"`
	ReplyTo           string   `json:"reply_to"`
	CreatedAt         string   `json:"created_at"`
}

type A2AArtifactRef struct {
	ArtifactID   string `json:"artifact_id"`
	ArtifactType string `json:"artifact_type"`
	URI          string `json:"uri"`
	Status       string `json:"status"`
}

type A2ATimelineEntry struct {
	EventType string `json:"event_type"`
	At        string `json:"at"`
	Summary   string `json:"summary"`
}

type A2AMailboxResponse struct {
	ThreadID  string               `json:"thread_id"`
	Events    []A2ADelegationEvent `json:"events"`
	Artifacts []A2AArtifactRef     `json:"artifacts"`
	Timeline  []A2ATimelineEntry   `json:"timeline"`
}

func mortisRuntimeRoot() string {
	root := strings.TrimSpace(os.Getenv("MORTIS_RUNTIME_ROOT"))
	if root == "" {
		root = ".runtime"
	}
	return root
}

func a2aSafePathPart(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	var b strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "unknown"
	}
	return out
}

func writeRuntimeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	payload = append(payload, '\n')
	return os.WriteFile(path, payload, 0o644)
}

func appendRuntimeJSONL(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	payload = append(payload, '\n')
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(payload)
	return err
}

func writeA2ARuntimeRecords(workspaceID string, resp A2ADelegationResponse) error {
	root := mortisRuntimeRoot()
	workspace := a2aSafePathPart(workspaceID)
	thread := a2aSafePathPart(resp.ThreadID)
	event := a2aSafePathPart(resp.EventID)
	toAgent := a2aSafePathPart(resp.Delegation.ToAgentID)
	fromAgent := a2aSafePathPart(resp.Delegation.FromAgentID)

	eventRecord := map[string]any{
		"event_type":         "delegation.requested",
		"event_id":           resp.EventID,
		"workspace_id":       workspaceID,
		"thread_id":          resp.ThreadID,
		"from_agent_id":      resp.Delegation.FromAgentID,
		"to_agent_id":        resp.Delegation.ToAgentID,
		"intent":             resp.Delegation.Intent,
		"goal":               resp.Delegation.Goal,
		"summary":            resp.Delegation.Summary,
		"artifact_refs":      resp.Delegation.ArtifactRefs,
		"required_artifacts": resp.Delegation.RequiredArtifacts,
		"reply_to":           resp.Delegation.ReplyTo,
		"mailbox_uri":        resp.MailboxURI,
		"created_at":         resp.Delegation.CreatedAt,
	}
	if err := writeRuntimeJSON(filepath.Join(root, "events", workspace, event+".json"), eventRecord); err != nil {
		return err
	}
	if err := appendRuntimeJSONL(filepath.Join(root, "mailboxes", workspace, toAgent+".jsonl"), eventRecord); err != nil {
		return err
	}
	if err := appendRuntimeJSONL(filepath.Join(root, "mailboxes", workspace, fromAgent+".jsonl"), map[string]any{
		"event_type":  "delegation.sent",
		"event_id":    resp.EventID,
		"thread_id":   resp.ThreadID,
		"to_agent_id": resp.Delegation.ToAgentID,
		"created_at":  resp.Delegation.CreatedAt,
	}); err != nil {
		return err
	}
	if err := writeRuntimeJSON(filepath.Join(root, "artifacts", workspace, event+".json"), resp.Artifact); err != nil {
		return err
	}
	for _, item := range resp.Timeline {
		if err := appendRuntimeJSONL(filepath.Join(root, "timeline", workspace, thread+".jsonl"), item); err != nil {
			return err
		}
	}
	return nil
}

func a2aFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func a2aMustJSON(value any) []byte {
	payload, err := json.Marshal(value)
	if err != nil {
		return []byte("{}")
	}
	return payload
}

func (h *Handler) CreateA2ADelegation(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace is required")
		return
	}

	var req A2ADelegationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.FromAgentID) == "" || strings.TrimSpace(req.ToAgentID) == "" {
		writeError(w, http.StatusBadRequest, "from_agent_id and to_agent_id are required")
		return
	}
	if strings.TrimSpace(req.Intent) == "" {
		req.Intent = "delegation"
	}
	if strings.TrimSpace(req.Summary) == "" {
		writeError(w, http.StatusBadRequest, "summary is required")
		return
	}
	if strings.TrimSpace(req.ThreadID) == "" {
		req.ThreadID = "a2a-" + uuid.NewString()
	}
	if strings.TrimSpace(req.ReplyTo) == "" {
		req.ReplyTo = fmt.Sprintf("mailbox://%s/%s", req.FromAgentID, req.ThreadID)
	}
	metadata := nonNilRawJSON(req.Metadata, "{}")

	now := time.Now().UTC()
	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start a2a transaction")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
INSERT INTO agent_shared_threads (
  id, workspace_id, group_id, goal, participants, current_plan, consensus_state, status
) VALUES (
  $1, $2::uuid, 'a2a', $3, $4, $5, $6::jsonb, 'open'
)
ON CONFLICT (id)
DO UPDATE SET
  goal = CASE WHEN agent_shared_threads.goal = '' THEN EXCLUDED.goal ELSE agent_shared_threads.goal END,
  participants = (
    SELECT ARRAY(SELECT DISTINCT unnest(agent_shared_threads.participants || EXCLUDED.participants))
  ),
  updated_at = now()`,
		req.ThreadID,
		workspaceID,
		a2aFirstNonEmpty(req.Goal, req.Summary),
		[]string{req.FromAgentID, req.ToAgentID},
		req.RequiredArtifacts,
		a2aMustJSON(map[string]any{"a2a": true}),
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to upsert a2a thread")
		return
	}

	var eventID string
	if err := tx.QueryRow(r.Context(), `
INSERT INTO agent_cognitive_events (
  workspace_id, thread_id, group_id, from_role, to_role, intent, goal, content, status, metadata
) VALUES (
  $1::uuid, $2, 'a2a', $3, $4, $5, $6, $7, 'queued', $8::jsonb
)
RETURNING id`,
		workspaceID,
		req.ThreadID,
		req.FromAgentID,
		req.ToAgentID,
		req.Intent,
		req.Goal,
		req.Summary,
		a2aMustJSON(map[string]any{
			"a2a":                true,
			"artifact_refs":      req.ArtifactRefs,
			"required_artifacts": req.RequiredArtifacts,
			"reply_to":           req.ReplyTo,
			"request_metadata":   json.RawMessage(metadata),
		}),
	).Scan(&eventID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create a2a delegation")
		return
	}

	var artifactID string
	artifactURI := "a2a://" + req.ThreadID + "/" + eventID
	if err := tx.QueryRow(r.Context(), `
INSERT INTO studio_artifacts (
  workspace_id, thread_id, artifact_type, title, uri, status, produced_by, verification_status, metadata
) VALUES (
  $1::uuid, $2, 'delegation_contract', 'A2A delegation contract', $3, 'created', $4, 'pending', $5::jsonb
)
RETURNING id`,
		workspaceID,
		req.ThreadID,
		artifactURI,
		req.FromAgentID,
		a2aMustJSON(map[string]any{
			"a2a_event_id":       eventID,
			"to_agent_id":        req.ToAgentID,
			"intent":             req.Intent,
			"artifact_refs":      req.ArtifactRefs,
			"required_artifacts": req.RequiredArtifacts,
			"reply_to":           req.ReplyTo,
		}),
	).Scan(&artifactID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create a2a artifact")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit a2a delegation")
		return
	}

	h.publish("a2a.delegation.requested", workspaceID, "agent", req.FromAgentID, map[string]any{
		"event_id":     eventID,
		"thread_id":    req.ThreadID,
		"to_agent_id":  req.ToAgentID,
		"artifact_uri": artifactURI,
	})

	createdAt := now.Format(time.RFC3339)
	resp := A2ADelegationResponse{
		EventID:    eventID,
		ThreadID:   req.ThreadID,
		MailboxURI: fmt.Sprintf("mailbox://%s/%s", req.ToAgentID, req.ThreadID),
		Artifact: A2AArtifactRef{
			ArtifactID:   artifactID,
			ArtifactType: "delegation_contract",
			URI:          artifactURI,
			Status:       "created",
		},
		Delegation: A2ADelegationEvent{
			EventID:           eventID,
			ThreadID:          req.ThreadID,
			FromAgentID:       req.FromAgentID,
			ToAgentID:         req.ToAgentID,
			Intent:            req.Intent,
			Goal:              req.Goal,
			Summary:           req.Summary,
			Status:            "queued",
			ArtifactRefs:      req.ArtifactRefs,
			RequiredArtifacts: req.RequiredArtifacts,
			ReplyTo:           req.ReplyTo,
			CreatedAt:         createdAt,
		},
		Timeline: []A2ATimelineEntry{
			{EventType: "a2a.delegation.requested", At: createdAt, Summary: fmt.Sprintf("%s delegated to %s", req.FromAgentID, req.ToAgentID)},
			{EventType: "artifact.created", At: createdAt, Summary: "delegation_contract"},
		},
	}
	if err := writeA2ARuntimeRecords(workspaceID, resp); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to write a2a runtime records")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) ListA2AMailbox(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace is required")
		return
	}
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		writeError(w, http.StatusBadRequest, "thread id is required")
		return
	}

	events, err := h.listA2AEvents(r, workspaceID, threadID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list a2a events")
		return
	}
	artifacts, err := h.listA2AArtifacts(r, workspaceID, threadID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list a2a artifacts")
		return
	}
	timeline := make([]A2ATimelineEntry, 0, len(events)+len(artifacts))
	for _, event := range events {
		timeline = append(timeline, A2ATimelineEntry{EventType: "a2a." + event.Intent, At: event.CreatedAt, Summary: fmt.Sprintf("%s -> %s", event.FromAgentID, event.ToAgentID)})
	}
	for _, artifact := range artifacts {
		timeline = append(timeline, A2ATimelineEntry{EventType: "artifact." + artifact.Status, At: "", Summary: artifact.ArtifactType})
	}
	writeJSON(w, http.StatusOK, A2AMailboxResponse{ThreadID: threadID, Events: events, Artifacts: artifacts, Timeline: timeline})
}

func (h *Handler) listA2AEvents(r *http.Request, workspaceID, threadID string) ([]A2ADelegationEvent, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, thread_id, from_role, to_role, intent, goal, content, status, metadata, created_at
FROM agent_cognitive_events
WHERE workspace_id = $1::uuid AND thread_id = $2
ORDER BY created_at ASC`, workspaceID, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []A2ADelegationEvent{}
	for rows.Next() {
		var item A2ADelegationEvent
		var metadata json.RawMessage
		var createdAt time.Time
		if err := rows.Scan(&item.EventID, &item.ThreadID, &item.FromAgentID, &item.ToAgentID, &item.Intent, &item.Goal, &item.Summary, &item.Status, &metadata, &createdAt); err != nil {
			return nil, err
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		var meta struct {
			ArtifactRefs      []string `json:"artifact_refs"`
			RequiredArtifacts []string `json:"required_artifacts"`
			ReplyTo           string   `json:"reply_to"`
		}
		if len(metadata) > 0 {
			_ = json.Unmarshal(metadata, &meta)
		}
		item.ArtifactRefs = meta.ArtifactRefs
		item.RequiredArtifacts = meta.RequiredArtifacts
		item.ReplyTo = meta.ReplyTo
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listA2AArtifacts(r *http.Request, workspaceID, threadID string) ([]A2AArtifactRef, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, artifact_type, uri, status
FROM studio_artifacts
WHERE workspace_id = $1::uuid AND thread_id = $2
ORDER BY created_at ASC`, workspaceID, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []A2AArtifactRef{}
	for rows.Next() {
		var item A2AArtifactRef
		if err := rows.Scan(&item.ArtifactID, &item.ArtifactType, &item.URI, &item.Status); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
