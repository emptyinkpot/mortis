package executiongateway

import (
	"context"
	"fmt"
	"log/slog"
)

type BrowserRunner interface {
	Run(ctx context.Context, req ExecutionRequest) (ExecutionResult, error)
}

type Service struct {
	logger  *slog.Logger
	browser BrowserRunner
}

func New(logger *slog.Logger, browser BrowserRunner) *Service {
	return &Service{
		logger:  logger,
		browser: browser,
	}
}

func (s *Service) Execute(ctx context.Context, req ExecutionRequest) (ExecutionResult, error) {
	switch req.Action {
	case ActionBrowserRun:
		return s.browser.Run(ctx, req)
	default:
		return ExecutionResult{
			OK:      false,
			Status:  "blocked",
			Action:  req.Action,
			Message: fmt.Sprintf("unsupported execution action: %s", req.Action),
		}, nil
	}
}
