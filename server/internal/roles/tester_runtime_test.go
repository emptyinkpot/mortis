package roles

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTesterRuntimeRunsVerificationWithoutChangingCheckout(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "action-1", "repo")
	if err := os.MkdirAll(filepath.Join(repo, ".git"), 0o755); err != nil {
		t.Fatalf("mkdir repo: %v", err)
	}
	runtime, err := NewTesterRuntime(TesterRuntimeConfig{
		WorkRoot: root,
		Runner: &recordingRunner{
			outputs: map[string]string{
				"git status --short":       "",
				"git log -1 --oneline":     "abc123 feat: done\n",
				"git status --short|cmd":   "",
				"git log -1 --oneline|cmd": "abc123 feat: done\n",
			},
		},
	})
	if err != nil {
		t.Fatalf("NewTesterRuntime returned error: %v", err)
	}
	report := runtime.Run(context.Background(), RuntimeIssue{
		ActionID:           "tester-action",
		InvocationID:       "tester-invocation",
		RoleName:           "tester",
		SourceWorkspace:    repo,
		SourceInvocationID: "builder-invocation",
		SourceCommitSHA:    "abc123",
		TestCommands:       []string{"git log -1 --oneline"},
	})
	if report.Status != ExecutionCompleted {
		t.Fatalf("expected completed report, got %#v", report)
	}
	if report.VerifiedFrom != "builder-invocation" {
		t.Fatalf("expected source invocation, got %q", report.VerifiedFrom)
	}
	if !strings.Contains(report.Logs, "abc123 feat: done") {
		t.Fatalf("expected command logs, got %q", report.Logs)
	}
	if report.VerificationEvidence == nil {
		t.Fatal("expected structured verification evidence")
	}
	if report.VerificationEvidence.LocalCommands.Status != "passed" {
		t.Fatalf("expected local commands passed, got %#v", report.VerificationEvidence.LocalCommands)
	}
	if report.VerificationEvidence.CI.Status != "missing" {
		t.Fatalf("expected missing CI evidence, got %#v", report.VerificationEvidence.CI)
	}
	if report.VerificationEvidence.ArtifactGraph.Status != "linked" {
		t.Fatalf("expected linked artifact graph, got %#v", report.VerificationEvidence.ArtifactGraph)
	}
}

func TestTesterRuntimeRecordsConfiguredWorldSources(t *testing.T) {
	runtime, err := NewTesterRuntime(TesterRuntimeConfig{
		CIStatusSource:   "github-actions:emptyinkpot/mortis-multica-source",
		StagingURL:       "https://staging.example.test",
		ObservabilityURL: "https://grafana.example.test",
	})
	if err != nil {
		t.Fatalf("NewTesterRuntime returned error: %v", err)
	}
	evidence := runtime.buildVerificationEvidence(RuntimeIssue{SourceInvocationID: "builder-invocation"}, "$ git status --short\n")
	if evidence.CI.Status != "configured" || evidence.CI.Source == "" {
		t.Fatalf("expected configured CI evidence source, got %#v", evidence.CI)
	}
	if evidence.Staging.Status != "configured" || evidence.Observability.Status != "configured" {
		t.Fatalf("expected configured world sources, got %#v", evidence)
	}
}

func TestTesterRuntimeBlocksOutsideWorkRoot(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.MkdirAll(filepath.Join(outside, ".git"), 0o755); err != nil {
		t.Fatalf("mkdir outside repo: %v", err)
	}
	runtime, err := NewTesterRuntime(TesterRuntimeConfig{WorkRoot: root, Runner: &recordingRunner{}})
	if err != nil {
		t.Fatalf("NewTesterRuntime returned error: %v", err)
	}
	report := runtime.Run(context.Background(), RuntimeIssue{
		ActionID:        "tester-action",
		InvocationID:    "tester-invocation",
		RoleName:        "tester",
		SourceWorkspace: outside,
	})
	if report.Status != ExecutionBlocked {
		t.Fatalf("expected blocked report, got %#v", report)
	}
}

type recordingRunner struct {
	outputs map[string]string
	calls   []string
}

func (r *recordingRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	key := name
	if len(args) > 0 {
		key += " " + strings.Join(args, " ")
	}
	r.calls = append(r.calls, key)
	return CommandOutput{Stdout: r.outputs[key]}, nil
}

func (r *recordingRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	r.calls = append(r.calls, command+"|cmd")
	return CommandOutput{Stdout: r.outputs[command+"|cmd"]}, nil
}

func TestTesterRuntimeClonesWorkspaceForDirectQQVerification(t *testing.T) {
	root := t.TempDir()
	runner := &recordingRunner{
		outputs: map[string]string{
			"git status --short":       "",
			"git log -1 --oneline":     "abc123 feat: route action\n",
			"git status --short|cmd":   "",
			"git log -1 --oneline|cmd": "abc123 feat: route action\n",
		},
	}
	runtime, err := NewTesterRuntime(TesterRuntimeConfig{
		RepoURL:  "file:///source",
		WorkRoot: root,
		Runner:   runner,
	})
	if err != nil {
		t.Fatalf("NewTesterRuntime returned error: %v", err)
	}

	report := runtime.Run(context.Background(), RuntimeIssue{
		ActionID:     "tester-direct",
		InvocationID: "tester-invocation",
		RoleName:     "tester",
		TestCommands: []string{"git log -1 --oneline"},
	})
	if report.Status != ExecutionCompleted {
		t.Fatalf("expected completed report, got %#v", report)
	}
	if !strings.Contains(report.WorkspaceDir, filepath.Join("tester-tester-direct", "repo")) {
		t.Fatalf("expected direct tester workspace, got %q", report.WorkspaceDir)
	}
	joined := strings.Join(runner.calls, "\n")
	if !strings.Contains(joined, "git clone --depth 1 --branch main file:///source") {
		t.Fatalf("expected clone call, got:\n%s", joined)
	}
}
