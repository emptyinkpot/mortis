package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/handler"
	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

var issueIdentifierPattern = regexp.MustCompile(`(?i)\b([A-Z]+)-(\d+)\b`)

var handoffCuePhrases = []string{
	"handoff_back_to",
	"handoff back to",
	"handoff to",
	"ready for",
	"return to",
	"back to",
	"next role",
	"交回",
	"回到",
	"交给",
	"收口到",
}

func registerIssueHandoffListeners(bus *events.Bus, queries *db.Queries, taskSvc *service.TaskService) {
	ctx := context.Background()

	bus.Subscribe(protocol.EventIssueUpdated, func(e events.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		statusChanged, _ := payload["status_changed"].(bool)
		if !statusChanged {
			return
		}
		issue, ok := payload["issue"].(handler.IssueResponse)
		if !ok {
			return
		}
		if issue.Status != "done" && issue.Status != "in_review" && issue.Status != "blocked" && issue.Status != "cancelled" {
			return
		}

		sourceIssue, err := queries.GetIssue(ctx, parseUUID(issue.ID))
		if err != nil {
			return
		}
		comments, err := queries.ListComments(ctx, db.ListCommentsParams{
			IssueID:     sourceIssue.ID,
			WorkspaceID: sourceIssue.WorkspaceID,
		})
		if err != nil || len(comments) == 0 {
			return
		}

		latest := comments[len(comments)-1]
		targetIssue, ok := resolveIssueHandoffTarget(ctx, queries, sourceIssue.WorkspaceID, latest.Content)
		if !ok {
			return
		}
		if util.UUIDToString(targetIssue.ID) == util.UUIDToString(sourceIssue.ID) {
			return
		}
		if !targetIssue.AssigneeID.Valid || !targetIssue.AssigneeType.Valid || targetIssue.AssigneeType.String != "agent" {
			return
		}

		updatedTargetIssue, changed, err := reopenIssueForHandoff(ctx, queries, targetIssue)
		if err != nil {
			slog.Warn("issue handoff reopen failed",
				"source_issue_id", util.UUIDToString(sourceIssue.ID),
				"target_issue_id", util.UUIDToString(targetIssue.ID),
				"error", err,
			)
			return
		}
		if changed {
			targetIssue = updatedTargetIssue
		}

		hasPending, err := queries.HasPendingTaskForIssueAndAgent(ctx, db.HasPendingTaskForIssueAndAgentParams{
			IssueID: targetIssue.ID,
			AgentID: targetIssue.AssigneeID,
		})
		if err != nil || hasPending {
			return
		}

		taskContext, err := json.Marshal(map[string]any{
			"handoff": map[string]any{
				"sourceIssueId":           util.UUIDToString(sourceIssue.ID),
				"sourceIssueStatus":       sourceIssue.Status,
				"sourceIssueTitle":        sourceIssue.Title,
				"sourceCommentId":         util.UUIDToString(latest.ID),
				"sourceCommentAuthorType": latest.AuthorType,
				"sourceCommentAuthorId":   util.UUIDToString(latest.AuthorID),
				"sourceCommentContent":    latest.Content,
			},
		})
		if err != nil {
			return
		}

		if _, err := taskSvc.EnqueueTaskForIssueWithContext(ctx, targetIssue, taskContext); err != nil {
			slog.Warn("issue handoff enqueue failed",
				"source_issue_id", util.UUIDToString(sourceIssue.ID),
				"target_issue_id", util.UUIDToString(targetIssue.ID),
				"error", err,
			)
			return
		}

		slog.Info("issue handoff queued",
			"source_issue_id", util.UUIDToString(sourceIssue.ID),
			"target_issue_id", util.UUIDToString(targetIssue.ID),
			"target_agent_id", util.UUIDToString(targetIssue.AssigneeID),
		)
	})
}

func resolveIssueHandoffTarget(ctx context.Context, queries *db.Queries, workspaceID pgtype.UUID, content string) (db.Issue, bool) {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || !containsHandoffCue(trimmed) {
			continue
		}
		if issue, ok := resolveIssueReferenceFromText(ctx, queries, workspaceID, trimmed); ok {
			return issue, true
		}
	}

	if !containsHandoffCue(content) {
		return db.Issue{}, false
	}
	return resolveIssueReferenceFromText(ctx, queries, workspaceID, content)
}

func containsHandoffCue(content string) bool {
	lower := strings.ToLower(content)
	for _, cue := range handoffCuePhrases {
		if strings.Contains(lower, cue) {
			return true
		}
	}
	return false
}

func resolveIssueReferenceFromText(ctx context.Context, queries *db.Queries, workspaceID pgtype.UUID, content string) (db.Issue, bool) {
	for _, mention := range util.ParseMentions(content) {
		if mention.Type != "issue" {
			continue
		}
		issue, err := queries.GetIssueInWorkspace(ctx, db.GetIssueInWorkspaceParams{
			ID:          parseUUID(mention.ID),
			WorkspaceID: workspaceID,
		})
		if err == nil {
			return issue, true
		}
	}

	workspace, err := queries.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return db.Issue{}, false
	}
	prefix := strings.ToUpper(strings.TrimSpace(workspace.IssuePrefix))
	if prefix == "" {
		return db.Issue{}, false
	}

	for _, match := range issueIdentifierPattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 3 || strings.ToUpper(match[1]) != prefix {
			continue
		}
		number, err := strconv.Atoi(match[2])
		if err != nil {
			continue
		}
		issue, err := queries.GetIssueByNumber(ctx, db.GetIssueByNumberParams{
			WorkspaceID: workspaceID,
			Number:      int32(number),
		})
		if err == nil {
			return issue, true
		}
	}

	return db.Issue{}, false
}

func reopenIssueForHandoff(ctx context.Context, queries *db.Queries, issue db.Issue) (db.Issue, bool, error) {
	if issue.Status != "blocked" && issue.Status != "in_review" && issue.Status != "done" && issue.Status != "cancelled" {
		return issue, false, nil
	}
	updated, err := queries.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
		ID:     issue.ID,
		Status: "todo",
	})
	if err != nil {
		return db.Issue{}, false, err
	}
	return updated, true, nil
}
