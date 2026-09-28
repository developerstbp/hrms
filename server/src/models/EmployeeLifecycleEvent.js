import mongoose from "mongoose";

export const EMPLOYEE_LIFECYCLE_ACTIONS = [
  "confirmation",
  "promotion",
  "transfer",
  "designation-change",
  "manager-change",
  "notice-started",
  "resignation",
  "termination",
  "separation-completed"
];

const employeeLifecycleEventSchema =
  new mongoose.Schema(
    {
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

      action: {
        type: String,
        enum: EMPLOYEE_LIFECYCLE_ACTIONS,
        required: true,
        index: true
      },

      effectiveDate: {
        type: Date,
        required: true,
        index: true
      },

      reason: {
        type: String,
        required: true,
        trim: true
      },

      notes: {
        type: String,
        default: "",
        trim: true
      },

      before: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },

      after: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },

      performedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    },
    {
      timestamps: true
    }
  );

employeeLifecycleEventSchema.index({
  companyId: 1,
  employeeId: 1,
  effectiveDate: -1
});

const EmployeeLifecycleEvent =
  mongoose.model(
    "EmployeeLifecycleEvent",
    employeeLifecycleEventSchema
  );

export default EmployeeLifecycleEvent;