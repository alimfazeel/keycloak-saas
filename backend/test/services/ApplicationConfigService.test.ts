import { ApplicationConfigService } from '../../src/services/ApplicationConfigService';
import { ApplicationConfig } from '../../src/types/entities';

describe('ApplicationConfigService', () => {
  let service: ApplicationConfigService;
  let mockConfigRepository: any;
  let mockAuditLogService: any;
  let mockLoggerService: any;

  const testConfig: ApplicationConfig = {
    configId: 1,
    configKey: 'test.key',
    configValue: 'test.value',
    configType: 'STRING',
    description: 'Test configuration',
    isSecret: false,
    isActive: true,
    createdBy: 'TEST_USER',
    createdAt: new Date(),
    version: 1
  };

  beforeEach(() => {
    mockConfigRepository = {
      findByKeyAndActive: jest.fn(),
      findAllActive: jest.fn(),
      findById: jest.fn(),
      save: jest.fn()
    };

    mockAuditLogService = {
      logEvent: jest.fn()
    };

    mockLoggerService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    service = new ApplicationConfigService(mockConfigRepository, mockAuditLogService, mockLoggerService);
  });

  describe('getConfigValue', () => {
    it('should retrieve config value by key', async () => {
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(testConfig);

      const result = await service.getConfigValue('test.key');

      expect(result).toBe('test.value');
      expect(mockConfigRepository.findByKeyAndActive).toHaveBeenCalledWith('test.key');
      expect(mockLoggerService.debug).toHaveBeenCalled();
    });

    it('should return null for non-existent config key', async () => {
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(null);

      const result = await service.getConfigValue('non.existent');

      expect(result).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should return cached value on second call', async () => {
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(testConfig);

      await service.getConfigValue('test.key');
      const result = await service.getConfigValue('test.key');

      expect(result).toBe('test.value');
      expect(mockConfigRepository.findByKeyAndActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfigValueOrDefault', () => {
    it('should return default value when config not found', async () => {
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(null);

      const result = await service.getConfigValueOrDefault('missing.key', 'default.value');

      expect(result).toBe('default.value');
      expect(mockLoggerService.info).toHaveBeenCalled();
    });
  });

  describe('getConfigAs', () => {
    it('should convert config value to boolean', async () => {
      const boolConfig = { ...testConfig, configValue: 'true' };
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(boolConfig);

      const result = await service.getConfigAs('feature.enabled', Boolean);

      expect(result).toBe(true);
    });

    it('should convert config value to number', async () => {
      const numConfig = { ...testConfig, configValue: '3600' };
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(numConfig);

      const result = await service.getConfigAs('session.timeout', Number);

      expect(result).toBe(3600);
    });

    it('should throw error on invalid conversion', async () => {
      const invalidConfig = { ...testConfig, configValue: 'not-a-number' };
      mockConfigRepository.findByKeyAndActive.mockResolvedValue(invalidConfig);

      await expect(service.getConfigAs('invalid', Number)).rejects.toThrow();
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('createConfig', () => {
    it('should create new configuration and log audit event', async () => {
      mockConfigRepository.save.mockResolvedValue(testConfig);

      const result = await service.createConfig('test.key', 'test.value', 'STRING', 'Test', false, 'TEST_USER');

      expect(result).toEqual(testConfig);
      expect(mockConfigRepository.save).toHaveBeenCalled();
      expect(mockAuditLogService.logEvent).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalled();
    });

    it('should throw exception for duplicate config key', async () => {
      mockConfigRepository.save.mockRejectedValue(new Error('UNIQUE constraint violation'));

      await expect(service.createConfig('test.key', 'test.value', 'STRING', 'Test', false, 'TEST_USER')).rejects.toThrow(
        'Config key already exists'
      );
      expect(mockAuditLogService.logEvent).toHaveBeenCalled();
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should mask secret values in audit logs', async () => {
      mockConfigRepository.save.mockResolvedValue({ ...testConfig, isSecret: true });

      await service.createConfig('api.secret', 'super-secret', 'STRING', 'Secret', true, 'TEST_USER');

      const auditCall = mockAuditLogService.logEvent.mock.calls[0][0];
      expect(auditCall.newValue).toBe('***MASKED***');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and log old/new values', async () => {
      const updated = { ...testConfig, configValue: 'updated.value', version: 2 };
      mockConfigRepository.findById.mockResolvedValue(testConfig);
      mockConfigRepository.save.mockResolvedValue(updated);

      const result = await service.updateConfig(1, 'updated.value', 'TEST_USER');

      expect(result.configValue).toBe('updated.value');
      expect(result.version).toBe(2);
      expect(mockAuditLogService.logEvent).toHaveBeenCalled();
    });

    it('should throw exception for non-existent config', async () => {
      mockConfigRepository.findById.mockResolvedValue(null);

      await expect(service.updateConfig(999, 'new.value', 'TEST_USER')).rejects.toThrow('Config not found');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('deactivateConfig', () => {
    it('should deactivate configuration (soft delete)', async () => {
      mockConfigRepository.findById.mockResolvedValue(testConfig);
      mockConfigRepository.save.mockResolvedValue({ ...testConfig, isActive: false });

      await service.deactivateConfig(1, 'TEST_USER');

      expect(mockConfigRepository.save).toHaveBeenCalled();
      expect(mockAuditLogService.logEvent).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalled();
    });

    it('should throw exception for non-existent config', async () => {
      mockConfigRepository.findById.mockResolvedValue(null);

      await expect(service.deactivateConfig(999, 'TEST_USER')).rejects.toThrow('Config not found');
    });
  });
});
