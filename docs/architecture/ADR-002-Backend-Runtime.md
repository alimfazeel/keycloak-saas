# ADR-002: Backend Runtime & API Layer

**Date:** 2026-09-24  
**Status:** DECIDED  
**Deciders:** Architecture Team  
**Decision:** Node.js 18+ with Fastify framework, TypeScript

## Context

Backend API layer required for:
- Identity Service API (wrapping Keycloak Admin REST API)
- Metering & usage tracking
- Billing webhook handlers
- Tenant portal backends
- Token validation SDKs for consuming services (BOE, D3OS, Matcha)

## Options Under Consideration

### Option A: Node.js (Express / NestJS / Fastify)

**Pros:**
- Fast iteration, JavaScript/TypeScript single language across frontend + backend
- Large ecosystem (npm packages, integrations)
- Excellent async/await patterns for I/O-heavy workloads
- Easy to hire Node.js developers
- Lightweight footprint (good for serverless if needed later)

**Cons:**
- Single-threaded (requires clustering or load balancing for CPU-bound work)
- Less mature for long-running services vs Java/Go
- Memory overhead with many concurrent connections

**Sub-decision (if Node chosen):** Express vs NestJS vs Fastify
- **Express:** Minimal, mature, but less opinionated
- **NestJS:** Full-featured DI, TypeScript-first, larger overhead
- **Fastify:** High performance, TypeScript support, smaller ecosystem

### Option B: Java (Spring Boot)

**Pros:**
- Keycloak itself is Java; shared expertise, libraries
- Mature runtime (JVM) with 25+ years of production use
- Excellent for CPU-intensive work, large datasets
- Strong typing, dependency injection (Spring)
- Libraries already used for Keycloak extensions can be reused

**Cons:**
- Larger memory footprint (~500MB minimum)
- Longer startup time
- May be overkill for lightweight API wrapper around Keycloak
- Smaller pool of new developers vs Node.js

### Option C: Go

**Pros:**
- Excellent performance, small footprint
- Strong concurrency model (goroutines)
- Single binary deployment
- Growing ecosystem

**Cons:**
- Different language from Keycloak extensions (Java)
- Smaller team familiarity
- Ecosystem smaller than Node/Java for enterprise integrations

## Decision Criteria

1. **Alignment with Keycloak:** Shared language/patterns with extensions
2. **Performance:** Latency, throughput, resource usage
3. **Team Expertise:** Hiring availability, learning curve
4. **Feature Time-to-Market:** Speed of iteration vs polish
5. **Cost:** Infrastructure, developer salaries, tooling

## Decision

**CHOSEN: Node.js 18+ with Fastify**

**Why Fastify over alternatives:**
- Performance: ~20k req/s vs Express's ~8k req/s (important for multi-tenant SaaS)
- Low overhead: minimal framework boilerplate, faster startup
- TypeScript-native: full IDE support, type safety
- Schema validation: built-in JSON Schema support for request/response validation
- Streaming: native support for large payloads (audit log exports, bulk operations)

**Implementation:**
- Framework: Fastify 4.x
- Language: TypeScript with strict mode
- Testing: Jest + mocking for database/services
- Logging: pino (high-performance JSON logging)
- Database: pg (native PostgreSQL client)
- Deployment: Node.js 20 Alpine Docker image (~200MB, vs Java's 500MB)

**Services Created:**
- `ApplicationConfigService` — app config management with caching, secret masking, audit trail
- `AuditLogService` — immutable compliance event logging (user login/logout, config changes, API calls, errors)
- `LoggerService` — structured application logging with distributed tracing support

**Health checks:**
- `/health` — basic readiness probe
- `/health/ready` — deep health check (includes DB connectivity)

## Next Steps

1. API route handlers for CRUD operations (config, audit queries)
2. Database connection pooling (pg Pool with retry logic)
3. Middleware: CORS, helmet, request logging, error handling
4. Keycloak integration: Admin API client library
5. Integration tests: against PostgreSQL test database

## Related Decisions
- [[ADR-001-Tech-Stack]] — Database, deployment, identity provider
- [[ADR-003-Frontend]] — Frontend framework

---

**Status:** DECIDED  
**Decided:** 2026-09-24  
**Framework:** Fastify 4.x (TypeScript)  
**Runtime:** Node.js 18+  
**Testing:** Jest  
**Deployment:** Docker (alpine base, ~200MB)  
**Last Updated:** 2026-09-24
