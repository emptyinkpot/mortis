package roles

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type BuilderRuntime struct {
	log                 *slog.Logger
	repoURL             string
	baseBranch          string
	workRoot            string
	codexBin            string
	codexModel          string
	codexTimeout        time.Duration
	codexMaxAttempts    int
	codexRetryDelay     time.Duration
	codexContainerImage string
	codexHome           string
	codexBypassSandbox  bool
	gitUser             string
	gitEmail            string
	runner              CommandRunner
}

type BuilderRuntimeConfig struct {
	Logger              *slog.Logger
	RepoURL             string
	BaseBranch          string
	WorkRoot            string
	CodexBin            string
	CodexModel          string
	CodexTimeout        time.Duration
	CodexMaxAttempts    int
	CodexRetryDelay     time.Duration
	CodexContainerImage string
	CodexHome           string
	CodexBypassSandbox  bool
	GitUser             string
	GitEmail            string
	Runner              CommandRunner
}

func NewBuilderRuntime(cfg BuilderRuntimeConfig) (*BuilderRuntime, error) {
	if cfg.RepoURL == "" {
		return nil, errors.New("builder runtime requires repo url")
	}
	if cfg.BaseBranch == "" {
		cfg.BaseBranch = "main"
	}
	if cfg.WorkRoot == "" {
		cfg.WorkRoot = "/srv/multica/agent-workspaces"
	}
	if cfg.CodexBin == "" {
		cfg.CodexBin = "codex"
	}
	if cfg.CodexTimeout <= 0 {
		cfg.CodexTimeout = 15 * time.Minute
	}
	if cfg.CodexMaxAttempts <= 0 {
		cfg.CodexMaxAttempts = 2
	}
	if cfg.CodexRetryDelay <= 0 {
		cfg.CodexRetryDelay = 5 * time.Second
	}
	if cfg.GitUser == "" {
		cfg.GitUser = "Mortis Builder AI"
	}
	if cfg.GitEmail == "" {
		cfg.GitEmail = "builder@mortis.local"
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	if cfg.Runner == nil {
		cfg.Runner = LocalCommandRunner{}
	}
	return &BuilderRuntime{log: cfg.Logger, repoURL: cfg.RepoURL, baseBranch: cfg.BaseBranch, workRoot: cfg.WorkRoot, codexBin: cfg.CodexBin, codexModel: strings.TrimSpace(cfg.CodexModel), codexTimeout: cfg.CodexTimeout, codexMaxAttempts: cfg.CodexMaxAttempts, codexRetryDelay: cfg.CodexRetryDelay, codexContainerImage: strings.TrimSpace(cfg.CodexContainerImage), codexHome: strings.TrimSpace(cfg.CodexHome), codexBypassSandbox: cfg.CodexBypassSandbox, gitUser: cfg.GitUser, gitEmail: cfg.GitEmail, runner: cfg.Runner}, nil
}

func (b *BuilderRuntime) Name() string { return "builder-local-codex" }

func (b *BuilderRuntime) CanRun(issue RuntimeIssue) bool {
	return issue.RoleName == "builder"
}

func (b *BuilderRuntime) Run(ctx context.Context, issue RuntimeIssue) ExecutionReport {
	report := ExecutionReport{ActionID: issue.ActionID, InvocationID: issue.InvocationID, Runtime: b.Name(), StartedAt: time.Now()}
	workspace, err := b.prepareWorkspace(ctx, issue)
	if err != nil {
		return report.fail(ExecutionBlocked, err)
	}
	defer func() {
		if err := writeRuntimeArtifacts(workspace.Root, issue, report, b.runner); err != nil {
			b.log.Warn("write builder runtime artifacts failed", "action_id", issue.ActionID, "error", err)
		}
	}()
	report.BranchName = workspace.Branch
	report.WorkspaceDir = workspace.RepoDir
	if err := b.runRepositoryPolicyPreflight(ctx, workspace.RepoDir); err != nil {
		return report.fail(ExecutionBlocked, err)
	}
	codexLogs, err := b.runCodex(ctx, workspace.Root, workspace.RepoDir, issue)
	report.Logs = codexLogs
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	changedFiles, err := gitChangedFiles(ctx, b.runner, workspace.RepoDir)
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	if len(changedFiles) == 0 {
		return report.fail(ExecutionBlocked, errors.New("builder produced no file changes"))
	}
	report.ChangedFiles = changedFiles
	commitSHA, err := b.commitChanges(ctx, workspace.RepoDir, issue)
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	report.CommitSHA = commitSHA
	logs, err := b.runSmokeTests(ctx, workspace.RepoDir, issue)
	report.Logs = logs
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	report.Status = ExecutionCompleted
	report.FinishedAt = time.Now()
	return report
}

type GitWorkspace struct {
	Root    string
	RepoDir string
	Branch  string
}

func (b *BuilderRuntime) prepareWorkspace(ctx context.Context, issue RuntimeIssue) (GitWorkspace, error) {
	safeID := sanitizeForPath(issue.ActionID)
	root := filepath.Join(b.workRoot, "action-"+safeID)
	repoDir := filepath.Join(root, "repo")
	branch := issue.BranchName
	if branch == "" {
		branch = "mortis/action-" + safeID
	}
	if err := os.RemoveAll(root); err != nil {
		return GitWorkspace{}, err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return GitWorkspace{}, err
	}
	if _, err := b.runner.Run(ctx, root, "git", "clone", "--depth", "1", "--branch", b.baseBranch, b.repoURL, repoDir); err != nil {
		return GitWorkspace{}, err
	}
	if _, err := b.runner.Run(ctx, repoDir, "git", "checkout", "-b", branch); err != nil {
		return GitWorkspace{}, err
	}
	if _, err := b.runner.Run(ctx, repoDir, "git", "config", "user.name", b.gitUser); err != nil {
		return GitWorkspace{}, err
	}
	if _, err := b.runner.Run(ctx, repoDir, "git", "config", "user.email", b.gitEmail); err != nil {
		return GitWorkspace{}, err
	}
	return GitWorkspace{Root: root, RepoDir: repoDir, Branch: branch}, nil
}

func (b *BuilderRuntime) runRepositoryPolicyPreflight(ctx context.Context, repoDir string) error {
	scriptPath := filepath.Join(repoDir, "scripts", "check-repository-policy.sh")
	if _, err := os.Stat(scriptPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("repository policy preflight missing: %s", scriptPath)
		}
		return err
	}
	out, err := b.runner.Run(ctx, repoDir, "bash", scriptPath)
	if err != nil {
		return fmt.Errorf("repository policy preflight failed: %w", err)
	}
	b.log.Info("builder repository policy preflight passed", "stdout", strings.TrimSpace(out.Stdout), "stderr", strings.TrimSpace(out.Stderr))
	return nil
}

