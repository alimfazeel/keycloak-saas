# Security Parameters (Phase 0 P0)

Foundation configuration for all authentication and security flows in the Keycloak SaaS platform.

## Overview

Security parameters are **immutable configuration entries** that define the security posture of the system. They control:
- **Token lifecycle** — access token TTL, refresh token rotation, JWT signing
- **Session management** — idle timeout, max session duration
- **Password policy** — length, complexity, history, hashing algorithm
- **Brute-force protection** — lockout thresholds, lockout duration
- **Multi-factor authentication** — TOTP, WebAuthn, backup codes
- **TLS/encryption** — minimum TLS version, cipher suites, at-rest encryption
- **PKCE enforcement** — authorization code interception prevention
- **Admin console security** — MFA requirement, IP allowlist
- **Audit & compliance** — log retention, archival strategy
- **Rate limiting** — token endpoint, login endpoint
- **Secrets management** — rotation interval, client secret hashing
- **CORS & redirects** — strict URI validation, CORS origin allowlist

## Implementation Status

✅ **Phase 0 P0 Complete:**
- `backend/src/constants/SecurityParameters.ts` — 52 parameters defined with validation rules
- `db/migrations/V002__Seed_Security_Parameters.sql` — database seeding (all defaults)
- `backend/src/routes/SecurityParametersRoutes.ts` — REST API for parameter management
- `backend/src/index.ts` — integrated into Fastify server

## Parameter Structure

Each parameter has:

```typescript
interface SecurityParameter {
  key: string;                    // e.g., "token.access.lifetime.seconds"
  displayName: string;            // e.g., "Access Token Lifetime"
  description: string;            // Why it matters
  defaultValue: string;           // Seed value
  type: 'STRING' | 'INTEGER' | 'BOOLEAN' | 'JSON';
  category: 'TOKEN' | 'SESSION' | 'PASSWORD' | 'MFA' | 'TLS' | 'PKCE' | 'ADMIN' | 'AUDIT' | 'RATE_LIMIT' | 'ENCRYPTION' | 'SECRETS';
  scope: 'GLOBAL' | 'TENANT' | 'BOTH';  // GLOBAL = system-wide; TENANT = per-realm override
  immutable: boolean;             // If true, cannot be changed after initial setup
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedValues?: string[];
  };
  impact: string;                // Why this decision matters
  compliance?: string[];          // GDPR, HIPAA, SOC2, etc.
}
```

## Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **TOKEN** | 6 | JWT lifetime, signing, rotation |
| **SESSION** | 3 | SSO idle/max lifetime, remember-me |
| **PASSWORD** | 8 | Length, complexity, history, hashing |
| **MFA** | 4 | TOTP, WebAuthn, enforcement, backup codes |
| **TLS** | 4 | Version, cipher suites, at-rest encryption |
| **PKCE** | 2 | Code challenge enforcement and method |
| **ADMIN** | 3 | Console MFA, IP allowlist |
| **AUDIT** | 2 | Retention, archival strategy |
| **RATE_LIMIT** | 2 | Token and login endpoint limits |
| **ENCRYPTION** | 3 | At-rest algorithm, client secret hashing, tenant secrets |
| **CORS** | 2 | Redirect URI validation, CORS origins |

**Total: 52 security parameters**

## Scope Levels

### GLOBAL (System-wide)
Examples:
- `token.jwt.signing.algorithm` (RS256)
- `secrets.client.hashing.enabled` (immutable, must be true)
- `mfa.enforcement.admin.required` (all admins must use MFA)

**Cannot be changed via tenant portal.** Require system admin action in Keycloak admin console or backend API with elevated privileges.

### TENANT (Per-Realm Override)
Examples:
- `session.remember.me.enabled` — some tenants want it, others don't
- `cors.allowed.origins` — unique per tenant's frontend domain
- `mfa.totp.enabled` — tenant can disable if desired (not recommended)

