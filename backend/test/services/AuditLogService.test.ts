import { AuditLogService } from '../../src/services/AuditLogService';
import { AuditLog, AuditEvent } from '../../src/types/entities';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockAuditLogRepository: any;

  const testEvent: AuditEvent = {
    eventType: 'TEST_EVENT',
    eventCategory: 'TEST',
    action: 'TEST_ACTION',
    resourceType: 'TEST_RESOURCE',
    resourceId: '123',
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    status: 'SUCCESS',
    logLevel: 'INFO'
  };

  const testLogEntity: AuditLog = {
    logId: BigInt(1),
    eventType: 'TEST_EVENT',
    eventCategory: 'TEST',
    action: 'TEST_ACTION',
    resourceType: 'TEST_RESOURCE',
    resourceId: '123',
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    status: 'SUCCESS',
    logLevel: 'INFO',
    createdAt: new Date(),
    createdAtEpoch: BigInt(Date.now())
  };

  beforeEach(() => {
    mockAuditLogRepository = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findByTenantId: jest.fn(),
      findByEventType: jest.fn(),
      findByLogLevel: jest.fn(),
      count: jest.fn()
    };

    service = new AuditLogService(mockAuditLogRepository);
  });

  describe('logEvent', () => {
    it('should log event successfully', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      const result = await service.logEvent(testEvent);

      expect(result).toEqual(testLogEntity);
      expect(result.eventType).toBe('TEST_EVENT');
      expect(result.status).toBe('SUCCESS');
      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should capture all event details', async () => {
      const detailedEvent: AuditEvent = {
        ...testEvent,
        userEmail: 'user@example.com',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        httpMethod: 'POST',
        httpStatusCode: 200,
        endpointPath: '/api/auth/login'
      };

      mockAuditLogRepository.save.mockResolvedValue({
        ...testLogEntity,
        userEmail: 'user@example.com',
        ipAddress: '192.168.1.100',
        httpStatusCode: 200
      });

      const result = await service.logEvent(detailedEvent);

      expect(result.userEmail).toBe('user@example.com');
      expect(result.ipAddress).toBe('192.168.1.100');
      expect(result.httpStatusCode).toBe(200);
    });

    it('should handle exception during logging', async () => {
      mockAuditLogRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.logEvent(testEvent)).rejects.toThrow('Database error');
    });
  });

  describe('logUserLogin', () => {
    it('should log successful user login', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logUserLogin('user-1', 'user@example.com', 'tenant-1', true, '192.168.1.1', 'Mozilla/5.0');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('USER_LOGIN');
      expect(call.status).toBe('SUCCESS');
    });

    it('should log failed user login', async () => {
      mockAuditLogRepository.save.mockResolvedValue({
        ...testLogEntity,
        status: 'FAILURE',
        logLevel: 'WARN'
      });

      await service.logUserLogin('user-1', 'user@example.com', 'tenant-1', false, '192.168.1.1', 'Mozilla/5.0');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.status).toBe('FAILURE');
      expect(call.logLevel).toBe('WARN');
    });
  });

  describe('logUserLogout', () => {
    it('should log user logout', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logUserLogout('user-1', 'tenant-1');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('USER_LOGOUT');
    });
  });

  describe('logConfigChange', () => {
    it('should log config change with old and new values', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logConfigChange('config-123', 'old-value', 'new-value', 'admin-user');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('CONFIG_CHANGED');
      expect(call.oldValue).toBe('old-value');
      expect(call.newValue).toBe('new-value');
    });
  });

  describe('logApiCall', () => {
    it('should log successful API call', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logApiCall('GET', '/api/users', 200, 150, 'user-1', '192.168.1.1');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('API_CALL');
      expect(call.httpMethod).toBe('GET');
      expect(call.httpStatusCode).toBe(200);
      expect(call.status).toBe('SUCCESS');
    });

    it('should log failed API call (4xx/5xx)', async () => {
      mockAuditLogRepository.save.mockResolvedValue({
        ...testLogEntity,
        status: 'FAILURE',
        logLevel: 'WARN'
      });

      await service.logApiCall('POST', '/api/login', 401, 75, 'user-1', '192.168.1.1');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.status).toBe('FAILURE');
      expect(call.logLevel).toBe('WARN');
    });
  });

  describe('logPermissionDenied', () => {
    it('should log permission denied', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logPermissionDenied('user-1', 'ADMIN_CONFIG', 'UPDATE', 'tenant-1');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('PERMISSION_DENIED');
      expect(call.eventCategory).toBe('SECURITY');
      expect(call.status).toBe('FAILURE');
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', async () => {
      mockAuditLogRepository.save.mockResolvedValue(testLogEntity);

      await service.logError('DATABASE_ERROR', 'Failed to query users', 'at UserDao.query()\n...', 'system', 'resource-1');

      const call = mockAuditLogRepository.save.mock.calls[0][0];
      expect(call.eventType).toBe('DATABASE_ERROR');
      expect(call.eventCategory).toBe('ERROR');
      expect(call.status).toBe('FAILURE');
      expect(call.stacktrace).toBeDefined();
    });
  });

  describe('Query operations', () => {
    it('should retrieve audit logs by user', async () => {
      mockAuditLogRepository.findByUserId.mockResolvedValue([testLogEntity]);

      const result = await service.getAuditLogsByUser('user-1');

      expect(result.length).toBe(1);
      expect(result[0].userId).toBe('test-user-id');
      expect(mockAuditLogRepository.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('should retrieve audit logs by tenant', async () => {
      mockAuditLogRepository.findByTenantId.mockResolvedValue([testLogEntity]);

      const result = await service.getAuditLogsByTenant('tenant-1');

      expect(result.length).toBe(1);
      expect(result[0].tenantId).toBe('test-tenant-id');
    });

    it('should retrieve audit logs by event type', async () => {
      mockAuditLogRepository.findByEventType.mockResolvedValue([testLogEntity]);

      const result = await service.getAuditLogsByEventType('USER_LOGIN');

      expect(result.length).toBe(1);
      expect(result[0].eventType).toBe('TEST_EVENT');
    });

    it('should retrieve audit logs by log level', async () => {
      mockAuditLogRepository.findByLogLevel.mockResolvedValue([testLogEntity]);

      const result = await service.getAuditLogsByLevel('ERROR');

      expect(result.length).toBe(1);
    });

    it('should count total audit logs', async () => {
      mockAuditLogRepository.count.mockResolvedValue(1234);

      const count = await service.countAuditLogs();

      expect(count).toBe(1234);
      expect(mockAuditLogRepository.count).toHaveBeenCalledTimes(1);
    });
  });
});
