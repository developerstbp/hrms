import mongoose from "mongoose";

const attendancePunchSchema =
  new mongoose.Schema(
    {
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true,
      },

      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
        index: true,
      },

      employeeCode: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      punchTime: {
        type: Date,
        required: true,
        index: true,
      },

      dateKey: {
        type: String,
        required: true,
        index: true,
      },

      punchType: {
        type: String,
        enum: ["in", "out", "unknown"],
        default: "unknown",
      },

      source: {
        type: String,
        enum: ["excel", "biometric", "manual", "self"],
        default: "excel",
      },

      importBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AttendanceImportBatch",
        default: null,
      },

      deviceId: {
        type: String,
        default: "",
      },

      deviceUserId: {
        type: String,
        default: "",
      },

      processed: {
        type: Boolean,
        default: false,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      attendanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attendance",
        default: null,
      },

      isDuplicate: {
        type: Boolean,
        default: false,
      },

      rawData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

attendancePunchSchema.index({
  companyId: 1,
  employeeId: 1,
  dateKey: 1,
  punchTime: 1,
});

attendancePunchSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    punchTime: 1,
  },
  {
    unique: true,
  }
);

attendancePunchSchema.index({
  companyId: 1,
  processed: 1,
  dateKey: 1,
});

const AttendancePunch =
  mongoose.models.AttendancePunch ||
  mongoose.model(
    "AttendancePunch",
    attendancePunchSchema
  );

export default AttendancePunch;