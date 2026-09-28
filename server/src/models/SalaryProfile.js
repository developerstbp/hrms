import mongoose from "mongoose";

const salaryProfileSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, unique: true, index: true },
  basicSalary: { type: Number, required: true, min: 0 },
  fixedAllowance: { type: Number, default: 0, min: 0 },
  otherAllowance: { type: Number, default: 0, min: 0 },
  fixedDeduction: { type: Number, default: 0, min: 0 },
  overtimeHourlyRate: { type: Number, default: 0, min: 0 },
  paymentMethod: { type: String, enum: ["bank", "cash", "cheque", "other"], default: "bank" },
  bankName: { type: String, default: "" },
  accountTitle: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  notes: { type: String, default: "" },
  effectiveFrom: { type: Date, default: Date.now },
  updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

const SalaryProfile = mongoose.model("SalaryProfile", salaryProfileSchema);
export default SalaryProfile;