**Can be overridden by tenant admin** via Tenant Portal without affecting other tenants.

### BOTH
Examples:
- Password policy (global baseline, but tenant can make stricter)
- MFA enforcement (global minimum, tenant can require for more users)

## Default Values (Seed)

Seeded at database initialization (`V002__Seed_Security_Parameters.sql`):

### Token Lifecycle (Security-First)
```
token.access.lifetime.seconds = 900 (15 minutes)
  ↳ Short-lived to minimize exposure if token leaked
token.refresh.lifetime.seconds = 604800 (7 days)
  ↳ Users re-authenticate weekly (good balance)
token.refresh.rotation.enabled = true
  ↳ New refresh token on each use prevents replay attacks
token.jwt.signing.algorithm = RS256 (immutable)
  ↳ Asymmetric signing; resource servers can validate independently
token.jwt.key.rotation.days = 7 (weekly key rotation)
  ↳ Weekly rotation balances security vs operational complexity
token.jwks.cache.ttl.seconds = 3600 (1 hour)
  ↳ Resource servers cache public keys; 1h propagates new keys same day
```

### Session Management (Balances Security & UX)
```
session.sso.idle.timeout.seconds = 1800 (30 minutes)
  ↳ Auto-logout on unattended terminals
session.sso.max.lifetime.seconds = 86400 (24 hours)
  ↳ Force re-auth at least once per day
session.remember.me.enabled = false
  ↳ Disabled by default (higher security); tenant can enable if desired
```

### Password Policy (NIST 2021 Guidance)
```
password.policy.length.min = 12 (characters)
  ↳ 12+ is modern baseline (was 8)
password.policy.require.uppercase = true
password.policy.require.lowercase = true
password.policy.require.digits = true
password.policy.require.special.chars = true
password.policy.history.count = 12
  ↳ Prevent cycling through weak variations
password.policy.max.age.days = 0
  ↳ NIST 2021: NO expiry by default; only on breach
password.hashing.algorithm = pbkdf2-sha256
  ↳ Keycloak default; recommend Argon2 in production
```

### Brute-Force Protection (Defense-in-Depth)
```
bruteforce.protection.enabled = true
bruteforce.max.login.failures = 5
  ↳ Lock after 5 failed attempts
bruteforce.lockout.duration.seconds = 900 (15 minutes)
  ↳ Long enough to frustrate attackers; short enough for legitimate users
bruteforce.failure.reset.minutes = 30
  ↳ Counter resets after 30 mins of inactivity
```

### MFA (Mandatory for Admins, Optional for Users)
```
mfa.totp.enabled = true (TOTP authenticator)
mfa.webauthn.enabled = true (hardware keys)
mfa.enforcement.admin.required = true (immutable)
  ↳ ALL admin accounts MUST use MFA
mfa.backup.codes.count = 10
  ↳ Prevents lockout if device lost
```

### TLS & Encryption (NIST-Approved Algorithms)
```
tls.version.min = "1.2"
  ↳ Reject 1.0/1.1 (known to be broken)
tls.cipher.suites = [ECDHE-RSA-AES-GCM, ECDHE-ECDSA-AES-GCM, ...]
  ↳ Modern ciphers only; no RC4, DES, or weak suites
encryption.at.rest.enabled = true
encryption.algorithm.at.rest = "AES-256-GCM"
  ↳ Protects PII in DB from breach
```

### PKCE (Authorization Code Interception Prevention)
```
pkce.required.public.clients = true
  ↳ REQUIRED for SPA, mobile, CLI clients
pkce.code.challenge.method = "S256" (SHA256)
  ↳ Secure; never use "plain" in production
```

### Admin Console (Fortress)
```
admin.console.mfa.required = true
  ↳ NO admin can log in without MFA
admin.console.ip.allowlist.enabled = true
admin.console.ip.allowlist = ["127.0.0.1/32"]
  ↳ Default: localhost only; expand carefully for ops team
```

