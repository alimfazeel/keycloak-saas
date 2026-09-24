export interface ApplicationConfig {
  configId: number;
  configKey: string;
  configValue: string;
  configType: string;
  description: string;
  isSecret: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  version: number;
}

export interface AuditLog {
  logId: bigint;
  eventType: string;
  eventCategory: string;
  logLevel: string;
  sourceSystem?: string;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValue?: string;
  newValue?: string;
  status: string;
  httpMethod?: string;
  httpStatusCode?: number;
  endpointPath?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  stacktrace?: string;
  additionalContext?: Record<string, unknown>;
  durationMs?: number;
  createdAt: Date;
  createdAtEpoch: bigint;
}

export interface ApplicationLog {
  logId: bigint;
  logLevel: string;
  loggerName: string;
  threadName: string;
  message: string;
  exception?: string;
  stacktrace?: string;
  contextData?: Record<string, unknown>;
  serviceName: string;
  environment: string;
  version: string;
  hostname: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  createdAt: Date;
  createdAtEpoch: bigint;
}

export interface AuditEvent {
  eventType: string;
  eventCategory: string;
  logLevel: string;
  sourceSystem?: string;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValue?: string;
  newValue?: string;
  status: string;
  httpMethod?: string;
  httpStatusCode?: number;
  endpointPath?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  stacktrace?: string;
  additionalContext?: Record<string, unknown>;
  durationMs?: number;
}
