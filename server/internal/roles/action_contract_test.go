package roles

import "testing"

func TestBuildActionContractPayloadIncludesArtifactFirstContract(t *testing.T) {
	payload := BuildActionContractPayload(ActionContractInput{
		Content:     "修复登录失败\nTest command: go test ./internal/roles",
		Channel:     "qq",
		RoleName:    "builder",
		CommandType: "code_change",
		RiskLevel:   "low",
		ActionID:    "ABC 123",
	})
	contract, ok := payload["action_contract"].(map[string]any)
	if !ok {
		t.Fatalf("missing action_contract: %#v", payload)
	}
	if contract["owner"] != "builder" {
		t.Fatalf("unexpected owner: %#v", contract["owner"])
	}
	if contract["artifact_required"] != true {
		t.Fatalf("expected artifact_required=true: %#v", contract)
	}
	if contract["branch"] != "mortis/action-abc-123" {
		t.Fatalf("unexpected branch: %#v", contract["branch"])
	}
	commands, ok := contract["commands"].([]string)
	if !ok || len(commands) != 1 || commands[0] != "go test ./internal/roles" {
		t.Fatalf("unexpected commands: %#v", contract["commands"])
	}
}
