package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/qqagents"
)

type TelegramLivingMessageResponse struct {
	OK     bool                          `json:"ok"`
	Reply  OperatorEventReply            `json:"reply"`
	Living qqagents.TelegramLivingOutput `json:"living"`
}

func (h *Handler) IngestTelegramLivingMessage(w http.ResponseWriter, r *http.Request) {
	if !operatorGatewayAuthorized(r) {
		writeError(w, http.StatusUnauthorized, "telegram living gateway unauthorized")
		return
	}
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace is required")
		return
	}
	req, err := decodeTelegramLivingMessageRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	content := strings.TrimSpace(req.Message.Text)
	if content == "" {
		writeError(w, http.StatusBadRequest, "telegram message.text is required")
		return
	}
	chatID := telegramAnyString(req.Message.Chat.ID)
	actorID := telegramAnyString(req.Message.From.ID)
	if chatID == "" || actorID == "" {
		writeError(w, http.StatusBadRequest, "telegram chat.id and from.id are required")
		return
	}
	if ignored := telegramAllowed(chatID, actorID); ignored != "" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ignored": ignored})
		return
	}
	pool, _ := h.TxStarter.(*pgxpool.Pool)
	actorName := strings.TrimSpace(req.Message.From.DisplayName)
	if actorName == "" {
		actorName = strings.TrimSpace(strings.Join(nonEmptyStrings(req.Message.From.FirstName, req.Message.From.LastName), " "))
	}
	if actorName == "" {
		actorName = req.Message.From.Username
	}
	living, err := qqagents.GenerateTelegramLivingReply(r.Context(), pool, slog.Default(), qqagents.TelegramLivingInput{
		WorkspaceSlug: telegramWorkspaceSlug(r),
		ChatID:        chatID,
		ActorID:       actorID,
		ActorName:     actorName,
		MessageID:     telegramAnyString(req.Message.MessageID),
		Text:          content,
		RoleHint:      telegramRoleHint(req.Metadata),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate telegram living reply")
		return
	}
	writeJSON(w, http.StatusCreated, TelegramLivingMessageResponse{OK: true, Reply: OperatorEventReply{Channel: "telegram", Text: living.Text}, Living: living})
}

func decodeTelegramLivingMessageRequest(r *http.Request) (TelegramOperatorMessageRequest, error) {
	var req TelegramOperatorMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return TelegramOperatorMessageRequest{}, err
	}
	return req, nil
}

func telegramRoleHint(metadata map[string]any) string {
	if metadata == nil {
		return ""
	}
	value, _ := metadata["role_hint"].(string)
	return strings.TrimSpace(value)
}

func telegramWorkspaceSlug(r *http.Request) string {
	slug := strings.TrimSpace(r.URL.Query().Get("workspace_slug"))
	if slug == "" {
		slug = "mortis"
	}
	return slug
}
