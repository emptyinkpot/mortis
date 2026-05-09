package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	neturl "net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/multica-ai/multica/server/internal/cli"
)

type browserRunRequest struct {
	TaskID          string                 `json:"taskId,omitempty"`
	Purpose         string                 `json:"purpose,omitempty"`
	URL             string                 `json:"url"`
	Expected        browserExpectedRequest `json:"expected,omitempty"`
	Actions         []map[string]any       `json:"actions,omitempty"`
	CloseOnComplete bool                   `json:"closeOnComplete"`
}

type browserExpectedRequest struct {
	Allowlist     []string `json:"allowlist,omitempty"`
	ExpectedURL   string   `json:"expectedUrl,omitempty"`
	TitleContains string   `json:"titleContains,omitempty"`
	Selector      string   `json:"selector,omitempty"`
}

type browserGatewayContext struct {
	Execution browserExecutionTask `json:"execution"`
}

type browserExecutionTask struct {
	Action       string                     `json:"action"`
	Purpose      string                     `json:"purpose,omitempty"`
	Verification browserVerificationRequest `json:"verification"`
	BrowserRun   browserGatewayRunRequest   `json:"browserRun"`
}

type browserVerificationRequest struct {
	RequireArtifact bool   `json:"requireArtifact"`
	RequireVerified bool   `json:"requireVerified"`
	RequiredLevel   string `json:"requiredLevel"`
}

type browserGatewayRunRequest struct {
	URL           string           `json:"url"`
	AllowedHosts  []string         `json:"allowedHosts,omitempty"`
	ExpectedURL   string           `json:"expectedUrl,omitempty"`
	TitleContains string           `json:"titleContains,omitempty"`
	Selector      string           `json:"selector,omitempty"`
	Actions       []map[string]any `json:"actions,omitempty"`
	KeepOpen      bool             `json:"keepOpen"`
}

var browserCmd = &cobra.Command{
	Use:   "browser",
	Short: "Drive the local browser-manager runtime",
}

var browserEnqueueCmd = &cobra.Command{
	Use:   "enqueue",
	Short: "Create an agent issue that runs browser.run through the execution gateway",
	Args:  exactArgs(0),
	RunE:  runBrowserEnqueue,
}

var browserRunCmd = &cobra.Command{
	Use:   "run",
	Short: "Run one local browser task through browser-manager",
	Long: "Launch a local Edge/Chrome session through the repo-managed browser-manager, verify the page, optionally execute actions, and return JSON output.\n" +
		"This is intended to be callable from daemon tasks as a single local runtime tool.",
	Args: exactArgs(0),
	RunE: runBrowserRun,
}

func init() {
	addBrowserRequestFlags(browserRunCmd)
	browserRunCmd.Flags().String("browser-path", "", "Override the local Edge/Chrome executable path")
	browserRunCmd.Flags().String("artifact-dir", "", "Override the artifact directory for screenshots")
	browserRunCmd.Flags().String("script-path", "", "Override the browser-manager Node script path")
	browserEnqueueCmd.Flags().String("agent", "", "Target agent name or ID (required)")
	browserEnqueueCmd.Flags().String("title", "", "Issue title; defaults to a generated browser task title")
	browserEnqueueCmd.Flags().String("description", "", "Optional issue description")
	browserEnqueueCmd.Flags().String("priority", "medium", "Issue priority for the queued browser task")
	browserEnqueueCmd.Flags().String("output", "json", "Output format: table or json")
	addBrowserRequestFlags(browserEnqueueCmd)

	browserCmd.AddCommand(browserEnqueueCmd)
	browserCmd.AddCommand(browserRunCmd)
}

func addBrowserRequestFlags(cmd *cobra.Command) {
	cmd.Flags().String("request-file", "", "Path to a JSON request file, or '-' to read the request JSON from stdin")
	cmd.Flags().String("task-id", "", "Task ID for browser-manager session scoping")
	cmd.Flags().String("purpose", "browser-task", "Short purpose label for the browser task")
	cmd.Flags().String("url", "", "Target URL to open when not using --request-file")
	cmd.Flags().String("expected-url", "", "Substring that must appear in the final URL")
	cmd.Flags().String("title-contains", "", "Substring that must appear in the page title")
	cmd.Flags().String("selector", "", "CSS selector that must exist on the page")
	cmd.Flags().StringArray("allow-host", nil, "Allowed hostname for the final page (repeatable)")
	cmd.Flags().String("actions-file", "", "Path to a JSON array of browser actions")
	cmd.Flags().Bool("keep-open", false, "Keep the browser context open after the task completes")
}

