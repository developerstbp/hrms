import mongoose from "mongoose";

export const MASTER_DATA_TYPES = ["designation", "location", "employment-type", "grade"];

const masterDataSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  type: { type: String, enum: MASTER_DATA_TYPES, required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  description: { type: String, default: "", trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

masterDataSchema.index({ companyId: 1, type: 1, code: 1 }, { unique: true });
masterDataSchema.index({ companyId: 1, type: 1, name: 1, departmentId: 1 }, { unique: true });

const MasterData = mongoose.model("MasterData", masterDataSchema);
export default MasterData;
