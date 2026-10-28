// Package proctoring serves the /proctoring Socket.IO namespace: the same
// events, acks, rooms, Redis keys and SQL as backend
// src/modules/monitoring/monitoring.gateway.ts, so the exam client and the
// Nest backend (forceTerminate via the shared Redis adapter, answer flushes
// via submission:flush:due) work unchanged against either server.
package proctoring

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zishang520/socket.io/servers/socket/v3"
)

const (
	identityTTL      = 600 * time.Second
	ownerTTL         = 21600 * time.Second
	presenceTTL      = 21600 * time.Second
	statusTTL        = 60 * time.Second
	answerTTL        = 6 * time.Hour
	counterTTL       = 6 * time.Hour
	flushDelay       = 2500 * time.Millisecond
	flushDueKey      = "submission:flush:due" // shared with SubmissionProcessor
	heartbeatGapMs   = 75_000
	maxMessageLen    = 2000
	maxDetailsBytes  = 4096
	opTimeout        = 5 * time.Second
	takeoverTimeout  = 2 * time.Second
	drainTimeout     = 10 * time.Second
	violationWorkers = 8
)

var eventBudgetPerMin = map[string]int{"save_answer": 600, "log_violation": 300, "heartbeat": 60}

type Verifier interface {
	Verify(ctx context.Context, token string) (string, error)
}

type Gateway struct {
	nsp        socket.Namespace
	rdb        *redis.Client
	db         *pgxpool.Pool
	auth       Verifier
	violations chan violation // never closed: handlers may outlive io.Close
	stop       chan struct{}
	workers    sync.WaitGroup

	mu       sync.RWMutex // guards stopped against handlers.Add
	stopped  bool
	handlers sync.WaitGroup
}

type identity struct {
	ID   string `json:"id"`
	Role string `json:"role"`
}

type violation struct {
	sessionID, typ, message string
	at                      time.Time
}

// conn is per-socket state. A socket's events run one at a time, but the
// disconnect listener and forceTerminate touch it from other goroutines.
type conn struct {
	mu          sync.Mutex
	clerkID     string
	user        *identity
	examID      string // set once joined as a student
	userID      string
	windowStart time.Time
	counts      map[string]int
}

func New(io *socket.Server, rdb *redis.Client, db *pgxpool.Pool, auth Verifier) *Gateway {
	g := &Gateway{nsp: io.Of("/proctoring", nil), rdb: rdb, db: db, auth: auth, violations: make(chan violation, 4096), stop: make(chan struct{})}
	for i := 0; i < violationWorkers; i++ {
		g.workers.Add(1)
		go g.violationWorker()
	}
	// Auth runs before CONNECT reaches the client, so no event can arrive
	// before the socket's identity is known.
	g.nsp.Use(func(s *socket.Socket, next func(*socket.ExtendedError)) {
		ctx, cancel := context.WithTimeout(context.Background(), opTimeout)
		defer cancel()
		sub, err := g.auth.Verify(ctx, extractToken(s.Handshake()))
		if err != nil {
			next(socket.NewExtendedError("AUTH_FAILED", map[string]any{"message": "AUTH_FAILED"}))
			return
		}
		s.SetData(&conn{clerkID: sub})
		next(nil)
	})
	g.nsp.On("connection", func(args ...any) { g.onConnection(args[0].(*socket.Socket)) })
	return g
}

// Close waits (bounded) for in-flight handlers, then returns once every
// queued violation is written. Call it after io.Close.
func (g *Gateway) Close() {
	g.mu.Lock()
	g.stopped = true
	g.mu.Unlock()
	idle := make(chan struct{})
	go func() { g.handlers.Wait(); close(idle) }()
	select {
	case <-idle:
	case <-time.After(drainTimeout):
		log.Print("[Proctoring] shutdown: handlers still running after drain timeout")
	}
	close(g.stop)
	g.workers.Wait()
}

// enqueue never blocks: a socket's events run sequentially, so waiting on a
// full queue (DB slow or down) would freeze its heartbeats and saves.
func (g *Gateway) enqueue(v violation) bool {
	select {
	case g.violations <- v:
		return true
	default:
		log.Printf("[Proctoring] violation queue full, dropped %s for session %s", v.typ, v.sessionID)
		return false
	}
}

