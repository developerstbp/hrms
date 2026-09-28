import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  const logs = await AuditLog.find({ companyId: req.user.companyId })
    .populate("actorUserId", "firstName lastName email role")
    .sort({ createdAt: -1 })
    .limit(300);
  res.json(logs);
};
