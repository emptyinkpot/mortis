package roles

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestBuildTesterVerificationPayloadPreservesBuilderEvidence(t *testing.T) {
	report := ExecutionReport{
		ActionID:     "builder-action",
		InvocationID: "builder-invocation",
		Runtime:      "builder-local-codex",
		Status:       ExecutionCompleted,
		BranchName:   "mortis/action-builder-action",
		CommitSHA:    "abc123",
		WorkspaceDir: "/srv/multica/agent-workspaces/action-builder-action/repo",
	}
	payload := buildTesterVerificationPayload(report)

	contract, ok := payload["action_contract"].(map[string]any)
	if !ok {
		t.Fatalf("missing action_contract: %#v", payload)
	}
	for key, want := range map[string]string{
		"owner":                "tester",
		"branch":               report.BranchName,
		"source_action_id":     report.ActionID,
		"source_invocation_id": report.InvocationID,
		"source_runtime":       report.Runtime,
		"source_workspace":     report.WorkspaceDir,
		"source_commit_sha":    report.CommitSHA,
	} {
		if got := contract[key]; got != want {
			t.Fatalf("contract[%s] = %#v, want %q", key, got, want)
		}
	}
	commands, ok := contract["commands"].([]string)
	if !ok || len(commands) == 0 {
		t.Fatalf("expected tester commands, got %#v", contract["commands"])
	}
}

func TestScanRuntimeIssueReadsTesterHandoffPayload(t *testing.T) {
	payload := buildTesterVerificationPayload(ExecutionReport{
		ActionID:     "builder-action",
		InvocationID: "builder-invocation",
		Runtime:      "builder-local-codex",
		BranchName:   "mortis/action-builder-action",
		CommitSHA:    "abc123",
		WorkspaceDir: "/srv/multica/agent-workspaces/action-builder-action/repo",
	})
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	row := fakeRuntimeIssueRow{
		values: []any{
			"tester-action",
			"tester-invocation",
			"workspace-1",
			"tester",
			"verification",
			"verify this",
			json.RawMessage(raw),
		},
	}
	issue, err := scanRuntimeIssue(row)
	if err != nil {
		t.Fatalf("scanRuntimeIssue returned error: %v", err)
	}
	if issue.RoleName != "tester" {
		t.Fatalf("role = %q, want tester", issue.RoleName)
	}
	if issue.BranchName != "mortis/action-builder-action" {
		t.Fatalf("branch = %q", issue.BranchName)
	}
	if issue.SourceActionID != "builder-action" || issue.SourceInvocationID != "builder-invocation" {
		t.Fatalf("source ids not preserved: %#v", issue)
	}
	if issue.SourceWorkspace != "/srv/multica/agent-workspaces/action-builder-action/repo" {
		t.Fatalf("source workspace = %q", issue.SourceWorkspace)
	}
	if issue.SourceCommitSHA != "abc123" {
		t.Fatalf("source commit = %q", issue.SourceCommitSHA)
	}
	if len(issue.TestCommands) == 0 {
		t.Fatalf("expected test commands from contract: %#v", issue)
	}
}

func TestTesterReportDoesNotCreateCommitArtifact(t *testing.T) {
	report := ExecutionReport{
		ActionID:      "tester-action",
		InvocationID:  "tester-invocation",
		Runtime:       "tester-local-verifier",
		Status:        ExecutionCompleted,
		CommitSHA:     "abc123",
		VerifiedFrom:  "builder-invocation",
		WorkspaceDir:  "/srv/multica/agent-workspaces/action-builder/repo",
		Logs:          "$ git status --short\n$ git log -1 --oneline\nabc123 feat",
	}
	if got := artifactProducer(report.Runtime); got != "tester" {
		t.Fatalf("artifactProducer = %q, want tester", got)
	}
	if !shouldInsertEvidenceArtifact(report, "tester") {
		t.Fatal("expected tester report to create verification evidence artifact")
	}
}

func TestUpdateSourceArtifactsFromVerificationIgnoresBuilderReports(t *testing.T) {
	if err := updateSourceArtifactsFromVerification(context.Background(), fakeTx{}, ExecutionReport{
		Runtime:      "builder-local-codex",
		VerifiedFrom: "builder-invocation",
	}); err != nil {
		t.Fatalf("builder report should not update source artifacts: %v", err)
	}
}

type fakeRuntimeIssueRow struct {
	values []any
}

func (r fakeRuntimeIssueRow) Scan(dest ...any) error {
	if len(dest) != len(r.values) {
		return pgx.ErrNoRows
	}
	for i := range dest {
		switch d := dest[i].(type) {
		case *string:
			*d = r.values[i].(string)
		case *json.RawMessage:
			*d = r.values[i].(json.RawMessage)
		default:
			return pgx.ErrNoRows
		}
	}
	return nil
}

type fakeTx struct {
	pgx.Tx
}