func (g *Gateway) onConnection(s *socket.Socket) {
	c := s.Data().(*conn)
	handle := func(event string, fn func(ctx context.Context, d map[string]any) map[string]any) {
		s.On(event, func(args ...any) {
			g.mu.RLock()
			if g.stopped {
				g.mu.RUnlock()
				reply(args, map[string]any{"status": "error"})
				return
			}
			g.handlers.Add(1)
			g.mu.RUnlock()
			defer g.handlers.Done()
			if _, limited := eventBudgetPerMin[event]; limited && c.overBudget(event) {
				reply(args, map[string]any{"status": "rejected", "reason": "RATE_LIMITED"})
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), opTimeout)
			defer cancel()
			res := fn(ctx, payload(args))
			if event == "heartbeat" {
				s.Emit("heartbeat_ack", timeMeta())
			}
			reply(args, res)
		})
	}
	handle("join_exam", func(ctx context.Context, d map[string]any) map[string]any { return g.joinExam(ctx, s, c, d) })
	handle("save_answer", func(ctx context.Context, d map[string]any) map[string]any { return g.saveAnswer(ctx, c, d) })
	handle("heartbeat", func(ctx context.Context, d map[string]any) map[string]any { return g.heartbeat(ctx, c, d) })
	handle("log_violation", func(ctx context.Context, d map[string]any) map[string]any { return g.logViolation(ctx, c, d) })
	handle("request_stream", func(ctx context.Context, d map[string]any) map[string]any { return g.requestStream(ctx, s, c, d) })
	s.On("disconnect", func(...any) {
		c.mu.Lock()
		examID, userID := c.examID, c.userID
		c.mu.Unlock()
		if examID != "" {
			g.nsp.To(monitorRoom(examID)).Emit("student_status", map[string]any{"userId": userID, "online": false})
		}
	})
}

func (g *Gateway) joinExam(ctx context.Context, s *socket.Socket, c *conn, d map[string]any) map[string]any {
	examID, userID, sid := str(d, "examId"), str(d, "userId"), str(d, "sessionId")
	if examID == "" || userID == "" {
		return map[string]any{"status": "error"}
	}
	u := g.socketUser(ctx, c)
	if u == nil {
		return map[string]any{"status": "error", "reason": "UNAUTHENTICATED"}
	}
	if str(d, "role") == "teacher" {
		if !g.canMonitorExam(ctx, u, examID) {
			log.Printf("[JoinExam] blocked monitor join: user %s (role %s) exam %s", u.ID, u.Role, examID)
			return map[string]any{"status": "error", "reason": "FORBIDDEN"}
		}
		s.Join(monitorRoom(examID))
		return map[string]any{"status": "joined"}
	}
	if userID != u.ID {
		log.Printf("[JoinExam] blocked student join: socket user %s joined as %s", u.ID, userID)
		return map[string]any{"status": "error", "reason": "FORBIDDEN"}
	}

	// Takeover: kick this student's other sockets for the exam, cluster-wide.
	// A failed lookup must not stop the join.
	room := studentRoom(u.ID, examID)
	tctx, cancel := context.WithTimeout(ctx, takeoverTimeout)
	defer cancel()
	done := make(chan struct{})
	g.nsp.In(room).FetchSockets()(func(peers []*socket.RemoteSocket, err error) {
		defer close(done)
		if err != nil {
			log.Printf("[JoinExam] could not enumerate peers for %s: %v", room, err)
			return
		}
		for _, p := range peers {
			if p.Id() != s.Id() {
				p.Emit("error", map[string]any{"message": "Another instance of this exam is active. This session is now inactive."})
				p.Disconnect(true)
			}
		}
	})
	select {
	case <-done:
	case <-tctx.Done():
		log.Printf("[JoinExam] peer lookup for %s timed out; joining anyway", room)
	}
	s.Join(room)
	c.mu.Lock()
	c.examID, c.userID = examID, userID
	c.mu.Unlock()

	if sid != "" && g.sessionOwner(ctx, sid) == u.ID {
		if gap := g.gapAndRecord(ctx, sid); gap > heartbeatGapMs {
			g.heartbeatGap(examID, u.ID, sid, gap, "Disconnected from exam proctoring for %ds before reconnecting")
		}
	}
	g.nsp.To(monitorRoom(examID)).Emit("student_status", map[string]any{"userId": userID, "online": true})
	return map[string]any{"status": "joined"}
}

