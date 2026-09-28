import mongoose from "mongoose";

const leaveTypeSchema =
  new mongoose.Schema(
    {
      companyId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref:
          "Company",
        required:
          true,
        index:
          true,
      },

      name: {
        type:
          String,
        required:
          true,
        trim:
          true,
      },

      code: {
        type:
          String,
        required:
          true,
        trim:
          true,
        uppercase:
          true,
      },

      daysPerYear: {
        type:
          Number,
        default:
          0,
        min:
          0,
      },

      isPaid: {
        type:
          Boolean,
        default:
          true,
      },

      allowHalfDay: {
        type:
          Boolean,
        default:
          true,
      },

      requiresReason: {
        type:
          Boolean,
        default:
          true,
      },

      carryForwardAllowed: {
        type:
          Boolean,
        default:
          false,
      },

      maxCarryForward: {
        type:
          Number,
        default:
          0,
        min:
          0,
      },

      maxConsecutiveDays: {
        type:
          Number,
        default:
          0,
        min:
          0,
      },

      noticeDays: {
        type:
          Number,
        default:
          0,
        min:
          0,
      },

      allowNegativeBalance: {
        type:
          Boolean,
        default:
          false,
      },

      isActive: {
        type:
          Boolean,
        default:
          true,
      },
    },

    {
      timestamps:
        true,
    }
  );

leaveTypeSchema.index(
  {
    companyId:
      1,
    code:
      1,
  },

  {
    unique:
      true,
  }
);

leaveTypeSchema.index({
  companyId:
    1,

  isActive:
    1,
});

const LeaveType =
  mongoose.models
    .LeaveType ||
  mongoose.model(
    "LeaveType",
    leaveTypeSchema
  );

export default LeaveType;