func (b *BuilderRuntime) runCodex(ctx context.Context, workspaceRoot string, repoDir string, issue RuntimeIssue) (string, error) {
	promptPath := filepath.Join(workspaceRoot, "builder-prompt.md")
	if err := os.WriteFile(promptPath, []byte(buildCodexPrompt(issue)), 0o644); err != nil {
		return "", err
	}
	runCtx, cancel := context.WithTimeout(ctx, b.codexTimeout)
	defer cancel()

	args := []string{"exec"}
	if b.codexBypassSandbox {
		args = append(args, "--dangerously-bypass-approvals-and-sandbox")
	} else {
		args = append(args, "--sandbox", "workspace-write")
	}
	if b.codexModel != "" {
		args = append(args, "--model", b.codexModel)
	}
	args = append(args, "-")
	command := b.codexCommand(workspaceRoot, promptPath, args)

	attempts := b.codexMaxAttempts
	if attempts < 1 {
		attempts = 1
	}
	var failures []string
	var logs []string
	for attempt := 1; attempt <= attempts; attempt++ {
		out, err := b.runner.RunShell(runCtx, repoDir, command)
		logs = append(logs, formatCommandLog("codex attempt "+fmt.Sprint(attempt), out))
		if err == nil {
			return strings.Join(logs, "\n"), nil
		}
		failures = append(failures, fmt.Sprintf("attempt %d/%d: %v", attempt, attempts, err))
		b.log.Warn("builder codex exec failed", "action_id", issue.ActionID, "attempt", attempt, "max_attempts", attempts, "error", err)
		if attempt < attempts {
			select {
			case <-runCtx.Done():
				return strings.Join(logs, "\n"), fmt.Errorf("codex exec failed before retry: %w; failures: %s", runCtx.Err(), strings.Join(failures, "\n"))
			case <-time.After(time.Duration(attempt) * b.codexRetryDelay):
			}
		}
	}
	return strings.Join(logs, "\n"), fmt.Errorf("codex exec failed after %d attempt(s):\n%s", attempts, strings.Join(failures, "\n"))
}

func formatCommandLog(label string, out CommandOutput) string {
	var b strings.Builder
	b.WriteString("$ ")
	b.WriteString(label)
	if strings.TrimSpace(out.Stdout) != "" {
		b.WriteString("\nstdout:\n")
		b.WriteString(strings.TrimSpace(out.Stdout))
	}
	if strings.TrimSpace(out.Stderr) != "" {
		b.WriteString("\nstderr:\n")
		b.WriteString(strings.TrimSpace(out.Stderr))
	}
	return b.String()
}

