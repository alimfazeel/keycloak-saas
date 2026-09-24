# ADR-001: Technology Stack Decisions

**Date:** 2026-09-24  
**Status:** DECIDED  
**Deciders:** Architecture Team

## Context

Keycloak SaaS project requires foundational technology choices that will drive implementation, hiring, and ops for years. These decisions are critical blockers for Phase 1 (Foundation).

## Decision

### 1. Database: PostgreSQL 15+

**Chosen:** PostgreSQL 15+  
**Rejected:** Oracle 19c, MySQL 8, other RDBMS

**Rationale:**
- Open-source, no licensing costs (critical for SaaS unit economics)
- Native to Keycloak (well-tested, recommended by Keycloak team)
- Excellent JSONB support for tenant config storage
- Strong replication + failover (Patroni, streaming replication for HA)
- Rich ecosystem (pgBouncer for connection pooling, Patroni for HA)
- Familiar to majority of Node.js/modern stack teams
- AWS RDS PostgreSQL is mature, auto-patched, multi-AZ failover included

### 2. Deployment: Environment Parity (Docker + Kubernetes)

**Chosen:** Same Docker images and docker-compose definitions used identically across dev, staging, production  
**Rejected:** Dev-specific throwaway containers, environment-specific builds

**Rationale:**
- Eliminates "works on my machine" failures
- Staging/production behavior matches local testing
- Dockerfile is the single source of truth for what runs
- Easier to debug production issues (reproducible locally)
- CI/CD pipeline: build once, deploy everywhere
- Kubernetes manifests use Kustomize overlays for environment-specific config (replicas, resource limits, domains), NOT for code/image changes
- docker-compose.yml at repo root serves as both local dev environment and basis for K8s manifests

### 3. Identity Provider: Keycloak (Java-based)

**Chosen:** Keycloak 24.x (latest stable)  
**Rejected:** Auth0, AWS Cognito, custom-built OAuth provider

**Rationale:**
- Open-source, self-hosted, no vendor lock-in
- OIDC/SAML/LDAP/Social all natively supported
- Extensible via SPI (Service Provider Interface) for custom flows
- Battle-tested at scale (used by enterprises, governments)
- Active community, regular updates
- Cost-effective for multi-tenant SaaS (licenses based on deployment, not per-user)

### 4. Multi-Tenancy Strategy: Realm-per-Tenant

**Chosen:** Each tenant = isolated Keycloak realm  
**Rejected:** Shared realm with row-level filtering, separate Keycloak instances per tenant

**Rationale:**
- **Isolation:** Complete tenant separation at Keycloak level (no cross-contamination of auth data)
- **Compliance:** Meets GDPR/SOC2 data isolation requirements
- **Performance:** No query filtering overhead, each realm queries only its data
- **Operations:** Easy to export/import tenant data, audit trail per realm
- **Scalability:** Realms are lightweight; can create thousands on single Keycloak cluster
- **Automation:** Realm creation can be automated via REST API on signup

## Consequences

### Positive
- PostgreSQL replication/failover tooling is mature and well-documented
- Environment parity reduces production surprises
- Keycloak's Java runtime is optimized for long-running processes (better than Node for this use case)
- Realm-per-tenant simplifies compliance and data isolation audits
- All three decisions reinforce each other (Keycloak + Postgres + Docker-based)

### Negative
- PostgreSQL (vs newer databases) has larger disk footprint for high-volume workloads
- Realm-per-tenant creates more Keycloak realms to manage (tooling required for bulk operations)
- Java stack requires different ops knowledge than Node.js teams may have
- Environment parity means prod issues cannot be "special-cased" in Dockerfile

### Mitigations
- Use RDS auto-scaling and read replicas for PostgreSQL performance
- Build automation for realm lifecycle management (create, update, delete via API)
- Hire or train DevOps for Java/Keycloak operations
- Enforce strict separation of config (environment variables) from code

## Implementation Plan

1. **Immediate:** Lock PostgreSQL in all docker-compose, Terraform, and documentation
2. **Week 1:** Standardize Dockerfile for Keycloak extensions; test in dev, staging, prod
3. **Week 2:** Set up RDS PostgreSQL in staging/prod via Terraform
4. **Week 3-4:** Implement realm auto-creation API endpoint
5. **Ongoing:** Document realm management procedures, backup/restore workflows

## Related Decisions
- [[ADR-002-API-Layer]] — Backend service for identity API (Node.js + Express/NestJS)
- [[ADR-003-Frontend]] — Frontend framework (React/Next.js or Vue/Nuxt)

## References
- Keycloak Official Docs: https://www.keycloak.org/documentation.html
- PostgreSQL HA Best Practices: https://www.postgresql.org/docs/current/warm-standby.html
- Realm-per-Tenant Patterns: https://www.keycloak.org/docs/24.0.0/server_admin/#:~:text=realms

---

**Approved by:** [Stakeholder Name / Date]  
**Last Updated:** 2026-09-24
