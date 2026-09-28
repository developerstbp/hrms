import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Compensation Revision
|--------------------------------------------------------------------------
|
| Every salary change becomes a dated revision.
|
| Example:
|
| 01 Jan 2026 -> 100,000
| 01 Jul 2026 -> 120,000
|
| Old salary is never overwritten.
|
*/

const compensationRevisionSchema =
  new mongoose.Schema(
    {
      companyId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Company",

        required: true,

        index: true,
      },

      employeeId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Employee",

        required: true,

        index: true,
      },

      effectiveFrom: {
        type: Date,
        required: true,
        index: true,
      },

      basicSalary: {
        type: Number,
        required: true,
        min: 0,
      },

      fixedAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },

      fixedDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },

      overtimeHourlyRate: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
        HR should record why compensation changed.

        Example:
        Annual Increment
        Promotion
        Salary Correction
        Probation Confirmation
      */
      reason: {
        type: String,
        default: "",
        trim: true,
      },

      changedByUserId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

/*
  One employee cannot have two separate salary
  revisions starting on exactly the same date.

  Saving again for that same effective date
  updates that revision.
*/

compensationRevisionSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    effectiveFrom: 1,
  },
  {
    unique: true,
  }
);

const CompensationRevision =
  mongoose.model(
    "CompensationRevision",
    compensationRevisionSchema
  );

export default CompensationRevision;