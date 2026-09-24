-- V001__Initial_Schema.sql
-- Initial database schema for Keycloak SaaS platform
-- Created: 2026-09-24
-- Purpose: Foundation tables for config management and audit logging

-- ============================================================================
-- APPLICATION CONFIGURATION TABLE
-- Stores all application-level settings (not Keycloak realm-specific)
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_config (
    config_id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type VARCHAR(50) NOT NULL DEFAULT 'STRING',
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1
);

CREATE INDEX idx_application_config_key ON application_config(config_key);
CREATE INDEX idx_application_config_active ON application_config(is_active);
CREATE INDEX idx_application_config_created_at ON application_config(created_at);

-- ============================================================================
-- AUDIT LOGS TABLE
-- Immutable log of all events in the system (compliance, debugging, security)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    source_system VARCHAR(100),
    tenant_id VARCHAR(255),
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    http_method VARCHAR(10),
    http_status_code INT,
    endpoint_path VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    stacktrace TEXT,
    duration_ms INT,
    additional_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at_epoch BIGINT
);

-- Indexes for audit logs (query performance)
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX idx_audit_logs_log_level ON audit_logs(log_level);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_created_at_epoch ON audit_logs(created_at_epoch);
CREATE INDEX idx_audit_logs_resource_type_id ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- ============================================================================
-- APPLICATION LOGS TABLE
-- Detailed logs for debugging and monitoring (retention-based cleanup)
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_logs (
    log_id BIGSERIAL PRIMARY KEY,
    log_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    logger_name VARCHAR(500) NOT NULL,
    thread_name VARCHAR(255),
    message TEXT NOT NULL,
    exception TEXT,
    stacktrace TEXT,
    context_data JSONB,
    service_name VARCHAR(100),
    environment VARCHAR(50),
    version VARCHAR(50),
    hostname VARCHAR(255),
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    span_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at_epoch BIGINT
);

-- Indexes for application logs
CREATE INDEX idx_application_logs_level ON application_logs(log_level);
CREATE INDEX idx_application_logs_logger_name ON application_logs(logger_name);
CREATE INDEX idx_application_logs_created_at ON application_logs(created_at);
CREATE INDEX idx_application_logs_created_at_epoch ON application_logs(created_at_epoch);
CREATE INDEX idx_application_logs_request_id ON application_logs(request_id);
CREATE INDEX idx_application_logs_trace_id ON application_logs(trace_id);

-- ============================================================================
-- CONFIGURATION DEFAULTS (Inserted after table creation)
-- Standard security, performance, and business config values
-- ============================================================================