func (g *Gateway) saveAnswer(ctx context.Context, c *conn, d map[string]any) map[string]any {
	sid := str(d, "sessionId")
	u := g.socketUser(ctx, c)
	if u == nil {
		return map[string]any{"status": "rejected", "reason": "UNAUTHENTICATED"}
	}
	if o := g.sessionOwner(ctx, sid); o == "" || o != u.ID {
		log.Printf("[SaveAnswer] blocked: user %s wrote session %s", u.ID, sid)
		return map[string]any{"status": "rejected", "reason": "FORBIDDEN"}
	}
	if reason := answerPatchError(d["answer"]); reason != "" {
		return map[string]any{"status": "rejected", "reason": reason}
	}
	if answer := d["answer"].(map[string]any); len(answer) > 0 {
		// Same staging as stashSessionAnswers: per-question hash fields plus
		// one coalesced flush, drained by the Nest SubmissionProcessor.
		flat := make([]any, 0, len(answer)*2)
		for k, v := range answer {
			b, _ := json.Marshal(v)
			flat = append(flat, k, string(b))
		}
		key := "session:answers:h:" + sid
		pipe := g.rdb.TxPipeline()
		pipe.HSet(ctx, key, flat...)
		pipe.Expire(ctx, key, answerTTL)
		pipe.ZAddNX(ctx, flushDueKey, redis.Z{Score: float64(time.Now().Add(flushDelay).UnixMilli()), Member: sid})
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("[SaveAnswer] stash %s: %v", sid, err)
			return map[string]any{"status": "error"}
		}
	}
	g.rdb.Set(ctx, "session:lastseen:"+sid, strconv.FormatInt(time.Now().UnixMilli(), 10), presenceTTL)
	return map[string]any{"status": "saved"}
}

func (g *Gateway) heartbeat(ctx context.Context, c *conn, d map[string]any) map[string]any {
	if sid := str(d, "sessionId"); sid != "" {
		if u := g.socketUser(ctx, c); u != nil && g.sessionOwner(ctx, sid) == u.ID {
			if gap := g.gapAndRecord(ctx, sid); gap > heartbeatGapMs {
				c.mu.Lock()
				examID := c.examID
				c.mu.Unlock()
				g.heartbeatGap(examID, u.ID, sid, gap, "No proctoring signal for %ds (possible tab switch, backgrounded tab, or disconnect)")
			}
		}
	}
	return map[string]any{"status": "alive"}
}

type sessionStatus struct {
	Status         string `json:"status"`
	ExamID         string `json:"examId,omitempty"`
	TabSwitchLimit *int   `json:"tabSwitchLimit"`
}

