package roles

import "testing"

func TestMailboxRoleForAgent(t *testing.T) {
	cases := map[string]string{
		"implementer":       "builder",
		"codex-implementer": "builder",
		"builder":           "builder",
		"reviewer":          "tester",
		"tester":            "tester",
		"unknown":           "",
	}
	for input, want := range cases {
		if got := mailboxRoleForAgent(input); got != want {
			t.Fatalf("mailboxRoleForAgent(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestMailboxActionPayloadCarriesDelegationContract(t *testing.T) {
	event := mailboxDelegationEvent{
		EventID:           "evt-1",
		ThreadID:          "thread-1",
		FromAgentID:       "architect",
		ToAgentID:         "implementer",
		Intent:            "implement",
		Summary:           "Build mailbox consumer",
		ArtifactRefs:      []string{"artifact://thread-1/plan.md"},
		RequiredArtifacts: []string{"patch", "test_report"},
		ReplyTo:           "mailbox://architect/thread-1",
	}
	payload := mailboxActionPayload(event, "builder", "code_change")
	if payload["a2a_event_id"] != "evt-1" || payload["reply_to"] != "mailbox://architect/thread-1" {
		t.Fatalf("payload missed delegation fields: %#v", payload)
	}
	contract, ok := payload["action_contract"].(map[string]any)
	if !ok {
		t.Fatalf("missing action contract: %#v", payload)
	}
	if contract["owner"] != "builder" || contract["action_type"] != "code_change" || contract["a2a_thread_id"] != "thread-1" {
		t.Fatalf("unexpected action contract: %#v", contract)
	}
	commands, ok := contract["commands"].([]string)
	if !ok || len(commands) != 1 || commands[0] != "bash scripts/check-repository-policy.sh" {
		t.Fatalf("unexpected builder commands: %#v", contract["commands"])
	}
}