### Audit & Compliance (7-Year Retention)
```
audit.log.retention.days = 2555 (7 years)
  ↳ Meets GDPR/HIPAA/SOC2 requirements
audit.log.archive.destination = {type: "S3", bucket: "audit-logs-archive"}
  ↳ Archive to Glacier after retention period
```

### Rate Limiting (Prevent DOS & Brute-Force)
```
ratelimit.token.endpoint.requests.per.minute = 500 (per client)
  ↳ Prevents refresh token abuse
ratelimit.login.endpoint.requests.per.minute = 30 (per IP)
  ↳ Prevents credential stuffing
```

### Secrets (Rotation & Encryption)
```
secrets.rotation.interval.days = 30 (monthly)
  ↳ Monthly key rotation balances security vs operational burden
secrets.client.hashing.enabled = true (immutable)
  ↳ NEVER store client secrets in cleartext
secrets.tenant.encryption.enabled = true
  ↳ Tenant API keys encrypted separately (multi-tenant isolation)
```

### CORS & Redirects (Open Redirect Prevention)
```
oauth.redirect.uri.validation.strict = true
  ↳ Exact-match URIs; no wildcards or fuzzy matching
cors.allowed.origins = [] (empty by default)
  ↳ Tenant admin must explicitly configure for their frontend domain
```

## API Endpoints

### 1. List All Parameters
```
GET /api/security-parameters
Query params: none
Response:
{
  "parameters": [
    {
      "key": "token.access.lifetime.seconds",
      "displayName": "Access Token Lifetime",
      "description": "JWT access token expiry (15 minutes)",
      "value": "900",
      "type": "INTEGER",
      "category": "TOKEN",
      "scope": "GLOBAL",
      "immutable": false,
      "constraints": { "min": 60, "max": 3600 },
      "impact": "Shorter = more secure, more refresh calls",
      "compliance": ["OAuth2", "OIDC"]
    },
    ...
  ]
}
```

### 2. Get Parameter by Key
```
GET /api/security-parameters/token.access.lifetime.seconds
Response: (single parameter object with current value)
```

### 3. List Parameters by Category
```
GET /api/security-parameters/category/TOKEN
Response:
{
  "category": "TOKEN",
  "parameters": [
    { "key": "token.access.lifetime.seconds", "value": "900", ... },
    { "key": "token.refresh.lifetime.seconds", "value": "604800", ... },
    ...
  ]
}
```

### 4. Update Parameter (TENANT scope only)
```
PATCH /api/security-parameters/session.remember.me.enabled
Request body: { "value": "true" }
Response:
{
  "key": "session.remember.me.enabled",
  "displayName": "Remember Me Feature",
  "oldValue": "false",
  "newValue": "true",
  "success": true
}

Restrictions:
- Cannot update GLOBAL-scope parameters (forbidden)
- Cannot update immutable parameters (bad request)
- Value must pass validation (bad request if fails)
- Logs audit event to audit_logs table
```

### 5. Validate Parameter (Dry-Run)
```
GET /api/security-parameters/validation/token.access.lifetime.seconds?value=1800
Response:
{
  "key": "token.access.lifetime.seconds",
  "value": "1800",
  "valid": true,
  "error": null
}

Or if invalid:
{
  "key": "token.access.lifetime.seconds",
  "value": "10",
  "valid": false,
  "error": "Value 10 is below minimum 60"
}
```

