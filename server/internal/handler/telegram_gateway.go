package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/roles"
)

type TelegramOperatorMessageRequest struct {
	UpdateID int64                   `json:"update_id"`
	Message  TelegramOperatorMessage `json:"message"`
	Raw      map[string]any          `json:"raw"`
	Metadata map[string]any          `json:"metadata"`
}

type TelegramOperatorMessage struct {
	MessageID int64                 `json:"message_id"`
	Text      string                `json:"text"`
	Chat      TelegramOperatorChat  `json:"chat"`
	From      TelegramOperatorActor `json:"from"`
	Metadata  map[string]any        `json:"metadata"`
}

type TelegramOperatorChat struct {
	ID    any    `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title"`
}

type TelegramOperatorActor struct {
	ID          any    `json:"id"`
	Username    string `json:"username"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DisplayName string `json:"display_name"`
}

type TelegramOperatorMessageResponse struct {
	OK           bool               `json:"ok"`
	Ignored      string             `json:"ignored,omitempty"`
	Reply        OperatorEventReply `json:"reply"`
	Route        roles.RouteResult  `json:"route,omitempty"`
	InvocationID string             `json:"invocation_id,omitempty"`
	ActionID     string             `json:"action_id,omitempty"`
	ActionStatus string             `json:"action_status,omitempty"`
	ApprovalID   *string            `json:"approval_id,omitempty"`
}

func (h *Handler) IngestTelegramOperatorMessage(w http.ResponseWriter, r *http.Request) {
	if !operatorGatewayAuthorized(r) {
		writeError(w, http.StatusUnauthorized, "telegram gateway unauthorized")
		return
	}
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace is required")
		return
	}
	var req TelegramOperatorMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	content := strings.TrimSpace(req.Message.Text)
	if content == "" {
		writeJSON(w, http.StatusOK, TelegramOperatorMessageResponse{OK: true, Ignored: "empty telegram text"})
		return
	}
	chatID := telegramAnyString(req.Message.Chat.ID)
	actorID := telegramAnyString(req.Message.From.ID)
	if chatID == "" || actorID == "" {
		writeError(w, http.StatusBadRequest, "telegram chat.id and from.id are required")
		return
	}
	if ignored := telegramAllowed(chatID, actorID); ignored != "" {
		writeJSON(w, http.StatusOK, TelegramOperatorMessageResponse{OK: true, Ignored: ignored})
		return
	}
	operatorID, err := h.ensureTelegramOperator(r, workspaceID, req.Message.From)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to ensure telegram operator")
		return
	}
	if err := h.ensureBuiltInRoles(r, workspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to ensure built-in roles")
		return
	}
	candidates, err := h.loadRoleCandidates(r, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load role router")
		return
	}
	route := roles.RouteMessage(content, "telegram", candidates)
	record, err := h.insertTelegramRoute(r, workspaceID, operatorID, req, content, route)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to route telegram message")
		return
	}
	writeJSON(w, http.StatusCreated, record)
}

func telegramAllowed(chatID, actorID string) string {
	if allowed := telegramStringSet(splitCSVEnv("MORTIS_TELEGRAM_ALLOWED_CHAT_IDS")); len(allowed) > 0 && !allowed[chatID] {
		return "telegram chat not allowed"
	}
	if allowed := telegramStringSet(splitCSVEnv("MORTIS_TELEGRAM_ALLOWED_USER_IDS")); len(allowed) > 0 && !allowed[actorID] {
		return "telegram user not allowed"
	}
	return ""
}

func (h *Handler) ensureTelegramOperator(r *http.Request, workspaceID string, actor TelegramOperatorActor) (string, error) {
	name := strings.TrimSpace(actor.DisplayName)
	if name == "" {
		name = strings.TrimSpace(strings.Join(nonEmptyStrings(actor.FirstName, actor.LastName), " "))
	}
	if name == "" {
		name = strings.TrimSpace(actor.Username)
	}
	if name == "" {
		name = "Telegram Operator"
	}
	email := strings.TrimSpace(os.Getenv("MORTIS_TELEGRAM_OPERATOR_EMAIL"))
	if email == "" {
		externalID := telegramAnyString(actor.ID)
		if externalID == "" {
			externalID = "operator"
		}
		email = "telegram-" + sanitizeTelegramIdentity(externalID) + "@mortis.local"
	}
	var userID string
	if err := h.DB.QueryRow(r.Context(), `
INSERT INTO "user" (name, email)
VALUES ($1, $2)
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
RETURNING id::text`, name, strings.ToLower(email)).Scan(&userID); err != nil {
		return "", err
	}
	_, err := h.DB.Exec(r.Context(), `
INSERT INTO member (workspace_id, user_id, role)
VALUES ($1::uuid, $2::uuid, 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING`, workspaceID, userID)
	return userID, err
}

func (h *Handler) insertTelegramRoute(r *http.Request, workspaceID string, operatorID string, req TelegramOperatorMessageRequest, content string, route roles.RouteResult) (TelegramOperatorMessageResponse, error) {
	chatID := telegramAnyString(req.Message.Chat.ID)
	actorID := telegramAnyString(req.Message.From.ID)
	messageID := telegramAnyString(req.Message.MessageID)
	threadKey := "telegram:chat:" + chatID
	dedupeKey := telegramDedupeKey(chatID, actorID, messageID, content)
	metadata := map[string]any{
		"telegram_chat_id":    chatID,
		"telegram_chat_type":  req.Message.Chat.Type,
		"telegram_chat_title": req.Message.Chat.Title,
		"telegram_user_id":    actorID,
		"telegram_username":   req.Message.From.Username,
		"telegram_message_id": messageID,
		"telegram_dedupe_key": dedupeKey,
		"raw":                 req.Raw,
		"metadata":            req.Metadata,
	}
	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	defer tx.Rollback(r.Context())
	if _, err := tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtext($1))`, dedupeKey); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	duplicate, err := h.isDuplicateTelegramMessage(r, tx, workspaceID, messageID, dedupeKey)
	if err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	if duplicate {
		return TelegramOperatorMessageResponse{OK: true, Ignored: "duplicate telegram message", Reply: OperatorEventReply{Channel: "telegram", Text: "Mortis 已收到过这条消息。"}}, nil
	}
	var threadID string
	if err := tx.QueryRow(r.Context(), `
INSERT INTO conversation_threads (workspace_id, channel, external_thread_key, title)
VALUES ($1::uuid, 'telegram', $2, $3)
ON CONFLICT (workspace_id, channel, external_thread_key)
DO UPDATE SET updated_at = now()
RETURNING id::text`, workspaceID, threadKey, route.RoleTitle).Scan(&threadID); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	var msgID string
	if err := tx.QueryRow(r.Context(), `
INSERT INTO conversation_messages (
  thread_id, workspace_id, channel, sender_type, sender_id, content, external_message_id, metadata
) VALUES (
  $1::uuid, $2::uuid, 'telegram', 'operator', $3::uuid, $4, $5, $6
)
RETURNING id::text`, threadID, workspaceID, operatorID, content, messageID, roles.MustJSON(metadata)).Scan(&msgID); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	result := roles.MustJSON(route)
	var invocationID string
	if err := tx.QueryRow(r.Context(), `
INSERT INTO role_invocations (
  workspace_id, role_id, message_id, channel, status, command_type, risk_level, requires_approval, result
) VALUES (
  $1::uuid, $2::uuid, $3::uuid, 'telegram', 'routed', $4, $5, $6, $7
)
RETURNING id::text`, workspaceID, route.RoleID, msgID, route.CommandType, route.RiskLevel, route.RequiresApproval, result).Scan(&invocationID); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	actionStatus := "proposed"
	if route.RequiresApproval {
		actionStatus = "awaiting_approval"
	} else if telegramAutoApproveLowRisk() && (route.RoleName == "builder" || route.RoleName == "tester") && route.RiskLevel == "low" {
		actionStatus = "approved"
	}
	var actionID string
	if err := tx.QueryRow(r.Context(), `
INSERT INTO role_actions (
  workspace_id, invocation_id, action_type, risk_level, requires_approval, payload, status
) VALUES (
  $1::uuid, $2::uuid, $3, $4, $5, $6, $7
)
RETURNING id::text`, workspaceID, invocationID, route.CommandType, route.RiskLevel, route.RequiresApproval, roles.MustJSON(roles.BuildActionContractPayload(roles.ActionContractInput{
		Content:     content,
		Channel:     "telegram",
		RoleName:    route.RoleName,
		CommandType: route.CommandType,
		RiskLevel:   route.RiskLevel,
		Metadata:    metadata,
	})), actionStatus).Scan(&actionID); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	var approvalID *string
	if route.RequiresApproval {
		var id string
		if err := tx.QueryRow(r.Context(), `
INSERT INTO approval_requests (workspace_id, role_action_id, status, requested_by)
VALUES ($1::uuid, $2::uuid, 'awaiting_approval', $3::uuid)
RETURNING id::text`, workspaceID, actionID, operatorID).Scan(&id); err != nil {
			return TelegramOperatorMessageResponse{}, err
		}
		approvalID = &id
	}
	if _, err := tx.Exec(r.Context(), `
INSERT INTO audit_events (workspace_id, actor_type, actor_id, event_type, target_type, target_id, metadata)
VALUES ($1::uuid, 'operator', $2::uuid, 'telegram.message_routed', 'role_invocation', $3::uuid, $4)`, workspaceID, operatorID, invocationID, roles.MustJSON(map[string]any{"route": route, "action_status": actionStatus})); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	if err := tx.Commit(r.Context()); err != nil {
		return TelegramOperatorMessageResponse{}, err
	}
	return TelegramOperatorMessageResponse{OK: true, Reply: OperatorEventReply{Channel: "telegram", Text: formatTelegramRouteAck(route, actionStatus, actionID, approvalID)}, Route: route, InvocationID: invocationID, ActionID: actionID, ActionStatus: actionStatus, ApprovalID: approvalID}, nil
}

type telegramDuplicateQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (h *Handler) isDuplicateTelegramMessage(r *http.Request, q telegramDuplicateQuerier, workspaceID, messageID, dedupeKey string) (bool, error) {
	var existingID string
	err := q.QueryRow(r.Context(), `
SELECT id::text
FROM conversation_messages
WHERE workspace_id = $1::uuid
  AND channel = 'telegram'
  AND (
    ($2 <> '' AND external_message_id = $2)
    OR
    ($3 <> '' AND metadata->>'telegram_dedupe_key' = $3 AND created_at > now() - interval '5 minutes')
  )
LIMIT 1`, workspaceID, messageID, dedupeKey).Scan(&existingID)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return false, err
}

func telegramAutoApproveLowRisk() bool {
	return os.Getenv("MORTIS_TELEGRAM_AUTO_APPROVE_LOW_RISK") == "true"
}

func formatTelegramRouteAck(route roles.RouteResult, actionStatus string, actionID string, approvalID *string) string {
	lines := []string{
		"Mortis 已收到 Telegram 指令。",
		fmt.Sprintf("路由: %s / %s", route.RoleTitle, route.CommandType),
		fmt.Sprintf("风险: %s", route.RiskLevel),
		fmt.Sprintf("状态: %s", actionStatus),
	}
	if actionID != "" {
		lines = append(lines, "Action: "+actionID)
	}
	if approvalID != nil {
		lines = append(lines, "需要审批: "+*approvalID)
	}
	if actionStatus == "approved" {
		lines = append(lines, "已进入后台 Codex 执行队列。")
	}
	return strings.Join(lines, "\n")
}

func telegramDedupeKey(chatID, actorID, messageID, content string) string {
	return strings.Join([]string{chatID, actorID, messageID, strings.ToLower(strings.TrimSpace(content))}, ":")
}

func sanitizeTelegramIdentity(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
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
		return "operator"
	}
	return out
}

func telegramAnyString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case float64:
		return fmt.Sprintf("%.0f", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case int:
		return fmt.Sprintf("%d", v)
	case json.Number:
		return v.String()
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func nonEmptyStrings(values ...string) []string {
	out := []string{}
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			out = append(out, strings.TrimSpace(value))
		}
	}
	return out
}

func splitCSVEnv(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func telegramStringSet(items []string) map[string]bool {
	set := make(map[string]bool, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			set[item] = true
		}
	}
	return set
}
