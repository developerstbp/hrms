import MasterData, { MASTER_DATA_TYPES } from "../models/MasterData.js";
import Department from "../models/Department.js";
import Employee from "../models/Employees.js";
import { writeAudit } from "../utils/audit.js";

const DEFAULT_EMPLOYMENT_TYPES = [
  { name: "Full Time", code: "FULL-TIME", sortOrder: 10 },
  { name: "Part Time", code: "PART-TIME", sortOrder: 20 },
  { name: "Contract", code: "CONTRACT", sortOrder: 30 },
  { name: "Intern", code: "INTERN", sortOrder: 40 }
];

const normalizeType = (value) => MASTER_DATA_TYPES.includes(value) ? value : null;

const ensureEmploymentTypes = async (companyId) => {
  const count = await MasterData.countDocuments({ companyId, type: "employment-type" });
  if (count) return;
  await MasterData.insertMany(DEFAULT_EMPLOYMENT_TYPES.map((item) => ({ ...item, companyId, type: "employment-type" })), { ordered: false }).catch(() => {});
};

export const getMasterData = async (req, res) => {
  try {
    await ensureEmploymentTypes(req.user.companyId);
    const type = req.query.type ? normalizeType(req.query.type) : null;
    if (req.query.type && !type) return res.status(400).json({ message: "Invalid master data type." });
    const query = { companyId: req.user.companyId, ...(type && { type }) };
    const items = await MasterData.find(query)
      .populate("departmentId", "name code")
      .sort({ type: 1, sortOrder: 1, name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Unable to load organization setup data." });
  }
};

export const createMasterData = async (req, res) => {
  try {
    const { type, name, code, description = "", departmentId = null, isActive = true, sortOrder = 0 } = req.body;
    if (!normalizeType(type)) return res.status(400).json({ message: "Invalid master data type." });
    if (!name?.trim() || !code?.trim()) return res.status(400).json({ message: "Name and code are required." });

    let linkedDepartment = null;
    if (type === "designation" && departmentId) {
      linkedDepartment = await Department.findOne({ _id: departmentId, companyId: req.user.companyId });
      if (!linkedDepartment) return res.status(400).json({ message: "Selected department is invalid." });
    }

    const item = await MasterData.create({
      companyId: req.user.companyId,
      type,
      name: name.trim(),
      code: code.trim(),
      description,
      departmentId: type === "designation" ? linkedDepartment?._id || null : null,
      isActive,
      sortOrder
    });

    await writeAudit({
      companyId: req.user.companyId,
      actorUserId: req.user._id,
      action: `master_data.${type}.created`,
      entity: "MasterData",
      entityId: item._id,
      description: `${item.name} was added to ${type.replace("-", " ")} setup.`
    });

    res.status(201).json(await MasterData.findById(item._id).populate("departmentId", "name code"));
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "An item with this name or code already exists in this setup list." : "Unable to create setup item."
    });
  }
};

export const updateMasterData = async (req, res) => {
  try {
    const item = await MasterData.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!item) return res.status(404).json({ message: "Setup item not found." });

    const { name, code, description, departmentId, isActive, sortOrder } = req.body;
    if (name !== undefined) item.name = name.trim();
    if (code !== undefined) item.code = code.trim();
    if (description !== undefined) item.description = description;
    if (typeof isActive === "boolean") item.isActive = isActive;
    if (sortOrder !== undefined) item.sortOrder = Number(sortOrder) || 0;

    if (item.type === "designation" && departmentId !== undefined) {
      if (!departmentId) item.departmentId = null;
      else {
        const department = await Department.findOne({ _id: departmentId, companyId: req.user.companyId });
        if (!department) return res.status(400).json({ message: "Selected department is invalid." });
        item.departmentId = department._id;
      }
    }

    if (!item.name || !item.code) return res.status(400).json({ message: "Name and code are required." });
    await item.save();

    // Keep denormalized employee labels in sync without changing historical payroll snapshots.
    if (item.type === "designation") {
      await Employee.updateMany({ companyId: req.user.companyId, designationId: item._id }, { $set: { designation: item.name } });
    }
    if (item.type === "employment-type") {
      await Employee.updateMany({ companyId: req.user.companyId, employmentTypeId: item._id }, { $set: { employmentType: item.name } });
    }

    await writeAudit({
      companyId: req.user.companyId,
      actorUserId: req.user._id,
      action: `master_data.${item.type}.updated`,
      entity: "MasterData",
      entityId: item._id,
      description: `${item.name} setup item was updated.`
    });

    res.json(await MasterData.findById(item._id).populate("departmentId", "name code"));
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "An item with this name or code already exists in this setup list." : "Unable to update setup item."
    });
  }
};
