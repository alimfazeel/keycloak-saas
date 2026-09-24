# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Keycloak SaaS identity and access management platform with backend, frontend, and infrastructure components.

## Architecture

**Backend**: Keycloak (Java-based identity provider) with extensions for custom auth flows.
- `backend/src/main/java/` — custom providers, extensions, event listeners
- `backend/src/main/resources/` — theme templates, realm configurations
- `backend/src/test/` — unit and integration tests

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
- Keycloak: Java-based (customizable via SPI providers)
- Multi-tenancy: Realm-per-tenant strategy

**Configuration**:
- `.env.example` — environment variable template
- `docker-compose.yml` — local development environment

## Common Commands

### Backend

```bash
# Build
mvn clean package

# Run tests
mvn test

# Single test
mvn test -Dtest=ClassName#methodName

# Run locally
mvn spring-boot:run

# Lint/format
mvn spotless:apply
mvn checkstyle:check
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

**Keycloak Extensions**: Custom User Storage Providers and Authentication Flows in `backend/src/main/java/com/*/providers/`. Implement `UserStorageProvider` or `Authenticator` interfaces. Register via SPI mechanism in `META-INF/services/`.

**API Integration**: Frontend communicates with Keycloak via Admin REST API (protected by service account) and User Realm API. Endpoints prefixed `/auth/admin/realms/{realm}/` (Admin API) and `/auth/realms/{realm}/` (User API).

**Database**: PostgreSQL. Schema managed by Keycloak core + custom migrations in `db/migrations/`. Keycloak handles most schema automatically; custom tables go in versioned migration files.

**Authentication**: Standard OAuth2/OIDC flows. Custom realm configurations stored in JSON or exported/imported via Keycloak admin console.

## Development Workflow

1. Local environment: `docker-compose up` starts Keycloak, PostgreSQL, and frontend dev server.
2. Backend changes: edit code in `backend/src/`, rebuild container or restart Spring Boot.
3. Frontend changes: hot-reload enabled in dev server.
4. Database schema: add migration file in `db/migrations/`, auto-applied on container startup.

## Important Notes

- **Realm Configuration**: Realm settings (clients, roles, policies) can be version-controlled as JSON or UI-managed. Clarify approach with team.
- **Secrets**: Use `.env.local` (git-ignored) for local development. Production secrets managed externally (K8s secrets, vault).
- **Keycloak Version**: Check `backend/pom.xml` or `docker-compose.yml` for pinned version.
- **Custom Themes**: Keycloak themes in `backend/src/main/resources/theme/` override default UI. Follow Keycloak theme structure (templates, CSS, messages).
