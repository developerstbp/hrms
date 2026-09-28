import mongoose from "mongoose";

const rawAttendancePunchSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },

  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
    index: true
  },

  dateKey: {
    type: String,
    required: true,
    index: true
  },

  time: {
    type: String,
    required: true
  },

  punchType: {
    type: String,
    enum: [
      "in",
      "out",
      "unknown"
    ],
    default: "unknown"
  },

  source: {
    type: String,
    enum: [
      "excel",
      "biometric",
      "self",
      "manual"
    ],
    required: true
  },

  importBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AttendanceImportBatch",
    default: null
  },

  sourceRowNumber: {
    type: Number,
    default: null
  },

  rawValue: {
    type: String,
    default: ""
  },

  dedupeKey: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

rawAttendancePunchSchema.index(
  {
    companyId: 1,
    dedupeKey: 1
  },
  {
    unique: true
  }
);

rawAttendancePunchSchema.index({
  companyId: 1,
  employeeId: 1,
  dateKey: 1,
  time: 1
});

const RawAttendancePunch = mongoose.model(
  "RawAttendancePunch",
  rawAttendancePunchSchema
);

export default RawAttendancePunch;