# ADR-002: Backend Runtime & API Layer

**Date:** 2026-09-24  
**Status:** PENDING DECISION  
**Deciders:** Architecture Team

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

## Recommendation

**HOLD:** Decision deferred until Week 1 team alignment meeting.

**Suggested approach:**
- If team has strong Node.js background → Node.js + NestJS (balanced opinionation)
- If team has Java background and Keycloak expertise → Java Spring Boot (shared ecosystem)
- If extreme performance + simplicity needed → Go (less likely for this tier)

## Next Steps

1. Poll team on language preferences
2. Evaluate integration patterns with Keycloak Admin API
3. Test small PoC (JWT validation SDK) in preferred language
4. Make final decision by end of Week 1

## Related Decisions
- [[ADR-001-Tech-Stack]] — Database, deployment, identity provider
- [[ADR-003-Frontend]] — Frontend framework

---

**Status:** PENDING  
**Decision Needed By:** End of Week 1 (2026-10-01)  
**Last Updated:** 2026-09-24
