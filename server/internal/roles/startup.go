package roles

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartBuilderDispatcherFromEnv(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	if os.Getenv("MORTIS_ROLE_DISPATCHER_ENABLED") != "true" {
		return nil
	}
	if log == nil {
		log = slog.Default()
	}

	interval := 2 * time.Second
	if raw := os.Getenv("MORTIS_ROLE_DISPATCH_INTERVAL_SECONDS"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			interval = time.Duration(seconds) * time.Second
		}
	}
	codexTimeout := 15 * time.Minute
	if raw := os.Getenv("MORTIS_CODEX_TIMEOUT_SECONDS"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			codexTimeout = time.Duration(seconds) * time.Second
		}
	}
	codexMaxAttempts := 2
	if raw := os.Getenv("MORTIS_CODEX_MAX_ATTEMPTS"); raw != "" {
		if attempts, err := strconv.Atoi(raw); err == nil && attempts > 0 {
			codexMaxAttempts = attempts
		}
	}

	builder, err := NewBuilderRuntime(BuilderRuntimeConfig{
		Logger:              log,
		RepoURL:             getenvDefault("MORTIS_ROLE_REPO_URL", "git@github.com:emptyinkpot/mortis.git"),
		BaseBranch:          getenvDefault("MORTIS_ROLE_BASE_BRANCH", "mortis/operator-runtime"),
		WorkRoot:            getenvDefault("MORTIS_AGENT_WORK_ROOT", "/srv/multica/agent-workspaces"),
		CodexBin:            getenvDefault("MORTIS_CODEX_BIN", "codex"),
		CodexModel:          os.Getenv("MORTIS_CODEX_MODEL"),
		CodexTimeout:        codexTimeout,
		CodexMaxAttempts:    codexMaxAttempts,
		CodexContainerImage: os.Getenv("MORTIS_BUILDER_CONTAINER_IMAGE"),
		CodexHome:           os.Getenv("MORTIS_CODEX_HOME"),
		CodexBypassSandbox:  os.Getenv("MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX") == "true",
		GitUser:             getenvDefault("MORTIS_ROLE_GIT_USER", "Mortis Builder AI"),
		GitEmail:            getenvDefault("MORTIS_ROLE_GIT_EMAIL", "builder@mortis.local"),
	})
	if err != nil {
		return err
	}
	tester, err := NewTesterRuntime(TesterRuntimeConfig{
		Logger:           log,
		RepoURL:          getenvDefault("MORTIS_ROLE_REPO_URL", "git@github.com:emptyinkpot/mortis.git"),
		BaseBranch:       getenvDefault("MORTIS_ROLE_BASE_BRANCH", "mortis/operator-runtime"),
		WorkRoot:         getenvDefault("MORTIS_AGENT_WORK_ROOT", "/srv/multica/agent-workspaces"),
		GitUser:          getenvDefault("MORTIS_TESTER_GIT_USER", "Mortis Tester AI"),
		GitEmail:         getenvDefault("MORTIS_TESTER_GIT_EMAIL", "tester@mortis.local"),
		TestTimeout:      codexTimeout,
		CIStatusSource:   os.Getenv("MORTIS_CI_STATUS_SOURCE"),
		StagingURL:       os.Getenv("MORTIS_STAGING_URL"),
		ObservabilityURL: os.Getenv("MORTIS_OBSERVABILITY_URL"),
	})
	if err != nil {
		return err
	}
	dispatcher, err := NewDispatcher(DispatcherConfig{
		Logger:   log,
		Store:    NewSQLActionStore(pool),
		Runtimes: []AgentRuntime{builder, tester},
		Interval: interval,
	})
	if err != nil {
		return err
	}

	go func() {
		log.Info("starting role dispatcher", "interval", interval, "codex_timeout", codexTimeout, "codex_max_attempts", codexMaxAttempts, "builder_container_image", os.Getenv("MORTIS_BUILDER_CONTAINER_IMAGE"), "codex_bypass_sandbox", os.Getenv("MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX") == "true", "runtimes", []string{builder.Name(), tester.Name()})
		if err := dispatcher.Run(ctx); err != nil && ctx.Err() == nil {
			log.Error("role dispatcher stopped", "error", err)
		}
	}()
	if os.Getenv("MORTIS_MAILBOX_CONSUMER_ENABLED") == "true" {
		consumer, err := NewMailboxConsumer(MailboxConsumerConfig{
			Logger:      log,
			Pool:        pool,
			RuntimeRoot: getenvDefault("MORTIS_RUNTIME_ROOT", ".runtime"),
			Interval:    interval,
		})
		if err != nil {
			return err
		}
		go func() {
			log.Info("starting mailbox consumer", "interval", interval, "runtime_root", getenvDefault("MORTIS_RUNTIME_ROOT", ".runtime"))
			if err := consumer.Run(ctx); err != nil && ctx.Err() == nil {
				log.Error("mailbox consumer stopped", "error", err)
			}
		}()
	}
	return nil
}

func getenvDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
