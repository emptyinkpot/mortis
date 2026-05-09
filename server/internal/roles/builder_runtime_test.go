package roles

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

type statusRunner struct {
	stdout string
}

func (r statusRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	return CommandOutput{Stdout: r.stdout}, nil
}

func (r statusRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	return CommandOutput{}, nil
}

type codexCommandRunner struct {
	command  string
	failures int
}

type commandCall struct {
	dir  string
	name string
	args []string
}

type recordingCommandRunner struct {
	calls []commandCall
	err   error
}

func (r *recordingCommandRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	r.calls = append(r.calls, commandCall{dir: dir, name: name, args: append([]string(nil), args...)})
	return CommandOutput{Stdout: "[repository-policy] OK\n"}, r.err
}

func (r *recordingCommandRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	return CommandOutput{}, nil
}

func (r *codexCommandRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	return CommandOutput{}, nil
}

func (r *codexCommandRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	r.command = command
	if r.failures > 0 {
		r.failures--
		return CommandOutput{Stderr: "provider 502"}, errors.New("sub2api 502 bad gateway")
	}
	return CommandOutput{}, nil
}

func TestGitChangedFilesIncludesUntrackedFiles(t *testing.T) {
	files, err := gitChangedFiles(context.Background(), statusRunner{stdout: " M README.md\n?? mortis-l3-proof.txt\nR  old.txt -> new.txt\n"}, ".")
	if err != nil {
		t.Fatalf("gitChangedFiles returned error: %v", err)
	}
	want := []string{"README.md", "mortis-l3-proof.txt", "new.txt"}
	if !reflect.DeepEqual(files, want) {
		t.Fatalf("unexpected changed files: got %v want %v", files, want)
	}
}

func TestBuildCodexPromptDefinesExecutionStationContract(t *testing.T) {
	prompt := buildCodexPrompt(RuntimeIssue{
		ActionID:           "abc123",
		Title:              "修复登录",
		Objective:          "修复登录失败",
		AcceptanceCriteria: []string{"能登录"},
		TestCommands:       []string{"go test ./internal/roles"},
	})
	for _, want := range []string{
		"private Codex execution station",
		"QQ is only the communication surface",
		"Required Worker Output",
		"Do not claim tests passed unless you actually ran them",
		"/srv/multica/agent-workspaces/action-<id>/repo",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to include %q, got:\n%s", want, prompt)
		}
	}
}

func TestBuilderRuntimePassesConfiguredCodexModel(t *testing.T) {
	root := t.TempDir()
	runner := &codexCommandRunner{}
	runtime, err := NewBuilderRuntime(BuilderRuntimeConfig{
		RepoURL:            "file:///source",
		WorkRoot:           root,
		CodexBin:           "codex",
		CodexModel:         "gpt-5.4",
		CodexTimeout:       1,
		CodexBypassSandbox: true,
		Runner:             runner,
	})
	if err != nil {
		t.Fatalf("NewBuilderRuntime returned error: %v", err)
	}

	logs, err := runtime.runCodex(context.Background(), root, root, RuntimeIssue{ActionID: "abc123"})
	if err != nil {
		t.Fatalf("runCodex returned error: %v", err)
	}
	if !strings.Contains(logs, "codex attempt 1") {
		t.Fatalf("expected codex attempt log, got %q", logs)
	}
	if !strings.Contains(runner.command, "'--model' 'gpt-5.4'") {
		t.Fatalf("expected model override in command, got %q", runner.command)
	}
	if !strings.Contains(runner.command, "'--dangerously-bypass-approvals-and-sandbox'") {
		t.Fatalf("expected bypass flag in command, got %q", runner.command)
	}
}

