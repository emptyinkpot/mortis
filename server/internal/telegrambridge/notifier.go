package telegrambridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Notifier struct {
	log           *slog.Logger
	pool          *pgxpool.Pool
	client        *http.Client
	botToken      string
	apiBaseURL    string
	interval      time.Duration
	defaultChatID string
}

type Config struct {
	Logger        *slog.Logger
	Pool          *pgxpool.Pool
	BotToken      string
	APIBaseURL    string
	Interval      time.Duration
	DefaultChatID string
}

type pendingNotification struct {
	InvocationID   string
	WorkspaceID    string
	Status         string
	Runtime        string
	Title          string
	Body           string
	FinalSummary   string
	TelegramChatID string
}

func StartNotifierFromEnv(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	if os.Getenv("MORTIS_TELEGRAM_NOTIFY_ENABLED") != "true" {
		return nil
	}
	if log == nil {
		log = slog.Default()
	}
	botToken := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	if botToken == "" {
		log.Warn("telegram completion notifier enabled but TELEGRAM_BOT_TOKEN is empty; notifier disabled")
		return nil
	}
	interval := 5 * time.Second
	if raw := strings.TrimSpace(os.Getenv("MORTIS_TELEGRAM_NOTIFY_INTERVAL_SECONDS")); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			interval = time.Duration(seconds) * time.Second
		}
	}
	notifier, err := NewNotifier(Config{
		Logger:        log,
		Pool:          pool,
		BotToken:      botToken,
		APIBaseURL:    os.Getenv("MORTIS_TELEGRAM_API_BASE_URL"),
		Interval:      interval,
		DefaultChatID: os.Getenv("MORTIS_TELEGRAM_NOTIFY_CHAT_ID"),
	})
	if err != nil {
		return err
	}
	go notifier.Run(ctx)
	return nil
}

