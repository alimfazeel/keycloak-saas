/**
 * Security Parameters: immutable definitions and validation rules.
 * All values are seeded in application_config table on first run.
 */

export interface SecurityParameter {
  key: string;
  displayName: string;
  description: string;
  defaultValue: string;
  type: 'STRING' | 'INTEGER' | 'BOOLEAN' | 'JSON';
  category: 'TOKEN' | 'SESSION' | 'PASSWORD' | 'MFA' | 'TLS' | 'PKCE' | 'ADMIN' | 'AUDIT' | 'ENCRYPTION' | 'RATE_LIMIT' | 'SECRETS';
  scope: 'GLOBAL' | 'TENANT' | 'BOTH'; // GLOBAL = system-wide, TENANT = per-realm override, BOTH = both
  immutable: boolean; // If true, cannot be changed after initial setup
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedValues?: string[];
  };
  impact: string; // Why this matters
  compliance?: string[]; // GDPR, HIPAA, SOC2, etc
}

/**
 * All security parameters, organized by category.
 * These are seeded into application_config table with these exact keys.
 */
export const SECURITY_PARAMETERS: SecurityParameter[] = [
  // ============ TOKEN LIFECYCLE ============
  {
    key: 'token.access.lifetime.seconds',
    displayName: 'Access Token Lifetime',
    description: 'JWT access token expiry in seconds. Shorter = more secure, more refresh calls. Standard: 900s (15m)',
    defaultValue: '900',
    type: 'INTEGER',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 60, max: 3600 },
    impact: 'Shorter tokens reduce exposure window if token leaked; longer reduces refresh load',
    compliance: ['OAuth2', 'OIDC']
  },
  {
    key: 'token.refresh.lifetime.seconds',
    displayName: 'Refresh Token Lifetime',
    description: 'Refresh token expiry in seconds. Standard: 86400s (24h) or 604800s (7d)',
    defaultValue: '604800',
    type: 'INTEGER',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 3600, max: 2592000 }, // 1h to 30d
    impact: 'Longer = fewer re-authentications; shorter = forced re-auth more often',
    compliance: ['OAuth2', 'OIDC']
  },
  {
    key: 'token.refresh.rotation.enabled',
    displayName: 'Refresh Token Rotation',
    description: 'Issue new refresh token on each use (old one revoked). Prevents replay attacks.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Enabled = higher security, more token churn; disabled = stateless but less secure',
    compliance: ['OAuth2', 'OIDC', 'GDPR', 'SOC2']
  },
  {
    key: 'token.jwt.signing.algorithm',
    displayName: 'JWT Signing Algorithm',
    description: 'Algorithm for signing JWTs. RS256 (RSA) recommended for asymmetric signing.',
    defaultValue: 'RS256',
    type: 'STRING',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: true, // Changing this breaks all existing tokens
    constraints: { allowedValues: ['RS256', 'RS512', 'ES256', 'ES512', 'HS256'] },
    impact: 'Asymmetric (RS*) = resource servers can validate independently; symmetric (HS*) = requires key sharing',
    compliance: ['OAuth2', 'OIDC']
  },
  {
    key: 'token.jwt.key.rotation.days',
    displayName: 'JWT Key Rotation Interval',
    description: 'Rotate signing keys every N days. Standard: 7 (weekly).',
    defaultValue: '7',
    type: 'INTEGER',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 1, max: 365 },
    impact: 'More frequent = better security but complicates key distribution; less frequent = easier ops',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'token.jwks.cache.ttl.seconds',
    displayName: 'JWKS Cache TTL',
    description: 'How long resource servers cache the JWKS (public keys). Standard: 3600s (1h).',
    defaultValue: '3600',
    type: 'INTEGER',
    category: 'TOKEN',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 300, max: 86400 },
    impact: 'Shorter = immediate key rotation propagation; longer = reduced JWKS endpoint load',
    compliance: ['OAuth2', 'OIDC']
  },

  // ============ SESSION LIFECYCLE ============
  {
    key: 'session.sso.idle.timeout.seconds',
    displayName: 'SSO Session Idle Timeout',
    description: 'User logged out if inactive for N seconds. Standard: 1800s (30m).',
    defaultValue: '1800',
    type: 'INTEGER',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 300, max: 86400 },
    impact: 'Shorter = more secure against unattended terminals; longer = better UX',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'session.sso.max.lifetime.seconds',
    displayName: 'SSO Session Max Lifetime',
    description: 'Maximum session lifespan regardless of activity. Standard: 86400s (24h).',
    defaultValue: '86400',
    type: 'INTEGER',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 3600, max: 604800 },
    impact: 'Shorter = forces re-auth more often; longer = risk of stale tokens',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'session.remember.me.enabled',
    displayName: 'Remember Me Feature',
    description: 'Allow users to stay logged in across browser restarts.',
    defaultValue: 'false',
    type: 'BOOLEAN',
    category: 'SESSION',
    scope: 'TENANT',
    immutable: false,
    impact: 'Enabled = better UX, higher risk if device is shared; disabled = better security',
    compliance: ['GDPR', 'SOC2']
  },

  // ============ PASSWORD POLICY ============
  {
    key: 'password.policy.length.min',
    displayName: 'Minimum Password Length',
    description: 'Minimum characters in password. Standard: 12 (was 8, now 12+ recommended).',
    defaultValue: '12',
    type: 'INTEGER',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 8, max: 128 },
    impact: 'Longer = exponentially harder to brute force',
    compliance: ['NIST', 'GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'password.policy.require.uppercase',
    displayName: 'Require Uppercase Letters',
    description: 'Password must contain at least one uppercase letter.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Increases entropy and reduces guessability',
    compliance: ['NIST', 'SOC2']
  },
  {
    key: 'password.policy.require.lowercase',
    displayName: 'Require Lowercase Letters',
    description: 'Password must contain at least one lowercase letter.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Increases entropy and reduces guessability',
    compliance: ['NIST', 'SOC2']
  },
  {
    key: 'password.policy.require.digits',
    displayName: 'Require Digits',
    description: 'Password must contain at least one digit.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Increases entropy and reduces guessability',
    compliance: ['NIST', 'SOC2']
  },
  {
    key: 'password.policy.require.special.chars',
    displayName: 'Require Special Characters',
    description: 'Password must contain at least one special character (!@#$%^&*).',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Increases entropy significantly; may reduce UX/usability',
    compliance: ['NIST', 'SOC2', 'HIPAA']
  },
  {
    key: 'password.policy.history.count',
    displayName: 'Password History',
    description: 'Number of previous passwords user cannot reuse. Standard: 5-12.',
    defaultValue: '12',
    type: 'INTEGER',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 0, max: 24 },
    impact: 'Prevents cycling through weak variations; higher = better security',
    compliance: ['NIST', 'SOC2', 'HIPAA']
  },
  {
    key: 'password.policy.max.age.days',
    displayName: 'Password Expiry Age',
    description: 'Force password change every N days. NIST 2021: recommend NO expiry (0), only on breach.',
    defaultValue: '0',
    type: 'INTEGER',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 0, max: 365 },
    impact: 'Expiry = compliance checkbox but weak security; 0 = follow NIST guidance',
    compliance: ['NIST 2021', 'GDPR', 'SOC2']
  },
  {
    key: 'password.hashing.algorithm',
    displayName: 'Password Hashing Algorithm',
    description: 'Algorithm for hashing passwords at rest. PBKDF2, bcrypt, or Argon2 (recommended).',
    defaultValue: 'pbkdf2-sha256',
    type: 'STRING',
    category: 'PASSWORD',
    scope: 'GLOBAL',
    immutable: true,
    constraints: { allowedValues: ['pbkdf2-sha256', 'pbkdf2-sha512', 'bcrypt', 'argon2'] },
    impact: 'Stronger algorithms (Argon2) are slower, harder to crack; Keycloak default is PBKDF2',
    compliance: ['GDPR', 'SOC2', 'HIPAA', 'OWASP']
  },

  // ============ BRUTE-FORCE PROTECTION ============
  {
    key: 'bruteforce.protection.enabled',
    displayName: 'Brute-Force Detection',
    description: 'Enable automatic detection and lockout of brute-force login attempts.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Enabled = slows down attackers; disabled = vulnerable to brute-force',
    compliance: ['NIST', 'SOC2', 'OWASP']
  },
  {
    key: 'bruteforce.max.login.failures',
    displayName: 'Max Login Failures',
    description: 'Lock account after N failed login attempts. Standard: 3-5.',
    defaultValue: '5',
    type: 'INTEGER',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 1, max: 20 },
    impact: 'Tradeoff: too low = DOS via account lockouts; too high = brute-force easier',
    compliance: ['NIST', 'SOC2', 'OWASP']
  },
  {
    key: 'bruteforce.lockout.duration.seconds',
    displayName: 'Account Lockout Duration',
    description: 'Lock account for N seconds after max failures. Standard: 300-900 (5-15m).',
    defaultValue: '900',
    type: 'INTEGER',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 60, max: 3600 },
    impact: 'Longer = more disruptive DOS vector; shorter = attacker can retry sooner',
    compliance: ['NIST', 'SOC2', 'OWASP']
  },
  {
    key: 'bruteforce.failure.reset.minutes',
    displayName: 'Failure Counter Reset',
    description: 'Reset failure counter after N minutes of inactivity.',
    defaultValue: '30',
    type: 'INTEGER',
    category: 'SESSION',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 5, max: 180 },
    impact: 'Allows legitimate users to retry after a period; attackers just wait',
    compliance: ['NIST', 'SOC2']
  },

  // ============ MFA ============
  {
    key: 'mfa.totp.enabled',
    displayName: 'TOTP/Authenticator App',
    description: 'Enable time-based one-time password (Google Authenticator, Authy).',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'MFA',
    scope: 'TENANT',
    immutable: false,
    impact: 'Industry standard, widely supported, no SMS costs',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'mfa.webauthn.enabled',
    displayName: 'WebAuthn/FIDO2',
    description: 'Enable hardware security key support (YubiKey, etc).',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'MFA',
    scope: 'TENANT',
    immutable: false,
    impact: 'Highest security; limited user adoption; requires device',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'mfa.enforcement.admin.required',
    displayName: 'MFA Required for Admins',
    description: 'Enforce MFA for all admin/privileged users.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'MFA',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Prevents admin account takeover; must be configured early',
    compliance: ['SOC2', 'HIPAA', 'CIS Benchmarks']
  },
  {
    key: 'mfa.backup.codes.count',
    displayName: 'MFA Backup Codes',
    description: 'Generate N backup codes when MFA enrolled. Standard: 10.',
    defaultValue: '10',
    type: 'INTEGER',
    category: 'MFA',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 5, max: 20 },
    impact: 'Prevents lockout if device lost; must be stored securely',
    compliance: ['GDPR', 'SOC2']
  },

  // ============ TLS & ENCRYPTION ============
  {
    key: 'tls.version.min',
    displayName: 'Minimum TLS Version',
    description: 'Reject connections below this TLS version. Must be TLS 1.2+.',
    defaultValue: '1.2',
    type: 'STRING',
    category: 'TLS',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { allowedValues: ['1.2', '1.3'] },
    impact: 'TLS 1.0/1.1 are broken; 1.2 = baseline; 1.3 = modern',
    compliance: ['PCI-DSS', 'NIST', 'SOC2', 'HIPAA']
  },
  {
    key: 'tls.cipher.suites',
    displayName: 'TLS Cipher Suites',
    description: 'Allowed cipher suites for TLS handshake. JSON array. Must use strong ciphers.',
    defaultValue: '["TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256", "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384", "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256", "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"]',
    type: 'JSON',
    category: 'TLS',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Weak ciphers = vulnerable to cryptanalysis; strong = slower but secure',
    compliance: ['PCI-DSS', 'NIST', 'SOC2', 'Mozilla Guidelines']
  },
  {
    key: 'encryption.at.rest.enabled',
    displayName: 'Encryption at Rest',
    description: 'Enable encryption for PII at rest in DB. Requires KMS setup.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'ENCRYPTION',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Protects against DB breach; adds latency for encrypt/decrypt',
    compliance: ['GDPR', 'HIPAA', 'SOC2', 'PCI-DSS']
  },
  {
    key: 'encryption.algorithm.at.rest',
    displayName: 'Encryption Algorithm (at rest)',
    description: 'Algorithm for encrypting data at rest. Standard: AES-256-GCM.',
    defaultValue: 'AES-256-GCM',
    type: 'STRING',
    category: 'ENCRYPTION',
    scope: 'GLOBAL',
    immutable: true,
    constraints: { allowedValues: ['AES-128-GCM', 'AES-256-GCM', 'ChaCha20-Poly1305'] },
    impact: 'AES-256-GCM = NIST approved, industry standard',
    compliance: ['GDPR', 'HIPAA', 'NIST']
  },

  // ============ PKCE ============
  {
    key: 'pkce.required.public.clients',
    displayName: 'PKCE Enforcement',
    description: 'Require PKCE for all public clients (SPA, mobile). Prevents authorization code interception.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PKCE',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Essential for browser/mobile clients; no impact on confidential clients',
    compliance: ['OAuth2', 'OIDC', 'OWASP', 'AppStore Guidelines']
  },
  {
    key: 'pkce.code.challenge.method',
    displayName: 'PKCE Challenge Method',
    description: 'PKCE method: S256 (SHA256) or plain. S256 is recommended.',
    defaultValue: 'S256',
    type: 'STRING',
    category: 'PKCE',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { allowedValues: ['S256', 'plain'] },
    impact: 'S256 = secure; plain = only for debugging, never in production',
    compliance: ['OAuth2', 'OIDC', 'OWASP']
  },

  // ============ ADMIN CONSOLE ============
  {
    key: 'admin.console.mfa.required',
    displayName: 'Admin Console MFA Required',
    description: 'Force MFA for all Keycloak admin console logins.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'ADMIN',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Critical: prevents admin account takeover',
    compliance: ['SOC2', 'CIS Benchmarks', 'HIPAA']
  },
  {
    key: 'admin.console.ip.allowlist.enabled',
    displayName: 'Admin Console IP Allowlist',
    description: 'Restrict admin console access to specific IP ranges.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'ADMIN',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Reduces attack surface for admin interface',
    compliance: ['SOC2', 'CIS Benchmarks']
  },
  {
    key: 'admin.console.ip.allowlist',
    displayName: 'Allowed IP Ranges',
    description: 'JSON array of CIDR ranges allowed to access admin console. E.g. ["10.0.0.0/8", "203.0.113.0/24"].',
    defaultValue: '["127.0.0.1/32"]',
    type: 'JSON',
    category: 'ADMIN',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Locks down access; must be maintained as infrastructure changes',
    compliance: ['SOC2', 'CIS Benchmarks']
  },

  // ============ AUDIT & COMPLIANCE ============
  {
    key: 'audit.log.retention.days',
    displayName: 'Audit Log Retention',
    description: 'Days to retain audit logs before archive/deletion. Standard: 365 (1 year) or longer.',
    defaultValue: '2555',
    type: 'INTEGER',
    category: 'AUDIT',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 90, max: 3650 },
    impact: 'Longer = better audit trail, more storage; GDPR requires retention for incidents',
    compliance: ['GDPR', 'HIPAA', 'SOC2', 'PCI-DSS']
  },
  {
    key: 'audit.log.archive.destination',
    displayName: 'Audit Log Archive',
    description: 'Where to move old logs: S3, Glacier, or local. JSON config.',
    defaultValue: '{"type": "S3", "bucket": "audit-logs-archive", "prefix": ""}',
    type: 'JSON',
    category: 'AUDIT',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Offsite archive = protects against infrastructure loss; cost trade-off',
    compliance: ['GDPR', 'HIPAA', 'SOC2']
  },

  // ============ RATE LIMITING ============
  {
    key: 'ratelimit.token.endpoint.requests.per.minute',
    displayName: 'Token Endpoint Rate Limit',
    description: 'Max requests per minute to /token endpoint per client. Standard: 100-1000.',
    defaultValue: '500',
    type: 'INTEGER',
    category: 'RATE_LIMIT',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 10, max: 10000 },
    impact: 'Too strict = blocks legitimate refresh storms; too loose = enables brute-force',
    compliance: ['OWASP', 'API Security']
  },
  {
    key: 'ratelimit.login.endpoint.requests.per.minute',
    displayName: 'Login Endpoint Rate Limit',
    description: 'Max login attempts per minute per IP. Standard: 30-100.',
    defaultValue: '30',
    type: 'INTEGER',
    category: 'RATE_LIMIT',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 5, max: 300 },
    impact: 'Prevents brute-force and credential stuffing attacks',
    compliance: ['OWASP', 'API Security', 'NIST']
  },

  // ============ SECRETS MANAGEMENT ============
  {
    key: 'secrets.rotation.interval.days',
    displayName: 'Secrets Rotation Interval',
    description: 'Rotate platform secrets (client secrets, signing keys) every N days.',
    defaultValue: '30',
    type: 'INTEGER',
    category: 'SECRETS',
    scope: 'GLOBAL',
    immutable: false,
    constraints: { min: 7, max: 365 },
    impact: 'Frequent rotation = harder for attackers; impacts dependent systems',
    compliance: ['GDPR', 'SOC2', 'HIPAA']
  },
  {
    key: 'secrets.client.hashing.enabled',
    displayName: 'Client Secret Hashing',
    description: 'Hash client secrets instead of storing cleartext. Must be enabled.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'SECRETS',
    scope: 'GLOBAL',
    immutable: true,
    impact: 'CRITICAL: prevents DB breach from exposing all client secrets',
    compliance: ['OAuth2', 'OWASP', 'GDPR', 'SOC2']
  },
  {
    key: 'secrets.tenant.encryption.enabled',
    displayName: 'Per-Tenant Secrets Encryption',
    description: 'Encrypt tenant-supplied API keys and integration secrets separately from platform secrets.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'SECRETS',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Prevents cross-tenant leakage in DB breach',
    compliance: ['GDPR', 'SOC2', 'HIPAA', 'Multi-tenancy best practices']
  },

  // ============ CORS & REDIRECTS ============
  {
    key: 'oauth.redirect.uri.validation.strict',
    displayName: 'Strict Redirect URI Validation',
    description: 'Require exact-match redirect URIs (no wildcards). Essential for security.',
    defaultValue: 'true',
    type: 'BOOLEAN',
    category: 'PKCE',
    scope: 'GLOBAL',
    immutable: false,
    impact: 'Prevents open redirect and authorization code interception',
    compliance: ['OAuth2', 'OIDC', 'OWASP']
  },
  {
    key: 'cors.allowed.origins',
    displayName: 'CORS Allowed Origins',
    description: 'JSON array of origins allowed for CORS. Exact match, no wildcards. E.g. ["https://app.example.com"].',
    defaultValue: '[]',
    type: 'JSON',
    category: 'PKCE',
    scope: 'TENANT',
    immutable: false,
    impact: 'Misconfiguration opens to cross-site attacks; must be maintained carefully',
    compliance: ['OWASP', 'Web Security']
  }
];

