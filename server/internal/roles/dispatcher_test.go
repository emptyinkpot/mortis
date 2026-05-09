package roles

import (
	"context"
	"testing"
	"time"
)

type fakeActionStore struct {
	issue        *RuntimeIssue
	statuses     []ExecutionStatus
	savedReports []ExecutionReport
}

func (s *fakeActionStore) ClaimNextApprovedAction(ctx context.Context, roleNames []string) (*RuntimeIssue, error) {
	if s.issue == nil {
		return nil, nil
	}
	issue := *s.issue
	s.issue = nil
	return &issue, nil
}

func (s *fakeActionStore) UpdateActionStatus(ctx context.Context, actionID string, invocationID string, status ExecutionStatus, note string) error {
	s.statuses = append(s.statuses, status)
	return nil
}

func (s *fakeActionStore) SaveExecutionReport(ctx context.Context, report ExecutionReport) error {
	s.savedReports = append(s.savedReports, report)
	return nil
}

type fakeRuntime struct {
	role   string
	report ExecutionReport
}

func (r fakeRuntime) Name() string { return "fake-builder" }

func (r fakeRuntime) CanRun(issue RuntimeIssue) bool {
	role := r.role
	if role == "" {
		role = "builder"
	}
	return issue.RoleName == role
}

func (r fakeRuntime) Run(ctx context.Context, issue RuntimeIssue) ExecutionReport {
	report := r.report
	report.ActionID = issue.ActionID
	report.InvocationID = issue.InvocationID
	report.Runtime = r.Name()
	return report
}

func TestDispatcherRunsApprovedTesterAction(t *testing.T) {
	store := &fakeActionStore{issue: &RuntimeIssue{
		ActionID:     "action-test",
		InvocationID: "invocation-test",
		RoleName:     "tester",
		Title:        "verify change",
	}}
	dispatcher, err := NewDispatcher(DispatcherConfig{
		Store: store,
		Runtimes: []AgentRuntime{fakeRuntime{role: "tester", report: ExecutionReport{
			Status:     ExecutionCompleted,
			StartedAt:  time.Now(),
			FinishedAt: time.Now(),
		}}},
		StopAfter: 1,
	})
	if err != nil {
		t.Fatalf("NewDispatcher returned error: %v", err)
	}
	if err := dispatcher.Run(context.Background()); err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if len(store.savedReports) != 1 {
		t.Fatalf("expected one saved report, got %d", len(store.savedReports))
	}
}

func TestDispatcherRunsApprovedBuilderAction(t *testing.T) {
	store := &fakeActionStore{issue: &RuntimeIssue{
		ActionID:     "action-1",
		InvocationID: "invocation-1",
		RoleName:     "builder",
		Title:        "small change",
	}}
	dispatcher, err := NewDispatcher(DispatcherConfig{
		Store: store,
		Runtimes: []AgentRuntime{fakeRuntime{report: ExecutionReport{
			Status:     ExecutionCompleted,
			BranchName: "mortis/action-1",
			CommitSHA:  "abc123",
			StartedAt:  time.Now(),
			FinishedAt: time.Now(),
		}}},
		StopAfter: 1,
	})
	if err != nil {
		t.Fatalf("NewDispatcher returned error: %v", err)
	}
	if err := dispatcher.Run(context.Background()); err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if len(store.savedReports) != 1 {
		t.Fatalf("expected one saved report, got %d", len(store.savedReports))
	}
	if got, want := store.statuses, []ExecutionStatus{ExecutionRunning, ExecutionCompleted}; len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("unexpected status sequence: got %v want %v", got, want)
	}
}

func TestExtractInlineTestCommands(t *testing.T) {
	got := extractInlineTestCommands("do work\nTest command: git diff --check")
	if len(got) != 1 || got[0] != "git diff --check" {
		t.Fatalf("extractInlineTestCommands returned %#v", got)
	}
}
