package handler

import (
	"encoding/json"
	"net/http"
	"time"
)

type AgentOSSummaryResponse struct {
	WorkspaceID string               `json:"workspace_id"`
	Counts      AgentOSCounts        `json:"counts"`
	Roles       []AgentOSRole        `json:"roles"`
	Agents      []AgentOSAgent       `json:"agents"`
	Runtimes    []AgentOSRuntime     `json:"runtimes"`
	Actions     []AgentOSAction      `json:"actions"`
	Invocations []AgentOSInvocation  `json:"invocations"`
	Artifacts   []AgentOSArtifact    `json:"artifacts"`
	StudioState []AgentOSStudioState `json:"studio_state"`
	GeneratedAt string               `json:"generated_at"`
}

type AgentOSCounts struct {
	Roles           int `json:"roles"`
	Agents          int `json:"agents"`
	Runtimes        int `json:"runtimes"`
	ActiveActions   int `json:"active_actions"`
	RecentArtifacts int `json:"recent_artifacts"`
	BlockedState    int `json:"blocked_state"`
}

type AgentOSRole struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Title           string          `json:"title"`
	DefaultRuntime  string          `json:"default_runtime"`
	ApprovalPolicy  string          `json:"approval_policy"`
	BuiltIn         bool            `json:"built_in"`
	Permissions     json.RawMessage `json:"permissions"`
	AllowedChannels json.RawMessage `json:"allowed_channels"`
}

type AgentOSAgent struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	RuntimeID   string  `json:"runtime_id"`
	RuntimeMode string  `json:"runtime_mode"`
	Status      string  `json:"status"`
	Visibility  string  `json:"visibility"`
	OwnerID     *string `json:"owner_id"`
	ArchivedAt  *string `json:"archived_at"`
}

type AgentOSRuntime struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	RuntimeMode string  `json:"runtime_mode"`
	Provider    string  `json:"provider"`
	Status      string  `json:"status"`
	OwnerID     *string `json:"owner_id"`
	LastSeenAt  *string `json:"last_seen_at"`
}

