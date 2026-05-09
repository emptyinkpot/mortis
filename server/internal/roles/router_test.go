package roles

import "testing"

func TestRouteMessageRoutesExecutableQQWorkToBuilder(t *testing.T) {
	route := RouteMessage("修一下 Builder 不回复的问题，看看日志和源码", "qq", routeTestCandidates())

	if route.RoleName != "builder" {
		t.Fatalf("role=%q, want builder", route.RoleName)
	}
	if route.CommandType != "code_change" {
		t.Fatalf("commandType=%q, want code_change", route.CommandType)
	}
	if route.RiskLevel != "low" || route.RequiresApproval {
		t.Fatalf("unexpected risk/approval: %#v", route)
	}
}

func TestRouteMessageRoutesVerificationQQWorkToTester(t *testing.T) {
	route := RouteMessage("跑测试并输出 verification_report", "qq", routeTestCandidates())

	if route.RoleName != "tester" {
		t.Fatalf("role=%q, want tester", route.RoleName)
	}
	if route.CommandType != "test_execution" {
		t.Fatalf("commandType=%q, want test_execution", route.CommandType)
	}
	if route.RiskLevel != "low" || route.RequiresApproval {
		t.Fatalf("unexpected risk/approval: %#v", route)
	}
}

func TestRouteMessageKeepsHighRiskApproval(t *testing.T) {
	route := RouteMessage("部署生产环境", "qq", routeTestCandidates())

	if route.CommandType != "deploy_production" {
		t.Fatalf("commandType=%q, want deploy_production", route.CommandType)
	}
	if route.RiskLevel != "high" || !route.RequiresApproval {
		t.Fatalf("expected high-risk approval route, got %#v", route)
	}
}

func TestRouteMessageRoutesEnglishRepositoryFileWorkToBuilder(t *testing.T) {
	route := RouteMessage("Builder task: modify repository file docs/operations/proof.md", "telegram", routeTestCandidates())

	if route.RoleName != "builder" {
		t.Fatalf("role=%q, want builder", route.RoleName)
	}
	if route.CommandType != "code_change" {
		t.Fatalf("commandType=%q, want code_change", route.CommandType)
	}
	if route.RiskLevel != "low" || route.RequiresApproval {
		t.Fatalf("unexpected risk/approval: %#v", route)
	}
}

func routeTestCandidates() []Candidate {
	return []Candidate{
		{ID: "manager-id", Name: "manager", Title: "Manager AI"},
		{ID: "builder-id", Name: "builder", Title: "Builder AI"},
		{ID: "tester-id", Name: "tester", Title: "Tester AI"},
	}
}
