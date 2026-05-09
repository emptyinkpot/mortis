package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	_ "github.com/go-sql-driver/mysql"
	"github.com/multica-ai/multica/server/internal/logger"
)

const (
	napcatAccountsJSONEnv           = "MORTIS_NAPCAT_ACCOUNTS_JSON"
	napcatAccountsFileEnv           = "MORTIS_NAPCAT_ACCOUNTS_FILE"
	napcatAccountsMySQLDSNEnv       = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_DSN"
	napcatAccountsMySQLHostEnv      = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_HOST"
	napcatAccountsMySQLPortEnv      = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_PORT"
	napcatAccountsMySQLUserEnv      = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_USER"
	napcatAccountsMySQLPasswordEnv  = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_PASSWORD"
	napcatAccountsMySQLDatabaseEnv  = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_DATABASE"
	napcatAccountsMySQLTableEnv     = "MORTIS_NAPCAT_ACCOUNTS_MYSQL_TABLE"
	defaultNapcatAccountsMySQLPort  = "3306"
	defaultNapcatAccountsMySQLTable = "mortis_napcat_accounts"
)

var mysqlIdentifierPattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

type NapcatAccountResponse struct {
	Key         string            `json:"key"`
	Label       string            `json:"label"`
	Description string            `json:"description"`
	QQName      string            `json:"qq_name"`
	QQUin       string            `json:"qq_uin"`
	Enabled     bool              `json:"enabled"`
	Env         map[string]string `json:"env"`
}

type napcatAccountConfig struct {
	Key         string            `json:"key"`
	Label       string            `json:"label"`
	Description string            `json:"description"`
	QQName      string            `json:"qq_name"`
	QQUin       string            `json:"qq_uin"`
	Enabled     *bool             `json:"enabled"`
	Env         map[string]string `json:"env"`
}

type napcatAccountDatabaseRow struct {
	Key         string
	Label       string
	Description sql.NullString
	QQName      sql.NullString
	QQUin       sql.NullString
	Enabled     bool
	EnvJSON     []byte
}

func normalizeNapcatAccountEnv(values map[string]string) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}

	normalized := make(map[string]string, len(values))
	for key, value := range values {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		normalized[trimmedKey] = trimmedValue
	}
	return normalized
}

func parseNapcatAccounts(payload []byte) ([]NapcatAccountResponse, error) {
	var configs []napcatAccountConfig
	if err := json.Unmarshal(payload, &configs); err != nil {
		return nil, err
	}

	accounts := make([]NapcatAccountResponse, 0, len(configs))
	for idx, config := range configs {
		key := strings.TrimSpace(config.Key)
		if key == "" {
			return nil, fmt.Errorf("napcat account at index %d is missing key", idx)
		}

		label := strings.TrimSpace(config.Label)
		if label == "" {
			label = key
		}

		enabled := true
		if config.Enabled != nil {
			enabled = *config.Enabled
		}

		accounts = append(accounts, NapcatAccountResponse{
			Key:         key,
			Label:       label,
			Description: strings.TrimSpace(config.Description),
			QQName:      strings.TrimSpace(config.QQName),
			QQUin:       strings.TrimSpace(config.QQUin),
			Enabled:     enabled,
			Env:         normalizeNapcatAccountEnv(config.Env),
		})
	}

	return accounts, nil
}

func parseNapcatAccountDatabaseRows(rows []napcatAccountDatabaseRow) ([]NapcatAccountResponse, error) {
	accounts := make([]NapcatAccountResponse, 0, len(rows))
	for idx, row := range rows {
		key := strings.TrimSpace(row.Key)
		if key == "" {
			return nil, fmt.Errorf("napcat mysql account at index %d is missing key", idx)
		}

		label := strings.TrimSpace(row.Label)
		if label == "" {
			label = key
		}

		env := map[string]string{}
		if len(row.EnvJSON) > 0 {
			if err := json.Unmarshal(row.EnvJSON, &env); err != nil {
				return nil, fmt.Errorf("parse mysql env_json for %s: %w", key, err)
			}
		}

		accounts = append(accounts, NapcatAccountResponse{
			Key:         key,
			Label:       label,
			Description: strings.TrimSpace(row.Description.String),
			QQName:      strings.TrimSpace(row.QQName.String),
			QQUin:       strings.TrimSpace(row.QQUin.String),
			Enabled:     row.Enabled,
			Env:         normalizeNapcatAccountEnv(env),
		})
	}

	return accounts, nil
}

