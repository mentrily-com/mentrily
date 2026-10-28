package main

import (
	"bytes"
	"context"
	"strings"

	"github.com/redis/go-redis/v9"
)

// adapterResponseFix works around a wire mismatch between the Go and Node
// Redis adapters. Go tags Response.Sockets/Rooms `omitempty`, so a server with
// no matching sockets replies {"requestId":"…"}. Node's @socket.io/redis-adapter
// counts that reply, then returns before resolving because "sockets" isn't an
// array: whenever the Go reply arrives last, Nest's fetchSockets() (takeover
// kick, forceTerminate) times out. Adding the empty arrays makes the reply
// one that Node accepts.
type adapterResponseFix struct{}

func (adapterResponseFix) DialHook(next redis.DialHook) redis.DialHook { return next }

func (adapterResponseFix) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

func (adapterResponseFix) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		if args := cmd.Args(); len(args) == 3 && strings.EqualFold(cmd.Name(), "publish") {
			if ch, _ := args[1].(string); strings.HasPrefix(ch, "socket.io-response#") {
				if msg, ok := args[2].([]byte); ok {
					args[2] = withEmptyResults(msg)
				}
			}
		}
		return next(ctx, cmd)
	}
}

// withEmptyResults turns a bare {"requestId":"x"} into one with empty
// sockets/rooms arrays; any other payload is returned unchanged.
func withEmptyResults(msg []byte) []byte {
	if !bytes.HasPrefix(msg, []byte(`{"requestId":`)) || bytes.Count(msg, []byte(`":`)) != 1 || !bytes.HasSuffix(msg, []byte(`}`)) {
		return msg
	}
	return append(msg[:len(msg)-1:len(msg)-1], []byte(`,"sockets":[],"rooms":[]}`)...)
}
