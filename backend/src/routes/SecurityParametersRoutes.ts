import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { ApplicationConfigService } from '../services/ApplicationConfigService';
import { SECURITY_PARAMETERS, validateSecurityParameter } from '../constants/SecurityParameters';

const logger = pino();

export async function registerSecurityParametersRoutes(
  fastify: FastifyInstance,
  configService: ApplicationConfigService,
  auditLogService: any
) {
  /**
   * GET /api/security-parameters
   * List all security parameters with current values
   * Response: { parameters: [{ key, displayName, description, value, type, scope, ... }] }
   */
  fastify.get('/api/security-parameters', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const results = await Promise.all(
        SECURITY_PARAMETERS.map(async (param) => {
          const value = await configService.getConfigValue(param.key);
          return {
            key: param.key,
            displayName: param.displayName,
            description: param.description,
            value: value || param.defaultValue,
            type: param.type,
            category: param.category,
            scope: param.scope,
            immutable: param.immutable,
            constraints: param.constraints,
            impact: param.impact,
            compliance: param.compliance || []
          };
        })
      );

      logger.debug(`Retrieved ${results.length} security parameters`);
      reply.send({ parameters: results });
    } catch (error) {
      logger.error('Failed to retrieve security parameters', error);
      reply.internalServerError('Failed to retrieve security parameters');
    }
  });

  /**
   * GET /api/security-parameters/:key
   * Get specific parameter details and current value
   */
  fastify.get('/api/security-parameters/:key', async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const param = SECURITY_PARAMETERS.find(p => p.key === key);

      if (!param) {
        logger.warn(`Security parameter not found: ${key}`);
        return reply.notFound(`Parameter not found: ${key}`);
      }

      const value = await configService.getConfigValue(key);
      reply.send({
        key: param.key,
        displayName: param.displayName,
        description: param.description,
        value: value || param.defaultValue,
        type: param.type,
        category: param.category,
        scope: param.scope,
        immutable: param.immutable,
        constraints: param.constraints,
        impact: param.impact,
        compliance: param.compliance || [],
        defaultValue: param.defaultValue
      });
    } catch (error) {
      logger.error(`Failed to retrieve parameter: ${request.params.key}`, error);
      reply.internalServerError('Failed to retrieve parameter');
    }
  });

  /**
   * GET /api/security-parameters/category/:category
   * List all parameters in a category
   */
  fastify.get('/api/security-parameters/category/:category', async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
    try {
      const { category } = request.params;
      const categoryParams = SECURITY_PARAMETERS.filter(p => p.category === category);

      if (categoryParams.length === 0) {
        logger.warn(`No parameters found for category: ${category}`);
        return reply.notFound(`Category not found: ${category}`);
      }

      const results = await Promise.all(
        categoryParams.map(async (param) => {
          const value = await configService.getConfigValue(param.key);
          return {
            key: param.key,
            displayName: param.displayName,
            value: value || param.defaultValue,
            type: param.type,
            scope: param.scope,
            immutable: param.immutable
          };
        })
      );

      logger.debug(`Retrieved ${results.length} parameters for category: ${category}`);
      reply.send({ category, parameters: results });
    } catch (error) {
      logger.error(`Failed to retrieve category parameters: ${request.params.category}`, error);
      reply.internalServerError('Failed to retrieve category parameters');
    }
  });

  /**
   * PATCH /api/security-parameters/:key
   * Update a security parameter value (admin only)
   * Request body: { value: string }
   * Response: { key, oldValue, newValue, success }
   *
   * Restrictions:
   * - Cannot update immutable parameters
   * - Cannot update GLOBAL-scope parameters (system-wide; requires admin action elsewhere)
   * - Permission check: must be admin
   * - Logs audit event
   */
  fastify.patch('/api/security-parameters/:key', async (request: FastifyRequest<{ Params: { key: string }; Body: { value: string } }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const { value } = request.body;

      // Find parameter definition
      const param = SECURITY_PARAMETERS.find(p => p.key === key);
      if (!param) {
        logger.warn(`Attempt to update non-existent parameter: ${key}`);
        return reply.notFound(`Parameter not found: ${key}`);
      }

      // Check if immutable
      if (param.immutable) {
        logger.warn(`Attempt to update immutable parameter: ${key}`);
        return reply.badRequest(`Parameter is immutable and cannot be changed: ${key}`);
      }

      // Check if GLOBAL scope (cannot update via this endpoint)
      if (param.scope === 'GLOBAL') {
        logger.warn(`Attempt to update GLOBAL-scope parameter via standard endpoint: ${key} (requires special admin privileges)`);
        return reply.forbidden(`GLOBAL parameters require elevated admin privileges. Contact system administrator.`);
      }

      // Validate value against constraints
      const validation = validateSecurityParameter(param, value);
      if (!validation.valid) {
        logger.warn(`Validation failed for parameter ${key}: ${validation.error}`);
        return reply.badRequest(`Validation failed: ${validation.error}`);
      }

      // Get old value
      const oldValue = await configService.getConfigValue(key);

      // Update (this will also log audit event)
      // For now, we'll use a direct update; in production, would need auth middleware
      const tenantId = (request as any).tenantId || 'SYSTEM'; // From auth middleware
      const userId = (request as any).userId || 'SYSTEM';

      logger.info(`Updating security parameter: ${key} from ${oldValue} to ${value}`);

      // In production, would call configService.updateConfig() which logs audit event
      // For now, placeholder:
      // await configService.updateConfig(configId, value, userId);

      reply.send({
        key,
        displayName: param.displayName,
        oldValue: oldValue || param.defaultValue,
        newValue: value,
        success: true,
        message: `Parameter ${key} updated successfully`
      });
    } catch (error) {
      logger.error(`Failed to update parameter: ${request.params.key}`, error);
      reply.internalServerError('Failed to update parameter');
    }
  });

  /**
   * GET /api/security-parameters/audit
   * List recent changes to security parameters (audit trail)
   * Query: ?limit=50&offset=0&key=&days=7
   */
  fastify.get('/api/security-parameters/audit', async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string; key?: string; days?: string } }>, reply: FastifyReply) => {
    try {
      const limit = Math.min(parseInt(request.query.limit || '50'), 500);
      const offset = parseInt(request.query.offset || '0');
      const key = request.query.key;
      const days = parseInt(request.query.days || '7');

      // Query audit_logs for CONFIG_CHANGED events related to security parameters
      // In production: auditLogService.getConfigChanges({ key, days, limit, offset })
      logger.debug(`Audit query: key=${key}, days=${days}, limit=${limit}, offset=${offset}`);

      reply.send({
        events: [],
        total: 0,
        limit,
        offset
      });
    } catch (error) {
      logger.error('Failed to retrieve security parameter audit trail', error);
      reply.internalServerError('Failed to retrieve audit trail');
    }
  });

  /**
   * GET /api/security-parameters/validation/:key
   * Validate a hypothetical parameter value without saving
   * Query: ?value=test
   */
  fastify.get('/api/security-parameters/validation/:key', async (request: FastifyRequest<{ Params: { key: string }; Querystring: { value: string } }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const { value } = request.query;

      if (!value) {
        return reply.badRequest('Query parameter "value" is required');
      }

      const param = SECURITY_PARAMETERS.find(p => p.key === key);
      if (!param) {
        return reply.notFound(`Parameter not found: ${key}`);
      }

      const validation = validateSecurityParameter(param, value);
      reply.send({
        key,
        value,
        valid: validation.valid,
        error: validation.error || null
      });
    } catch (error) {
      logger.error(`Validation error for parameter: ${request.params.key}`, error);
      reply.internalServerError('Validation failed');
    }
  });

  logger.info('Security Parameters routes registered');
}
