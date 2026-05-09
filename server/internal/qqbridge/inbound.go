package qqbridge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/roles"
)

type InboundConfig struct {
	Logger             *slog.Logger
	Pool               *pgxpool.Pool
	Enabled            bool
	Secret             string
	WorkspaceSlug      string
	OperatorEmail      string
	OperatorName       string
	AllowedGroupIDs    []string
	AllowedUserIDs     []string
	BotUserIDs         []string
	RequireMention     bool
	AutoApproveLowRisk bool
	AckEnabled         bool
	OneBotURL          string
	OneBotURLs         map[string]string
	ConversationKey    string
}

type InboundHandler struct {
	log                *slog.Logger
	pool               *pgxpool.Pool
	secret             string
	workspaceSlug      string
	operatorEmail      string
	operatorName       string
	allowedGroupIDs    map[string]bool
	allowedUserIDs     map[string]bool
	botUserIDs         map[string]bool
	requireMention     bool
	autoApproveLowRisk bool
	ackEnabled         bool
	oneBotURL          string
	oneBotURLs         map[string]string
	conversationKey    string
	client             *http.Client
}

type oneBotMessageEvent struct {
	PostType    string          `json:"post_type"`
	MessageType string          `json:"message_type"`
	SubType     string          `json:"sub_type"`
	MessageID   any             `json:"message_id"`
	UserID      any             `json:"user_id"`
	GroupID     any             `json:"group_id"`
	SelfID      any             `json:"self_id"`
	RawMessage  string          `json:"raw_message"`
	Message     json.RawMessage `json:"message"`
}

type routeRecord struct {
	Route        roles.RouteResult `json:"route"`
	InvocationID string            `json:"invocation_id"`
	ActionID     string            `json:"action_id"`
	ActionStatus string            `json:"action_status"`
}

func NewInboundHandlerFromEnv(pool *pgxpool.Pool, log *slog.Logger) (*InboundHandler, bool, error) {
	if os.Getenv("MORTIS_QQ_INBOUND_ENABLED") != "true" {
		return nil, false, nil
	}
	cfg := InboundConfig{
		Logger:             log,
		Pool:               pool,
		Enabled:            true,
		Secret:             os.Getenv("MORTIS_QQ_INBOUND_SECRET"),
		WorkspaceSlug:      getenvDefault("MORTIS_QQ_INBOUND_WORKSPACE_SLUG", "mortis"),
		OperatorEmail:      getenvDefault("MORTIS_QQ_INBOUND_OPERATOR_EMAIL", getenvDefault("MULTICA_AUTO_LOGIN_EMAIL", "qq-operator@mortis.local")),
		OperatorName:       getenvDefault("MORTIS_QQ_INBOUND_OPERATOR_NAME", "QQ Operator"),
		AllowedGroupIDs:    splitCSV(os.Getenv("MORTIS_QQ_INBOUND_ALLOWED_GROUP_IDS")),
		AllowedUserIDs:     splitCSV(os.Getenv("MORTIS_QQ_INBOUND_ALLOWED_USER_IDS")),
		BotUserIDs:         splitCSV(os.Getenv("MORTIS_QQ_BOT_USER_IDS")),
		RequireMention:     os.Getenv("MORTIS_QQ_INBOUND_REQUIRE_MENTION") == "true",
		AutoApproveLowRisk: os.Getenv("MORTIS_QQ_INBOUND_AUTO_APPROVE_LOW_RISK") == "true",
		AckEnabled:         os.Getenv("MORTIS_QQ_INBOUND_ACK_ENABLED") == "true",
		OneBotURL:          os.Getenv("MORTIS_QQ_ONEBOT_HTTP_URL"),
		OneBotURLs:         parseOneBotURLMap(os.Getenv("MORTIS_QQ_ONEBOT_HTTP_URLS")),
		ConversationKey:    getenvDefault("MORTIS_QQ_INBOUND_CONVERSATION_KEY", "company-room"),
	}
	h, err := NewInboundHandler(cfg)
	return h, true, err
}

