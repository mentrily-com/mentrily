package proctoring

import (
	"fmt"
	"strings"
	"testing"
)

func TestAnswerPatchError(t *testing.T) {
	many := map[string]any{}
	for i := 0; i < 501; i++ {
		many[fmt.Sprintf("q%d", i)] = 1
	}
	cases := []struct {
		name string
		in   any
		want string
	}{
		{"client payload", map[string]any{"q1": "q1-opt-2", "_rev_q1": true, "_internal_position": map[string]any{"section": 1}, "_section_s1_submitted": true}, ""},
		{"grading key", map[string]any{"_internal_score": map[string]any{"percentage": 100}}, "INVALID_ANSWER_KEY"},
		{"server coding result", map[string]any{"_internal_coding:q1": map[string]any{"passed": 2, "total": 2}}, "INVALID_ANSWER_KEY"},
		{"reopen section", map[string]any{"_section_s1_submitted": false}, "INVALID_ANSWER_KEY"},
		{"huge value", map[string]any{"junk": strings.Repeat("A", 300_000)}, "ANSWER_TOO_LARGE"},
		{"too many keys", many, "TOO_MANY_ANSWERS"},
		{"null", nil, "INVALID_ANSWER"},
		{"array", []any{"q1"}, "INVALID_ANSWER"},
		{"NUL in value", map[string]any{"q1": map[string]any{"code": []any{"a\x00b"}}}, "INVALID_ANSWER"},
		{"NUL in nested key", map[string]any{"q1": map[string]any{"k\x00": 1}}, "INVALID_ANSWER"},
		{"NUL in key", map[string]any{"q\x00": 1}, "INVALID_ANSWER"},
		// 256KiB of '<' is 256KiB in JSON.stringify; HTML escaping would make it 6x.
		{"html chars not inflated", map[string]any{"q1": strings.Repeat("<", maxValueBytes-2)}, ""},
		{"just over size", map[string]any{"q1": strings.Repeat("a", maxValueBytes-1)}, "ANSWER_TOO_LARGE"},
		// 100 astral chars = 200 UTF-16 units (ok); 101 = 202 (too long).
		{"key 200 utf16 units", map[string]any{strings.Repeat("\U0001F600", 100): 1}, ""},
		{"key 202 utf16 units", map[string]any{strings.Repeat("\U0001F600", 101): 1}, "INVALID_ANSWER_KEY"},
	}
	for _, c := range cases {
		if got := answerPatchError(c.in); got != c.want {
			t.Errorf("%s: got %q want %q", c.name, got, c.want)
		}
	}
}
