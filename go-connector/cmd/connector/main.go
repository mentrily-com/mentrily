// go-connector: Go services that share Redis and Postgres with the Nest
// backend. Each feature is switched on by FEATURES (comma-separated).
package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	sioredis "github.com/zishang520/socket.io/adapters/redis/v3"
	"github.com/zishang520/socket.io/adapters/redis/v3/adapter"
	"github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"

	"mentrily/go-connector/internal/auth"
	"mentrily/go-connector/internal/config"
	"mentrily/go-connector/internal/proctoring"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	ropts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("REDIS_URL: %v", err)
	}
	ropts.PoolSize = 128
	rdb := redis.NewClient(ropts)
	rdb.AddHook(adapterResponseFix{})
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis: %v", err)
	}
	db, err := openDB(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	verifier, err := auth.NewVerifier(cfg.ClerkJWTKey, cfg.ClerkSecretKey, cfg.ClerkAPIURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := verifier.Prefetch(ctx); err != nil {
		log.Printf("clerk jwks prefetch (will retry on demand): %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		c, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if rdb.Ping(c).Err() != nil || db.Ping(c) != nil {
			http.Error(w, "unhealthy", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ok"))
	})

	var io *socket.Server
	var gw *proctoring.Gateway
	if cfg.Features["proctoring"] {
		opts := socket.DefaultServerOptions()
		opts.SetPingInterval(20 * time.Second)
		opts.SetPingTimeout(40 * time.Second)
		opts.SetMaxHttpBufferSize(1e6)
		opts.SetCors(&types.Cors{Origin: cfg.OriginAllowed, Credentials: true})
		// Same channels as @socket.io/redis-adapter, so Nest's forceTerminate
		// and fetchSockets reach sockets connected here (and vice versa).
		// Not the signal ctx: shutdown broadcasts still need the adapter.
		adapterRedis := sioredis.NewRedisClient(context.Background(), rdb)
		adapterRedis.On("error", func(errs ...any) { log.Printf("socket.io redis adapter: %v", errs) })
		opts.SetAdapter(&adapter.RedisAdapterBuilder{Redis: adapterRedis, Opts: &adapter.RedisAdapterOptions{}})
		io = socket.NewServer(nil, opts)
		gw = proctoring.New(io, rdb, db, verifier)
		mux.Handle("/socket.io/", io.ServeHandler(nil))
		log.Print("feature enabled: proctoring")
	}

	srv := &http.Server{Addr: cfg.Addr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("go-connector listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	log.Print("shutting down")
	if io != nil {
		io.Close(nil) // disconnects clients; they reconnect to another instance
		gw.Close()    // waits in-flight handlers, then drains queued violations
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
	db.Close()
	rdb.Close()
}

// openDB accepts the backend's Prisma DATABASE_URL: Prisma-only params are
// dropped, and behind PgBouncer (transaction mode) prepared statements are off.
func openDB(ctx context.Context, raw string) (*pgxpool.Pool, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	pgbouncer := q.Get("pgbouncer") == "true"
	for _, k := range []string{"pgbouncer", "connection_limit", "schema", "pool_timeout"} {
		q.Del(k)
	}
	u.RawQuery = q.Encode()
	pc, err := pgxpool.ParseConfig(u.String())
	if err != nil {
		return nil, err
	}
	if pgbouncer {
		pc.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	}
	if pc.MaxConns < 20 {
		pc.MaxConns = 20
	}
	db, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, err
	}
	return db, db.Ping(ctx)
}