func NewInboundHandler(cfg InboundConfig) (*InboundHandler, error) {
	if cfg.Pool == nil {
		return nil, errors.New("qq inbound requires database pool")
	}
	if strings.TrimSpace(cfg.WorkspaceSlug) == "" {
		return nil, errors.New("qq inbound requires workspace slug")
	}
	if strings.TrimSpace(cfg.OperatorEmail) == "" {
		return nil, errors.New("qq inbound requires operator email")
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &InboundHandler{
		log:                cfg.Logger,
		pool:               cfg.Pool,
		secret:             strings.TrimSpace(cfg.Secret),
		workspaceSlug:      strings.ToLower(strings.TrimSpace(cfg.WorkspaceSlug)),
		operatorEmail:      strings.ToLower(strings.TrimSpace(cfg.OperatorEmail)),
		operatorName:       strings.TrimSpace(cfg.OperatorName),
		allowedGroupIDs:    stringSet(cfg.AllowedGroupIDs),
		allowedUserIDs:     stringSet(cfg.AllowedUserIDs),
		botUserIDs:         stringSet(cfg.BotUserIDs),
		requireMention:     cfg.RequireMention,
		autoApproveLowRisk: cfg.AutoApproveLowRisk,
		ackEnabled:         cfg.AckEnabled,
		oneBotURL:          strings.TrimRight(strings.TrimSpace(cfg.OneBotURL), "/"),
		oneBotURLs:         normalizeOneBotURLMap(cfg.OneBotURLs),
		conversationKey:    strings.TrimSpace(cfg.ConversationKey),
		client:             &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (h *InboundHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	if h.secret != "" && r.Header.Get("X-Mortis-QQ-Secret") != h.secret && r.URL.Query().Get("secret") != h.secret {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var event oneBotMessageEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	record, ignored, err := h.HandleEvent(r.Context(), event)
	if err != nil {
		h.log.Error("qq inbound route failed", "error", err)
		http.Error(w, `{"error":"route failed"}`, http.StatusInternalServerError)
		return
	}
	if ignored != "" {
		writeBridgeJSON(w, http.StatusOK, map[string]any{"ok": true, "ignored": ignored})
		return
	}
	ackMessage := "Mortis 已收到: " + record.Route.RoleTitle + " / " + record.ActionStatus
	response := map[string]any{"ok": true, "record": record}
	if h.ackEnabled {
		h.sendAck(r.Context(), event, record)
		response["reply"] = ackMessage
	}
	writeBridgeJSON(w, http.StatusOK, response)
}

func (h *InboundHandler) HandleEvent(ctx context.Context, event oneBotMessageEvent) (routeRecord, string, error) {
	if event.PostType != "message" {
		return routeRecord{}, "not message event", nil
	}
	if event.MessageType != "group" && event.MessageType != "private" {
		return routeRecord{}, "unsupported message type", nil
	}
	content := strings.TrimSpace(extractMessageText(event))
	if content == "" {
		return routeRecord{}, "empty message", nil
	}
	userID := anyToString(event.UserID)
	if h.isBotMessage(userID, content) {
		return routeRecord{}, "bot or bridge message ignored", nil
	}
	if h.requireMention && !h.hasRequiredMention(content) {
		return routeRecord{}, "missing mention", nil
	}
	groupID := anyToString(event.GroupID)
	if len(h.allowedUserIDs) > 0 && !h.allowedUserIDs[userID] {
		return routeRecord{}, "user not allowed", nil
	}
	if event.MessageType == "group" && len(h.allowedGroupIDs) > 0 && !h.allowedGroupIDs[groupID] {
		return routeRecord{}, "group not allowed", nil
	}

	workspaceID, err := h.ensureWorkspace(ctx)
	if err != nil {
		return routeRecord{}, "", err
	}
	operatorID, err := h.ensureOperator(ctx, workspaceID)
	if err != nil {
		return routeRecord{}, "", err
	}
	if err := h.ensureBuiltInRoles(ctx, workspaceID); err != nil {
		return routeRecord{}, "", err
	}
	candidates, err := h.loadRoleCandidates(ctx, workspaceID)
	if err != nil {
		return routeRecord{}, "", err
	}
	route := roles.RouteMessage(content, "qq", candidates)
	return h.insertRoute(ctx, workspaceID, operatorID, event, content, route)
}

func (h *InboundHandler) isBotMessage(userID string, content string) bool {
	if userID != "" && h.botUserIDs[userID] {
		return true
	}
	trimmed := stripLeadingCQCodes(content)
	if trimmed == "" {
		return true
	}
	lower := strings.ToLower(trimmed)
	for _, prefix := range []string{
		"mortis 已收到",
		"mortis 任务已完成",
		"[napcat]",
		"napcat ",
	} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
}

func (h *InboundHandler) hasRequiredMention(content string) bool {
	if containsAnyInsensitive(content, []string{"@manager", "@builder", "@tester", "mortis"}) {
		return true
	}
	for botID := range h.botUserIDs {
		if botID != "" && strings.Contains(content, "[CQ:at,qq="+botID+"]") {
			return true
		}
	}
	return false
}

func (h *InboundHandler) ensureWorkspace(ctx context.Context) (string, error) {
	var id string
	err := h.pool.QueryRow(ctx, `SELECT id::text FROM workspace WHERE slug = $1`, h.workspaceSlug).Scan(&id)
	return id, err
}

func (h *InboundHandler) ensureOperator(ctx context.Context, workspaceID string) (string, error) {
	name := h.operatorName
	if name == "" {
		name = "QQ Operator"
	}
	var userID string
	err := h.pool.QueryRow(ctx, `
INSERT INTO "user" (name, email)
VALUES ($1, $2)
ON CONFLICT (email) DO UPDATE SET updated_at = now()
RETURNING id::text`, name, h.operatorEmail).Scan(&userID)
	if err != nil {
		return "", err
	}
	_, err = h.pool.Exec(ctx, `
INSERT INTO member (workspace_id, user_id, role)
VALUES ($1::uuid, $2::uuid, 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING`, workspaceID, userID)
	return userID, err
}

func (h *InboundHandler) ensureBuiltInRoles(ctx context.Context, workspaceID string) error {
	for _, def := range roles.BuiltInDefinitions() {
		if _, err := h.pool.Exec(ctx, `
INSERT INTO roles (
  workspace_id, name, title, description, responsibilities, forbidden_actions,
  permissions, default_runtime, allowed_channels, approval_policy, system_prompt, built_in
) VALUES (
  $1::uuid, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11, true
)
ON CONFLICT (workspace_id, name) DO NOTHING`,
			workspaceID,
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
		); err != nil {
			return err
		}
	}
	if _, err := h.pool.Exec(ctx, `
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, permission
FROM roles r
CROSS JOIN LATERAL jsonb_array_elements_text(r.permissions) AS permission
WHERE r.workspace_id = $1::uuid
ON CONFLICT (role_id, permission) DO NOTHING`, workspaceID); err != nil {
		return err
	}
	_, err := h.pool.Exec(ctx, `
INSERT INTO role_channels (role_id, channel)
SELECT r.id, channel
FROM roles r
CROSS JOIN LATERAL jsonb_array_elements_text(r.allowed_channels) AS channel
WHERE r.workspace_id = $1::uuid
ON CONFLICT (role_id, channel) DO NOTHING`, workspaceID)
	return err
}

func (h *InboundHandler) loadRoleCandidates(ctx context.Context, workspaceID string) ([]roles.Candidate, error) {
	rows, err := h.pool.Query(ctx, `SELECT id::text, name, title FROM roles WHERE workspace_id = $1::uuid ORDER BY built_in DESC, name ASC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var candidates []roles.Candidate
	for rows.Next() {
		var candidate roles.Candidate
		if err := rows.Scan(&candidate.ID, &candidate.Name, &candidate.Title); err != nil {
			return nil, err
		}
		candidates = append(candidates, candidate)
	}
	return candidates, rows.Err()
}

func (h *InboundHandler) insertRoute(ctx context.Context, workspaceID string, operatorID string, event oneBotMessageEvent, content string, route roles.RouteResult) (routeRecord, string, error) {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return routeRecord{}, "", err
	}
	defer tx.Rollback(ctx)

	targetType := event.MessageType
	targetID := anyToString(event.UserID)
	if event.MessageType == "group" {
		targetID = anyToString(event.GroupID)
	}
	threadKey := h.conversationKey
	if threadKey == "" {
		threadKey = "qq:" + targetType + ":" + targetID
	}
	metadata := roles.MustJSON(map[string]any{
		"qq_target_type": targetType,
		"qq_target_id":   targetID,
		"qq_onebot_url":  h.oneBotURLForSelfID(anyToString(event.SelfID)),
		"qq_dedupe_key":  qqDedupeKey(event, content),
		"message_type":   event.MessageType,
		"group_id":       anyToString(event.GroupID),
		"user_id":        anyToString(event.UserID),
		"self_id":        anyToString(event.SelfID),
		"sub_type":       event.SubType,
	})

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, qqDedupeKey(event, content)); err != nil {
		return routeRecord{}, "", err
	}
	duplicate, err := h.isDuplicateQQMessage(ctx, tx, workspaceID, event, content)
	if err != nil {
		return routeRecord{}, "", err
	}
	if duplicate {
		return routeRecord{}, "duplicate qq message", nil
	}

	var threadID string
	if err := tx.QueryRow(ctx, `
INSERT INTO conversation_threads (workspace_id, channel, external_thread_key, title)
VALUES ($1::uuid, 'qq', $2, $3)
ON CONFLICT (workspace_id, channel, external_thread_key)
DO UPDATE SET updated_at = now()
RETURNING id::text`, workspaceID, threadKey, route.RoleTitle).Scan(&threadID); err != nil {
		return routeRecord{}, "", err
	}

	var messageID string
	if err := tx.QueryRow(ctx, `
INSERT INTO conversation_messages (
  thread_id, workspace_id, channel, sender_type, sender_id, content, external_message_id, metadata
) VALUES (
  $1::uuid, $2::uuid, 'qq', 'operator', $3, $4, $5, $6
)
RETURNING id::text`, threadID, workspaceID, operatorID, content, anyToString(event.MessageID), metadata).Scan(&messageID); err != nil {
		return routeRecord{}, "", err
	}

	result := roles.MustJSON(route)
	var invocationID string
	if err := tx.QueryRow(ctx, `
INSERT INTO role_invocations (
  workspace_id, role_id, message_id, channel, status, command_type, risk_level, requires_approval, result
) VALUES (
  $1::uuid, $2::uuid, $3::uuid, 'qq', 'routed', $4, $5, $6, $7
)
RETURNING id::text`, workspaceID, route.RoleID, messageID, route.CommandType, route.RiskLevel, route.RequiresApproval, result).Scan(&invocationID); err != nil {
		return routeRecord{}, "", err
	}

	actionStatus := "proposed"
	if route.RequiresApproval {
		actionStatus = "awaiting_approval"
	} else if h.autoApproveLowRisk && (route.RoleName == "builder" || route.RoleName == "tester") && route.RiskLevel == "low" {
		actionStatus = "approved"
	}
	var actionID string
	if err := tx.QueryRow(ctx, `
INSERT INTO role_actions (
  workspace_id, invocation_id, action_type, risk_level, requires_approval, payload, status
) VALUES (
  $1::uuid, $2::uuid, $3, $4, $5, $6, $7
)
RETURNING id::text`, workspaceID, invocationID, route.CommandType, route.RiskLevel, route.RequiresApproval, roles.MustJSON(roles.BuildActionContractPayload(roles.ActionContractInput{
		Content:     reqSafeContent(content),
		Channel:     "qq",
		RoleName:    route.RoleName,
		CommandType: route.CommandType,
		RiskLevel:   route.RiskLevel,
	})), actionStatus).Scan(&actionID); err != nil {
		return routeRecord{}, "", err
	}
	if route.RequiresApproval {
		if _, err := tx.Exec(ctx, `
INSERT INTO approval_requests (workspace_id, role_action_id, status, requested_by)
VALUES ($1::uuid, $2::uuid, 'awaiting_approval', $3)`, workspaceID, actionID, operatorID); err != nil {
			return routeRecord{}, "", err
		}
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO audit_events (workspace_id, actor_type, actor_id, event_type, target_type, target_id, metadata)
VALUES ($1::uuid, 'operator', $2, 'qq.message_routed', 'role_invocation', $3, $4)`,
		workspaceID, operatorID, invocationID, roles.MustJSON(map[string]any{"route": route, "action_status": actionStatus})); err != nil {
		return routeRecord{}, "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return routeRecord{}, "", err
	}
	return routeRecord{Route: route, InvocationID: invocationID, ActionID: actionID, ActionStatus: actionStatus}, "", nil
}

type duplicateQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (h *InboundHandler) isDuplicateQQMessage(ctx context.Context, q duplicateQuerier, workspaceID string, event oneBotMessageEvent, content string) (bool, error) {
	messageID := anyToString(event.MessageID)
	groupID := anyToString(event.GroupID)
	userID := anyToString(event.UserID)
	dedupeKey := qqDedupeKey(event, content)

	var existingID string
	err := q.QueryRow(ctx, `
SELECT id::text
FROM conversation_messages
WHERE workspace_id = $1::uuid
  AND channel = 'qq'
  AND (
    ($2 <> '' AND external_message_id = $2 AND metadata->>'group_id' = $3 AND metadata->>'user_id' = $4)
    OR
    ($5 <> '' AND metadata->>'qq_dedupe_key' = $5 AND created_at > now() - interval '5 minutes')
  )
LIMIT 1`, workspaceID, messageID, groupID, userID, dedupeKey).Scan(&existingID)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return false, err
}

func (h *InboundHandler) sendAck(ctx context.Context, event oneBotMessageEvent, record routeRecord) {
	oneBotURL := h.oneBotURLForSelfID(anyToString(event.SelfID))
	if oneBotURL == "" {
		return
	}
	message := "Mortis 已收到: " + record.Route.RoleTitle + " / " + record.ActionStatus
	targetType := event.MessageType
	targetID := anyToString(event.UserID)
	if event.MessageType == "group" {
		targetID = anyToString(event.GroupID)
	}
	if targetID == "" {
		return
	}
	_ = (&Notifier{client: h.client, oneBotURL: oneBotURL}).send(ctx, targetType, targetID, message)
}

func (h *InboundHandler) oneBotURLForSelfID(selfID string) string {
	if selfID != "" {
		if url := h.oneBotURLs[selfID]; url != "" {
			return url
		}
	}
	return h.oneBotURL
}

func extractMessageText(event oneBotMessageEvent) string {
	if strings.TrimSpace(event.RawMessage) != "" {
		return event.RawMessage
	}
	var parts []struct {
		Type string `json:"type"`
		Data struct {
			Text string `json:"text"`
		} `json:"data"`
	}
	if err := json.Unmarshal(event.Message, &parts); err == nil {
		var b strings.Builder
		for _, part := range parts {
			if part.Type == "text" {
				b.WriteString(part.Data.Text)
			}
		}
		return b.String()
	}
	var text string
	if err := json.Unmarshal(event.Message, &text); err == nil {
		return text
	}
	return ""
}

func anyToString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case float64:
		return strconv.FormatInt(int64(v), 10)
	case json.Number:
		return v.String()
	default:
		return strings.TrimSpace(strings.Trim(strings.TrimSpace(toJSON(v)), `"`))
	}
}

func toJSON(value any) string {
	b, _ := json.Marshal(value)
	return string(b)
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
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

func stringSet(values []string) map[string]bool {
	if len(values) == 0 {
		return nil
	}
	out := map[string]bool{}
	for _, value := range values {
		out[strings.TrimSpace(value)] = true
	}
	return out
}

func containsAnyInsensitive(value string, needles []string) bool {
	lower := strings.ToLower(value)
	for _, needle := range needles {
		if strings.Contains(lower, strings.ToLower(needle)) {
			return true
		}
	}
	return false
}

func getenvDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func firstLine(value string) string {
	value = strings.TrimSpace(value)
	if idx := strings.IndexByte(value, '\n'); idx >= 0 {
		value = value[:idx]
	}
	if len(value) > 120 {
		return value[:120]
	}
	return value
}

func reqSafeContent(value string) string {
	return strings.TrimSpace(value)
}

func qqDedupeKey(event oneBotMessageEvent, content string) string {
	targetType := event.MessageType
	targetID := anyToString(event.UserID)
	if event.MessageType == "group" {
		targetID = anyToString(event.GroupID)
	}
	parts := []string{
		targetType,
		targetID,
		anyToString(event.UserID),
		normalizeQQContent(content),
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(sum[:])
}

func normalizeQQContent(content string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(content)), " ")
}

func stripLeadingCQCodes(content string) string {
	content = strings.TrimSpace(content)
	for strings.HasPrefix(content, "[CQ:") {
		end := strings.Index(content, "]")
		if end < 0 {
			return content
		}
		content = strings.TrimSpace(content[end+1:])
	}
	return content
}

func writeBridgeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
