package com.keycloak.saas.audit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuditLogService.
 * Tests audit event logging, querying, and compliance tracking.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuditLogService Tests")
class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @InjectMocks
    private AuditLogService auditLogService;

    private AuditEvent testEvent;
    private AuditLogEntity testLogEntity;

    @BeforeEach
    void setUp() {
        testEvent = AuditEventBuilder.builder()
                .eventType("TEST_EVENT")
                .eventCategory("TEST")
                .action("TEST_ACTION")
                .resourceType("TEST_RESOURCE")
                .resourceId("123")
                .userId("test-user-id")
                .tenantId("test-tenant-id")
                .status("SUCCESS")
                .logLevel("INFO")
                .build();

        testLogEntity = AuditLogEntity.builder()
                .logId(1L)
                .eventType("TEST_EVENT")
                .eventCategory("TEST")
                .action("TEST_ACTION")
                .resourceType("TEST_RESOURCE")
                .resourceId("123")
                .userId("test-user-id")
                .tenantId("test-tenant-id")
                .status("SUCCESS")
                .logLevel("INFO")
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .createdAtEpoch(System.currentTimeMillis())
                .build();
    }

    // ========================================================================
    // LOG EVENT TESTS
    // ========================================================================

    @Test
    @DisplayName("Should log event successfully")
    void testLogEvent_Success() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        AuditLogEntity result = auditLogService.logEvent(testEvent);

        // Assert
        assertNotNull(result);
        assertEquals("TEST_EVENT", result.getEventType());
        assertEquals("test-user-id", result.getUserId());
        assertEquals("SUCCESS", result.getStatus());
        verify(auditLogRepository, times(1)).save(any(AuditLogEntity.class));
    }

    @Test
    @DisplayName("Should capture all event details in audit log")
    void testLogEvent_AllDetails() {
        // Arrange
        AuditEvent detailedEvent = AuditEventBuilder.builder()
                .eventType("USER_LOGIN")
                .eventCategory("AUTHENTICATION")
                .action("LOGIN")
                .resourceType("USER")
                .resourceId("user-123")
                .userId("user-123")
                .userEmail("user@example.com")
                .tenantId("tenant-456")
                .ipAddress("192.168.1.100")
                .userAgent("Mozilla/5.0")
                .httpMethod("POST")
                .httpStatusCode(200)
                .endpointPath("/api/auth/login")
                .status("SUCCESS")
                .logLevel("INFO")
                .build();

        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenAnswer(invocation -> {
                    AuditLogEntity entity = invocation.getArgument(0);
                    entity.setLogId(1L);
                    return entity;
                });

        // Act
        AuditLogEntity result = auditLogService.logEvent(detailedEvent);

        // Assert
        assertEquals("user@example.com", result.getUserEmail());
        assertEquals("192.168.1.100", result.getIpAddress());
        assertEquals(200, result.getHttpStatusCode());
        assertEquals("/api/auth/login", result.getEndpointPath());
    }

    @Test
    @DisplayName("Should handle exception during logging gracefully")
    void testLogEvent_ExceptionHandling() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenThrow(new RuntimeException("Database error"));

        // Act & Assert
        assertThrows(RuntimeException.class, () -> auditLogService.logEvent(testEvent));
    }

    // ========================================================================
    // SPECIALIZED LOG METHODS TESTS
    // ========================================================================

    @Test
    @DisplayName("Should log successful user login")
    void testLogUserLogin_Success() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logUserLogin("user-1", "user@example.com", "tenant-1",
                true, "192.168.1.1", "Mozilla/5.0");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("USER_LOGIN", logged.getEventType());
        assertEquals("SUCCESS", logged.getStatus());
    }

    @Test
    @DisplayName("Should log failed user login")
    void testLogUserLogin_Failure() {
        // Arrange
        AuditLogEntity failureLog = testLogEntity.toBuilder()
                .status("FAILURE")
                .logLevel("WARN")
                .build();
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(failureLog);

        // Act
        auditLogService.logUserLogin("user-1", "user@example.com", "tenant-1",
                false, "192.168.1.1", "Mozilla/5.0");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("FAILURE", logged.getStatus());
        assertEquals("WARN", logged.getLogLevel());
    }

    @Test
    @DisplayName("Should log user logout")
    void testLogUserLogout() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logUserLogout("user-1", "tenant-1");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("USER_LOGOUT", logged.getEventType());
    }

    @Test
    @DisplayName("Should log configuration change with old and new values")
    void testLogConfigChange() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logConfigChange("config-123", "old-value", "new-value", "admin-user");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("CONFIG_CHANGED", logged.getEventType());
        assertEquals("old-value", logged.getOldValue());
        assertEquals("new-value", logged.getNewValue());
    }

    @Test
    @DisplayName("Should log API call with status and duration")
    void testLogApiCall() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logApiCall("GET", "/api/users", 200, 150, "user-1", "192.168.1.1");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("API_CALL", logged.getEventType());
        assertEquals("GET", logged.getHttpMethod());
        assertEquals(200, logged.getHttpStatusCode());
        assertEquals(150, logged.getDurationMs());
    }

    @Test
    @DisplayName("Should log API call failure (4xx/5xx)")
    void testLogApiCall_Failure() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logApiCall("POST", "/api/login", 401, 75, "user-1", "192.168.1.1");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("FAILURE", logged.getStatus());
        assertEquals("WARN", logged.getLogLevel());
    }

    @Test
    @DisplayName("Should log permission denied")
    void testLogPermissionDenied() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logPermissionDenied("user-1", "ADMIN_CONFIG", "UPDATE", "tenant-1");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("PERMISSION_DENIED", logged.getEventType());
        assertEquals("SECURITY", logged.getEventCategory());
        assertEquals("FAILURE", logged.getStatus());
    }

    @Test
    @DisplayName("Should log error with stack trace")
    void testLogError() {
        // Arrange
        when(auditLogRepository.save(any(AuditLogEntity.class)))
                .thenReturn(testLogEntity);

        // Act
        auditLogService.logError("DATABASE_ERROR", "Failed to query users",
                "at com.keycloak.saas.UserDao.query()\n...", "system", "resource-1");

        // Assert
        ArgumentCaptor<AuditLogEntity> captor = ArgumentCaptor.forClass(AuditLogEntity.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLogEntity logged = captor.getValue();
        assertEquals("DATABASE_ERROR", logged.getEventType());
        assertEquals("ERROR", logged.getEventCategory());
        assertEquals("FAILURE", logged.getStatus());
        assertNotNull(logged.getStacktrace());
    }

    // ========================================================================
    // QUERY OPERATIONS TESTS
    // ========================================================================

    @Test
    @DisplayName("Should retrieve audit logs by user")
    void testGetAuditLogsByUser() {
        // Arrange
        List<AuditLogEntity> userLogs = List.of(testLogEntity);
        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc("user-1"))
                .thenReturn(userLogs);

        // Act
        List<AuditLogEntity> result = auditLogService.getAuditLogsByUser("user-1");

        // Assert
        assertEquals(1, result.size());
        assertEquals("user-1", result.get(0).getUserId());
        verify(auditLogRepository, times(1)).findByUserIdOrderByCreatedAtDesc("user-1");
    }

    @Test
    @DisplayName("Should retrieve audit logs by tenant")
    void testGetAuditLogsByTenant() {
        // Arrange
        List<AuditLogEntity> tenantLogs = List.of(testLogEntity);
        when(auditLogRepository.findByTenantIdOrderByCreatedAtDesc("tenant-1"))
                .thenReturn(tenantLogs);

        // Act
        List<AuditLogEntity> result = auditLogService.getAuditLogsByTenant("tenant-1");

        // Assert
        assertEquals(1, result.size());
        assertEquals("tenant-1", result.get(0).getTenantId());
    }

    @Test
    @DisplayName("Should retrieve audit logs by event type")
    void testGetAuditLogsByEventType() {
        // Arrange
        List<AuditLogEntity> eventLogs = List.of(testLogEntity);
        when(auditLogRepository.findByEventTypeOrderByCreatedAtDesc("USER_LOGIN"))
                .thenReturn(eventLogs);

        // Act
        List<AuditLogEntity> result = auditLogService.getAuditLogsByEventType("USER_LOGIN");

        // Assert
        assertEquals(1, result.size());
        assertEquals("USER_LOGIN", result.get(0).getEventType());
    }

    @Test
    @DisplayName("Should retrieve audit logs by log level")
    void testGetAuditLogsByLevel() {
        // Arrange
        List<AuditLogEntity> errorLogs = List.of(testLogEntity);
        when(auditLogRepository.findByLogLevelOrderByCreatedAtDesc("ERROR"))
                .thenReturn(errorLogs);

        // Act
        List<AuditLogEntity> result = auditLogService.getAuditLogsByLevel("ERROR");

        // Assert
        assertEquals(1, result.size());
        assertEquals("ERROR", result.get(0).getLogLevel());
    }

    @Test
    @DisplayName("Should count total audit logs")
    void testCountAuditLogs() {
        // Arrange
        when(auditLogRepository.count()).thenReturn(1234L);

        // Act
        long count = auditLogService.countAuditLogs();

        // Assert
        assertEquals(1234L, count);
        verify(auditLogRepository, times(1)).count();
    }
}