func (g *Gateway) logViolation(ctx context.Context, c *conn, d map[string]any) map[string]any {
	sid, typ := str(d, "sessionId"), str(d, "type")
	u := g.socketUser(ctx, c)
	if u == nil {
		return map[string]any{"status": "rejected", "reason": "UNAUTHENTICATED"}
	}
	if o := g.sessionOwner(ctx, sid); o == "" || o != u.ID {
		log.Printf("[LogViolation] blocked: user %s logged against session %s", u.ID, sid)
		return map[string]any{"status": "rejected", "reason": "FORBIDDEN"}
	}
	msg := fmt.Sprint(orEmpty(d["message"]))
	if r := []rune(msg); len(r) > maxMessageLen {
		msg = string(r[:maxMessageLen])
	}
	details := d["details"]
	if b, err := json.Marshal(details); err != nil || len(b) > maxDetailsBytes {
		details = map[string]any{"truncated": true}
	}

	statusKey := "session:status:" + sid
	var st sessionStatus
	if s, err := g.rdb.Get(ctx, statusKey).Result(); err != nil || json.Unmarshal([]byte(s), &st) != nil {
		st = sessionStatus{}
		if err := g.db.QueryRow(ctx, `SELECT s.status::text, s."examId", e."tabSwitchLimit" FROM "ExamSession" s JOIN "Exam" e ON e.id = s."examId" WHERE s.id = $1`, sid).
			Scan(&st.Status, &st.ExamID, &st.TabSwitchLimit); err != nil {
			return map[string]any{"status": "rejected", "reason": "Session not found"}
		}
		if st.TabSwitchLimit != nil && *st.TabSwitchLimit == 0 {
			st.TabSwitchLimit = nil
		}
		b, _ := json.Marshal(st)
		g.rdb.Set(ctx, statusKey, b, statusTTL)
	}
	examID := st.ExamID
	if examID == "" {
		examID = str(d, "examId")
	}
	if st.Status == "COMPLETED" || st.Status == "TERMINATED" {
		return map[string]any{"status": "rejected", "reason": "Session inactive"}
	}

	at := violationTime(d["timestamp"])
	g.enqueue(violation{sid, typ, msg, at})

	// Unknown counts must not read as zero: that would skip auto-terminate.
	in, out, err := g.violationCounts(ctx, sid)
	if err == nil {
		switch typ {
		case "TAB_SWITCH_IN":
			in, err = g.incrCounter(ctx, "violation:count:in:"+sid)
		case "TAB_SWITCH", "TAB_SWITCH_OUT":
			out, err = g.incrCounter(ctx, "violation:count:out:"+sid)
		}
	}
	if err != nil {
		log.Printf("[LogViolation] counters for session %s: %v", sid, err)
		return map[string]any{"status": "error"}
	}

	if limit := st.TabSwitchLimit; typ == "TAB_SWITCH_IN" && limit != nil && in >= *limit {
		// Guarded on IN_PROGRESS: the status cache can be stale, and a
		// submitted (COMPLETED, graded) session must never be overwritten.
		tag, err := g.db.Exec(ctx, `UPDATE "ExamSession" SET status = 'TERMINATED', "endTime" = (NOW() AT TIME ZONE 'UTC'), "timeTakenSec" = GREATEST(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "startTime"))::INT, 0), "updatedAt" = (NOW() AT TIME ZONE 'UTC') WHERE id = $1 AND status = 'IN_PROGRESS'`, sid)
		if err != nil || tag.RowsAffected() == 0 {
			g.rdb.Del(ctx, statusKey)
			return map[string]any{"status": "rejected", "reason": "Session already inactive"}
		}
		log.Printf("[Proctoring] auto-terminated session %s (user %s): tab switches %d/%d", sid, u.ID, in, *limit)
		b, _ := json.Marshal(sessionStatus{Status: "TERMINATED", ExamID: examID, TabSwitchLimit: limit})
		g.rdb.Set(ctx, statusKey, b, statusTTL)
		g.forceTerminate(examID, u.ID)
		g.nsp.To(monitorRoom(examID)).Emit("student_terminated", map[string]any{"userId": u.ID, "reason": fmt.Sprintf("Exceeded Tab Switch Limit (%d)", *limit)})
		return map[string]any{"status": "terminated"}
	}

	g.nsp.To(monitorRoom(examID)).Emit("live_violation", map[string]any{
		"userId": u.ID, "type": typ, "message": msg, "details": details,
		"tabOuts": out, "tabIns": in, "timestamp": at,
	})
	return map[string]any{"status": "recorded"}
}

func (g *Gateway) requestStream(ctx context.Context, s *socket.Socket, c *conn, d map[string]any) map[string]any {
	examID := str(d, "examId")
	u := g.socketUser(ctx, c)
	if u == nil || !g.canMonitorExam(ctx, u, examID) {
		log.Printf("[Proctoring] blocked stream request for exam %s", examID)
		return map[string]any{"status": "rejected", "reason": "FORBIDDEN"}
	}
	g.nsp.To(studentRoom(str(d, "targetUserId"), examID)).Emit("cmd_request_stream", map[string]any{
		"teacherSocketId": s.Id(), "teacherPeerId": d["teacherPeerId"],
	})
	return map[string]any{"status": "requested"}
}

// forceTerminate mirrors MonitoringGateway.forceTerminate.
func (g *Gateway) forceTerminate(examID, userID string) {
	room := studentRoom(userID, examID)
	g.nsp.To(room).Emit("error", map[string]any{"message": "EXAM_TERMINATED"})
	g.nsp.To(room).Emit("force_terminate", map[string]any{"message": "EXAM_TERMINATED"})
	// Like Node purging activeConnections: no "offline" status for a terminated student.
	g.nsp.Sockets().Range(func(_ socket.SocketId, s *socket.Socket) bool {
		if c, ok := s.Data().(*conn); ok && s.Rooms().Has(room) {
			c.mu.Lock()
			c.examID = ""
			c.mu.Unlock()
		}
		return true
	})
	time.AfterFunc(time.Second, func() { g.nsp.In(room).DisconnectSockets(true) })
}

