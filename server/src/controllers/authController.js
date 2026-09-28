import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import User from "../models/User.js";
import Employee from "../models/Employees.js";
import LeaveType from "../models/LeaveType.js";
import generateToken from "../utils/generateToken.js";
import { getDefaultPermissions } from "../constants/permissions.js";
import { writeAudit } from "../utils/audit.js";
import { ensureDefaultShifts } from "../utils/shifts.js";

const slugify = (text) => text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");
const userPayload = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  permissions: user.permissions,
  companyId: user.companyId,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword
});

export const registerCompany = async (req, res) => {
  try {
    const { companyName, companyEmail, firstName, lastName = "", email, password, phone = "" } = req.body;
    if (!companyName || !companyEmail || !firstName || !email || !password) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long." });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCompanyEmail = companyEmail.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists." });
    if (await Company.findOne({ email: normalizedCompanyEmail })) return res.status(409).json({ message: "A company with this email already exists." });

    const company = await Company.create({
      name: companyName,
      slug: slugify(`${companyName}-${Date.now()}`),
      email: normalizedCompanyEmail,
      phone
    });

    const adminUser = await User.create({
      companyId: company._id,
      firstName,
      lastName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "admin",
      permissions: getDefaultPermissions("admin")
    });

    await LeaveType.insertMany([
      { companyId: company._id, name: "Annual Leave", code: "AL", daysPerYear: 14, isPaid: true },
      { companyId: company._id, name: "Sick Leave", code: "SL", daysPerYear: 8, isPaid: true },
      { companyId: company._id, name: "Casual Leave", code: "CL", daysPerYear: 10, isPaid: true }
    ]);
    await ensureDefaultShifts(company._id);

    await writeAudit({ companyId: company._id, actorUserId: adminUser._id, action: "company.created", entity: "Company", entityId: company._id, description: "Company workspace was created." });

    res.status(201).json({ token: generateToken(adminUser), user: userPayload(adminUser), company });
  } catch (error) {
    res.status(500).json({ message: error.code === 11000 ? "This company or account already exists." : "Unable to create the company workspace." });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid email or password." });
    if (!user.isActive) return res.status(403).json({ message: "Your account is inactive. Please contact an administrator." });

    const company = await Company.findById(user.companyId);
    if (!company?.isActive) return res.status(403).json({ message: "Company account is inactive." });

    user.lastLoginAt = new Date();
    await user.save();
    await writeAudit({ companyId: user.companyId, actorUserId: user._id, action: "auth.login", entity: "User", entityId: user._id, description: "User signed in." });

    res.json({ token: generateToken(user), user: userPayload(user), company });
  } catch (error) {
    res.status(500).json({ message: "Unable to sign in right now." });
  }
};

export const getMe = async (req, res) => {
  const [employee, company] = await Promise.all([
    Employee.findOne({ companyId: req.user.companyId, userId: req.user._id }).populate("departmentId", "name code").populate("managerId", "firstName lastName designation"),
    Company.findById(req.user.companyId)
  ]);
  res.json({ user: userPayload(req.user), employee, company });
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) return res.status(400).json({ message: "Provide your current password and a new password of at least 8 characters." });
    const user = await User.findById(req.user._id).select("+password");
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: "Current password is incorrect." });
    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();
    await writeAudit({ companyId: user.companyId, actorUserId: user._id, action: "auth.password_changed", entity: "User", entityId: user._id, description: "Password was changed." });
    res.json({ message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Unable to update password." });
  }
};
