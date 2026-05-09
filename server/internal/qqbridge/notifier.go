package qqbridge

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
	log         *slog.Logger
	pool        *pgxpool.Pool
	client      *http.Client
	oneBotURL   string
	interval    time.Duration
	defaultType string
	defaultID   string
}

type Config struct {
	Logger      *slog.Logger
	Pool        *pgxpool.Pool
	OneBotURL   string
	Interval    time.Duration
	DefaultType string
	DefaultID   string
}

type pendingNotification struct {
	InvocationID string
	WorkspaceID  string
	Status       string
	Runtime      string
	Title        string
	Body         string
	FinalSummary string
	TargetType   string
	TargetID     string
	OneBotURL    string
}

func StartNotifierFromEnv(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	if os.Getenv("MORTIS_QQ_NOTIFY_ENABLED") != "true" {
		return nil
	}
	interval := 5 * time.Second
	if raw := strings.TrimSpace(os.Getenv("MORTIS_QQ_NOTIFY_INTERVAL_SECONDS")); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			interval = time.Duration(seconds) * time.Second
		}
	}
	notifier, err := NewNotifier(Config{
		Logger:      log,
		Pool:        pool,
		OneBotURL:   os.Getenv("MORTIS_QQ_ONEBOT_HTTP_URL"),
		Interval:    interval,
		DefaultType: os.Getenv("MORTIS_QQ_NOTIFY_TARGET_TYPE"),
		DefaultID:   os.Getenv("MORTIS_QQ_NOTIFY_TARGET_ID"),
	})
	if err != nil {
		return err
	}
	go notifier.Run(ctx)
	return nil
}

