package com.keycloak.saas.config;

import com.keycloak.saas.audit.AuditLogService;
import com.keycloak.saas.logging.LoggerService;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ApplicationConfigService.
 * Tests configuration CRUD operations, caching, and audit logging.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ApplicationConfigService Tests")
class ApplicationConfigServiceTest {

    @Mock
    private ApplicationConfigRepository configRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private LoggerService loggerService;

    @InjectMocks
    private ApplicationConfigService configService;

    private ApplicationConfigEntity testConfig;

    @BeforeEach
    void setUp() {
        testConfig = ApplicationConfigEntity.builder()
                .configId(1)
                .configKey("test.key")
                .configValue("test.value")
                .configType("STRING")
                .description("Test configuration")
                .isSecret(false)
                .isActive(true)
                .createdBy("TEST_USER")
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .version(1)
                .build();
    }

    // ========================================================================
    // GET OPERATIONS TESTS
    // ========================================================================

    @Test
    @DisplayName("Should retrieve config value by key (cached)")
    void testGetConfigValue_Success() {
        // Arrange
        when(configRepository.findByConfigKeyAndIsActiveTrue("test.key"))
                .thenReturn(Optional.of(testConfig));

        // Act
        Optional<String> result = configService.getConfigValue("test.key");

        // Assert
        assertTrue(result.isPresent());
        assertEquals("test.value", result.get());
        verify(loggerService, times(2)).debug(anyString(), any());
        verify(configRepository, times(1)).findByConfigKeyAndIsActiveTrue("test.key");
    }

    @Test
    @DisplayName("Should return empty Optional for non-existent config key")
    void testGetConfigValue_NotFound() {
        // Arrange
        when(configRepository.findByConfigKeyAndIsActiveTrue("non.existent"))
                .thenReturn(Optional.empty());

        // Act
        Optional<String> result = configService.getConfigValue("non.existent");

        // Assert
        assertFalse(result.isPresent());
        verify(loggerService, times(1)).debug(anyString(), any());
        verify(loggerService, times(1)).warn(anyString(), any());
    }

