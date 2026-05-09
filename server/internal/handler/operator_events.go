package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

type OperatorEventRequest struct {
	EventType    string         `json:"event_type"`
	Workspace    string         `json:"workspace"`
	Channel      string         `json:"channel"`
	Conversation map[string]any `json:"conversation"`
	Actor        map[string]any `json:"actor"`
	Text         string         `json:"text"`
	Raw          map[string]any `json:"raw"`
	Metadata     map[string]any `json:"metadata"`
}

type OperatorEventResponse struct {
	EventID     string                  `json:"event_id"`
	EventType   string                  `json:"event_type"`
	WorkspaceID string                  `json:"workspace_id"`
	Command     string                  `json:"command"`
	Reply       OperatorEventReply      `json:"reply"`
	Artifact    *OperatorEventArtifact  `json:"artifact,omitempty"`
	Timeline    []OperatorTimelineEntry `json:"timeline"`
}

type OperatorEventReply struct {
	Channel string `json:"channel"`
	Text    string `json:"text"`
}

type OperatorEventArtifact struct {
	ArtifactType string         `json:"artifact_type"`
	Title        string         `json:"title"`
	Status       string         `json:"status"`
	Summary      map[string]any `json:"summary"`
}

type OperatorTimelineEntry struct {
	EventType string `json:"event_type"`
	At        string `json:"at"`
	Summary   string `json:"summary"`
}

func (h *Handler) IngestOperatorEvent(w http.ResponseWriter, r *http.Request) {
	if !operatorGatewayAuthorized(r) {
		writeError(w, http.StatusUnauthorized, "operator gateway unauthorized")
		return
	}

	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace is required")
		return
	}

	var req OperatorEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.EventType == "" {
		req.EventType = "operator.command"
	}
	if req.Channel == "" {
		req.Channel = "api"
	}
	if req.Text == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	eventID := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	command := normalizeOperatorCommand(req.Text)

	resp := OperatorEventResponse{
		EventID:     eventID,
		EventType:   req.EventType,
		WorkspaceID: workspaceID,
		Command:     command,
		Timeline: []OperatorTimelineEntry{
			{EventType: "operator.event.received", At: now, Summary: fmt.Sprintf("received %s from %s", req.EventType, req.Channel)},
			{EventType: "operator.command.parsed", At: now, Summary: command},
		},
	}

	switch command {
	case "/status", "status", "/start":
		summary, err := h.buildAgentOSSummary(r, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to build operator status")
			return
		}
		resp.Reply = OperatorEventReply{Channel: req.Channel, Text: formatOperatorStatusReply(summary)}
		resp.Artifact = &OperatorEventArtifact{
			ArtifactType: "operator_status",
			Title:        "Mortis Operator Status",
			Status:       "generated",
			Summary: map[string]any{
				"counts":       summary.Counts,
				"generated_at": summary.GeneratedAt,
			},
		}
		resp.Timeline = append(resp.Timeline,
			OperatorTimelineEntry{EventType: "artifact.created", At: now, Summary: "operator_status"},
			OperatorTimelineEntry{EventType: "projection.created", At: now, Summary: req.Channel},
		)
	default:
		resp.Reply = OperatorEventReply{Channel: req.Channel, Text: fmt.Sprintf("Mortis Operator received %q. Supported command: /status", req.Text)}
		resp.Timeline = append(resp.Timeline, OperatorTimelineEntry{EventType: "projection.created", At: now, Summary: "unsupported command"})
	}

	writeJSON(w, http.StatusCreated, resp)
}

func normalizeOperatorCommand(text string) string {
	fields := strings.Fields(strings.TrimSpace(text))
	if len(fields) == 0 {
		return ""
	}
	return strings.ToLower(fields[0])
}

func (h *Handler) buildAgentOSSummary(r *http.Request, workspaceID string) (AgentOSSummaryResponse, error) {
	roles, err := h.listAgentOSRoles(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	agents, err := h.listAgentOSAgents(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	runtimes, err := h.listAgentOSRuntimes(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	actions, err := h.listAgentOSActions(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	invocations, err := h.listAgentOSInvocations(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	artifacts, err := h.listAgentOSArtifacts(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	studioState, err := h.listAgentOSStudioState(r, workspaceID)
	if err != nil {
		return AgentOSSummaryResponse{}, err
	}
	return AgentOSSummaryResponse{
		WorkspaceID: workspaceID,
		Counts: AgentOSCounts{
			Roles:           len(roles),
			Agents:          len(agents),
			Runtimes:        len(runtimes),
			ActiveActions:   countActiveAgentOSActions(actions),
			RecentArtifacts: len(artifacts),
			BlockedState:    countBlockedAgentOSState(studioState),
		},
		Roles:       roles,
		Agents:      agents,
		Runtimes:    runtimes,
		Actions:     actions,
		Invocations: invocations,
		Artifacts:   artifacts,
		StudioState: studioState,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func formatOperatorStatusReply(summary AgentOSSummaryResponse) string {
	roles := make([]string, 0, len(summary.Roles))
	for _, role := range summary.Roles {
		roles = append(roles, fmt.Sprintf("%s:%s", role.Name, role.DefaultRuntime))
	}
	return strings.Join([]string{
		"Mortis Operator Status",
		fmt.Sprintf("active actions: %d", summary.Counts.ActiveActions),
		fmt.Sprintf("blocked states: %d", summary.Counts.BlockedState),
		fmt.Sprintf("recent artifacts: %d", summary.Counts.RecentArtifacts),
		fmt.Sprintf("runtimes: %d", summary.Counts.Runtimes),
		fmt.Sprintf("roles: %s", strings.Join(roles, ", ")),
		"cockpit: https://mortis.tengokukk.com/mortis/agent-os",
	}, "\n")
}

func operatorGatewayAuthorized(r *http.Request) bool {
	secret := os.Getenv("MORTIS_OPERATOR_EVENT_SECRET")
	if secret == "" {
		return requestUserID(r) != ""
	}
	return r.Header.Get("X-Mortis-Operator-Secret") == secret || r.Header.Get("X-Operator-Gateway-Secret") == secret
}
