import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  breakMinutes: { type: Number, default: 30, min: 0 },
  graceMinutes: { type: Number, default: 15, min: 0 },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

shiftSchema.index({ companyId: 1, code: 1 }, { unique: true });
const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;