func NewNotifier(cfg Config) (*Notifier, error) {
	if cfg.Pool == nil {
		return nil, errors.New("telegram notifier requires database pool")
	}
	if strings.TrimSpace(cfg.BotToken) == "" {
		return nil, errors.New("telegram notifier requires bot token")
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 5 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	apiBaseURL := strings.TrimRight(strings.TrimSpace(cfg.APIBaseURL), "/")
	if apiBaseURL == "" {
		apiBaseURL = "https://api.telegram.org"
	}
	return &Notifier{log: cfg.Logger, pool: cfg.Pool, client: &http.Client{Timeout: 10 * time.Second}, botToken: strings.TrimSpace(cfg.BotToken), apiBaseURL: apiBaseURL, interval: cfg.Interval, defaultChatID: strings.TrimSpace(cfg.DefaultChatID)}, nil
}

func (n *Notifier) Run(ctx context.Context) {
	n.log.Info("starting telegram completion notifier", "interval", n.interval)
	ticker := time.NewTicker(n.interval)
	defer ticker.Stop()
	for {
		if err := n.tick(ctx); err != nil {
			n.log.Error("telegram notifier tick failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (n *Notifier) tick(ctx context.Context) error {
	items, err := n.loadPending(ctx)
	if err != nil {
		return err
	}
	for _, item := range items {
		chatID := strings.TrimSpace(item.TelegramChatID)
		if chatID == "" {
			chatID = n.defaultChatID
		}
		if chatID == "" {
			if err := n.markSkipped(ctx, item.InvocationID, "missing telegram chat id"); err != nil {
				return err
			}
			continue
		}
		if err := n.send(ctx, chatID, formatMessage(item)); err != nil {
			return err
		}
		if err := n.markSent(ctx, item.InvocationID, chatID); err != nil {
			return err
		}
	}
	return nil
}

func (n *Notifier) loadPending(ctx context.Context) ([]pendingNotification, error) {
	rows, err := n.pool.Query(ctx, `
SELECT
  ri.id::text,
  ri.workspace_id::text,
  ri.status,
  COALESCE(ra.payload->>'title', ri.command_type) AS title,
  COALESCE(ri.result->'execution_report'->>'runtime', '') AS runtime,
  COALESCE(ri.result->'execution_report'->>'error', '') AS error,
  COALESCE(ri.result->'execution_report'->>'commit_sha', '') AS commit_sha,
  COALESCE(ri.result->'execution_report'->>'branch_name', '') AS branch_name,
  COALESCE((ri.result->'execution_report'->'changed_files')::text, '[]') AS changed_files,
  COALESCE(ri.result->'execution_report'->>'workspace_dir', '') AS workspace_dir,
  COALESCE(ri.result->'execution_report'->>'verified_from', '') AS verified_from,
  COALESCE(ri.result->'execution_report'->>'logs', '') AS logs,
  COALESCE(ri.result->'execution_report'->'verification_evidence'->'ci'->>'status', '') AS ci_status,
  COALESCE(ri.result->'execution_report'->'verification_evidence'->'staging'->>'status', '') AS staging_status,
  COALESCE(ri.result->'execution_report'->'verification_evidence'->'observability'->>'status', '') AS observability_status,
  COALESCE(ri.result->'execution_report'->'verification_evidence'->'artifact_graph'->>'status', '') AS artifact_graph_status,
  COALESCE(cm.metadata->>'telegram_chat_id', '') AS telegram_chat_id
FROM role_invocations ri
JOIN role_actions ra ON ra.invocation_id = ri.id
LEFT JOIN conversation_messages cm ON cm.id = ri.message_id
WHERE ri.channel = 'telegram'
  AND ri.status IN ('completed', 'failed', 'blocked')
  AND ri.result ? 'execution_report'
  AND NOT (ri.result ? 'telegram_notified_at')
  AND NOT (ri.result ? 'telegram_notify_skipped_at')
ORDER BY ri.updated_at ASC
LIMIT 20`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []pendingNotification
	for rows.Next() {
		var item pendingNotification
		var execErr, commit, branch, changedFiles, workspaceDir, verifiedFrom, logs, ciStatus, stagingStatus, observabilityStatus, artifactGraphStatus string
		if err := rows.Scan(&item.InvocationID, &item.WorkspaceID, &item.Status, &item.Title, &item.Runtime, &execErr, &commit, &branch, &changedFiles, &workspaceDir, &verifiedFrom, &logs, &ciStatus, &stagingStatus, &observabilityStatus, &artifactGraphStatus, &item.TelegramChatID); err != nil {
			return nil, err
		}
		item.Body = buildBody(notificationBodyInput{Status: item.Status, Runtime: item.Runtime, Error: execErr, Commit: commit, Branch: branch, ChangedFiles: changedFiles, WorkspaceDir: workspaceDir, VerifiedFrom: verifiedFrom, Logs: logs, CIStatus: ciStatus, StagingStatus: stagingStatus, ObservabilityStatus: observabilityStatus, ArtifactGraphStatus: artifactGraphStatus})
		if strings.Contains(item.Runtime, "tester") && verifiedFrom != "" {
			item.FinalSummary, _ = n.loadFinalSummary(ctx, verifiedFrom, item.Status, logs, execErr)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (n *Notifier) loadFinalSummary(ctx context.Context, builderInvocationID string, verificationStatus string, verificationLogs string, verificationError string) (string, error) {
	var builderStatus, builderRuntime, commit, branch, changedFiles, builderError, builderLogs string
	err := n.pool.QueryRow(ctx, `
SELECT
  ri.status,
  COALESCE(ri.result->'execution_report'->>'runtime', ''),
  COALESCE(ri.result->'execution_report'->>'commit_sha', ''),
  COALESCE(ri.result->'execution_report'->>'branch_name', ''),
  COALESCE((ri.result->'execution_report'->'changed_files')::text, '[]'),
  COALESCE(ri.result->'execution_report'->>'error', ''),
  COALESCE(ri.result->'execution_report'->>'logs', '')
FROM role_invocations ri
WHERE ri.id = $1::uuid`, builderInvocationID).Scan(&builderStatus, &builderRuntime, &commit, &branch, &changedFiles, &builderError, &builderLogs)
	if err != nil {
		return "", err
	}
	return buildFinalSummary(finalSummaryInput{BuilderStatus: builderStatus, BuilderRuntime: builderRuntime, Commit: commit, Branch: branch, ChangedFiles: changedFiles, BuilderError: builderError, BuilderLogs: builderLogs, VerificationStatus: verificationStatus, VerificationLogs: verificationLogs, VerificationError: verificationError}), nil
}

type finalSummaryInput struct {
	BuilderStatus      string
	BuilderRuntime     string
	Commit             string
	Branch             string
	ChangedFiles       string
	BuilderError       string
	BuilderLogs        string
	VerificationStatus string
	VerificationLogs   string
	VerificationError  string
}

func buildFinalSummary(input finalSummaryInput) string {
	var risks []string
	if input.BuilderError != "" {
		risks = append(risks, "实现阶段有错误："+input.BuilderError)
	}
	if input.VerificationError != "" {
		risks = append(risks, "验证阶段有错误："+input.VerificationError)
	}
	if input.VerificationStatus != "completed" {
		risks = append(risks, "验证未通过或未完成")
	}
	if input.Commit == "" {
		risks = append(risks, "没有 commit 证据")
	}
	if input.ChangedFiles == "" || input.ChangedFiles == "[]" {
		risks = append(risks, "没有 changed_files 证据")
	}
	if len(risks) == 0 {
		risks = append(risks, "暂无已知剩余风险；仍需按真实环境继续回归")
	}
	var b strings.Builder
	b.WriteString("CEO 最终汇总")
	b.WriteString("\n实现结果: ")
	b.WriteString(input.BuilderStatus)
	if input.BuilderRuntime != "" {
		b.WriteString(" / ")
		b.WriteString(input.BuilderRuntime)
	}
	if input.Commit != "" {
		b.WriteString("\ncommit: ")
		b.WriteString(input.Commit)
	}
	if input.Branch != "" {
		b.WriteString("\nbranch: ")
		b.WriteString(input.Branch)
	}
	if input.ChangedFiles != "" && input.ChangedFiles != "[]" {
		b.WriteString("\nchanged_files: ")
		b.WriteString(input.ChangedFiles)
	}
	if summary := summarizeLogs(input.BuilderLogs); summary != "" {
		b.WriteString("\n实现日志: ")
		b.WriteString(summary)
	}
	b.WriteString("\n验证结果: ")
	b.WriteString(input.VerificationStatus)
	if summary := summarizeLogs(input.VerificationLogs); summary != "" {
		b.WriteString("\n验证日志: ")
		b.WriteString(summary)
	}
	b.WriteString("\n剩余风险: ")
	b.WriteString(strings.Join(risks, "；"))
	return b.String()
}

type notificationBodyInput struct {
	Status              string
	Runtime             string
	Error               string
	Commit              string
	Branch              string
	ChangedFiles        string
	WorkspaceDir        string
	VerifiedFrom        string
	Logs                string
	CIStatus            string
	StagingStatus       string
	ObservabilityStatus string
	ArtifactGraphStatus string
}

func buildBody(input notificationBodyInput) string {
	var b strings.Builder
	b.WriteString("status: ")
	b.WriteString(input.Status)
	if input.Runtime != "" {
		b.WriteString("\nruntime: ")
		b.WriteString(input.Runtime)
	}
	if input.Commit != "" {
		b.WriteString("\ncommit: ")
		b.WriteString(input.Commit)
	}
	if input.Branch != "" {
		b.WriteString("\nbranch: ")
		b.WriteString(input.Branch)
	}
	if input.ChangedFiles != "" && input.ChangedFiles != "[]" {
		b.WriteString("\nchanged_files: ")
		b.WriteString(input.ChangedFiles)
	}
	if input.WorkspaceDir != "" {
		b.WriteString("\nworkspace: ")
		b.WriteString(input.WorkspaceDir)
	}
	if input.VerifiedFrom != "" {
		b.WriteString("\nverified_from: ")
		b.WriteString(input.VerifiedFrom)
	}
	if summary := summarizeLogs(input.Logs); summary != "" {
		b.WriteString("\nlogs: ")
		b.WriteString(summary)
	}
	if evidence := summarizeEvidenceStatuses(input); evidence != "" {
		b.WriteString("\nevidence: ")
		b.WriteString(evidence)
	}
	if input.Error != "" {
		b.WriteString("\nerror: ")
		b.WriteString(input.Error)
	}
	return b.String()
}

func summarizeEvidenceStatuses(input notificationBodyInput) string {
	parts := make([]string, 0, 4)
	appendStatus := func(label string, status string) {
		status = strings.TrimSpace(status)
		if status != "" {
			parts = append(parts, label+"="+status)
		}
	}
	appendStatus("ci", input.CIStatus)
	appendStatus("staging", input.StagingStatus)
	appendStatus("observability", input.ObservabilityStatus)
	appendStatus("artifact_graph", input.ArtifactGraphStatus)
	return strings.Join(parts, ", ")
}

func summarizeLogs(logs string) string {
	logs = strings.TrimSpace(logs)
	if logs == "" {
		return ""
	}
	lines := strings.Split(strings.ReplaceAll(logs, "\r\n", "\n"), "\n")
	kept := make([]string, 0, 4)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		kept = append(kept, line)
		if len(kept) >= 4 {
			break
		}
	}
	out := strings.Join(kept, " | ")
	runes := []rune(out)
	if len(runes) > 260 {
		return string(runes[:260]) + "..."
	}
	return out
}

func formatMessage(item pendingNotification) string {
	heading := "Mortis Telegram 任务已完成"
	if strings.Contains(item.Runtime, "tester") {
		heading = "Mortis Telegram 验证已完成"
	}
	if item.Status != "completed" {
		heading = "Mortis Telegram 任务未完成"
		if strings.Contains(item.Runtime, "tester") {
			heading = "Mortis Telegram 验证未完成"
		}
	}
	if item.FinalSummary != "" {
		return fmt.Sprintf("%s\n\n%s\n\n%s\n\n%s", heading, item.Title, item.Body, item.FinalSummary)
	}
	return fmt.Sprintf("%s\n\n%s\n\n%s", heading, item.Title, item.Body)
}

func (n *Notifier) send(ctx context.Context, chatID string, message string) error {
	payload := map[string]any{
		"chat_id":                  chatID,
		"text":                     message,
		"disable_web_page_preview": true,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", n.apiBaseURL, n.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("telegram sendMessage failed: status=%d body=%s", resp.StatusCode, string(responseBody))
	}
	return nil
}

func (n *Notifier) markSent(ctx context.Context, invocationID string, chatID string) error {
	_, err := n.pool.Exec(ctx, `
UPDATE role_invocations
SET result = result || jsonb_build_object(
  'telegram_notified_at', now(),
  'telegram_notify_chat_id', $2::text
), updated_at = now()
WHERE id = $1`, invocationID, chatID)
	return err
}

func (n *Notifier) markSkipped(ctx context.Context, invocationID string, reason string) error {
	_, err := n.pool.Exec(ctx, `
UPDATE role_invocations
SET result = result || jsonb_build_object(
  'telegram_notify_skipped_at', now(),
  'telegram_notify_skip_reason', $2::text
), updated_at = now()
WHERE id = $1`, invocationID, reason)
	return err
}