func addBrowserTaskContextFlags(cmd *cobra.Command) {
	cmd.Flags().String("task-context-file", "", "Path to a raw JSON task_context file, or '-' to read JSON from stdin")
	addBrowserRequestFlags(cmd)
}

func runBrowserRun(cmd *cobra.Command, _ []string) error {
	requestBytes, err := buildBrowserRunRequest(cmd)
	if err != nil {
		return err
	}

	nodePath, err := exec.LookPath("node")
	if err != nil {
		return fmt.Errorf("node executable not found in PATH: %w", err)
	}

	scriptFlag, _ := cmd.Flags().GetString("script-path")
	scriptPath, err := resolveBrowserManagerScriptPath(scriptFlag)
	if err != nil {
		return err
	}

	execCmd := exec.Command(nodePath, scriptPath, "--request-stdin")
	execCmd.Stdin = bytes.NewReader(requestBytes)
	execCmd.Env = append([]string{}, os.Environ()...)

	if browserPath, _ := cmd.Flags().GetString("browser-path"); browserPath != "" {
		execCmd.Env = append(execCmd.Env, "BROWSER_MANAGER_EXECUTABLE_PATH="+browserPath)
	}
	if artifactDir, _ := cmd.Flags().GetString("artifact-dir"); artifactDir != "" {
		execCmd.Env = append(execCmd.Env, "BROWSER_MANAGER_ARTIFACT_DIR="+artifactDir)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	execCmd.Stdout = &stdout
	execCmd.Stderr = &stderr

	runErr := execCmd.Run()
	payloadBytes := bytes.TrimSpace(stdout.Bytes())
	if len(payloadBytes) == 0 {
		if runErr != nil {
			return fmt.Errorf("browser-manager run failed: %w%s", runErr, formatBrowserStderr(stderr.String()))
		}
		return fmt.Errorf("browser-manager returned no output")
	}

	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return fmt.Errorf("parse browser-manager output: %w%s", err, formatBrowserStderr(stderr.String()))
	}

	if err := cli.PrintJSON(os.Stdout, payload); err != nil {
		return fmt.Errorf("print browser-manager output: %w", err)
	}

	if runErr != nil || !browserRunOK(payload) {
		msg := browserRunError(payload)
		if msg == "" && runErr != nil {
			msg = runErr.Error()
		}
		if msg == "" {
			msg = "browser-manager task failed"
		}
		if stderrStr := strings.TrimSpace(stderr.String()); stderrStr != "" {
			fmt.Fprintf(cmd.ErrOrStderr(), "browser-manager stderr:\n%s\n", stderrStr)
		}
		fmt.Fprintf(cmd.ErrOrStderr(), "browser task failed: %s\n", msg)
		return errSilent
	}

	return nil
}

