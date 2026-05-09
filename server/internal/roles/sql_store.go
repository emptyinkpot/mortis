package roles

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SQLActionStore struct {
	pool *pgxpool.Pool
}

func NewSQLActionStore(pool *pgxpool.Pool) *SQLActionStore {
	return &SQLActionStore{pool: pool}
}

func (s *SQLActionStore) ClaimNextApprovedAction(ctx context.Context, roleNames []string) (*RuntimeIssue, error) {
	if len(roleNames) == 0 {
		return nil, nil
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
SELECT ra.id, ra.invocation_id, ra.workspace_id, r.name, ra.action_type, COALESCE(cm.content, ''), ra.payload
FROM role_actions ra
JOIN role_invocations ri ON ri.id = ra.invocation_id
JOIN roles r ON r.id = ri.role_id
LEFT JOIN conversation_messages cm ON cm.id = ri.message_id
WHERE ra.status = 'approved' AND r.name = ANY($1)
ORDER BY ra.created_at ASC
FOR UPDATE OF ra, ri SKIP LOCKED
LIMIT 1`, roleNames)

	issue, err := scanRuntimeIssue(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if _, err := tx.Exec(ctx, `UPDATE role_actions SET status = 'executed', updated_at = now() WHERE id = $1`, issue.ActionID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE role_invocations SET status = 'queued', updated_at = now() WHERE id = $1`, issue.InvocationID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO audit_events (workspace_id, actor_type, actor_id, event_type, target_type, target_id, metadata)
VALUES ($1, 'system', 'role-dispatcher', 'role.action_queued', 'role_action', $2, $3)`,
		issue.WorkspaceID, issue.ActionID, MustJSON(map[string]any{"role": issue.RoleName})); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &issue, nil
}

func (s *SQLActionStore) UpdateActionStatus(ctx context.Context, actionID string, invocationID string, status ExecutionStatus, note string) error {
	invocationStatus := "running"
	if status == ExecutionCompleted {
		invocationStatus = "completed"
	} else if status == ExecutionFailed {
		invocationStatus = "failed"
	} else if status == ExecutionBlocked {
		invocationStatus = "blocked"
	}
	_, err := s.pool.Exec(ctx, `
UPDATE role_invocations SET status = $1, updated_at = now() WHERE id = $2`, invocationStatus, invocationID)
	return err
}

func (s *SQLActionStore) SaveExecutionReport(ctx context.Context, report ExecutionReport) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
UPDATE role_invocations
SET result = result || $1::jsonb, updated_at = now()
WHERE id = $2::uuid`, MustJSON(map[string]any{"execution_report": report}), report.InvocationID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO conversation_messages (
  thread_id, workspace_id, channel, sender_type, sender_id, content, external_message_id, metadata
)
SELECT
  cm.thread_id,
  ri.workspace_id,
  ri.channel,
  'role',
  'manager',
  $2,
  '',
  $3::jsonb
FROM role_invocations ri
JOIN conversation_messages cm ON cm.id = ri.message_id
WHERE ri.id = $1::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM conversation_messages existing
    WHERE existing.thread_id = cm.thread_id
      AND existing.sender_type = 'role'
      AND existing.sender_id = 'manager'
      AND existing.metadata->>'execution_invocation_id' = $1::text
  )`, report.InvocationID, formatExecutionConversationMessage(report), MustJSON(map[string]any{
		"kind":                    "execution_report",
		"execution_invocation_id": report.InvocationID,
		"execution_action_id":     report.ActionID,
		"execution_status":        report.Status,
		"execution_report":        report,
	})); err != nil {
		return err
	}

	if err := insertStudioArtifacts(ctx, tx, report); err != nil {
		return err
	}
	if err := updateSourceArtifactsFromVerification(ctx, tx, report); err != nil {
		return err
	}
	if report.Status == ExecutionCompleted && report.Runtime == "builder-local-codex" {
		if err := enqueueTesterAction(ctx, tx, report); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func enqueueTesterAction(ctx context.Context, tx pgx.Tx, report ExecutionReport) error {
	if strings.TrimSpace(report.WorkspaceDir) == "" {
		return nil
	}
	payload := buildTesterVerificationPayload(report)
	_, err := tx.Exec(ctx, `
WITH source_invocation AS (
  SELECT workspace_id, message_id, channel
  FROM role_invocations
  WHERE id = $1::uuid
),
tester_role AS (
  SELECT r.id, r.workspace_id
  FROM roles r
  JOIN source_invocation si ON si.workspace_id = r.workspace_id
  WHERE r.name = 'tester'
  LIMIT 1
),
created_invocation AS (
  INSERT INTO role_invocations (
    workspace_id, role_id, message_id, channel, status, command_type, risk_level, requires_approval, result
  )
  SELECT
    tr.workspace_id,
    tr.id,
    si.message_id,
    si.channel,
    'queued',
    'verification',
    'low',
    false,
    $3::jsonb
  FROM tester_role tr
  JOIN source_invocation si ON si.workspace_id = tr.workspace_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM role_invocations existing
    JOIN role_actions existing_action ON existing_action.invocation_id = existing.id
    WHERE existing.workspace_id = tr.workspace_id
      AND existing.result->>'source_invocation_id' = $1::text
      AND existing_action.action_type = 'verification'
  )
  RETURNING id, workspace_id
)
INSERT INTO role_actions (
  workspace_id, invocation_id, action_type, risk_level, requires_approval, payload, status
)
SELECT
  workspace_id,
  id,
  'verification',
  'low',
  false,
  $2::jsonb,
  'approved'