type AgentOSAction struct {
	ID               string          `json:"id"`
	InvocationID     string          `json:"invocation_id"`
	RoleID           string          `json:"role_id"`
	RoleName         string          `json:"role_name"`
	RoleTitle        string          `json:"role_title"`
	ActionType       string          `json:"action_type"`
	RiskLevel        string          `json:"risk_level"`
	RequiresApproval bool            `json:"requires_approval"`
	Status           string          `json:"status"`
	Payload          json.RawMessage `json:"payload"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

type AgentOSInvocation struct {
	ID               string          `json:"id"`
	RoleID           string          `json:"role_id"`
	RoleName         string          `json:"role_name"`
	RoleTitle        string          `json:"role_title"`
	Channel          string          `json:"channel"`
	Status           string          `json:"status"`
	CommandType      string          `json:"command_type"`
	RiskLevel        string          `json:"risk_level"`
	RequiresApproval bool            `json:"requires_approval"`
	Result           json.RawMessage `json:"result"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

type AgentOSArtifact struct {
	ID                 string          `json:"id"`
	RoleActionID       *string         `json:"role_action_id"`
	InvocationID       *string         `json:"invocation_id"`
	ThreadID           string          `json:"thread_id"`
	ArtifactType       string          `json:"artifact_type"`
	Title              string          `json:"title"`
	URI                string          `json:"uri"`
	Status             string          `json:"status"`
	ProducedBy         string          `json:"produced_by"`
	VerificationStatus string          `json:"verification_status"`
	Metadata           json.RawMessage `json:"metadata"`
	CreatedAt          string          `json:"created_at"`
	UpdatedAt          string          `json:"updated_at"`
}

type AgentOSStudioState struct {
	ID               string          `json:"id"`
	StateKey         string          `json:"state_key"`
	StateType        string          `json:"state_type"`
	Status           string          `json:"status"`
	OwnerRole        string          `json:"owner_role"`
	Summary          string          `json:"summary"`
	CurrentValue     json.RawMessage `json:"current_value"`
	NextAction       string          `json:"next_action"`
	ArtifactRequired bool            `json:"artifact_required"`
	UpdatedAt        string          `json:"updated_at"`
}

func (h *Handler) GetAgentOSSummary(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	resp, err := h.buildAgentOSSummary(r, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load agent os summary")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) listAgentOSRoles(r *http.Request, workspaceID string) ([]AgentOSRole, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, name, title, default_runtime, approval_policy, built_in, permissions, allowed_channels
FROM roles
WHERE workspace_id = $1
ORDER BY built_in DESC, name ASC`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSRole{}
	for rows.Next() {
		var item AgentOSRole
		var permissions, allowedChannels json.RawMessage
		var id string
		if err := rows.Scan(&id, &item.Name, &item.Title, &item.DefaultRuntime, &item.ApprovalPolicy, &item.BuiltIn, &permissions, &allowedChannels); err != nil {
			return nil, err
		}
		item.ID = id
		item.Permissions = nonNilRawJSON(permissions, "[]")
		item.AllowedChannels = nonNilRawJSON(allowedChannels, "[]")
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSAgents(r *http.Request, workspaceID string) ([]AgentOSAgent, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, name, runtime_id, runtime_mode, status, visibility, owner_id, archived_at
FROM agent
WHERE workspace_id = $1
ORDER BY archived_at NULLS FIRST, name ASC`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSAgent{}
	for rows.Next() {
		var item AgentOSAgent
		var ownerID, archivedAt any
		if err := rows.Scan(&item.ID, &item.Name, &item.RuntimeID, &item.RuntimeMode, &item.Status, &item.Visibility, &ownerID, &archivedAt); err != nil {
			return nil, err
		}
		item.OwnerID = anyStringPtr(ownerID)
		item.ArchivedAt = anyTimePtr(archivedAt)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSRuntimes(r *http.Request, workspaceID string) ([]AgentOSRuntime, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, name, runtime_mode, provider, status, owner_id, last_seen_at
FROM agent_runtime
WHERE workspace_id = $1
ORDER BY status = 'online' DESC, updated_at DESC
LIMIT 30`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSRuntime{}
	for rows.Next() {
		var item AgentOSRuntime
		var ownerID, lastSeenAt any
		if err := rows.Scan(&item.ID, &item.Name, &item.RuntimeMode, &item.Provider, &item.Status, &ownerID, &lastSeenAt); err != nil {
			return nil, err
		}
		item.OwnerID = anyStringPtr(ownerID)
		item.LastSeenAt = anyTimePtr(lastSeenAt)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSActions(r *http.Request, workspaceID string) ([]AgentOSAction, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT ra.id, ra.invocation_id, r.id, r.name, r.title, ra.action_type, ra.risk_level,
       ra.requires_approval, ra.status, ra.payload, ra.created_at, ra.updated_at
FROM role_actions ra
JOIN role_invocations ri ON ri.id = ra.invocation_id
JOIN roles r ON r.id = ri.role_id
WHERE ra.workspace_id = $1
ORDER BY ra.created_at DESC
LIMIT 30`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSAction{}
	for rows.Next() {
		var item AgentOSAction
		var payload json.RawMessage
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.InvocationID, &item.RoleID, &item.RoleName, &item.RoleTitle, &item.ActionType, &item.RiskLevel, &item.RequiresApproval, &item.Status, &payload, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		item.Payload = nonNilRawJSON(payload, "{}")
		item.CreatedAt = createdAt.Format(time.RFC3339)
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSInvocations(r *http.Request, workspaceID string) ([]AgentOSInvocation, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT ri.id, ri.role_id, r.name, r.title, ri.channel, ri.status, ri.command_type,
       ri.risk_level, ri.requires_approval, ri.result, ri.created_at, ri.updated_at
FROM role_invocations ri
JOIN roles r ON r.id = ri.role_id
WHERE ri.workspace_id = $1
ORDER BY ri.created_at DESC
LIMIT 30`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSInvocation{}
	for rows.Next() {
		var item AgentOSInvocation
		var result json.RawMessage
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.RoleID, &item.RoleName, &item.RoleTitle, &item.Channel, &item.Status, &item.CommandType, &item.RiskLevel, &item.RequiresApproval, &result, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		item.Result = nonNilRawJSON(result, "{}")
		item.CreatedAt = createdAt.Format(time.RFC3339)
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSArtifacts(r *http.Request, workspaceID string) ([]AgentOSArtifact, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, role_action_id, invocation_id, thread_id, artifact_type, title, uri, status,
       produced_by, verification_status, metadata, created_at, updated_at
FROM studio_artifacts
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 30`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSArtifact{}
	for rows.Next() {
		var item AgentOSArtifact
		var roleActionID, invocationID any
		var metadata json.RawMessage
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.ID, &roleActionID, &invocationID, &item.ThreadID, &item.ArtifactType, &item.Title, &item.URI, &item.Status, &item.ProducedBy, &item.VerificationStatus, &metadata, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		item.RoleActionID = anyStringPtr(roleActionID)
		item.InvocationID = anyStringPtr(invocationID)
		item.Metadata = nonNilRawJSON(metadata, "{}")
		item.CreatedAt = createdAt.Format(time.RFC3339)
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) listAgentOSStudioState(r *http.Request, workspaceID string) ([]AgentOSStudioState, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, state_key, state_type, status, owner_role, summary, current_value,
       next_action, artifact_required, updated_at
FROM studio_state
WHERE workspace_id = $1
ORDER BY
  CASE status
    WHEN 'blocked' THEN 0
    WHEN 'missing' THEN 1
    WHEN 'partial' THEN 2
    WHEN 'operator_only' THEN 3
    ELSE 4
  END,
  updated_at DESC
LIMIT 30`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AgentOSStudioState{}
	for rows.Next() {
		var item AgentOSStudioState
		var currentValue json.RawMessage
		var updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.StateKey, &item.StateType, &item.Status, &item.OwnerRole, &item.Summary, &currentValue, &item.NextAction, &item.ArtifactRequired, &updatedAt); err != nil {
			return nil, err
		}
		item.CurrentValue = nonNilRawJSON(currentValue, "{}")
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		items = append(items, item)
	}
	return items, rows.Err()
}

func countActiveAgentOSActions(actions []AgentOSAction) int {
	count := 0
	for _, action := range actions {
		switch action.Status {
		case "proposed", "awaiting_approval", "approved", "executed":
			count++
		}
	}
	return count
}

func countBlockedAgentOSState(items []AgentOSStudioState) int {
	count := 0
	for _, item := range items {
		if item.Status == "blocked" || item.Status == "missing" {
			count++
		}
	}
	return count
}

func nonNilRawJSON(raw json.RawMessage, fallback string) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(fallback)
	}
	return raw
}

func anyStringPtr(value any) *string {
	if value == nil {
		return nil
	}
	s := ""
	switch v := value.(type) {
	case string:
		s = v
	case []byte:
		s = string(v)
	default:
		s = jsonScalarString(v)
	}
	if s == "" {
		return nil
	}
	return &s
}

func anyTimePtr(value any) *string {
	if value == nil {
		return nil
	}
	if t, ok := value.(time.Time); ok {
		s := t.Format(time.RFC3339)
		return &s
	}
	return anyStringPtr(value)
}

func jsonScalarString(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	return string(raw)
}
