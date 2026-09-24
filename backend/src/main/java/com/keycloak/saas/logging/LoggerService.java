package com.keycloak.saas.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Service for structured application logging.
 * Logs are persisted to application_logs table for centralized monitoring.
 * Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
 *
 * Each log entry includes: timestamp, logger name, thread, message, context, stack trace.
 * Supports distributed tracing (request_id, trace_id, span_id).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoggerService {

    private final ApplicationLogRepository logRepository;
    private final ObjectMapper objectMapper;

    @Value("${application.name:keycloak-saas}")
    private String applicationName;

    @Value("${spring.application.version:1.0.0}")
    private String applicationVersion;

    @Value("${spring.profiles.active:development}")
    private String environment;

    @Value("${logging.default-level:INFO}")
    private String defaultLogLevel;

    // ========================================================================
    // LOGGING METHODS
    // ========================================================================

    /**
     * Log at DEBUG level (detailed diagnostic information).
     * @param message Log message (can include {})
     * @param args Arguments to fill {} placeholders
     */
    public void debug(String message, Object... args) {
        if (isLevelEnabled("DEBUG")) {
            log.debug(message, args);
            persistLog("DEBUG", message, args, null, null);
        }
    }

    /**
     * Log at INFO level (general informational messages).
     * @param message Log message
     * @param args Arguments to fill {} placeholders
     */
    public void info(String message, Object... args) {
        if (isLevelEnabled("INFO")) {
            log.info(message, args);
            persistLog("INFO", message, args, null, null);
        }
    }

    /**
     * Log at WARN level (potentially harmful situation).
     * @param message Log message
     * @param args Arguments to fill {} placeholders
     */
    public void warn(String message, Object... args) {
        if (isLevelEnabled("WARN")) {
            log.warn(message, args);
            persistLog("WARN", message, args, null, null);
        }
    }

    /**
     * Log at WARN level with exception.
     * @param message Log message
     * @param throwable Exception to log
     */
    public void warn(String message, Throwable throwable) {
        if (isLevelEnabled("WARN")) {
            log.warn(message, throwable);
            persistLog("WARN", message, new Object[0], throwable, null);
        }
    }

    /**
     * Log at ERROR level (error event, something failed).
     * @param message Log message
     * @param args Arguments to fill {} placeholders
     */
    public void error(String message, Object... args) {
        if (isLevelEnabled("ERROR")) {
            log.error(message, args);
            persistLog("ERROR", message, args, null, null);
        }
    }

    /**
     * Log at ERROR level with exception.
     * @param message Log message
     * @param throwable Exception to log
     */
    public void error(String message, Throwable throwable) {
        if (isLevelEnabled("ERROR")) {
            log.error(message, throwable);
            persistLog("ERROR", message, new Object[0], throwable, null);
        }
    }

    /**
     * Log at CRITICAL level (severe error, system may be unstable).
     * @param message Log message
     * @param throwable Exception to log
     */
    public void critical(String message, Throwable throwable) {
        log.error("[CRITICAL] " + message, throwable);
        persistLog("CRITICAL", message, new Object[0], throwable, null);
    }

    /**
     * Log with custom context data (structured logging).
     * @param level Log level
     * @param message Log message
     * @param context Custom context map (e.g., userId, tenantId, requestId)
     */
    public void logWithContext(String level, String message, Map<String, Object> context) {
        if (isLevelEnabled(level)) {
            log.info("[{}] {} | Context: {}", level, message, context);
            persistLog(level, message, new Object[0], null, context);
        }
    }

    // ========================================================================
    // HELPER METHODS (Persistence)
    // ========================================================================

    /**
     * Persist log entry to database (non-blocking best effort).
     * Exceptions during persistence should not break application flow.
     */
    @Transactional
    protected void persistLog(String level, String message, Object[] args,
                             Throwable throwable, Map<String, Object> context) {
        try {
            String formattedMessage = formatMessage(message, args);
            String loggerName = getCallerLoggerName();
            String threadName = Thread.currentThread().getName();
            String stacktrace = throwable != null ? getStackTrace(throwable) : null;

            ApplicationLogEntity logEntry = ApplicationLogEntity.builder()
                    .logLevel(level)
                    .loggerName(loggerName)
                    .threadName(threadName)
                    .message(formattedMessage)
                    .exception(throwable != null ? throwable.getMessage() : null)
                    .stacktrace(stacktrace)
                    .contextData(context != null ? objectMapper.valueToTree(context) : null)
                    .serviceName(applicationName)
                    .environment(environment)
                    .version(applicationVersion)
                    .hostname(getHostname())
                    .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                    .createdAtEpoch(System.currentTimeMillis())
                    .build();

            logRepository.save(logEntry);
        } catch (Exception e) {
            // Silently fail - don't let logging break the application
            log.warn("Failed to persist log to database: {}", e.getMessage());
        }
    }

    /**
     * Format log message with arguments.
     * @param message Message template with {} placeholders
     * @param args Arguments to fill placeholders
     * @return Formatted message
     */
    private String formatMessage(String message, Object[] args) {
        if (args == null || args.length == 0) {
            return message;
        }
        String result = message;
        for (Object arg : args) {
            result = result.replaceFirst("\\{\\}", arg != null ? arg.toString() : "null");
        }
        return result;
    }

    /**
     * Get logger name (calling class).
     * @return Logger name
     */
    private String getCallerLoggerName() {
        StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
        // Find first non-LoggerService class in stack
        for (StackTraceElement element : stackTrace) {
            if (!element.getClassName().contains("LoggerService")
                    && !element.getClassName().contains("java.lang.Thread")) {
                return element.getClassName() + "." + element.getMethodName();
            }
        }
        return "Unknown";
    }

    /**
     * Get full stack trace from exception.
     * @param throwable Exception
     * @return Stack trace as string
     */
    private String getStackTrace(Throwable throwable) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : throwable.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }

    /**
     * Get hostname of running system.
     * @return Hostname
     */
    private String getHostname() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    /**
     * Check if log level is enabled.
     * @param level Log level to check
     * @return true if level is enabled
     */
    private boolean isLevelEnabled(String level) {
        // Parse default log level and compare
        int levelValue = getLevelValue(level);
        int defaultValue = getLevelValue(defaultLogLevel);
        return levelValue >= defaultValue;
    }

    /**
     * Get numeric value for log level (for comparison).
     * @param level Log level string
     * @return Numeric value (higher = more severe)
     */
    private int getLevelValue(String level) {
        return switch (level.toUpperCase()) {
            case "DEBUG" -> 1;
            case "INFO" -> 2;
            case "WARN" -> 3;
            case "ERROR" -> 4;
            case "CRITICAL" -> 5;
            default -> 2; // Default to INFO
        };
    }
}
