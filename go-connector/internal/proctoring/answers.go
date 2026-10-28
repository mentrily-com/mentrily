package proctoring

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strings"
	"unicode/utf16"
)

// Port of backend session-answers.util.ts answerPatchError; keep in sync.
const (
	maxPatchKeys  = 500
	maxKeyLength  = 200
	maxValueBytes = 256 * 1024
)

var (
	serverOnlyKeys   = map[string]bool{"_internal_marks": true, "_internal_score": true, "_internal_metadata": true}
	sectionSubmitKey = regexp.MustCompile(`^_section_.+_submitted$`)
)

// answerPatchError says why a client answer patch must be rejected, or "" if it's fine.
func answerPatchError(answer any) string {
	m, ok := answer.(map[string]any)
	if !ok || m == nil {
		return "INVALID_ANSWER"
	}
	if len(m) > maxPatchKeys {
		return "TOO_MANY_ANSWERS"
	}
	if hasNUL(m) {
		return "INVALID_ANSWER"
	}
	for k, v := range m {
		// JS string length counts UTF-16 code units.
		if len(utf16.Encode([]rune(k))) > maxKeyLength || serverOnlyKeys[k] || strings.HasPrefix(k, "_internal_coding:") {
			return "INVALID_ANSWER_KEY"
		}
		if sectionSubmitKey.MatchString(k) && v != true {
			return "INVALID_ANSWER_KEY"
		}
		if n, err := jsonSize(v); err != nil || n > maxValueBytes {
			return "ANSWER_TOO_LARGE"
		}
	}
	return ""
}

// jsonSize is len(JSON.stringify(v)): no HTML escaping of <>&.
func jsonSize(v any) (int, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return 0, err
	}
	return buf.Len() - 1, nil // Encode appends '\n'
}

// hasNUL: Postgres jsonb rejects \u0000, which would poison the answer flush.
func hasNUL(v any) bool {
	switch t := v.(type) {
	case string:
		return strings.ContainsRune(t, 0)
	case map[string]any:
		for k, e := range t {
			if strings.ContainsRune(k, 0) || hasNUL(e) {
				return true
			}
		}
	case []any:
		for _, e := range t {
			if hasNUL(e) {
				return true
			}
		}
	}
	return false
}