func TestBuilderRuntimeRetriesCodexExec(t *testing.T) {
	root := t.TempDir()
	runner := &codexCommandRunner{failures: 1}
	runtime, err := NewBuilderRuntime(BuilderRuntimeConfig{
		RepoURL:          "file:///source",
		WorkRoot:         root,
		CodexBin:         "codex",
		CodexTimeout:     time.Minute,
		CodexMaxAttempts: 2,
		CodexRetryDelay:  time.Millisecond,
		Runner:           runner,
	})
	if err != nil {
		t.Fatalf("NewBuilderRuntime returned error: %v", err)
	}

	logs, err := runtime.runCodex(context.Background(), root, root, RuntimeIssue{ActionID: "abc123"})
	if err != nil {
		t.Fatalf("runCodex returned error after retry: %v", err)
	}
	if !strings.Contains(logs, "provider 502") || !strings.Contains(logs, "codex attempt 2") {
		t.Fatalf("expected retry logs to include failure and second attempt, got %q", logs)
	}
	if runner.failures != 0 {
		t.Fatalf("expected retry to consume simulated failure, remaining %d", runner.failures)
	}
}

func TestBuilderRuntimeCanWrapCodexInWorkspaceContainer(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_BASE_URL", "https://example.invalid/v1")
	runtime, err := NewBuilderRuntime(BuilderRuntimeConfig{
		RepoURL:             "file:///source",
		CodexBin:            "codex",
		CodexContainerImage: "mortis-codex-worker:latest",
		CodexHome:           "/srv/multica/codex-home",
	})
	if err != nil {
		t.Fatalf("NewBuilderRuntime returned error: %v", err)
	}

	command := runtime.codexCommand("/srv/multica/agent-workspaces/action-abc", "/srv/multica/agent-workspaces/action-abc/builder-prompt.md", []string{"exec", "--model", "gpt-5.4", "-"})
	for _, want := range []string{
		"docker 'run' '--rm' '--network' 'host'",
		"'-v' '/srv/multica/agent-workspaces/action-abc:/workspace'",
		"'-e' 'OPENAI_API_KEY'",
		"'-e' 'OPENAI_BASE_URL'",
		"'-v' '/srv/multica/codex-home:/root/.codex'",
		"'-w' '/workspace/repo' 'mortis-codex-worker:latest' 'sh' '-lc'",
		"codex",
		"gpt-5.4",
		"/workspace/builder-prompt.md",
	} {
		if !strings.Contains(command, want) {
			t.Fatalf("expected container command to include %q, got %q", want, command)
		}
	}
}

func TestBuilderRuntimeRunsRepositoryPolicyPreflight(t *testing.T) {
	repoDir := t.TempDir()
	scriptDir := filepath.Join(repoDir, "scripts")
	if err := os.MkdirAll(scriptDir, 0o755); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}
	scriptPath := filepath.Join(scriptDir, "check-repository-policy.sh")
	if err := os.WriteFile(scriptPath, []byte("#!/usr/bin/env bash\necho ok\n"), 0o755); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	runner := &recordingCommandRunner{}
	runtime, err := NewBuilderRuntime(BuilderRuntimeConfig{RepoURL: "file:///source", Runner: runner})
	if err != nil {
		t.Fatalf("NewBuilderRuntime returned error: %v", err)
	}
	if err := runtime.runRepositoryPolicyPreflight(context.Background(), repoDir); err != nil {
		t.Fatalf("runRepositoryPolicyPreflight returned error: %v", err)
	}
	if len(runner.calls) != 1 {
		t.Fatalf("expected one command call, got %d", len(runner.calls))
	}
	call := runner.calls[0]
	if call.dir != repoDir || call.name != "bash" || len(call.args) != 1 || call.args[0] != scriptPath {
		t.Fatalf("unexpected preflight command: %#v", call)
	}
}

func TestBuilderRuntimeBlocksWhenRepositoryPolicyPreflightMissing(t *testing.T) {
	repoDir := t.TempDir()
	runtime, err := NewBuilderRuntime(BuilderRuntimeConfig{RepoURL: "file:///source", Runner: &recordingCommandRunner{}})
	if err != nil {
		t.Fatalf("NewBuilderRuntime returned error: %v", err)
	}
	err = runtime.runRepositoryPolicyPreflight(context.Background(), repoDir)
	if err == nil || !strings.Contains(err.Error(), "repository policy preflight missing") {
		t.Fatalf("expected missing preflight error, got %v", err)
	}
}
