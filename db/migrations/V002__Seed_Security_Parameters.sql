-- V002: Seed default security parameters into application_config table
-- These are immutable foundation settings that must be configured before any auth flows start.
-- Tenant admins can override TENANT-scoped parameters; GLOBAL parameters are system-wide defaults.

INSERT INTO application_config
  (config_key, config_value, config_type, description, is_secret, is_active, created_by, created_at, version)
VALUES
  -- ============ TOKEN LIFECYCLE ============
  ('token.access.lifetime.seconds', '900', 'INTEGER', 'JWT access token expiry (15 minutes)', false, true, 'SYSTEM', NOW(), 1),
  ('token.refresh.lifetime.seconds', '604800', 'INTEGER', 'Refresh token lifetime (7 days)', false, true, 'SYSTEM', NOW(), 1),
  ('token.refresh.rotation.enabled', 'true', 'BOOLEAN', 'Issue new refresh token on each use (rotate on reuse)', false, true, 'SYSTEM', NOW(), 1),
  ('token.jwt.signing.algorithm', 'RS256', 'STRING', 'JWT signing algorithm (RSA 256-bit)', false, true, 'SYSTEM', NOW(), 1),
  ('token.jwt.key.rotation.days', '7', 'INTEGER', 'Rotate JWT signing keys weekly', false, true, 'SYSTEM', NOW(), 1),
  ('token.jwks.cache.ttl.seconds', '3600', 'INTEGER', 'JWKS public key cache TTL (1 hour)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ SESSION LIFECYCLE ============
  ('session.sso.idle.timeout.seconds', '1800', 'INTEGER', 'SSO session idle timeout (30 minutes)', false, true, 'SYSTEM', NOW(), 1),
  ('session.sso.max.lifetime.seconds', '86400', 'INTEGER', 'SSO session max lifetime (24 hours)', false, true, 'SYSTEM', NOW(), 1),
  ('session.remember.me.enabled', 'false', 'BOOLEAN', 'Disable remember-me (require fresh auth)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ PASSWORD POLICY ============
  ('password.policy.length.min', '12', 'INTEGER', 'Minimum password length (12 characters)', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.require.uppercase', 'true', 'BOOLEAN', 'Require uppercase letters in password', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.require.lowercase', 'true', 'BOOLEAN', 'Require lowercase letters in password', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.require.digits', 'true', 'BOOLEAN', 'Require digits in password', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.require.special.chars', 'true', 'BOOLEAN', 'Require special characters in password', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.history.count', '12', 'INTEGER', 'Password history (12 previous passwords tracked)', false, true, 'SYSTEM', NOW(), 1),
  ('password.policy.max.age.days', '0', 'INTEGER', 'Password expiry disabled (follow NIST 2021 guidance)', false, true, 'SYSTEM', NOW(), 1),
  ('password.hashing.algorithm', 'pbkdf2-sha256', 'STRING', 'Password hashing algorithm (PBKDF2-SHA256)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ BRUTE-FORCE PROTECTION ============
  ('bruteforce.protection.enabled', 'true', 'BOOLEAN', 'Enable brute-force detection and account lockout', false, true, 'SYSTEM', NOW(), 1),
  ('bruteforce.max.login.failures', '5', 'INTEGER', 'Lock account after 5 failed login attempts', false, true, 'SYSTEM', NOW(), 1),
  ('bruteforce.lockout.duration.seconds', '900', 'INTEGER', 'Account lockout duration (15 minutes)', false, true, 'SYSTEM', NOW(), 1),
  ('bruteforce.failure.reset.minutes', '30', 'INTEGER', 'Reset failed attempts after 30 minutes of inactivity', false, true, 'SYSTEM', NOW(), 1),

  -- ============ MFA ============
  ('mfa.totp.enabled', 'true', 'BOOLEAN', 'Enable TOTP authenticator app (Google Authenticator, Authy)', false, true, 'SYSTEM', NOW(), 1),
  ('mfa.webauthn.enabled', 'true', 'BOOLEAN', 'Enable WebAuthn/FIDO2 hardware keys', false, true, 'SYSTEM', NOW(), 1),
  ('mfa.enforcement.admin.required', 'true', 'BOOLEAN', 'Mandatory MFA for all admin/privileged users', false, true, 'SYSTEM', NOW(), 1),
  ('mfa.backup.codes.count', '10', 'INTEGER', 'Generate 10 backup codes on MFA enrollment', false, true, 'SYSTEM', NOW(), 1),

  -- ============ TLS & ENCRYPTION ============
  ('tls.version.min', '1.2', 'STRING', 'Minimum TLS version (1.2 = baseline; reject 1.0/1.1)', false, true, 'SYSTEM', NOW(), 1),
  ('tls.cipher.suites', '["TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256", "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384", "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256", "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"]', 'JSON', 'Allowed TLS cipher suites (strong ciphers only)', false, true, 'SYSTEM', NOW(), 1),
  ('encryption.at.rest.enabled', 'true', 'BOOLEAN', 'Enable encryption at rest for PII in database', false, true, 'SYSTEM', NOW(), 1),
  ('encryption.algorithm.at.rest', 'AES-256-GCM', 'STRING', 'Encryption algorithm for data at rest (AES-256-GCM)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ PKCE ============
  ('pkce.required.public.clients', 'true', 'BOOLEAN', 'Require PKCE for all public clients (SPA, mobile)', false, true, 'SYSTEM', NOW(), 1),
  ('pkce.code.challenge.method', 'S256', 'STRING', 'PKCE challenge method (S256 = SHA256, secure)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ ADMIN CONSOLE ============
  ('admin.console.mfa.required', 'true', 'BOOLEAN', 'Mandatory MFA for Keycloak admin console access', false, true, 'SYSTEM', NOW(), 1),
  ('admin.console.ip.allowlist.enabled', 'true', 'BOOLEAN', 'Restrict admin console to IP allowlist', false, true, 'SYSTEM', NOW(), 1),
  ('admin.console.ip.allowlist', '["127.0.0.1/32"]', 'JSON', 'IP allowlist for admin console (localhost only by default)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ AUDIT & COMPLIANCE ============
  ('audit.log.retention.days', '2555', 'INTEGER', 'Retain audit logs for 7 years (compliance default)', false, true, 'SYSTEM', NOW(), 1),
  ('audit.log.archive.destination', '{"type": "S3", "bucket": "audit-logs-archive", "prefix": ""}', 'JSON', 'Archive old audit logs to S3 Glacier for long-term retention', false, true, 'SYSTEM', NOW(), 1),

  -- ============ RATE LIMITING ============
  ('ratelimit.token.endpoint.requests.per.minute', '500', 'INTEGER', 'Rate limit: /token endpoint (500 req/min per client)', false, true, 'SYSTEM', NOW(), 1),
  ('ratelimit.login.endpoint.requests.per.minute', '30', 'INTEGER', 'Rate limit: login endpoint (30 attempts/min per IP)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ SECRETS MANAGEMENT ============
  ('secrets.rotation.interval.days', '30', 'INTEGER', 'Rotate platform secrets every 30 days', false, true, 'SYSTEM', NOW(), 1),
  ('secrets.client.hashing.enabled', 'true', 'BOOLEAN', 'Hash client secrets (never store cleartext)', false, true, 'SYSTEM', NOW(), 1),
  ('secrets.tenant.encryption.enabled', 'true', 'BOOLEAN', 'Encrypt tenant-supplied API keys separately (multi-tenant isolation)', false, true, 'SYSTEM', NOW(), 1),

  -- ============ CORS & REDIRECTS ============
  ('oauth.redirect.uri.validation.strict', 'true', 'BOOLEAN', 'Require exact-match redirect URIs (no wildcards)', false, true, 'SYSTEM', NOW(), 1),
  ('cors.allowed.origins', '[]', 'JSON', 'CORS allowed origins (empty by default; configure per tenant)', false, true, 'SYSTEM', NOW(), 1)
ON CONFLICT (config_key) DO NOTHING;

-- Log this seeding event to audit_logs
INSERT INTO audit_logs
  (event_type, event_category, log_level, action, status, user_id, tenant_id, created_at, created_at_epoch)
VALUES
  ('SECURITY_PARAMETERS_SEEDED', 'CONFIGURATION', 'INFO', 'SYSTEM_INITIALIZATION', 'SUCCESS', 'SYSTEM', NULL, NOW(), EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT DO NOTHING;
