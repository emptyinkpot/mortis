package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/roles"
)

type RoleResponse struct {
	ID               string          `json:"id"`
	WorkspaceID      string          `json:"workspace_id"`
	Name             string          `json:"name"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Responsibilities json.RawMessage `json:"responsibilities"`
	ForbiddenActions json.RawMessage `json:"forbidden_actions"`
	Permissions      json.RawMessage `json:"permissions"`
	DefaultRuntime   string          `json:"default_runtime"`
	AllowedChannels  json.RawMessage `json:"allowed_channels"`
	ApprovalPolicy   string          `json:"approval_policy"`
	SystemPrompt     string          `json:"system_prompt"`
	BuiltIn          bool            `json:"built_in"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

type RoleInvocationResponse struct {
	ID               string          `json:"id"`
	WorkspaceID      string          `json:"workspace_id"`
	RoleID           string          `json:"role_id"`
	RoleName         string          `json:"role_name"`
	RoleTitle        string          `json:"role_title"`
	MessageID        *string         `json:"message_id"`
	Channel          string          `json:"channel"`
	Status           string          `json:"status"`
	CommandType      string          `json:"command_type"`
	RiskLevel        string          `json:"risk_level"`
	RequiresApproval bool            `json:"requires_approval"`
	Result           json.RawMessage `json:"result"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

type roleRequest struct {
	Name             string   `json:"name"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Responsibilities []string `json:"responsibilities"`
	ForbiddenActions []string `json:"forbidden_actions"`
	Permissions      []string `json:"permissions"`
	DefaultRuntime   string   `json:"default_runtime"`
	AllowedChannels  []string `json:"allowed_channels"`
	ApprovalPolicy   string   `json:"approval_policy"`
	SystemPrompt     string   `json:"system_prompt"`
}

type roleRouteMessageRequest struct {
	Channel           string          `json:"channel"`
	Content           string          `json:"content"`
	ExternalThreadKey string          `json:"external_thread_key"`
	ExternalMessageID string          `json:"external_message_id"`
	Metadata          json.RawMessage `json:"metadata"`
}

const roleColumns = `id, workspace_id, name, title, description, responsibilities, forbidden_actions,
       permissions, default_runtime, allowed_channels, approval_policy, system_prompt, built_in,
       created_at, updated_at`

const roleSelect = `SELECT ` + roleColumns + ` FROM roles`

func scanRole(row pgx.Row) (RoleResponse, error) {
	var role RoleResponse
	var id pgtype.UUID
	var workspaceID pgtype.UUID
	var createdAt time.Time
	var updatedAt time.Time
	err := row.Scan(
		&id,
		&workspaceID,
		&role.Name,
		&role.Title,
		&role.Description,
		&role.Responsibilities,
		&role.ForbiddenActions,
		&role.Permissions,
		&role.DefaultRuntime,
		&role.AllowedChannels,
		&role.ApprovalPolicy,
		&role.SystemPrompt,
		&role.BuiltIn,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return role, err
	}
	role.ID = uuidToString(id)
	role.WorkspaceID = uuidToString(workspaceID)
	role.CreatedAt = createdAt.Format(time.RFC3339)
	role.UpdatedAt = updatedAt.Format(time.RFC3339)
	return role, nil
}

func scanRoleInvocation(row pgx.Row) (RoleInvocationResponse, error) {
	var invocation RoleInvocationResponse
	var id pgtype.UUID
	var workspaceID pgtype.UUID
	var roleID pgtype.UUID
	var messageID pgtype.UUID
	var createdAt time.Time
	var updatedAt time.Time
	err := row.Scan(
		&id,
		&workspaceID,
		&roleID,
		&invocation.RoleName,
		&invocation.RoleTitle,
		&messageID,
		&invocation.Channel,
		&invocation.Status,
		&invocation.CommandType,
		&invocation.RiskLevel,
		&invocation.RequiresApproval,
		&invocation.Result,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return invocation, err
	}
	invocation.ID = uuidToString(id)
	invocation.WorkspaceID = uuidToString(workspaceID)
	invocation.RoleID = uuidToString(roleID)
	invocation.MessageID = uuidToPtr(messageID)
	invocation.CreatedAt = createdAt.Format(time.RFC3339)
	invocation.UpdatedAt = updatedAt.Format(time.RFC3339)
	return invocation, nil
}

func (h *Handler) ensureBuiltInRoles(r *http.Request, workspaceID string) error {
	for _, def := range roles.BuiltInDefinitions() {
		_, err := h.DB.Exec(r.Context(), `
INSERT INTO roles (
  workspace_id, name, title, description, responsibilities, forbidden_actions,
  permissions, default_runtime, allowed_channels, approval_policy, system_prompt, built_in
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11, true
)
ON CONFLICT (workspace_id, name) DO NOTHING`,
			parseUUID(workspaceID),
			def.Name,
			def.Title,
			def.Description,
			roles.MustJSON(def.Responsibilities),
			roles.MustJSON(def.ForbiddenActions),
			roles.MustJSON(def.Permissions),
			def.DefaultRuntime,
			roles.MustJSON(def.AllowedChannels),
			def.ApprovalPolicy,
			def.SystemPrompt,
		)
		if err != nil {
			return err
		}
	}

	_, err := h.DB.Exec(r.Context(), `
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, permission
FROM roles r
CROSS JOIN LATERAL jsonb_array_elements_text(r.permissions) AS permission
WHERE r.workspace_id = $1
ON CONFLICT (role_id, permission) DO NOTHING`, parseUUID(workspaceID))
	if err != nil {
		return err
	}

	_, err = h.DB.Exec(r.Context(), `
INSERT INTO role_channels (role_id, channel)
SELECT r.id, channel
FROM roles r
CROSS JOIN LATERAL jsonb_array_elements_text(r.allowed_channels) AS channel
WHERE r.workspace_id = $1
ON CONFLICT (role_id, channel) DO NOTHING`, parseUUID(workspaceID))
	return err
}

func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if err := h.ensureBuiltInRoles(r, workspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to ensure built-in roles")
		return
	}

	rows, err := h.DB.Query(r.Context(), roleSelect+`
WHERE workspace_id = $1
ORDER BY built_in DESC, name ASC`, parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	defer rows.Close()

	items := []RoleResponse{}
	for rows.Next() {
		role, err := scanRole(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan role")
			return
		}
		items = append(items, role)
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": items, "total": len(items)})
}

func (h *Handler) GetRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	roleID := chi.URLParam(r, "id")
	role, err := scanRole(h.DB.QueryRow(r.Context(), roleSelect+`
WHERE id = $1 AND workspace_id = $2`, parseUUID(roleID), parseUUID(workspaceID)))
	if err != nil {
		writeError(w, http.StatusNotFound, "role not found")
		return
	}
	writeJSON(w, http.StatusOK, role)
}

func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := roles.NormalizeName(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Title == "" {
		req.Title = name
	}
	if req.DefaultRuntime == "" {
		req.DefaultRuntime = "manual"
	}
	if req.ApprovalPolicy == "" {
		req.ApprovalPolicy = "operator_required_for_high_risk"
	}
	if len(req.AllowedChannels) == 0 {
		req.AllowedChannels = []string{"web", "internal_chat"}
	}
	req.Responsibilities = nonNilStrings(req.Responsibilities)
	req.ForbiddenActions = nonNilStrings(req.ForbiddenActions)
	req.Permissions = nonNilStrings(req.Permissions)
	req.AllowedChannels = nonNilStrings(req.AllowedChannels)
	if !validRoleChannels(req.AllowedChannels) {
		writeError(w, http.StatusBadRequest, "allowed_channels contains unsupported channel")
		return
	}

	role, err := scanRole(h.DB.QueryRow(r.Context(), `
INSERT INTO roles (
  workspace_id, name, title, description, responsibilities, forbidden_actions,
  permissions, default_runtime, allowed_channels, approval_policy, system_prompt, built_in
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11, false
)
RETURNING `+roleColumns,
		parseUUID(workspaceID),
		name,
		req.Title,
		req.Description,
		roles.MustJSON(req.Responsibilities),
		roles.MustJSON(req.ForbiddenActions),
		roles.MustJSON(req.Permissions),
		req.DefaultRuntime,
		roles.MustJSON(req.AllowedChannels),
		req.ApprovalPolicy,
		req.SystemPrompt,
	))
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "role name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create role")
		return
	}
	writeJSON(w, http.StatusCreated, role)
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	roleID := chi.URLParam(r, "id")
	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if req.DefaultRuntime == "" {
		req.DefaultRuntime = "manual"
	}
	if req.ApprovalPolicy == "" {
		req.ApprovalPolicy = "operator_required_for_high_risk"
	}
	if len(req.AllowedChannels) == 0 {
		req.AllowedChannels = []string{"web", "internal_chat"}
	}
	req.Responsibilities = nonNilStrings(req.Responsibilities)
	req.ForbiddenActions = nonNilStrings(req.ForbiddenActions)
	req.Permissions = nonNilStrings(req.Permissions)
	req.AllowedChannels = nonNilStrings(req.AllowedChannels)
	if !validRoleChannels(req.AllowedChannels) {
		writeError(w, http.StatusBadRequest, "allowed_channels contains unsupported channel")
		return
	}

	role, err := scanRole(h.DB.QueryRow(r.Context(), `
UPDATE roles
SET title = $1,
    description = $2,
    responsibilities = $3,
    forbidden_actions = $4,
    permissions = $5,
    default_runtime = $6,
    allowed_channels = $7,
    approval_policy = $8,
    system_prompt = $9,
    updated_at = now()
WHERE id = $10 AND workspace_id = $11
RETURNING `+roleColumns,
		req.Title,
		req.Description,
		roles.MustJSON(req.Responsibilities),
		roles.MustJSON(req.ForbiddenActions),
		roles.MustJSON(req.Permissions),
		req.DefaultRuntime,
		roles.MustJSON(req.AllowedChannels),
		req.ApprovalPolicy,
		req.SystemPrompt,
		parseUUID(roleID),
		parseUUID(workspaceID),
	))
	if err != nil {
		writeError(w, http.StatusNotFound, "role not found")
		return
	}
	writeJSON(w, http.StatusOK, role)
}

