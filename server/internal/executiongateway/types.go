package executiongateway

import "context"

type ActionKind string

const (
	ActionBrowserRun ActionKind = "browser.run"
)

type VerificationSpec struct {
	RequireArtifact bool   `json:"requireArtifact,omitempty"`
	RequireVerified bool   `json:"requireVerified,omitempty"`
	RequiredLevel   string `json:"requiredLevel,omitempty"`
}

type BrowserAction struct {
	Type     string `json:"type"`
	Selector string `json:"selector,omitempty"`
	Value    any    `json:"value,omitempty"`
}

type BrowserRunInput struct {
	URL           string          `json:"url"`
	AllowedHosts  []string        `json:"allowedHosts,omitempty"`
	ExpectedURL   string          `json:"expectedUrl,omitempty"`
	TitleContains string          `json:"titleContains,omitempty"`
	Selector      string          `json:"selector,omitempty"`
	Actions       []BrowserAction `json:"actions,omitempty"`
	KeepOpen      bool            `json:"keepOpen,omitempty"`
}

type ExecutionRequest struct {
	Action       ActionKind       `json:"action"`
	Purpose      string           `json:"purpose,omitempty"`
	Verification VerificationSpec `json:"verification,omitempty"`
	BrowserRun   *BrowserRunInput `json:"browserRun,omitempty"`
}

type Envelope struct {
	Execution *ExecutionRequest `json:"execution,omitempty"`
}

type Artifact struct {
	Kind string `json:"kind"`
	Path string `json:"path"`
}

type ExecutionResult struct {
	OK                bool           `json:"ok"`
	Status            string         `json:"status"`
	Action            ActionKind     `json:"action"`
	Message           string         `json:"message,omitempty"`
	VerificationLevel string         `json:"verificationLevel,omitempty"`
	Artifacts         []Artifact     `json:"artifacts,omitempty"`
	Raw               map[string]any `json:"raw,omitempty"`
}

type Gateway interface {
	Execute(ctx context.Context, req ExecutionRequest) (ExecutionResult, error)
}
