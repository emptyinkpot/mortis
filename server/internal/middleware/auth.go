package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const (
	autoLoginEmailEnv         = "MULTICA_AUTO_LOGIN_EMAIL"
	autoLoginNameEnv          = "MULTICA_AUTO_LOGIN_NAME"
	autoLoginWorkspaceNameEnv = "MULTICA_AUTO_LOGIN_WORKSPACE_NAME"
	autoLoginWorkspaceSlugEnv = "MULTICA_AUTO_LOGIN_WORKSPACE_SLUG"
)

func uuidToString(u pgtype.UUID) string { return util.UUIDToString(u) }

type autoLoginConfig struct {
	Email         string
	Name          string
	WorkspaceName string
	WorkspaceSlug string
}

func readAutoLoginConfig() (autoLoginConfig, bool) {
	email := strings.ToLower(strings.TrimSpace(os.Getenv(autoLoginEmailEnv)))
	if email == "" {
		return autoLoginConfig{}, false
	}

	name := strings.TrimSpace(os.Getenv(autoLoginNameEnv))
	if name == "" {
		name = "Owner"
	}

	workspaceName := strings.TrimSpace(os.Getenv(autoLoginWorkspaceNameEnv))
	if workspaceName == "" {
		workspaceName = "Private Workspace"
	}

	workspaceSlug := strings.ToLower(strings.TrimSpace(os.Getenv(autoLoginWorkspaceSlugEnv)))
	if workspaceSlug == "" {
		workspaceSlug = "private"
	}

	return autoLoginConfig{
		Email:         email,
		Name:          name,
		WorkspaceName: workspaceName,
		WorkspaceSlug: workspaceSlug,
	}, true
}

func autoLoginIssuePrefix(cfg autoLoginConfig) string {
	source := cfg.WorkspaceName
	if strings.TrimSpace(source) == "" {
		source = cfg.WorkspaceSlug
	}

	var builder strings.Builder
	for _, r := range strings.ToUpper(source) {
		if r < 'A' || r > 'Z' {
			continue
		}
		builder.WriteRune(r)
		if builder.Len() == 3 {
			break
		}
	}

	if builder.Len() == 0 {
		return "WS"
	}
	return builder.String()
}

func issueAutoLoginToken(user db.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   uuidToString(user.ID),
		"email": user.Email,
		"name":  user.Name,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(30 * 24 * time.Hour).Unix(),
	})
	return token.SignedString(auth.JWTSecret())
}

func ensureAutoLoginIdentity(ctx context.Context, queries *db.Queries, cfg autoLoginConfig) (db.User, error) {
	user, err := queries.GetUserByEmail(ctx, cfg.Email)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, err
		}

		user, err = queries.CreateUser(ctx, db.CreateUserParams{
			Name:  cfg.Name,
			Email: cfg.Email,
		})
		if err != nil {
			user, err = queries.GetUserByEmail(ctx, cfg.Email)
			if err != nil {
				return db.User{}, err
			}
		}
	}

	if err := ensureAutoLoginWorkspace(ctx, queries, user, cfg); err != nil {
		return db.User{}, err
	}

	return user, nil
}

func ensureAutoLoginWorkspace(ctx context.Context, queries *db.Queries, user db.User, cfg autoLoginConfig) error {
	workspace, err := queries.GetWorkspaceBySlug(ctx, cfg.WorkspaceSlug)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}

		workspace, err = queries.CreateWorkspace(ctx, db.CreateWorkspaceParams{
			Name:        cfg.WorkspaceName,
			Slug:        cfg.WorkspaceSlug,
			Description: pgtype.Text{},
			Context:     pgtype.Text{},
			IssuePrefix: autoLoginIssuePrefix(cfg),
		})
		if err != nil {
			workspace, err = queries.GetWorkspaceBySlug(ctx, cfg.WorkspaceSlug)
			if err != nil {
				return err
			}
		}
	}

	params := db.GetMemberByUserAndWorkspaceParams{
		UserID:      user.ID,
		WorkspaceID: workspace.ID,
	}
	if _, err := queries.GetMemberByUserAndWorkspace(ctx, params); err == nil {
		return nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	_, err = queries.CreateMember(ctx, db.CreateMemberParams{
		WorkspaceID: workspace.ID,
		UserID:      user.ID,
		Role:        "owner",
	})
	if err != nil {
		if _, lookupErr := queries.GetMemberByUserAndWorkspace(ctx, params); lookupErr == nil {
			return nil
		}
		return err
	}

	return nil
}

func canAutoLoginRequest(r *http.Request) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	default:
		return false
	}
}

