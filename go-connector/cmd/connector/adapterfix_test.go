package main

import "testing"

func TestWithEmptyResults(t *testing.T) {
	for in, want := range map[string]string{
		`{"requestId":"abc"}`:                         `{"requestId":"abc","sockets":[],"rooms":[]}`,
		`{"requestId":"abc","sockets":[{"id":"s1"}]}`: `{"requestId":"abc","sockets":[{"id":"s1"}]}`,
		`{"requestId":"abc","rooms":["r"]}`:           `{"requestId":"abc","rooms":["r"]}`,
		`{"requestId":"abc","data":[1]}`:              `{"requestId":"abc","data":[1]}`,
		"\x82\xa9requestId":                           "\x82\xa9requestId",
	} {
		if got := string(withEmptyResults([]byte(in))); got != want {
			t.Errorf("%s: got %s want %s", in, got, want)
		}
	}
}