func (h *Handler) RouteRoleMessage(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	if err := h.ensureBuiltInRoles(r, workspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to ensure built-in roles")
		return
	}

	var req roleRouteMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if req.Channel == "" {
		req.Channel = "internal_chat"
	}
	if req.Channel != "web" && req.Channel != "internal_chat" && req.Channel != "qq" && req.Channel != "api" && req.Channel != "telegram" {
		writeError(w, http.StatusBadRequest, "unsupported channel")
		return
	}
	if req.ExternalThreadKey == "" {
		req.ExternalThreadKey = req.Channel + ":operator"
	}
	metadata := json.RawMessage(`{}`)
	metadataMap := map[string]any{}
	if len(req.Metadata) > 0 && json.Valid(req.Metadata) {
		metadata = req.Metadata
		_ = json.Unmarshal(req.Metadata, &metadataMap)
	}

	candidates, err := h.loadRoleCandidates(r, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load role router")
		return
	}
	route := roles.RouteMessage(req.Content, req.Channel, candidates)

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start role route transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var threadID pgtype.UUID
	err = tx.QueryRow(r.Context(), `
INSERT INTO conversation_threads (workspace_id, channel, external_thread_key, title)
VALUES ($1, $2, $3, $4)
ON CONFLICT (workspace_id, channel, external_thread_key)
DO UPDATE SET updated_at = now()
RETURNING id`, parseUUID(workspaceID), req.Channel, req.ExternalThreadKey, route.RoleTitle).Scan(&threadID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to upsert conversation thread")
		return
	}

	var messageID pgtype.UUID
	err = tx.QueryRow(r.Context(), `
INSERT INTO conversation_messages (
  thread_id, workspace_id, channel, sender_type, sender_id, content, external_message_id, metadata
) VALUES (
  $1, $2, $3, 'operator', $4, $5, $6, $7
)
RETURNING id`, threadID, parseUUID(workspaceID), req.Channel, userID, req.Content, req.ExternalMessageID, metadata).Scan(&messageID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create conversation message")
		return
	}

	result := roles.MustJSON(route)
	var invocationID pgtype.UUID
	err = tx.QueryRow(r.Context(), `
INSERT INTO role_invocations (
  workspace_id, role_id, message_id, channel, status, command_type, risk_level, requires_approval, result
) VALUES (
  $1, $2, $3, $4, 'routed', $5, $6, $7, $8
)
RETURNING id`, parseUUID(workspaceID), parseUUID(route.RoleID), messageID, req.Channel, route.CommandType, route.RiskLevel, route.RequiresApproval, result).Scan(&invocationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create role invocation")
		return
	}
	invocation, err := scanRoleInvocation(tx.QueryRow(r.Context(), `
SELECT ri.id, ri.workspace_id, ri.role_id, r.name, r.title, ri.message_id, ri.channel,
       ri.status, ri.command_type, ri.risk_level, ri.requires_approval, ri.result,
       ri.created_at, ri.updated_at
FROM role_invocations ri
JOIN roles r ON r.id = ri.role_id
WHERE ri.id = $1`, invocationID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load role invocation")
		return
	}

	actionStatus := "proposed"
	if route.RequiresApproval {
		actionStatus = "awaiting_approval"
	}
	var actionID pgtype.UUID
	err = tx.QueryRow(r.Context(), `
INSERT INTO role_actions (
  workspace_id, invocation_id, action_type, risk_level, requires_approval, payload, status
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
)
RETURNING id`, parseUUID(workspaceID), parseUUID(invocation.ID), route.CommandType, route.RiskLevel, route.RequiresApproval, roles.MustJSON(roles.BuildActionContractPayload(roles.ActionContractInput{
		Content:     req.Content,
		Channel:     req.Channel,
		RoleName:    route.RoleName,
		CommandType: route.CommandType,
		RiskLevel:   route.RiskLevel,
		Metadata:    metadataMap,
	})), actionStatus).Scan(&actionID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create role action")
		return
	}

	var approvalID *string
	if route.RequiresApproval {
		var id pgtype.UUID
		err = tx.QueryRow(r.Context(), `
INSERT INTO approval_requests (workspace_id, role_action_id, status, requested_by)
VALUES ($1, $2, 'awaiting_approval', $3)
RETURNING id`, parseUUID(workspaceID), actionID, userID).Scan(&id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create approval request")
			return
		}
		approvalID = uuidToPtr(id)
	}

	_, err = tx.Exec(r.Context(), `
INSERT INTO audit_events (workspace_id, actor_type, actor_id, event_type, target_type, target_id, metadata)
VALUES ($1, 'operator', $2, 'role.message_routed', 'role_invocation', $3, $4)`,
		parseUUID(workspaceID),
		userID,
		invocation.ID,
		result,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create audit event")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit role route")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"route":       route,
		"invocation":  invocation,
		"approval_id": approvalID,
	})
}

