package executiongateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

func ParseTaskContext(raw json.RawMessage) (*ExecutionRequest, bool, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, false, nil
	}

	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, false, fmt.Errorf("decode task context: %w", err)
	}
	if env.Execution == nil {
		return nil, false, nil
	}

	req := env.Execution
	if req.Action == "" {
		return nil, true, fmt.Errorf("execution.action is required")
	}

	switch req.Action {
	case ActionBrowserRun:
		if req.BrowserRun == nil {
			return nil, true, fmt.Errorf("browserRun payload is required")
		}
		if strings.TrimSpace(req.BrowserRun.URL) == "" {
			return nil, true, fmt.Errorf("browserRun.url is required")
		}
	}

	return req, true, nil
}
