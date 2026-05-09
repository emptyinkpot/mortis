package roles

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MailboxConsumer struct {
	log         *slog.Logger
	pool        *pgxpool.Pool
	runtimeRoot string
	interval    time.Duration
	stopAfter   int
}

type MailboxConsumerConfig struct {
	Logger      *slog.Logger
	Pool        *pgxpool.Pool
	RuntimeRoot string
	Interval    time.Duration
	StopAfter   int
}

type mailboxDelegationEvent struct {
	EventType         string   `json:"event_type"`
	EventID           string   `json:"event_id"`
	WorkspaceID       string   `json:"workspace_id"`
	ThreadID          string   `json:"thread_id"`
	FromAgentID       string   `json:"from_agent_id"`
	ToAgentID         string   `json:"to_agent_id"`
	Intent            string   `json:"intent"`
	Goal              string   `json:"goal"`
	Summary           string   `json:"summary"`
	ArtifactRefs      []string `json:"artifact_refs"`
	RequiredArtifacts []string `json:"required_artifacts"`
	ReplyTo           string   `json:"reply_to"`
	MailboxURI        string   `json:"mailbox_uri"`
	CreatedAt         string   `json:"created_at"`
}

func NewMailboxConsumer(cfg MailboxConsumerConfig) (*MailboxConsumer, error) {
	if cfg.Pool == nil {
		return nil, fmt.Errorf("mailbox consumer requires pool")
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	if strings.TrimSpace(cfg.RuntimeRoot) == "" {
		cfg.RuntimeRoot = getenvDefault("MORTIS_RUNTIME_ROOT", ".runtime")
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 2 * time.Second
	}
	return &MailboxConsumer{log: cfg.Logger, pool: cfg.Pool, runtimeRoot: cfg.RuntimeRoot, interval: cfg.Interval, stopAfter: cfg.StopAfter}, nil
}

func (c *MailboxConsumer) Run(ctx context.Context) error {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()
	iterations := 0
	for {
		if c.stopAfter > 0 && iterations >= c.stopAfter {
			return nil
		}
		iterations++
		if err := c.tick(ctx); err != nil {
			c.log.Error("mailbox consumer tick failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (c *MailboxConsumer) tick(ctx context.Context) error {
	pattern := filepath.Join(c.runtimeRoot, "mailboxes", "*", "*.jsonl")
	paths, err := filepath.Glob(pattern)
	if err != nil {
		return err
	}
	for _, path := range paths {
		if err := c.consumeMailboxFile(ctx, path); err != nil {
			return err
		}
	}
	return nil
}

func (c *MailboxConsumer) consumeMailboxFile(ctx context.Context, path string) error {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var event mailboxDelegationEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			c.log.Warn("skip invalid mailbox event", "path", path, "error", err)
			continue
		}
		if event.EventType != "delegation.requested" || strings.TrimSpace(event.EventID) == "" {
			continue
		}
		if err := c.enqueueDelegation(ctx, event); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func (c *MailboxConsumer) enqueueDelegation(ctx context.Context, event mailboxDelegationEvent) error {
	roleName := mailboxRoleForAgent(event.ToAgentID)
	if roleName == "" {
		c.log.Warn("skip mailbox event with unmapped target agent", "event_id", event.EventID, "to_agent_id", event.ToAgentID)
		return nil
	}
	actionType := "code_change"
	if roleName == "tester" {
		actionType = "verification"
	}
	payload := mailboxActionPayload(event, roleName, actionType)
	_, err := c.pool.Exec(ctx, `
WITH target_role AS (
  SELECT id, workspace_id
  FROM roles
  WHERE workspace_id = $1::uuid AND name = $2
  LIMIT 1
), created_invocation AS (
  INSERT INTO role_invocations (
    workspace_id, role_id, message_id, channel, status, command_type, risk_level, requires_approval, result
  )
  SELECT
    workspace_id,
    id,
    NULL,
    'api',
    'queued',
    'a2a_delegation',
    'low',
    false,
    $5::jsonb
  FROM target_role
  WHERE NOT EXISTS (
    SELECT 1 FROM role_invocations existing
    WHERE existing.workspace_id = target_role.workspace_id
      AND existing.result->>'a2a_event_id' = $3
  )
  RETURNING id, workspace_id
)
INSERT INTO role_actions (
  workspace_id, invocation_id, action_type, risk_level, requires_approval, payload, status
)
SELECT workspace_id, id, $4, 'low', false, $6::jsonb, 'approved'
FROM created_invocation`,
		event.WorkspaceID,
		roleName,
		event.EventID,
		actionType,
		MustJSON(map[string]any{
			"a2a_event_id":      event.EventID,
			"a2a_thread_id":     event.ThreadID,
			"from_agent_id":     event.FromAgentID,
			"to_agent_id":       event.ToAgentID,
			"mailbox_uri":       event.MailboxURI,
			"delegation_status": "queued",
		}),
		MustJSON(payload),
	)
	return err
}

func mailboxRoleForAgent(agentID string) string {
	agentID = strings.ToLower(strings.TrimSpace(agentID))
	switch agentID {
	case "implementer", "codex-implementer", "builder", "builder-ai":
		return "builder"
	case "reviewer", "tester", "tester-ai":
		return "tester"
	default:
		return ""
	}
}

func mailboxActionPayload(event mailboxDelegationEvent, roleName string, actionType string) map[string]any {
	objective := strings.TrimSpace(event.Summary)
	if objective == "" {
		objective = strings.TrimSpace(event.Goal)
	}
	if objective == "" {
		objective = "Handle A2A delegation " + event.EventID
	}
	acceptance := append([]string(nil), event.RequiredArtifacts...)
	if len(acceptance) == 0 {
		acceptance = []string{"produce required runtime artifact evidence"}
	}
	commands := []string{"git status --short"}
	if roleName == "builder" {
		commands = []string{"bash scripts/check-repository-policy.sh"}
	}
	return map[string]any{
		"title":     "A2A delegation " + event.EventID,
		"objective": objective,
		"context": strings.TrimSpace(fmt.Sprintf("A2A from %s to %s. Thread: %s. Reply: %s. Artifacts: %s",
			event.FromAgentID, event.ToAgentID, event.ThreadID, event.ReplyTo, strings.Join(event.ArtifactRefs, ", "))),
		"a2a_event_id":       event.EventID,
		"a2a_thread_id":      event.ThreadID,
		"from_agent_id":      event.FromAgentID,
		"to_agent_id":        event.ToAgentID,
		"artifact_refs":      event.ArtifactRefs,
		"required_artifacts": event.RequiredArtifacts,
		"reply_to":           event.ReplyTo,
		"action_contract": map[string]any{
			"action_type":       actionType,
			"owner":             roleName,
			"repo":              "mortis",
			"objective":         objective,
			"acceptance":        acceptance,
			"commands":          commands,
			"risk_level":        "low",
			"artifact_required": true,
			"artifact_types":    event.RequiredArtifacts,
			"status":            "approved",
			"a2a_event_id":      event.EventID,
			"a2a_thread_id":     event.ThreadID,
		},
	}
}
