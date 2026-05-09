package roles

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

type ActionStore interface {
	ClaimNextApprovedAction(ctx context.Context, roleNames []string) (*RuntimeIssue, error)
	UpdateActionStatus(ctx context.Context, actionID string, invocationID string, status ExecutionStatus, note string) error
	SaveExecutionReport(ctx context.Context, report ExecutionReport) error
}

type AgentRuntime interface {
	Name() string
	CanRun(issue RuntimeIssue) bool
	Run(ctx context.Context, issue RuntimeIssue) ExecutionReport
}

type Dispatcher struct {
	log       *slog.Logger
	store     ActionStore
	runtimes  []AgentRuntime
	interval  time.Duration
	stopAfter int
}

type DispatcherConfig struct {
	Logger    *slog.Logger
	Store     ActionStore
	Runtimes  []AgentRuntime
	Interval  time.Duration
	StopAfter int
}

func NewDispatcher(cfg DispatcherConfig) (*Dispatcher, error) {
	if cfg.Store == nil {
		return nil, errors.New("dispatcher requires store")
	}
	if len(cfg.Runtimes) == 0 {
		return nil, errors.New("dispatcher requires at least one runtime")
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 2 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &Dispatcher{log: cfg.Logger, store: cfg.Store, runtimes: cfg.Runtimes, interval: cfg.Interval, stopAfter: cfg.StopAfter}, nil
}

func (d *Dispatcher) Run(ctx context.Context) error {
	ticker := time.NewTicker(d.interval)
	defer ticker.Stop()
	iterations := 0
	for {
		if d.stopAfter > 0 && iterations >= d.stopAfter {
			return nil
		}
		iterations++
		if err := d.tick(ctx); err != nil {
			d.log.Error("role dispatcher tick failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (d *Dispatcher) tick(ctx context.Context) error {
	issue, err := d.store.ClaimNextApprovedAction(ctx, d.runnableRoleNames())
	if err != nil || issue == nil {
		return err
	}
	runtime := d.pickRuntime(*issue)
	if runtime == nil {
		return d.store.UpdateActionStatus(ctx, issue.ActionID, issue.InvocationID, ExecutionBlocked, "no runtime can run this action")
	}
	if err := d.store.UpdateActionStatus(ctx, issue.ActionID, issue.InvocationID, ExecutionRunning, "claimed by "+runtime.Name()); err != nil {
		return err
	}
	report := runtime.Run(ctx, *issue)
	if report.Status == "" {
		report.Status = ExecutionFailed
		report.Error = "runtime returned empty status"
	}
	if err := d.store.SaveExecutionReport(ctx, report); err != nil {
		d.log.Error("failed to save role execution report", "action_id", issue.ActionID, "error", err)
	}
	return d.store.UpdateActionStatus(ctx, issue.ActionID, issue.InvocationID, report.Status, summarizeExecutionReport(report))
}

func (d *Dispatcher) runnableRoleNames() []string {
	seen := map[string]bool{}
	var roles []string
	for _, runtime := range d.runtimes {
		for _, role := range []string{"builder", "tester"} {
			if seen[role] {
				continue
			}
			if runtime.CanRun(RuntimeIssue{RoleName: role}) {
				seen[role] = true
				roles = append(roles, role)
			}
		}
	}
	return roles
}

func (d *Dispatcher) pickRuntime(issue RuntimeIssue) AgentRuntime {
	for _, runtime := range d.runtimes {
		if runtime.CanRun(issue) {
			return runtime
		}
	}
	return nil
}

func summarizeExecutionReport(report ExecutionReport) string {
	if report.Error != "" {
		return report.Error
	}
	if report.CommitSHA != "" {
		return fmt.Sprintf("branch=%s commit=%s", report.BranchName, report.CommitSHA)
	}
	return fmt.Sprintf("status=%s", report.Status)
}
