package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestCreateAutopilotRunOnlyPersistsTaskContextAndDispatchesTask(t *testing.T) {
	ctx := context.Background()

	var agentID string
	if err := testPool.QueryRow(ctx,
		`SELECT id FROM agent WHERE workspace_id = $1 AND name = $2`,
		testWorkspaceID, "Handler Test Agent",
	).Scan(&agentID); err != nil {
		t.Fatalf("failed to find test agent: %v", err)
	}

	taskContext := map[string]any{
		"execution": map[string]any{
			"action":  "browser.run",
			"purpose": "autopilot-run-only-test",
			"browserRun": map[string]any{
				"url":          "https://example.com/login",
				"allowedHosts": []string{"example.com"},
			},
		},
	}

	w := httptest.NewRecorder()
	req := newRequest(http.MethodPost, "/api/autopilots?workspace_id="+testWorkspaceID, map[string]any{
		"title":          "Browser autopilot",
		"assignee_id":    agentID,
		"execution_mode": "run_only",
		"task_context":   taskContext,
	})
	testHandler.CreateAutopilot(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateAutopilot: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created AutopilotResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("decode autopilot response: %v", err)
	}
	if created.TaskContext == nil {
		t.Fatal("expected task_context in autopilot response")
	}

	storedAutopilot, err := testHandler.Queries.GetAutopilot(ctx, parseUUID(created.ID))
	if err != nil {
		t.Fatalf("load autopilot: %v", err)
	}
	wantContext, err := json.Marshal(taskContext)
	if err != nil {
		t.Fatalf("marshal task context: %v", err)
	}
	assertJSONEqual(t, storedAutopilot.TaskContext, string(wantContext))

	run, err := testHandler.AutopilotService.DispatchAutopilot(ctx, storedAutopilot, pgtype.UUID{}, "manual", nil)
	if err != nil {
		t.Fatalf("DispatchAutopilot: %v", err)
	}
	if !run.TaskID.Valid {
		t.Fatal("expected run_only dispatch to create a task")
	}

	task, err := testHandler.Queries.GetAgentTask(ctx, run.TaskID)
	if err != nil {
		t.Fatalf("load queued task: %v", err)
	}
	assertJSONEqual(t, task.Context, string(wantContext))

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent_task_queue WHERE id = $1`, run.TaskID)
		testPool.Exec(context.Background(), `DELETE FROM autopilot WHERE id = $1`, created.ID)
	})
}

func TestCreateCommentPersistsTaskContextOnOnCommentTask(t *testing.T) {
	ctx := context.Background()

	var agentID string
	if err := testPool.QueryRow(ctx,
		`SELECT id FROM agent WHERE workspace_id = $1 AND name = $2`,
		testWorkspaceID, "Handler Test Agent",
	).Scan(&agentID); err != nil {
		t.Fatalf("failed to find test agent: %v", err)
	}

	issueW := httptest.NewRecorder()
	issueReq := newRequest(http.MethodPost, "/api/issues?workspace_id="+testWorkspaceID, map[string]any{
		"title":         "Comment browser task issue",
		"status":        "backlog",
		"assignee_type": "agent",
		"assignee_id":   agentID,
	})
	testHandler.CreateIssue(issueW, issueReq)
	if issueW.Code != http.StatusCreated {
		t.Fatalf("CreateIssue: expected 201, got %d: %s", issueW.Code, issueW.Body.String())
	}

	var issue IssueResponse
	if err := json.NewDecoder(issueW.Body).Decode(&issue); err != nil {
		t.Fatalf("decode issue response: %v", err)
	}

	taskContext := map[string]any{
		"execution": map[string]any{
			"action":  "browser.run",
			"purpose": "comment-on-comment-test",
			"browserRun": map[string]any{
				"url":          "https://example.com/comment",
				"allowedHosts": []string{"example.com"},
			},
		},
	}

	commentW := httptest.NewRecorder()
	commentReq := newRequest(http.MethodPost, "/api/issues/"+issue.ID+"/comments", map[string]any{
		"content":      "please verify this page",
		"task_context": taskContext,
	})
	commentReq = withURLParam(commentReq, "id", issue.ID)
	testHandler.CreateComment(commentW, commentReq)
	if commentW.Code != http.StatusCreated {
		t.Fatalf("CreateComment: expected 201, got %d: %s", commentW.Code, commentW.Body.String())
	}

	var comment CommentResponse
	if err := json.NewDecoder(commentW.Body).Decode(&comment); err != nil {
		t.Fatalf("decode comment response: %v", err)
	}

	wantContext, err := json.Marshal(taskContext)
	if err != nil {
		t.Fatalf("marshal task context: %v", err)
	}

	var storedContext []byte
	if err := testPool.QueryRow(ctx,
		`SELECT context FROM agent_task_queue WHERE issue_id = $1 AND trigger_comment_id = $2 ORDER BY created_at DESC LIMIT 1`,
		issue.ID, comment.ID,
	).Scan(&storedContext); err != nil {
		t.Fatalf("load on_comment task context: %v", err)
	}
	assertJSONEqual(t, storedContext, string(wantContext))

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent_task_queue WHERE issue_id = $1`, issue.ID)
		cleanupReq := newRequest(http.MethodDelete, "/api/issues/"+issue.ID, nil)
		cleanupReq = withURLParam(cleanupReq, "id", issue.ID)
		testHandler.DeleteIssue(httptest.NewRecorder(), cleanupReq)
	})
}

