package executiongateway

import (
	"encoding/json"
	"testing"
)

func TestParseTaskContext_NoExecution(t *testing.T) {
	req, ok, err := ParseTaskContext(json.RawMessage(`{"foo":"bar"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatalf("expected ok=false, got true with req=%+v", req)
	}
}

func TestParseTaskContext_BrowserRunMissingURL(t *testing.T) {
	_, ok, err := ParseTaskContext(json.RawMessage(`{
		"execution": {
			"action": "browser.run",
			"browserRun": {}
		}
	}`))
	if !ok {
		t.Fatal("expected ok=true for gateway-shaped payload")
	}
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
}
