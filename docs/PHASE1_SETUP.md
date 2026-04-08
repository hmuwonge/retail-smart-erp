# Phase 1: Enterprise Infrastructure Setup

This guide covers the Phase 1 infrastructure components that level up Retail Smart ERP to enterprise-grade.

## 📋 What's Included

### 1. **Redis Caching Layer**
- **Purpose**: Reduce database load, improve response times, enable rate limiting
- **Location**: `src/lib/cache/redis.ts`, `src/lib/cache/cache-utils.ts`
- **Port**: 6379

**Features:**
- Singleton connection with lazy initialization
- Automatic TTL management
- Tenant-specific and user-specific cache helpers
- Rate limiting counter support
- Mock client for development (graceful degradation)

**Usage Example:**
```typescript
import { tenantCache, cacheGetOrSet } from '@/lib/cache/cache-utils'

// Cache a database query result
const items = await cacheGetOrSet(
  `items:all:${tenantId}`,
  async () => {
    return await db.query.items.findMany({ where: eq(items.tenantId, tenantId) })
  },
  300 // 5 minutes TTL
)

// Tenant-specific caching
await tenantCache.set(tenantId, 'dashboard-stats', { sales: 1000, orders: 50 })
const stats = await tenantCache.get(tenantId, 'dashboard-stats')
```

---

### 2. **PgBouncer Connection Pooling**
- **Purpose**: Prevent database connection exhaustion, improve scalability
- **Port**: 6432
- **Mode**: Transaction-level pooling

**Benefits:**
- Reduces PostgreSQL connection overhead
- Allows 1000+ app connections with only 20 DB connections
- Automatic connection reuse and load distribution

**Configuration:**
```env
# Use PgBouncer for app queries (recommended)
DATABASE_URL=postgres://postgres:postgres@localhost:6432/retail_smart

# Use direct connection for migrations (admin access)
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:5432/retail_smart
```

---

### 3. **Sentry Error Tracking**
- **Purpose**: Centralized error monitoring, performance tracing, user impact analysis
- **Setup Files**: `src/lib/ai/sentry.ts`, `sentry.*.config.ts`

**Features:**
- Automatic error capture with stack traces
- User context tracking (which tenant/user affected)
- Performance transaction tracing
- Session replay (for debugging UI issues)
- Release tracking (correlate errors with deployments)

