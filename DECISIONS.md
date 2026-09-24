# Keycloak SaaS - Technology Decisions

## Status

- **Decided (Locked):** Database, Deployment, Identity Provider, Multi-Tenancy
- **Pending (Week 1):** Backend Runtime, Frontend Framework

## Decided (✅ LOCKED)

### 1. Database: PostgreSQL 15+

**What:** Single relational database for all environments  
**Where:** Identical PostgreSQL across dev (docker-compose), staging (RDS), production (RDS)  
**Why:** Open-source, Keycloak-native, excellent HA/replication, AWS RDS mature  

**Details:**
- Local: `postgres:15-alpine` in docker-compose
- Staging/Prod: AWS RDS PostgreSQL, multi-AZ failover, auto-patched
- Migrations: Flyway versioned scripts in `db/migrations/`
- Connection pooling: PgBouncer (for HA) or RDS Proxy

**Config:**
- `.env.example` lines: `DB_VENDOR=postgres`, `DB_ADDR`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
- Docker-compose: `services.postgres` (dev)
- Terraform: `terraform/aws/rds/main.tf` (staging/prod)

---

### 2. Deployment: Environment Parity (Docker → Kubernetes)

**What:** Same Docker images used in all environments (dev, staging, production)  
**Why:** Eliminates "works on my machine" bugs, simplifies CI/CD, reproducible production failures  

**How:**
- `docker-compose.yml` at repo root = local dev + staging/prod basis
- Environment differences via **Kustomize overlays** (not Dockerfile rewrites)
  - `k8s/base/` — shared manifests (Keycloak, PostgreSQL, Nginx)
  - `k8s/overlays/dev/` — dev overrides (1 replica, small CPU/memory)
  - `k8s/overlays/staging/` — staging overrides (2 replicas, medium resources)
  - `k8s/overlays/production/` — prod overrides (3+ replicas, HA, auto-scaling)
- Environment config via `.env` files (secrets managed by K8s Secrets / AWS Secrets Manager)

**CI/CD:**
1. Build Docker image once (tagged with git SHA)
2. Push to container registry (ECR, DockerHub)
3. Deploy same image to dev, staging, prod (only config/replica count differs)

---

### 3. Identity Provider: Keycloak 24.x (Java)

**What:** Open-source, self-hosted OAuth2/OIDC/SAML provider  
**Why:** Battle-tested, extensible via SPI, cost-effective for SaaS, native multi-realm support  

**Keycloak Extensions (Java):**
- Custom User Storage Providers (LDAP/AD federation, custom user DB bridges)
- Custom Authenticators (MFA flows, step-up auth)
- Event Listeners (audit logging, integrations)
- All in `backend/src/main/java/com/keycloak/saas/`

**Deployment:**
- Docker image built from `docker/Dockerfile.keycloak`
- Includes JARs from `backend/target/keycloak-providers.jar`
- Kubernetes StatefulSet or Deployment (managed by K8s manifests)
- Auto-scales via HPA (Horizontal Pod Autoscaler) on CPU/memory metrics

---

### 4. Multi-Tenancy: Realm-per-Tenant

**What:** Each customer = isolated Keycloak realm  
**Why:** Complete data isolation, simplified compliance, no cross-tenant queries  

**How:**
- Tenant signup → API creates new realm (via Keycloak Admin REST API)
- Realm name = tenant ID (e.g., `realm-acme-corp`, `realm-12345`)
- Each realm has own: users, roles, clients, identity providers, token rules
- Realm config (theme, password policy, token lifetime) per customer
- Shared Keycloak cluster (single deployment, many realms)

**Benefits:**
- GDPR/SOC2 compliance (isolated data)
- Performance (no filtering overhead)
- Operations (export/import entire customer in one realm)
- Audit trail per customer

**Challenges:**
- Realm management at scale (bulk create/delete/update via API required)
- Shared cluster means one issue can affect all tenants (mitigation: monitoring, quotas, rate limiting)

---

## Pending (Week 1 Decision)

### Backend Runtime (Express / NestJS / Spring Boot / Go)

**Options:** Node.js vs Java vs Go  
**Decision:** Deferred to Week 1 team alignment  
**Details:** See [ADR-002-Backend-Runtime.md](docs/architecture/ADR-002-Backend-Runtime.md)

**Why it matters:**
- All Identity Service API calls go through backend
- Keycloak extension SDKs will be written in chosen language
- Hiring, hiring, hiring (biggest cost impact)

