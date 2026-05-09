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

type TesterRuntime struct {
	log              *slog.Logger
	repoURL          string
	baseBranch       string
	workRoot         string
	gitUser          string
	gitEmail         string
	testTimeout      time.Duration
	ciStatusSource   string
	stagingURL       string
	observabilityURL string
	runner           CommandRunner
}

type TesterRuntimeConfig struct {
	Logger           *slog.Logger
	RepoURL          string
	BaseBranch       string
	WorkRoot         string
	GitUser          string
	GitEmail         string
	TestTimeout      time.Duration
	CIStatusSource   string
	StagingURL       string
	ObservabilityURL string
	Runner           CommandRunner
}

func NewTesterRuntime(cfg TesterRuntimeConfig) (*TesterRuntime, error) {
	if cfg.WorkRoot == "" {
		cfg.WorkRoot = "/srv/multica/agent-workspaces"
	}
	if cfg.BaseBranch == "" {
		cfg.BaseBranch = "main"
	}
	if cfg.GitUser == "" {
		cfg.GitUser = "Mortis Tester AI"
	}
	if cfg.GitEmail == "" {
		cfg.GitEmail = "tester@mortis.local"
	}
	if cfg.TestTimeout <= 0 {
		cfg.TestTimeout = 15 * time.Minute
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	if cfg.Runner == nil {
		cfg.Runner = LocalCommandRunner{}
	}
	return &TesterRuntime{
		log:              cfg.Logger,
		repoURL:          cfg.RepoURL,
		baseBranch:       cfg.BaseBranch,
		workRoot:         cfg.WorkRoot,
		gitUser:          cfg.GitUser,
		gitEmail:         cfg.GitEmail,
		testTimeout:      cfg.TestTimeout,
		ciStatusSource:   strings.TrimSpace(cfg.CIStatusSource),
		stagingURL:       strings.TrimSpace(cfg.StagingURL),
		observabilityURL: strings.TrimSpace(cfg.ObservabilityURL),
		runner:           cfg.Runner,
	}, nil
}

func (t *TesterRuntime) Name() string { return "tester-local-verifier" }

func (t *TesterRuntime) CanRun(issue RuntimeIssue) bool {
	return issue.RoleName == "tester"
}

func (t *TesterRuntime) Run(ctx context.Context, issue RuntimeIssue) ExecutionReport {
	report := ExecutionReport{
		ActionID:     issue.ActionID,
		InvocationID: issue.InvocationID,
		Runtime:      t.Name(),
		BranchName:   issue.BranchName,
		CommitSHA:    issue.SourceCommitSHA,
		WorkspaceDir: issue.SourceWorkspace,
		VerifiedFrom: firstNonEmptyRoleValue(issue.SourceInvocationID, issue.SourceActionID),
		StartedAt:    time.Now(),
	}
	repoDir, err := t.prepareVerificationWorkspace(ctx, issue)
	if err != nil {
		return report.fail(ExecutionBlocked, err)
	}
	report.WorkspaceDir = repoDir
	defer func() {
		if err := writeRuntimeArtifacts(filepath.Dir(repoDir), issue, report, t.runner); err != nil {
			t.log.Warn("write tester runtime artifacts failed", "action_id", issue.ActionID, "error", err)
		}
	}()
	before, err := t.runner.Run(ctx, repoDir, "git", "status", "--short")
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	runCtx, cancel := context.WithTimeout(ctx, t.testTimeout)
	defer cancel()
	logs, err := t.runVerificationCommands(runCtx, repoDir, issue)
	report.Logs = logs
	report.VerificationEvidence = t.buildVerificationEvidence(issue, logs)
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	after, err := t.runner.Run(ctx, repoDir, "git", "status", "--short")
	if err != nil {
		return report.fail(ExecutionFailed, err)
	}
	if strings.TrimSpace(before.Stdout) != strings.TrimSpace(after.Stdout) {
		report.Logs += "\n$ git status --short\n" + after.Stdout + after.Stderr
		return report.fail(ExecutionBlocked, errors.New("tester verification modified the worker checkout"))
	}
	report.Status = ExecutionCompleted
	report.FinishedAt = time.Now()
	return report
}

func (t *TesterRuntime) buildVerificationEvidence(issue RuntimeIssue, logs string) *VerificationEvidence {
	localStatus := "passed"
	localSummary := "contract commands completed"
	if strings.TrimSpace(logs) == "" {
		localStatus = "missing"
		localSummary = "no local command output was produced"
	}
	artifactSource := firstNonEmptyRoleValue(issue.SourceInvocationID, issue.SourceActionID)
	artifactStatus := "linked"
	artifactSummary := "Builder source invocation/action was preserved for verification graph"
	if artifactSource == "" {
		artifactStatus = "missing"
		artifactSummary = "no Builder source invocation/action was provided"
	}
	return &VerificationEvidence{
		LocalCommands: EvidenceCheck{Status: localStatus, Source: "tester-local-verifier", Summary: localSummary},
		CI:            configuredOrMissing(t.ciStatusSource, "CI provider/status source is not configured"),
		Staging:       configuredOrMissing(t.stagingURL, "staging environment URL is not configured"),
		Observability: configuredOrMissing(t.observabilityURL, "log/monitoring read source is not configured"),
		ArtifactGraph: EvidenceCheck{Status: artifactStatus, Source: artifactSource, Summary: artifactSummary},
	}
}

func configuredOrMissing(source string, missingSummary string) EvidenceCheck {
	if strings.TrimSpace(source) == "" {
		return EvidenceCheck{Status: "missing", Summary: missingSummary}
	}
	return EvidenceCheck{Status: "configured", Source: strings.TrimSpace(source), Summary: "source configured; reader integration pending"}
}

func (t *TesterRuntime) prepareVerificationWorkspace(ctx context.Context, issue RuntimeIssue) (string, error) {
	if strings.TrimSpace(issue.SourceWorkspace) != "" {
		return t.validateWorkspace(issue.SourceWorkspace)
	}
	if strings.TrimSpace(t.repoURL) == "" {
		return "", errors.New("tester source workspace is empty and repo url is not configured")
	}
	safeID := sanitizeForPath(issue.ActionID)
	root := filepath.Join(t.workRoot, "tester-"+safeID)
	repoDir := filepath.Join(root, "repo")
	if err := os.RemoveAll(root); err != nil {
		return "", err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return "", err
	}
	if _, err := t.runner.Run(ctx, root, "git", "clone", "--depth", "1", "--branch", t.baseBranch, t.repoURL, repoDir); err != nil {
		return "", err
	}
	if _, err := t.runner.Run(ctx, repoDir, "git", "config", "user.name", t.gitUser); err != nil {
		return "", err
	}
	if _, err := t.runner.Run(ctx, repoDir, "git", "config", "user.email", t.gitEmail); err != nil {
		return "", err
	}
	return repoDir, nil
}

func (t *TesterRuntime) validateWorkspace(path string) (string, error) {
	root, err := filepath.Abs(t.workRoot)
	if err != nil {
		return "", err
	}
	repoDir, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(root, repoDir)
	if err != nil {
		return "", err
	}
	if rel == "." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || rel == ".." {
		return "", fmt.Errorf("tester source workspace %q is outside work root %q", repoDir, root)
	}
	if info, err := os.Stat(filepath.Join(repoDir, ".git")); err != nil || !info.IsDir() {
		return "", fmt.Errorf("tester source workspace %q is not a git checkout", repoDir)
	}
	return repoDir, nil
}

func (t *TesterRuntime) runVerificationCommands(ctx context.Context, repoDir string, issue RuntimeIssue) (string, error) {
	commands := issue.TestCommands
	if len(commands) == 0 {
		commands = []string{"git status --short", "git log -1 --oneline"}
	}
	var logs strings.Builder
	for _, command := range commands {
		command = strings.TrimSpace(command)
		if command == "" {
			continue
		}
		out, err := t.runner.RunShell(ctx, repoDir, command)
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

func firstNonEmptyRoleValue(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
