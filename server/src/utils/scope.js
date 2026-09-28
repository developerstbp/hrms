import Employee from "../models/Employees.js";
import Department from "../models/Department.js";

export const getEmployeeForUser = async (user) => Employee.findOne({ companyId: user.companyId, userId: user._id });

export const getScopedEmployeeIds = async (user, includeSelf = true) => {
  if (["admin", "hr"].includes(user.role)) return null;

  const actorEmployee = await getEmployeeForUser(user);
  if (!actorEmployee) return [];

  if (user.role === "hod") {
    const departmentIds = await Department.distinct("_id", { companyId: user.companyId, hodId: actorEmployee._id });
    const query = departmentIds.length
      ? { companyId: user.companyId, $or: [{ departmentId: { $in: departmentIds } }, { _id: actorEmployee._id }] }
      : { companyId: user.companyId, departmentId: actorEmployee.departmentId };
    return Employee.distinct("_id", query);
  }

  if (user.role === "manager") {
    const query = { companyId: user.companyId, $or: [{ managerId: actorEmployee._id }] };
    if (includeSelf) query.$or.push({ _id: actorEmployee._id });
    return Employee.distinct("_id", query);
  }

  return includeSelf ? [actorEmployee._id] : [];
};

export const canActForEmployee = async (user, employeeId) => {
  if (["admin", "hr"].includes(user.role)) return true;
  const scopedIds = await getScopedEmployeeIds(user, true);
  return scopedIds.some((id) => id.toString() === employeeId.toString());
};
