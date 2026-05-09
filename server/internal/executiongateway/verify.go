package executiongateway

import "fmt"

func ApplyVerification(
	req ExecutionRequest,
	raw map[string]any,
	artifacts []Artifact,
) (ExecutionResult, error) {
	ok, _ := raw["ok"].(bool)
	if !ok {
		msg, _ := raw["error"].(string)
		if msg == "" {
			msg = "browser action returned ok=false"
		}
		return ExecutionResult{
			OK:        false,
			Status:    "failed",
			Action:    req.Action,
			Message:   msg,
			Artifacts: artifacts,
			Raw:       raw,
		}, nil
	}

	if req.Verification.RequireVerified {
		verified, _ := raw["verified"].(map[string]any)
		vr, _ := verified["verificationResult"].(string)
		if vr != "ok" {
			if vr == "" {
				vr = "missing verification result"
			}
			return ExecutionResult{
				OK:        false,
				Status:    "failed",
				Action:    req.Action,
				Message:   fmt.Sprintf("verification failed: %s", vr),
				Artifacts: artifacts,
				Raw:       raw,
			}, nil
		}
	}

	if req.Verification.RequireArtifact && len(artifacts) == 0 {
		return ExecutionResult{
			OK:        false,
			Status:    "blocked",
			Action:    req.Action,
			Message:   "verification artifact missing",
			Artifacts: artifacts,
			Raw:       raw,
		}, nil
	}

	level := "V2"
	if req.Verification.RequireVerified {
		level = "V3"
	}

	return ExecutionResult{
		OK:                true,
		Status:            "verified",
		Action:            req.Action,
		Message:           "browser action verified",
		VerificationLevel: level,
		Artifacts:         artifacts,
		Raw:               raw,
	}, nil
}
