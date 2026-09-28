import mongoose from "mongoose";

const shiftChangeRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  currentShiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  requestedShiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
  requestedEffectiveFrom: { type: Date, required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
  reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: "" }
}, { timestamps: true });

shiftChangeRequestSchema.index({ companyId: 1, employeeId: 1, status: 1 });
const ShiftChangeRequest = mongoose.model("ShiftChangeRequest", shiftChangeRequestSchema);
export default ShiftChangeRequest;
