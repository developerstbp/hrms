import mongoose from "mongoose";

const shiftSnapshotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  breakMinutes: { type: Number, default: 30 },
  graceMinutes: { type: Number, default: 15 },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }
}, { _id: false });

const shiftAssignmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
  snapshot: { type: shiftSnapshotSchema, required: true },
  effectiveFrom: { type: Date, required: true, index: true },
  effectiveTo: { type: Date, default: null, index: true },
  assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  source: { type: String, enum: ["manual", "request", "employee-create"], default: "manual" },
  reason: { type: String, default: "" }
}, { timestamps: true });

shiftAssignmentSchema.index({ companyId: 1, employeeId: 1, effectiveFrom: 1 });
const ShiftAssignment = mongoose.model("ShiftAssignment", shiftAssignmentSchema);
export default ShiftAssignment;
