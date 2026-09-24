package com.keycloak.saas.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for managing application-wide configuration.
 * All config changes are logged to audit_logs for compliance tracking.
 * In-memory cache (TTL configurable) reduces DB queries.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationConfigService {

    private final ApplicationConfigRepository configRepository;
    private final AuditLogService auditLogService;
    private final LoggerService loggerService;

    private static final String CACHE_NAME = "application_config";

    // ========================================================================
    // GET OPERATIONS
    // ========================================================================

    /**
     * Get config value by key (cached).
     * @param configKey The configuration key
     * @return Config value as String, or empty Optional if not found
     */
    @Cacheable(value = CACHE_NAME, key = "#configKey")
    public Optional<String> getConfigValue(String configKey) {
        loggerService.debug("Fetching config value for key: {}", configKey);
        Optional<ApplicationConfigEntity> config = configRepository.findByConfigKeyAndIsActiveTrue(configKey);
        if (config.isPresent()) {
            loggerService.debug("Config found for key: {} = {}", configKey,
                    config.get().isSecret() ? "***MASKED***" : config.get().getConfigValue());
            return Optional.of(config.get().getConfigValue());
        }
        loggerService.warn("Config key not found: {}", configKey);
        return Optional.empty();
    }

    /**
     * Get config value with default fallback.
     * @param configKey The configuration key
     * @param defaultValue Value to return if key not found
     * @return Config value or default
     */
    public String getConfigValueOrDefault(String configKey, String defaultValue) {
        loggerService.info("Fetching config with default fallback. Key: {}, Default: {}",
                configKey, defaultValue);
        return getConfigValue(configKey).orElse(defaultValue);
    }

    /**
     * Get config as typed value (Boolean, Integer, etc).
     * @param configKey The configuration key
     * @param type Target type class
     * @return Typed value
     */
    public <T> T getConfigAs(String configKey, Class<T> type) {
        loggerService.debug("Fetching config as type: {} for key: {}", type.getSimpleName(), configKey);
        Optional<String> value = getConfigValue(configKey);
        if (value.isEmpty()) {
            loggerService.warn("Config key not found for type conversion: {}", configKey);
            return null;
        }
        return convertValue(value.get(), type);
    }

    /**
     * Get all active configuration entries.
     * @return Map of key -> value pairs (active configs only)
     */
    public Map<String, String> getAllConfig() {
        loggerService.info("Fetching all active configuration entries");
        List<ApplicationConfigEntity> configs = configRepository.findAllByIsActiveTrue();
        loggerService.debug("Found {} active config entries", configs.size());
        return configs.stream()
                .collect(Collectors.toMap(
                        ApplicationConfigEntity::getConfigKey,
                        ApplicationConfigEntity::getConfigValue
                ));
    }

    /**
     * Get config entity by ID (includes audit trail).
     * @param configId The configuration ID
     * @return Config entity with all metadata
     */
    public Optional<ApplicationConfigEntity> getConfigById(Integer configId) {
        loggerService.debug("Fetching config by ID: {}", configId);
        return configRepository.findById(configId);
    }

    // ========================================================================
    // CREATE/UPDATE OPERATIONS (WITH AUDIT LOGGING)
    // ========================================================================

    /**
     * Create new configuration entry.
     * Logs audit event on success.
     * @param configKey Unique configuration key
     * @param configValue Configuration value
     * @param configType Type (STRING, INTEGER, BOOLEAN, etc)
     * @param description Human-readable description
     * @param isSecret Whether value should be masked in logs
     * @param createdBy User creating the config
     * @return Saved configuration entity
     */
    @Transactional
    public ApplicationConfigEntity createConfig(String configKey, String configValue, String configType,
                                               String description, boolean isSecret, String createdBy) {
        loggerService.info("Creating new config entry. Key: {}, Type: {}, Secret: {}",
                configKey, configType, isSecret);

        try {
            ApplicationConfigEntity config = ApplicationConfigEntity.builder()
                    .configKey(configKey)
                    .configValue(configValue)
                    .configType(configType)
                    .description(description)
                    .isSecret(isSecret)
                    .isActive(true)
                    .createdBy(createdBy)
                    .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                    .version(1)
                    .build();

            ApplicationConfigEntity saved = configRepository.save(config);
            loggerService.info("Config created successfully. ID: {}, Key: {}", saved.getConfigId(), configKey);

            auditLogService.logEvent(AuditEventBuilder.builder()
                    .eventType("CONFIG_CREATED")
                    .eventCategory("CONFIGURATION")
                    .action("CREATE")
                    .resourceType("APPLICATION_CONFIG")
                    .resourceId(saved.getConfigId().toString())
                    .newValue(isSecret ? "***MASKED***" : configValue)
                    .userId(createdBy)
                    .status("SUCCESS")
                    .build());

            invalidateCache(configKey);
            return saved;
        } catch (DataIntegrityViolationException e) {
            loggerService.error("Config key already exists: {}. Error: {}", configKey, e.getMessage());
            auditLogService.logEvent(AuditEventBuilder.builder()
                    .eventType("CONFIG_CREATE_FAILED")
                    .eventCategory("CONFIGURATION")
                    .action("CREATE")
                    .resourceType("APPLICATION_CONFIG")
                    .resourceId(configKey)
                    .status("FAILURE")
                    .errorMessage("Duplicate config key: " + configKey)
                    .userId(createdBy)
                    .build());
            throw new IllegalArgumentException("Config key already exists: " + configKey);
        } catch (Exception e) {
            loggerService.error("Failed to create config: {}", configKey, e);
            throw e;
        }
    }

    /**
     * Update existing configuration entry.
     * Logs old and new values for audit trail.
     * @param configId Configuration ID to update
     * @param configValue New value
     * @param updatedBy User performing update
     * @return Updated configuration entity
     */
    @Transactional
    public ApplicationConfigEntity updateConfig(Integer configId, String configValue, String updatedBy) {
        loggerService.info("Updating config. ID: {}, UpdatedBy: {}", configId, updatedBy);

        ApplicationConfigEntity config = configRepository.findById(configId)
                .orElseThrow(() -> {
                    loggerService.error("Config not found for update. ID: {}", configId);
                    return new IllegalArgumentException("Config not found: " + configId);
                });

        String oldValue = config.getConfigValue();
        config.setConfigValue(configValue);
        config.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        config.setUpdatedBy(updatedBy);
        config.setVersion(config.getVersion() + 1);

        ApplicationConfigEntity updated = configRepository.save(config);
        loggerService.info("Config updated successfully. ID: {}, Key: {}, Version: {}",
                configId, config.getConfigKey(), config.getVersion());

        auditLogService.logEvent(AuditEventBuilder.builder()
                .eventType("CONFIG_UPDATED")
                .eventCategory("CONFIGURATION")
                .action("UPDATE")
                .resourceType("APPLICATION_CONFIG")
                .resourceId(configId.toString())
                .oldValue(config.isSecret() ? "***MASKED***" : oldValue)
                .newValue(config.isSecret() ? "***MASKED***" : configValue)
                .userId(updatedBy)
                .status("SUCCESS")
                .build());

        invalidateCache(config.getConfigKey());
        return updated;
    }

    /**
     * Soft-delete configuration (mark as inactive).
     * Hard deletes are not allowed for audit compliance.
     * @param configId Configuration ID to deactivate
     * @param deactivatedBy User performing deactivation
     */
    @Transactional
    public void deactivateConfig(Integer configId, String deactivatedBy) {
        loggerService.info("Deactivating config. ID: {}, DeactivatedBy: {}", configId, deactivatedBy);

        ApplicationConfigEntity config = configRepository.findById(configId)
                .orElseThrow(() -> {
                    loggerService.error("Config not found for deactivation. ID: {}", configId);
                    return new IllegalArgumentException("Config not found: " + configId);
                });

        config.setIsActive(false);
        config.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        config.setUpdatedBy(deactivatedBy);

        configRepository.save(config);
        loggerService.info("Config deactivated successfully. ID: {}, Key: {}", configId, config.getConfigKey());

        auditLogService.logEvent(AuditEventBuilder.builder()
                .eventType("CONFIG_DEACTIVATED")
                .eventCategory("CONFIGURATION")
                .action("DEACTIVATE")
                .resourceType("APPLICATION_CONFIG")
                .resourceId(configId.toString())
                .oldValue("is_active=true")
                .newValue("is_active=false")
                .userId(deactivatedBy)
                .status("SUCCESS")
                .build());

        invalidateCache(config.getConfigKey());
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Invalidate cache for specific config key.
     * @param configKey The configuration key
     */
    @CacheEvict(value = CACHE_NAME, key = "#configKey")
    public void invalidateCache(String configKey) {
        loggerService.debug("Cache invalidated for key: {}", configKey);
    }

    /**
     * Invalidate all application config cache.
     */
    @CacheEvict(value = CACHE_NAME, allEntries = true)
    public void invalidateAllCache() {
        loggerService.debug("All application config cache invalidated");
    }

    /**
     * Convert string value to target type.
     * @param value String value to convert
     * @param type Target type class
     * @return Converted value
     */
    @SuppressWarnings("unchecked")
    private <T> T convertValue(String value, Class<T> type) {
        loggerService.debug("Converting value '{}' to type: {}", value, type.getSimpleName());
        try {
            if (type == String.class) {
                return (T) value;
            } else if (type == Boolean.class || type == boolean.class) {
                return (T) Boolean.valueOf(value);
            } else if (type == Integer.class || type == int.class) {
                return (T) Integer.valueOf(value);
            } else if (type == Long.class || type == long.class) {
                return (T) Long.valueOf(value);
            } else if (type == Double.class || type == double.class) {
                return (T) Double.valueOf(value);
            }
            loggerService.warn("Unsupported type conversion: {}", type.getSimpleName());
            return null;
        } catch (Exception e) {
            loggerService.error("Failed to convert value '{}' to type: {}", value, type.getSimpleName(), e);
            throw new IllegalArgumentException("Cannot convert '" + value + "' to " + type.getSimpleName());
        }
    }
}