func (b *BuilderRuntime) codexCommand(workspaceRoot string, promptPath string, args []string) string {
	inputPath := promptPath
	if b.codexContainerImage != "" {
		if rel, err := filepath.Rel(workspaceRoot, promptPath); err == nil && rel != "." && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel) {
			inputPath = filepath.ToSlash(filepath.Join("/workspace", rel))
		}
	}
	baseCommand := fmt.Sprintf("%s %s < %s", shellQuote(b.codexBin), shellQuoteArgs(args), shellQuote(inputPath))
	if b.codexContainerImage == "" {
		return baseCommand
	}

	dockerArgs := []string{"run", "--rm", "--network", "host", "-v", workspaceRoot + ":/workspace"}
	for _, key := range builderContainerEnvKeys() {
		if value := os.Getenv(key); value != "" {
			dockerArgs = append(dockerArgs, "-e", key)
		}
	}
	if b.codexHome != "" {
		dockerArgs = append(dockerArgs, "-v", b.codexHome+":/root/.codex")
	}
	dockerArgs = append(dockerArgs, "-w", "/workspace/repo", b.codexContainerImage, "sh", "-lc", baseCommand)
	return fmt.Sprintf("docker %s", shellQuoteArgs(dockerArgs))
}

func builderContainerEnvKeys() []string {
	return []string{
		"OPENAI_API_KEY",
		"OPENAI_BASE_URL",
		"OPENAI_ORG_ID",
		"ANTHROPIC_API_KEY",
		"GOOGLE_API_KEY",
		"GEMINI_API_KEY",
		"CODEX_HOME",
		"CODEX_CONFIG_HOME",
	}
}

func buildCodexPrompt(issue RuntimeIssue) string {
	return fmt.Sprintf(`# Mortis Builder AI Task

You are Builder AI. Execute exactly this approved role action and do not expand scope.
You are the private Codex execution station behind the QQ Builder persona. QQ is only the communication surface; this worker must do the real repository work.

Action ID: %s
Title: %s

## Objective
%s

## Context
%s

## Acceptance Criteria
%s

## Required Test Commands
%s

## Required Worker Output
- Make real file changes in this checkout only.
- Leave a git diff suitable for commit.
- Keep notes concise in terminal output: changed files, tests run, and any blocker.
- If blocked, stop and explain the concrete missing permission/address/tool instead of guessing.

## Rules
- Keep the change minimal.
- Do not deploy.
- Do not modify secrets.
- Do not rewrite unrelated files.
- Do not push directly to main.
- Do not claim tests passed unless you actually ran them.
- Do not ask where the production repo/work root is: this checkout is already the worker repo cloned under /srv/multica/agent-workspaces/action-<id>/repo.
- After editing, stop. Tester AI will independently verify.
`, issue.ActionID, issue.Title, issue.Objective, issue.Context, bulletList(issue.AcceptanceCriteria), bulletList(issue.TestCommands))
}

func (b *BuilderRuntime) commitChanges(ctx context.Context, repoDir string, issue RuntimeIssue) (string, error) {
	if _, err := b.runner.Run(ctx, repoDir, "git", "add", "-A"); err != nil {
		return "", err
	}
	message := fmt.Sprintf("feat: %s", strings.TrimSpace(issue.Title))
	if strings.TrimSpace(issue.Title) == "" {
		message = fmt.Sprintf("feat(roles): execute action %s", issue.ActionID)
	}
	if _, err := b.runner.Run(ctx, repoDir, "git", "commit", "-m", message); err != nil {
		return "", err
	}
	out, err := b.runner.Run(ctx, repoDir, "git", "rev-parse", "HEAD")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Stdout), nil
}

func (b *BuilderRuntime) runSmokeTests(ctx context.Context, repoDir string, issue RuntimeIssue) (string, error) {
	commands := issue.TestCommands
	if len(commands) == 0 {
		commands = []string{"git diff --check HEAD"}
	}
	var logs strings.Builder
	for _, command := range commands {
		command = strings.TrimSpace(command)
		if command == "" {
			continue
		}
		out, err := b.runner.RunShell(ctx, repoDir, command)
		logs.WriteString("\n$ ")
		logs.WriteString(command)
		logs.WriteString("\n")
		logs.WriteString(out.Stdout)
		logs.WriteString(out.Stderr)
		if err != nil {
			return logs.String(), err
		}
	}
	return logs.String(), nil
}

func gitChangedFiles(ctx context.Context, runner CommandRunner, repoDir string) ([]string, error) {
	out, err := runner.Run(ctx, repoDir, "git", "status", "--short")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(out.Stdout, "\n")
	files := make([]string, 0, len(lines))
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}
		file := strings.TrimSpace(line[3:])
		if renamed := strings.LastIndex(file, " -> "); renamed >= 0 {
			file = file[renamed+4:]
		}
		if file != "" {
			files = append(files, file)
		}
	}
	return files, nil
}

func sanitizeForPath(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
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
		return fmt.Sprintf("action-%d", time.Now().UnixNano())
	}
	return out
}

func bulletList(items []string) string {
	if len(items) == 0 {
		return "- none provided"
	}
	var b strings.Builder
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		b.WriteString("- ")
		b.WriteString(item)
		b.WriteByte('\n')
	}
	return b.String()
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func shellQuoteArgs(values []string) string {
	quoted := make([]string, 0, len(values))
	for _, value := range values {
		quoted = append(quoted, shellQuote(value))
	}
	return strings.Join(quoted, " ")
}
