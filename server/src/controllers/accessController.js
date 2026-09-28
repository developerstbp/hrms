import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Employee from "../models/Employees.js";
import { ALL_PERMISSIONS, PERMISSIONS, getDefaultPermissions } from "../constants/permissions.js";
import { writeAudit } from "../utils/audit.js";
import {
  notifyUser,
} from "../utils/notifications.js";

export const getAccessUsers = async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId }).sort({ firstName: 1, lastName: 1 });
  for (const user of users) {
    if (user.permissionSchemaVersion !== 2) {
      user.permissions = user.role === "admin"
        ? [...ALL_PERMISSIONS]
        : [...new Set([...(user.permissions || []), ...getDefaultPermissions(user.role)])].filter((permission) => permission !== PERMISSIONS.ACCESS_CONTROL);
      user.permissionSchemaVersion = 2;
      await user.save();
    }
  }
  const employees = await Employee.find({ companyId: req.user.companyId }).select("userId employeeCode designation departmentId").populate("departmentId", "name");
  const employeeMap = Object.fromEntries(employees.map((employee) => [employee.userId.toString(), employee]));
  res.json({
    permissions: ALL_PERMISSIONS,
    users: users.map((user) => ({ ...user.toObject(), employee: employeeMap[user._id.toString()] || null }))
  });
};

export const updateUserAccess = async (req, res) => {
  try {
    const { role, permissions, isActive } = req.body;
    const target = await User.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!target) return res.status(404).json({ message: "User account not found." });

    const previousRole =
      target.role;

    const previousActive =
      target.isActive;

    const previousPermissions =
      [
        ...(
          target.permissions ||
          []
        ),
      ].sort();

    const isSelf = target._id.toString() === req.user._id.toString();
    if (isSelf && (role && role !== "admin")) return res.status(400).json({ message: "You cannot remove your own administrator role." });
    if (isSelf && isActive === false) return res.status(400).json({ message: "You cannot deactivate your own account." });

    const nextRole = role || target.role;
    if (!["admin", "hr", "hod", "manager", "employee"].includes(nextRole)) return res.status(400).json({ message: "Invalid role selected." });

    let nextPermissions;
    if (nextRole === "admin") {
      nextPermissions = [...ALL_PERMISSIONS];
    } else if (Array.isArray(permissions)) {
      nextPermissions = permissions.filter((permission) => ALL_PERMISSIONS.includes(permission) && permission !== PERMISSIONS.ACCESS_CONTROL);
      if (!nextPermissions.includes(PERMISSIONS.DASHBOARD_VIEW)) nextPermissions.push(PERMISSIONS.DASHBOARD_VIEW);
    } else if (role && role !== target.role) {
      nextPermissions = getDefaultPermissions(nextRole).filter((permission) => permission !== PERMISSIONS.ACCESS_CONTROL);
    } else {
      nextPermissions = target.permissions.filter((permission) => permission !== PERMISSIONS.ACCESS_CONTROL);
      if (!nextPermissions.includes(PERMISSIONS.DASHBOARD_VIEW)) nextPermissions.push(PERMISSIONS.DASHBOARD_VIEW);
    }

    target.role = nextRole;
    target.permissions = nextPermissions;
    target.permissionSchemaVersion = 2;
    if (typeof isActive === "boolean") target.isActive = isActive;
    await target.save();

    await notifyUser({
      companyId:
        req.user.companyId,

      userId:
        target._id,

      type:
        "system",

      title:
        "Temporary password set",

      message:
        "An administrator set a temporary password for your account. You will be required to change it after signing in.",

      link:
        "/profile",
    });

    const nextPermissionList =
      [
        ...(
          target.permissions ||
          []
        ),
      ].sort();

    const accessChanges =
      [];

    if (
      previousRole !==
      target.role
    ) {
      accessChanges.push(
        `role changed from ${previousRole} to ${target.role}`
      );
    }

    if (
      previousActive !==
      target.isActive
    ) {
      accessChanges.push(
        target.isActive
          ? "account activated"
          : "account deactivated"
      );
    }

    if (
      JSON.stringify(
        previousPermissions
      ) !==
      JSON.stringify(
        nextPermissionList
      )
    ) {
      accessChanges.push(
        "permissions updated"
      );
    }

    if (
      accessChanges.length
    ) {
      await notifyUser({
        companyId:
          req.user.companyId,

        userId:
          target._id,

        type:
          "system",

        title:
          "Access settings updated",

        message:
          `Your HRMS access was updated: ${accessChanges.join(", ")}.`,

        link:
          "/profile",

        metadata: {
          role:
            target.role,

          isActive:
            target.isActive,
        },
      });
    }

    await writeAudit({ companyId: req.user.companyId, actorUserId: req.user._id, action: "access.updated", entity: "User", entityId: target._id, description: `Access settings were updated for ${target.firstName} ${target.lastName}`.trim() + ".", metadata: { role: target.role, isActive: target.isActive } });
    res.json({ _id: target._id, firstName: target.firstName, lastName: target.lastName, email: target.email, role: target.role, permissions: target.permissions, isActive: target.isActive });
  } catch (error) {
    res.status(500).json({ message: "Unable to update user access." });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || temporaryPassword.length < 8) return res.status(400).json({ message: "Temporary password must be at least 8 characters long." });
    const target = await User.findOne({ _id: req.params.id, companyId: req.user.companyId }).select("+password");
    if (!target) return res.status(404).json({ message: "User account not found." });
    target.password = await bcrypt.hash(temporaryPassword, 12);
    target.mustChangePassword = true;
    await target.save();
    await writeAudit({ companyId: req.user.companyId, actorUserId: req.user._id, action: "access.password_reset", entity: "User", entityId: target._id, description: `A temporary password was set for ${target.firstName} ${target.lastName}`.trim() + "." });
    res.json({ message: "Temporary password set successfully. The user must change it after signing in." });
  } catch (error) {
    res.status(500).json({ message: "Unable to reset user password." });
  }
};