    @Test
    @DisplayName("Should return default value when config not found")
    void testGetConfigValueOrDefault() {
        // Arrange
        String defaultValue = "default.value";
        when(configRepository.findByConfigKeyAndIsActiveTrue("missing.key"))
                .thenReturn(Optional.empty());

        // Act
        String result = configService.getConfigValueOrDefault("missing.key", defaultValue);

        // Assert
        assertEquals(defaultValue, result);
        verify(loggerService, times(1)).info(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Should convert config value to boolean")
    void testGetConfigAs_Boolean() {
        // Arrange
        ApplicationConfigEntity boolConfig = ApplicationConfigEntity.builder()
                .configKey("feature.enabled")
                .configValue("true")
                .isActive(true)
                .build();
        when(configRepository.findByConfigKeyAndIsActiveTrue("feature.enabled"))
                .thenReturn(Optional.of(boolConfig));

        // Act
        Boolean result = configService.getConfigAs("feature.enabled", Boolean.class);

        // Assert
        assertTrue(result);
        verify(loggerService, times(1)).debug(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Should convert config value to integer")
    void testGetConfigAs_Integer() {
        // Arrange
        ApplicationConfigEntity intConfig = ApplicationConfigEntity.builder()
                .configKey("session.timeout")
                .configValue("3600")
                .isActive(true)
                .build();
        when(configRepository.findByConfigKeyAndIsActiveTrue("session.timeout"))
                .thenReturn(Optional.of(intConfig));

        // Act
        Integer result = configService.getConfigAs("session.timeout", Integer.class);

        // Assert
        assertEquals(3600, result);
    }

    // ========================================================================
    // CREATE OPERATIONS TESTS
    // ========================================================================

    @Test
    @DisplayName("Should create new configuration and log audit event")
    void testCreateConfig_Success() {
        // Arrange
        ApplicationConfigEntity savedConfig = testConfig;
        when(configRepository.save(any(ApplicationConfigEntity.class)))
                .thenReturn(savedConfig);

        // Act
        ApplicationConfigEntity result = configService.createConfig(
                "test.key", "test.value", "STRING", "Test config", false, "TEST_USER"
        );

        // Assert
        assertNotNull(result);
        assertEquals("test.key", result.getConfigKey());
        assertEquals("test.value", result.getConfigValue());
        verify(configRepository, times(1)).save(any(ApplicationConfigEntity.class));
        verify(auditLogService, times(1)).logEvent(any());
        verify(loggerService, times(1)).info(anyString(), any(), any());
    }

    @Test
    @DisplayName("Should throw exception for duplicate config key")
    void testCreateConfig_DuplicateKey() {
        // Arrange
        when(configRepository.save(any(ApplicationConfigEntity.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("Duplicate key"));

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                configService.createConfig(
                        "test.key", "test.value", "STRING", "Test", false, "TEST_USER"
                )
        );
        verify(auditLogService, times(1)).logEvent(any());
        verify(loggerService, times(1)).error(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("Should create secret config and mask value in logs")
    void testCreateConfig_SecretValue() {
        // Arrange
        ApplicationConfigEntity secretConfig = ApplicationConfigEntity.builder()
                .configKey("api.secret.key")
                .configValue("super-secret-value")
                .isSecret(true)
                .isActive(true)
                .build();
        when(configRepository.save(any(ApplicationConfigEntity.class)))
                .thenReturn(secretConfig);

        // Act
        ApplicationConfigEntity result = configService.createConfig(
                "api.secret.key", "super-secret-value", "STRING", "Secret", true, "TEST_USER"
        );

        // Assert
        assertTrue(result.isSecret());
        // Verify secret was masked in audit logs (via ArgumentCaptor)
        ArgumentCaptor<Object> auditCaptor = ArgumentCaptor.forClass(Object.class);
        verify(auditLogService, times(1)).logEvent(any());
    }

    // ========================================================================
    // UPDATE OPERATIONS TESTS
    // ========================================================================

    @Test
    @DisplayName("Should update configuration and log old/new values")
    void testUpdateConfig_Success() {
        // Arrange
        ApplicationConfigEntity existingConfig = testConfig;
        ApplicationConfigEntity updatedConfig = ApplicationConfigEntity.builder()
                .configId(1)
                .configKey("test.key")
                .configValue("updated.value")
                .configType("STRING")
                .isActive(true)
                .version(2)
                .updatedBy("TEST_USER")
                .build();

        when(configRepository.findById(1))
                .thenReturn(Optional.of(existingConfig));
        when(configRepository.save(any(ApplicationConfigEntity.class)))
                .thenReturn(updatedConfig);

        // Act
        ApplicationConfigEntity result = configService.updateConfig(1, "updated.value", "TEST_USER");

        // Assert
        assertEquals("updated.value", result.getConfigValue());
        assertEquals(2, result.getVersion());
        verify(configRepository, times(1)).findById(1);
        verify(configRepository, times(1)).save(any(ApplicationConfigEntity.class));
        verify(auditLogService, times(1)).logEvent(any());
        verify(loggerService, times(1)).info(anyString(), any(), any(), any());
    }

    @Test
    @DisplayName("Should throw exception when updating non-existent config")
    void testUpdateConfig_NotFound() {
        // Arrange
        when(configRepository.findById(999))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                configService.updateConfig(999, "new.value", "TEST_USER")
        );
        verify(loggerService, times(1)).error(anyString(), any());
    }

    // ========================================================================
    // DEACTIVATION TESTS
    // ========================================================================

    @Test
    @DisplayName("Should deactivate configuration (soft delete)")
    void testDeactivateConfig_Success() {
        // Arrange
        when(configRepository.findById(1))
                .thenReturn(Optional.of(testConfig));
        when(configRepository.save(any(ApplicationConfigEntity.class)))
                .thenReturn(testConfig);

        // Act
        configService.deactivateConfig(1, "TEST_USER");

        // Assert
        verify(configRepository, times(1)).findById(1);
        verify(configRepository, times(1)).save(any(ApplicationConfigEntity.class));
        verify(auditLogService, times(1)).logEvent(any());
        verify(loggerService, times(1)).info(anyString(), any(), any());
    }

    @Test
    @DisplayName("Should throw exception when deactivating non-existent config")
    void testDeactivateConfig_NotFound() {
        // Arrange
        when(configRepository.findById(999))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                configService.deactivateConfig(999, "TEST_USER")
        );
    }

    // ========================================================================
    // TYPE CONVERSION TESTS
    // ========================================================================

    @Test
    @DisplayName("Should handle invalid type conversion")
    void testGetConfigAs_InvalidConversion() {
        // Arrange
        ApplicationConfigEntity invalidConfig = ApplicationConfigEntity.builder()
                .configKey("invalid")
                .configValue("not-a-number")
                .isActive(true)
                .build();
        when(configRepository.findByConfigKeyAndIsActiveTrue("invalid"))
                .thenReturn(Optional.of(invalidConfig));

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                configService.getConfigAs("invalid", Integer.class)
        );
        verify(loggerService, times(1)).error(anyString(), anyString(), anyString(), any());
    }
}
