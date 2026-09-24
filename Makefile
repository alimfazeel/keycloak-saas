.PHONY: help up down logs test lint build deploy clean

help:
	@echo "Keycloak SaaS Development Commands"
	@echo ""
	@echo "Local Development:"
	@echo "  make up              - Start local dev stack (docker-compose up -d)"
	@echo "  make down            - Stop all containers"
	@echo "  make logs            - Tail all container logs"
	@echo "  make clean           - Remove containers, volumes, and build artifacts"
	@echo ""
	@echo "Backend (Node.js/Fastify):"
	@echo "  make backend-install - Install Node.js dependencies"
	@echo "  make backend-dev     - Start backend dev server with hot reload"
	@echo "  make backend-build   - Build optimized backend bundle"
	@echo "  make backend-test    - Run backend unit tests"
	@echo "  make backend-lint    - Lint backend code"
	@echo ""
	@echo "Frontend:"
	@echo "  make frontend-dev    - Start frontend dev server"
	@echo "  make frontend-build  - Build optimized frontend bundle"
	@echo "  make frontend-test   - Run frontend tests"
	@echo ""
	@echo "Database:"
	@echo "  make db-dump         - Backup database to file"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-staging  - Deploy to staging"
	@echo "  make deploy-prod     - Deploy to production"
	@echo ""

# Local Development
up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-keycloak:
	docker-compose logs -f keycloak

logs-db:
	docker-compose logs -f postgres

clean:
	docker-compose down -v
	rm -rf build/ dist/ .next/ node_modules/ target/

# Backend (Node.js/Fastify API)
backend-install:
	cd backend && npm install

backend-build:
	cd backend && npm run build

backend-dev:
	cd backend && npm run dev

backend-test:
	cd backend && npm test

backend-test-watch:
	cd backend && npm run test:watch

backend-lint:
	cd backend && npm run lint

backend-format:
	cd backend && npm run format

# Frontend
frontend-dev:
	cd frontend && npm install && npm start

frontend-build:
	cd frontend && npm install && npm run build

frontend-test:
	cd frontend && npm test

frontend-lint:
	cd frontend && npm run lint

# Docker
docker-build-keycloak:
	docker build -f docker/Dockerfile.keycloak -t keycloak-saas:latest .

docker-build-api:
	cd backend && npm run build && docker build -f ../docker/Dockerfile.api -t keycloak-saas-api:latest ..

docker-build-all: docker-build-keycloak docker-build-api

# Database
db-migrate:
	# Migrations auto-applied on container startup via docker-entrypoint-initdb.d
	@echo "Migrations applied automatically. Check docker logs for status."

db-dump:
	docker exec keycloak-db pg_dump -U keycloak keycloak > db/backup_$(shell date +%Y%m%d_%H%M%S).sql

# Kubernetes / Deployment
deploy-staging:
	kubectl apply -k k8s/overlays/staging

deploy-prod:
	kubectl apply -k k8s/overlays/production

deploy-dev:
	kubectl apply -k k8s/overlays/dev

kustomize-diff-staging:
	kustomize build k8s/overlays/staging

# Linting & Code Quality
lint: frontend-lint
	@echo "Lint complete"

test: backend-test frontend-test
	@echo "All tests passed"

build: backend-build frontend-build docker-build-all
	@echo "Build complete"

# CI/CD (GitHub Actions style)
ci-test:
	$(MAKE) backend-test
	$(MAKE) frontend-test

ci-build:
	$(MAKE) backend-build
	$(MAKE) frontend-build
	$(MAKE) docker-build-all

# Onboarding
onboarding:
	@echo "Setting up Keycloak SaaS development environment..."
	$(MAKE) up
	@echo "Waiting for services to be ready..."
	sleep 30
	$(MAKE) db-migrate
	@echo "✓ Development environment ready!"
	@echo "  Keycloak: http://localhost:8080"
	@echo "  Frontend (dev): npm start in frontend/"
	@echo "  API: http://localhost:3000 (if running backend)"