### 6. Audit Trail (Recent Changes)
```
GET /api/security-parameters/audit?limit=50&offset=0&key=password.policy.length.min&days=7
Response:
{
  "events": [
    {
      "timestamp": "2026-09-25T10:30:00Z",
      "key": "password.policy.length.min",
      "oldValue": "8",
      "newValue": "12",
      "changedBy": "tenant-admin@example.com",
      "tenantId": "org-123"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

## Access Control

### Reading Parameters
- **Public API** (GET /api/security-parameters) — any authenticated user can read current values
- **Rationale:** Users should know the security policy affecting them

### Updating Parameters (TENANT Scope)
- **Tenant Admin Only** — can update TENANT-scope parameters for their realm
- **Rationale:** Allows customization per tenant; prevents cross-tenant interference

### Updating Parameters (GLOBAL Scope)
- **Forbidden via standard endpoint** — requires system admin action in Keycloak admin console
- **Rationale:** GLOBAL changes affect all tenants; require elevated privileges and careful coordination

### Audit Trail
- **Tenant Admin** — can view changes to TENANT-scope parameters in their realm only
- **System Admin** — can view all changes across all tenants
- **Rationale:** Compliance and debugging; tenant isolation maintained

## Database Schema

Stored in `application_config` table:

```sql
INSERT INTO application_config 
  (config_key, config_value, config_type, description, is_secret, is_active, created_by, created_at, version)
VALUES
  ('token.access.lifetime.seconds', '900', 'INTEGER', 'JWT access token expiry (15 minutes)', false, true, 'SYSTEM', NOW(), 1),
  ('session.sso.idle.timeout.seconds', '1800', 'INTEGER', 'SSO session idle timeout (30 minutes)', false, true, 'SYSTEM', NOW(), 1),
  ...
```

**Indexes for fast queries:**
- `config_key` (unique)
- `config_type`
- `is_active`

## Next Steps (Phase 0 P0 → P1)

1. **Keycloak Configuration** — Apply these parameters to Keycloak realm settings via Admin API
   - Password policy via `/admin/realms/{realm}/password-policy`
   - Token lifetimes via client configuration
   - Brute-force settings via `/admin/realms/{realm}/components`
   - MFA policies via authenticator factories

2. **Resource Server Integration** — JWKS caching, token validation, rate limiting
   - Backend APIs use JWKS cache TTL for public key validation
   - Implement rate limiting middleware (token endpoint, login endpoint)

3. **Audit Logging** — Log all parameter changes
   - Update `AuditLogService` to log CONFIG_CHANGED events
   - Tenant Portal shows audit trail per parameter

4. **Tenant Portal UI** — Read-only view for all users, edit view for admins
   - Display parameter categories
   - Show current values vs defaults
   - Allow TENANT-scope overrides
   - Display compliance tags

## Compliance Mappings

Each parameter is tagged with applicable compliance frameworks:

| Compliance | Parameters |
|-----------|------------|
| **GDPR** | Token rotation, password history, MFA, audit retention, encryption |
| **HIPAA** | MFA enforcement, brute-force protection, audit retention, TLS 1.2+ |
| **SOC2** | Password policy, session management, admin MFA, encryption, audit |
| **PCI-DSS** | TLS 1.2+, brute-force protection, audit retention |
| **NIST** | Password policy (no expiry), MFA, TLS, encryption, rate limiting |
| **OAuth2/OIDC** | Token lifetimes, PKCE enforcement, redirect URI validation |
| **OWASP** | Password hashing, brute-force protection, PKCE, rate limiting |

## Troubleshooting

### "Parameter is immutable"
The parameter cannot be changed. Examples: JWT signing algorithm, client secret hashing.
**Fix:** Contact system administrator if change is truly needed; immutability is intentional.

### "Parameter is GLOBAL scope"
Cannot update GLOBAL parameters via tenant portal. Examples: admin console MFA.
**Fix:** Requires system admin action via Keycloak admin console or backend API with elevated privileges.

### "Validation failed: Value below minimum"
Parameter value violates constraints (e.g., token TTL too short).
**Fix:** Use `GET /api/security-parameters/validation/:key?value=...` to test before saving.

### Changes not reflected in Keycloak
Parameter changed in application_config, but Keycloak realm still uses old values.
**Fix:** Keycloak caches settings; restart Keycloak container or trigger cache reload.

---

**Status:** ✅ Phase 0 P0 Complete — 52 parameters defined, seeded, API operational  
**Last Updated:** 2026-09-25
