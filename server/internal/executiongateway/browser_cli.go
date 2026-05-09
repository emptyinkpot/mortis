package executiongateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
)

type BrowserCLIAdapter struct {
	logger      *slog.Logger
	multicaPath string
}

func NewBrowserCLIAdapter(logger *slog.Logger, multicaPath string) *BrowserCLIAdapter {
	return &BrowserCLIAdapter{
		logger:      logger,
		multicaPath: multicaPath,
	}
}

func (b *BrowserCLIAdapter) Run(ctx context.Context, req ExecutionRequest) (ExecutionResult, error) {
	if req.BrowserRun == nil {
		return ExecutionResult{
			OK:      false,
			Status:  "blocked",
			Action:  req.Action,
			Message: "browserRun payload is required",
		}, nil
	}

	payload := map[string]any{
		"purpose": req.Purpose,
		"url":     req.BrowserRun.URL,
		"expected": map[string]any{
			"allowlist":     req.BrowserRun.AllowedHosts,
			"expectedUrl":   req.BrowserRun.ExpectedURL,
			"titleContains": req.BrowserRun.TitleContains,
			"selector":      req.BrowserRun.Selector,
		},
		"actions":         req.BrowserRun.Actions,
		"closeOnComplete": !req.BrowserRun.KeepOpen,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return ExecutionResult{}, fmt.Errorf("marshal browser payload: %w", err)
	}

	cmd := exec.CommandContext(ctx, b.multicaPath, "browser", "run", "--request-file", "-")
	cmd.Stdin = bytes.NewReader(data)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	runErr := cmd.Run()
	rawStdout := bytes.TrimSpace(stdout.Bytes())
	rawStderr := strings.TrimSpace(stderr.String())

	if len(rawStdout) == 0 {
		if runErr != nil {
			return ExecutionResult{}, fmt.Errorf("browser CLI failed: %w; stderr: %s", runErr, rawStderr)
		}
		return ExecutionResult{}, fmt.Errorf("browser CLI returned empty output")
	}

	var raw map[string]any
	if err := json.Unmarshal(rawStdout, &raw); err != nil {
		return ExecutionResult{}, fmt.Errorf("decode browser CLI output: %w; stderr: %s", err, rawStderr)
	}

	artifacts := collectArtifacts(raw)
	return ApplyVerification(req, raw, artifacts)
}

func collectArtifacts(raw map[string]any) []Artifact {
	var artifacts []Artifact

	if opened, ok := raw["opened"].(map[string]any); ok {
		if path, _ := opened["lastScreenshot"].(string); path != "" {
			appendArtifact(&artifacts, path)
		}
	}

	if verified, ok := raw["verified"].(map[string]any); ok {
		if path, _ := verified["lastScreenshot"].(string); path != "" {
			appendArtifact(&artifacts, path)
		}
	}

	if closed, ok := raw["closed"].([]any); ok {
		for _, item := range closed {
			record, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if path, _ := record["lastScreenshot"].(string); path != "" {
				appendArtifact(&artifacts, path)
			}
		}
	}

	return artifacts
}

func appendArtifact(artifacts *[]Artifact, path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		return
	}

	*artifacts = append(*artifacts, Artifact{
		Kind: "screenshot",
		Path: path,
	})
}
