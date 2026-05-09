package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClaimTaskByRuntime_IncludesTaskContext(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	ctx := context.Background()

	var runtimeID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO agent_runtime (
			workspace_id, daemon_id, name, runtime_mode, provider, status, device_info, metadata, last_seen_at
		)
		VALUES ($1, NULL, $2, 'cloud', $3, 'online', $4, '{}'::jsonb, now())
		RETURNING id
	`, testWorkspaceID, "Gateway Test Runtime", "gateway_test_runtime", "Gateway test runtime").Scan(&runtimeID); err != nil {
		t.Fatalf("create runtime: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent_runtime WHERE id = $1`, runtimeID)
	})

	var agentID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO agent (
			workspace_id, name, description, runtime_mode, runtime_config,
			runtime_id, visibility, max_concurrent_tasks, owner_id
		)
		VALUES ($1, $2, '', 'cloud', '{}'::jsonb, $3, 'workspace', 1, $4)
		RETURNING id
	`, testWorkspaceID, "Gateway Test Agent", runtimeID, testUserID).Scan(&agentID); err != nil {
		t.Fatalf("create agent: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent WHERE id = $1`, agentID)
	})

	var issueID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO issue (
			workspace_id, title, status, priority, assignee_type, assignee_id, creator_id, creator_type
		)
		VALUES ($1, $2, 'todo', 'medium', 'agent', $3, $4, 'member')
		RETURNING id
	`, testWorkspaceID, "gateway-task-context", agentID, testUserID).Scan(&issueID); err != nil {
		t.Fatalf("create issue: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM issue WHERE id = $1`, issueID)
	})

	issue, err := testHandler.Queries.GetIssue(ctx, parseUUID(issueID))
	if err != nil {
		t.Fatalf("load issue: %v", err)
	}

	taskContext := json.RawMessage(`{
		"execution": {
			"action": "browser.run",
			"purpose": "gateway-test",
			"browserRun": {
				"url": "https://example.com",
				"allowedHosts": ["example.com"]
			}
		}
	}`)

	task, err := testHandler.TaskService.EnqueueTaskForIssueWithContext(ctx, issue, taskContext)
	if err != nil {
		t.Fatalf("enqueue task with context: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent_task_queue WHERE id = $1`, uuidToString(task.ID))
	})

	assertJSONEqual(t, task.Context, string(taskContext))

	req := withURLParam(
		newRequest(http.MethodPost, "/api/daemon/runtimes/"+runtimeID+"/claim", nil),
		"runtimeId",
		runtimeID,
	)
	w := httptest.NewRecorder()
	testHandler.ClaimTaskByRuntime(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ClaimTaskByRuntime: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Task *AgentTaskResponse `json:"task"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Task == nil {
		t.Fatal("expected claimed task in response")
	}
	if resp.Task.ID != uuidToString(task.ID) {
		t.Fatalf("expected task id %q, got %q", uuidToString(task.ID), resp.Task.ID)
	}
	assertJSONEqual(t, resp.Task.Context, string(taskContext))
}
