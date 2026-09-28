import mongoose from "mongoose";

const approvalHistorySchema =
  new mongoose.Schema(
    {
      status: {
        type: String,

        enum: [
          "pending",
          "under_review",
          "more_info_required",
          "on_hold",
          "approved",
          "rejected",
          "cancelled",
        ],

        required: true,
      },

      note: {
        type: String,
        default: "",
      },

      byUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      byRole: {
        type: String,
        default: "",
      },

      at: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

const leaveRequestSchema =
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

      leaveTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LeaveType",
        required: true,
      },

      requestedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      requestedByRole: {
        type: String,

        enum: [
          "admin",
          "hr",
          "hod",
          "manager",
          "employee",
        ],

        required: true,
      },

      requestedOnBehalf: {
        type: Boolean,
        default: false,
      },

      requestSource: {
        type: String,

        enum: [
          "self",
          "on-behalf",
        ],

        default: "self",
      },

      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },

      halfDay: {
        type: Boolean,
        default: false,
      },

      halfDayPeriod: {
        type: String,

        enum: [
          "",
          "first-half",
          "second-half",
        ],

        default: "",
      },

      days: {
        type: Number,
        required: true,
        min: 0.5,
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,

        enum: [
          "pending",
          "pending_hr",
          "under_review",
          "more_info_required",
          "on_hold",
          "approved",
          "rejected",
          "cancelled",
        ],

        default: "pending_hr",
        index: true,
      },

      reviewNote: {
        type: String,
        default: "",
      },

      reviewedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },

      employeeResponse: {
        type: String,
        default: "",
      },

      approvalHistory: {
        type: [
          approvalHistorySchema,
        ],

        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

leaveRequestSchema.index({
  companyId: 1,
  employeeId: 1,
  startDate: 1,
  endDate: 1,
});

const LeaveRequest =
  mongoose.model(
    "LeaveRequest",
    leaveRequestSchema
  );

export default LeaveRequest;