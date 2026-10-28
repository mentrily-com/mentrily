package proctoring

import (
	"context"
	"testing"

	"github.com/redis/go-redis/v9"
)

// Redis down must surface as an error, never as a zero count that would skip
// tab-switch auto-terminate. (db is nil: the MGET error must return first.)
func TestViolationCountsFailClosed(t *testing.T) {
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", MaxRetries: -1})
	defer rdb.Close()
	g := &Gateway{rdb: rdb}
	ctx := context.Background()
	if _, _, err := g.violationCounts(ctx, "s1"); err == nil {
		t.Error("violationCounts: want error when Redis is down")
	}
	if n, err := g.incrCounter(ctx, "violation:count:in:s1"); err == nil {
		t.Errorf("incrCounter: got %d, want error", n)
	}
}
