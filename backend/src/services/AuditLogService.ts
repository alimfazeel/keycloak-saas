import pino from 'pino';
import { AuditEvent, AuditLog } from '../types/entities.js';

const logger = pino();

export class AuditLogService {
  constructor(private auditLogRepository: any) {}

  async logEvent(event: AuditEvent): Promise<AuditLog> {
    logger.info(
      `Logging audit event. Type: ${event.eventType}, Category: ${event.eventCategory}, Action: ${event.action}, Status: ${event.status}`
    );

    const startTime = Date.now();

    try {
      const auditLog: Partial<AuditLog> = {
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        logLevel: event.logLevel,
        sourceSystem: event.sourceSystem,
        tenantId: event.tenantId,
        userId: event.userId,
        userEmail: event.userEmail,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        oldValue: event.oldValue,
        newValue: event.newValue,
        status: event.status,
        httpMethod: event.httpMethod,
        httpStatusCode: event.httpStatusCode,
        endpointPath: event.endpointPath,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        errorMessage: event.errorMessage,
        stacktrace: event.stacktrace,
        additionalContext: event.additionalContext,
        durationMs: event.durationMs,
        createdAt: new Date(),
        createdAtEpoch: BigInt(Date.now())
      };

      const saved = await this.auditLogRepository.save(auditLog);

      const duration = Date.now() - startTime;
      logger.debug(`Audit event logged successfully. LogID: ${saved.logId}, Duration: ${duration}ms`);

      return saved;
    } catch (e) {
      const duration = Date.now() - startTime;
      logger.error(
        `Failed to log audit event. Type: ${event.eventType}, Duration: ${duration}ms, Error: ${(e as Error).message}`
      );
      throw e;
    }
  }

  async logUserLogin(
    userId: string,
    userEmail: string,
    tenantId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    logger.info(`Logging user login. UserID: ${userId}, Email: ${userEmail}, TenantID: ${tenantId}, Success: ${success}`);

    const event: AuditEvent = {
      eventType: 'USER_LOGIN',
      eventCategory: 'AUTHENTICATION',
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: userId,
      userId,
      userEmail,
      tenantId,
      ipAddress,
      userAgent,
      status: success ? 'SUCCESS' : 'FAILURE',
      logLevel: success ? 'INFO' : 'WARN'
    };

    await this.logEvent(event);
  }

  async logUserLogout(userId: string, tenantId: string): Promise<void> {
    logger.info(`Logging user logout. UserID: ${userId}, TenantID: ${tenantId}`);

    const event: AuditEvent = {
      eventType: 'USER_LOGOUT',
      eventCategory: 'AUTHENTICATION',
      action: 'LOGOUT',
      resourceType: 'USER',
      resourceId: userId,
      userId,
      tenantId,
      status: 'SUCCESS',
      logLevel: 'INFO'
    };

    await this.logEvent(event);
  }

  async logConfigChange(resourceId: string, oldValue: string, newValue: string, userId: string): Promise<void> {
    logger.info(`Logging config change. ConfigID: ${resourceId}, UserID: ${userId}`);

    const event: AuditEvent = {
      eventType: 'CONFIG_CHANGED',
      eventCategory: 'CONFIGURATION',
      action: 'UPDATE',
      resourceType: 'CONFIG',
      resourceId,
      oldValue,
      newValue,
      userId,
      status: 'SUCCESS',
      logLevel: 'WARN'
    };

    await this.logEvent(event);
  }

  async logApiCall(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    userId: string,
    ipAddress: string
  ): Promise<void> {
    logger.debug(`Logging API call. Method: ${method}, Path: ${path}, Status: ${statusCode}, Duration: ${durationMs}ms`);

    const logLevel = statusCode >= 400 ? 'WARN' : 'DEBUG';
    const status = statusCode >= 400 ? 'FAILURE' : 'SUCCESS';

    const event: AuditEvent = {
      eventType: 'API_CALL',
      eventCategory: 'API',
      action: method,
      httpMethod: method,
      endpointPath: path,
      httpStatusCode: statusCode,
      userId,
      ipAddress,
      status,
      logLevel,
      durationMs
    };

    await this.logEvent(event);
  }

  async logPermissionDenied(
    userId: string,
    resource: string,
    action: string,
    tenantId: string
  ): Promise<void> {
    logger.warn(`Logging permission denied. UserID: ${userId}, Resource: ${resource}, Action: ${action}, TenantID: ${tenantId}`);

    const event: AuditEvent = {
      eventType: 'PERMISSION_DENIED',
      eventCategory: 'SECURITY',
      action,
      resourceType: resource,
      userId,
      tenantId,
      status: 'FAILURE',
      logLevel: 'WARN',
      errorMessage: `User does not have permission to ${action} ${resource}`
    };

    await this.logEvent(event);
  }

  async logError(errorType: string, errorMessage: string, stacktrace: string, userId: string, resourceId: string): Promise<void> {
    logger.error(`Logging error event. Type: ${errorType}, Message: ${errorMessage}`);

    const event: AuditEvent = {
      eventType: errorType,
      eventCategory: 'ERROR',
      action: 'ERROR',
      resourceId,
      userId,
      status: 'FAILURE',
      logLevel: 'ERROR',
      errorMessage,
      stacktrace
    };

    await this.logEvent(event);
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    logger.info(`Querying audit logs for user: ${userId}`);
    return this.auditLogRepository.findByUserId(userId);
  }

  async getAuditLogsByTenant(tenantId: string): Promise<AuditLog[]> {
    logger.info(`Querying audit logs for tenant: ${tenantId}`);
    return this.auditLogRepository.findByTenantId(tenantId);
  }

  async getAuditLogsByEventType(eventType: string): Promise<AuditLog[]> {
    logger.info(`Querying audit logs by event type: ${eventType}`);
    return this.auditLogRepository.findByEventType(eventType);
  }

  async getAuditLogsByLevel(logLevel: string): Promise<AuditLog[]> {
    logger.info(`Querying audit logs by level: ${logLevel}`);
    return this.auditLogRepository.findByLogLevel(logLevel);
  }

  async countAuditLogs(): Promise<number> {
    const count = await this.auditLogRepository.count();
    logger.info(`Total audit logs in system: ${count}`);
    return count;
  }
}