FROM created_invocation`,
		report.InvocationID,
		MustJSON(payload),
		MustJSON(map[string]any{
			"source_action_id":     report.ActionID,
			"source_invocation_id": report.InvocationID,
			"source_runtime":       report.Runtime,
		}),
	)
	return err
}

func buildTesterVerificationPayload(report ExecutionReport) map[string]any {
	return map[string]any{
		"title":       "Verify Builder action " + report.ActionID,
		"objective":   "Independently verify Builder output and write a verification_report artifact.",
		"context":     "Builder completed action " + report.ActionID,
		"branch_name": report.BranchName,
		"action_contract": map[string]any{
			"action_type":          "verification",
			"owner":                "tester",
			"repo":                 "mortis",
			"branch":               report.BranchName,
			"objective":            "Verify Builder commit " + report.CommitSHA,
			"acceptance":           []string{"真实运行测试命令", "不得修改 worker checkout", "输出 passed/failed/blocked 证据"},
			"commands":             []string{"git status --short", "git log -1 --oneline"},
			"risk_level":           "low",
			"artifact_required":    true,
			"artifact_types":       []string{"verification_report"},
			"status":               "approved",
			"source_action_id":     report.ActionID,
			"source_invocation_id": report.InvocationID,
			"source_runtime":       report.Runtime,
			"source_workspace":     report.WorkspaceDir,
			"source_commit_sha":    report.CommitSHA,
		},
	}
}

func insertStudioArtifacts(ctx context.Context, tx pgx.Tx, report ExecutionReport) error {
	producer := artifactProducer(report.Runtime)
	if report.CommitSHA != "" && producer == "builder" {
		if _, err := tx.Exec(ctx, `
INSERT INTO studio_artifacts (
  workspace_id, role_action_id, invocation_id, artifact_type, title, uri, status, produced_by, verification_status, metadata
)
SELECT
  ri.workspace_id,
  ra.id,
  ri.id,
  'commit',
  'Builder commit',
  $3,
  'created',
  $6,
  $4,
  $5::jsonb