func (g *Gateway) heartbeatGap(examID, userID, sid string, gapMs int64, format string) {
	msg := fmt.Sprintf(format, (gapMs+500)/1000)
	g.enqueue(violation{sid, "HEARTBEAT_GAP", msg, time.Now().UTC()})
	if examID != "" {
		g.nsp.To(monitorRoom(examID)).Emit("live_violation", map[string]any{
			"userId": userID, "type": "HEARTBEAT_GAP", "message": msg,
			"details": map[string]any{"gapMs": gapMs}, "timestamp": time.Now().UTC(),
		})
	}
}

// violationWorker bounds concurrent Violation inserts so a burst can't
// exhaust the DB pool that live events need.
func (g *Gateway) violationWorker() {
	defer g.workers.Done()
	for {
		select {
		case v := <-g.violations:
			g.insertViolation(v)
		case <-g.stop:
			for {
				select {
				case v := <-g.violations:
					g.insertViolation(v)
				default:
					return
				}
			}
		}
	}
}

func (g *Gateway) insertViolation(v violation) {
	ctx, cancel := context.WithTimeout(context.Background(), opTimeout)
	defer cancel()
	if _, err := g.db.Exec(ctx, `INSERT INTO "Violation" (id, "sessionId", type, message, severity, timestamp) VALUES (gen_random_uuid()::text, $1, $2, $3, 'WARNING', $4)`, v.sessionID, v.typ, v.message, v.at); err != nil {
		log.Printf("[Proctoring] violation insert for session %s: %v", v.sessionID, err)
	}
}

// socketUser resolves identity and role from our records, never the payload.
func (g *Gateway) socketUser(ctx context.Context, c *conn) *identity {
	c.mu.Lock()
	u, clerkID := c.user, c.clerkID
	c.mu.Unlock()
	if u != nil {
		return u
	}
	key := "user:socket-identity:" + clerkID
	var id identity
	if s, err := g.rdb.Get(ctx, key).Result(); err == nil && json.Unmarshal([]byte(s), &id) == nil {
		u = &id
	} else {
		if err := g.db.QueryRow(ctx, `SELECT id, role::text FROM "User" WHERE "clerkId" = $1 LIMIT 1`, clerkID).Scan(&id.ID, &id.Role); err != nil {
			return nil
		}
		b, _ := json.Marshal(id)
		g.rdb.Set(ctx, key, b, identityTTL)
		u = &id
	}
	c.mu.Lock()
	c.user = u
	c.mu.Unlock()
	return u
}

// canMonitorExam: the caller must own the exam or teach/admin in the exam's
// org (home org or an ACTIVE membership). The global role alone decides
// nothing: workspace teachers keep a global STUDENT role.
func (g *Gateway) canMonitorExam(ctx context.Context, u *identity, examID string) bool {
	if strings.ToUpper(u.Role) == "SUPER_ADMIN" {
		return true
	}
	var allowed bool
	err := g.db.QueryRow(ctx, `
		SELECT e."creatorId" = $2
		    OR (e."orgId" IS NOT NULL AND (
		        EXISTS (SELECT 1 FROM "User" u WHERE u.id = $2 AND u."orgId" = e."orgId" AND u.role::text IN ('TEACHER', 'ADMIN'))
		     OR EXISTS (SELECT 1 FROM "OrgMembership" m WHERE m."userId" = $2 AND m."orgId" = e."orgId" AND m.status::text = 'ACTIVE' AND m.role::text IN ('TEACHER', 'ADMIN'))))
		FROM "Exam" e WHERE e.id = $1`, examID, u.ID).Scan(&allowed)
	return err == nil && allowed
}

func (g *Gateway) sessionOwner(ctx context.Context, sid string) string {
	if sid == "" {
		return ""
	}
	key := "session:owner:" + sid
	if s, err := g.rdb.Get(ctx, key).Result(); err == nil {
		return s
	}
	var uid string
	if err := g.db.QueryRow(ctx, `SELECT "userId" FROM "ExamSession" WHERE id = $1`, sid).Scan(&uid); err != nil {
		return ""
	}
	g.rdb.Set(ctx, key, uid, ownerTTL)
	return uid
}

// gapAndRecord returns ms since the session's last socket presence (-1 if
// never) and records presence now, in one round trip.
func (g *Gateway) gapAndRecord(ctx context.Context, sid string) int64 {
	now := time.Now().UnixMilli()
	key, val := "session:lastseen:"+sid, strconv.FormatInt(now, 10)
	prev, err := g.rdb.SetArgs(ctx, key, val, redis.SetArgs{Get: true, TTL: presenceTTL}).Result()
	if err != nil && err != redis.Nil {
		// SET ... GET needs Redis >= 6.2; presence must still land, or submit
		// is blocked with MONITORING_OFFLINE.
		prev, err = g.rdb.Get(ctx, key).Result()
		g.rdb.Set(ctx, key, val, presenceTTL)
	}
	if err != nil {
		return -1
	}
	p, err := strconv.ParseInt(prev, 10, 64)
	if err != nil {
		return -1
	}
	return now - p
}

