# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Keycloak SaaS identity and access management platform with backend, frontend, and infrastructure components.

## Architecture

**Backend**: Node.js/Fastify API with TypeScript, PostgreSQL integration, structured logging, and audit trails.
- `backend/src/services/` — ApplicationConfigService, AuditLogService, LoggerService
- `backend/src/types/` — TypeScript entity definitions (ApplicationConfig, AuditLog, ApplicationLog, AuditEvent)
- `backend/test/` — Jest unit tests for all services
- `backend/src/index.ts` — Fastify server entry point with health checks

**Frontend**: Admin and user-facing dashboards (React/TypeScript or equivalent).
- `frontend/src/components/` — reusable UI components
- `frontend/src/pages/` — route-level pages
- `frontend/src/services/` — API clients and state management
- `frontend/src/types/` — TypeScript type definitions

**Infrastructure**: Docker, Kubernetes, PostgreSQL.
- `docker/` — Dockerfiles and compose files (environment-parity: same images dev→prod)
- `k8s/` — Kubernetes manifests
- `db/migrations/` — PostgreSQL schema migrations (Flyway/Liquibase)
- `db/` — PostgreSQL initialization scripts

**Technology Stack (DECIDED):**
- Database: PostgreSQL 15+ (single choice across all environments)
- Deployment: Environment parity (same Docker images, compose definitions used in dev, staging, production)
- Identity Provider: Keycloak (Java-based, OIDC/SAML/LDAP support)
- Backend Runtime: Node.js 18+ (Fastify framework, TypeScript)
- Backend Testing: Jest
- Multi-tenancy: Realm-per-tenant strategy

**Configuration**:
- `.env.example` — environment variable template
- `docker-compose.yml` — local development environment

## Common Commands

### Backend

```bash
# Install dependencies
npm install

# Development server (with hot reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Frontend

```bash
# Install dependencies
npm install

# Development server
npm start

# Build production
npm run build

# Run tests
npm test

# Single test file
npm test -- FileName.test.tsx

# Lint
npm run lint
npm run format
```

### Infrastructure

```bash
# Start local environment
docker-compose up -d

# Rebuild containers
docker-compose build --no-cache

# View logs
docker-compose logs -f [service-name]

# Stop everything
docker-compose down
```

## Key Patterns

**Services**: 
- `ApplicationConfigService` — manages app-wide configuration with in-memory caching (TTL-based), type conversion, secret masking. All changes logged to audit_logs.
- `AuditLogService` — immutable compliance audit trail. Logs user login/logout, config changes, API calls, permission denials, errors. Query by user/tenant/event/level.
- `LoggerService` — structured application logging to application_logs table. Supports distributed tracing (requestId, traceId, spanId). Non-blocking persistence (catches exceptions).

**Database**: PostgreSQL with Flyway migrations in `db/migrations/`. Three main tables:
- `application_config` — app configuration with versioning and audit trail
- `audit_logs` — immutable compliance events (never hard-deleted)
- `application_logs` — detailed debug logs with structured context (JSONB)

**API Routes**: Fastify server at `backend/src/index.ts`. Health checks: `/health` (basic), `/health/ready` (with DB check).

**Testing**: Jest tests in `backend/test/services/`. Mock repositories/services, test happy path and error cases, verify audit logging.

## Development Workflow

1. Local environment: `make up` starts Keycloak, PostgreSQL, Node.js API, and Nginx.
2. Backend changes: `npm run dev` for hot reload, or edit code and container restarts on save.
3. Frontend changes: hot-reload enabled in dev server.
4. Database schema: add migration file in `db/migrations/` (V###__*.sql), auto-applied on container startup.
5. Testing: `npm test` or `npm run test:watch` for watch mode.

## Important Notes

- **Config Caching**: ApplicationConfigService uses 5-minute TTL cache. Invalidate with `invalidateCache(key)` on updates.
- **Audit Logging**: Never hard-delete audit_logs. Use soft-delete pattern (isActive=false). All state-changing operations logged via AuditLogService.
- **Secrets**: Use `.env.local` (git-ignored) for local development. Production secrets managed externally (K8s secrets, vault).
- **Keycloak**: Separate container. API communicates via Keycloak Admin API. Check `docker-compose.yml` for connection details.
- **Environment Parity**: Same Docker images for dev/staging/prod. Only config/replicas differ via Kustomize overlays.