func valueOrDefault(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

func buildLegacyNapcatAccountFallback() []NapcatAccountResponse {
	label := strings.TrimSpace(os.Getenv("MORTIS_QQ_DEFAULT_LABEL"))
	if label == "" {
		label = "默认 QQ"
	}

	env := normalizeNapcatAccountEnv(map[string]string{
		"NAPCAT_API_URL": valueOrDefault(
			strings.TrimSpace(os.Getenv("MORTIS_QQ_ONEBOT_HTTP_URL")),
			"http://127.0.0.1:3600",
		),
		"NAPCAT_TRANSPORT": valueOrDefault(
			strings.TrimSpace(os.Getenv("MORTIS_QQ_TRANSPORT")),
			"webui",
		),
		"NAPCAT_WEBUI_URL": valueOrDefault(
			strings.TrimSpace(os.Getenv("MORTIS_QQ_WEBUI_URL")),
			"http://127.0.0.1:16099",
		),
		"NAPCAT_WEBUI_TOKEN": strings.TrimSpace(os.Getenv("MORTIS_QQ_WEBUI_TOKEN")),
		"NAPCAT_WEBUI_CONFIG_PATH": valueOrDefault(
			strings.TrimSpace(os.Getenv("MORTIS_QQ_WEBUI_CONFIG_PATH")),
			"/home/ubuntu/napcat/data/config/webui.json",
		),
	})

	return []NapcatAccountResponse{
		{
			Key:         "default",
			Label:       label,
			Description: "当前 Mortis 现有的默认 QQ / NapCat 发信入口。",
			QQName:      strings.TrimSpace(os.Getenv("MORTIS_QQ_NAME")),
			QQUin:       strings.TrimSpace(os.Getenv("MORTIS_QQ_UIN")),
			Enabled:     true,
			Env:         env,
		},
	}
}

func loadNapcatAccountsFromMySQL(ctx context.Context) ([]NapcatAccountResponse, error) {
	dsn := strings.TrimSpace(os.Getenv(napcatAccountsMySQLDSNEnv))
	if dsn == "" {
		host := strings.TrimSpace(os.Getenv(napcatAccountsMySQLHostEnv))
		user := strings.TrimSpace(os.Getenv(napcatAccountsMySQLUserEnv))
		password := strings.TrimSpace(os.Getenv(napcatAccountsMySQLPasswordEnv))
		databaseName := strings.TrimSpace(os.Getenv(napcatAccountsMySQLDatabaseEnv))
		if host == "" || user == "" || databaseName == "" {
			return nil, nil
		}

		port := strings.TrimSpace(os.Getenv(napcatAccountsMySQLPortEnv))
		if port == "" {
			port = defaultNapcatAccountsMySQLPort
		}

		dsn = fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true",
			user,
			password,
			host,
			port,
			databaseName,
		)
	}

	tableName := strings.TrimSpace(os.Getenv(napcatAccountsMySQLTableEnv))
	if tableName == "" {
		tableName = defaultNapcatAccountsMySQLTable
	}
	if !mysqlIdentifierPattern.MatchString(tableName) {
		return nil, fmt.Errorf("invalid %s: %q", napcatAccountsMySQLTableEnv, tableName)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()

	rows, err := db.QueryContext(
		ctx,
		fmt.Sprintf(
			"SELECT account_key, label, description, qq_name, qq_uin, enabled, env_json FROM `%s` ORDER BY sort_order ASC, account_key ASC",
			tableName,
		),
	)
	if err != nil {
		return nil, fmt.Errorf("query mysql napcat accounts: %w", err)
	}
	defer rows.Close()

	records := []napcatAccountDatabaseRow{}
	for rows.Next() {
		var record napcatAccountDatabaseRow
		if err := rows.Scan(
			&record.Key,
			&record.Label,
			&record.Description,
			&record.QQName,
			&record.QQUin,
			&record.Enabled,
			&record.EnvJSON,
		); err != nil {
			return nil, fmt.Errorf("scan mysql napcat account row: %w", err)
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate mysql napcat accounts: %w", err)
	}

	return parseNapcatAccountDatabaseRows(records)
}

func loadConfiguredNapcatAccounts(ctx context.Context) ([]NapcatAccountResponse, error) {
	accounts, err := loadNapcatAccountsFromMySQL(ctx)
	if err != nil {
		return nil, err
	}
	if accounts != nil {
		return accounts, nil
	}

	if filePath := strings.TrimSpace(os.Getenv(napcatAccountsFileEnv)); filePath != "" {
		payload, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", napcatAccountsFileEnv, err)
		}
		accounts, err := parseNapcatAccounts(payload)
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", napcatAccountsFileEnv, err)
		}
		return accounts, nil
	}

	if raw := strings.TrimSpace(os.Getenv(napcatAccountsJSONEnv)); raw != "" {
		accounts, err := parseNapcatAccounts([]byte(raw))
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", napcatAccountsJSONEnv, err)
		}
		return accounts, nil
	}

	return buildLegacyNapcatAccountFallback(), nil
}

func (h *Handler) ListAgentNapcatAccounts(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "id")
	agent, ok := h.loadAgentForUser(w, r, agentID)
	if !ok {
		return
	}
	if !h.canManageAgent(w, r, agent) {
		return
	}

	accounts, err := loadConfiguredNapcatAccounts(r.Context())
	if err != nil {
		slog.Warn("load napcat accounts failed", append(logger.RequestAttrs(r), "error", err, "agent_id", agentID)...)
		writeError(w, http.StatusInternalServerError, "failed to load napcat accounts")
		return
	}

	writeJSON(w, http.StatusOK, accounts)
}
