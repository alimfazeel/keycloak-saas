# ADR-003: Frontend Framework

**Date:** 2026-09-24  
**Status:** PENDING DECISION  
**Deciders:** Architecture Team

## Context

Frontend applications needed for multi-tenant SaaS:
- **Admin Portal:** Tenant management, realm config, user management, subscription/billing
- **User Portal:** Self-service (password reset, MFA setup, profile, integrations)
- **Public Pages:** Landing, docs, signup flow

All consume Keycloak Admin REST API (protected by service account) and custom API layer.

## Options Under Consideration

### Option A: React + Next.js

**Pros:**
- Largest ecosystem (npm, component libraries, integrations)
- Excellent TypeScript support
- Server-side rendering (SSR) + static generation for performance
- API routes for backend logic (if needed)
- Massive hiring pool
- Battle-tested at scale (used by most SaaS companies)

**Cons:**
- Larger build artifacts
- Higher memory for development
- Learning curve for newer team members

### Option B: Vue + Nuxt

**Pros:**
- Smaller learning curve than React (clearer mental model)
- Excellent documentation
- Build tooling (Vite) is very fast
- Good TypeScript support with Nuxt 3+
- Lighter bundles than React
- Single-file components intuitive

**Cons:**
- Smaller ecosystem than React (fewer third-party components)
- Smaller hiring pool
- Less adoption among enterprises (React dominance)

### Option C: Svelte + SvelteKit

**Pros:**
- Most lightweight framework
- Fast build tooling
- Smallest bundle sizes
- Enjoyable developer experience

**Cons:**
- Smallest ecosystem
- Smallest hiring pool
- Less mature than React/Vue for enterprise features
- Risk of framework churn (newer, less battle-tested)

### Option D: Angular

**Pros:**
- Full-featured framework (DI, testing, forms)
- Strong TypeScript integration
- Enterprise-grade tooling
- Good for large teams

**Cons:**
- Steeper learning curve
- Heavier bundles
- Smaller new projects adopt Angular
- Slower development velocity vs React/Vue

## Decision Criteria

1. **Developer Experience:** Iteration speed, debugging, tooling
2. **Ecosystem:** Available component libraries, integrations
3. **Hiring:** Availability of developers in market
4. **Performance:** Bundle size, initial load time
5. **Maintainability:** Code clarity, team onboarding

## Recommendation

**HOLD:** Decision deferred until Week 1 team alignment meeting.

**Suggested approach:**
- If React expertise exists in team OR faster hiring needed → **React + Next.js** (standard choice)
- If building smaller team, prefer lighter bundles → **Vue + Nuxt** (excellent balance)
- If extreme performance + new team → **Svelte + SvelteKit** (bold choice, monitor churn risk)

## Implementation Notes

Chosen framework will:
- Deploy as Docker container (see `docker/Dockerfile.frontend`)
- Run dev server in docker-compose for local development
- Build static/server output for production (deployed to EKS via Kubernetes)
- Use Keycloak as OAuth2 client (hosted at Keycloak realm, not portal)
- Call both Keycloak Admin API and custom backend API

## Next Steps

1. Poll team on framework preferences
2. Evaluate component libraries (UI, forms, data tables)
3. Test PoC (login flow, user list page) in preferred framework
4. Make final decision by end of Week 1

## Related Decisions
- [[ADR-001-Tech-Stack]] — Database, deployment, identity provider
- [[ADR-002-Backend-Runtime]] — Backend runtime (Express/NestJS/Spring/Go)

---

**Status:** PENDING  
**Decision Needed By:** End of Week 1 (2026-10-01)  
**Last Updated:** 2026-09-24