func TestCreateCommentPersistsTaskContextOnMentionTask(t *testing.T) {
	ctx := context.Background()

	mentionedAgentID := createHandlerTestAgent(t, "Mention Browser Agent", []byte(`null`))

	var assigneeID string
	if err := testPool.QueryRow(ctx,
		`SELECT id FROM agent WHERE workspace_id = $1 AND name = $2`,
		testWorkspaceID, "Handler Test Agent",
	).Scan(&assigneeID); err != nil {
		t.Fatalf("failed to find assignee agent: %v", err)
	}

	issueW := httptest.NewRecorder()
	issueReq := newRequest(http.MethodPost, "/api/issues?workspace_id="+testWorkspaceID, map[string]any{
		"title":         "Mention browser task issue",
		"status":        "backlog",
		"assignee_type": "agent",
		"assignee_id":   assigneeID,
	})
	testHandler.CreateIssue(issueW, issueReq)
	if issueW.Code != http.StatusCreated {
		t.Fatalf("CreateIssue: expected 201, got %d: %s", issueW.Code, issueW.Body.String())
	}

	var issue IssueResponse
	if err := json.NewDecoder(issueW.Body).Decode(&issue); err != nil {
		t.Fatalf("decode issue response: %v", err)
	}

	taskContext := map[string]any{
		"execution": map[string]any{
			"action":  "browser.run",
			"purpose": "comment-mention-test",
			"browserRun": map[string]any{
				"url":          "https://example.com/mention",
				"allowedHosts": []string{"example.com"},
			},
		},
	}

	content := fmt.Sprintf("[@Mention Browser Agent](mention://agent/%s) please verify this page", mentionedAgentID)
	commentW := httptest.NewRecorder()
	commentReq := newRequest(http.MethodPost, "/api/issues/"+issue.ID+"/comments", map[string]any{
		"content":      content,
		"task_context": taskContext,
	})
	commentReq = withURLParam(commentReq, "id", issue.ID)
	testHandler.CreateComment(commentW, commentReq)
	if commentW.Code != http.StatusCreated {
		t.Fatalf("CreateComment: expected 201, got %d: %s", commentW.Code, commentW.Body.String())
	}

	var comment CommentResponse
	if err := json.NewDecoder(commentW.Body).Decode(&comment); err != nil {
		t.Fatalf("decode comment response: %v", err)
	}

	wantContext, err := json.Marshal(taskContext)
	if err != nil {
		t.Fatalf("marshal task context: %v", err)
	}

	var storedContext []byte
	if err := testPool.QueryRow(ctx,
		`SELECT context FROM agent_task_queue WHERE issue_id = $1 AND agent_id = $2 AND trigger_comment_id = $3 ORDER BY created_at DESC LIMIT 1`,
		issue.ID, mentionedAgentID, comment.ID,
	).Scan(&storedContext); err != nil {
		t.Fatalf("load mention task context: %v", err)
	}
	assertJSONEqual(t, storedContext, string(wantContext))

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM agent_task_queue WHERE issue_id = $1`, issue.ID)
		cleanupReq := newRequest(http.MethodDelete, "/api/issues/"+issue.ID, nil)
		cleanupReq = withURLParam(cleanupReq, "id", issue.ID)
		testHandler.DeleteIssue(httptest.NewRecorder(), cleanupReq)
	})
}
