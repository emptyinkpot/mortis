package main

import (
	"encoding/json"
	"testing"
)

func TestBrowserGatewayContextFromRequest(t *testing.T) {
	payload, err := browserGatewayContextFromRequest(browserRunRequest{
		Purpose: "verify-login-page",
		URL:     "https://example.com/login",
		Expected: browserExpectedRequest{
			Allowlist:     []string{"example.com"},
			ExpectedURL:   "example.com/login",
			TitleContains: "Example",
			Selector:      "#login",
		},
		Actions: []map[string]any{
			{"type": "wait", "value": 300},
		},
		CloseOnComplete: true,
	})
	if err != nil {
		t.Fatalf("browserGatewayContextFromRequest: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}

	execution, ok := got["execution"].(map[string]any)
	if !ok {
		t.Fatalf("missing execution payload: %#v", got)
	}
	if execution["action"] != "browser.run" {
		t.Fatalf("expected action browser.run, got %#v", execution["action"])
	}
	if execution["purpose"] != "verify-login-page" {
		t.Fatalf("expected purpose verify-login-page, got %#v", execution["purpose"])
	}

	verification, ok := execution["verification"].(map[string]any)
	if !ok {
		t.Fatalf("missing verification payload: %#v", execution)
	}
	if verification["requiredLevel"] != "V3" {
		t.Fatalf("expected requiredLevel V3, got %#v", verification["requiredLevel"])
	}

	browserRun, ok := execution["browserRun"].(map[string]any)
	if !ok {
		t.Fatalf("missing browserRun payload: %#v", execution)
	}
	if browserRun["url"] != "https://example.com/login" {
		t.Fatalf("expected url preserved, got %#v", browserRun["url"])
	}
	if browserRun["keepOpen"] != false {
		t.Fatalf("expected keepOpen false, got %#v", browserRun["keepOpen"])
	}
}