**Placeholder (Assume Node.js + NestJS for now):**
- Backend code in `backend/` (separate from Keycloak extensions)
- API routes for: user provisioning, metering, billing webhooks, token validation
- Calls Keycloak Admin API (protected by service account)

---

### Frontend Framework (React / Vue / Svelte)

**Options:** React + Next.js vs Vue + Nuxt vs Svelte + SvelteKit vs Angular  
**Decision:** Deferred to Week 1 team alignment  
**Details:** See [ADR-003-Frontend-Framework.md](docs/architecture/ADR-003-Frontend-Framework.md)

**Why it matters:**
- Admin portal (tenant management)
- User portal (self-service)
- Public pages (landing, docs)
- Developer experience + hiring

**Placeholder (Assume React + Next.js for now):**
- Frontend code in `frontend/`
- Portals auth via Keycloak (OAuth2 client in realm)
- Calls Keycloak Admin API + custom backend API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Tenants (Realm-per-Tenant)             │
│  realm-acme  │  realm-startup1  │  realm-enterprise     │
└────────────────────────┬──────────────────────────────────┘
                         ↓
         ┌──────────────────────────────┐
         │   Keycloak Cluster (Java)     │  ← SPI Extensions (Java)
         │   Multi-realm, HA Setup       │  ← Custom Providers
         └────────┬─────────────────────┘  ← Event Listeners
                  ↓
         ┌──────────────────────────────┐
         │  PostgreSQL 15+ (RDS/Local)   │
         │  Single DB across all envs    │
         └──────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Portal Frontends (React/Vue)                │
│         Admin Portal  │  User Portal  │  Landing        │
│  Calls Keycloak Admin API + Backend API                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         Backend API (Node.js / Spring / Go)              │
│  Wraps Keycloak Admin API                               │
│  Metering, Billing, Token Validation SDKs               │
└─────────────────────────────────────────────────────────┘
```

---

## File Updates Completed

| File | Status | What Changed |
|------|--------|-------------|
| `CLAUDE.md` | ✅ Updated | Locked DB (Postgres), deployment (parity), tech stack table |
| `.env.example` | ✅ Updated | Removed Oracle references, solidified Postgres |
| `README.md` | ✅ Updated | Added tech stack table, emphasized environment parity |
| `DECISIONS.md` | ✅ Created | This file (summary of all decisions) |
| `docs/architecture/ADR-001-Tech-Stack.md` | ✅ Created | Full rationale for DB, deployment, identity provider, multi-tenancy |
| `docs/architecture/ADR-002-Backend-Runtime.md` | ✅ Created | Options analysis, pending decision |
| `docs/architecture/ADR-003-Frontend-Framework.md` | ✅ Created | Options analysis, pending decision |

---

## Next Steps

### Week 1: Technology Decisions

1. **Mon-Tue:** Team meeting on backend runtime (Express/NestJS/Spring/Go)
   - Poll preferences
   - Demo small PoC if time allows
   - Decide by Tuesday EOD

2. **Wed-Thu:** Team meeting on frontend framework (React/Vue/Svelte)
   - Poll preferences
   - Evaluate component libraries
   - Decide by Thursday EOD

3. **Fri:** Update ADRs with final decisions, unblock Phase 1 work

### Week 2-4: Foundation Phase Begins

Once backend + frontend decided:
1. Set up dev environment (docker-compose verified working)
2. Build Keycloak extension skeleton (Java stubs for custom providers)
3. Create realm auto-creation API endpoint
4. Wire up authentication flows (OIDC, local user auth)
5. Deploy to staging (verify environment parity holds)

---

## Questions / Risks

| Risk | Mitigation |
|------|-----------|
| PostgreSQL performance at scale (millions of users) | RDS auto-scaling, read replicas, connection pooling, schema optimization |
| Realm-per-tenant admin overhead | Build CLI/API tooling for bulk operations, automate via IaC (Terraform) |
| Unknown backend/frontend choice | ADRs provide decision framework; team alignment in Week 1 reduces risk |
| Docker image size bloat | Minimize Keycloak extensions, use multi-stage builds, CI optimization |
| Keycloak version upgrade burden | Plan 2x/year upgrades, test in staging first, Blue-Green deployment pattern |

---

**Last Updated:** 2026-09-24  
**Review Cadence:** Every Phase (every ~8 weeks)  
**Next Review:** After Phase 1 Foundation (Week 8)
