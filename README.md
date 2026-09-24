# Keycloak SaaS - Multi-Tenant Identity Management Platform

Keycloak-based Software-as-a-Service identity and access management platform with multi-tenancy, OIDC/SAML federation, advanced authentication flows, and billing integration.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Make (optional, for convenience commands)
- Node.js 18+ (for frontend development)
- Maven 3.8+ (for Keycloak extensions)

### Local Development Setup

```bash
# Clone and enter directory
cd keycloak-saas

# Start local dev stack (Keycloak + PostgreSQL + Nginx)
make up

# OR without Make:
docker-compose up -d

# Wait for services to be ready (~30s)
sleep 30

# View logs
docker-compose logs -f keycloak
```

**Access locally:**
- Keycloak Admin: http://localhost:8080/admin
  - Username: `admin`
  - Password: `admin-change-me-in-dev`
- Reverse Proxy: http://localhost
- API (if running): http://localhost:3000

### Stop Stack

```bash
make down
# OR
docker-compose down
```

## Project Structure

```
keycloak-saas/
├── backend/          # Keycloak extensions (Java/Maven)
├── frontend/         # Admin & user portals (React/Vue)
├── docker/           # Docker images and compose
├── k8s/              # Kubernetes manifests (kustomize)
├── db/               # Database migrations (Flyway/Liquibase)
├── config/           # Keycloak realm, nginx configs
├── terraform/        # AWS infrastructure as code
├── docs/             # Architecture, guides, API specs
└── CLAUDE.md         # Claude Code guidance
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed layout.

## Development Workflow

### Backend (Keycloak Extensions)

Edit custom providers, event listeners, and validators in `backend/src/main/java/`.

```bash
# Build extensions
make backend-build

# Run tests
make backend-test

# Single test
make backend-single-test TEST_CLASS=com.keycloak.saas.providers.CustomUserStorageProviderTest
```

After building, restart Keycloak to load new JARs:
```bash
docker-compose restart keycloak
```

### Frontend

Frontend runs in dev mode (hot-reload) or as a built artifact in Docker.

```bash
# Development (recommended)
cd frontend
npm install
npm start  # Runs on http://localhost:3000 with hot-reload

# OR run in Docker
docker-compose up frontend  # (uncomment in docker-compose.yml first)
```

### Database Migrations

Migrations in `db/migrations/` are auto-applied on Keycloak startup.

```bash
# Add new migration
# Create: db/migrations/V002_add_custom_table.sql
# Auto-applied when containers restart

# Check migration status
docker-compose exec keycloak mvn flyway:info
```

## Common Tasks

| Task | Command |
|------|---------|
| Start dev stack | `make up` |
| Stop dev stack | `make down` |
| View logs | `make logs` |
| Lint frontend | `make frontend-lint` |
| Run all tests | `make test` |
| Build all artifacts | `make build` |
| Deploy to staging | `make deploy-staging` |
| Deploy to production | `make deploy-prod` |

See [Makefile](Makefile) for all available commands.

## Configuration

Environment variables defined in [.env.example](.env.example). For local development:

```bash
cp .env.example .env.local
# Edit .env.local with local overrides (git-ignored)
```

Key variables:
- `KEYCLOAK_ADMIN_PASSWORD` — Keycloak admin password
- `DB_PASSWORD` — PostgreSQL password
- `ACCESS_TOKEN_LIFETIME_MINUTES` — OAuth2 token expiry
- `FEATURE_*` — Feature flags (MFA, SAML, LDAP, etc.)

## Technology Stack (Locked Decisions)

| Component | Choice | Notes |
|-----------|--------|-------|
| **Identity Provider** | Keycloak (Java) | Core OAuth2/OIDC/SAML engine with SPI extensibility |
| **Database** | PostgreSQL 15+ | Single choice: used identically across dev, staging, production |
| **Deployment** | Docker + Kubernetes | Environment parity: same images in all environments (dev → staging → prod) |
| **Multi-Tenancy** | Realm-per-tenant | Each tenant = isolated Keycloak realm; auto-created on signup |
| **Infrastructure** | AWS (VPC, RDS, EKS, ALB) | Terraform-defined; environment overrides via Kustomize |

### Multi-Tenancy Model
**Realm-per-tenant:** Each tenant gets a dedicated Keycloak realm for isolation. Realms created on-demand via API.

### Authentication Flows
- **OAuth2/OIDC:** Standard auth for web/mobile apps
- **SAML:** Enterprise federation (Okta, Azure AD, etc.)
- **LDAP/AD:** Directory federation for enterprise users
- **MFA:** TOTP, SMS, email OTP
- **Social Login:** Google, GitHub, Microsoft, etc.

### Infrastructure (AWS)
- **Network:** VPC with public/private subnets, security groups
- **Database:** RDS PostgreSQL (same engine as local dev, ensures parity)
- **Compute:** EKS cluster with auto-scaling node groups
- **Load Balancing:** ALB for ingress, Route53 for multi-region failover
- **Secrets:** AWS Secrets Manager for credentials (rotated automatically)

## Deployment

### Staging

```bash
# Deploy Keycloak + supporting services to staging EKS cluster
make deploy-staging