func maybeAutoLogin(w http.ResponseWriter, r *http.Request, queries *db.Queries) (*db.User, bool, error) {
	if queries == nil || !canAutoLoginRequest(r) {
		return nil, false, nil
	}

	cfg, ok := readAutoLoginConfig()
	if !ok {
		return nil, false, nil
	}

	user, err := ensureAutoLoginIdentity(r.Context(), queries, cfg)
	if err != nil {
		return nil, true, err
	}

	tokenString, err := issueAutoLoginToken(user)
	if err != nil {
		return nil, true, err
	}
	if err := auth.SetAuthCookies(w, tokenString); err != nil {
		slog.Warn("auth: failed to set auto-login cookies", "path", r.URL.Path, "error", err)
	}

	return &user, true, nil
}

// Auth middleware validates JWT tokens or Personal Access Tokens.
// Token sources (in priority order):
//  1. Authorization: Bearer <token> header (PAT or JWT)
//  2. multica_auth HttpOnly cookie (JWT) — requires valid CSRF token for state-changing requests
//
// Sets X-User-ID and X-User-Email headers on the request for downstream handlers.
func Auth(queries *db.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString, fromCookie := extractToken(r)
			if tokenString == "" {
				user, autoLoginUsed, err := maybeAutoLogin(w, r, queries)
				if err != nil {
					slog.Error("auth: auto-login failed", "path", r.URL.Path, "error", err)
					http.Error(w, `{"error":"auto login failed"}`, http.StatusInternalServerError)
					return
				}
				if autoLoginUsed {
					r.Header.Set("X-User-ID", uuidToString(user.ID))
					r.Header.Set("X-User-Email", user.Email)
					next.ServeHTTP(w, r)
					return
				}

				slog.Debug("auth: no token found", "path", r.URL.Path)
				http.Error(w, `{"error":"missing authorization"}`, http.StatusUnauthorized)
				return
			}

			// Cookie-based auth requires CSRF validation for state-changing methods.
			if fromCookie && !auth.ValidateCSRF(r) {
				slog.Debug("auth: CSRF validation failed", "path", r.URL.Path)
				http.Error(w, `{"error":"CSRF validation failed"}`, http.StatusForbidden)
				return
			}

			// PAT: tokens starting with "mul_"
			if strings.HasPrefix(tokenString, "mul_") {
				if queries == nil {
					http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
					return
				}
				hash := auth.HashToken(tokenString)
				pat, err := queries.GetPersonalAccessTokenByHash(r.Context(), hash)
				if err != nil {
					slog.Warn("auth: invalid PAT", "path", r.URL.Path, "error", err)
					http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
					return
				}

				r.Header.Set("X-User-ID", uuidToString(pat.UserID))

				// Best-effort: update last_used_at
				go queries.UpdatePersonalAccessTokenLastUsed(context.Background(), pat.ID)

				next.ServeHTTP(w, r)
				return
			}

			// JWT
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return auth.JWTSecret(), nil
			})
			if err != nil || !token.Valid {
				if fromCookie {
					user, autoLoginUsed, autoLoginErr := maybeAutoLogin(w, r, queries)
					if autoLoginErr != nil {
						slog.Error("auth: auto-login failed after invalid cookie token", "path", r.URL.Path, "error", autoLoginErr)
						http.Error(w, `{"error":"auto login failed"}`, http.StatusInternalServerError)
						return
					}
					if autoLoginUsed {
						r.Header.Set("X-User-ID", uuidToString(user.ID))
						r.Header.Set("X-User-Email", user.Email)
						next.ServeHTTP(w, r)
						return
					}
				}
				slog.Warn("auth: invalid token", "path", r.URL.Path, "error", err)
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				slog.Warn("auth: invalid claims", "path", r.URL.Path)
				http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
				return
			}

			sub, ok := claims["sub"].(string)
			if !ok || strings.TrimSpace(sub) == "" {
				slog.Warn("auth: invalid claims", "path", r.URL.Path)
				http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
				return
			}
			r.Header.Set("X-User-ID", sub)
			if email, ok := claims["email"].(string); ok {
				r.Header.Set("X-User-Email", email)
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractToken returns the bearer token and whether it came from a cookie.
// Priority: Authorization header > multica_auth cookie.
func extractToken(r *http.Request) (token string, fromCookie bool) {
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString != authHeader {
			return tokenString, false
		}
	}

	if cookie, err := r.Cookie(auth.AuthCookieName); err == nil && cookie.Value != "" {
		return cookie.Value, true
	}

	return "", false
}
