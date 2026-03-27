/**
 * Non-blocking audit logging service.
 *
 * All methods catch errors internally and log them rather than
 * propagating — audit failures must never break the main operation.
 */
const crypto = require('crypto');
const AuditLog = require('../models/AuditLog.model');
const logger = require('../utils/logger');

/**
 * Hash sensitive payload data before storing.
 * @param {*} payload
 * @returns {string} SHA-256 hex digest
 */
const hashPayload = (payload) => {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex');
};

/**
 * Record an audit log entry. Non-blocking — errors are caught and logged.
 *
 * @param {object} params
 * @param {string} params.actor - Who performed the action
 * @param {string} params.action - Action identifier (e.g. 'wallet.deposit')
 * @param {string} params.target - Target resource identifier
 * @param {*} [params.payload] - Sensitive data to hash (not stored raw)
 * @param {string} [params.outcome='success'] - 'success' or 'failure'
 * @param {object} [params.metadata] - Additional non-sensitive context
 */
const log = async ({ actor, action, target, payload, outcome = 'success', metadata }) => {
  try {
    const entry = {
      actor: String(actor),
      action,
      target: String(target),
      outcome,
    };

    if (payload) {
      entry.payload_hash = hashPayload(payload);
    }

    if (metadata) {
      entry.metadata = JSON.stringify(metadata);
    }

    await AuditLog.create(entry);
  } catch (error) {
    logger.error(`[AuditService] Failed to write audit log: ${error.message}`);
  }
};

const list = async ({ actor, action, limit = 50 } = {}) => {
  try {
    return await AuditLog.findAll({ actor, action, limit });
  } catch (error) {
    logger.error(`[AuditService] Failed to read audit log: ${error.message}`);
    throw error;
  }
};

module.exports = { log, list, hashPayload };