func runBrowserEnqueue(cmd *cobra.Command, _ []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}
	if _, err := requireWorkspaceID(cmd); err != nil {
		return err
	}

	agentRef, _ := cmd.Flags().GetString("agent")
	if strings.TrimSpace(agentRef) == "" {
		return fmt.Errorf("--agent is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	agentID, err := resolveAgent(ctx, client, agentRef)
	if err != nil {
		return fmt.Errorf("resolve agent: %w", err)
	}

	request, err := loadBrowserRunRequest(cmd)
	if err != nil {
		return err
	}

	taskContext, err := browserGatewayContextFromRequest(request)
	if err != nil {
		return err
	}

	title, err := resolveBrowserEnqueueTitle(cmd, request)
	if err != nil {
		return err
	}

	body := map[string]any{
		"title":         title,
		"priority":      mustBrowserEnqueuePriority(cmd),
		"assignee_type": "agent",
		"assignee_id":   agentID,
		"task_context":  json.RawMessage(taskContext),
	}
	if description, _ := cmd.Flags().GetString("description"); strings.TrimSpace(description) != "" {
		body["description"] = description
	}

	var result map[string]any
	if err := client.PostJSON(ctx, "/api/issues", body, &result); err != nil {
		return fmt.Errorf("enqueue browser task: %w", err)
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "table" {
		cli.PrintTable(os.Stdout, []string{"ID", "TITLE", "STATUS", "PRIORITY"}, [][]string{{
			truncateID(strVal(result, "id")),
			strVal(result, "title"),
			strVal(result, "status"),
			strVal(result, "priority"),
		}})
		return nil
	}

	return cli.PrintJSON(os.Stdout, result)
}

func buildBrowserRunRequest(cmd *cobra.Command) ([]byte, error) {
	requestFile, _ := cmd.Flags().GetString("request-file")
	if requestFile != "" {
		return readBrowserRequestFile(requestFile)
	}

	url, _ := cmd.Flags().GetString("url")
	if strings.TrimSpace(url) == "" {
		return nil, fmt.Errorf("either --request-file or --url is required")
	}

	actions, err := readBrowserActionsFile(cmd)
	if err != nil {
		return nil, err
	}

	taskID, _ := cmd.Flags().GetString("task-id")
	purpose, _ := cmd.Flags().GetString("purpose")
	expectedURL, _ := cmd.Flags().GetString("expected-url")
	titleContains, _ := cmd.Flags().GetString("title-contains")
	selector, _ := cmd.Flags().GetString("selector")
	allowHosts, _ := cmd.Flags().GetStringArray("allow-host")
	keepOpen, _ := cmd.Flags().GetBool("keep-open")

	req := browserRunRequest{
		TaskID:  taskID,
		Purpose: purpose,
		URL:     url,
		Expected: browserExpectedRequest{
			Allowlist:     allowHosts,
			ExpectedURL:   expectedURL,
			TitleContains: titleContains,
			Selector:      selector,
		},
		Actions:         actions,
		CloseOnComplete: !keepOpen,
	}

	return json.Marshal(req)
}

func buildBrowserGatewayTaskContext(cmd *cobra.Command) ([]byte, error) {
	request, err := loadBrowserRunRequest(cmd)
	if err != nil {
		return nil, err
	}

	return browserGatewayContextFromRequest(request)
}

func buildOptionalTaskContext(cmd *cobra.Command) ([]byte, error) {
	rawPath, _ := cmd.Flags().GetString("task-context-file")
	hasRawPath := strings.TrimSpace(rawPath) != ""
	hasBrowserFlags := browserTaskContextFlagsChanged(cmd)
	if hasRawPath && hasBrowserFlags {
		return nil, fmt.Errorf("--task-context-file cannot be combined with browser request flags")
	}
	if hasRawPath {
		data, err := readBrowserRequestFile(rawPath)
		if err != nil {
			return nil, fmt.Errorf("read task context: %w", err)
		}
		if !json.Valid(data) {
			return nil, fmt.Errorf("task context must be valid JSON")
		}
		return data, nil
	}
	if hasBrowserFlags {
		return buildBrowserGatewayTaskContext(cmd)
	}
	return nil, nil
}

func browserTaskContextFlagsChanged(cmd *cobra.Command) bool {
	for _, name := range []string{
		"request-file",
		"purpose",
		"url",
		"expected-url",
		"title-contains",
		"selector",
		"allow-host",
		"actions-file",
		"keep-open",
	} {
		if flag := cmd.Flags().Lookup(name); flag != nil && flag.Changed {
			return true
		}
	}
	return false
}

func loadBrowserRunRequest(cmd *cobra.Command) (browserRunRequest, error) {
	requestBytes, err := buildBrowserRunRequest(cmd)
	if err != nil {
		return browserRunRequest{}, err
	}

	var request browserRunRequest
	if err := json.Unmarshal(requestBytes, &request); err != nil {
		return browserRunRequest{}, fmt.Errorf("parse browser request: %w", err)
	}

	return request, nil
}

func browserGatewayContextFromRequest(request browserRunRequest) ([]byte, error) {
	if strings.TrimSpace(request.URL) == "" {
		return nil, fmt.Errorf("browser request url is required")
	}

	payload := browserGatewayContext{
		Execution: browserExecutionTask{
			Action:  "browser.run",
			Purpose: strings.TrimSpace(request.Purpose),
			Verification: browserVerificationRequest{
				RequireArtifact: true,
				RequireVerified: true,
				RequiredLevel:   "V3",
			},
			BrowserRun: browserGatewayRunRequest{
				URL:           request.URL,
				AllowedHosts:  request.Expected.Allowlist,
				ExpectedURL:   request.Expected.ExpectedURL,
				TitleContains: request.Expected.TitleContains,
				Selector:      request.Expected.Selector,
				Actions:       request.Actions,
				KeepOpen:      !request.CloseOnComplete,
			},
		},
	}

	if payload.Execution.Purpose == "" {
		payload.Execution.Purpose = "browser-task"
	}

	return json.Marshal(payload)
}

func readBrowserActionsFile(cmd *cobra.Command) ([]map[string]any, error) {
	actionsFile, _ := cmd.Flags().GetString("actions-file")
	if actionsFile == "" {
		return nil, nil
	}

	data, err := os.ReadFile(actionsFile)
	if err != nil {
		return nil, fmt.Errorf("read actions file %s: %w", actionsFile, err)
	}

	var actions []map[string]any
	if err := json.Unmarshal(data, &actions); err != nil {
		return nil, fmt.Errorf("parse actions file %s: %w", actionsFile, err)
	}
	return actions, nil
}

func readBrowserRequestFile(pathValue string) ([]byte, error) {
	if pathValue == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return nil, fmt.Errorf("read browser request from stdin: %w", err)
		}
		if len(bytes.TrimSpace(data)) == 0 {
			return nil, fmt.Errorf("browser request from stdin is empty")
		}
		return data, nil
	}

	data, err := os.ReadFile(pathValue)
	if err != nil {
		return nil, fmt.Errorf("read browser request file %s: %w", pathValue, err)
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, fmt.Errorf("browser request file %s is empty", pathValue)
	}
	return data, nil
}

