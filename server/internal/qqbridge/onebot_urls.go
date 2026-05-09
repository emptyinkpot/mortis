package qqbridge

import (
	"encoding/json"
	"strings"
)

func parseOneBotURLMap(raw string) map[string]string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	var jsonMap map[string]string
	if err := json.Unmarshal([]byte(raw), &jsonMap); err == nil {
		return normalizeOneBotURLMap(jsonMap)
	}

	out := map[string]string{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		key, value, ok := strings.Cut(part, "=")
		if !ok {
			key, value, ok = strings.Cut(part, ":")
		}
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimRight(strings.TrimSpace(value), "/")
		if key != "" && value != "" {
			out[key] = value
		}
	}
	return out
}

func normalizeOneBotURLMap(values map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range values {
		key = strings.TrimSpace(key)
		value = strings.TrimRight(strings.TrimSpace(value), "/")
		if key != "" && value != "" {
			out[key] = value
		}
	}
	return out
}
