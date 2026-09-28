import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  description: { type: String, default: "", trim: true },
  hodId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });
departmentSchema.index({ companyId: 1, code: 1 }, { unique: true });

const Department = mongoose.model("Department", departmentSchema);
export default Department;