func resolveBrowserManagerScriptPath(flagValue string) (string, error) {
	if resolved, ok := validateBrowserManagerScript(flagValue); ok {
		return resolved, nil
	}
	if resolved, ok := validateBrowserManagerScript(os.Getenv("MULTICA_BROWSER_MANAGER_SCRIPT")); ok {
		return resolved, nil
	}

	searchRoots := make([]string, 0, 2)
	if wd, err := os.Getwd(); err == nil {
		searchRoots = append(searchRoots, wd)
	}
	if exePath, err := os.Executable(); err == nil {
		searchRoots = append(searchRoots, filepath.Dir(exePath))
	}

	for _, root := range searchRoots {
		if resolved := searchBrowserManagerScriptUp(root); resolved != "" {
			return resolved, nil
		}
	}

	return "", fmt.Errorf("browser-manager script not found; set --script-path or MULTICA_BROWSER_MANAGER_SCRIPT")
}

func validateBrowserManagerScript(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	info, err := os.Stat(raw)
	if err != nil || info.IsDir() {
		return "", false
	}
	abs, err := filepath.Abs(raw)
	if err != nil {
		return raw, true
	}
	return abs, true
}

func searchBrowserManagerScriptUp(start string) string {
	dir := start
	for {
		candidate := filepath.Join(dir, "scripts", "browser-manager.mjs")
		if resolved, ok := validateBrowserManagerScript(candidate); ok {
			return resolved
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func browserRunOK(payload map[string]any) bool {
	ok, _ := payload["ok"].(bool)
	return ok
}

func browserRunError(payload map[string]any) string {
	msg, _ := payload["error"].(string)
	return strings.TrimSpace(msg)
}

func formatBrowserStderr(stderr string) string {
	stderr = strings.TrimSpace(stderr)
	if stderr == "" {
		return ""
	}
	return "\nstderr:\n" + stderr
}

func resolveBrowserEnqueueTitle(cmd *cobra.Command, request browserRunRequest) (string, error) {
	if title, _ := cmd.Flags().GetString("title"); strings.TrimSpace(title) != "" {
		return title, nil
	}

	if parsed, err := neturl.Parse(request.URL); err == nil && parsed.Host != "" {
		return "Browser run: " + parsed.Host, nil
	}
	if purpose := strings.TrimSpace(request.Purpose); purpose != "" {
		return "Browser run: " + purpose, nil
	}
	return "Browser run", nil
}

func mustBrowserEnqueuePriority(cmd *cobra.Command) string {
	priority, _ := cmd.Flags().GetString("priority")
	priority = strings.TrimSpace(priority)
	if priority == "" {
		return "medium"
	}
	return priority
}