INSERT INTO application_config (config_key, config_value, config_type, description, created_by)
VALUES
    -- Security Parameters
    ('security.access_token_lifetime_minutes', '15', 'INTEGER', 'OAuth2 access token expiry in minutes', 'SYSTEM'),
    ('security.refresh_token_lifetime_minutes', '1440', 'INTEGER', 'OAuth2 refresh token expiry in minutes (24h)', 'SYSTEM'),
    ('security.session_idle_timeout_minutes', '30', 'INTEGER', 'SSO session idle timeout in minutes', 'SYSTEM'),
    ('security.session_max_lifetime_minutes', '1440', 'INTEGER', 'SSO session max lifetime in minutes (24h)', 'SYSTEM'),
    ('security.password_min_length', '12', 'INTEGER', 'Minimum password length', 'SYSTEM'),
    ('security.password_require_special_chars', 'true', 'BOOLEAN', 'Require special characters in password', 'SYSTEM'),
    ('security.password_require_uppercase', 'true', 'BOOLEAN', 'Require uppercase in password', 'SYSTEM'),
    ('security.password_require_lowercase', 'true', 'BOOLEAN', 'Require lowercase in password', 'SYSTEM'),
    ('security.password_require_numbers', 'true', 'BOOLEAN', 'Require numbers in password', 'SYSTEM'),
    ('security.brute_force_max_attempts', '5', 'INTEGER', 'Max failed login attempts before lockout', 'SYSTEM'),
    ('security.brute_force_lockout_duration_minutes', '15', 'INTEGER', 'Account lockout duration in minutes', 'SYSTEM'),
    ('security.password_history_count', '5', 'INTEGER', 'Number of previous passwords to check', 'SYSTEM'),

    -- Multi-Tenancy
    ('multitenancy.realm_per_tenant_enabled', 'true', 'BOOLEAN', 'Enable realm-per-tenant isolation', 'SYSTEM'),
    ('multitenancy.realm_prefix', 'realm-', 'STRING', 'Prefix for auto-created tenant realms', 'SYSTEM'),
    ('multitenancy.auto_create_realm', 'true', 'BOOLEAN', 'Auto-create realm on tenant signup', 'SYSTEM'),

    -- Logging & Monitoring
    ('logging.default_log_level', 'INFO', 'STRING', 'Default log level (DEBUG, INFO, WARN, ERROR)', 'SYSTEM'),
    ('logging.audit_enabled', 'true', 'BOOLEAN', 'Enable audit logging to database', 'SYSTEM'),
    ('logging.detailed_logs_enabled', 'true', 'BOOLEAN', 'Enable detailed application logs to database', 'SYSTEM'),
    ('logging.request_logging_enabled', 'true', 'BOOLEAN', 'Log all HTTP requests', 'SYSTEM'),
    ('logging.slow_query_threshold_ms', '1000', 'INTEGER', 'Threshold for slow query logging (ms)', 'SYSTEM'),

    -- Feature Flags
    ('feature.mfa_enabled', 'true', 'BOOLEAN', 'Enable multi-factor authentication', 'SYSTEM'),
    ('feature.social_login_enabled', 'true', 'BOOLEAN', 'Enable social login (Google, GitHub, etc)', 'SYSTEM'),
    ('feature.saml_enabled', 'false', 'BOOLEAN', 'Enable SAML enterprise federation', 'SYSTEM'),
    ('feature.ldap_enabled', 'true', 'BOOLEAN', 'Enable LDAP/Active Directory federation', 'SYSTEM'),

    -- Performance
    ('performance.db_connection_pool_size', '20', 'INTEGER', 'Database connection pool size', 'SYSTEM'),
    ('performance.cache_enabled', 'true', 'BOOLEAN', 'Enable in-memory caching', 'SYSTEM'),
    ('performance.cache_ttl_seconds', '3600', 'INTEGER', 'Cache time-to-live in seconds', 'SYSTEM'),

    -- Rate Limiting
    ('ratelimit.enabled', 'true', 'BOOLEAN', 'Enable API rate limiting', 'SYSTEM'),
    ('ratelimit.requests_per_minute', '60', 'INTEGER', 'Max API requests per minute per tenant', 'SYSTEM')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS (adjust for your deployment)
-- ============================================================================

-- REVOKE ALL ON application_config FROM PUBLIC;
-- REVOKE ALL ON audit_logs FROM PUBLIC;
-- REVOKE ALL ON application_logs FROM PUBLIC;

-- GRANT SELECT, INSERT, UPDATE ON application_config TO keycloak;
-- GRANT INSERT ON audit_logs TO keycloak;
-- GRANT INSERT ON application_logs TO keycloak;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE application_config IS 'Application-wide configuration settings (immutable after deployment)';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance, security, debugging (CRITICAL: do not delete)';
COMMENT ON TABLE application_logs IS 'Structured application logs for monitoring and debugging (retention-based cleanup)';

COMMENT ON COLUMN audit_logs.event_type IS 'Type of event (USER_LOGIN, CONFIG_CHANGE, etc)';
COMMENT ON COLUMN audit_logs.log_level IS 'Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)';
COMMENT ON COLUMN audit_logs.status IS 'Operation result (SUCCESS, FAILURE, PARTIAL)';
COMMENT ON COLUMN audit_logs.old_value IS 'Previous value before change (for UPDATE operations)';
COMMENT ON COLUMN audit_logs.new_value IS 'New value after change (for UPDATE operations)';
COMMENT ON COLUMN audit_logs.additional_context IS 'JSON object for extra metadata (flexible schema)';

COMMENT ON COLUMN application_logs.log_level IS 'Log severity (DEBUG, INFO, WARN, ERROR, CRITICAL)';
COMMENT ON COLUMN application_logs.logger_name IS 'Java class or component logging (e.g., com.keycloak.saas.ConfigService)';
COMMENT ON COLUMN application_logs.context_data IS 'JSON object for structured logging context';
COMMENT ON COLUMN application_logs.request_id IS 'Distributed tracing request ID (for request correlation)';
COMMENT ON COLUMN application_logs.trace_id IS 'OpenTelemetry trace ID';
COMMENT ON COLUMN application_logs.span_id IS 'OpenTelemetry span ID';
