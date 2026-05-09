package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/multica-ai/multica/server/internal/cli"
)

func TestResolveAgent(t *testing.T) {
	agentsResp := []map[string]any{
		{"id": "11111111-1111-1111-1111-111111111111", "name": "Lambda"},
		{"id": "22222222-2222-2222-2222-222222222222", "name": "Codex Agent"},
		{"id": "33333333-3333-3333-3333-333333333333", "name": "Claude Reviewer"},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/agents" {
			json.NewEncoder(w).Encode(agentsResp)
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	client := cli.NewAPIClient(srv.URL, "ws-1", "test-token")
	ctx := context.Background()

	t.Run("passes through a UUID without lookup", func(t *testing.T) {
		id := "44444444-4444-4444-4444-444444444444"
		got, err := resolveAgent(ctx, client, id)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != id {
			t.Errorf("got %q, want %q", got, id)
		}
	})

	t.Run("exact name match", func(t *testing.T) {
		got, err := resolveAgent(ctx, client, "Lambda")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "11111111-1111-1111-1111-111111111111" {
			t.Errorf("got %q, want Lambda's UUID", got)
		}
	})

	t.Run("case-insensitive substring", func(t *testing.T) {
		got, err := resolveAgent(ctx, client, "codex")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "22222222-2222-2222-2222-222222222222" {
			t.Errorf("got %q, want Codex Agent's UUID", got)
		}
	})

	t.Run("no match", func(t *testing.T) {
		_, err := resolveAgent(ctx, client, "nobody")
		if err == nil {
			t.Fatal("expected error for no match")
		}
	})

	t.Run("ambiguous match", func(t *testing.T) {
		_, err := resolveAgent(ctx, client, "a") // matches Lambda, Codex Agent, Claude Reviewer
		if err == nil {
			t.Fatal("expected error for ambiguous match")
		}
		if !strings.Contains(err.Error(), "ambiguous") {
			t.Errorf("expected ambiguous error, got: %v", err)
		}
	})

	t.Run("missing workspace ID for name lookup", func(t *testing.T) {
		noWSClient := cli.NewAPIClient(srv.URL, "", "test-token")
		_, err := resolveAgent(ctx, noWSClient, "Lambda")
		if err == nil {
			t.Fatal("expected error when workspace ID is missing")
		}
	})

	t.Run("UUID works without workspace ID", func(t *testing.T) {
		noWSClient := cli.NewAPIClient(srv.URL, "", "test-token")
		id := "55555555-5555-5555-5555-555555555555"
		got, err := resolveAgent(ctx, noWSClient, id)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != id {
			t.Errorf("got %q, want %q", got, id)
		}
	})
}

func TestUUIDRegexp(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{"11111111-1111-1111-1111-111111111111", true},
		{"A1B2C3D4-1111-1111-1111-111111111111", true},
		{"not-a-uuid", false},
		{"11111111-1111-1111-1111-11111111111", false},   // too short
		{"11111111111111111111111111111111", false},      // missing dashes
		{"11111111-1111-1111-1111-1111111111111", false}, // too long
		{"", false},
	}
	for _, tt := range tests {
		if got := uuidRegexp.MatchString(tt.in); got != tt.want {
			t.Errorf("uuidRegexp.MatchString(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestRunAutopilotCreate_RunOnlyWithBrowserTaskContext(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/agents":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"id": "11111111-1111-1111-1111-111111111111", "name": "Browser Agent"},
			})
		case "/api/autopilots":
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST, got %s", r.Method)
			}
			if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":    "autopilot-1",
				"title": gotBody["title"],
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	t.Setenv("MULTICA_SERVER_URL", srv.URL)
	t.Setenv("MULTICA_WORKSPACE_ID", "ws-1")
	t.Setenv("MULTICA_TOKEN", "test-token")

	cmd := &cobra.Command{}
	cmd.Flags().String("title", "", "")
	cmd.Flags().String("description", "", "")
	cmd.Flags().String("agent", "", "")
	cmd.Flags().String("mode", "", "")
	cmd.Flags().String("priority", "none", "")
	cmd.Flags().String("project", "", "")
	cmd.Flags().String("issue-title-template", "", "")
	cmd.Flags().String("output", "json", "")
	addBrowserTaskContextFlags(cmd)

	if err := cmd.Flags().Set("title", "Browser autopilot"); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Flags().Set("agent", "Browser Agent"); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Flags().Set("mode", "run_only"); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Flags().Set("url", "https://example.com/login"); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Flags().Set("allow-host", "example.com"); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Flags().Set("purpose", "autopilot-browser-run"); err != nil {
		t.Fatal(err)
	}

	if err := runAutopilotCreate(cmd, nil); err != nil {
		t.Fatalf("runAutopilotCreate: %v", err)
	}

	if gotBody["execution_mode"] != "run_only" {
		t.Fatalf("expected run_only mode, got %#v", gotBody["execution_mode"])
	}

	taskContext, ok := gotBody["task_context"].(map[string]any)
	if !ok {
		t.Fatalf("missing task_context in request body: %#v", gotBody)
	}
	execution, ok := taskContext["execution"].(map[string]any)
	if !ok {
		t.Fatalf("missing execution payload: %#v", taskContext)
	}
	if execution["action"] != "browser.run" {
		t.Fatalf("expected browser.run action, got %#v", execution["action"])
	}
	browserRun, ok := execution["browserRun"].(map[string]any)
	if !ok {
		t.Fatalf("missing browserRun payload: %#v", execution)
	}
	if browserRun["url"] != "https://example.com/login" {
		t.Fatalf("expected browser url preserved, got %#v", browserRun["url"])
	}
}
