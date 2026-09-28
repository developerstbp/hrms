import mongoose from "mongoose";

const leaveBalanceAdjustmentSchema =
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
        index: true,
      },

      year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2200,
        index: true,
      },

      days: {
        type: Number,
        required: true,
      },

      adjustmentType: {
        type: String,
        enum: [
          "opening-balance",
          "manual-credit",
          "manual-debit",
          "carry-forward",
        ],
        default: "manual-credit",
      },

      reason: {
        type: String,
        required: true,
        trim: true,
      },

      createdByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

leaveBalanceAdjustmentSchema.index({
  companyId: 1,
  employeeId: 1,
  leaveTypeId: 1,
  year: 1,
});

leaveBalanceAdjustmentSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    leaveTypeId: 1,
    year: 1,
    adjustmentType: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      adjustmentType: "carry-forward",
    },
  }
);

const LeaveBalanceAdjustment =
  mongoose.model(
    "LeaveBalanceAdjustment",
    leaveBalanceAdjustmentSchema
  );

export default LeaveBalanceAdjustment;