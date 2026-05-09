package executiongateway

import "testing"

func TestApplyVerification_RequireArtifactMissing(t *testing.T) {
	req := ExecutionRequest{
		Action: ActionBrowserRun,
		Verification: VerificationSpec{
			RequireArtifact: true,
			RequireVerified: true,
		},
	}

	raw := map[string]any{
		"ok": true,
		"verified": map[string]any{
			"verificationResult": "ok",
		},
	}

	res, err := ApplyVerification(req, raw, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != "blocked" {
		t.Fatalf("expected blocked, got %s", res.Status)
	}
}

func TestApplyVerification_VerifiedSuccess(t *testing.T) {
	req := ExecutionRequest{
		Action: ActionBrowserRun,
		Verification: VerificationSpec{
			RequireArtifact: true,
			RequireVerified: true,
		},
	}

	raw := map[string]any{
		"ok": true,
		"verified": map[string]any{
			"verificationResult": "ok",
		},
	}

	arts := []Artifact{
		{Kind: "screenshot", Path: `C:\tmp\verified.png`},
	}

	res, err := ApplyVerification(req, raw, arts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != "verified" {
		t.Fatalf("expected verified, got %s", res.Status)
	}
	if res.VerificationLevel != "V3" {
		t.Fatalf("expected V3, got %s", res.VerificationLevel)
	}
}
