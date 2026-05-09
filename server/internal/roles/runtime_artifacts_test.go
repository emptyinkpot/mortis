package roles

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type artifactRunner struct{}

func (artifactRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	if name == "git" && strings.Join(args, " ") == "show --format= --no-ext-diff abc123" {
		return CommandOutput{Stdout: "diff --git a/file.txt b/file.txt\n"}, nil
	}
	return CommandOutput{}, nil
}

func (artifactRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	return CommandOutput{}, nil
}

func TestWriteRuntimeArtifactsCreatesReplayFiles(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "repo")
	if err := os.MkdirAll(repo, 0o755); err != nil {
		t.Fatalf("mkdir repo: %v", err)
	}
	report := ExecutionReport{
		ActionID:     "action-1",
		InvocationID: "invocation-1",
		Runtime:      "builder-local-codex",
		Status:       ExecutionCompleted,
		WorkspaceDir: repo,
		BranchName:   "mortis/action-1",
		CommitSHA:    "abc123",
		ChangedFiles: []string{"file.txt"},
		Logs:         "$ go test ./...\nok\n",
	}
	issue := RuntimeIssue{
		Title:              "fix bookshelf",
		Objective:          "repair feed ordering",
		AcceptanceCriteria: []string{"feed is stable"},
		TestCommands:       []string{"go test ./..."},
	}
	if err := writeRuntimeArtifacts(root, issue, report, artifactRunner{}); err != nil {
		t.Fatalf("writeRuntimeArtifacts returned error: %v", err)
	}
	for _, file := range []string{"execution.json", "RUNLOG.md", "diff.patch"} {
		if _, err := os.Stat(filepath.Join(root, file)); err != nil {
			t.Fatalf("expected %s: %v", file, err)
		}
	}
	runlog, err := os.ReadFile(filepath.Join(root, "RUNLOG.md"))
	if err != nil {
		t.Fatalf("read runlog: %v", err)
	}
	if !strings.Contains(string(runlog), "builder-local-codex") || !strings.Contains(string(runlog), "go test ./...") {
		t.Fatalf("runlog missing execution evidence:\n%s", runlog)
	}
	diff, err := os.ReadFile(filepath.Join(root, "diff.patch"))
	if err != nil {
		t.Fatalf("read diff: %v", err)
	}
	if !strings.Contains(string(diff), "diff --git") {
		t.Fatalf("diff artifact missing patch content:\n%s", diff)
	}
}