/**
 * Get parameter by key
 */
export function getSecurityParameter(key: string): SecurityParameter | undefined {
  return SECURITY_PARAMETERS.find(p => p.key === key);
}

/**
 * Get all parameters in a category
 */
export function getParametersByCategory(category: string): SecurityParameter[] {
  return SECURITY_PARAMETERS.filter(p => p.category === category);
}

/**
 * Validate a parameter value against constraints
 */
export function validateSecurityParameter(parameter: SecurityParameter, value: string): { valid: boolean; error?: string } {
  // Type validation
  if (parameter.type === 'INTEGER') {
    const intVal = parseInt(value, 10);
    if (isNaN(intVal)) {
      return { valid: false, error: `Expected integer, got: ${value}` };
    }
    if (parameter.constraints?.min !== undefined && intVal < parameter.constraints.min) {
      return { valid: false, error: `Value ${intVal} is below minimum ${parameter.constraints.min}` };
    }
    if (parameter.constraints?.max !== undefined && intVal > parameter.constraints.max) {
      return { valid: false, error: `Value ${intVal} is above maximum ${parameter.constraints.max}` };
    }
  }

  if (parameter.type === 'BOOLEAN') {
    if (!['true', 'false'].includes(value.toLowerCase())) {
      return { valid: false, error: `Expected boolean (true/false), got: ${value}` };
    }
  }

  if (parameter.type === 'JSON') {
    try {
      JSON.parse(value);
    } catch (e) {
      return { valid: false, error: `Invalid JSON: ${(e as Error).message}` };
    }
  }

  if (parameter.constraints?.pattern) {
    const regex = new RegExp(parameter.constraints.pattern);
    if (!regex.test(value)) {
      return { valid: false, error: `Value does not match pattern: ${parameter.constraints.pattern}` };
    }
  }

  if (parameter.constraints?.allowedValues) {
    if (!parameter.constraints.allowedValues.includes(value)) {
      return { valid: false, error: `Value must be one of: ${parameter.constraints.allowedValues.join(', ')}` };
    }
  }

  return { valid: true };
}
