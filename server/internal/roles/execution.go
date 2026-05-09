package roles

import "time"

type ExecutionStatus string

const (
	ExecutionQueued    ExecutionStatus = "queued"
	ExecutionRunning   ExecutionStatus = "running"
	ExecutionCompleted ExecutionStatus = "completed"
	ExecutionFailed    ExecutionStatus = "failed"
	ExecutionBlocked   ExecutionStatus = "blocked"
)

type RuntimeIssue struct {
	ActionID           string
	InvocationID       string
	WorkspaceID        string
	RoleName           string
	Title              string
	Objective          string
	Context            string
	AcceptanceCriteria []string
	TestCommands       []string
	BranchName         string
	SourceActionID     string
	SourceInvocationID string
	SourceRuntime      string
	SourceWorkspace    string
	SourceCommitSHA    string
}

type ExecutionReport struct {
	ActionID             string                `json:"action_id"`
	InvocationID         string                `json:"invocation_id"`
	Runtime              string                `json:"runtime"`
	Status               ExecutionStatus       `json:"status"`
	BranchName           string                `json:"branch_name"`
	CommitSHA            string                `json:"commit_sha"`
	ChangedFiles         []string              `json:"changed_files"`
	Logs                 string                `json:"logs"`
	Error                string                `json:"error"`
	WorkspaceDir         string                `json:"workspace_dir"`
	VerifiedFrom         string                `json:"verified_from"`
	VerificationEvidence *VerificationEvidence `json:"verification_evidence,omitempty"`
	StartedAt            time.Time             `json:"started_at"`
	FinishedAt           time.Time             `json:"finished_at"`
}

type VerificationEvidence struct {
	LocalCommands EvidenceCheck `json:"local_commands"`
	CI            EvidenceCheck `json:"ci"`
	Staging       EvidenceCheck `json:"staging"`
	Observability EvidenceCheck `json:"observability"`
	ArtifactGraph EvidenceCheck `json:"artifact_graph"`
}

type EvidenceCheck struct {
	Status  string `json:"status"`
	Source  string `json:"source,omitempty"`
	Summary string `json:"summary,omitempty"`
}

func (report ExecutionReport) fail(status ExecutionStatus, err error) ExecutionReport {
	report.Status = status
	report.Error = err.Error()
	report.FinishedAt = time.Now()
	return report
}
