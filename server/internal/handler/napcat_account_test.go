package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func setTestEnv(t *testing.T, key string, value *string) {
	t.Helper()

	previous, hadPrevious := os.LookupEnv(key)
	t.Cleanup(func() {
		if hadPrevious {
			_ = os.Setenv(key, previous)
			return
		}
		_ = os.Unsetenv(key)
	})

	if value == nil {
		_ = os.Unsetenv(key)
		return
	}

	_ = os.Setenv(key, *value)
}

func TestLoadConfiguredNapcatAccountsFromJSON(t *testing.T) {
	jsonValue := `[{"key":"qq-a","label":"QQ A","qq_name":"Display Name A","qq_uin":"1915791855","description":"primary","enabled":true,"env":{"NAPCAT_WEBUI_URL":"http://127.0.0.1:16099","NAPCAT_WEBUI_CONFIG_PATH":"/tmp/a.json"}}]`
	setTestEnv(t, napcatAccountsJSONEnv, &jsonValue)
	setTestEnv(t, napcatAccountsFileEnv, nil)
	setTestEnv(t, napcatAccountsMySQLDSNEnv, nil)
	setTestEnv(t, napcatAccountsMySQLHostEnv, nil)
	setTestEnv(t, napcatAccountsMySQLUserEnv, nil)
	setTestEnv(t, napcatAccountsMySQLDatabaseEnv, nil)

	accounts, err := loadConfiguredNapcatAccounts(t.Context())
	if err != nil {
		t.Fatalf("loadConfiguredNapcatAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Key != "qq-a" {
		t.Fatalf("expected key qq-a, got %s", accounts[0].Key)
	}
	if accounts[0].QQName != "Display Name A" {
		t.Fatalf("expected qq_name Display Name A, got %s", accounts[0].QQName)
	}
	if accounts[0].Env["NAPCAT_WEBUI_URL"] != "http://127.0.0.1:16099" {
		t.Fatalf("expected env to include NAPCAT_WEBUI_URL, got %#v", accounts[0].Env)
	}
}

func TestParseNapcatAccountDatabaseRows(t *testing.T) {
	accounts, err := parseNapcatAccountDatabaseRows([]napcatAccountDatabaseRow{
		{
			Key:         "qq-db-1",
			Label:       "QQ DB 1",
			Description: nullString("shared mysql"),
			QQName:      nullString("Display Name DB"),
			QQUin:       nullString("2264869713"),
			Enabled:     true,
			EnvJSON:     []byte(`{"NAPCAT_API_URL":"http://127.0.0.1:3600","NAPCAT_WEBUI_URL":"http://127.0.0.1:16099"}`),
		},
	})
	if err != nil {
		t.Fatalf("parseNapcatAccountDatabaseRows: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Key != "qq-db-1" {
		t.Fatalf("expected key qq-db-1, got %s", accounts[0].Key)
	}
	if accounts[0].QQUin != "2264869713" {
		t.Fatalf("expected qq_uin 2264869713, got %s", accounts[0].QQUin)
	}
	if accounts[0].QQName != "Display Name DB" {
		t.Fatalf("expected qq_name Display Name DB, got %s", accounts[0].QQName)
	}
	if accounts[0].Env["NAPCAT_API_URL"] != "http://127.0.0.1:3600" {
		t.Fatalf("unexpected env %#v", accounts[0].Env)
	}
}

func TestListAgentNapcatAccounts(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Napcat Account Test Agent", nil)
	jsonValue := `[{"key":"qq-b","label":"QQ B","qq_name":"Bread","qq_uin":"20002","enabled":true,"env":{"NAPCAT_API_URL":"http://127.0.0.1:3610","NAPCAT_WEBUI_URL":"http://127.0.0.1:16109"}}]`
	setTestEnv(t, napcatAccountsJSONEnv, &jsonValue)
	setTestEnv(t, napcatAccountsFileEnv, nil)
	setTestEnv(t, napcatAccountsMySQLDSNEnv, nil)
	setTestEnv(t, napcatAccountsMySQLHostEnv, nil)
	setTestEnv(t, napcatAccountsMySQLUserEnv, nil)
	setTestEnv(t, napcatAccountsMySQLDatabaseEnv, nil)

	req := withURLParam(newRequest("GET", "/api/agents/"+agentID+"/napcat-accounts?workspace_id="+testWorkspaceID, nil), "id", agentID)
	w := httptest.NewRecorder()

	testHandler.ListAgentNapcatAccounts(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAgentNapcatAccounts: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var accounts []NapcatAccountResponse
	if err := json.NewDecoder(w.Body).Decode(&accounts); err != nil {
		t.Fatalf("ListAgentNapcatAccounts: decode response: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("ListAgentNapcatAccounts: expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Key != "qq-b" {
		t.Fatalf("ListAgentNapcatAccounts: expected key qq-b, got %s", accounts[0].Key)
	}
	if accounts[0].QQName != "Bread" {
		t.Fatalf("ListAgentNapcatAccounts: expected qq_name Bread, got %s", accounts[0].QQName)
	}
	if accounts[0].Env["NAPCAT_API_URL"] != "http://127.0.0.1:3610" {
		t.Fatalf("ListAgentNapcatAccounts: unexpected env %#v", accounts[0].Env)
	}
}

func nullString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}