FROM role_invocations ri
JOIN role_actions ra ON ra.invocation_id = ri.id
WHERE ri.id = $1::uuid AND ra.id = $2::uuid`,
			report.InvocationID,
			report.ActionID,
			report.CommitSHA,
			string(report.Status),
			MustJSON(map[string]any{
				"branch":        report.BranchName,
				"changed_files": report.ChangedFiles,
				"runtime":       report.Runtime,
			}),
			producer,
		); err != nil {
			return err
		}
	}
	if shouldInsertEvidenceArtifact(report, producer) {
		status := "created"
		if report.Status == ExecutionFailed || report.Status == ExecutionBlocked {
			status = "failed"
		}
		artifactType := "test_report"
		title := "Builder test report"
		if producer == "tester" {
			artifactType = "verification_report"
			title = "Tester verification report"
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO studio_artifacts (
  workspace_id, role_action_id, invocation_id, artifact_type, title, uri, status, produced_by, verification_status, metadata
)
SELECT
  ri.workspace_id,
  ra.id,
  ri.id,
  $6,
  $7,
  '',
  $3,
  $8,
  $4,
  $5::jsonb
FROM role_invocations ri
JOIN role_actions ra ON ra.invocation_id = ri.id
WHERE ri.id = $1::uuid AND ra.id = $2::uuid`,
			report.InvocationID,
			report.ActionID,
			status,
			string(report.Status),
			MustJSON(map[string]any{
				"logs":                  report.Logs,
				"runtime":               report.Runtime,
				"error":                 report.Error,
				"workspace_dir":         report.WorkspaceDir,
				"verified_from":         report.VerifiedFrom,
				"verification_evidence": report.VerificationEvidence,
			}),
			artifactType,
			title,
			producer,
		); err != nil {
			return err
		}
	}
	return nil
}

func shouldInsertEvidenceArtifact(report ExecutionReport, producer string) bool {
	if strings.TrimSpace(report.Logs) != "" || strings.TrimSpace(report.Error) != "" {
		return true
	}
	return producer == "tester"
}

func updateSourceArtifactsFromVerification(ctx context.Context, tx pgx.Tx, report ExecutionReport) error {
	if artifactProducer(report.Runtime) != "tester" || strings.TrimSpace(report.VerifiedFrom) == "" {
		return nil
	}
	status := "verified"
	if report.Status == ExecutionFailed {
		status = "failed"
	} else if report.Status == ExecutionBlocked {
		status = "blocked"
	}
	_, err := tx.Exec(ctx, `
UPDATE studio_artifacts
SET status = $2,
    verification_status = $3,
    metadata = metadata || jsonb_build_object(
      'verification_invocation_id', $4::text,
      'verification_action_id', $5::text,
      'verification_runtime', $6::text,
      'verification_error', $7::text
    ),
    updated_at = now()
WHERE invocation_id = $1::uuid
  AND produced_by = 'builder'
  AND artifact_type IN ('commit', 'test_report')`,
		report.VerifiedFrom,
		status,
		string(report.Status),
		report.InvocationID,
		report.ActionID,
		report.Runtime,
		report.Error,
	)
	return err
}

func artifactProducer(runtime string) string {
	if strings.Contains(runtime, "tester") {
		return "tester"
	}
	return "builder"
}

func formatExecutionConversationMessage(report ExecutionReport) string {
	var b strings.Builder
	if report.Status == ExecutionCompleted {
		b.WriteString("CEO / Manager AI: 任务完成。")
	} else {
		b.WriteString("CEO / Manager AI: 任务未完成。")
	}
	b.WriteString("\nAction: ")
	b.WriteString(report.ActionID)
	b.WriteString("\nInvocation: ")
	b.WriteString(report.InvocationID)
	b.WriteString("\nStatus: ")
	b.WriteString(string(report.Status))
	if report.CommitSHA != "" {
		b.WriteString("\nCommit: ")
		b.WriteString(report.CommitSHA)
	}
	if report.BranchName != "" {
		b.WriteString("\nBranch: ")
		b.WriteString(report.BranchName)
	}
	if len(report.ChangedFiles) > 0 {
		b.WriteString("\nChanged: ")
		b.WriteString(strings.Join(report.ChangedFiles, ", "))
	}
	if report.Error != "" {
		b.WriteString("\nError: ")
		b.WriteString(report.Error)
	}
	return b.String()
}

