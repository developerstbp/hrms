import AuditLog from "../models/AuditLog.js";

export const writeAudit = async ({ companyId, actorUserId, action, entity, entityId, description, metadata = {} }) => {
  try {
    await AuditLog.create({ companyId, actorUserId, action, entity, entityId, description, metadata });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
};
