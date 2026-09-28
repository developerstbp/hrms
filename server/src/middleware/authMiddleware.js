import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Company from "../models/Company.js";
import { PERMISSIONS, getDefaultPermissions } from "../constants/permissions.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Your account is inactive or no longer available." });
    }

    if (user.role === "admin") {
      const defaults = getDefaultPermissions("admin");
      if (user.permissionSchemaVersion !== 2 || defaults.some((permission) => !user.permissions.includes(permission))) {
        user.permissions = defaults;
        user.permissionSchemaVersion = 2;
        await user.save();
      }
    } else if (user.permissionSchemaVersion !== 2 || !Array.isArray(user.permissions) || user.permissions.length === 0) {
      user.permissions = [...new Set([...(user.permissions || []), ...getDefaultPermissions(user.role)])].filter((permission) => permission !== PERMISSIONS.ACCESS_CONTROL);
      user.permissionSchemaVersion = 2;
      await user.save();
    }

    const company = await Company.findById(user.companyId).select("isActive");
    if (!company?.isActive) {
      return res.status(403).json({ message: "Company account is inactive." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session. Please sign in again." });
  }
};

export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required." });
  const hasPermission = permissions.some((permission) => req.user.permissions.includes(permission));
  if (!hasPermission) return res.status(403).json({ message: "You do not have permission to perform this action." });
  next();
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin" || !req.user.permissions.includes(PERMISSIONS.ACCESS_CONTROL)) {
    return res.status(403).json({ message: "Only an administrator can manage user access." });
  }
  next();
};