**Setup:**
1. Create a Sentry project at [sentry.io](https://sentry.io)
2. Get your DSN from Project Settings → Client Keys
3. Add to `.env`:
   ```env
   SENTRY_DSN=https://your-key@sentry.io/123456
   SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

**Usage:**
```typescript
import { captureError, setSentryUser, setSentryTenant } from '@/lib/ai/sentry'

// Manually capture error
const eventId = captureError(new Error('Something failed'), {
  additional: 'context data',
})

// Set user context (after authentication)
setSentryUser(userId, email)
setSentryTenant(tenantId, tenantSlug)
```

---

### 4. **OpenTelemetry Instrumentation**
- **Purpose**: Distributed tracing, metrics collection, observability standards compliance
- **Setup Files**: `src/lib/audit/opentelemetry.ts`, `src/lib/audit/opentelemetry-sdk.ts`, `instrumentation.ts`

**Components:**
- **SDK Initialization**: Auto-instruments HTTP, PostgreSQL, and file system operations
- **Manual Tracing**: Helpers for custom spans (database queries, API calls, business logic)
- **OTLP Exporter**: Sends traces to OpenTelemetry Collector (or compatible backend)

**Setup:**
```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=retail-smart-erp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

**Usage:**
```typescript
import { withSpan, traceDbQuery, traceApiCall } from '@/lib/audit/opentelemetry'

// Trace a database query
const results = await traceDbQuery(
  'SELECT * FROM items WHERE tenant_id = $1',
  async () => db.query.items.findMany(),
  { tenantId }
)

// Trace an API call
const response = await traceApiCall('GET', '/api/items', async () => {
  return NextResponse.json(items)
}, tenantId)

// Custom business logic tracing
await withSpan('business.process-payments', async (span) => {
  span.setAttribute('payment.method', 'card')
  // ... payment logic
})
```

---

### 5. **Rate Limiting Middleware**
- **Purpose**: Prevent API abuse, DDoS protection, fair resource allocation
- **Location**: `src/lib/api/rate-limit.ts`
- **Backend**: Redis-backed counters (window-based)

**Default Limits:**
| Category | Window | Max Requests |
|----------|--------|--------------|
| Auth (login, register) | 15 min | 10 |
| General API | 1 min | 100 |
| POS Transactions | 1 min | 200 |
| File Uploads | 1 hour | 50 |
| AI Operations | 1 min | 20 |

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
X-RateLimit-Window: 60s
```

**Disable for development:**
```env
DISABLE_RATE_LIMITING=true
```

---

### 6. **Monitoring Stack (Prometheus + Grafana)**
- **Purpose**: Real-time metrics visualization, alerting, capacity planning
- **Ports**: Prometheus (9090), Grafana (3002)

**Prometheus:**
- Scrapes metrics from OpenTelemetry Collector
- Stores time-series data (15-day retention by default)
- Query language: PromQL

**Grafana:**
- Pre-configured dashboards
- Default credentials: `admin / admin`
- Auto-provisioned Prometheus datasource

**Access Dashboards:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002

**Available Dashboards:**
- Application Overview (request rate, response time, error rate)
- Database Connection Pool (PgBouncer stats)
- Redis Performance (hit rate, memory, operations)

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm run install:deps
# or
npm install --legacy-peer-deps
```

This will install:
- `ioredis` - Redis client
- `@sentry/nextjs` - Sentry integration (v8)
- `@opentelemetry/*` - OpenTelemetry SDK
- `@vercel/otel` - Next.js OpenTelemetry bridge

**Note**: The `--legacy-peer-deps` flag is required because Next.js 16 is newer than Sentry's officially supported version, but they are API-compatible.

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `REDIS_URL=redis://localhost:6379`
- `SENTRY_DSN` (optional - get from sentry.io)
- `OTEL_ENABLED=true` (for local testing)

### 3. Start Infrastructure (Docker)

```bash
# Start all services (PostgreSQL, PgBouncer, Redis, Prometheus, Grafana)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f redis
docker-compose logs -f pgbouncer
docker-compose logs -f grafana
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Verify Setup

**Health Check:**
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "postgresql": { "status": "healthy", "responseTime": 12 },
    "redis": { "status": "healthy", "responseTime": 5 }
  }
}
```

**Test Redis:**
```bash
docker exec -it retail-smart-redis redis-cli ping
# Should return: PONG
```

**Test PgBouncer:**
```bash
docker exec -it retail-smart-pgbouncer psql -h localhost -p 6432 -U postgres -d retail_smart -c "SELECT 1"
```

**Access Grafana:**
- URL: http://localhost:3002
- Username: `admin`
- Password: `admin`

---

## 📊 Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│           Next.js App (Port 3000)           │
│  ┌──────────────────────────────────────┐   │
│  │  Sentry Error Tracking               │   │
│  │  OpenTelemetry Tracing               │   │
│  │  Rate Limiting Middleware            │   │
│  │  Redis Caching                       │   │
│  └──────────────────────────────────────┘   │
└──────┬──────────────────────────┬───────────┘
       │                          │
       ▼                          ▼
┌──────────────┐         ┌──────────────┐
│   PgBouncer  │         │    Redis     │
│  (Port 6432) │         │  (Port 6379) │
└──────┬───────┘         └──────────────┘
       │
       ▼
┌──────────────┐
│  PostgreSQL  │
│  (Port 5432) │
└──────────────┘

       │
       ▼
┌──────────────────────────────────────┐
│        Observability Stack           │
│  ┌────────────────────────────────┐  │
│  │  OpenTelemetry Collector       │  │
│  │  (Port 4317, 4318)             │  │
│  └────────┬───────────────────────┘  │
│           │                          │
│           ▼                          │
│  ┌────────────────────────────────┐  │
│  │    Prometheus (Port 9090)      │  │
│  └────────┬───────────────────────┘  │
│           │                          │
│           ▼                          │
│  ┌────────────────────────────────┐  │
│  │     Grafana (Port 3002)        │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 🔧 Configuration Reference

### Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary database |
| PgBouncer | 6432 | Connection pooling |
| Redis | 6379 | Caching & rate limiting |
| OpenTelemetry Collector | 4317, 4318 | Trace/metrics aggregation |
| Prometheus | 9090 | Metrics storage |
| Grafana | 3002 | Dashboard visualization |
| App | 3000 | Next.js application |
| WebSocket | 3001 | Real-time updates |

### Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PgBouncer connection string | `postgres://...@localhost:6432/...` |
| `DATABASE_URL_ADMIN` | Direct PostgreSQL connection | `postgres://...@localhost:5432/...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `OTEL_ENABLED` | Enable OpenTelemetry | `false` |
| `SENTRY_DSN` | Sentry project DSN | *(optional)* |
| `DISABLE_RATE_LIMITING` | Disable rate limits | `true` (dev) |

---

## 🐛 Troubleshooting

### Redis Connection Failed
```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
docker exec -it retail-smart-redis redis-cli ping

# View logs
docker logs retail-smart-redis
```

### PgBouncer Connection Issues
```bash
# Check PgBouncer status
docker ps | grep pgbouncer

# View PgBouncer logs
docker logs retail-smart-pgbouncer

# Connect directly to PostgreSQL (bypass PgBouncer)
psql -h localhost -p 5432 -U postgres -d retail_smart
```

### OpenTelemetry Not Sending Traces
```bash
# Check OTEL_ENABLED environment variable
echo $OTEL_ENABLED

# Verify OpenTelemetry Collector is running
docker ps | grep otel

# View collector logs
docker logs retail-smart-otel
```

### Sentry Not Capturing Errors
```bash
# Verify SENTRY_DSN is set
echo $SENTRY_DSN

# Check Sentry initialization in browser console
# Look for: "[Sentry] Initialized successfully"

# Test error capture
curl -X POST http://localhost:3000/api/test-error
```

---

## 📈 Next Steps (Phase 2)

After validating Phase 1 setup, proceed to:

1. **Kubernetes Deployment** - Migrate from Docker Compose to K8s
2. **Database Read Replicas** - Offload reporting queries
3. **SSO/OIDC Integration** - Enterprise authentication
4. **Advanced Testing** - Contract testing, chaos engineering
5. **Multi-Region Deployment** - Geo-redundancy

---

## 📝 Notes

- **Development Mode**: Redis caching gracefully degrades (mock client) if Redis is unavailable
- **Production Mode**: `REDIS_URL` and `DATABASE_URL` are required
- **Rate Limiting**: Disabled by default in development (`DISABLE_RATE_LIMITING=true`)
- **OpenTelemetry**: Only enabled when `OTEL_ENABLED=true` to avoid overhead in development
- **Sentry**: Optional - app runs without it, but you lose error tracking

---

## 🤝 Support

For issues or questions:
- Check Grafana dashboards for metrics anomalies
- Review Sentry for error patterns
- Inspect OpenTelemetry traces for performance bottlenecks
- Consult Docker logs for infrastructure failures