# Or manually:
kustomize build k8s/overlays/staging | kubectl apply -f -
```

### Production

```bash
# Deploy to production (requires prod cluster access)
make deploy-prod

# Or manually:
kustomize build k8s/overlays/production | kubectl apply -f -
```

### Infrastructure Setup (AWS)

```bash
# Provision VPC, RDS, EKS with Terraform
cd terraform/aws
terraform init
terraform plan
terraform apply
```

## Security

- **Secrets management:** Use `.env.local` (git-ignored) for dev; production uses K8s secrets / AWS Secrets Manager
- **TLS:** Enabled in production; local dev uses self-signed certs (nginx)
- **Database:** Credentials in environment variables, not committed to git
- **Admin console:** Protected by strong admin password (change from default)
- **Token signing:** RS256 (asymmetric) with JWKS endpoint for consumer validation

## Observability

Logs, metrics, and traces:
- **Logs:** Docker logs (local), CloudWatch (AWS), ELK stack (optional)
- **Metrics:** Prometheus endpoints exposed by Keycloak
- **Traces:** Jaeger (optional, configured via environment variables)

Configure in [.env.example](.env.example) and `docs/guides/observability.md`.

## Troubleshooting

### Keycloak Won't Start
```bash
# Check logs
docker-compose logs keycloak

# Ensure DB is ready
docker-compose logs postgres

# Restart
docker-compose restart keycloak
```

### Port Already in Use
```bash
# Find and kill process using port 8080
lsof -i :8080
kill -9 <PID>

# OR use different port in docker-compose.yml
```

### Database Connection Error
```bash
# Ensure PostgreSQL is healthy
docker-compose ps postgres

# Check credentials in docker-compose.yml and .env.local
```

## Documentation

- [Architecture & Design](docs/architecture/) — System design, C4 diagrams, threat model
- [Developer Guides](docs/guides/) — Setup, deployment, troubleshooting
- [API Reference](docs/api/) — OpenAPI specs for all endpoints
- [CLAUDE.md](CLAUDE.md) — Claude Code guidance for this repository

## Roadmap

See [Keycloak SaaS Development Roadmap](https://claude.ai/artifact/Jew6Dh3prcc8HCDxNisHXZ) for phased development plan and dependency chains (245 backlog items across 4 phases).

**Critical blockers for Phase 1 (Foundation):**
1. Backend runtime decision (Node.js vs Java vs other)
2. Database choice (PostgreSQL vs Oracle)
3. Frontend framework (React/Next.js vs Vue vs other)
4. Realm strategy & multi-tenancy model

## Contributing

1. Create feature branch: `git checkout -b feat/feature-name`
2. Follow commit message conventions (see CLAUDE.md)
3. Open PR with description and test plan
4. Merge after review

## Support

- **Issues:** GitHub Issues (link to repo)
- **Documentation:** See `/docs` directory
- **Slack/Email:** (add team contact if applicable)

## License

(Add your license here)

---

Last Updated: 2026-09-24