func NewNotifier(cfg Config) (*Notifier, error) {
	if cfg.Pool == nil {
		return nil, errors.New("qq notifier requires database pool")
	}
	if strings.TrimSpace(cfg.OneBotURL) == "" {
		return nil, errors.New("qq notifier requires onebot http url")
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 5 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &Notifier{
		log:         cfg.Logger,
		pool:        cfg.Pool,
		client:      &http.Client{Timeout: 10 * time.Second},
		oneBotURL:   strings.TrimRight(strings.TrimSpace(cfg.OneBotURL), "/"),
		interval:    cfg.Interval,
		defaultType: normalizeTargetType(cfg.DefaultType),
		defaultID:   strings.TrimSpace(cfg.DefaultID),
	}, nil
}

func (n *Notifier) Run(ctx context.Context) {
	n.log.Info("starting qq completion notifier", "interval", n.interval)
	ticker := time.NewTicker(n.interval)
	defer ticker.Stop()
	for {
		if err := n.tick(ctx); err != nil {
			n.log.Error("qq notifier tick failed", "error", err)
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
		targetType, targetID := n.resolveTarget(item)
		if targetID == "" {
			if err := n.markSkipped(ctx, item.InvocationID, "missing qq target"); err != nil {
				return err
			}
			continue
		}
		oneBotURL := item.OneBotURL
		if oneBotURL == "" {
			oneBotURL = n.oneBotURL
		}
		if err := n.sendVia(ctx, oneBotURL, targetType, targetID, formatMessage(item)); err != nil {
			return err
		}
		if err := n.markSent(ctx, item.InvocationID, targetType, targetID, oneBotURL); err != nil {
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
  COALESCE(cm.metadata->>'qq_target_type', cm.metadata->>'message_type', '') AS target_type,
  COALESCE(cm.metadata->>'qq_target_id', cm.metadata->>'group_id', cm.metadata->>'user_id', '') AS target_id,
  COALESCE(cm.metadata->>'qq_onebot_url', '') AS onebot_url
FROM role_invocations ri
JOIN role_actions ra ON ra.invocation_id = ri.id
LEFT JOIN conversation_messages cm ON cm.id = ri.message_id
WHERE ri.status IN ('completed', 'failed', 'blocked')
  AND ri.result ? 'execution_report'
  AND NOT (ri.result ? 'qq_notified_at')
  AND NOT (ri.result ? 'qq_notify_skipped_at')
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
		if err := rows.Scan(&item.InvocationID, &item.WorkspaceID, &item.Status, &item.Title, &item.Runtime, &execErr, &commit, &branch, &changedFiles, &workspaceDir, &verifiedFrom, &logs, &ciStatus, &stagingStatus, &observabilityStatus, &artifactGraphStatus, &item.TargetType, &item.TargetID, &item.OneBotURL); err != nil {
			return nil, err
		}
		item.Body = buildBody(notificationBodyInput{
			Status:              item.Status,
			Runtime:             item.Runtime,
			Error:               execErr,
			Commit:              commit,
			Branch:              branch,
			ChangedFiles:        changedFiles,
			WorkspaceDir:        workspaceDir,
			VerifiedFrom:        verifiedFrom,
			Logs:                logs,
			CIStatus:            ciStatus,
			StagingStatus:       stagingStatus,
			ObservabilityStatus: observabilityStatus,
			ArtifactGraphStatus: artifactGraphStatus,
		})
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
	return buildFinalSummary(finalSummaryInput{
		BuilderStatus:      builderStatus,
		BuilderRuntime:     builderRuntime,
		Commit:             commit,
		Branch:             branch,
		ChangedFiles:       changedFiles,
		BuilderError:       builderError,
		BuilderLogs:        builderLogs,
		VerificationStatus: verificationStatus,
		VerificationLogs:   verificationLogs,
		VerificationError:  verificationError,
	}), nil
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

func (n *Notifier) resolveTarget(item pendingNotification) (string, string) {
	targetType := normalizeTargetType(item.TargetType)
	targetID := strings.TrimSpace(item.TargetID)
	if targetID == "" {
		targetType = n.defaultType
		targetID = n.defaultID
	}
	if targetType == "" {
		targetType = "group"
	}
	return targetType, targetID
}

func normalizeTargetType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "group", "group_id":
		return "group"
	case "private", "user", "user_id", "friend":
		return "private"
	default:
		return ""
	}
}

func formatMessage(item pendingNotification) string {
	heading := "Mortis 任务已完成"
	if strings.Contains(item.Runtime, "tester") {
		heading = "Mortis 验证已完成"
	}
	if item.Status != "completed" {
		heading = "Mortis 任务未完成"
		if strings.Contains(item.Runtime, "tester") {
			heading = "Mortis 验证未完成"
		}
	}
	if item.FinalSummary != "" {
		return fmt.Sprintf("%s\n\n%s\n\n%s\n\n%s", heading, item.Title, item.Body, item.FinalSummary)
	}
	return fmt.Sprintf("%s\n\n%s\n\n%s", heading, item.Title, item.Body)
}

func (n *Notifier) send(ctx context.Context, targetType string, targetID string, message string) error {
	return n.sendVia(ctx, n.oneBotURL, targetType, targetID, message)
}

func (n *Notifier) sendVia(ctx context.Context, oneBotURL string, targetType string, targetID string, message string) error {
	oneBotURL = strings.TrimRight(strings.TrimSpace(oneBotURL), "/")
	if oneBotURL == "" {
		return errors.New("onebot url is empty")
	}
	endpoint := "/send_group_msg"
	payload := map[string]string{"group_id": targetID, "message": message}
	if targetType == "private" {
		endpoint = "/send_private_msg"
		payload = map[string]string{"user_id": targetID, "message": message}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, oneBotURL+endpoint, bytes.NewReader(body))
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
		return fmt.Errorf("onebot send failed: status=%d body=%s", resp.StatusCode, string(responseBody))
	}
	return nil
}

func (n *Notifier) markSent(ctx context.Context, invocationID string, targetType string, targetID string, oneBotURL string) error {
	_, err := n.pool.Exec(ctx, `
UPDATE role_invocations
SET result = result || jsonb_build_object(
  'qq_notified_at', now(),
  'qq_notify_target_type', $2::text,
  'qq_notify_target_id', $3::text,
  'qq_notify_onebot_url', $4::text
), updated_at = now()
WHERE id = $1`, invocationID, targetType, targetID, oneBotURL)
	return err
}

func (n *Notifier) markSkipped(ctx context.Context, invocationID string, reason string) error {
	_, err := n.pool.Exec(ctx, `
UPDATE role_invocations
SET result = result || jsonb_build_object(
  'qq_notify_skipped_at', now(),
  'qq_notify_skip_reason', $2::text
), updated_at = now()
WHERE id = $1`, invocationID, reason)
	return err
}
