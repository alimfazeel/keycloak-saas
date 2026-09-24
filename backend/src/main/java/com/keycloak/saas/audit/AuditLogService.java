package com.keycloak.saas.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Service for audit logging.
 * All events are logged to audit_logs table (immutable, never deleted).
 * Used for compliance, security, debugging.
 *
 * Audit logs are critical: enable detailed event tracking for all state-changing operations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    // ========================================================================
    // LOG OPERATIONS
    // ========================================================================

    /**
     * Log an audit event to database.
     * This is the main entry point for all audit logging.
     *
     * @param event AuditEvent with all event details
     * @return Saved audit log entity
     */
    @Transactional
    public AuditLogEntity logEvent(AuditEvent event) {
        log.info("Logging audit event. Type: {}, Category: {}, Action: {}, Status: {}",
                event.getEventType(), event.getEventCategory(), event.getAction(), event.getStatus());

        long startTime = System.currentTimeMillis();

        try {
            AuditLogEntity auditLog = AuditLogEntity.builder()
                    .eventType(event.getEventType())
                    .eventCategory(event.getEventCategory())
                    .logLevel(event.getLogLevel())
                    .sourceSystem(event.getSourceSystem())
                    .tenantId(event.getTenantId())
                    .userId(event.getUserId())
                    .userEmail(event.getUserEmail())
                    .action(event.getAction())
                    .resourceType(event.getResourceType())
                    .resourceId(event.getResourceId())
                    .oldValue(event.getOldValue())
                    .newValue(event.getNewValue())
                    .status(event.getStatus())
                    .httpMethod(event.getHttpMethod())
                    .httpStatusCode(event.getHttpStatusCode())
                    .endpointPath(event.getEndpointPath())
                    .ipAddress(event.getIpAddress())
                    .userAgent(event.getUserAgent())
                    .errorMessage(event.getErrorMessage())
                    .stacktrace(event.getStacktrace())
                    .additionalContext(event.getAdditionalContext())
                    .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                    .createdAtEpoch(System.currentTimeMillis())
                    .build();

            AuditLogEntity saved = auditLogRepository.save(auditLog);

            long duration = System.currentTimeMillis() - startTime;
            log.debug("Audit event logged successfully. LogID: {}, Duration: {}ms",
                    saved.getLogId(), duration);

            return saved;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Failed to log audit event. Type: {}, Duration: {}ms, Error: {}",
                    event.getEventType(), duration, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Log user login event.
     * @param userId User ID
     * @param userEmail User email
     * @param tenantId Tenant ID
     * @param success Whether login succeeded
     * @param ipAddress Client IP address
     * @param userAgent Client user agent
     */
    @Transactional
    public void logUserLogin(String userId, String userEmail, String tenantId,
                            boolean success, String ipAddress, String userAgent) {
        log.info("Logging user login. UserID: {}, Email: {}, TenantID: {}, Success: {}",
                userId, userEmail, tenantId, success);

        AuditEvent event = AuditEventBuilder.builder()
                .eventType("USER_LOGIN")
                .eventCategory("AUTHENTICATION")
                .action("LOGIN")
                .resourceType("USER")
                .resourceId(userId)
                .userId(userId)
                .userEmail(userEmail)
                .tenantId(tenantId)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .status(success ? "SUCCESS" : "FAILURE")
                .logLevel(success ? "INFO" : "WARN")
                .build();

        logEvent(event);
    }

    /**
     * Log user logout event.
     * @param userId User ID
     * @param tenantId Tenant ID
     */
    @Transactional
    public void logUserLogout(String userId, String tenantId) {
        log.info("Logging user logout. UserID: {}, TenantID: {}", userId, tenantId);

        AuditEvent event = AuditEventBuilder.builder()
                .eventType("USER_LOGOUT")
                .eventCategory("AUTHENTICATION")
                .action("LOGOUT")
                .resourceType("USER")
                .resourceId(userId)
                .userId(userId)
                .tenantId(tenantId)
                .status("SUCCESS")
                .logLevel("INFO")
                .build();

        logEvent(event);
    }

    /**
     * Log configuration change event.
     * @param resourceId Config ID
     * @param oldValue Previous value
     * @param newValue New value
     * @param userId User making change
     */
    @Transactional
    public void logConfigChange(String resourceId, String oldValue, String newValue, String userId) {
        log.info("Logging config change. ConfigID: {}, UserID: {}", resourceId, userId);

        AuditEvent event = AuditEventBuilder.builder()
                .eventType("CONFIG_CHANGED")
                .eventCategory("CONFIGURATION")
                .action("UPDATE")
                .resourceType("CONFIG")
                .resourceId(resourceId)
                .oldValue(oldValue)
                .newValue(newValue)
                .userId(userId)
                .status("SUCCESS")
                .logLevel("WARN")
                .build();

        logEvent(event);
    }

    /**
     * Log API call (request/response).
     * @param method HTTP method (GET, POST, etc)
     * @param path API endpoint path
     * @param statusCode HTTP response status code
     * @param durationMs Request duration in milliseconds
     * @param userId User making request (if authenticated)
     * @param ipAddress Client IP address
     */
    @Transactional
    public void logApiCall(String method, String path, int statusCode,
                          long durationMs, String userId, String ipAddress) {
        log.debug("Logging API call. Method: {}, Path: {}, Status: {}, Duration: {}ms",
                method, path, statusCode, durationMs);

        String logLevel = statusCode >= 400 ? "WARN" : "DEBUG";
        String status = statusCode >= 400 ? "FAILURE" : "SUCCESS";

        AuditEvent event = AuditEventBuilder.builder()
                .eventType("API_CALL")
                .eventCategory("API")
                .action(method)
                .httpMethod(method)
                .endpointPath(path)
                .httpStatusCode(statusCode)
                .userId(userId)
                .ipAddress(ipAddress)
                .status(status)
                .logLevel(logLevel)
                .durationMs((int) durationMs)
                .build();

        logEvent(event);
    }

    /**
     * Log permission denied event.
     * @param userId User who was denied
     * @param resource Resource being accessed
     * @param action Action attempted
     * @param tenantId Tenant ID
     */
    @Transactional
    public void logPermissionDenied(String userId, String resource, String action, String tenantId) {
        log.warn("Logging permission denied. UserID: {}, Resource: {}, Action: {}, TenantID: {}",
                userId, resource, action, tenantId);

        AuditEvent event = AuditEventBuilder.builder()
                .eventType("PERMISSION_DENIED")
                .eventCategory("SECURITY")
                .action(action)
                .resourceType(resource)
                .userId(userId)
                .tenantId(tenantId)
                .status("FAILURE")
                .logLevel("WARN")
                .errorMessage("User does not have permission to " + action + " " + resource)
                .build();

        logEvent(event);
    }

    /**
     * Log error/exception event.
     * @param errorType Type of error (VALIDATION_ERROR, DATABASE_ERROR, etc)
     * @param errorMessage Human-readable error message
     * @param stacktrace Full stack trace
     * @param userId User associated with error (if any)
     * @param resourceId Resource involved in error (if any)
     */
    @Transactional
    public void logError(String errorType, String errorMessage, String stacktrace,
                        String userId, String resourceId) {
        log.error("Logging error event. Type: {}, Message: {}", errorType, errorMessage);

        AuditEvent event = AuditEventBuilder.builder()
                .eventType(errorType)
                .eventCategory("ERROR")
                .action("ERROR")
                .resourceId(resourceId)
                .userId(userId)
                .status("FAILURE")
                .logLevel("ERROR")
                .errorMessage(errorMessage)
                .stacktrace(stacktrace)
                .build();

        logEvent(event);
    }

    // ========================================================================
    // QUERY OPERATIONS
    // ========================================================================

    /**
     * Get audit logs for a specific user.
     * @param userId User ID
     * @return List of audit log entries
     */
    public List<AuditLogEntity> getAuditLogsByUser(String userId) {
        log.info("Querying audit logs for user: {}", userId);
        return auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Get audit logs for a specific tenant.
     * @param tenantId Tenant ID
     * @return List of audit log entries
     */
    public List<AuditLogEntity> getAuditLogsByTenant(String tenantId) {
        log.info("Querying audit logs for tenant: {}", tenantId);
        return auditLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    /**
     * Get audit logs by event type.
     * @param eventType Event type to filter by
     * @return List of audit log entries
     */
    public List<AuditLogEntity> getAuditLogsByEventType(String eventType) {
        log.info("Querying audit logs by event type: {}", eventType);
        return auditLogRepository.findByEventTypeOrderByCreatedAtDesc(eventType);
    }

    /**
     * Get audit logs by log level.
     * @param logLevel Log level to filter by (DEBUG, INFO, WARN, ERROR)
     * @return List of audit log entries
     */
    public List<AuditLogEntity> getAuditLogsByLevel(String logLevel) {
        log.info("Querying audit logs by level: {}", logLevel);
        return auditLogRepository.findByLogLevelOrderByCreatedAtDesc(logLevel);
    }

    /**
     * Count total audit logs.
     * @return Total count
     */
    public long countAuditLogs() {
        long count = auditLogRepository.count();
        log.info("Total audit logs in system: {}", count);
        return count;
    }
}
