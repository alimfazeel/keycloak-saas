import pino from 'pino';
import { ApplicationConfig, AuditEvent } from '../types/entities.js';

const logger = pino();

export class ApplicationConfigService {
  private cache: Map<string, string> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configRepository: any,
    private auditLogService: any,
    private loggerService: any
  ) {}

  async getConfigValue(configKey: string): Promise<string | null> {
    this.loggerService.debug(`Fetching config value for key: ${configKey}`);

    // Check cache first
    const cached = this.cache.get(configKey);
    const expiry = this.cacheExpiry.get(configKey);
    if (cached && expiry && Date.now() < expiry) {
      this.loggerService.debug(`Config found in cache for key: ${configKey}`);
      return cached;
    }

    const config = await this.configRepository.findByKeyAndActive(configKey);
    if (config) {
      this.loggerService.debug(`Config found for key: ${configKey}`);
      this.cache.set(configKey, config.configValue);
      this.cacheExpiry.set(configKey, Date.now() + this.cacheTTL);
      return config.configValue;
    }

    this.loggerService.warn(`Config key not found: ${configKey}`);
    return null;
  }

  async getConfigValueOrDefault(configKey: string, defaultValue: string): Promise<string> {
    this.loggerService.info(`Fetching config with default fallback. Key: ${configKey}, Default: ${defaultValue}`);
    const value = await this.getConfigValue(configKey);
    return value || defaultValue;
  }

  async getConfigAs<T>(configKey: string, type: new (...args: unknown[]) => T): Promise<T | null> {
    this.loggerService.debug(`Fetching config as type: ${type.name} for key: ${configKey}`);
    const value = await this.getConfigValue(configKey);
    if (!value) {
      this.loggerService.warn(`Config key not found for type conversion: ${configKey}`);
      return null;
    }
    return this.convertValue(value, type);
  }

  async getAllConfig(): Promise<Record<string, string>> {
    this.loggerService.info('Fetching all active configuration entries');
    const configs = await this.configRepository.findAllActive();
    this.loggerService.debug(`Found ${configs.length} active config entries`);
    return configs.reduce((acc: Record<string, string>, cfg: ApplicationConfig) => {
      acc[cfg.configKey] = cfg.configValue;
      return acc;
    }, {});
  }

  async getConfigById(configId: number): Promise<ApplicationConfig | null> {
    this.loggerService.debug(`Fetching config by ID: ${configId}`);
    return this.configRepository.findById(configId);
  }

  async createConfig(
    configKey: string,
    configValue: string,
    configType: string,
    description: string,
    isSecret: boolean,
    createdBy: string
  ): Promise<ApplicationConfig> {
    this.loggerService.info(`Creating new config entry. Key: ${configKey}, Type: ${configType}, Secret: ${isSecret}`);

    try {
      const config: Partial<ApplicationConfig> = {
        configKey,
        configValue,
        configType,
        description,
        isSecret,
        isActive: true,
        createdBy,
        createdAt: new Date(),
        version: 1
      };

      const saved = await this.configRepository.save(config);
      this.loggerService.info(`Config created successfully. ID: ${saved.configId}, Key: ${configKey}`);

      const auditEvent: AuditEvent = {
        eventType: 'CONFIG_CREATED',
        eventCategory: 'CONFIGURATION',
        action: 'CREATE',
        resourceType: 'APPLICATION_CONFIG',
        resourceId: saved.configId.toString(),
        newValue: isSecret ? '***MASKED***' : configValue,
        userId: createdBy,
        status: 'SUCCESS',
        logLevel: 'INFO'
      };
      await this.auditLogService.logEvent(auditEvent);

      this.invalidateCache(configKey);
      return saved;
    } catch (e) {
      const error = e as Error;
      if (error.message.includes('duplicate') || error.message.includes('UNIQUE')) {
        this.loggerService.error(`Config key already exists: ${configKey}. Error: ${error.message}`);
        const failureEvent: AuditEvent = {
          eventType: 'CONFIG_CREATE_FAILED',
          eventCategory: 'CONFIGURATION',
          action: 'CREATE',
          resourceType: 'APPLICATION_CONFIG',
          resourceId: configKey,
          status: 'FAILURE',
          errorMessage: `Duplicate config key: ${configKey}`,
          userId: createdBy,
          logLevel: 'ERROR'
        };
        await this.auditLogService.logEvent(failureEvent);
        throw new Error(`Config key already exists: ${configKey}`);
      }
      this.loggerService.error(`Failed to create config: ${configKey}`, error);
      throw e;
    }
  }

  async updateConfig(configId: number, configValue: string, updatedBy: string): Promise<ApplicationConfig> {
    this.loggerService.info(`Updating config. ID: ${configId}, UpdatedBy: ${updatedBy}`);

    const config = await this.configRepository.findById(configId);
    if (!config) {
      this.loggerService.error(`Config not found for update. ID: ${configId}`);
      throw new Error(`Config not found: ${configId}`);
    }

    const oldValue = config.configValue;
    config.configValue = configValue;
    config.updatedAt = new Date();
    config.updatedBy = updatedBy;
    config.version = (config.version || 1) + 1;

    const updated = await this.configRepository.save(config);
    this.loggerService.info(`Config updated successfully. ID: ${configId}, Key: ${config.configKey}, Version: ${config.version}`);

    const auditEvent: AuditEvent = {
      eventType: 'CONFIG_UPDATED',
      eventCategory: 'CONFIGURATION',
      action: 'UPDATE',
      resourceType: 'APPLICATION_CONFIG',
      resourceId: configId.toString(),
      oldValue: config.isSecret ? '***MASKED***' : oldValue,
      newValue: config.isSecret ? '***MASKED***' : configValue,
      userId: updatedBy,
      status: 'SUCCESS',
      logLevel: 'INFO'
    };
    await this.auditLogService.logEvent(auditEvent);

    this.invalidateCache(config.configKey);
    return updated;
  }

  async deactivateConfig(configId: number, deactivatedBy: string): Promise<void> {
    this.loggerService.info(`Deactivating config. ID: ${configId}, DeactivatedBy: ${deactivatedBy}`);

    const config = await this.configRepository.findById(configId);
    if (!config) {
      this.loggerService.error(`Config not found for deactivation. ID: ${configId}`);
      throw new Error(`Config not found: ${configId}`);
    }

    config.isActive = false;
    config.updatedAt = new Date();
    config.updatedBy = deactivatedBy;

    await this.configRepository.save(config);
    this.loggerService.info(`Config deactivated successfully. ID: ${configId}, Key: ${config.configKey}`);

    const auditEvent: AuditEvent = {
      eventType: 'CONFIG_DEACTIVATED',
      eventCategory: 'CONFIGURATION',
      action: 'DEACTIVATE',
      resourceType: 'APPLICATION_CONFIG',
      resourceId: configId.toString(),
      oldValue: 'is_active=true',
      newValue: 'is_active=false',
      userId: deactivatedBy,
      status: 'SUCCESS',
      logLevel: 'INFO'
    };
    await this.auditLogService.logEvent(auditEvent);

    this.invalidateCache(config.configKey);
  }

  private invalidateCache(configKey: string): void {
    this.cache.delete(configKey);
    this.cacheExpiry.delete(configKey);
    this.loggerService.debug(`Cache invalidated for key: ${configKey}`);
  }

  private invalidateAllCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.loggerService.debug('All application config cache invalidated');
  }

  private convertValue<T>(value: string, type: new (...args: unknown[]) => T): T {
    this.loggerService.debug(`Converting value '${value}' to type: ${type.name}`);
    try {
      if (type === String) return value as unknown as T;
      if (type === Boolean) return (value.toLowerCase() === 'true') as unknown as T;
      if (type === Number) return (Number(value)) as unknown as T;
      if (type === BigInt) return (BigInt(value)) as unknown as T;
      this.loggerService.warn(`Unsupported type conversion: ${type.name}`);
      return null as unknown as T;
    } catch (e) {
      this.loggerService.error(`Failed to convert value '${value}' to type: ${type.name}`, e as Error);
      throw new Error(`Cannot convert '${value}' to ${type.name}`);
    }
  }
}