func (h *Handler) loadRoleCandidates(r *http.Request, workspaceID string) ([]roles.Candidate, error) {
	rows, err := h.DB.Query(r.Context(), `
SELECT id, name, title
FROM roles
WHERE workspace_id = $1
ORDER BY built_in DESC, name ASC`, parseUUID(workspaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []roles.Candidate
	for rows.Next() {
		var id pgtype.UUID
		var candidate roles.Candidate
		if err := rows.Scan(&id, &candidate.Name, &candidate.Title); err != nil {
			return nil, err
		}
		candidate.ID = uuidToString(id)
		candidates = append(candidates, candidate)
	}
	return candidates, nil
}

func (h *Handler) ListRoleInvocations(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	rows, err := h.DB.Query(r.Context(), `
SELECT ri.id, ri.workspace_id, ri.role_id, r.name, r.title, ri.message_id, ri.channel,
       ri.status, ri.command_type, ri.risk_level, ri.requires_approval, ri.result,
       ri.created_at, ri.updated_at
FROM role_invocations ri
JOIN roles r ON r.id = ri.role_id
WHERE ri.workspace_id = $1
ORDER BY ri.created_at DESC
LIMIT 50`, parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list role invocations")
		return
	}
	defer rows.Close()

	items := []RoleInvocationResponse{}
	for rows.Next() {
		invocation, err := scanRoleInvocation(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan role invocation")
			return
		}
		items = append(items, invocation)
	}
	writeJSON(w, http.StatusOK, map[string]any{"invocations": items, "total": len(items)})
}

func nonNilStrings[T ~string](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

func validRoleChannels(items []string) bool {
	for _, item := range items {
		if item != "web" && item != "internal_chat" && item != "qq" && item != "api" && item != "telegram" {
			return false
		}
	}
	return true
}
