import pino from 'pino';
import { ApplicationLog } from '../types/entities.js';

export class LoggerService {
  private logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private logRepository: any; // Injected at runtime
  private serviceName = process.env.SERVICE_NAME || 'keycloak-saas';
  private environment = process.env.NODE_ENV || 'development';
  private version = process.env.APP_VERSION || '1.0.0';

  constructor(logRepository?: any) {
    this.logRepository = logRepository;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.isLevelEnabled('DEBUG')) {
      this.logger.debug(message, args);
      this.persistLog('DEBUG', message, null, null).catch(() => {});
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.isLevelEnabled('INFO')) {
      this.logger.info(message, args);
      this.persistLog('INFO', message, null, null).catch(() => {});
    }
  }

  warn(message: string, error?: Error | null, ...args: unknown[]): void {
    if (this.isLevelEnabled('WARN')) {
      if (error) {
        this.logger.warn(error, message, args);
      } else {
        this.logger.warn(message, args);
      }
      this.persistLog('WARN', message, error, null).catch(() => {});
    }
  }

  error(message: string, error?: Error | null, ...args: unknown[]): void {
    if (this.isLevelEnabled('ERROR')) {
      if (error) {
        this.logger.error(error, message, args);
      } else {
        this.logger.error(message, args);
      }
      this.persistLog('ERROR', message, error, null).catch(() => {});
    }
  }

  critical(message: string, error?: Error | null): void {
    this.logger.error(`[CRITICAL] ${message}`, error);
    this.persistLog('CRITICAL', message, error, null).catch(() => {});
  }

  logWithContext(level: string, message: string, context: Record<string, unknown>): void {
    if (this.isLevelEnabled(level)) {
      this.logger.info(`[${level}] ${message} | Context: ${JSON.stringify(context)}`);
      this.persistLog(level, message, null, context).catch(() => {});
    }
  }

  private async persistLog(
    level: string,
    message: string,
    error: Error | null,
    context: Record<string, unknown> | null
  ): Promise<void> {
    if (!this.logRepository) return;

    try {
      const loggerName = this.getCallerLoggerName();
      const threadName = process.env.THREAD_NAME || 'main';
      const stacktrace = error ? this.getStackTrace(error) : null;
      const hostname = this.getHostname();

      const logEntry: Partial<ApplicationLog> = {
        logLevel: level,
        loggerName,
        threadName,
        message,
        exception: error?.message,
        stacktrace,
        contextData: context,
        serviceName: this.serviceName,
        environment: this.environment,
        version: this.version,
        hostname,
        createdAt: new Date(),
        createdAtEpoch: BigInt(Date.now())
      };

      await this.logRepository.save(logEntry);
    } catch (e) {
      this.logger.warn(`Failed to persist log: ${(e as Error).message}`);
    }
  }

  private getCallerLoggerName(): string {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    for (const line of lines) {
      if (!line.includes('LoggerService') && !line.includes('node:')) {
        const match = line.match(/at (.+) \(/);
        return match ? match[1] : 'Unknown';
      }
    }
    return 'Unknown';
  }

  private getStackTrace(error: Error): string {
    return error.stack || error.message;
  }

  private getHostname(): string {
    return process.env.HOSTNAME || 'localhost';
  }

  private isLevelEnabled(level: string): boolean {
    const levels = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, CRITICAL: 5 };
    const defaultLevel = process.env.LOG_LEVEL || 'INFO';
    return (levels[level as keyof typeof levels] || 2) >= (levels[defaultLevel as keyof typeof levels] || 2);
  }
}
