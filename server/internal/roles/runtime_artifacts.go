package roles

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

func writeRuntimeArtifacts(root string, issue RuntimeIssue, report ExecutionReport, runner CommandRunner) error {
	if strings.TrimSpace(root) == "" {
		return nil
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(root, "execution.json"), append(raw, '\n'), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(root, "RUNLOG.md"), []byte(formatRunLog(issue, report)), 0o644); err != nil {
		return err
	}
	if runner != nil && strings.TrimSpace(report.WorkspaceDir) != "" && strings.TrimSpace(report.CommitSHA) != "" {
		if out, err := runner.Run(context.Background(), report.WorkspaceDir, "git", "show", "--format=", "--no-ext-diff", report.CommitSHA); err == nil {
			_ = os.WriteFile(filepath.Join(root, "diff.patch"), []byte(out.Stdout+out.Stderr), 0o644)
		}
	}
	return nil
}

func formatRunLog(issue RuntimeIssue, report ExecutionReport) string {
	var b strings.Builder
	b.WriteString("# Mortis Execution Runlog\n\n")
	writeRunLogLine(&b, "action_id", report.ActionID)
	writeRunLogLine(&b, "invocation_id", report.InvocationID)
	writeRunLogLine(&b, "runtime", report.Runtime)
	writeRunLogLine(&b, "status", string(report.Status))
	writeRunLogLine(&b, "workspace_dir", report.WorkspaceDir)
	writeRunLogLine(&b, "branch", report.BranchName)
	writeRunLogLine(&b, "commit", report.CommitSHA)
	writeRunLogLine(&b, "verified_from", report.VerifiedFrom)
	b.WriteString("\n## Task\n\n")
	writeRunLogLine(&b, "title", issue.Title)
	writeRunLogLine(&b, "objective", issue.Objective)
	if len(issue.AcceptanceCriteria) > 0 {
		b.WriteString("\n## Acceptance Criteria\n\n")
		for _, item := range issue.AcceptanceCriteria {
			if strings.TrimSpace(item) != "" {
				b.WriteString("- ")
				b.WriteString(strings.TrimSpace(item))
				b.WriteByte('\n')
			}
		}
	}
	if len(issue.TestCommands) > 0 {
		b.WriteString("\n## Test Commands\n\n")
		for _, command := range issue.TestCommands {
			if strings.TrimSpace(command) != "" {
				b.WriteString("- `")
				b.WriteString(strings.TrimSpace(command))
				b.WriteString("`\n")
			}
		}
	}
	if len(report.ChangedFiles) > 0 {
		b.WriteString("\n## Changed Files\n\n")
		for _, file := range report.ChangedFiles {
			b.WriteString("- ")
			b.WriteString(file)
			b.WriteByte('\n')
		}
	}
	if strings.TrimSpace(report.Error) != "" {
		b.WriteString("\n## Error\n\n")
		b.WriteString(report.Error)
		b.WriteByte('\n')
	}
	if strings.TrimSpace(report.Logs) != "" {
		b.WriteString("\n## Command Logs\n\n```text")
		b.WriteByte('\n')
		b.WriteString(report.Logs)
		if !strings.HasSuffix(report.Logs, "\n") {
			b.WriteByte('\n')
		}
		b.WriteString("```\n")
	}
	return b.String()
}

func writeRunLogLine(b *strings.Builder, key string, value string) {
	if strings.TrimSpace(value) == "" {
		return
	}
	b.WriteString("- ")
	b.WriteString(key)
	b.WriteString(": ")
	b.WriteString(value)
	b.WriteByte('\n')
}