func scanRuntimeIssue(row pgx.Row) (RuntimeIssue, error) {
	var issue RuntimeIssue
	var actionType string
	var content string
	var payload json.RawMessage
	if err := row.Scan(&issue.ActionID, &issue.InvocationID, &issue.WorkspaceID, &issue.RoleName, &actionType, &content, &payload); err != nil {
		return issue, err
	}
	issue.Title = actionType
	issue.Objective = content
	issue.Context = string(payload)

	var decoded struct {
		Title              string   `json:"title"`
		Objective          string   `json:"objective"`
		Context            string   `json:"context"`
		AcceptanceCriteria []string `json:"acceptance_criteria"`
		TestCommands       []string `json:"test_commands"`
		BranchName         string   `json:"branch_name"`
		SourceActionID     string   `json:"source_action_id"`
		SourceInvocationID string   `json:"source_invocation_id"`
		SourceRuntime      string   `json:"source_runtime"`
		SourceWorkspace    string   `json:"source_workspace"`
		SourceCommitSHA    string   `json:"source_commit_sha"`
		ActionContract     struct {
			ActionType         string   `json:"action_type"`
			Owner              string   `json:"owner"`
			Repo               string   `json:"repo"`
			Branch             string   `json:"branch"`
			Objective          string   `json:"objective"`
			Acceptance         []string `json:"acceptance"`
			Commands           []string `json:"commands"`
			RiskLevel          string   `json:"risk_level"`
			ArtifactRequired   bool     `json:"artifact_required"`
			ArtifactTypes      []string `json:"artifact_types"`
			Status             string   `json:"status"`
			SourceActionID     string   `json:"source_action_id"`
			SourceInvocationID string   `json:"source_invocation_id"`
			SourceRuntime      string   `json:"source_runtime"`
			SourceWorkspace    string   `json:"source_workspace"`
			SourceCommitSHA    string   `json:"source_commit_sha"`
		} `json:"action_contract"`
	}
	if err := json.Unmarshal(payload, &decoded); err == nil {
		if decoded.Title != "" {
			issue.Title = decoded.Title
		}
		if decoded.Objective != "" {
			issue.Objective = decoded.Objective
		}
		if decoded.Context != "" {
			issue.Context = decoded.Context
		}
		issue.AcceptanceCriteria = decoded.AcceptanceCriteria
		issue.TestCommands = decoded.TestCommands
		issue.BranchName = decoded.BranchName
		issue.SourceActionID = decoded.SourceActionID
		issue.SourceInvocationID = decoded.SourceInvocationID
		issue.SourceRuntime = decoded.SourceRuntime
		issue.SourceWorkspace = decoded.SourceWorkspace
		issue.SourceCommitSHA = decoded.SourceCommitSHA
		if decoded.ActionContract.Objective != "" {
			issue.Objective = decoded.ActionContract.Objective
		}
		if len(decoded.ActionContract.Acceptance) > 0 {
			issue.AcceptanceCriteria = decoded.ActionContract.Acceptance
		}
		if len(decoded.ActionContract.Commands) > 0 {
			issue.TestCommands = decoded.ActionContract.Commands
		}
		if decoded.ActionContract.Branch != "" {
			issue.BranchName = decoded.ActionContract.Branch
		}
		if decoded.ActionContract.SourceActionID != "" {
			issue.SourceActionID = decoded.ActionContract.SourceActionID
		}
		if decoded.ActionContract.SourceInvocationID != "" {
			issue.SourceInvocationID = decoded.ActionContract.SourceInvocationID
		}
		if decoded.ActionContract.SourceRuntime != "" {
			issue.SourceRuntime = decoded.ActionContract.SourceRuntime
		}
		if decoded.ActionContract.SourceWorkspace != "" {
			issue.SourceWorkspace = decoded.ActionContract.SourceWorkspace
		}
		if decoded.ActionContract.SourceCommitSHA != "" {
			issue.SourceCommitSHA = decoded.ActionContract.SourceCommitSHA
		}
	}
	if len(issue.TestCommands) == 0 {
		issue.TestCommands = extractInlineTestCommands(issue.Objective)
	}
	return issue, nil
}

func extractInlineTestCommands(content string) []string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		for _, prefix := range []string{"test command:", "test commands:", "测试命令：", "测试命令:"} {
			if strings.HasPrefix(lower, prefix) {
				command := strings.TrimSpace(trimmed[len(prefix):])
				if command != "" {
					return []string{command}
				}
			}
		}
	}
	return nil
}
