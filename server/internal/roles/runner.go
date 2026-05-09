package roles

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type CommandOutput struct {
	Stdout string
	Stderr string
}

type CommandRunner interface {
	Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error)
	RunShell(ctx context.Context, dir string, command string) (CommandOutput, error)
}

type LocalCommandRunner struct{}

func (LocalCommandRunner) Run(ctx context.Context, dir string, name string, args ...string) (CommandOutput, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := CommandOutput{Stdout: stdout.String(), Stderr: stderr.String()}
	return out, wrapCommandError(name, args, out, err)
}

func (LocalCommandRunner) RunShell(ctx context.Context, dir string, command string) (CommandOutput, error) {
	name := "sh"
	args := []string{"-lc", command}
	if runtime.GOOS == "windows" {
		name = "powershell"
		args = []string{"-NoProfile", "-Command", command}
	}
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := CommandOutput{Stdout: stdout.String(), Stderr: stderr.String()}
	return out, wrapShellError(command, out, err)
}

func wrapCommandError(name string, args []string, out CommandOutput, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("command failed: %s %s: %w\nstdout:\n%s\nstderr:\n%s", name, strings.Join(args, " "), err, out.Stdout, out.Stderr)
}

func wrapShellError(command string, out CommandOutput, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("shell command failed: %s: %w\nstdout:\n%s\nstderr:\n%s", command, err, out.Stdout, out.Stderr)
}
