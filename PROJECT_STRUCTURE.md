# Keycloak SaaS Project Structure

```
keycloak-saas/
├── backend/                           # Node.js/NestJS backend services
│   ├── src/
│   │   ├── main/java/                 # Keycloak extensions (Java)
│   │   │   └── com/keycloak/saas/
│   │   │       ├── providers/         # Custom Keycloak providers (User Storage, Authenticators)
│   │   │       ├── events/            # Event listeners
│   │   │       └── validators/        # Custom validators
│   │   ├── resources/theme/           # Keycloak realm + theme customizations
│   │   └── test/                      # Java unit tests
│   ├── config/                        # Configuration files, environment templates
│   └── pom.xml                        # Maven build config (Keycloak extensions)
│
├── frontend/                          # React/Next.js frontend (portals, dashboards)
│   ├── src/
│   │   ├── components/                # Reusable UI components
│   │   ├── pages/                     # Route pages (admin portal, user portal)
│   │   ├── services/                  # API clients, state management
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── types/                     # TypeScript type definitions
│   │   └── styles/                    # Global styles
│   ├── public/                        # Static assets
│   ├── tests/                         # Jest tests
│   └── package.json                   # NPM dependencies
│
├── docker/                            # Docker configuration
│   ├── Dockerfile.keycloak            # Keycloak image with extensions
│   ├── Dockerfile.api                 # API backend image
│   ├── Dockerfile.frontend            # Frontend image
│   └── docker-compose.yml             # Local dev environment
│
├── k8s/                               # Kubernetes manifests
│   ├── base/                          # Base kustomization (Keycloak, DB, services)
│   └── overlays/
│       ├── dev/                       # Development overrides (dev DNS, replicas=1)
│       ├── staging/                   # Staging overrides
│       └── production/                # Production overrides (HA, autoscaling)
│
├── db/                                # Database configuration & migrations
│   ├── migrations/                    # Flyway/Liquibase versioned migrations (V001, V002, ...)
│   └── init/                          # Initial realm setup, seed data
│
├── scripts/                           # Automation scripts
│   ├── setup/                         # Dev environment onboarding
│   └── deploy/                        # CI/CD helpers (kustomize, helm, etc.)
│
├── config/                            # Configuration for external services
│   ├── keycloak/                      # Keycloak realm JSON, client configs
│   └── nginx/                         # Reverse proxy/ingress config (local & cloud)
│
├── terraform/                         # Infrastructure as Code (AWS)
│   └── aws/
│       ├── vpc/                       # VPC, subnets, security groups
│       ├── rds/                       # PostgreSQL/Oracle RDS
│       └── eks/                       # EKS cluster, node groups
│
├── docs/                              # Documentation
│   ├── architecture/                  # System design, diagrams
│   ├── guides/                        # Developer guides, setup instructions
│   └── api/                           # API documentation, OpenAPI specs
│
├── .github/                           # GitHub configuration
│   ├── workflows/                     # CI/CD pipelines (GitHub Actions)
│   └── ISSUE_TEMPLATE/                # Issue templates
│
├── CLAUDE.md                          # Claude Code guidance (this repo's conventions)
├── docker-compose.yml                 # Local dev stack (from docker/ repo into root)
├── Makefile                           # Common dev commands (make up, make test, make deploy)
├── README.md                          # Project overview & quick start
├── .env.example                       # Environment variable template
└── Identity_System_Backlog_Tracker.xlsx # Backlog tracker (this repo)
```

## Key Directories

### `/backend`
Keycloak extensions and custom authentication providers written in Java. Standard Maven layout.
- Builds into JAR plugins that deploy to Keycloak's `providers/` folder
- Custom User Storage Providers for enterprise LDAP/AD federation
- Event listeners for audit logging and integrations
- Custom authenticators for step-up auth and MFA flow enhancements

### `/frontend`
React or Vue.js applications for tenant admin portal and user self-service portal.
- Communicates with Keycloak Admin REST API (protected by service account)
- Displays subscription/usage metrics, user management, integrations

### `/k8s`
Kustomize-based Kubernetes manifests. Base layer shared across all environments.
- Use `overlays/` for environment-specific values (replicas, resource limits, domains)
- Includes Keycloak Deployment, PostgreSQL StatefulSet, Ingress, Secrets, ConfigMaps

### `/db`
Database migrations + initialization.
- Flyway or Liquibase versioned migrations (V001_initial_schema.sql, V002_add_audit_table.sql)
- Keycloak manages its own schema; custom migrations for app-specific tables

### `/docker`
Docker Compose for local development. Keycloak + PostgreSQL + reverse proxy (nginx).
- Same images are used in staging/production (not throwaway dev-only containers)
- Single `docker-compose up` starts full stack with health-check gating

### `/terraform`
Infrastructure provisioning for AWS. Creates VPC, RDS, EKS cluster, security groups.
- Separate modules for each AWS service for reusability
- Outputs used to bootstrap Kubernetes (DB endpoint, security group IDs, etc.)

### `/docs`
Architecture decision records, setup guides, API reference.
- `architecture/` contains C4 diagrams, data flow, security threat model
- `guides/` has onboarding steps, deployment procedures
- `api/` has OpenAPI/Swagger specs for all exposed endpoints

## Development Entry Points

- **Local stack:** `docker-compose up` from root (starts Keycloak, DB, services)
- **Backend changes:** Edit code in `backend/src/`, rebuild with Maven
- **Frontend changes:** Edit code in `frontend/src/`, dev server hot-reloads
- **Infrastructure changes:** Edit Terraform in `terraform/aws/`, apply to AWS
- **K8s deployments:** Use `kustomize` to deploy from `k8s/` overlays

## Technology Stack (Decisions Pending)

- **Keycloak Host:** Docker, Docker Compose (local), Kubernetes (staging/prod)
- **Database:** PostgreSQL (or Oracle per decision in backlog)
- **Backend Extensibility:** Java (Keycloak SPI providers)
- **Frontend:** React/Next.js (per decision in backlog)
- **API Layer:** Node.js (Express/NestJS, per decision in backlog)
- **Infrastructure:** AWS (VPC, RDS, EKS, S3, ALB)
- **IaC:** Terraform + Kustomize
- **CI/CD:** GitHub Actions (assumed; customize per your platform)