func (g *Gateway) violationCounts(ctx context.Context, sid string) (in, out int, err error) {
	keyIn, keyOut := "violation:count:in:"+sid, "violation:count:out:"+sid
	vals, err := g.rdb.MGet(ctx, keyIn, keyOut).Result()
	if err != nil {
		return 0, 0, err
	}
	if vals[0] != nil && vals[1] != nil {
		in, err1 := strconv.Atoi(fmt.Sprint(vals[0]))
		out, err2 := strconv.Atoi(fmt.Sprint(vals[1]))
		if err1 == nil && err2 == nil {
			return in, out, nil
		}
	}
	// Counters expired or never set: rebuild from the Violation rows.
	if err := g.db.QueryRow(ctx, `SELECT COUNT(*) FILTER (WHERE type = 'TAB_SWITCH_IN'), COUNT(*) FILTER (WHERE type IN ('TAB_SWITCH', 'TAB_SWITCH_OUT')) FROM "Violation" WHERE "sessionId" = $1`, sid).Scan(&in, &out); err != nil {
		return 0, 0, err
	}
	pipe := g.rdb.TxPipeline()
	pipe.Set(ctx, keyIn, in, counterTTL)
	pipe.Set(ctx, keyOut, out, counterTTL)
	pipe.Exec(ctx)
	return in, out, nil
}

func (g *Gateway) incrCounter(ctx context.Context, key string) (int, error) {
	pipe := g.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, counterTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return int(incr.Val()), nil
}

func (c *conn) overBudget(event string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	if c.counts == nil || now.Sub(c.windowStart) >= time.Minute {
		c.windowStart, c.counts = now, map[string]int{}
	}
	c.counts[event]++
	return c.counts[event] > eventBudgetPerMin[event]
}

// extractToken: handshake auth, then Bearer header, then __session / auth_token cookie.
func extractToken(h *socket.Handshake) string {
	if t, ok := h.Auth["token"].(string); ok && t != "" {
		return t
	}
	headers := h.Headers.Header()
	if a := headers.Get("Authorization"); strings.HasPrefix(a, "Bearer ") {
		return strings.TrimPrefix(a, "Bearer ")
	}
	cookies := headers.Get("Cookie")
	for _, name := range []string{"__session", "auth_token"} {
		for _, part := range strings.Split(cookies, ";") {
			if k, v, ok := strings.Cut(strings.TrimSpace(part), "="); ok && k == name && v != "" {
				if u, err := url.QueryUnescape(v); err == nil {
					return u
				}
				return v
			}
		}
	}
	return ""
}

// violationTime trusts the client-reported time only inside the last 6h.
func violationTime(raw any) time.Time {
	now := time.Now().UTC()
	s, ok := raw.(string)
	if !ok || s == "" {
		return now
	}
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil || t.After(now) || t.Before(now.Add(-6*time.Hour)) {
		return now
	}
	return t.UTC()
}

func timeMeta() map[string]any {
	now := time.Now().UTC()
	return map[string]any{
		"timestamp": now.UnixMilli(), "serverTimeMs": now.UnixMilli(),
		"serverTimeIso": now.Format("2006-01-02T15:04:05.000Z"), "timeZone": "UTC", "utcOffsetMinutes": 0,
	}
}

func monitorRoom(examID string) socket.Room { return socket.Room("exam_" + examID + "_monitor") }

func studentRoom(userID, examID string) socket.Room {
	return socket.Room("student_" + userID + "_exam_" + examID)
}

func str(m map[string]any, k string) string {
	s, _ := m[k].(string)
	return s
}

func orEmpty(v any) any {
	if v == nil {
		return ""
	}
	return v
}

func payload(args []any) map[string]any {
	if len(args) > 0 {
		if m, ok := args[0].(map[string]any); ok {
			return m
		}
	}
	return map[string]any{}
}

func reply(args []any, v map[string]any) {
	if len(args) > 0 {
		if ack, ok := args[len(args)-1].(socket.Ack); ok {
			ack([]any{v}, nil)
		}
	}
}
